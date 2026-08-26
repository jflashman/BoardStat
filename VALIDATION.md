# Browser-native migration validation

This file is the durable review record for the browser-native BoardStat migration. It distinguishes automated and AI-assisted verification from the human review required before the contribution is represented as production-ready.

## Human review

**Status: in progress.** A named human reviewer must inspect the implementation, methodology, screenshots, and validation results before the draft pull request is marked ready for review.

| Reviewer | Date | Areas reviewed | Findings and resolutions |
| --- | --- | --- | --- |
| Pending | Pending | Source, data methodology, usability, accessibility | Pending |

## Reproducible checks

```bash
node --test tests/*.test.mjs
for file in js/*.js; do node --check "$file"; done
node tests/live-api-validation.mjs
python3 -m http.server 8000
```

The live validation independently reconstructs direct Socrata count queries for one standard board in every borough over current-only, historical-only, and 2019/2020 boundary ranges. Its timestamped JSON output includes the direct query URLs and must be attached to the pull request.

### Live result — 2026-08-26T16:58:07Z

All 15 dashboard totals matched independently constructed direct queries:

| Borough / board | Current | Historical | Boundary |
| --- | ---: | ---: | ---: |
| Bronx / 01 BRONX | 875 | 363 | 212 |
| Brooklyn / 01 BROOKLYN | 1,707 | 1,388 | 511 |
| Manhattan / 07 MANHATTAN | 1,230 | 732 | 408 |
| Queens / 01 QUEENS | 1,753 | 1,094 | 535 |
| Staten Island / 01 STATEN ISLAND | 1,223 | 1,260 | 545 |

Current used August 1–7, 2025; historical used August 1–7, 2019; boundary used December 30, 2019–January 2, 2020. Dates are inclusive in the UI and converted to an exclusive next-day upper bound in SoQL. Run `node tests/live-api-validation.mjs` to reproduce the exact URLs and results.

## Browser matrix

Record each completed manual pass. “AI-assisted” is evidence for debugging, not independent human approval.

| Browser and viewport | Reviewer | Result | Notes |
| --- | --- | --- | --- |
| Chrome desktop | AI-assisted audit | Pass, 2026-08-26 | All eight views, address lookup, URL back/forward, reset, optional rankings, agency/status, monthly mix, both map modes, and keyboard tab navigation; no console warnings or errors |
| Chrome 390px mobile | AI-assisted audit | Pass, 2026-08-26 | No document-level horizontal overflow; responsive route navigation and dashboard layout rendered without console warnings or errors |
| Firefox desktop/mobile | Human | Pending | |
| Safari desktop/mobile | Human | Pending | |

Review screenshots: [desktop](docs/screenshots/manhattan-desktop.png) and [390px mobile](docs/screenshots/manhattan-mobile.png).

Observed anonymous-API route timings varied with Socrata and browser cache state. Representative uncached Queens and Staten Island selections completed in 6.4s and 1.6s. Cold Bronx and Brooklyn defaults completed in 16.7s and 18.9s, so the draft remains above the aspirational 15-second default budget even though both completed within the enforced 45-second deadline. This limitation must remain visible during review.

## Acceptance requirements

- Default views should complete within 15 seconds under an ordinary broadband connection.
- Optional analyses must either complete within the 45-second request timeout or show the existing actionable retry state.
- Normal use must produce no console errors.
- Totals must match the official API, including date-boundary splitting and route-borough isolation.
- High-cardinality cross-dataset address and hotspot results must remain labeled as candidate rankings.

## AI-use record

OpenAI Codex assisted with repository analysis, code and test drafting, debugging, documentation, and automated browser checks. Only public repository content, public documentation, and public NYC 311 data were used. AI is not part of the deployed application or its data pipeline. The human contributor and reviewers remain accountable for deciding whether the contribution is accurate and suitable for publication.
