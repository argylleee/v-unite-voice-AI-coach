import { describe, expect, it } from "vitest";
import { MAX_AUDIO_BYTES, validateAudioUpload } from "../../src/lib/validation/voice";

describe("validateAudioUpload", () => {
  it("accepts Chrome's MediaRecorder default (webm/opus)", () => {
    expect(validateAudioUpload({ type: "audio/webm;codecs=opus", size: 50_000 })).toEqual({
      ok: true,
    });
  });

  it("accepts Safari's mp4 recording", () => {
    expect(validateAudioUpload({ type: "audio/mp4", size: 50_000 })).toEqual({ ok: true });
  });

  it("rejects a non-audio type", () => {
    const r = validateAudioUpload({ type: "video/x-msvideo", size: 1000 });
    expect(r).toEqual({ ok: false, error: expect.stringContaining("unsupported_audio_type") });
  });

  it("rejects a missing mime", () => {
    expect(validateAudioUpload({ type: "", size: 1000 })).toEqual({
      ok: false,
      error: "missing_audio_mime",
    });
  });

  it("rejects an empty blob", () => {
    expect(validateAudioUpload({ type: "audio/webm", size: 0 })).toEqual({
      ok: false,
      error: "empty_audio",
    });
  });

  it("rejects oversize audio", () => {
    const r = validateAudioUpload({ type: "audio/webm", size: MAX_AUDIO_BYTES + 1 });
    expect(r).toEqual({ ok: false, error: expect.stringContaining("audio_too_large") });
  });
});
