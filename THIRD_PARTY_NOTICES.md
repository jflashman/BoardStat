# Third-party dependencies

BoardStat remains a static site and has no package-install or build step. The browser-native dashboards load these pinned releases directly from public CDNs:

| Dependency | Version | License | Project |
| --- | --- | --- | --- |
| Chart.js | 4.4.7 | MIT | https://github.com/chartjs/Chart.js |
| Leaflet | 1.9.4 | BSD-2-Clause | https://github.com/Leaflet/Leaflet |
| Leaflet.markercluster | 1.5.3 | MIT | https://github.com/Leaflet/Leaflet.markercluster |
| Esri Leaflet | 3.0.19 | Apache-2.0 | https://github.com/Esri/esri-leaflet |
| Esri Leaflet Vector | 4.3.0 | Apache-2.0 | https://github.com/Esri/esri-leaflet-vector |
| jQuery | 3.7.1 | MIT | https://github.com/jquery/jquery |

Dashboard dependency versions and license identifiers were verified from release metadata on August 26, 2026. Dashboard HTML includes SHA-384 Subresource Integrity values for these CDN assets. On September 10, 2026, inherited jQuery 3.3.1 was upgraded to 3.7.1 with SHA-256 integrity metadata to address CVE-2019-11358, CVE-2020-11022, and CVE-2020-11023. Unused jQuery and jQuery Migrate tags were removed from the legacy `test.html` snapshot; its inline scripts do not use jQuery. Other inherited production dependencies—NYC theme styles, Font Awesome, Popper, and Bootstrap—remain unchanged. Existing Google Analytics measurement now runs in a separate document with sanitized page metadata; see `SECURITY.md`.

Map data and tiles carry visible attribution in the interface. The primary NYC vector basemap credits NYC OTI; the fallback layer credits OpenStreetMap contributors.

The self-hosted Instrument Sans and Noto Sans subsets and their SIL Open Font License are documented separately in `fonts/README.md`.
