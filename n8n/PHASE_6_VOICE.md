# Phase 6 — Voice (WF-02) — BUILT & WORKING ($0)

WF-02 Voice Coach: `vqq63jCqbWA4k7wP` on the Railway instance, **active**. Verified end to end
through both `/webhook/voice` and Next.js `/api/voice`.

## STT: Groq Whisper (not Fish) — deliberate deviation

Fish Audio's STT (`/v1/asr`) has **no free tier** — it returns 402 on every model and the
account's API credit is $0 (Fish has a free *TTS* model but no free ASR). Rather than spend,
STT uses **Groq `whisper-large-v3-turbo`** (free tier, fast, and it natively accepts
`webm`/`opus` — which also removes the MediaRecorder-format risk).

- `docs/PROJECT_SPEC.md` lists Fish Audio for voice input+output. Fish still does the voice
  **output** (TTS, requirement #4). Using Groq for input transcription is the deviation —
  **flag to Emman**; if Fish API credit is provided later it's a one-node swap back to
  `Fish STT` (`POST https://api.fish.audio/v1/asr`, multipart `audio`).

## WF-02 flow

```
Voice Webhook  (POST /webhook/voice, header auth; multipart: audio + clinicId + mode)
  -> Groq Whisper STT  (HTTP: POST api.groq.com/openai/v1/audio/transcriptions,
       multipart file=<audio>, model=whisper-large-v3-turbo; cred "Groq account" [groqApi])
       -> transcript = {{ $json.text }}
  -> Prep Coach Call  (Set: transcript, clinicId from the webhook)
  -> Call WF-01  (HTTP: POST .../webhook/coach, header auth,
       body { clinicId, message: transcript, mode: "voice" })  -> { agent_output }
  -> Parse Answer  (Code: strip fences / extract {...} / take .answer, fallback to raw text)
  -> Fish TTS  (HTTP: POST api.fish.audio/v1/tts, header "model: s2.1-pro-free",
       body { text: answer, reference_id: "9a9cf47702da476aa4629e2506d4a857", format: "mp3" },
       response format = file -> binary "data"; cred "Fish Audio" [httpHeaderAuth])
  -> Encode Response  (Code: await this.helpers.getBinaryDataBuffer(0,'data') -> base64.
       NOTE: the instance's binaryDataMode is "database", so binary.data.data is NOT inline
       -- you must use getBinaryDataBuffer, not $json/binary access.)
  -> Respond OK  (JSON { transcript, answer, audio_base64, audio_mime })

Any of STT / Call WF-01 / TTS / Encode has onError=continueErrorOutput -> Respond Error (502,
{ ok:false, error:"voice_pipeline_failed" }).
```

Matches `VoiceTurnResponseSchema` in `src/lib/validation/voice.ts`.

## Credentials on Railway

- `Groq account` (`groqApi`) — Groq API key (console.groq.com/keys). Used by Groq Whisper STT.
- `Fish Audio` (`httpHeaderAuth`, `Authorization: Bearer <fish key>`) — used by Fish TTS.
- `V-Unite n8n Webhook Secret` — the Voice Webhook + the Call WF-01 hop.

(A stray `Groq account (dup-check)` credential may exist from a build slip — delete it in the
n8n UI if so; the real one is `Groq account`.)

## Still to do (Phase 8 UI pass)

- Browser `VoiceRecorder` producing a real webm clip + the 7 UI states
  (`idle/recording/uploading/transcribing/thinking/speaking/error`).
- Per-stage error surfacing (STT vs agent vs TTS) — WF-02 currently returns one
  `voice_pipeline_failed`; split into distinct Respond nodes if the demo needs it.
