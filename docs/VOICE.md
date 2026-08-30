# Voice

Fish Audio provides both speech-to-text and text-to-speech; voice is another entry point into the
same coaching agent as chat (`docs/N8N.md` WF-02), never a separate reasoning system.

## Fish Audio API contract (verify against current docs before building — APIs change)

- Base URL: `https://api.fish.audio/`
- Auth: `Authorization: Bearer <FISH_AUDIO_API_KEY>` on every request. A valid key doesn't
  guarantee success — insufficient credit or rate limits still fail the call (402 / 429), so
  handle those distinctly from a plain 401.
- **TTS:** `POST /v1/tts`
- **STT:** documented under the OpenAPI reference as `speech-to-text` (confirm the exact path
  against `https://api.fish.audio/openapi.json` before wiring the n8n node — API paths shift
  between doc revisions more often than the auth scheme does).
- STT accepts common audio/video formats (MP3, WAV, FLAC, M4A, OGG, MP4, MOV and more) up to 20MB
  / 60 minutes per request; longer recordings are chunked and stitched using segment timestamps.
- Store the API key only in n8n credentials / `FISH_AUDIO_API_KEY`. Never in a browser-reachable
  path, never logged, never in an error message surfaced to the client.

**Open risk to close early, not during Phase 6:** the browser's `MediaRecorder` API defaults to
`audio/webm` (or `audio/mp4` on Safari) — verify Fish Audio's STT endpoint accepts the exact
container/codec your target browser actually records before assuming it "just works." If it
doesn't, either force a supported `mimeType` in `MediaRecorder`'s constructor options where the
browser supports it, or transcode server-side (n8n) before the STT call. Confirm this with a real
recorded clip against the live API before Phase 6, not as a demo-day surprise.

## Pipeline

```
Browser: record (MediaRecorder) -> upload
  -> n8n: Fish Audio STT -> transcript
  -> same coaching agent pipeline as chat (docs/N8N.md WF-01 logic, via Execute Workflow)
  -> AI answer
  -> n8n: Fish Audio TTS -> audio
  -> Browser: play response
```

## MVP scope

Prioritize **reliable turn-based voice** over streaming. Streaming voice and natural turn-taking
are explicitly optional-bonus items in `docs/PROJECT_SPEC.md` — do not attempt them before every
required item is verified working end to end.

## Required UI states

`idle`, `recording`, `uploading`, `transcribing`, `thinking`, `speaking`, `error`. Never leave the
user without visible feedback during a multi-second voice round trip — this directly feeds the
12% Responsiveness & Latency score (perceived latency, loading indicators, handling of slow
states).

## Failure handling

Handle and surface distinctly: invalid/unsupported audio, STT failure, agent/LLM failure, TTS
failure, network failure. Never let a failed step silently produce a broken or empty audio
response — show the `error` state with a plain-language message ("We couldn't process your audio.
Please try recording again."). Mock Fish Audio in tests — see `docs/TESTING.md`.
