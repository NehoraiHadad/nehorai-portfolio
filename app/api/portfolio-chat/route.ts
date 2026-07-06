export const runtime = 'nodejs';

// Public portfolio chat — bounded LLM Q&A over approved public knowledge only.
// No auth (public visitors), so the guards are: zod validation, size limits,
// Neon-backed rate limiting, a capped completion, and a knowledge base that
// contains nothing private by construction. See AI_PORTFOLIO_AGENT_PLAN.md.

import { z } from 'zod';
import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { retrieve } from '@/lib/portfolio-agent/retrieve';
import { buildSystemPrompt } from '@/lib/portfolio-agent/prompt';
import { checkRateLimit, clientIpHash } from '@/lib/portfolio-agent/rate-limit';

const MESSAGE_WINDOW = 10;
const MAX_TOTAL_CHARS = 20_000;

const zChatRequest = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(8_000),
      }),
    )
    .min(1)
    .max(40),
  locale: z.enum(['en', 'he']).default('en'),
});

// Same envelope shape as app/api/admin/v1/_lib/respond.ts, kept local — the
// admin helper pulls in agent auth, which this public route must not touch.
type ErrorCode = 'validation_error' | 'rate_limited' | 'unavailable' | 'internal';

function apiError(status: number, code: ErrorCode, message: string, details?: unknown): Response {
  const body: { error: { code: string; message: string; details?: unknown } } = {
    error: { code, message },
  };
  if (details !== undefined) body.error.details = details;
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, 'validation_error', 'Request body must be valid JSON.');
    }

    const parsed = zChatRequest.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return apiError(400, 'validation_error', 'Request body failed validation.', details);
    }

    const messages = parsed.data.messages.slice(-MESSAGE_WINDOW);
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalChars > MAX_TOTAL_CHARS) {
      return apiError(400, 'validation_error', 'Conversation is too long.');
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
      return apiError(400, 'validation_error', 'The last message must be from the user.');
    }

    if (!(await checkRateLimit(clientIpHash(req)))) {
      return apiError(429, 'rate_limited', 'Too many requests — please wait a moment.');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return apiError(503, 'unavailable', 'The assistant is not available right now.');
    }

    const context = retrieve(lastMessage.content, parsed.data.locale);
    const system = buildSystemPrompt(context, parsed.data.locale);

    const google = createGoogleGenerativeAI({ apiKey });

    // Model fallback chain: each model has its own free-tier daily quota, so
    // when gemini-2.5-flash is exhausted (a few dozen requests/day on the free
    // tier) flash-lite keeps the chat alive. streamText surfaces provider
    // failures as 'error' parts mid-stream, not thrown errors — so probe each
    // model's stream until real text arrives before committing to a response.
    for (const modelId of ['gemini-2.5-flash', 'gemini-2.5-flash-lite']) {
      const result = streamText({
        model: google(modelId),
        system,
        messages,
        maxOutputTokens: 1024,
        maxRetries: 1,
      });

      const parts = result.fullStream[Symbol.asyncIterator]();
      let firstText: string | null = null;
      let failed = false;
      while (firstText === null && !failed) {
        const { done, value } = await parts.next();
        if (done) failed = true; // stream ended with no text at all
        else if (value.type === 'text-delta') firstText = value.text;
        else if (value.type === 'error') {
          console.error(`[portfolio-chat] ${modelId} failed:`, value.error);
          failed = true;
        }
      }
      if (failed) continue;

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(firstText!));
        },
        async pull(controller) {
          // Drain until we can enqueue or close — a pull that resolves without
          // doing either may never be called again by the runtime's stream
          // bridge, which leaves the HTTP response hanging open.
          for (;;) {
            const { done, value } = await parts.next();
            if (done) {
              controller.close();
              return;
            }
            if (value.type === 'text-delta') {
              controller.enqueue(encoder.encode(value.text));
              return;
            }
            if (value.type === 'error') {
              // Mid-answer failure: end cleanly — the client keeps the partial.
              console.error(`[portfolio-chat] ${modelId} mid-stream error:`, value.error);
              controller.close();
              return;
            }
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Portfolio-Chat-Model': modelId,
        },
      });
    }

    // Every model in the chain failed (quota, outage) — tell the client to
    // retry later rather than streaming an empty 200.
    return apiError(503, 'unavailable', 'The assistant is not available right now.');
  } catch (err) {
    console.error('[portfolio-chat] internal error:', err);
    return apiError(500, 'internal', 'An unexpected error occurred.');
  }
}
