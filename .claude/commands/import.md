# import

Import an IBM Turbonomic action export atomically.

Read CLAUDE.md first. Use `npm run capacity -- import ibm-turbonomic` with the required values from the operator. Supported flags: `--file`, `--map`, `--dry-run`, `--actor`; add `--json` for machine reads. Run `npm run capacity -- help` for the full command list.

Read the matching records first. Confirm the operator supplied the actual facts and actor label. Never fabricate evidence, a decision or a successful outcome. Resolve ambiguous names before writing.

Follow docs/replace-ibm-turbonomic.md. Inspect headers, dry-run first, then import and reconcile counts. Preserve source files privately. Imported execution states are historical source values, not local approvals.
