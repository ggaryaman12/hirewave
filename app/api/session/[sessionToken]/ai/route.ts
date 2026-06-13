import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { buildAiAssistantRequest } from '@/lib/ai/context';
import {
  CAPABILITY_BOUNDARY_AI_CONTENT,
  CAPABILITY_CLARIFIER_MODEL,
  INPUT_CLARIFIER_MODEL,
  LOW_SIGNAL_AI_CONTENT,
  getCapabilityBoundaryReason,
  getLowSignalPromptReason,
} from '@/lib/ai/input-guard';
import { buildTokenUsage, readTokenUsage } from '@/lib/ai/token-usage';
import { generateAiAssistantResponse } from '@/lib/ai/provider';
import { getLatestFiles, getSessionByToken } from '@/lib/sessions';
import { logSessionEvent } from '@/lib/telemetry';

const aiSchema = z.object({
  message: z.string().min(1).max(4000),
});

const FALLBACK_AI_MODEL = 'provider-error-fallback';
const FALLBACK_AI_CONTENT =
  'The AI assistant is temporarily unavailable. Your prompt was saved, and you can continue by running tests and inspecting the failing files while the provider recovers.';

type AiRouteMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  metadataJson?: string | null;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'AI provider request failed';
}

function requestSafetyFlags(message: string) {
  const lower = message.toLowerCase();
  const flags: string[] = [];

  if (/\b(score|grade|evaluate|rating|hire|recommendation)\b/.test(lower)) {
    flags.push('candidate_requested_evaluation');
  }

  if (/\b(secret|token|password|credential|api key)\b/.test(lower)) {
    flags.push('candidate_requested_sensitive_data');
  }

  return flags;
}

function serializeMessage(message: AiRouteMessage) {
  let tokenUsage = null;

  if (message.metadataJson) {
    try {
      const metadata = JSON.parse(message.metadataJson) as { usage?: unknown };
      tokenUsage = readTokenUsage(metadata.usage);
    } catch {
      tokenUsage = null;
    }
  }

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    tokenUsage,
  };
}

async function createGuardrailResponse(input: {
  sessionId: string;
  userMessage: AiRouteMessage;
  message: string;
  content: string;
  model: string;
  safetyFlags: string[];
  reason: string;
}) {
  const usage = {
    promptChars: input.message.length,
    responseChars: input.content.length,
    includedFiles: [],
    ...buildTokenUsage({
      promptChars: input.message.length,
      responseChars: input.content.length,
    }),
  };
  const metadata = {
    provider: 'guardrail',
    model: input.model,
    latencyMs: 0,
    usage,
    safetyFlags: input.safetyFlags,
    reason: input.reason,
  };

  const assistantMessage = await db.aiMessage.create({
    data: {
      sessionId: input.sessionId,
      role: 'assistant',
      content: input.content,
      model: input.model,
      metadataJson: JSON.stringify(metadata),
    },
  });

  await logSessionEvent({
    sessionId: input.sessionId,
    type: 'ai_response_received',
    actor: 'ai',
    payload: {
      aiMessageId: assistantMessage.id,
      provider: metadata.provider,
      model: input.model,
      responseLength: input.content.length,
      latencyMs: metadata.latencyMs,
      usage: metadata.usage,
      safetyFlags: metadata.safetyFlags,
    },
  });

  return NextResponse.json({
    messages: [
      serializeMessage(input.userMessage),
      serializeMessage(assistantMessage),
    ],
  });
}

