# Change evidence checks

Checked 15 November 2026. This is an operational evidence checklist, not certification or a legal compliance verdict. NIST controls are used as a configurable business policy here. They are not asserted to be mandatory for every NZ or AU business.

[NIST SP 800-53 Revision 5, CM-3 and CM-3(2)](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) covers reviewing and documenting controlled changes and validating changes before finalizing implementation. [Official control text](https://github.com/usnistgov/oscal-content/blob/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json).

| Check | What this software verifies | Basis |
|---|---|---|
| CM-3-DECISION | Every proposal has a recorded approval or rejection, actor, evidence and impact review | NIST CM-3, local implementation |
| CM-3-VALIDATION | An approved change has a recorded outcome with verification evidence | NIST CM-3(2), local implementation |
| LOCAL-METRICS | A measurement exists, ends no more than seven days ago, and spans at least fourteen days | Local policy, not a legal threshold |
| LOCAL-INVENTORY | Cluster capacity was reviewed within thirty days | Local policy, not a legal threshold |

A proposal records a rollback plan and the exact original measurement. Approval requires a reviewer label different from the proposer and fresh, unchanged evidence. The impact field records the operator's security, privacy and service review. A verified outcome updates the recorded allocation only. No cloud, hypervisor or operating system command is executed. Failed and cancelled outcomes retain the old allocation.

The checks cannot inspect linked evidence, verify identities or prove that a change happened safely. Actor labels are not authentication. Use a trusted database owner, OS access controls and reviewed backup and retention policies. Record-keeping, observations, imports, decisions, outcomes and activity are append-only under normal database triggers; a database owner can disable those controls. Configure actual retention and any jurisdiction-specific policy before using personal information.
