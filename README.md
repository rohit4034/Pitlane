# Pitlane — Task 3

No video is required for Task 3. Workflow exports are in `n8n/`; database setup is in `supabase/`. The sections below include historical local-development notes.

Pitlane turns a car enquiry into a ranked vehicle shortlist and an advisor brief. An authenticated n8n webhook fetches advertised Dubai listing snapshots through the live Supabase REST API, filters cars within budget, and saves a report before returning it. It is independent of the other assignment projects.

## Current Dubai demo and hosting status

Vercel UI: https://pitlane-plum.vercel.app — deployed and reachable. Production enquiry, persisted-report replay, and live NHTSA lookup were verified on 21 September 2026. Hosted n8n: https://rkportfolio.app.n8n.cloud.

The active shortlist now reads `market_listings` in Supabase: 50 real YallaMotor advertised-listing snapshots observed on 20 September 2026. Prices, mileage, make/model, year, and GCC specs come from the public Dubai results page. Body categories are model-based enrichment. This is a small demonstration snapshot, not a live scraper or confirmation that a car remains available. The source blocked direct automated retrieval with a browser challenge; no bypass is implemented.

Apply `supabase/003_market_listings.sql`, then run `npm run import:dubai` to reproduce the idempotent import. Original synthetic inventory remains in its separate table for historical tests; the active workflow uses only the imported market table. Browse **Dubai cars** to see persisted records and source links. Evidence: `evidence/dubai-import.json`, `evidence/dubai-catalog.png`, and `evidence/dubai-shortlist.json`.

Vercel serves `app/public` and the four `api/` functions. Configure `PITLANE_SUPABASE_URL` and `PITLANE_SUPABASE_SERVICE_KEY` as server environment variables. For workflow execution, also set `PITLANE_WEBHOOK_URL` to the hosted n8n production enquiry webhook and `PITLANE_WEBHOOK_SECRET` to the matching Header Auth credential value. Never use localhost as the deployed webhook URL. The catalog works independently; an unconfigured hosted workflow returns a clear setup message.

On hosted n8n, import the error, enquiry, and vehicle-lookup JSON files from `n8n/`. Rebind the Supabase Custom Auth and webhook Header Auth credentials, choose the imported error workflow in settings, and publish both webhook workflows. Keep the same Supabase project so existing reports and inventory remain visible. Vercel does not host the n8n process itself.

## Advisor app

Open **http://127.0.0.1:3080** to run enquiries through the n8n workflow. Start it with `npm run app` after `npm start`. Fill in the buyer details and select **Build shortlist**; the server invokes the authenticated production webhook, and n8n retrieves inventory and saves the report. The UI shows ranked vehicles, match reasons, priority, and next action. **Saved reports** opens the latest 50 persisted results; each brief can be printed or downloaded as JSON.

The app binds to localhost and is intended for this local demonstration. It has no separate user accounts; anyone with access to the local machine can access its reports. Secrets remain in the Node server. No frontend build or dependency installation is required. Run `npm run test:app` to verify the UI server → n8n → saved-history path. Run the app in a terminal and keep it open.

Evidence: [API integration checks](evidence/app-tests.json), [desktop UI](evidence/advisor-ui.png), [mobile UI](evidence/advisor-ui-mobile.png).

## NHTSA vehicle reference lookup

