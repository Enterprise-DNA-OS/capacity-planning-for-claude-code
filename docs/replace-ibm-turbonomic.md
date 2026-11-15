# Bring IBM Turbonomic action history across

IBM documents [action-list CSV downloads](https://www.ibm.com/docs/en/tarm/8.20.5?topic=started-home-page) from Action center, and describes [action fields and execution states](https://www.ibm.com/docs/en/tarm/8.17.x?topic=types-actions-chart). Checked 15 November 2026. Exports vary by product version and selected chart. Review the real headers before importing.

1. Open the relevant action list in Turbonomic, select the scope and date range, and download its CSV. Keep an untouched private copy. Export separate scopes if required.
2. Run `npm run migrate` against an empty local database. Do not seed a real database. Put your CSV in the ignored `imports/` folder.
3. Test the action import: `npm run capacity -- import ibm-turbonomic --file=imports/actions.csv --actor=Operator --dry-run --json`.
4. Import with the same command without `--dry-run`. Then compare source rows and imported records using `source-actions`, and write a full snapshot with `export --out=exports/first-import.json` after creating the exports folder.

The default columns are Action Description (required), Action ID (optional), Risk Type, Execution, Date Created and Date Executed. IBM documents displayed fields, not a stable export header contract. The synthetic fixture uses those display labels and is not a captured customer export. For other headers pass `--map=imports/mapping.json`, containing, for example, `{"description":"Description","execution":"Status"}`. Mapping keys are description, id, risk, execution, created and executed. Missing mapped headers fail the import.

The importer preserves the complete original file, every extra column, raw date strings and execution wording. It does not interpret a vendor execution state as local approval. Identical imports do nothing. With Action ID present, identical repeated rows are skipped and conflicting versions fail the whole import; use distinct export IDs or retain revised history separately after review. Without IDs, a hash of every source field identifies identical rows. Different exported states remain different observations. CSV quoting, embedded newlines and BOMs are supported. Invalid files roll back entirely, including their import record.

Imported action history does not supply inventory or measurement windows. Add each cluster and workload using `add-cluster` and `add-workload`, then `record-observation` with independently exported measurement evidence. Supply p95 demand in CPU units and GiB, not percentages. A recorded 14-day window means the operator verified adequate monitoring coverage, not that the program calculated it from raw samples. Field mapping and evidence review are part of the first-day migration.

The free desk replaces periodic capacity review and change paperwork. It does not replace Turbonomic discovery, topology stitching, continuous telemetry, placement simulation, cloud rate cards, Kubernetes scheduling or execution automation. Keep required monitoring and control systems until a custom replacement is connected and checked. Enterprise DNA scopes those connections around your estate. No one-day promise applies to rebuilding a live control system.
