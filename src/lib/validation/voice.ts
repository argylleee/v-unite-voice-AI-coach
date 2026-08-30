import { z } from "zod";

// Voice-turn upload validation. The browser's MediaRecorder produces webm/opus on Chrome
// and mp4 on Safari (docs/VOICE.md); Fish Audio /v1/asr accepts common containers. We accept
// the formats a browser realistically records and cap size for a turn-based (not streaming) MVP.

export const ACCEPTED_AUDIO_MIME = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/aac",
] as const;

// Turn-based voice: a coaching question is a few seconds, not a lecture. 8 MB stays well under
// Vercel's request-body limit (the blob is forwarded through this route to n8n).
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

function baseMime(type: string): string {
  return type.split(";")[0].trim().toLowerCase();
}

export interface AudioValidationInput {
  type: string;
  size: number;
}

export type AudioValidationResult = { ok: true } | { ok: false; error: string };

export function validateAudioUpload(file: AudioValidationInput): AudioValidationResult {
  const mime = baseMime(file.type);
  if (!mime) return { ok: false, error: "missing_audio_mime" };
  if (!ACCEPTED_AUDIO_MIME.includes(mime as (typeof ACCEPTED_AUDIO_MIME)[number])) {
    return { ok: false, error: `unsupported_audio_type: ${mime}` };
  }
  if (file.size <= 0) return { ok: false, error: "empty_audio" };
  if (file.size > MAX_AUDIO_BYTES) {
    return { ok: false, error: `audio_too_large: max ${MAX_AUDIO_BYTES} bytes` };
  }
  return { ok: true };
}

export const VoiceUploadMetaSchema = z.object({
  clinicId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
});

// What WF-02 returns and what POST /api/voice hands the browser: the transcript, the coach's
// validated text answer, and the spoken audio as base64 (data: URI is built client-side).
export const VoiceTurnResponseSchema = z.object({
  transcript: z.string().min(1),
  answer: z.string().min(1),
  audio_base64: z.string().min(1),
  audio_mime: z.string().default("audio/mpeg"),
});

export type VoiceTurnResponse = z.infer<typeof VoiceTurnResponseSchema>;
