'use client';

import React, { useState, useEffect, useRef } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { FileText, Send, Lock, Mail, Github, Linkedin, RefreshCw } from 'lucide-react';
import { useReveal } from '@/lib/useReveal';
import { sendContact } from '@/app/lib/actions/contact';
import type { ContactErrorCode } from '@/app/lib/actions/contact';
import { useDictionary, useDirection } from '@/lib/i18n/provider';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { TerminalFrame } from '@/app/components/TerminalFrame';

type SubmitPhase = '' | 'encrypting' | 'transmitting';

// Maps stable server-action error codes to dictionary keys
function useErrorMessage(code: ContactErrorCode | null, errors: Record<string, string>): string | null {
  if (!code) return null;
  return errors[code] ?? errors.unknown ?? code;
}

// 3.8: Jittered per-character typewriter — base 26ms + rand(34ms),
// +40ms after spaces, +180ms after sentence punctuation .!?
// Space-holding spans keep the line width stable so the card never reflows.
const JitteredText = ({
  text,
  reduced,
  className,
}: {
  text: string;
  reduced: boolean;
  className?: string;
}) => {
  const [revealed, setRevealed] = useState(0);

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
  // text changes when the line appears (initStep changes) — restart the effect.
  // prefersReduced intentionally tracked via `reduced` prop only.
  }, [text, reduced]);

  return (
    <span className={className} aria-label={text}>
      {text.split('').map((char, i) => (
        // Space-holding: each char is a fixed-width inline-block.
        // Invisible chars still take up space so the line never reflows.
        <span
          key={i}
          aria-hidden="true"
          style={{
            visibility: i < revealed ? 'visible' : 'hidden',
            // Preserve exact width even when hidden so line doesn't reflow
            display: 'inline',
          }}
        >
          {char}
        </span>
      ))}
    </span>
  );
};

const AsciiBar = ({ pct, label }: { pct: number; label: string }) => {
  const filled = Math.round(pct / 10);
  return (
    <div className="font-mono text-xs space-y-1">
      <p className="text-fg-2">{label}</p>
      <p>
        <span className="text-accent">{'█'.repeat(filled)}</span>
        <span className="text-fg-3">{'░'.repeat(10 - filled)}</span>
        <span className="text-fg-1" style={{ marginInlineStart: '0.5rem' }}>{pct}%</span>
      </p>
    </div>
  );
};

