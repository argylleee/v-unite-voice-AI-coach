// Generates the demo knowledge-base PDFs in sample-docs/ from the HTML below, using the
// Chromium that Playwright already installs. Run from the repo root: `node scripts/gen-sample-docs.mjs`.
// These are fictional documents for the V-Unite Aesthetic Clinic demo — safe to upload on
// /knowledge to exercise PDF ingestion + RAG + the hybrid "what does our SOP say" reasoning.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = "sample-docs";
mkdirSync(OUT, { recursive: true });

const shell = (title, body) => `<!doctype html><meta charset="utf-8"><title>${title}</title>
<style>
  @page { margin: 22mm 20mm; }
  body { font: 11pt/1.55 Georgia, "Times New Roman", serif; color: #1a1a1a; }
  h1 { font-size: 19pt; margin: 0 0 2pt; }
  .sub { color: #555; font-size: 9.5pt; margin: 0 0 18pt; }
  h2 { font-size: 12.5pt; margin: 20pt 0 4pt; border-bottom: 1px solid #ccc; padding-bottom: 2pt; }
  h3 { font-size: 10.5pt; margin: 12pt 0 2pt; }
  p, li { margin: 4pt 0; }
  ul, ol { margin: 4pt 0 4pt 16pt; padding: 0; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; margin: 8pt 0; }
  th, td { border: 1px solid #bbb; padding: 4pt 7pt; text-align: left; }
  th { background: #f0efe9; }
  .foot { margin-top: 22pt; color: #777; font-size: 8.5pt; border-top: 1px solid #ccc; padding-top: 6pt; }
</style>
${body}
<p class="foot">V-Unite Aesthetic Clinic &middot; internal document &middot; fictional content for demonstration.</p>`;

