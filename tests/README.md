# Hive Typing Engine — Test Runner

End-to-end fixture tests for the Hive Enneagram Typing Engine. Each test:
1. Posts a complete fixture payload to the live `/api/analyze` endpoint
2. Verifies the JSON result (type, instinct, confidence, flags, all required sections)
3. Renders both the client and coach HTML reports
4. Saves the rendered output to `samples/`

## Prerequisites

The server must be running before you run a test:

```bash
cd app && node server.js
```

## Running a test

```bash
node tests/run_test.js so7
node tests/run_test.js sp9
```

## Available fixtures

| Fixture | Type | Key features |
|---------|------|--------------|
| `so7`   | Social Seven counter-type (Type 7, SO) | MEDIUM confidence · `counter_type` + `lookalike_ambiguity` flags · Section 1A + Section 6A in coach report |
| `sp9`   | Self-Preservation Nine (Type 9, SP)     | HIGH confidence · Clean Stage 4 confirmation · No confusion sections |

## Output

Test results print to stdout with ✓/✗ per check. Rendered HTML files are saved to `samples/`:

```
samples/hive_client_report_SO7_test.html
samples/hive_coach_report_SO7_test.html
samples/hive_client_report_SP9_test.html
samples/hive_coach_report_SP9_test.html
```

## Adding a new fixture

1. Create `tests/fixtures/<name>_fixture.json` following the schema in `so7_fixture.json`
2. Run: `node tests/run_test.js <name>`

The fixture schema mirrors the state object produced by the mechanical scoring engine in `app/public/app.js`. The runner assembles the context block from the fixture data using the same format as `buildContextBlock()`.
