# Task 3: Pitlane implementation plan

Assignment: [task3.md](task3.md).

Status (20 September 2026): standalone main and error workflows are implemented and imported into local n8n 2.39.8, with a dedicated Supabase backend and successful execution evidence. See README.md and evidence/ for the tested implementation. This document preserves the broader original design; unchecked items include partially implemented work and unverified targets. Reusable inventory sub-workflow, selective retries, strict input validation, fault injection, and clean-instance verification remain outstanding.

## Product direction

**Pitlane:** Turn an incoming car enquiry into a ranked vehicle shortlist and a clear next-action brief for a sales advisor.

Example: a buyer asks for a BMW SUV under AED 150,000 and plans to purchase this month. The workflow validates the enquiry, fetches inventory through a real HTTP API call, filters available vehicles, ranks suitable matches, assigns a transparent follow-up priority, saves a report, and returns it to the caller.

This complements Task 1's customer experience and Task 2's operations dashboard, while remaining independently runnable. It uses fictional enquiries and a seeded demonstration inventory, not real ALBA systems or customer data.

**Primary output:** A structured webhook response with a human-readable advisor brief, backed by a durable report record. A readable report can be produced from the returned data for the demo. Email/Slack delivery is optional and requires a configured destination before implementation; the core flow has no outbound messaging dependency.

## Scope and dependencies

- n8n Cloud or a reproducible local n8n instance; document the exact tested version and node versions.
- A standalone Supabase database exposed through its REST/RPC API, with checked-in SQL and a synthetic inventory seed.
- A real **HTTP Request** node retrieves inventory from Supabase. Seed data is synthetic, but the runtime API request is real; do not replace it with pinned node data in verification runs.
- The assignment lists n8n as a resource, not an exclusive external API list. Supabase provides relevant inventory enrichment without scraping a dealership or inventing vehicle facts.
- Three bonus targets: reusable sub-workflow, bounded retry/backoff, and persistent idempotency.
- Optional later: LLM-generated phrasing or intent classification. Deterministic scoring and templates are sufficient for the initial release.
- No live vehicle valuations, finance eligibility, auto-contacting buyers, or claims that a suggested car is reserved.

## Input contract

Authenticated `POST` webhook with a request ID supplied by the caller. The demo uses AED only.

```json
{
  "request_id": "demo-enquiry-001",
  "customer_name": "Demo Buyer",
  "preferred_make": "BMW",
  "body_type": "SUV",
  "budget_aed": 150000,
  "purchase_timeline": "within_30_days",
  "notes": "Prefer lower mileage"
}
```

Required: request_id, customer_name, positive budget_aed, and purchase_timeline from an allowed enum. Make/body type are optional preferences; notes are bounded text and never code or executable instructions. No phone/email is needed for an advisor report.

Normalize whitespace and case, validate size/ranges, reject unsupported fields or currencies as documented, and build a canonical payload hash. The same request ID with a different normalized payload is a conflict, not a silent overwrite.

## Workflow and node walkthrough

| Step / node | Responsibility and branches |
| --- | --- |
| 1. Webhook | Accept authenticated POST; use Respond to Webhook mode |
| 2. Code — Validate and normalize | Produce canonical input, validation errors, payload hash, correlation ID |
| 3. IF — Valid input? | Invalid input → explicit 400 response; valid input → claim request |
| 4. HTTP Request — Claim RPC | Atomically claim request_id; distinguish new, complete, in-progress, conflicting, or reclaimable failed work |
| 5. Switch — Claim status | Completed → stored response; processing → 202; conflicting payload → 409; newly claimed → enrichment |
| 6. Execute Sub-workflow — Fetch inventory | Reusable HTTP fetch/validation with bounded retry and an explicit success/error envelope |
| 7. IF — Inventory fetch succeeded? | Exhausted upstream failure → persist failure if possible and return retryable 503; never report an outage as zero stock |
| 8. Code — Filter and rank | Filter sold/reserved/unaffordable vehicles, rank eligible matches, keep top three with reasons |
| 9. Switch — Match outcome | Exact matches, alternatives needing advisor review, or no match |
| 10. Code / Edit Fields — Advisor brief | Produce priority, reasons, shortlist, data timestamp, and suggested next action |
| 11. HTTP Request — Finalize RPC | Atomically save report and mark claim completed using claim token |
| 12. Respond to Webhook | Return persisted result; saving failures return an explicit error rather than success |

