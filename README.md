# Capacity Planning for Claude Code

Know which server group is over its reserve limit, which workload needs fresh measurements and which change still lacks evidence. Keep capacity, demand windows, sizing proposals and follow-ups in a database you own.

## Three ways to own it

- **Do it yourself:** free, MIT licensed. Use Claude Code, Codex, OpenCode or Cursor. Hosting and your agent subscription are separate.
- **We customise it:** Enterprise DNA brings your IBM Turbonomic history across, adds your capacity policies and builds the connections, web front end or different stack you need. One setup fee, then a retainer.
- **We run it for you:** Omni by Enterprise DNA installs it, connects your systems, manages access and backups, and prepares the weekly capacity review. One setup fee, then a retainer.

[Book a 30-minute call with Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=ibm-turbonomic).

## Quick start

Node 20 or newer. No cloud account required.

```sh
npm install
npm test
npm run demo
npm run capacity -- capacity-review
npm run capacity -- sizing-review --json
npm run view
npm run docs
```

Open this folder in your agent and ask for /weekly-review. The synthetic demo includes a cluster above reserve limits, an overdue proposal, an old measurement and a workload with no measurement. Reseeding preserves edits. Never seed a real database. Use a new DATA_DIR for an empty local database; set DATABASE_URL for shared PostgreSQL instead of local PGlite.

## What you own

A periodic capacity review desk, not the complete Turbonomic engine. It records clusters, workloads, measurement evidence, proposals, decisions, outcomes, imported action history and assigned follow-ups. It does not discover machines, collect telemetry, stitch topology, execute changes, schedule containers, simulate placement or price cloud commitments. Keep the monitoring and control systems needed for those jobs until your custom replacement is connected and tested.

The weekly rituals are capacity review, sizing review, stale data, change review and evidence checks. Three branded read-only views and two document types turn the records into a weekly brief and a change record. brand.json sets the name, colours and logo.

## The calculation

Cluster headroom equals floor(allocatable capacity × (100 minus reserve percent) / 100) minus active allocations. CPU capacity and workload CPU use the same allocatable-unit basis. Do not compare physical core counts with overcommitted vCPU allocations. Memory uses GiB. Negative headroom means allocated resources exceed your reserve policy, not that a server is necessarily overloaded.

A sizing candidate uses ceil(p95 absolute demand / 0.70), minimum one CPU unit or GiB. The latest window must end within seven days and cover at least fourteen days. The operator verifies measurement coverage. A p95 value alone does not cover every peak, resilience constraint, latency target or vendor minimum. No suggestion guarantees performance. Critical workloads are labelled for review. Proposal creation rejects values below the measured floor; business constraints can justify a larger size.

A proposal freezes the old allocation, measurement and rollback plan. Another reviewer label records a decision, evidence and an impact review. Newer or stale measurement evidence blocks approval. A verified outcome updates the recorded allocation only after the operator supplies external change and validation evidence. Failed or cancelled outcomes leave it unchanged. The software never touches a running server.

## Commands

| Command | Job |
|---|---|
| /help | Read supported commands and flags. |
| /clusters | Read cluster capacity, reserve and inventory evidence. |
| /workloads | Read workload allocations and owners. |
| /capacity-review | Compare allocated capacity with headroom after reserve. |
| /sizing-review | Review measured demand against recorded allocations. |
| /stale-data | Find missing, stale or short measurement windows. |
| /change-review | Review proposed changes, decisions and outcomes. |
| /compliance | Check decisions, validation records and evidence freshness. |
| /actions-due | Review overdue and next-week follow-ups. |
| /source-actions | Read original imported Turbonomic actions. |
| /activity | Read recorded mutations and actor labels. |
| /workload | Read one workload, its observations and change history. |
| /add-cluster | Record a cluster and its allocatable capacity. |
| /review-cluster | Update measured capacity and its evidence. |
| /add-workload | Record a workload and its current allocation. |
| /record-observation | Record a measured p95 demand window. |
| /propose-change | Propose a new allocation with evidence and rollback instructions. |
| /decide-change | Record approval or rejection with an impact review. |
| /record-outcome | Record an externally performed change and verification result. |
| /log-action | Assign a follow-up and due date. |
| /close-action | Record a follow-up resolution. |
| /import | Import an IBM Turbonomic action export atomically. |
| /export | Export all records and original imports to a private snapshot. |
| /weekly-review | Draft Monday review from capacity, stale data, changes and follow-ups. |
| /draft-change | Draft a branded change record for review. |
| /customise | Add a field or rule with a tested migration. |
| /new-view | Add a branded read-only view. |

