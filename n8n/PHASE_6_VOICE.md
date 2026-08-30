# Phase 6 — Voice (WF-02) reference

Voice = a different entry/exit around the **same** WF-01 agent (`docs/N8N.md`, `docs/VOICE.md`).
Claude Code will build WF-02 via the n8n API (like WF-03) once the Fish Audio key exists.

## Blockers (need these first)

1. **`FISH_AUDIO_API_KEY`** — from Emman or a Fish Audio account. Goes in n8n credentials +
   `.env.local` (server-side only, never logged).
2. **A TTS voice** — a `reference_id` (voice model ID) from the Fish Audio playground / library.
   Pick one English voice; put it in a workflow variable / the TTS node.

## Fish Audio API (from `https://api.fish.audio/openapi.json`, verified)

- Base: `https://api.fish.audio`
- Auth header on every call: `Authorization: Bearer <FISH_AUDIO_API_KEY>`
- Fish also expects a **`model` header** — use `s1` (their current ASR/TTS model line).

**STT — `POST /v1/asr`**
- `multipart/form-data`: `audio` (binary, required), `language` (optional, e.g. `en`),
  `ignore_timestamps` (bool, default true — leave true, we only need the text)
- 200 → JSON `{ "text": "...", "duration": <sec>, "segments": [...] }`
- Errors: 401 (bad key), 402 (no credit), 503 (overloaded) — surface each distinctly.

**TTS — `POST /v1/tts`**
- JSON body: `{ "text": "<coach answer>", "format": "mp3", "reference_id": "<voice id>",
  "latency": "normal", "mp3_bitrate": 128 }`
- 200 → **raw audio bytes** (mp3). In n8n set the HTTP Request node response format to `file`
  so it lands in binary; then base64-encode for the JSON response.

## MediaRecorder ↔ Fish format check (the Phase-6 risk — test with a real clip)

- Chrome records `audio/webm;codecs=opus`; Safari records `audio/mp4`. Fish's documented list
  (`docs/VOICE.md`) is MP3/WAV/FLAC/M4A/OGG/MP4/MOV — **webm not listed**.
- **First test:** POST a real Chrome `MediaRecorder` webm blob straight to `/v1/asr`. If Fish
  accepts it (it often does — same opus codec as ogg), no transcode needed.
- **If it 4xx's on webm:** transcode in WF-02 before STT. The Railway n8n image ships ffmpeg —
  an `Execute Command` node: `ffmpeg -i {{input}} -ar 16000 -ac 1 -f wav {{output}}`. Confirm
  `ffmpeg -version` works on the instance first.

## WF-02 flow

```
Voice Webhook (POST /webhook/voice, header auth, binary "audio", + form fields clinicId, mode)
  → Fish STT  (HTTP Request: POST /v1/asr, multipart, Bearer + model:s1 header)
      → transcript = {{ $json.text }}
  → HTTP Request → WF-01  (POST {{ $env or literal }}/webhook/coach, header auth,
      body { clinicId, message: <transcript>, mode: "voice" })
      → coach answer = the WF-01 JSON (already parsed by /api/coach's schema on the app side;
        here just take {{ $json.agent_output }} or re-run the same parse)
  → Fish TTS  (HTTP Request: POST /v1/tts, JSON { text: <answer>, format: "mp3",
      reference_id: "<voice id>" }, response format = file)
  → Code: base64-encode the audio binary
  → Respond JSON { transcript, answer, audio_base64, audio_mime: "audio/mpeg" }

Any step fails → Respond JSON { ok:false, error:"stt_failed" | "agent_failed" | "tts_failed" }
with a 502, and (if we have the transcript/answer) include them so the UI can still show text.
```

The Next.js side (`src/app/api/voice/route.ts`, `src/lib/validation/voice.ts`) already forwards
the blob and validates `VoiceTurnResponseSchema` = `{ transcript, answer, audio_base64, audio_mime }`.
Keep WF-02's Respond shape matching that.

## UI (mostly Phase 8, minimum here)

States required by `docs/VOICE.md`: `idle · recording · uploading · transcribing · thinking ·
speaking · error`. Phase 6 needs a minimal recorder to produce a real test clip; the polished
component (`VoiceRecorder`, `VoicePlayer`) is built in the Phase 8 Impeccable pass.
