'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { Send, Terminal, Cpu, Bot, X, Square } from 'lucide-react';
import { useDictionary, useDirection, useLocale } from '@/lib/i18n/provider';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { TerminalFrame } from '@/app/components/TerminalFrame';
import { EASE_OUT } from '@/lib/motion';

interface Message {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  agentName?: string;
  /** True for answers streamed from the API — rendered directly (the network
   * stream is the typing effect) instead of through JitteredTyping, which
   * restarts its timers whenever `text` changes. */
  live?: boolean;
}

// 3.8: Jittered per-character typewriter for agent message streaming.
// base 26ms + rand(34ms); +40ms after space; +180ms after .!?
// Uses visibility (not opacity) so the span width is preserved — no reflow.
const JitteredTyping = ({
  text,
  reduced,
}: {
  text: string;
  reduced: boolean;
}) => {
  const [revealed, setRevealed] = useState(reduced ? text.length : 0);

  useEffect(() => {
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRevealed(text.length);
      return;
    }
    setRevealed(0);
    let cumulative = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < text.length; i++) {
      const prev = i > 0 ? text[i - 1] : '';
      let delay = 26 + Math.random() * 34;
      if (/[.!?]/.test(prev)) delay += 180;
      else if (prev === ' ') delay += 40;
      cumulative += delay;
      const idx = i + 1;
      timers.push(setTimeout(() => setRevealed(idx), cumulative));
    }
    return () => timers.forEach(clearTimeout);
  }, [text, reduced]);

  return (
    <span aria-label={text}>
      {text.split('').map((char, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{ visibility: i < revealed ? 'visible' : 'hidden', display: 'inline' }}
        >
          {char}
        </span>
      ))}
    </span>
  );
};

// Streamed answers arrive as plain text; bare URLs in them (project links,
// GitHub repos) must be tappable — especially on mobile.
const URL_SPLIT_RE = /(https?:\/\/[^\s]+)/g;
const LinkifiedText = ({ text }: { text: string }) => (
  <>
    {text.split(URL_SPLIT_RE).map((part, i) => {
      if (!/^https?:\/\//.test(part)) return <React.Fragment key={i}>{part}</React.Fragment>;
      // Sentence punctuation glued to the URL stays as plain text.
      const trailing = part.match(/[.,;:!?)\]]+$/)?.[0] ?? '';
      const url = trailing ? part.slice(0, -trailing.length) : part;
      return (
        <React.Fragment key={i}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-accent hover:text-accent-hover break-all"
          >
            {url}
          </a>
          {trailing}
        </React.Fragment>
      );
    })}
  </>
);

// Markdown-lite for streamed agent answers: the LLM emits **bold** and "- "/"* "
// bullet lines. This is a small, pure-React, streaming-safe renderer — no
// dangerouslySetInnerHTML, no dependency. "Streaming-safe" means: it re-runs on
// every chunk while the answer is still arriving, so an unclosed `**` (the
// closing pair hasn't streamed in yet) must render as literal text, never throw,
// and never drop content. Bare URLs inside text segments reuse LinkifiedText.
const BOLD_SPLIT_RE = /(\*\*[^*]+\*\*)/g;
// Renders a single line's text, splitting out **bold** runs and linkifying the rest.
const InlineMarkdown = ({ text }: { text: string }) => (
  <>
    {text.split(BOLD_SPLIT_RE).map((part, i) => {
      const isBold = part.length > 4 && part.startsWith('**') && part.endsWith('**');
      if (!isBold) return <LinkifiedText key={i} text={part} />;
      return <strong key={i}>{<LinkifiedText text={part.slice(2, -2)} />}</strong>;
    })}
  </>
);

