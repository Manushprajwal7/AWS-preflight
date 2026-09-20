# Building Preflight: Why We Built a Deterministic-First Amazon Appeal Validator on AWS

*How client-side privacy, an edge-hosted static frontend on AWS Amplify, and a painful false-rejection bug shaped our approach to automated compliance pre-screening.*

---

## 1. The 4-Minute Rejection Trap

When an Amazon seller receives an account suspension notification, the panic is immediate and palpable. Payout disbursements freeze, inventory stranded in fulfillment centers accumulates storage fees, and the seller's entire revenue stream evaporates overnight.

To regain access, Amazon requires a **Plan of Action (POA)** demonstrating:
1. The root cause of the violation.
2. The immediate corrective actions taken.
3. The systemic preventive measures instituted to ensure it never happens again.

Faced with existential dread, sellers rush to submit an appeal. They write defensive arguments (*"A buyer lied about our product"*), make future-tense promises (*"We will be more vigilant going forward"*), or threaten legal action (*"I am speaking to my attorney"*). 

Four minutes later, an automated response arrives:  
> *"We received your submission, but do not have enough information to reactivate your account at this time."*

Amazon rarely explains *why* the appeal failed. Each rejected attempt lowers the seller's internal standing and edges them closer to permanent termination. Sellers pay third-party consultants upwards of \$2,500 to rewrite simple letters, or they waste their limited appeal attempts on unforced structural errors that automated classifiers reject in seconds.

We built **Preflight** to solve this: an instant, private pre-flight checker that evaluates an appeal *before* submission, flagging fatal flaws and providing concrete rewrites.

---

## 2. The Architectural Dilemma: LLM vs. Deterministic Rules

When modern engineers set out to solve text evaluation, the knee-jerk reaction is simple: *"Send the prompt to an LLM."*

We rejected this pure-LLM approach for two fundamental reasons:

### Reason A: The Privacy Trust Boundary
Suspended sellers handle highly confidential operational data: distributor agreements, wholesale commercial invoices, unreleased ASIN listings, and customer order records. Asking a panicked business owner to paste sensitive documents into a third-party backend with an unknown data retention policy is a non-starter.

### Reason B: Deterministic Reliability & Demo Robustness
Appeals fail on unambiguous, binary disqualifiers:
- Did you use the word *"glitch"* or *"system error"* to explain an inventory defect? **(Root cause blame)**
- Did you write *"we will remove the inventory"* instead of *"we removed 42 units under Removal Order #98124"*? **(Future promise vs. completed action)**
- Did you forget to specify a weekly audit cadence or assign a managerial role? **(Lack of systemic prevention)**

Running a 70-billion-parameter model to detect whether a user included an invoice number or threatened to sue Amazon is wasteful, non-deterministic, and introduces latency, rate limits, and failure modes during critical triage.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT BROWSER                                    │
│                                                                                  │
│  ┌───────────────────────┐                  ┌─────────────────────────────────┐  │
│  │   Plan of Action      │                  │          Verdict Card           │  │
│  │   Editor & Controls   │                  │   [ WOULD BE REJECTED: 13/100 ] │  │
│  └──────────┬────────────┘                  └────────────────┬────────────────┘  │
│             │                                                ▲                   │
│             │ Live input (400ms debounce)                    │ Score &           │
│             ▼                                                │ Findings          │
│  ┌───────────────────────────────────────────────────────────┴────────────────┐  │
│  │                    rubric.js — Deterministic Rule Engine                   │  │
│  │  • Section Detection (Line headers + inline regex fallback)                │  │
│  │  • 7 Weighted Rubric Dimensions                                            │  │
│  │  • Critical Disqualifier Override (Capped at 49)                           │  │
│  │  • 100% Client-Side Privacy — Zero Server Runtime Dependency               │  │
│  └───────────────────────────────────────────┬────────────────────────────────┘  │
│                                              │                                   │
└──────────────────────────────────────────────┼───────────────────────────────────┘
                                               │
   ═══════════════════════════════════ TRUST BOUNDARY ══════════════════════════════
   POA text NEVER leaves the browser unless the user explicitly clicks "Get AI opinion"
                                               │
                                               │ (Optional: Explicit click only)
                                               ▼
                           ┌────────────────────────────────────────┐
                           │          AWS Lambda Function           │
                           │     (Function URL + CORS Enabled)      │
                           └───────────────────┬────────────────────┘
                                               │ Prompt fences POA as untrusted data
                                               ▼
                           ┌────────────────────────────────────────┐
                           │             Amazon Bedrock             │
                           │              Converse API              │
                           │     (Seller Performance Investigator)  │
                           └────────────────────────────────────────┘