25 executable commands, 27 slash-command recipes. Each executable supports --json. Exact codes take precedence, then partial ids and case-insensitive names. An ambiguous match lists candidates and exits 1. Run npm run capacity -- help for the supported flags. Flags use --name=value.

## Ten questions your own records answer

1. Which cluster has negative CPU headroom after reserve?
2. Which cluster has negative memory headroom after reserve?
3. Which workloads have no current measurements?
4. Which measurement windows are too short for review?
5. Which allocations exceed the measured-demand policy floor?
6. Which critical workloads appear in the sizing review?
7. Which proposed changes are overdue?
8. Which approved changes still lack a verification outcome?
9. Which failed vendor actions need an owner to investigate?
10. Who changed an allocation record and what evidence did they supply?

These queries work today. They are not a claim that IBM cannot answer the same questions. Your own joins, policies and evidence are editable.

## Your first hour: ten things to ask for

1. Put our business name, logo and colours in brand.json.
2. Show capacity after our reserve policy.
3. Explain the cluster with negative headroom.
4. Find workloads with missing or old measurements.
5. Compare current allocations with the sizing candidates.
6. Draft Monday's review and show the evidence gaps.
7. Produce the proposed change record.
8. Test our Turbonomic export mapping and reconcile the source rows.
9. Add our maintenance-window field with a tested migration.
10. Export a private snapshot before changing a rule.

## Bring your history

[Replace guide](docs/replace-ibm-turbonomic.md): download an action CSV, inspect or map its headers, test it, then import with one command. The original file and all extra columns survive. Identical files do nothing; conflicting IDs and invalid rows roll back the entire import. Imported actions retain vendor wording and never become local approvals automatically. Inventory and measured-demand windows are separate inputs.

[Compliance](docs/compliance.md) distinguishes NIST change-evidence checks from local freshness rules. [Why no front end](docs/why-no-front-end.md) covers the live-screen and mobile limits. [Research](docs/research.md) records pricing sources, candidate scores and the absence of a verified local buyer invoice.

## Operating boundaries

Use a trusted database owner. Domain tables enable row-level security and revoke PUBLIC access. These settings do not create a multi-user identity system. Actor names are labels, and database owners can bypass triggers. Observations, proposals, decisions, outcomes, imports, source actions and activity are append-only under ordinary access. All CLI mutations serialize on a common database lock. PGlite permits one process at a time; shared PostgreSQL supports multiple connections.

Export writes ten record groups including original imports and activity to a new private JSON file. It never overwrites an existing file. It is a portable snapshot, not a tested disaster-recovery restore command. Keep database backups and test restoration separately. Drafts and generated HTML contain private records and stay ignored by Git.

## Validation

npm test uses a fresh temporary database and output directory, exercises all 25 commands, and checks arithmetic, rejected states, evidence freshness, atomic imports, source preservation, HTML escaping and ambiguous names. The manual workflow covers Ubuntu and Windows on Node 20 and 22, plus PostgreSQL 17. See [observed results](docs/validation.md). A configured workflow is not a claim that every platform has run.

## Licence

MIT. Copyright 2026 Enterprise DNA. IBM Turbonomic belongs to its owner. No vendor code or assets are included.
