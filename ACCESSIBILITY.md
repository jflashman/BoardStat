# Accessibility validation

## September 10, 2026 — proposed browser-native branch

This review covers local changes based on `b6f1507` in
`upstream-browser-native-draft`. It does not assess the deployed official site.

### Changes

- Every chart has an expandable, semantic table of its complete plotted data,
  including zero-filled periods and grouped Other values. Open disclosures stay
  open when results refresh; empty results remove obsolete chart tables.
- Comparison lines use different markers and dash sequences. Stacked bars and
  agency segments use patterns, with matching legend samples. Information is
  available independently of color, consistent with
  [WCAG's use-of-color guidance](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).
- Map requests, clusters, and hotspots have accessible names. Request and hotspot
  popups support keyboard activation and Escape, with focus restoration. An
  expandable results table precedes the map so keyboard users can reach equivalent
  results without traversing all its markers. Request rows have Show on map actions.
- Hotspot table actions and popups share pending requests and cached results.
  Loading preserves button focus, errors can be retried, and superseded results
  cannot update the replacement map's data.
- Legends and table headers have explicit contrasting backgrounds and text.
  Header image names, mobile-menu semantics, skip-link focus, home-page language
  and landmarks, and named scrolling regions are corrected.
- The home illustration retains its fixed image-map coordinates inside a scrolling
  region, with a visible equivalent list of borough links. Pages and empty charts
  reflow at 320 CSS pixels.

### Verification performed

The site was served with Python's static HTTP server on loopback. Temporary
Playwright/Chrome and axe-core 4.13.0 tooling was kept outside the repository;
the application still has no build step or new runtime dependency.

| Check | Result |
| --- | --- |
| Dependency-free regression suite | 42 tests pass, including chart/table equivalence, zero filling, replacement, map names, detail coalescing, retry, and stale-response protection |
| JavaScript syntax and diff whitespace | Pass |
| axe WCAG 2 A/AA, 2.1 A/AA, and 2.2 AA checks | No remaining confirmed violations in the tested states after fixes and targeted retests |
| Route/view coverage | Home, prototype, all five borough overviews, all eight Manhattan views, and alternate map/monthly modes at 1280px and 320px |
| Expanded content | Chart/map tables, detailed complaint/address rankings, agency/status analysis, and populated address charts checked |
| Keyboard | Skip destinations, subsequent focus order, mobile menu, arrow-key tabs, request popup Escape and exact focus restoration, hotspot activation and loading focus checked |
| Data equivalence | All three populated address-chart tables match their rendered chart configurations; regression tests also cover comparison zeros and monthly Other values |
| State changes | Empty results, stale tables during an intentional API failure, successful retry, reset, rapid view switching, and cached hotspot details checked |
| Color vision | Chrome protanopia, deuteranopia, tritanopia, and achromatopsia simulations captured for comparison lines, monthly stacks, and agency segments; shapes/patterns and complete text alternatives remain available |
| Reflow | Tested populated and empty states stay within the 320px page width; wide tables and the fixed-coordinate home illustration scroll internally |
| Runtime | No uncaught normal-use JavaScript errors observed |

The mode-legend text contrast is now **17.40:1**, and table-header text is
**12.63:1**. Axe leaves map zoom/attribution contrast as manual-review items because
it cannot reliably resolve the layered map background. Computed foregrounds were
checked against explicit white backgrounds: zoom links **7.05:1**, attribution
text **17.40:1**, and attribution links **17.54:1**. Cluster text is **12.15:1**
against its opaque light-blue background.

Map targets have at least 44px nominal dimensions, wider clustering and edge
padding. Geographic overlap can still occur at other zooms or with other data;
the equivalent table actions provide well-spaced access to the same content.
See [WCAG's target-size exceptions](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

### Remaining human verification

Chrome accessibility-tree inspection confirmed named controls, table relationships,
and exposed hotspot buttons. A real VoiceOver or NVDA speech session was **not**
completed: the native computer-control connection failed to start. This report is
not a WCAG certification or a replacement for disabled-user testing.

Before human sign-off, use VoiceOver/Safari and NVDA/Firefox or Chrome to read a
populated chart table, navigate both map modes, load and retry hotspot details,
change filters, and verify announcements and popup focus. Also review dense chart
patterns and map navigation with users who have low vision or motor impairments.
Third-party map content and other date/filter combinations require ongoing review.

To repeat local checks, run `node --test tests/*.test.mjs`, serve with
`python3 -m http.server 8000`, and inspect the routes and states listed above.
Expand View data using the keyboard and compare its headers and values with the
chart or map. Use browser vision-deficiency emulation and test 320px reflow,
including a selection with no matching requests.
