# Task 3: End-to-end n8n automation

## What to build

Automate a real task end-to-end. Include branching, transformation, and an output someone would actually want; fetching a URL and printing it is insufficient.

Suggested ideas from the brief:

- Topic news digest: collect news/RSS, deduplicate, score relevance, summarize with an LLM, and deliver a daily email or Slack digest.
- Price/availability watcher: poll an API or scrape, compare against a saved threshold, alert on changes, and log history to Google Sheets.
- Job/listing aggregator: gather listings, filter, enrich, rank, and produce a report.
- Repository activity report: categorize GitHub events and post a weekly summary.
- Lead enrichment pipeline: receive a webhook, enrich through an external API, score, save to a sheet or CRM, and notify.

Bonus opportunities: LLM summarization/classification, merging multiple sources, reusable sub-workflows, retry/backoff, and idempotency so reruns do not create duplicates.

Implementation plan: [task3-plan.md](task3-plan.md).

## Core requirements — all required

- [x] **Trigger:** Schedule/cron, webhook, or manual trigger.
- [x] **External data:** At least one real API call through an HTTP Request node, or a scrape.
- [x] **Transformation:** Reshape data using Code/Function, Set, Item Lists, Aggregate, Date/Time, or equivalent nodes.
- [x] **Conditional logic:** Include IF/Switch branching and/or a loop.
- [x] **Error handling:** Deliberately handle failures through an error-trigger workflow or continue-on-failure with a handled branch. A bad API response must not quietly kill the run.
- [x] **Delivered, verifiable output:** Email, Slack/Discord, Google Sheets/Notion, a generated report/PDF, or a webhook response that reviewers can inspect.

## Optional bonus checklist

These are bonus opportunities, not mandatory advanced requirements.

- [ ] LLM/AI summarization or classification.
- [ ] Merge two or more data sources.
- [ ] Reusable sub-workflow.
- [x] Retry/backoff on flaky calls.
- [x] Idempotent reruns without duplicate outputs.

## Resources

- n8n Cloud — automation platform; free trial as stated in the assignment. Verify current availability and terms before provisioning. The supplied resource entry did not include a destination URL.

## Submission

Provide one execution option:

- [ ] **Preferred:** A live n8n instance with access credentials so reviewers can open and run the workflow.
- [x] **Alternative:** Exported workflow JSON plus all dependencies and instructions needed to import and run it.

Also required:

- [x] **README.md:** Purpose, node-by-node walkthrough, setup and credential placeholders, execution instructions, verification steps, and a screenshot or sample from a successful run.

## Documentation requirements

- [x] **What and why:** What the workflow does and why it is useful.
- [x] **Node-by-node walkthrough:** Significant nodes and how data flows between them.
- [x] **Setup and credentials:** Required API keys/connections and setup instructions; use placeholders, never real secrets.
- [x] **How to run:** Manual execution, webhook request, or schedule instructions as applicable.
- [x] **How to verify:** Exactly what output appears and where, with a screenshot or sample from an actual successful run.

This task's supplied submission requirements do not separately require a video or BUILD_LOG.md. Either may be included as an optional supporting artifact.

## Verification status — 20 September 2026

The local n8n 2.39.8 instance and dedicated Supabase backend have successful execution evidence in `evidence/`. Error handling is implemented with explicit 503 branches; outage injection remains unverified. Retries use fixed delays. See README for reproducible setup and the limitations against the original plan.

## Advisor app checklist

- [x] Local enquiry form connected to the authenticated n8n production webhook.
- [x] Ranked vehicle cards, match explanations, priority, and advisor brief.
- [x] Saved report history loaded from Supabase.
- [x] Print and JSON-download actions.
- [x] Server-only credentials and localhost binding.
- [x] Responsive desktop/mobile layout.
- [x] Browser-verified enquiry submission, saved-history navigation, and mobile layout; screenshots in `evidence/`.

## NHTSA integration checklist

- [x] Authenticated n8n workflow performs a real NHTSA vPIC HTTP request.
- [x] Make validation, normalized model list, and handled failure branches.
- [x] Advisor UI lookup with source attribution and reference-only labeling.
- [x] Live BMW lookup, unknown make, invalid input, malformed response, and authentication checks.
- [x] Lookup remains independent of inventory shortlist execution.

- [x] Browser-verified automatic request-ID renewal for edited enquiries and unchanged-request replay (`evidence/edited-enquiry-tests.json`).

## Dubai data and deployment checklist

- [x] Real Dubai listing snapshots imported idempotently into a separate Supabase table.
- [x] Catalog renders persisted prices, mileage, and source links.
- [x] n8n ranks imported listings and persists the delivered report; browser verified.
- [x] Snapshot dates and advertised-status limitations shown explicitly.
- [x] Vercel-compatible static UI and server API functions prepared.
- [x] Vercel UI production deployment verified: https://pitlane-plum.vercel.app (HTTP 200).
- [x] Vercel server credentials configured after user authorization; credentials remain server-only.
- [x] Hosted n8n connected and production end-to-end execution verified (21 September 2026): enquiry returns a persisted report, identical replay returns the stored report, and BMW lookup returns real NHTSA models. See [production audit](evidence/checklist-production-audit.json).
- [ ] Live YallaMotor synchronization (not claimed; direct retrieval blocked).

- [x] Expanded Dubai snapshot dataset to 50 complete, unique, source-linked records.

- [x] Make selector uses persisted catalog makes only; missing-make reports explicitly name the missing make and label other makes as alternatives. Browser verified.

## Submission package

- [x] Focused [submission folder](submission/README.md) and `pitlane-task3-submission.zip`: three sanitized workflow exports, database setup, snapshot data/import script, placeholder configuration, run instructions and actual successful-run evidence. No video is required or included. JSON parsing, connection references and secret-pattern checks pass; clean-instance reimport remains unverified.