```

### The Two-Engine Compromise
Instead of choosing between brittle regexes or black-box LLMs, Preflight implements a **two-engine model**:
1. **Engine 1 (Deterministic, 100% Client-Side):** A pure JavaScript rubric scoring 7 weighted dimensions (Specificity, Past Actions, Systemic Prevention, Tone, Invoices, Structure, Length). If any critical disqualifier triggers, the score is hard-capped at 49 (*WOULD BE REJECTED*). This runs in under 3 milliseconds directly in the user's browser with zero network calls.
2. **Engine 2 (Amazon Bedrock Converse API, Optional):** If and only if the seller explicitly requests a qualitative second opinion, the text is dispatched to an AWS Lambda function that invokes Amazon Bedrock using the Converse API. Crucially, the untrusted POA text is fenced in `<poa>` tags to protect against prompt injection.

---

## 3. The War Story: The False-Rejection Bug That Almost Sunk Us

During early testing, we uncovered a critical design flaw in our specification that would have destroyed the product's credibility.

### The Spec Error
Our product requirements document originally marked `STRUCT_NO_SECTIONS` (missing the standard 3-part section headers: *Root Cause*, *Corrective Actions*, *Preventive Measures*) as a `critical` severity finding.

Under our rubric rule:
$$\text{If any finding is } \mathbf{critical} \implies \text{Score} = \min(\text{Score}, 49) \text{ ("WOULD BE REJECTED")}$$

### The Failure Case
We tested the system against a genuinely strong appeal: a seller had identified a specific distributor defect, provided exact removal order IDs, cited commercial invoice dates, and implemented a recurring weekly audit with a named operations manager. However, they wrote it as **three well-crafted paragraphs without bold section headers**.

The result?
```
Score: 49 / 100 — "WOULD BE REJECTED"
Reason: STRUCT_NO_SECTIONS (critical)
```

The system gave a lethal false rejection to an otherwise exemplary appeal.

### The Fix: Distinguishing Formatting from Disqualification
Missing headings is a formatting defect, not an operational failure. Structure is already weighted at 10% and already deducts 70 points from the structure dimension. Making it *also* a critical disqualifier double-counted the penalty and produced an absurd verdict.

We took two corrective engineering steps:
1. **Severity Demotion & Calibration:** We demoted `STRUCT_NO_SECTIONS` from `critical` to `high`. However, allowing an unsectioned appeal to score 81 ("LIKELY TO PASS REVIEW") overshot in the opposite direction—Amazon explicitly mandates three labeled sections. We therefore calibrated the band: when all three section headings are absent (`hasHeadings === false`), the score is capped at **74 ("AT RISK")**. This avoids the false rejection of 49 while honestly communicating that unformatted appeals are at risk of triage failure.
2. **Inline Heading Detection:** In the real world, Amazon sellers frequently copy and paste appeals from Seller Central ticket forms that strip line breaks, resulting in prose like:
   ```text
   Root Cause: our supplier verification failed. Corrective Actions: we removed 120 units. Preventive Measures: weekly inventory audits.
   ```
   Our original line-based parser missed this entirely. We added a global inline regex fallback in `detectSections()` that matches inline headers, extracts offsets, and parses sections with a 0.9 confidence factor.

We locked these behaviors into our automated test suite (`test_edge.js`), ensuring our scoring engine remains resilient to real-world edge cases.

---

## 4. Deploying to AWS Amplify in Under Two Minutes

One of our core goals was operational simplicity. Preflight is built with vanilla HTML5, modern CSS custom properties, and modular ES6 JavaScript. There is no Webpack, no Vite bundling step, and no `node_modules` dependency tree.

This architecture is uniquely suited for **AWS Amplify Hosting**:

1. **Standalone Packaging:** Preflight includes a built-in browser-based PKZIP packager. Clicking **"Amplify .zip"** in the top bar instantly compiles and downloads `preflight-amplify.zip` directly in memory.
2. **Deploy Without Git:** In the AWS Amplify Console:
   - Choose **Deploy an app without a Git provider**.
   - Provide an app name (`preflight-poa`).
   - Drag and drop `preflight-amplify.zip`.
3. **Instant Global Edge CDN:** Within 90 seconds, AWS Amplify provisions an SSL certificate and distributes the app across CloudFront edge locations worldwide.

No build containers, no CI/CD pipeline breakage, zero server maintenance costs.

---

## 5. Key Takeaways for Cloud and AI Builders

1. **Put the Trust Boundary in Front of the User:** If your application processes sensitive business or legal documents, default to client-side local computation. Only cross the wire when the user explicitly requests cloud intelligence.
2. **Don't Use an LLM for What Pure Code Does Better:** Deterministic rules are auditable, lightning-fast (sub-5ms), and free to run. Use deterministic logic for structural baseline checks and reserve foundation models for qualitative synthesis.
3. **Guard Against Spec-Induced False Positives:** When defining scoring thresholds, always test against edge cases that break your formatting assumptions. A rigid validator that rejects good work is worse than no validator at all.
4. **Be Honest in Your Architecture:** If an AI service is optional or unconfigured, tell the user clearly. Never fake network latency or mock model outputs behind simulated delays. Real engineering speaks for itself.
5. **Design for Trust and Accessibility (Best UI Track):** High-stakes business tools don't need dark, flashy cyberpunk themes. Sellers facing suspension want clean, reassuring interfaces. Adopting Amazon's tonal language with strict non-impersonation, rigorous WCAG 2.1 AA contrast ($\ge 4.5:1$ across all states), and reserved semantic status colors creates immediate cognitive clarity and operational confidence.

---

*Preflight was built for the AWS First Commit Hackathon. Check out the project repository, review our edge test suites, and deploy your own instance via AWS Amplify Hosting.*
