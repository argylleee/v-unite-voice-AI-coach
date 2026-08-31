# Sample knowledge-base documents

Fictional documents for the **V-Unite Aesthetic Clinic** demo. Upload any of them on the
`/knowledge` screen (or `POST /api/knowledge`) to exercise PDF ingestion (WF-03) → chunking →
Cohere embeddings → pgvector, and then the coach's RAG + hybrid reasoning.

Regenerate with `node scripts/gen-sample-docs.mjs` (uses the Chromium that Playwright installs).

| File | What it is | Good demo question |
|---|---|---|
| `Consultation and Conversion SOP.pdf` | The consultation process, numbered sections 1–8: GBP 50 deposit (2), written quote before the client leaves (3.2), two options only (4.1), 48-hour follow-up for undecided clients (4.2), no same-day discounts (4.4), follow-up cadence (6), cancellations/no-shows (8). | *"Based on our CoolSculpting conversion data and our consultation SOP, what should we change?"* — the hybrid money-shot. The agent cites section numbers. |
| `Pricing and Packages 2026.pdf` | Per-treatment price bands, course discounts (3 → 10%, 6 → 18%), membership, CoolSculpting typical plans. | *"How should staff explain CoolSculpting pricing and what package discounts do we offer?"* |
| `CoolSculpting Treatment Protocol.pdf` | Clinical SOP: contraindications, expectation-setting (20–25% per cycle, results 8–12 weeks, usually 2 cycles), session steps, aftercare, 12-week review. | *"What does our CoolSculpting protocol say we must tell clients at consultation?"* |

Notes:
- `Consultation and Conversion SOP.pdf` deliberately overlaps in topic with the
  `Consultation and Conversion SOP.txt` already seeded in the demo — useful for showing the
  agent reason across two sources. To keep a demo clean, delete the `.txt` document first (or
  upload only the PDFs to a fresh clinic).
- The pricing bands line up with the seed data's `amount_spent` ranges in
  `src/lib/seed/patterns.ts`.