export const Dossier = () => {
  const prefersReduced = usePrefersReducedMotion();
  const { dossier } = useDictionary();
  const direction = useDirection();
  const isRtl = direction === 'rtl';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorCode, setErrorCode] = useState<ContactErrorCode | null>(null);
  const errorMessage = useErrorMessage(errorCode, dossier.form.errors);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>('');
  const [initStep, setInitStep] = useState(-1);
  const [initialized, setInitialized] = useState(false);
  // 5.10: track whether the in-view trigger has already fired so we only run once
  const initFiredRef = useRef(false);
  const ref = useReveal<HTMLElement>();

  // 5.10: fire init theater when the section enters view (ref.current gets .in-view)
  // We watch for the CSS class added by useReveal rather than duplicating IO logic.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const run = () => {
      if (initFiredRef.current) return;
      initFiredRef.current = true;

      // 2.1: Skip init theater for reduced-motion users — show form immediately
      if (prefersReduced) {
        setInitStep(dossier.initLines.length - 1);
        setInitialized(true);
        return;
      }
      // ~800ms total: lines at 0, 250ms, 500ms; form at 800ms
      const timers = [
        setTimeout(() => setInitStep(0), 0),
        setTimeout(() => setInitStep(1), 250),
        setTimeout(() => setInitStep(2), 500),
        setTimeout(() => setInitialized(true), 800),
      ];
      return () => timers.forEach(clearTimeout);
    };

    // useReveal adds the .in-view class via IntersectionObserver on `el`.
    // We watch for that class with our own IO so we piggy-back on the same
    // threshold without duplicating the workaround logic.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          run();
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -80px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  // prefersReduced is intentionally excluded: if reduced-motion changes mid-session
  // we don't want to re-trigger the theater. eslint-disable-next-line is acceptable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !message) return;

    setErrorCode(null);
    setIsSubmitting(true);
    setSubmitPhase('encrypting');
    await new Promise(r => setTimeout(r, 700));
    setSubmitPhase('transmitting');

    const result = await sendContact({ name, email, message });
    setIsSubmitting(false);

    if (result.ok) {
      setIsSubmitted(true);
      setName('');
      setEmail('');
      setMessage('');
      setSubmitPhase('');
      // 5.10: no auto-dismiss — recruiters screenshot the success state.
      // Reset is manual via the "> NEW_TRANSMISSION" button.
    } else {
      setSubmitPhase('');
      setErrorCode(result.code);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setErrorCode(null);
  };

  return (
    <section
      id="dossier"
      ref={ref}
      className="py-28 px-6 relative z-10 border-t border-line/50"
    >
      {/* Ambient glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />

      <div className="reveal max-w-5xl mx-auto">

          {/* Section label */}
          <div className="flex items-center gap-4 mb-16">
          <span className="font-mono text-[10px] text-fg-2 uppercase tracking-[0.2em] bidi-ltr" dir="ltr">{dossier.sectionMarker}</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-16 items-start">

          <div className="flex flex-col gap-10" style={{ textAlign: 'start' }}>

            {/* Headline */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ok opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-ok" />
                </span>
                <span className="font-mono text-[10px] text-ok tracking-[0.15em] uppercase">{dossier.availability}</span>
              </div>

              <h2 className="font-display text-5xl md:text-6xl font-bold text-fg-0 leading-[1.05] tracking-tight mb-5">
                {dossier.titleLines[0]}<br />
                {dossier.titleLines[1]}<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-accent-press">
                  {dossier.titleHighlight}
                </span>
              </h2>

              <p className="text-fg-1 text-base leading-relaxed max-w-xs">
                {dossier.description}
              </p>
            </div>

            {/* Stack lines */}
            <div className="space-y-4">
              {dossier.stackLines.map(({ tag, stack }) => (
                <div key={tag} className="flex items-center gap-4 bidi-ltr">
                  <span className="font-mono text-[9px] text-accent tracking-widest w-8 bidi-ltr">{tag}</span>
                  <div className="h-px w-4 bg-line-strong" />
                  <span className="font-mono text-xs text-fg-2 bidi-ltr">{stack}</span>
                </div>
              ))}
            </div>

            {/* CV — language x format selector */}
            <div>
              <m.div
                whileHover={{ x: isRtl ? -4 : 4 }}
                className="inline-flex items-center gap-3 text-fg-1 text-sm font-medium w-fit group"
              >
                <span className="w-8 h-8 rounded-lg border border-line group-hover:border-line-strong flex items-center justify-center transition-colors">
                  <FileText className="w-3.5 h-3.5" />
                </span>
                {dossier.resumeCta}
              </m.div>
              <div className="flex flex-wrap gap-2 mt-3">
                {dossier.resumeOptions.map((option) => (
                  <a
                    key={`${option.language}-${option.format}`}
                    href={option.file}
                    download={option.downloadName}
                    className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-line text-fg-2 hover:text-accent hover:border-accent/50 transition-colors"
                    dir="ltr"
                  >
                    <FileText className="w-3 h-3 shrink-0" aria-hidden="true" />
                    {option.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Direct contact chips */}
            <div className="flex flex-wrap gap-2 pt-2">
              <a
                href={dossier.contact.emailUrl}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-line text-fg-2 hover:text-accent hover:border-accent/50 transition-colors bidi-ltr"
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
              >
                <Mail className="w-3 h-3 shrink-0" aria-hidden="true" />
                {dossier.contact.emailLabel}
              </a>
              <a
                href={dossier.contact.githubUrl}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-line text-fg-2 hover:text-accent hover:border-accent/50 transition-colors bidi-ltr"
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
              >
                <Github className="w-3 h-3 shrink-0" aria-hidden="true" />
                {dossier.contact.githubLabel}
              </a>
              <a
                href={dossier.contact.linkedinUrl}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-line text-fg-2 hover:text-accent hover:border-accent/50 transition-colors bidi-ltr"
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
              >
                <Linkedin className="w-3 h-3 shrink-0" aria-hidden="true" />
                {dossier.contact.linkedinLabel}
              </a>
            </div>
          </div>

          <div className="relative" style={{ textAlign: 'start' }}>
            {/* Outer glow */}
            <div className="absolute -inset-3 bg-accent/[0.03] rounded-3xl blur-2xl" />

            {/* TerminalFrame — migrated from duplicate inline chrome (3.3).
                inkTrail=true triggers the border-draw reveal on first scroll-in (3.4).
                Scanlines kept via withScanlines (panel-level, absolute/z-10).
                className preserves the original panel's bg-page + shadow. */}
            <TerminalFrame
              title={<span className="bidi-ltr">{dossier.terminalFileName}</span>}
              statusSlot={
                <>
                  <Lock className="w-3 h-3 text-ok" />
                  <span className="font-mono text-[9px] text-ok tracking-widest bidi-ltr">{dossier.securityLabel}</span>
                </>
              }
              className="bg-page shadow-2xl shadow-black/50"
              bodyClassName="relative p-6 min-h-[340px] flex flex-col"
              withScanlines
              inkTrail
            >
                <AnimatePresence mode="wait">

                  {/* ① Init sequence */}
                  {!initialized && (
                    <m.div
                      key="init"
                      exit={{ opacity: 0 }}
                      className="flex-grow flex flex-col justify-center gap-2"
                    >
                      {dossier.initLines.map((line, i) => (
                        <AnimatePresence key={i}>
                          {initStep >= i && (
                            <m.p
                              initial={{ opacity: 0, x: isRtl ? 6 : -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.25 }}
                              className={`font-mono text-xs ${i < initStep ? 'text-fg-2' : 'text-accent'}`}
                            >
                              {/* 3.8: jittered per-char typing on the active (last) line */}
                              {i === initStep ? (
                                <JitteredText
                                  text={line}
                                  reduced={prefersReduced}
                                />
                              ) : (
                                line
                              )}
                              {i === initStep && i < dossier.initLines.length - 1 && (
                                <span
                                  className="inline-block w-[6px] h-[12px] bg-accent animate-pulse align-middle"
                                  style={{ marginInlineStart: '0.25rem' }}
                                />
                              )}
                            </m.p>
                          )}
                        </AnimatePresence>
                      ))}
                    </m.div>
                  )}

                  {/* ② Submitting */}
                  {initialized && isSubmitting && (
                    <m.div
                      key="submitting"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex-grow flex flex-col justify-center gap-4"
                    >
                      <AsciiBar
                        pct={submitPhase === 'encrypting' ? 55 : 100}
                        label={submitPhase === 'encrypting' ? dossier.progressLabels.encrypting : dossier.progressLabels.transmitting}
                      />
                      <m.p
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="font-mono text-[10px] text-fg-2"
                      >
                        {submitPhase === 'encrypting'
                          ? dossier.progressLabels.encryptingHint
                          : dossier.progressLabels.transmittingHint}
                      </m.p>
                    </m.div>
                  )}

                  {/* ③ Success — 5.10: persists until manual reset; recruiters can screenshot */}
                  {initialized && !isSubmitting && isSubmitted && (
                    <m.div
                      key="success"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex-grow flex flex-col justify-center gap-2 font-mono text-xs"
                    >
                      <p className="text-fg-3">{'─'.repeat(32)}</p>
                      <p><span className="text-fg-2">&gt; </span><span className="text-ok">{dossier.success.delivered}</span></p>
                      <p><span className="text-fg-2">&gt; </span><span className="text-fg-1">{dossier.success.eta}</span></p>
                      <p className="text-fg-3">{'─'.repeat(32)}</p>
                      <p className="text-fg-2 pt-2">{dossier.success.title}</p>
                      <p className="text-fg-2">{dossier.success.description}</p>
                      <span className="inline-block w-[6px] h-[12px] bg-line-strong animate-pulse mt-1" />
                      {/* 5.10: manual reset affordance — no auto-vanish */}
                      <button
                        onClick={handleReset}
                        className="mt-4 flex items-center gap-2 text-fg-2 hover:text-accent transition-colors text-[10px] uppercase tracking-widest w-fit"
                      >
                        <RefreshCw className="w-3 h-3" aria-hidden="true" />
                        &gt; NEW_TRANSMISSION
                      </button>
                    </m.div>
                  )}

                  {/* ④ Form */}
                  {initialized && !isSubmitting && !isSubmitted && (
                    <m.form
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      onSubmit={handleSubmit}
                      className="flex flex-col flex-grow gap-6"
                    >
                      {/* Name */}
                      <div>
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="font-mono text-xs text-fg-2">&gt;</span>
                          <label htmlFor="name" className="font-mono text-[10px] text-accent uppercase tracking-widest">
                            {dossier.form.nameLabel}
                          </label>
                        </div>
                        <input
                          type="text"
                          id="name"
                          required
                          value={name}
                          onChange={(e) => { setName(e.target.value); setErrorCode(null); }}
                          disabled={isSubmitting}
                          placeholder={dossier.form.namePlaceholder}
                          dir={isRtl ? 'rtl' : 'ltr'}
                          className="w-full bg-transparent border-0 border-b border-line focus:border-accent/40 text-fg-0 text-sm font-mono py-2 placeholder:text-fg-3 focus:outline-none transition-colors disabled:opacity-40"
                          style={{ textAlign: isRtl ? 'right' : 'left' }}
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="font-mono text-xs text-fg-2">&gt;</span>
                          <label htmlFor="email" className="font-mono text-[10px] text-accent uppercase tracking-widest">
                            {dossier.form.emailLabel}
                          </label>
                        </div>
                        <input
                          type="email"
                          id="email"
                          required
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setErrorCode(null); }}
                          disabled={isSubmitting}
                          placeholder={dossier.form.emailPlaceholder}
                          dir="ltr"
                          className="w-full bg-transparent border-0 border-b border-line focus:border-accent/40 text-fg-0 text-sm font-mono py-2 placeholder:text-fg-3 focus:outline-none transition-colors disabled:opacity-40 bidi-ltr"
                          style={{ textAlign: 'left' }}
                        />
                      </div>

                      {/* Message */}
                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="font-mono text-xs text-fg-2">&gt;</span>
                          <label htmlFor="message" className="font-mono text-[10px] text-accent uppercase tracking-widest">
                            {dossier.form.messageLabel}
                          </label>
                        </div>
                        <textarea
                          id="message"
                          required
                          value={message}
                          onChange={(e) => { setMessage(e.target.value); setErrorCode(null); }}
                          disabled={isSubmitting}
                          placeholder={dossier.form.messagePlaceholder}
                          dir={isRtl ? 'rtl' : 'ltr'}
                          className="w-full bg-surface/30 border border-line rounded-lg px-3 py-3 text-fg-0 text-sm font-mono placeholder:text-fg-3 focus:border-accent/40 focus:bg-surface/40 focus:outline-none transition-colors resize-none disabled:opacity-40 min-h-[96px]"
                          style={{ textAlign: isRtl ? 'right' : 'left' }}
                        />
                      </div>

                      {/* Error — always mounted for live-region continuity (Phase 4 requirement) */}
                      <p
                        role="status"
                        aria-live="polite"
                        className={`font-mono text-[11px] text-danger transition-opacity${errorMessage ? '' : ' opacity-0 pointer-events-none select-none'}`}
                        aria-hidden={!errorMessage}
                      >
                        {errorMessage ? (
                          <>
                            <span className="text-fg-2">{dossier.form.errorPrefix}</span>{errorMessage}
                          </>
                        ) : ' ' /* non-breaking space keeps layout height stable */}
                      </p>

                      {/* Submit — 5.10: always enabled; inline terminal-voice hint shown when fields empty */}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center justify-center gap-2 py-3 rounded-lg font-mono text-[11px] uppercase tracking-widest border border-accent/25 text-accent bg-accent/5 hover:bg-accent hover:text-[var(--fg-on-accent)] hover:border-accent transition-[background-color,border-color,color] duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {dossier.form.submitLabel}
                      </button>
                    </m.form>
                  )}

                </AnimatePresence>
            </TerminalFrame>
          </div>
        </div>
      </div>
    </section>
  );
};
