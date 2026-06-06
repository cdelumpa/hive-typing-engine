'use strict';

// Thin CLI shim — single source of truth is app/generate_report.js (Step 7 Phase 7c
// de-dup + v2 alignment). This file previously duplicated the entire ~620-line report
// builder, kept in hand-sync with the app/ copy; it now just invokes the in-app
// implementation so the two can never drift again. (app/generate_report.js loads its
// own dotenv/db with ROOT = app/, so no extra setup is needed here.)
//
// Usage: node beta/generate_report.js <client_id> [--force]
//        node beta/generate_report.js --all [--force]

require('../app/generate_report').runCli();
