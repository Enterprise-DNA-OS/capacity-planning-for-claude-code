# record-outcome

Record an externally performed change and verification result.

Read CLAUDE.md first. Use `npm run capacity -- record-outcome` with the required values from the operator. Supported flags: `--change`, `--outcome`, `--evidence`, `--actor`; add `--json` for machine reads. Run `npm run capacity -- help` for the full command list.

Read the matching records first. Confirm the operator supplied the actual facts and actor label. Never fabricate evidence, a decision or a successful outcome. Resolve ambiguous names before writing.

A verified outcome changes only the recorded allocation. Require evidence of the external operation and validation; this command never executes a server change.
