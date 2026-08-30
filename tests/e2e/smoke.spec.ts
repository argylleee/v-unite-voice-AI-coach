import { expect, test, type Route } from "@playwright/test";

// Core-journey smoke (docs/TESTING.md): open app -> create session -> ask a coaching question
// -> receive a structured, evidence-bearing answer -> end session -> see the summary + action
// plan. The n8n/LLM backend is stubbed at the /api boundary with page.route() so the run is
// deterministic and needs no live workflow — the full stack against real n8n is the Phase 10
// production check. What this exercises for real: routing, the session lifecycle, the coach
// answer rendering (findings/assessment/plan), and the end-of-session summary screen.

const SESSION_ID = "e2e-session-1";

const AGENT_ANSWER = {
  answer:
    "CoolSculpting has the lowest conversion at 27.6% — 8 purchases from 29 completed consultations, " +
    "well below Botox (78.6%) and the clinic average.",
  insights: ["CoolSculpting draws the most consultations but converts the worst."],
  evidence: [
    {
      type: "customer_data",
      description: "CoolSculpting: 8 purchases / 29 completed consultations (27.6%)",
      source: null,
    },
    {
      type: "knowledge_base",
      description:
        "Consultation SOP section 4.2: a written treatment plan and quote must be issued before the client leaves.",
      source: "Consultation and Conversion SOP.txt",
    },
  ],
  recommendations: [
    "Audit CoolSculpting consultations against SOP section 4.2 — check every client leaves with a quote.",
    "Introduce a 48-hour follow-up call for undecided CoolSculpting consults.",
  ],
  follow_up_question: "Want to see which provider runs most of those consultations?",
};

const SUMMARY = {
  summary:
    "Reviewed CoolSculpting's weak conversion (27.6%) against the consultation SOP and agreed a two-step fix.",
  key_findings: [
    "CoolSculpting converts at 27.6%, the lowest of any treatment.",
    "SOP section 4.2 (written quote before the client leaves) is not being followed consistently.",
  ],
  action_plan: [
    { action: "Audit CoolSculpting consultations against SOP section 4.2.", priority: "high" },
    { action: "Add a 48-hour follow-up call for undecided consults.", priority: "medium" },
  ],
};

const SESSION_DETAIL = {
  session: {
    id: SESSION_ID,
    title: "Coaching session",
    started_at: "2026-08-31T03:00:00.000Z",
    ended_at: "2026-08-31T03:12:00.000Z",
    summary: SUMMARY.summary,
    key_findings: SUMMARY.key_findings,
    action_plan: SUMMARY.action_plan,
  },
  messages: [
    {
      id: "m1",
      role: "user",
      content: "Which treatment has the lowest conversion?",
      input_mode: "chat",
      evidence: null,
      created_at: "2026-08-31T03:01:00.000Z",
    },
    {
      id: "m2",
      role: "assistant",
      content: AGENT_ANSWER.answer,
      input_mode: "chat",
      evidence: null,
      created_at: "2026-08-31T03:01:30.000Z",
    },
  ],
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;

    if (path === "/api/sessions" && method === "POST") return json(route, { id: SESSION_ID });
    if (path === "/api/sessions" && method === "GET") {
      return json(route, {
        sessions: [
          {
            id: SESSION_ID,
            title: "Coaching session",
            started_at: SESSION_DETAIL.session.started_at,
            ended_at: null,
            has_summary: false,
            message_count: 2,
          },
        ],
      });
    }
    if (path === `/api/sessions/${SESSION_ID}/end` && method === "POST") return json(route, SUMMARY);
    if (path === `/api/sessions/${SESSION_ID}` && method === "GET")
      return json(route, SESSION_DETAIL);
    if (path === "/api/coach" && method === "POST") return json(route, AGENT_ANSWER);
    if (path === "/api/knowledge" && method === "GET") return json(route, { documents: [] });

    return json(route, { ok: false, error: "unmocked" }, 500);
  });
});

test("core journey: ask a coaching question, get an evidenced answer, end with a summary", async ({
  page,
}) => {
  // open app -> redirected to the coach
  await page.goto("/");
  await expect(page).toHaveURL(/\/coach$/);
  await expect(page.getByRole("heading", { name: "Coach", exact: true })).toBeVisible();

  // ask a coaching question
  await page.getByLabel("Ask the coach").fill("Which treatment has the lowest conversion?");
  await page.getByRole("button", { name: "Ask" }).click();

  // structured answer references a specific treatment + number, and shows its evidence
  await expect(page.getByText(/CoolSculpting/).first()).toBeVisible();
  await expect(page.getByText(/27\.6%/).first()).toBeVisible();
  await expect(page.getByText("Findings", { exact: true })).toBeVisible();
  await expect(page.getByText("Plan", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Consultation SOP section 4\.2/).first(),
  ).toBeVisible();

  // end the session -> lands on the session detail with a summary + action plan
  await page.getByRole("button", { name: /End & summarise/i }).click();
  await expect(page).toHaveURL(new RegExp(`/sessions/${SESSION_ID}$`));
  await expect(page.getByText("Summary", { exact: true })).toBeVisible();
  await expect(page.getByText(SUMMARY.key_findings[0])).toBeVisible();
  await expect(page.getByText("Action plan", { exact: true })).toBeVisible();
  await expect(page.getByText(/Audit CoolSculpting consultations/)).toBeVisible();
});

test("the three sections are reachable from the rail", async ({ page }) => {
  await page.goto("/coach");
  await page.getByRole("link", { name: "Knowledge" }).click();
  await expect(page).toHaveURL(/\/knowledge$/);
  await expect(page.getByRole("heading", { name: "Knowledge base" })).toBeVisible();

  await page.getByRole("link", { name: "Sessions" }).click();
  await expect(page).toHaveURL(/\/sessions$/);
  await expect(page.getByRole("heading", { name: "Sessions", exact: true })).toBeVisible();
});