Enter a preferred make, then click **Look up models**. The app calls an authenticated n8n workflow that fetches actual reference models from [NHTSA vPIC](https://vpic.nhtsa.dot.gov/api/), normalizes and deduplicates them, and displays their source. No NHTSA API key is needed. Reference models do not indicate dealer stock, UAE availability, prices, or trim compatibility; lookup results do not change the inventory ranking. This integration implements make/model reference lookup, not VIN decoding.

Import [pitlane-vehicle-lookup.json](n8n/pitlane-vehicle-lookup.json), select the existing `Pitlane Webhook Secret` header credential, and publish it. Its endpoint is `POST /webhook/pitlane/vehicle-lookup` with `{"make":"BMW"}`. The app derives this endpoint from the configured n8n origin. If importing into an instance with different workflow IDs, select the imported error workflow in settings as well.

Flow: authenticated webhook → make validation → IF branch → public HTTP Request → normalized model list → explicit response. The API request has an eight-second timeout and two attempts separated by 500 ms. Invalid input returns 400; empty results return 200 with `no_results`; malformed responses and HTTP errors return 503. The independent enquiry workflow remains usable if reference lookup fails. NHTSA receives only the make, not customer names, notes, or credentials.

Run `npm run test:vpic`. [Live API evidence](evidence/vpic-tests.json) includes a real BMW result and validation checks; [browser screenshot](evidence/vpic-ui.png) shows the integrated UI. Browser verification also simulates lookup failure and then runs a successful inventory shortlist.

## Run the existing instance

The local editor is at http://127.0.0.1:5678. Its private login is in `.credentials/login.txt`; credentials are deliberately excluded from the submission. From this directory:

```sh
npm start
npm run test:database
npm run test:webhook
```

The production endpoint is `POST http://127.0.0.1:5678/webhook/pitlane/enquiry`, authenticated by `X-Pitlane-Webhook-Secret`. The tests load the secret from `.env` without printing it. Use the webhook test script as an executable request example. Publish the main workflow in the editor if the endpoint is not registered. `npm run stop` stops the instance while retaining its Docker volume.

## Reproduce on a fresh instance

Requirements: Docker Compose, Node.js 22 or later, and a separate Supabase project. The verified n8n image is pinned to **2.39.8** in `compose.yaml`. No npm dependencies are needed for the verification scripts.

1. Run [001_pitlane.sql](supabase/001_pitlane.sql), then [002_seed.sql](supabase/002_seed.sql) in your Supabase SQL editor. The seed contains seven fictional vehicles, five available. Do not run these scripts against an unrelated application's database.
2. Copy `.env.example` to `.env`. Set your project URL and server-side service-role key, its anonymous key for access tests, a random webhook secret, a random persistent n8n encryption key, and a strong owner password. Keep this file private. The service-role key is privileged; this demo uses a dedicated project, not a custom least-privilege integration role.
3. Replace `https://irltuonabpmnvqdikuvv.supabase.co` in both workflow JSON files with your project URL. The database verification script also guards against a different project: update its URL guard and evidence project label for your own project.
4. Run `npm start` and complete owner setup in the editor. Create a **Custom Auth** credential named `Pitlane Supabase` with JSON `{"headers":{"apikey":"YOUR_SERVICE_ROLE_KEY","Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}}`. Create a **Header Auth** credential named `Pitlane Webhook Secret`, header name `X-Pitlane-Webhook-Secret`, and your secret as its value.
5. Import [pitlane-errors.json](n8n/pitlane-errors.json), then [pitlane-enquiry.json](n8n/pitlane-enquiry.json). Bind the custom credential on every HTTP node and the header credential on the webhook. In main-workflow settings, select the imported error workflow. Publish the main workflow.
6. Run the two test commands above. Inspect executions in n8n, the `enquiry_reports` table in Supabase, and the generated evidence files.

The local `credentials` and `import` npm scripts are convenience tools for the existing project and private credential files. Manual credential setup above works without those files or Supabase CLI access. `connect:stockroom` is an experimental integration helper, outside this verified standalone handoff; do not run it for the seeded demonstration.

## Request and output

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

Required fields are `request_id`, `customer_name`, `budget_aed`, and `purchase_timeline`. Supported timelines are `this_week`, `within_30_days`, `within_90_days`, and `researching`. Optional body types are `SUV`, `Sedan`, `Coupe`, `Hatchback`, `Pickup`, and `Van`. Amounts are AED. Notes are stored as text and do not alter scoring.

HTTP 200 returns `ok`, `replay`, and a persisted `report` containing preferences, up to three vehicles, match reasons, priority, advisor brief, and fetched/completed timestamps. HTTP 400 indicates invalid input; 403 indicates missing/incorrect webhook authentication; 202 means the request is already processing; 409 means the ID was reused with different normalized input; 503 means enrichment or persistence failed. Repeat a request with the same ID and payload to retrieve its stored report. The advisor UI automatically generates a new ID when submitted enquiry details change, while preserving the ID for unchanged retries. If a manually supplied ID conflicts with an older enquiry, the UI prepares a fresh ID and asks you to submit again.

## Node walkthrough

| Node | Purpose |
| --- | --- |
| Webhook — Enquiry | Authenticated POST with explicit response nodes. |
| Code — Validate and Normalize | Normalize whitespace, validate required fields, form a canonical payload. The database hashes this payload with SHA-256. |
| IF — Valid Input | Invalid input returns 400 before any database request. |
| HTTP — Claim Enquiry RPC | Atomically acquire a 90-second lease and unique worker token. |
| Switch — Claim Status | Return saved report, 202, or 409; newly claimed work continues. |
| HTTP — Fetch Live Inventory | Fetch available seed inventory through a real HTTP request. |
| Code — Filter and Rank | Enforce budget, score requested make/body type, rank and explain matches, generate the advisor brief. |
| IF — Inventory Valid | Reject malformed or capped inventory with 503. |
| HTTP — Finalize Report RPC | Persist the report and complete the claim transactionally, checking the worker token and lease. |
| Respond nodes | Return saved output or an explicit handled failure. |
| Error Trigger → Sanitize → HTTP log | Supplementary unexpected-error workflow writes a generic error and execution ID to `workflow_errors`. |

Ranking awards two points for make and one for body type, then sorts by price, mileage, and stock number. Alternatives may accompany an exact match and are labeled per vehicle. Priority is high for `this_week` or any exact match, medium for other `within_30_days` enquiries, otherwise low. It is a demo follow-up rule, not credit scoring.

## Verification evidence

- [Actual successful webhook response](evidence/success-response.json): BMW X1 first for the sample BMW SUV enquiry; only affordable, available vehicles included.
- [Webhook checks](evidence/webhook-tests.json): authentication, invalid input, persisted success, replay, conflict, no match, and simultaneous duplicates.
- [Database checks](evidence/database-tests.json): real inventory, anonymous-access denial, atomic claims, persistence, and conflict handling.
- [Import record](evidence/n8n-import.json): workflow and credential names only, without secrets.

The sample response is actual execution evidence and satisfies the assignment's screenshot-or-sample requirement. The submission option is the exported workflows plus SQL and these instructions; the running instance is local, not publicly hosted. Tests create fictional enquiry reports; database-only fixtures are cleaned up.

## Reliability limits and remaining optional work

HTTP nodes use three attempts with fixed one-second delays and ten-second request timeouts. Retries currently apply to all HTTP failures, including permanent errors; they do not honor Retry-After or implement exponential backoff. A path traversing all three HTTP nodes can approach 96 seconds, and late finalization can exceed the 90-second claim lease and return 503. Failed work becomes recoverable through lease expiration; a lost successful response is recovered by replay.

Inventory retrieval is capped at 1,000 rows and fails explicitly at that cap. There is no pagination or reusable inventory sub-workflow. The unexpected-error logger is configured, but injected outage/error-trigger tests and clean-instance reimport have not been verified. Local error branches are present on each HTTP node and invalid inventory; they return 503 instead of a false empty-stock report.

Input validation still truncates some long text, ignores unknown fields, and does not reject a supplied non-AED currency field. Clients must follow the documented AED contract. Case-insensitive matching does not imply case-insensitive request replay: canonical preferences retain case. These are gaps against the broader original plan, not completed features.

See [task3.md](task3.md) for the assignment checklist and [task3-plan.md](task3-plan.md) for the original design and remaining work.

Dataset expanded to 50 unique source-linked listings on 20 September 2026. Prices and mileage were extracted from public search-result pages; some responses were cached, so this is not current-availability verification. See `evidence/dubai-50-verification.json` for the deployed catalog count. Scheduled fetching remains pending a reliable automated source.

The preferred-make selector is populated from the persisted Dubai catalog, so every offered make has listings. Historical reports requesting an absent make display an explicit notice and label other-make cars as alternatives.
