import { describe, expect, it } from "vitest";
import {
  coerceAgentPayload,
  parseAgentResponse,
  type AgentResponse,
} from "../../src/lib/validation/agent-response";

const VALID: AgentResponse = {
  answer: "CoolSculpting converts at 27.6%, the weakest of your treatments.",
  insights: ["Lowest conversion of any treatment."],
  evidence: [
    { type: "customer_data", description: "8 purchases / 29 consultations", source: null },
  ],
  recommendations: ["Audit the CoolSculpting consult."],
  follow_up_question: "Look at provider mix?",
};

describe("coerceAgentPayload", () => {
  it("passes a bare object through", () => {
    expect(coerceAgentPayload(VALID)).toEqual(VALID);
  });

  it("unwraps { agent_output: <object> }", () => {
    expect(coerceAgentPayload({ agent_output: VALID })).toEqual(VALID);
  });

  it("parses { agent_output: '<json string>' }", () => {
    expect(coerceAgentPayload({ agent_output: JSON.stringify(VALID) })).toEqual(VALID);
  });

  it("strips a ```json fence", () => {
    const fenced = "```json\n" + JSON.stringify(VALID) + "\n```";
    expect(coerceAgentPayload({ agent_output: fenced })).toEqual(VALID);
  });

  it("extracts the object when the model adds prose around it", () => {
    const messy = `Sure, here is the answer:\n\n${JSON.stringify(VALID)}\n\nHope that helps!`;
    expect(coerceAgentPayload({ agent_output: messy })).toEqual(VALID);
  });

  it("unwraps a JSON object nested inside the answer field", () => {
    const nested = { answer: JSON.stringify(VALID) };
    expect(coerceAgentPayload({ agent_output: JSON.stringify(nested) })).toEqual(VALID);
  });

  it("handles the legacy { output: ... } wrapper", () => {
    expect(coerceAgentPayload({ output: VALID })).toEqual(VALID);
  });
});

describe("parseAgentResponse", () => {
  it("validates a good payload", () => {
    expect(parseAgentResponse({ agent_output: JSON.stringify(VALID) })).toEqual(VALID);
  });

  it("fills defaults for missing optional arrays", () => {
    const partial = { answer: "Just an answer." };
    expect(parseAgentResponse({ agent_output: JSON.stringify(partial) })).toEqual({
      answer: "Just an answer.",
      insights: [],
      evidence: [],
      recommendations: [],
      follow_up_question: null,
    });
  });

  it("returns null for an empty answer", () => {
    expect(parseAgentResponse({ agent_output: JSON.stringify({ answer: "" }) })).toBeNull();
  });

  it("returns null for unparseable garbage", () => {
    expect(parseAgentResponse({ agent_output: "the model said no" })).toBeNull();
    expect(parseAgentResponse({ nonsense: true })).toBeNull();
    expect(parseAgentResponse(null)).toBeNull();
  });

  it("drops a malformed evidence item instead of failing the whole parse", () => {
    const payload = {
      answer: "An answer.",
      evidence: [{ type: "weird", description: "" }],
    };
    const result = parseAgentResponse({ agent_output: JSON.stringify(payload) });
    expect(result?.answer).toBe("An answer.");
    expect(result?.evidence).toEqual([]);
  });
});
