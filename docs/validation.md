# Observed validation

15 November 2026: npm install completed, npm test passed on Linux with Node 22 and PGlite: 98 assertions and all 25 executable commands. Each test uses a disposable database and output directory. Windows and PostgreSQL checks are configured in the manual CI workflow; observed remote results are recorded below when available.

[GitHub Actions run 43671042573](https://github.com/Enterprise-DNA-OS/capacity-planning-for-claude-code/actions/runs/43671042573) passed all five jobs: Ubuntu and Windows on Node 20 and 22 (npm test and npm run demo), and PostgreSQL 17 (npm test). Tested implementation commit: 8763b17.

Three branded views and three document instances rendered locally. Headless Chromium screenshots were inspected. The weekly capacity view was narrowed to decision fields after visual review; document layouts omit internal identifiers. These presentation changes were rendered and inspected after the test run.
