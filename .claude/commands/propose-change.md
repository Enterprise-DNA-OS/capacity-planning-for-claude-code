# propose-change

Propose a new allocation with evidence and rollback instructions.

Read CLAUDE.md first. Use `npm run capacity -- propose-change` with the required values from the operator. Supported flags: `--workload`, `--code`, `--cpu`, `--memory`, `--due`, `--reason`, `--rollback`, `--actor`; add `--json` for machine reads. Run `npm run capacity -- help` for the full command list.

Read the matching records first. Confirm the operator supplied the actual facts and actor label. Never fabricate evidence, a decision or a successful outcome. Resolve ambiguous names before writing.

Use the evidence and scope notes in docs/compliance.md. Do not send messages or perform infrastructure operations.
