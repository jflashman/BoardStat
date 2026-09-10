# Browser-native migration validation

This file is the durable review record for the browser-native BoardStat migration. It distinguishes automated and AI-assisted verification from the human review required before the contribution is represented as production-ready.

## Human review

**Status: contributor walkthrough recorded; independent review remains pending.** The contributor confirmed a manual walkthrough in [PR #105](https://github.com/BetaNYC/BoardStat/pull/105#issuecomment-5430440691) on August 26, 2026. The PR is open and no longer draft. That comment does not separately record Firefox, Safari, or assistive-technology results; those checks remain pending below.

| Reviewer | Date | Areas reviewed | Findings and resolutions |
| --- | --- | --- | --- |
| jflashman | 2026-08-26 | Contributor-reported manual walkthrough and development process | Confirmed in the linked PR comment; individual browser and accessibility results not separately recorded. |
| Independent reviewer | Pending | Source, data methodology, usability, accessibility | Pending |

The subsequent [September 10 code review](docs/review-2026-09-10.md) records reproduced defects, local corrections, and the scope of the follow-up validation.

## September 10 follow-up evidence

The proposed branch at `ac5c3dc` includes the security hardening and accessibility
changes merged through fork PRs #11 and #12. The suite now has **42 passing tests**.
Both PR #12 CI runs passed:
[pull-request run](https://github.com/jflashman/BoardStat/actions/runs/34488239779)
and [branch run](https://github.com/jflashman/BoardStat/actions/runs/34488235303).

- [Accessibility validation](ACCESSIBILITY.md) records Chrome/axe checks across
  the seven active routes, all eight Manhattan views, expanded chart/map tables,
  keyboard interactions, and color-vision simulations. No confirmed axe violations
  remained in the tested states after targeted retests; map contrast required
  manual inspection. Actual VoiceOver/NVDA speech testing remains pending.
- The scoped PR #12 security review found no vulnerabilities in the tested paths.
  A local Chrome harness exercised hostile HTML/SVG/script strings in chart/map
  content, labels, hotspot details, error text, and URL filters. Payloads remained
  inert text. One hundred rapid activations of one hotspot produced one detail
  request; a synthetic 500-point map sample rendered in approximately 42 ms on the
  test machine. These results do not establish general resistance to denial of
  service or prove the security of every dependency or hosting configuration.
- The DOM test doubles check selected rendering values and state transitions.
  They do not emulate browser HTML parsing, layout, event propagation, or screen
  readers, and must not be treated as browser-level accessibility certification.
- The final readability cleanup removes a duplicate prototype-logo attribute,
  names the chart patterns, and expands compressed rendering/CSS statements.
  All ten pattern drawing sequences and their repeat order were compared with
  the pre-cleanup implementation and matched exactly. CSS declarations and their
  order are unchanged. All seven active HTML pages were checked for duplicate
  attributes; regression, JavaScript syntax, and whitespace checks passed.
- Cleanup browser retests passed for mobile chart legends, empty-state reflow,
  request-popup focus restoration, and hotspot loading focus. The first live
  recent-request map scan reported a target-size warning at 320px; an immediate
  repeat did not reproduce it. Treat map target sizing as data/viewport-sensitive
  and retain it for manual review, using the equivalent table actions. This
  cleanup does not change map geometry or assert that every zoom/data combination
  passes automated target-size checks. Map contrast still requires manual review.

This evidence supplements the dated matrix below. It does not complete independent
human review, Firefox/Safari testing, screen-reader speech testing, or production
approval. The slow cold-load cases and hosting limitations below remain applicable.

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

The connected browser-testing environment exposes Chrome only. Firefox and Safari were not silently substituted with another Chromium run. A source compatibility audit found no browser-vendor APIs in the application path: it uses standard ES modules, `fetch`, `AbortController`, `URLSearchParams`, DOM APIs, Chart.js, and Leaflet. That audit reduces risk but does not replace the pending real-engine checks.

## Acceptance requirements

- Default views should complete within 15 seconds under an ordinary broadband connection.
- Optional analyses must either complete within the 45-second request timeout or show the existing actionable retry state.
- Normal use must produce no console errors.
- Totals must match the official API, including date-boundary splitting and route-borough isolation.
- High-cardinality cross-dataset address and hotspot results must remain labeled as candidate rankings.

## Pull-request automation

The draft introduces the repository's first GitHub Actions workflow. Implementation head `59c087a` passed the workflow in the contributor fork on August 26, 2026: [BoardStat checks run 32994886159](https://github.com/jflashman/BoardStat/actions/runs/32994886159). GitHub does not surface that fork-owned run in the upstream cross-repository PR check list, so the linked run and reproducible local commands remain the available evidence until an upstream workflow exists.

## Licensing audit

GitHub's detected-license metadata was checked across 124 active BetaNYC repositories on August 26, 2026; none reported an SPDX license. BoardStat's README says its documents are CC BY-SA 4.0, but it does not clearly license application code. There is therefore no defensible organization-wide code-license default to infer. The draft documents all introduced third-party dependencies and leaves the project-license decision explicitly with BetaNYC maintainers.

## Human sign-off checklist

The named reviewer should record their name and date in the table above and confirm each item before production approval:

- Read the PR explanation, `README.md`, `DEPLOYMENT.md`, and this validation record.
- Inspect the SoQL construction, route-borough safeguards, 2019/2020 split, bounded rankings, timeout, cache, and cancellation behavior.
- Re-run the dependency-free tests and live validation; investigate any changed total rather than updating expected evidence blindly.
- Exercise all eight views in Firefox and Safari at desktop and mobile widths, including address lookup, both map modes, reset, back/forward, empty results, and retry.
- Use keyboard-only navigation and a screen reader for filters, tabs, chart summaries, map context, and scrollable tables.
- Confirm the AI-use disclosure accurately describes the work and that no unapproved nonpublic data was supplied to AI tools.
- Confirm the project-license decision and the maintainer who will perform the `master` to `gh-pages` release.
- Record every defect found and its disposition; do not sign off with unresolved production-blocking findings.

## AI-use record

OpenAI Codex assisted with repository analysis, code and test drafting, debugging, documentation, and automated browser checks. Only public repository content, public documentation, and public NYC 311 data were used. AI is not part of the deployed application or its data pipeline. The human contributor and reviewers remain accountable for deciding whether the contribution is accurate and suitable for publication.
