# record-observation

Record a measured p95 demand window.

Read CLAUDE.md first. Use `npm run capacity -- record-observation` with the required values from the operator. Supported flags: `--workload`, `--date`, `--days`, `--cpu-p95`, `--memory-p95`, `--evidence`, `--actor`; add `--json` for machine reads. Run `npm run capacity -- help` for the full command list.

Read the matching records first. Confirm the operator supplied the actual facts and actor label. Never fabricate evidence, a decision or a successful outcome. Resolve ambiguous names before writing.

Use absolute p95 demand in CPU units and GiB, never percentages. Verify coverage of the stated observation window.