export async function POST(request: NextRequest, { params }: { params: { sessionToken: string } }) {
  const session = await getSessionByToken(params.sessionToken);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  if (['submitted', 'expired', 'report_ready'].includes(session.status)) {
    return NextResponse.json({ error: 'Session is closed' }, { status: 409 });
  }

  const { message } = aiSchema.parse(await request.json());
  const userMessage = await db.aiMessage.create({
    data: {
      sessionId: session.id,
      role: 'user',
      content: message,
      model: null,
    },
  });

  await logSessionEvent({
    sessionId: session.id,
    type: 'ai_prompt_sent',
    actor: 'candidate',
    payload: {
      aiMessageId: userMessage.id,
      promptLength: message.length,
    },
  });

  const lowSignalReason = getLowSignalPromptReason(message);
  if (lowSignalReason) {
    const safetyFlags = Array.from(new Set(['low_signal_prompt', ...requestSafetyFlags(message)]));
    return createGuardrailResponse({
      sessionId: session.id,
      userMessage,
      message,
      content: LOW_SIGNAL_AI_CONTENT,
      model: INPUT_CLARIFIER_MODEL,
      safetyFlags,
      reason: lowSignalReason,
    });
  }

  const capabilityBoundaryReason = getCapabilityBoundaryReason(message);
  if (capabilityBoundaryReason) {
    const safetyFlags = Array.from(new Set(['assistant_capability_boundary', ...requestSafetyFlags(message)]));
    return createGuardrailResponse({
      sessionId: session.id,
      userMessage,
      message,
      content: CAPABILITY_BOUNDARY_AI_CONTENT,
      model: CAPABILITY_CLARIFIER_MODEL,
      safetyFlags,
      reason: capabilityBoundaryReason,
    });
  }

  const files = await getLatestFiles(session.id);
  const aiRequest = buildAiAssistantRequest({
    session,
    candidateMessage: message,
    files,
  });
  let aiResult: Awaited<ReturnType<typeof generateAiAssistantResponse>>;

  try {
    aiResult = await generateAiAssistantResponse(aiRequest);
  } catch (error) {
    const safetyFlags = Array.from(new Set(['provider_error', ...requestSafetyFlags(message)]));
    const metadata = {
      provider: 'fallback',
      latencyMs: 0,
      usage: {
        promptChars: message.length,
        responseChars: FALLBACK_AI_CONTENT.length,
        includedFiles: files.map((file) => file.path),
        ...buildTokenUsage({
          promptChars: message.length,
          responseChars: FALLBACK_AI_CONTENT.length,
        }),
      },
      safetyFlags,
      error: errorMessage(error),
    };

    await logSessionEvent({
      sessionId: session.id,
      type: 'error_occurred',
      actor: 'system',
      payload: {
        source: 'ai_provider',
        message: 'AI provider request failed',
        safetyFlags,
      },
    });

    const assistantMessage = await db.aiMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: FALLBACK_AI_CONTENT,
        model: FALLBACK_AI_MODEL,
        metadataJson: JSON.stringify(metadata),
      },
    });

    await logSessionEvent({
      sessionId: session.id,
      type: 'ai_response_received',
      actor: 'ai',
      payload: {
        aiMessageId: assistantMessage.id,
        provider: metadata.provider,
        model: FALLBACK_AI_MODEL,
        responseLength: FALLBACK_AI_CONTENT.length,
        latencyMs: metadata.latencyMs,
        usage: metadata.usage,
        safetyFlags: metadata.safetyFlags,
      },
    });

    return NextResponse.json({
      messages: [
        serializeMessage(userMessage),
        serializeMessage(assistantMessage),
      ],
    });
  }

  const assistantMessage = await db.aiMessage.create({
    data: {
      sessionId: session.id,
      role: 'assistant',
      content: aiResult.content,
      model: aiResult.model,
      metadataJson: JSON.stringify({
        provider: aiResult.provider,
        latencyMs: aiResult.latencyMs,
        usage: aiResult.usage,
        safetyFlags: aiResult.safetyFlags,
        ...aiResult.metadata,
      }),
    },
  });

  await logSessionEvent({
    sessionId: session.id,
    type: 'ai_response_received',
    actor: 'ai',
    payload: {
      aiMessageId: assistantMessage.id,
      provider: aiResult.provider,
      model: aiResult.model,
      responseLength: aiResult.content.length,
      latencyMs: aiResult.latencyMs,
      usage: aiResult.usage,
      safetyFlags: aiResult.safetyFlags,
    },
  });

  return NextResponse.json({
    messages: [
      serializeMessage(userMessage),
      serializeMessage(assistantMessage),
    ],
  });
}
