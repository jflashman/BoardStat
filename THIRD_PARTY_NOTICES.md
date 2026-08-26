# Third-party dependencies

BoardStat remains a static site and has no package-install or build step. The browser-native dashboards load these pinned releases directly from public CDNs:

| Dependency | Version | License | Project |
| --- | --- | --- | --- |
| Chart.js | 4.4.7 | MIT | https://github.com/chartjs/Chart.js |
| Leaflet | 1.9.4 | BSD-2-Clause | https://github.com/Leaflet/Leaflet |
| Leaflet.markercluster | 1.5.3 | MIT | https://github.com/Leaflet/Leaflet.markercluster |
| Esri Leaflet | 3.0.19 | Apache-2.0 | https://github.com/Esri/esri-leaflet |
| Esri Leaflet Vector | 4.3.0 | Apache-2.0 | https://github.com/Esri/esri-leaflet-vector |

Versions and license identifiers were verified from each release's published package metadata on August 26, 2026. Dashboard HTML includes SHA-384 Subresource Integrity values for these CDN assets. Existing production dependencies—NYC theme styles, Font Awesome, jQuery, Popper, Bootstrap, and Google Analytics—are preserved from the upstream site rather than introduced by the browser-native migration.

Map data and tiles carry visible attribution in the interface. The primary NYC vector basemap credits NYC OTI; the fallback layer credits OpenStreetMap contributors.

The self-hosted Instrument Sans and Noto Sans subsets and their SIL Open Font License are documented separately in `fonts/README.md`.