// Splits a message into plain-text runs (pre-wrap, newlines preserved) and
// contiguous "- "/"* " bullet blocks (rendered as a <ul>). Anything the parser
// doesn't recognize — including an unclosed "**" — passes through verbatim as
// part of a plain-text run, so a message never crashes and never loses content
// mid-stream.
const MarkdownLite = ({ text }: { text: string }) => {
  const lines = text.split('\n');
  const blocks: Array<{ kind: 'text' | 'list'; lines: string[] }> = [];
  for (const line of lines) {
    const isBullet = /^\s*[-*]\s+/.test(line);
    const kind = isBullet ? 'list' : 'text';
    const last = blocks[blocks.length - 1];
    if (last && last.kind === kind) {
      last.lines.push(line);
    } else {
      blocks.push({ kind, lines: [line] });
    }
  }
  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === 'list') {
          return (
            <ul key={i} className="ps-4 my-1 space-y-0.5">
              {block.lines.map((line, j) => {
                const item = line.replace(/^\s*[-*]\s+/, '');
                return (
                  <li key={j} className="text-sm leading-relaxed flex gap-1.5">
                    <span aria-hidden="true" className="text-accent">▸</span>
                    <span className="bidi-plaintext break-words" dir="auto">
                      <InlineMarkdown text={item} />
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        }
        // Plain-text block: keep newlines with whitespace-pre-wrap, matching
        // the previous rendering for non-list content.
        return (
          <p
            key={i}
            className="text-sm leading-relaxed bidi-plaintext whitespace-pre-wrap break-words"
            dir="auto"
          >
            <InlineMarkdown text={block.lines.join('\n')} />
          </p>
        );
      })}
    </>
  );
};

