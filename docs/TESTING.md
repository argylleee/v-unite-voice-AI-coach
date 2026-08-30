# Testing

Philosophy: protect the highest-risk behavior, don't chase a test count. `docs/PROJECT_SPEC.md`
requires all four categories below — each is a pass/fail rubric input, not optional.

## Unit tests (`tests/unit/`)

Deterministic business logic only:

- `calculateConversionRate()`, `calculateRebookingRate()`, `calculateAverageSpend()`
- `getDaysSinceVisit()`, `filterFollowUpCustomers()`
- Any other pure function backing `customer_analytics` / `customer_lookup` / `kpi_calculator`

```ts
expect(calculateConversionRate(7, 24)).toBeCloseTo(29.17);
```

## Integration test (`tests/integration/`)

At least one real backend path: request validation -> orchestration -> database/tool
interaction. External paid APIs (LLM, Fish Audio) may be mocked — the brief explicitly allows
this. What must be real: the request shape, the validation logic, and the database interaction.

## End-to-end / smoke test (`tests/e2e/`)

The core user journey:

```
Open app -> create session -> ask "Which treatment has the lowest conversion?"
  -> submit -> wait for response -> verify response references a specific treatment/number
  -> end session -> verify summary/action plan appears
```

## Failure / regression test (required, not optional)

Concrete recommended case: ask a clinic-policy question with **no relevant document uploaded**.

Expected: *"The clinic knowledge base does not contain enough information to answer this
accurately."* NOT a fabricated policy. This is the hallucination-protection test called out in
`docs/RAG.md` and `docs/AI_AGENT.md` — it directly demonstrates the grounding rules are real, not
just documented.

Also cover: invalid input, empty RAG retrieval, AI timeout, malformed AI JSON response,
unavailable Fish Audio, and — since `docs/RAG.md` requires it — a prompt-injection attempt embedded
inside an uploaded document (verify the agent treats it as content, not as an instruction).

## AI-specific testing rules

Do not assert exact-string equality on LLM output. Assert on: response structure (matches the
Zod schema in `docs/AI_AGENT.md`), presence of evidence, correct tool selection for a given
question type, and the presence/absence of expected business facts (e.g. the response mentions
"CoolSculpting" when asked about the weakest-converting treatment in the seeded demo dataset).

## Regression discipline

When a real bug is found during development, add a regression test for it where practical — this
is the TDD loop the brief explicitly says it wants to see evidence of: define expected behavior,
write/update a test, let CI catch the failure, diagnose and fix it, return the pipeline to green.

## CI

A pull request must fail if lint, typecheck, unit tests, integration tests, or the production
build fail. E2E runs where practical (see `docs/DEPLOYMENT.md` for how this also gates production
promotion, not just merging).
