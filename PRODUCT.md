# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is the **owner of an aesthetic clinic** — a hands-on operator, not a data
analyst. They open the tool between patients or after hours to decide what to change in the
business: why consultations aren't converting, which customers to follow up with, what an
uploaded SOP recommends. They ask questions in plain language, by typing or by speaking, and
expect a specific answer they can act on. There is no separate "analyst" or "admin" persona —
the owner does everything.

## Product Purpose

An AI business coach that answers the owner's questions using two sources — the clinic's
structured customer/CRM data and the clinic's own uploaded knowledge base (policies, SOPs,
consultation scripts) — and produces **evidence-based coaching rather than generic advice**.
Success is the owner leaving a session with a concrete, correct next step and being able to
see the numbers and document passages the coach based it on.

Built for the V-Unite 2–3 day applicant challenge. It is an MVP: a reliable, demonstrable
end-to-end system, not a production SaaS.

## Positioning

The coach is an **agent, not a chatbot**: per question it decides whether it needs structured
data, uploaded knowledge, both, or neither, and calls the matching tool. Structured business
metrics (conversion rate, rebooking rate, average spend, lapsed-customer counts) come from
deterministic SQL tools — the model never does the arithmetic. Unstructured questions ("what
does our cancellation policy say?") go through vector retrieval over the uploaded documents.
The strongest moment is a hybrid question ("conversion is low — what does our SOP recommend
we change?") answered from SQL + retrieved SOP text + reasoning, with both kinds of evidence
cited. If the data or a document isn't there, the coach says so instead of inventing an
answer.

## Operating Context

- **Two entry points to the same coach:** a text chat and a push-to-talk voice turn (record →
  transcribe → same agent → spoken answer played back). Voice is a different way in, never a
  separate system.
- **Knowledge base:** the owner uploads PDF or TXT documents (SOPs, scripts, pricing, policies).
  Only PDF/TXT. Ingestion is asynchronous — a document is `processing` then `ready`.
- **Sessions:** each conversation is saved. At the end the owner gets a generated summary,
  key findings, and a prioritised action plan, all persisted and reviewable later.
- **Demo dataset:** one seeded clinic ("V-Unite Aesthetic Clinic") with 100 synthetic
  customers carrying deliberate patterns — CoolSculpting has high consult volume but weak
  conversion (~27.6%), Botox converts and rebooks well, HydraFacial rebooks poorly, plus a
  cluster of customers >90 days since last visit. The demo scenarios depend on these.
- **Latency is visible:** a coaching turn is roughly 10–20 seconds (tool calls + model), and a
  voice turn adds transcription + speech synthesis. Every wait needs a designed state.

## Capabilities and Constraints

- **Screens (required):** the coach conversation (`/coach`, chat + voice), knowledge upload
  and document list (`/knowledge`), the session list (`/sessions`), and a session detail view
  with its summary and action plan (`/sessions/[id]`).
- **The frontend is presentation only.** No AI orchestration, no LLM or database calls from
  the browser. It talks to Next.js API routes that forward to n8n workflows and read Supabase
  server-side. (`docs/ARCHITECTURE.md`)
- **Coach response shape:** every answer arrives as `{ answer, insights[], evidence[],
  recommendations[], follow_up_question }`. Each `evidence` item is either `customer_data`
  (from a SQL tool) or `knowledge_base` (a document excerpt) and carries a source label —
  a tool name or the exact document filename. Rendering evidence legibly is a first-class
  requirement, not decoration: it is what demonstrates the agent's reasoning.
- **Async states that must each be a real designed state:** `idle`, `loading` / `thinking`,
  `error`; and for voice: `recording`, `uploading`, `transcribing`, `speaking`.
- **Failure handling:** the coach can return a degraded fallback answer; uploads can be
  rejected (wrong type, too large, per-clinic limit) or fail ingestion; voice can fail at
  transcription, agent, or speech synthesis. Each surfaces a plain-language error, never a
  hang or a fake success.
- **Coaching topics the owner can ask about:** sales & conversion, customer retention &
  follow-up, and clinic knowledge. Suggested starter questions grouped by those three
  categories help the owner begin.
- **Stack (existing):** Next.js App Router + TypeScript + React + Tailwind v4. Deployed to
  Vercel. No auth / no login in the MVP — a single clinic, single user.

## Brand Commitments

- Name: **V-Unite Voice AI Coach**. The seeded clinic is "V-Unite Aesthetic Clinic".
- Voice of the coach's own copy (already set in the agent prompt): direct, specific,
  non-generic; separates what was observed, what is inferred, and what is recommended; never
  fabricates a clinic fact.
- No logo, colour, or typography has been committed. Visual direction is open (new-work).

## Evidence on Hand

- The seeded 100-customer demo dataset in Supabase and its documented patterns
  (`docs/DATABASE.md`).
- An uploaded "Consultation and Conversion SOP" in the knowledge base used for the hybrid
  demo (`n8n/PHASE_6_VOICE.md`, `STATUS.md`).
- No real clinic, no real customers, no testimonials, no pricing — the UI must not present
  synthetic demo data as if it were a real customer's, and must not invent clinic facts,
  metrics, or logos.

## Product Principles

1. **Show the evidence.** The numbers and document passages behind an answer are the point of
   the interface; make them scannable, sourced, and impossible to miss.
2. **Never fake certainty.** A missing metric, an empty retrieval, or a failed step is shown
   plainly — the coach and the UI both say "not enough information" rather than guessing.
3. **One coach, two doors.** Chat and voice are the same conversation and the same reasoning;
   the UI should make that obvious, not present voice as a separate mode.
4. **Every wait is designed.** A 15-second coaching turn with a real thinking state beats an
   instant-looking UI that then freezes.
5. **Right-size the surface.** This is a decision tool an owner operates, not a marketing
   page. Clarity, hierarchy, and legible evidence outrank visual ambition — UI/UX is a small
   slice of how this is judged.

## Accessibility & Inclusion

Baseline: labelled and keyboard-operable interactive controls, visible focus, sufficient
contrast, and a non-audio path to every voice answer (the transcript and the text answer are
always shown alongside the played audio). No stricter standard has been mandated.
