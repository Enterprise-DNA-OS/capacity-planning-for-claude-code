# Capacity Planning for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
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

If an ask fits nothing here, run the CLI directly (`npm run capacity -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off IBM Turbonomic.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/ibm-turbonomic

## Capacity semantics

CPU capacity means allocatable units in the same basis as workload allocations, not physical cores. Memory is GiB. Reserve reduces capacity available for allocation. Sizing uses the latest recorded p95 demand and a 70% target, rounded up. Seven-day freshness and fourteen-day coverage are local policies. Missing data never means zero demand. No performance guarantee follows from this calculation.

All changes are records only. Never use this desk to issue cloud or hypervisor operations. A verified outcome means the operator supplied evidence that the external change and validation happened. Actor labels do not authenticate a person. Use the private database only with trusted operators.
