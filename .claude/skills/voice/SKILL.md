---
name: voice
description: Use when implementing voice recording, Fish Audio STT/TTS integration, or voice UI states.
---

# Voice

Read `docs/VOICE.md` first for the actual Fish Audio API contract (base URL, auth header,
endpoints, format constraints) — don't guess it.

## Rules

- Voice reuses the exact same coaching agent pipeline as chat (`docs/N8N.md` WF-01 logic via
  `Execute Workflow`). Never build separate reasoning for voice.
- Verify the audio format `MediaRecorder` actually produces in the target browser is accepted by
  Fish Audio's STT endpoint with a real test clip — don't assume compatibility. Transcode
  server-side in n8n if needed.
- Implement all required UI states: `idle`, `recording`, `uploading`, `transcribing`, `thinking`,
  `speaking`, `error`. No silent multi-second gaps.
- Prioritize reliable turn-based voice over streaming — streaming/natural turn-taking are
  optional-bonus items, not required.
- `FISH_AUDIO_API_KEY` lives in n8n credentials / server-side env only.
- Handle and distinguish: invalid audio, STT failure, agent failure, TTS failure, network failure.
  Mock Fish Audio in tests.
