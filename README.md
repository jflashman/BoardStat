# BoardStat

BoardStat is an interactive tool for New York City’s community boards. Its browser-native borough dashboards query live NYC Open Data and provide synchronized summaries, charts, maps, and tables for 311 service requests from 2010 to the present. BoardStat empowers community board staff and members to discover issues and trends within district boundaries while moving beyond open-data access to meaningful use.

This repository contains the static GitHub Pages application, its data-access modules, and dependency-free regression tests.

**IF you are looking for tutorals on how to use BoardStat's features, please check out our indepth page-by-page [videos on BetaNYC's YouTube](https://youtu.be/Q8JJfaizWik).**

| Borough  | URL |
| ------------- | ------------- |
| Bronx | https://boardstat.beta.nyc/bronx |
| Brooklyn | https://boardstat.beta.nyc/brooklyn |
| Manhattan | https://boardstat.beta.nyc/manhattan |
| Queens | https://boardstat.beta.nyc/queens |
| Staten Island | https://boardstat.beta.nyc/statenisland |

## File an Issue 
We're tracking all issues via this [repo's issue cue](https://github.com/BetaNYC/BoardStat/issues).

### Development Process and Methodology:
BoardStat was conceived with the Manhattan Borough President Gale A. Brewer as a simple 311 analysis tool. Through research conducted by Civic Innovation Fellows, key features were baked into a prototype. During the Spring semester of 2016 - 2017, fellows and BetaNYC staff, with assistance from Microsoft Civic Chicago and NYC, developed a prototype using PowerBI. Through group and one-on-one meetings, MBPO staff, Community District staff, and Community Board members helped refine key features. 

### Funders:
BoardStat was created with funds and support from the Alfred P. Sloan Foundation, Fund for the City of New York, and Microsoft Civic.

## Training Documents
BetaNYC routinely hosts 90 min public training sessions. To find out about the next training session, join our [meetup](https://meetup.com/betanyc). If you are a Manhattan Community Board District Office staff member or Community Board member, email us at 'boardstat@manhattanbp.nyc.gov' to set up a personal one-on-one training. 

**IF you are looking for tutorals on how to use BoardStat's features, please check out our indepth page-by-page [videos on BetaNYC's YouTube](https://youtu.be/Q8JJfaizWik).**

In the meantime, you can browse our training materials.
 * [BoardStat Training - Data Journey Worksheet](https://docs.google.com/document/d/1DHgVLrm-X1gs1rwovhpWA5En_ozcQnTWHYobmG9_B0A/edit) - This is the worksheet BetaNYC uses to teach BoardStat. You can find companion slides [here](http://bit.ly/betanyc_datajourney_manhattan).
 * [Training Videos](https://) - In development
 
## Data and methodology

The borough dashboards query NYC Open Data's [2010–2019](https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-2019/76ig-c548/about_data) and [2020–present](https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2020-to-Present/erm2-nwe9/about_data) 311 datasets directly from the browser. Queries always constrain both the route borough and its permitted Community Board values. Date ranges crossing January 1, 2020 are split between the two datasets and compatible aggregate results are merged in the browser.

Aggregation is pushed to Socrata with SoQL. The raw-request table and default map use bounded newest-first samples rather than downloading every matching record. High-cardinality rankings that span both datasets are explicitly labeled as leading candidates because each dataset must be ranked before its candidates can be merged. Exact totals and low-cardinality aggregates are not approximated.

## Development

Serve the repository without a build step:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/prototype.html` or a borough route. Run all dependency-free regression checks with:

```bash
node --test tests/*.test.mjs
```

Run the optional live validation against NYC Open Data with `node tests/live-api-validation.mjs`. It is intentionally excluded from CI because it depends on an external public service.

### Worksheet workflow parity

The live dashboard preserves its concise default views and loads the more expensive training-workflow analyses only when requested. Optional details include complaint/descriptor and address rankings, address-specific history, status by agency, calendar-month complaint mix, and a hotspot map mode.

The default map remains a newest-first sample of up to 250 request markers per applicable dataset. Hotspot mode instead shows up to 100 high-volume aggregate locations. Rankings that span both NYC Open Data datasets are labeled as leading candidate results because each dataset must be queried independently before the browser merges them; exact totals and low-cardinality aggregate tables are not approximated.

## Third-party software and services

BoardStat loads pinned releases of Chart.js, Leaflet, Leaflet.markercluster, Esri Leaflet, and Esri Leaflet Vector from public CDNs. Static CDN assets include Subresource Integrity metadata. Map tiles are provided by Esri and OpenStreetMap contributors with visible attribution. The original production analytics, jQuery, Popper, Bootstrap, Font Awesome, and NYC theme dependencies are preserved. See `THIRD_PARTY_NOTICES.md` for versions and licenses; self-hosted fonts and their SIL Open Font License are documented in `fonts/README.md`.

## AI assistance and human verification

Generative AI tools, including OpenAI Codex, assisted with repository analysis, code and test drafting, debugging, and documentation for the browser-native migration. AI is not used at runtime and does not generate, classify, summarize, or alter the displayed 311 records or statistics; results are produced deterministically from Socrata queries.

**Human verification status:** in progress. The draft contribution will not be represented as ready for production until a named human reviewer has inspected the implementation and validation evidence and accepted responsibility for the submission.

The review record is retained in `VALIDATION.md`. This disclosure follows [BetaNYC's AI Policy](https://beta.nyc/about/ai-policy), including its transparency, methodology-documentation, source-verification, and human-review principles. Only public repository content, public documentation, and public NYC 311 data were used during AI-assisted work.

# Change Log

## BoardStat v0.7 - A New Look
 * Updated all pages to have a new header from the NYC Core Framework
 * Added a new home page which includes a description and a map with links to the BoardStat borough pages

## BoardStat v0.6b - User experance tweeks and introducting new views
For this edit, we've made a number of user experance tweeks and modifications. You can track these improvements via our [github issue cue](https://github.com/BetaNYC/BoardStat/issues/84). Many thanks to [Prathm Juneja](https://github.com/prathmj) for spending a few weeks with us idenitifying and making these improvments.

 * #81: Reordered first page
 * #82: Reordered the top bar on every page
 * #49: Added clear all buttons to the top bar
 * #71: Added ability to select multiple addresses on Page 2
 * #83: Recolored Page 4
 * #77: Added the “Complaints Over Time” and “Compare Complaint Types” pages (to eventually replace “Service Requests by Year” and “Complaint Type by Month”)

 
## BoardStat v0.6a - THE BOROUGH EDITION!
 * NEW FEATURE - to support deployment to all five boroughs, we've consolidated individual community board views into a single borough view. Now, there are five dashboards. Next to the date selection field, you can select a board. if you want to look at a region, select more than one. Additionally, you can look at service request issues in parks by selecting their corresponding "board number."
 * **ALL DATA QUALITY ISSUES HAVE BEEN ADDRESSED BY NYC'S OPEN DATA TEAM.**
 * ~~DATA QUALITY ISSUES — Manhattan CB 08's data stream continues to include service request issues from Marble Hill, which is technically Manhattan but service by Bronx CB 08. Yet, there are some service requests from Manhattan's Marble Hill that are properly coded as Bronx CB 08. ~~
 * ~~DATA QUALITY ISSUES — In all Boroughs, Community Board 01 seems to be getting assigned ahandfull of the Borough's service requests. This service requests are listed below. As we are pulling directly from the open data portal, this seems to be a problem with the City's geocoder. We are working with MODA / DOITT / NYC 311 to address this issue ~~


## BoardStat v0.5e
Many thanks to [Briana Vecchione](https://github.com/brianavecchione) for making these updates.
 * NEW FEATURE - Time slicers are synced across pages. When you change the date on one page and move to the next page, the time query stays the same.
 * Data tables on Page 1, 2, 4are in higher definition.
 * Data is streaming via ODATA with a limit to 10000 per query. Due to changes on the City's open data portal, we have 12 special views that permit us access to ODATA without authentication. 
 * DATA QUALITY ISSUES — Currently, Manhattan CB 01 seems to be getting all of the Borough's street light condition & homeless person assistance service requests. As we are pulling directly from the open data portal, this seems to be a problem with the City's geocoder.
 * DATA QUALITY ISSUES — Manhattan CB 08's data stream continues to include service request issues from Marble Hill, which is technically Manhattan but service by Bronx CB 08. 


## Copyright
All documents are Creative Commons 4.0 By-Share Alike, via BetaNYC.
