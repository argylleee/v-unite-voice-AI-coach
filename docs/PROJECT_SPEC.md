# Project Specification

Source of truth: `../V-Unite_Voice_AI_Coach_MVP_Applicant_Challenge_Final_v4 (1).pdf` (in the
parent folder). This document restates it precisely so implementation work never has to
re-interpret the PDF from memory. If this file and the PDF ever disagree, the PDF wins — flag it
and update this file.

## Product

V-Unite Voice AI Coach — an AI business coach for an aesthetic clinic owner, working through chat
and voice, that understands the business using two sources: structured clinic/customer data and
an uploaded clinic knowledge base.

## Required technology (fixed — do not substitute)

| Purpose | Technology |
|---|---|
| Web app deployment | Vercel |
| Database + vector search | Supabase (PostgreSQL + pgvector) |
| AI orchestration | n8n (access provided by Emman/V-Unite) — **must remain the main orchestration layer** |
| Voice input/output | Fish Audio |
| LLM | Any API, capped at **$1** of provided credit |
| Source control + CI | GitHub + GitHub Actions |

## Minimum requirements (all 16 are graded pass/fail inputs to the rubric)

1. Deployed web application
2. Chat mode
3. Voice input
4. Voice response from the AI Coach
5. Three coaching topics (see categories below)
6. 50+ synthetic customer records (we target 100 — see `docs/DATABASE.md`)
7. Supabase for clinic/customer data
8. n8n as the main AI orchestration layer (optional coding/agent harnesses may run on your own
   server and be called by n8n — **not used in this project**, see `docs/ARCHITECTURE.md` §
   Decisions)
9. AI can use both clinic/customer data and uploaded knowledge
10. PDF/TXT knowledge-base upload with meaningful vector search / RAG
11. Saved coaching sessions/conversations
12. End-of-session summary or action plan
13. GitHub repository with the complete source code
14. Automated CI checks that run on push or pull request
15. Automated tests for important business and AI workflow paths
16. A deployment/build must fail when required checks fail (see `docs/DEPLOYMENT.md` for the exact
    mechanism — this is not automatic just because a CI workflow exists)

## Coaching categories (the "three coaching topics" requirement)

**Sales & Conversion** — why consultations aren't converting, which treatment needs attention, how
to handle price objections.

**Customers & Retention** — which customers may need follow-up, who hasn't returned recently,
where rebooking rates are weak.

**Clinic Knowledge** — what a policy says, how staff should explain a treatment, what an uploaded
SOP recommends.

## Customer/CRM data fields

name, treatment/service, provider, consultation status, purchase status, amount spent, last visit,
rebooked (yes/no), satisfaction, plus any other useful fields. No CRM UI is required — seed
directly into Supabase.

## Knowledge base

Upload format: PDF or TXT **only**. Content types: treatment info, clinic policies, sales/
consultation scripts, staff SOPs, pricing, other clinic documents.

## Expected AI behavior

The coach must use both structured data and uploaded knowledge, retrieve the right source, explain
what it found, and give specific coaching instead of generic advice.

- Weak: *"There are many possible reasons your sales might be declining."*
- Better: *"Your consultation volume looks healthy, but CoolSculpting conversion is much lower
  than your other services. Let's look at what happens during those consultations."*

## QA / CI-CD requirements

- GitHub repo with clear commit history
- CI workflow on push and/or PR
- Lint, typecheck, and production build checks
- Unit tests for deterministic business logic
- At least one backend/integration test
- At least one end-to-end or smoke test for a core user flow
- At least one failure or regression test
- External paid/voice APIs may be mocked in CI
- The expected working style is a small TDD loop: define expected behavior, write/update a test,
  let CI catch a failure, use AI to diagnose and fix it, return the pipeline to green.

## Scoring rubric (100%)

| Weight | Area | What it rewards |
|---|---|---|
| 18% | AI Agent Architecture & Reasoning | Agent behavior, not a plain chatbot; dynamic tool/data use; sensible AI architecture |
| 17% | Working End-to-End MVP | Frontend, chat/voice, n8n, AI, Supabase, Fish Audio all working together, demoable live |
| 15% | QA Automation, Testing & CI/CD | Useful tests, CI checks, failure/regression coverage, safe deploy gates, evidence AI was used to diagnose/fix issues |
| 12% | Data, RAG & Tool Usage | Meaningful customer-data use, correct structured queries, useful RAG, understanding SQL vs. vectors |
| 12% | AI Coach Responsiveness & Latency | Speed and naturalness of chat/voice responses, perceived latency, handling of slow states |
| 8% | Voice AI Experience | Working STT/TTS, understandable audio, natural flow, appropriate Fish Audio integration |
| 8% | n8n Implementation | Meaningful orchestration, clear workflow structure, reusable logic |
| 5% | Code & Technical Architecture | Readable structure, sensible separation of concerns |
| 5% | UI/UX & Creativity | Simple, understandable coaching experience, thoughtful improvements beyond the minimum |

Effort should track these weights: agent architecture and end-to-end reliability first, QA/CI
close behind, UI polish last. A beautiful UI with weak agent reasoning scores worse than a plain
UI with excellent reasoning.

## Primary demo scenario

1. "Which treatment needs attention?" → structured query identifies a weak-conversion treatment.
2. "Why is this treatment underperforming?" → further structured analysis.
3. "What does our consultation SOP recommend?" → RAG retrieval.
4. "Based on our conversion data and consultation SOP, what should we change?" → SQL + RAG +
   reasoning, the single strongest demonstration of the whole system.
5. Ask a similar question through voice → STT → agent → TTS.
6. End session → summary and action plan are generated and persisted.

## Optional bonus (only after every item above is verified working)

Streaming voice, natural turn-taking, authentication, charts/dashboards, session memory, multiple
AI tools, KPI calculations, customer segmentation, tool-call visualization, richer error handling,
stronger UI/UX.