export const InteractiveAgent = ({
  onClose,
  inputRef: inputRefProp,
}: { onClose?: () => void; inputRef?: React.RefObject<HTMLInputElement | null> } = {}) => {
  const { assistant, a11y, dossier } = useDictionary();
  const direction = useDirection();
  const locale = useLocale();
  const prefersReduced = usePrefersReducedMotion();
  const titleId = useId();
  const messageIdRef = useRef(assistant.initialMessages.length);
  const [messages, setMessages] = useState<Message[]>(
    assistant.initialMessages.map((message, index) => ({
      id: String(index + 1),
      ...message,
    }))
  );
  const [inputValue, setInputValue] = useState('');
  // isTyping covers the short scripted command delays; streamPhase tracks the
  // real API call ('pending' until the first chunk lands, then 'streaming').
  const [isTyping, setIsTyping] = useState(false);
  const [streamPhase, setStreamPhase] = useState<'pending' | 'streaming' | null>(null);
  // Completed answer text, exposed once to the sr-only live region — streamed
  // chunks mutate an existing DOM node, which role="log" never announces.
  const [announcedAnswer, setAnnouncedAnswer] = useState('');
  const [matrixMode, setMatrixMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Stick to the bottom only while the user is already there — a reader who
  // scrolled up mid-stream must not be yanked back down by the next chunk.
  const stickToBottomRef = useRef(true);
  const localInputRef = useRef<HTMLInputElement>(null);
  const inputRef = inputRefProp ?? localInputRef;
  const abortRef = useRef<AbortController | null>(null);
  // Fallback-model notice shows at most once per conversation — reset on /clear.
  const fallbackNoticeShownRef = useRef(false);

  // Abort an in-flight answer stream when the chat unmounts (mobile modal close).
  useEffect(() => () => abortRef.current?.abort(), []);

  const handleChatScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const scrollToBottom = (smooth: boolean) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest' });
    }
  };

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    // Instant scroll while chunks stream — a smooth animation emits mid-flight
    // scroll positions that would read as "user scrolled away".
    const timeoutId = setTimeout(() => scrollToBottom(streamPhase !== 'streaming'), 50);
    return () => clearTimeout(timeoutId);
  }, [messages, isTyping, streamPhase]);

  const nextMessageId = () => {
    messageIdRef.current += 1;
    return String(messageIdRef.current);
  };

  const normalizeInput = (value: string) => value.toLocaleLowerCase().trim();
  // Commands match on EXACT input only (post-trim/lowercase). Substring matching
  // ("clearly" → /clear, Hebrew "חיים" → CV download) would hijack natural
  // questions that should reach the real agent API.
  const matchesCommand = (value: string, keywords: string[]) =>
    keywords.some((keyword) => value === normalizeInput(keyword));
  const inputDirection = inputValue.trim() ? 'auto' : direction;

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMsgId = nextMessageId();
    setMessages(prev => [...prev, { id: userMsgId, type: 'user', content: text }]);
    setInputValue('');
    setAnnouncedAnswer('');
    stickToBottomRef.current = true;

    const normalizedText = normalizeInput(text);
    
    if (matchesCommand(normalizedText, assistant.intentKeywords.commands.clear)) {
      setIsTyping(true);
      setTimeout(() => {
        setMatrixMode(false);
        fallbackNoticeShownRef.current = false;
        setMessages([
          { id: nextMessageId(), type: 'system', content: assistant.clearedMessage }
        ]);
        setIsTyping(false);
      }, 500);
      return;
    }

    if (matchesCommand(normalizedText, assistant.intentKeywords.commands.help)) {
      setIsTyping(true);
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          id: nextMessageId(), 
          type: 'system', 
          content: assistant.helpMessage 
        }]);
        setIsTyping(false);
      }, 500);
      return;
    }

    if (matchesCommand(normalizedText, assistant.intentKeywords.commands.download)) {
      setIsTyping(true);
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: nextMessageId(),
          type: 'system',
          content: assistant.downloadMessage
        }]);
        setIsTyping(false);
        // 5.11: trigger the actual CV download — locale-aware PDF path from dictionary
        const link = document.createElement('a');
        link.href = dossier.resumeFile;
        link.download = dossier.resumeDownloadName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, 800);
      return;
    }

    if (matchesCommand(normalizedText, assistant.intentKeywords.commands.matrix)) {
      setIsTyping(true);
      setTimeout(() => {
        setMatrixMode(true);
        setMessages(prev => [...prev, { 
          id: nextMessageId(), 
          type: 'system', 
          content: assistant.matrixMessage 
        }]);
        setIsTyping(false);
      }, 800);
      return;
    }

    // Real agent call — POST the conversation window to /api/portfolio-chat and
    // render the streamed answer as it arrives (the stream is the typing effect).
    // No transcript entries for status: a transient "thinking" line renders off
    // streamPhase and disappears once the first chunk lands.
    setStreamPhase('pending');

    const agentName = assistant.agentNames.portfolio;
    const history = [
      ...messages
        .filter((msg) => msg.type === 'user' || msg.type === 'agent')
        .map((msg) => ({
          role: msg.type === 'user' ? ('user' as const) : ('assistant' as const),
          // Server caps each message at 8000 chars — truncate instead of letting
          // a long JD paste 400 and dead-end the recruiter flow.
          content: msg.content.slice(0, 8000),
        })),
      { role: 'user' as const, content: text.slice(0, 8000) },
    ].slice(-10);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let answerId: string | null = null;
    let received = '';
    try {
      const res = await fetch('/api/portfolio-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, locale }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        // The route returns { error: { code } } — surface rate limiting
        // distinctly instead of the generic outage message.
        let code = 'internal';
        try {
          code = (await res.json())?.error?.code ?? code;
        } catch {
          /* non-JSON error body — keep the generic code */
        }
        throw Object.assign(new Error(`portfolio-chat responded ${res.status}`), { code });
      }

      // Surface a one-time notice when the primary model's daily quota is
      // exhausted and the API served the answer from the fallback model.
      const servingModel = res.headers.get('X-Portfolio-Chat-Model');
      if (servingModel && servingModel !== 'gemini-2.5-flash' && !fallbackNoticeShownRef.current) {
        fallbackNoticeShownRef.current = true;
        setMessages(prev => [
          ...prev,
          { id: `${nextMessageId()}-fallback`, type: 'system', content: assistant.fallbackNotice },
        ]);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += decoder.decode(value, { stream: true });
        const snapshot = received;
        if (answerId === null) {
          answerId = `${nextMessageId()}-ans`;
          const createdId = answerId;
          setStreamPhase('streaming');
          setMessages(prev => [
            ...prev,
            { id: createdId, type: 'agent', agentName, content: snapshot, live: true },
          ]);
        } else {
          const targetId = answerId;
          setMessages(prev => prev.map(msg => (msg.id === targetId ? { ...msg, content: snapshot } : msg)));
        }
      }
      if (!received.trim()) throw new Error('portfolio-chat returned an empty answer');
      setAnnouncedAnswer(received);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      // Keep any partial answer; only show the fallback when nothing arrived.
      if (!received.trim()) {
        const fallback =
          (err as { code?: string }).code === 'rate_limited'
            ? assistant.rateLimitMessage
            : assistant.errorMessage;
        setMessages(prev => [
          // A whitespace-only stream leaves an empty live bubble — drop it.
          ...prev.filter(msg => msg.id !== answerId),
          { id: `${nextMessageId()}-err`, type: 'agent', agentName, content: fallback, live: true },
        ]);
        // Put the question back so a retry is one keypress, not a retype —
        // unless the user already started composing something else.
        setInputValue(prev => prev || text);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (!controller.signal.aborted) setStreamPhase(null);
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamPhase(null);
  };

  // Custom header for InteractiveAgent — token-driven via [data-matrix] on the panel root.
  // Passed as headerSlot to TerminalFrame so the shared panel shell is reused (3.3).
  const agentHeader = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface/50 transition-[background-color,border-color] duration-1000">
      <div className="flex items-center gap-2">
        <Cpu className="w-4 h-4 text-accent transition-colors duration-1000" aria-hidden="true" />
        {/* 4.2: title id used for aria-labelledby on the panel (when used as dialog) */}
        <span id={titleId} className="text-xs font-mono font-semibold tracking-wider text-fg-1 transition-colors duration-1000">
          {matrixMode ? assistant.matrixTitle : assistant.title}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex gap-1.5" aria-hidden="true">
          <div className="w-2.5 h-2.5 rounded-full bg-line-strong transition-colors duration-1000" />
          <div className="w-2.5 h-2.5 rounded-full bg-line-strong transition-colors duration-1000" />
          <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
        </div>
        {onClose && (
          // 4.2 + 4.6: localized aria-label, 44×44 touch target
          <button
            onClick={onClose}
            aria-label={a11y.closeDialog}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--r-1)] text-fg-1 hover:text-fg-0 transition-colors focus-visible:[box-shadow:var(--shadow-focus-ring)] outline-none"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <TerminalFrame
      headerSlot={agentHeader}
      className="relative w-full max-w-lg mx-auto lg:mx-0 backdrop-blur-xl shadow-2xl flex flex-col h-[500px] max-h-[80dvh] transition-[background-color,border-color,box-shadow] duration-1000 bg-page/80 border-line"
      bodyClassName="flex flex-col flex-1 overflow-hidden"
      dir={direction}
      data-matrix={matrixMode || undefined}
    >

      {/* 4.4: role="log" so new chat messages are announced by screen readers */}
      {/* 4.4: visually-hidden progress + completed-answer announcement. Streamed
          chunks mutate an existing node, which aria-relevant="additions" never
          announces — so the finished answer is exposed here once, whole. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {isTyping || streamPhase ? assistant.srThinking : announcedAnswer}
      </p>

      {/* Chat Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleChatScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={assistant.title}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-slim"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <m.div
              key={msg.id}
              // 3.8: agent/system messages pop in with y+scale variants; user messages use simpler entry
              initial={
                prefersReduced
                  ? { opacity: 1 }
                  : msg.type === 'agent'
                    ? { opacity: 0, y: 8, scale: 0.96 }
                    : { opacity: 0, y: 10, scale: 0.95 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={
                prefersReduced
                  ? { duration: 0 }
                  : msg.type === 'agent'
                    ? { duration: 0.42, ease: EASE_OUT }
                    : { duration: 0.25 }
              }
              className={`flex flex-col ${msg.type === 'user' ? 'items-end' : 'items-start'}`}
            >
              {msg.type === 'system' ? (
                <div className="text-[10px] font-mono my-1 flex items-center gap-1.5 text-accent-text transition-colors duration-1000">
                  <Terminal className="w-3 h-3" />
                  {msg.content}
                </div>
              ) : (
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 transition-[background-color,border-color,color,box-shadow] duration-1000 ${
                  msg.type === 'user'
                    ? 'bg-accent text-[var(--fg-on-accent)] chat-bubble-user'
                    : 'bg-surface-raised/50 border border-line-strong/50 text-fg-0 chat-bubble-agent'
                }`} style={{ textAlign: 'start' }}>
                  {msg.type === 'agent' && (
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] font-mono uppercase tracking-wider text-accent transition-colors duration-1000">
                      <Bot className="w-3 h-3" />
                      {msg.agentName}
                    </div>
                  )}
                  {/* 3.8: jittered typing on seeded agent messages; live (streamed) answers
                      render directly — the network stream is the typing effect, and
                      JitteredTyping restarts whenever its text prop changes. Seeded
                      messages contain no markdown, so they stay plain text; live/error
                      agent bubbles run through MarkdownLite for **bold** and "- " lists. */}
                  {msg.type === 'agent' && !msg.live ? (
                    <p className="text-sm leading-relaxed bidi-plaintext whitespace-pre-wrap break-words" dir="auto">
                      <JitteredTyping text={msg.content} reduced={prefersReduced} />
                    </p>
                  ) : msg.type === 'agent' ? (
                    <MarkdownLite text={msg.content} />
                  ) : (
                    <p className="text-sm leading-relaxed bidi-plaintext whitespace-pre-wrap break-words" dir="auto">
                      <LinkifiedText text={msg.content} />
                    </p>
                  )}
                </div>
              )}
            </m.div>
          ))}
          {isTyping && (
            <m.div
              key="typing-dots"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start"
            >
              <div className="border rounded-2xl chat-bubble-agent px-4 py-3 flex items-center gap-1.5 bg-surface-raised/50 border-line-strong/50 transition-[background-color,border-color] duration-1000">
                <div className="w-1.5 h-1.5 rounded-full animate-bounce bg-accent transition-colors duration-1000" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce bg-accent transition-colors duration-1000" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce bg-accent transition-colors duration-1000" style={{ animationDelay: '300ms' }} />
              </div>
            </m.div>
          )}
        </AnimatePresence>
        {/* Transient status while waiting for the first chunk — never enters the
            transcript, so it can't pile up over a long conversation. Kept OUTSIDE
            AnimatePresence: rapid re-renders from streamed chunks can strand its
            exit animation and leave the line stuck on screen. aria-hidden:
            screen readers get the sr-only srThinking line instead. */}
        {streamPhase === 'pending' && (
          <m.div
            initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            aria-hidden="true"
            className="flex items-start"
          >
            <div className="text-[10px] font-mono my-1 flex items-center gap-1.5 text-accent-text transition-colors duration-1000">
              <Terminal className="w-3 h-3" />
              <span className="bidi-plaintext" dir="auto">{assistant.analyzingMessage}</span>
              <span className="inline-flex gap-1" aria-hidden="true">
                <span className="w-1 h-1 rounded-full animate-bounce bg-accent" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full animate-bounce bg-accent" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full animate-bounce bg-accent" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </m.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts — icebreakers only: once the visitor has asked something,
          the row retires instead of inviting duplicate questions (returns after
          /clear). 4.6: py-2 bumps chip hit area toward 44px */}
      {!messages.some((msg) => msg.type === 'user') && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none">
          {assistant.quickPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              disabled={isTyping || streamPhase !== null}
              className="whitespace-nowrap text-xs font-medium px-3 py-2 rounded-full border bg-surface border-line text-fg-1 hover:text-accent hover:border-accent/30 transition-[color,border-color,background-color] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:[box-shadow:var(--shadow-focus-ring)] outline-none"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 pt-2 border-t border-line/50 bg-surface/30 transition-[background-color,border-color] duration-1000">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }}
          className="relative flex items-center"
        >
          {/* 4.2: localized aria-label; 4.5: visible focus ring replacing outline-none.
              Never disabled — disabling would eject keyboard/AT focus to <body> on
              every send, and typing a follow-up mid-stream is fine (a new send
              aborts the in-flight one). */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={matrixMode ? assistant.matrixInputPlaceholder : assistant.inputPlaceholder}
            aria-label={a11y.chatInput}
            dir={inputDirection}
            className="w-full border rounded-xl py-3 text-sm outline-none bg-page border-line text-fg-0 placeholder:text-fg-2 focus-visible:[box-shadow:var(--shadow-focus-ring)] transition-[border-color,box-shadow,color,background-color]"
            style={{ paddingInlineStart: '1rem', paddingInlineEnd: '3rem', textAlign: 'start' }}
          />
          {/* 4.2: localized aria-label; 4.6: h-11 w-11 inside the input — visually 36px, touch area padded.
              While an answer is in flight the button becomes a stop control. */}
          {streamPhase !== null ? (
            <button
              type="button"
              onClick={stopStreaming}
              aria-label={assistant.stopLabel}
              className="absolute inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-[var(--fg-on-accent)] hover:bg-accent-hover transition-[background-color] focus-visible:[box-shadow:var(--shadow-focus-ring)] outline-none"
              style={{ insetInlineEnd: '0.5rem' }}
            >
              <Square className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              aria-label={a11y.sendMessage}
              className="absolute inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-[var(--fg-on-accent)] hover:bg-accent-hover transition-[background-color] disabled:opacity-50 focus-visible:[box-shadow:var(--shadow-focus-ring)] outline-none"
              style={{ insetInlineEnd: '0.5rem' }}
            >
              <Send className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </form>
      </div>
    </TerminalFrame>
  );
};