All handled branches terminate with one response. Keep the synchronous request budget short and document it; longer backoffs should produce a retryable response instead of outliving the webhook timeout.

An Error Trigger workflow records unexpected execution failures with a correlation ID. It supplements local error branches; it cannot retroactively replace a webhook response. Verify behavior on the chosen n8n version, including differences between manual and production executions.

Official references: [Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/), [Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/), [error handling](https://docs.n8n.io/flow-logic/error-handling/).

## Matching and priority rules

- Only available stock is eligible. Budget is a hard ceiling; never suggest a more expensive vehicle as within budget.
- Prefer requested make and body type; use mileage and price as documented tie-breakers. Use stable IDs as the final tie-breaker for reproducible results.
- If exact preferences have no match, return within-budget alternatives with an explicit explanation of which preference differs. Never hide that distinction.
- If no vehicle is within budget, return a valid no-match report and an advisor action to clarify flexibility; do not fabricate stock.
- Follow-up priority is a transparent business rule based on stated purchase timeline and match availability, not an assessment of creditworthiness or personal traits.
- Keep priority separate from match quality. Include human-readable reasons for both.
- Include stock ID, model, price, mileage, and inventory fetched-at time in each shortlist. Label the dataset as demonstration inventory.

## Persistent state and idempotency

Versioned SQL creates a minimal independent backend:

| Table | Important fields |
| --- | --- |
| inventory | id UUID PK, stock_number unique, make, model, body_type, model_year, mileage_km, asking_price_aed numeric, status, updated_at |
| enquiry_runs | request_id text PK, payload_hash, status, claim_token UUID, lease_expires_at, attempt_count, created_at, updated_at, sanitized_error |
| enquiry_reports | request_id PK/FK to enquiry_runs, normalized_preferences JSONB, shortlist JSONB, priority, reasons JSONB, advisor_brief, fetched_at, completed_at |

Use database constraints for amounts, stock status, and request state. SQL RPCs claim and finalize work transactionally; a read-then-insert sequence in separate n8n nodes is not sufficient against concurrent requests.

- Unique request_id prevents duplicate report records.
- An atomic claim grants one worker a lease and token. An expired/failed claim can be retried; a stale worker cannot finalize after another worker acquires the claim.
- Repeated completed requests return the saved report without fetching inventory or generating another result.
- Response loss after successful finalization is safe: the next attempt retrieves the persisted report.
- Upstream failure does not mark a request completed. If the database is unavailable, return an error and rely on lease expiration for recovery.
- This guarantees report-record deduplication, not exactly-once email delivery. If messaging is added, design and test a separate outbox/delivery strategy before claiming notification idempotency.

Keep database credentials in n8n's credential store. Prefer a dedicated least-privilege integration role with inventory read and constrained RPC execution; deny anonymous access to enquiry data. Do not reuse Task 2's browser credentials or bypass its user-isolation model. Document any privileged setup role separately.

## Reusable inventory sub-workflow

Input: validated preferences and correlation ID. Output: either validated inventory plus fetched_at, or a structured failure with retryability and upstream status.

- Use HTTP Request with explicit timeout and fixed, configured host.
- Retry transient network errors, 429, and 5xx only, with bounded attempts and waits. Respect Retry-After within the overall request budget.
- Implement exponential backoff explicitly if used; do not label fixed-delay retries as exponential.
- Handle invalid credentials and malformed payloads without blind retries.
- Check pagination and fetch all relevant candidate pages within a documented cap; never silently rank only an arbitrary first page.
- Separate empty inventory from API failures.
- Export this workflow and document import order and sub-workflow ID rebinding.

## Implementation phases

### 1. Contracts and fixtures

- [ ] Confirm folder, n8n hosting choice, output format, input contract, and deterministic rules.
- [ ] Create synthetic inventory/enquiry fixtures covering exact, alternative, and no-match cases.
- [x] Define database schema, RPC contracts, credential roles, and response schemas.

### 2. Backend and workflow foundation

- [ ] Provision schema and seed with a repeatable command; document credentials as placeholders.
- [ ] Implement and test atomic claim/finalize RPCs including concurrent duplicates and expired leases.
- [x] Build authenticated webhook, normalization, validation, branching, and persisted response path.

### 3. Enrichment and advisor report

- [ ] Build reusable inventory HTTP sub-workflow with actual remote requests.
- [ ] Implement ranking, priority explanations, and exact/alternative/no-match branches.
- [x] Generate and persist an advisor brief that can be understood without reading node execution data.

### 4. Reliability and verification

- [x] Implement local handled error branches and unexpected-error workflow.
- [ ] Test bounded retries, malformed inventory, database failures, and interrupted executions.
- [x] Verify exact duplicate requests return the same stored report and do not create another row.
- [x] Verify changed payload with the same ID returns 409 and simultaneous duplicates have one final report.
- [ ] Validate authentication failure and sanitized logs; no secrets in exported JSON or screenshots.

### 5. Export and handoff

- [ ] Export main, reusable, and error workflows; remove secrets and pinned personal data.
- [ ] Include SQL migrations, seed, sample request files, environment/credential placeholders, and execution commands.
- [ ] Import into a clean instance, reconnect credentials/sub-workflows, and run without editor-only pinned data.
- [x] Write README with node walkthrough, setup, manual/webhook execution, troubleshooting, and exact expected output locations.
- [x] Capture a sanitized sample response and screenshot from an actual successful execution, linked by request ID.
- [x] Provide live instance access if available; otherwise a complete runnable JSON package satisfies the submission option.
- [x] Tick verified requirements in task3.md. Optional build log/video may support the handoff but are not required by this brief.

## Verification matrix

| Scenario | Expected result |
| --- | --- |
| Valid exact match | 200, ranked shortlist, explanation, one persisted report |
| Preferences unmatched | 200, clearly labeled within-budget alternatives |
| No affordable inventory | 200, no-match brief and next action |
| Missing/invalid input | 400, field errors, no inventory fetch/report |
| Missing/wrong webhook credential | Authentication rejection, no processing |
| Same ID and payload twice | Same report, one database record |
| Same ID, different payload | 409, original report unchanged |
| Two simultaneous identical requests | One active claim; other gets 202 or completed result |
| Inventory 429/5xx/timeout | Bounded retry; 503 if exhausted; not a no-match response |
| Invalid inventory response | Handled data error, no fabricated shortlist |
| Persistence unavailable | Error response, no success claim; recoverable retry |
| Crash or lost response | Lease recovery or retrieval of completed report, no duplicate record |

Expected output schemas and fixtures are not execution evidence. Replace illustrative examples with actual sanitized run artifacts before submitting.

## Estimate and optional extensions

| Phase | Estimate |
| --- | --- |
| Contracts, fixtures, backend setup | 2–3 hours |
| Core workflow and matching | 3–4 hours |
| Idempotency, retries, failure handling | 3–5 hours |
| Verification, documentation, clean import | 2–4 hours |
| **Total** | **10–16 hours** |

Optional LLM node: summarize only validated shortlist facts, require structured output, validate stock IDs/prices against source data, treat enquiry text as untrusted, and fall back to the deterministic brief. This adds credentials/cost and testing; do not make it a dependency of the core demonstration.

## Advisor app extension — 20 September 2026

Implemented a dependency-free Node server and responsive advisor UI in `app/`, running at http://127.0.0.1:3080. The UI calls the existing n8n webhook through a server-side proxy, displays the persisted shortlist, loads report history, and supports print/JSON export. See README for startup and evidence. Remaining unchecked original-plan items are intentionally not represented as complete.

## NHTSA reference lookup extension

- [x] Separate authenticated n8n workflow for make/model reference lookup.
- [x] UI integration, reference-data labeling, bounded HTTP calls, and handled failures.
- [x] Published locally and verified against the live NHTSA API; see `evidence/vpic-tests.json`.

This adds public reference data alongside the Supabase inventory. It does not yet implement VIN decoding or merge specifications into persisted shortlist records.

## Dubai snapshot and Vercel extension

- [x] Imported 50 source-linked real Dubai listing snapshots into Supabase.
- [x] Updated active inventory fetch and advisor UI to use those records.
- [x] Verified catalog → n8n ranking → persisted report in a browser.
- [x] Prepared Vercel functions and static deployment configuration.
- [x] Vercel UI deployed and verified at https://pitlane-plum.vercel.app.
- [ ] Configure approved server credentials and verify separately hosted n8n integration.

The demo snapshot supersedes synthetic shortlist stock; synthetic rows remain for original database fixture tests. This is not live scraping. Hosted n8n URL and credential configuration are pending user setup.
