import { n8nVoiceConfig } from "@/lib/env";
import {
  FALLBACK_RESPONSE,
} from "@/lib/validation/agent-response";
import {
  validateAudioUpload,
  VoiceTurnResponseSchema,
  VoiceUploadMetaSchema,
} from "@/lib/validation/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// STT -> agent -> TTS is the slowest path (~18-25s observed). Hobby default is 10s, max 60s.
export const maxDuration = 60;

// POST /api/voice — multipart upload of a recorded audio blob (field `audio` + `clinicId`).
// Forwards it to the n8n voice webhook (WF-02), which runs Fish Audio STT -> the WF-01 coaching
// agent -> Fish Audio TTS, and returns { transcript, answer, audio_base64 }. No STT/TTS or AI
// happens here (docs/ARCHITECTURE.md) — voice is just a different entry/exit around WF-01.
export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, error: "invalid_multipart" }, { status: 400 });
  }

  const meta = VoiceUploadMetaSchema.safeParse({
    clinicId: form.get("clinicId"),
    sessionId: form.get("sessionId") ?? undefined,
  });
  if (!meta.success) {
    return Response.json(
      { ok: false, error: "invalid_request", issues: meta.error.flatten() },
      { status: 400 },
    );
  }

  const audio = form.get("audio");
  if (!(audio instanceof File)) {
    return Response.json({ ok: false, error: "missing_audio" }, { status: 400 });
  }

  const check = validateAudioUpload({ type: audio.type, size: audio.size });
  if (!check.ok) {
    return Response.json({ ok: false, error: check.error }, { status: 400 });
  }

  let config: { url: string; secret: string };
  try {
    config = n8nVoiceConfig();
  } catch (err) {
    console.error("[api/voice] misconfigured:", err);
    return Response.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  }

  const outbound = new FormData();
  outbound.append("audio", audio, audio.name || "recording.webm");
  outbound.append("clinicId", meta.data.clinicId);
  outbound.append("mode", "voice");
  if (meta.data.sessionId) outbound.append("sessionId", meta.data.sessionId);

  let res: Response;
  try {
    res = await fetch(config.url, {
      method: "POST",
      headers: { authorization: `Bearer ${config.secret}` },
      body: outbound,
      // STT + a full agent turn + TTS — the slowest path in the app.
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[api/voice] n8n voice call failed:", err);
    return Response.json({ ok: false, error: "upstream_error" }, { status: 502 });
  }

  const text = await res.text();
  if (!res.ok) {
    console.error("[api/voice] n8n voice returned", res.status, text.slice(0, 500));
    return Response.json(
      { ok: false, error: "upstream_error", upstreamStatus: res.status },
      { status: 502 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    console.error("[api/voice] n8n voice returned non-JSON");
    return Response.json({ ok: false, error: "upstream_bad_response" }, { status: 502 });
  }

  const parsed = VoiceTurnResponseSchema.safeParse(body);
  if (!parsed.success) {
    // We at least got something back; surface a usable text answer if present, but never a
    // broken/empty audio response (docs/VOICE.md failure handling).
    const maybeAnswer =
      body && typeof body === "object" && typeof (body as Record<string, unknown>).answer === "string"
        ? ((body as Record<string, unknown>).answer as string)
        : FALLBACK_RESPONSE.answer;
    console.error("[api/voice] voice response failed validation");
    return Response.json(
      { ok: false, error: "invalid_voice_response", answer: maybeAnswer },
      { status: 502 },
    );
  }

  return Response.json(parsed.data, { status: 200 });
}
