import { db } from '@/lib/db';
import { toJson } from '@/lib/json';

export type SessionEventType =
  | 'session_started'
  | 'session_ended'
  | 'file_opened'
  | 'file_changed'
  | 'file_saved'
  | 'command_started'
  | 'command_output'
  | 'command_finished'
  | 'sandbox_snapshot_saved'
  | 'ai_prompt_sent'
  | 'ai_response_received'
  | 'test_run_started'
  | 'test_run_finished'
  | 'candidate_note_added'
  | 'focus_changed'
  | 'error_occurred'
  | 'ai_agent_message'
  | 'ai_agent_command_run'
  | 'ai_agent_file_read'
  | 'ai_agent_edit_proposed'
  | 'ai_agent_step_limit_reached'
  | 'candidate_edit_approved'
  | 'candidate_edit_rejected';

export async function logSessionEvent(input: {
  sessionId: string;
  type: SessionEventType;
  actor: 'candidate' | 'system' | 'ai' | 'runner';
  payload?: Record<string, unknown>;
}) {
  const event = await db.sessionEvent.create({
    data: {
      sessionId: input.sessionId,
      type: input.type,
      actor: input.actor,
      payloadJson: toJson(input.payload || {}),
    },
  });

  await db.candidateSession.update({
    where: { id: input.sessionId },
    data: { lastEventAt: event.occurredAt },
  });

  return event;
}
