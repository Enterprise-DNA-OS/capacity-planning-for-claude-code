# decide-change

Record approval or rejection with an impact review.

Read CLAUDE.md first. Use `npm run capacity -- decide-change` with the required values from the operator. Supported flags: `--change`, `--decision`, `--evidence`, `--impact`, `--actor`; add `--json` for machine reads. Run `npm run capacity -- help` for the full command list.

Read the matching records first. Confirm the operator supplied the actual facts and actor label. Never fabricate evidence, a decision or a successful outcome. Resolve ambiguous names before writing.

Use the evidence and scope notes in docs/compliance.md. Do not send messages or perform infrastructure operations.
