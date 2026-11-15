# sizing-review

Review measured demand against recorded allocations.

Read CLAUDE.md first. Use `npm run capacity -- sizing-review` with the required values from the operator. Supported flags: none; add `--json` for machine reads. Run `npm run capacity -- help` for the full command list.

Present the returned records, explain missing data and name the owner of the next step.

The policy is ceil(p95 demand / 0.70), with a minimum of one unit. Missing or stale data is excluded. Suggestions require workload-specific testing, peak and resilience review.