const DOCS = [
  {
    file: "Consultation and Conversion SOP.pdf",
    title: "Consultation & Conversion SOP",
    body: `
<h1>Consultation &amp; Conversion SOP</h1>
<p class="sub">V-Unite Aesthetic Clinic &middot; Version 3.1 &middot; Effective 1 January 2026 &middot; Owner: Clinic Manager</p>

<h2>1. Purpose &amp; scope</h2>
<p>This SOP governs how every paid and complimentary consultation is run, from booking to
follow-up, across all treatments. It applies to all providers and front-desk staff.</p>

<h2>2. Booking &amp; deposits</h2>
<ul>
  <li>2.1 A non-refundable deposit of <strong>GBP 50</strong> is taken at the time any consultation is booked.</li>
  <li>2.2 The deposit is credited in full against the price of any treatment booked within
      <strong>30 days</strong> of the consultation.</li>
  <li>2.3 Front desk confirms every appointment by SMS 24 hours in advance.</li>
</ul>

<h2>3. Running the consultation</h2>
<ul>
  <li>3.1 Allow 20 minutes. Structure: history &amp; goals (5) &rarr; assessment (7) &rarr; options &amp; plan (8).</li>
  <li>3.2 <strong>Every consultation must end with a written treatment plan and a dated price quote
      handed to the client before they leave.</strong> No client leaves with only a verbal figure.</li>
  <li>3.3 The provider records the expected outcome, the number of sessions, and any
      contraindications in the client record.</li>
  <li>3.4 If the client is not a candidate for the requested treatment, say so and offer the
      nearest suitable alternative.</li>
</ul>

<h2>4. Conversion practices</h2>
<ul>
  <li>4.1 Present exactly two options: a single-session price and a course/package price. Do not
      overwhelm with more than two.</li>
  <li>4.2 If the client is undecided at the end of the consultation, book a <strong>provisional
      treatment date</strong> and schedule a <strong>48-hour follow-up call</strong> before they leave.</li>
  <li>4.3 Package and course pricing is only ever given in writing (on the quote sheet), never
      improvised verbally.</li>
  <li>4.4 <strong>No same-day pressure discounts.</strong> Any promotional price is the standard
      published promotion, available for the full promotional window.</li>
</ul>

<h2>5. Objection handling</h2>
<h3>&ldquo;It's too expensive&rdquo;</h3>
<p>Acknowledge, then reframe to cost-per-session or cost-per-month over the course. Offer the
package price. Do not discount on the spot.</p>
<h3>&ldquo;I need to think about it&rdquo;</h3>
<p>&ldquo;Of course. Let's hold a provisional date so you don't lose your preferred slot, and I'll
call you Thursday to answer anything that comes up.&rdquo; Then follow section 4.2.</p>
<h3>&ldquo;I'm comparing a few clinics&rdquo;</h3>
<p>Give the written quote, highlight the provider's credentials and the aftercare included, and
set the 48-hour follow-up.</p>

<h2>6. Follow-up cadence</h2>
<table>
  <tr><th>When</th><th>Action</th><th>Owner</th></tr>
  <tr><td>+48 hours</td><td>Phone call &mdash; answer questions, confirm or release the provisional date</td><td>Consulting provider</td></tr>
  <tr><td>+7 days</td><td>Email with the quote attached and one testimonial</td><td>Front desk</td></tr>
  <tr><td>+21 days</td><td>Final short message; then mark the lead closed</td><td>Front desk</td></tr>
</table>

<h2>7. Recording outcomes</h2>
<p>Within 15 minutes of the consultation, set the outcome to one of: <em>booked</em>,
<em>provisional</em>, <em>thinking</em>, <em>not proceeding</em>. A consultation with no recorded
outcome is treated as a process failure at the weekly review.</p>

<h2>8. Cancellations &amp; no-shows</h2>
<ul>
  <li>8.1 Cancellations or reschedules with at least <strong>48 hours</strong> notice: no charge beyond the consultation deposit.</li>
  <li>8.2 Cancellation inside 48 hours: <strong>50%</strong> of the treatment price is forfeited.</li>
  <li>8.3 No-show without notice: <strong>100%</strong> of the treatment price and any deposit is forfeited.</li>
  <li>8.4 The authoritative wording for clients is the Refund &amp; Cancellation Policy; this SOP
      is the operational summary.</li>
</ul>`,
  },
  {
    file: "Pricing and Packages 2026.pdf",
    title: "Pricing & Packages 2026",
    body: `
<h1>Pricing &amp; Packages &mdash; 2026</h1>
<p class="sub">V-Unite Aesthetic Clinic &middot; All prices GBP, inclusive of aftercare &middot; Valid to 31 December 2026</p>

<h2>1. Single-session pricing</h2>
<table>
  <tr><th>Treatment</th><th>Unit</th><th>From</th><th>To</th></tr>
  <tr><td>CoolSculpting</td><td>per applicator / area</td><td>1,800</td><td>3,600</td></tr>
  <tr><td>Botox</td><td>per area (1&ndash;3 areas)</td><td>350</td><td>950</td></tr>
  <tr><td>HydraFacial</td><td>per session</td><td>180</td><td>420</td></tr>
  <tr><td>Laser Hair Removal</td><td>per course area</td><td>600</td><td>1,500</td></tr>
</table>
<p>The exact figure within each band depends on area size and product volume and is set on the
written quote at consultation (see Consultation SOP section 3.2).</p>

<h2>2. Course &amp; package discounts</h2>
<table>
  <tr><th>Commitment</th><th>Discount vs single-session</th></tr>
  <tr><td>Course of 3, paid upfront</td><td>10%</td></tr>
  <tr><td>Course of 6, paid upfront</td><td>18%</td></tr>
  <tr><td>Annual membership (see section 3)</td><td>15% on all treatments + priority booking</td></tr>
</table>
<p>Discounts do not stack. Package pricing is quoted in writing only.</p>

<h2>3. Membership</h2>
<ul>
  <li>GBP 45 / month, 12-month minimum term.</li>
  <li>15% off every treatment, one complimentary HydraFacial per quarter, priority booking.</li>
  <li>Membership credit is not refundable but transfers to clinic credit at the end of term.</li>
</ul>

<h2>4. Deposits</h2>
<p>A GBP 50 consultation deposit applies to every booking and is credited against a treatment
booked within 30 days (Consultation SOP section 2).</p>

<h2>5. CoolSculpting &mdash; typical plans</h2>
<table>
  <tr><th>Concern</th><th>Typical applicators</th><th>Indicative total</th></tr>
  <tr><td>Flanks (&ldquo;love handles&rdquo;)</td><td>2</td><td>3,600&ndash;5,000</td></tr>
  <tr><td>Lower abdomen</td><td>1&ndash;2</td><td>1,800&ndash;4,200</td></tr>
  <tr><td>Double chin</td><td>1</td><td>1,800&ndash;2,400</td></tr>
</table>
<p>Most areas need a second cycle at 8&ndash;12 weeks for the full result; this is quoted at consultation.</p>`,
  },
  {
    file: "CoolSculpting Treatment Protocol.pdf",
    title: "CoolSculpting Treatment Protocol",
    body: `
<h1>CoolSculpting Treatment Protocol</h1>
<p class="sub">V-Unite Aesthetic Clinic &middot; Clinical SOP &middot; Version 2.0 &middot; Review date: June 2026</p>

<h2>1. Indications &amp; contraindications</h2>
<p>CoolSculpting (cryolipolysis) is for reduction of localised, pinchable subcutaneous fat in a
client at or near a stable target weight. It is <strong>not</strong> a weight-loss treatment.</p>
<h3>Do not treat if any of the following apply</h3>
<ul>
  <li>Cryoglobulinaemia, cold agglutinin disease, or paroxysmal cold haemoglobinuria.</li>
  <li>Pregnancy or breastfeeding.</li>
  <li>Hernia at or near the proposed treatment site.</li>
  <li>Recent surgery or significant scarring in the area.</li>
</ul>

<h2>2. Consultation &amp; expectation setting</h2>
<ul>
  <li>2.1 Perform and document a pinch test; only areas with a clear pinch are suitable.</li>
  <li>2.2 Take standardised before photographs (front, both obliques) under fixed lighting.</li>
  <li>2.3 State the expected outcome clearly: <strong>approximately 20&ndash;25% reduction of the
      fat layer in the treated area per cycle</strong>, with visible results at
      <strong>8&ndash;12 weeks</strong>.</li>
  <li>2.4 Most areas require <strong>two cycles</strong>, spaced 8&ndash;12 weeks apart, for the
      full result. Quote both cycles at consultation.</li>
  <li>2.5 Issue the written plan and quote before the client leaves (Consultation SOP 3.2).</li>
</ul>

<h2>3. Treatment session</h2>
<ul>
  <li>3.1 Confirm consent and re-confirm the marked area with the client standing.</li>
  <li>3.2 Apply gel pad; position applicator; confirm adequate tissue draw.</li>
  <li>3.3 Cycle time per applicator: 35&ndash;45 minutes depending on applicator.</li>
  <li>3.4 On removal, massage the treated area firmly for 2&ndash;3 minutes &mdash; this materially
      improves the result.</li>
</ul>

<h2>4. Aftercare (give to every client in writing)</h2>
<ul>
  <li>Expect redness, firmness, swelling, tingling or numbness for days to a few weeks.</li>
  <li>Transient numbness in the area can last up to 6&ndash;8 weeks; this is normal.</li>
  <li>Normal activity and exercise can resume the same day.</li>
  <li>Contact the clinic if there is severe or worsening pain after the first week.</li>
</ul>

<h2>5. Follow-up</h2>
<ul>
  <li>5.1 48-hour check-in call (Consultation SOP section 6).</li>
  <li>5.2 Review appointment with standardised photographs at <strong>12 weeks</strong>.</li>
  <li>5.3 Book the second cycle at the 12-week review if indicated.</li>
</ul>

<h2>6. Why conversion on this treatment is monitored</h2>
<p>CoolSculpting has the clinic's highest consultation volume and, historically, its lowest
consultation-to-purchase conversion. Providers must follow sections 2 and 4 of this protocol and
section 4 of the Consultation SOP without exception, and every non-converting consultation is
reviewed weekly.</p>`,
  },
];

const browser = await chromium.launch();
try {
  for (const doc of DOCS) {
    const page = await browser.newPage();
    await page.setContent(shell(doc.title, doc.body), { waitUntil: "networkidle" });
    const path = join(OUT, doc.file);
    await page.pdf({ path, format: "A4", printBackground: true });
    await page.close();
    console.log("wrote", path);
  }
} finally {
  await browser.close();
}
console.log("done — upload any of these on /knowledge");
