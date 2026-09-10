# GitHub Pages deployment

BoardStat uses GitHub Pages' legacy branch deployment with `gh-pages` at the repository root. There is no deployment workflow. As of August 26, 2026, upstream `master` and `gh-pages` both point to `be2dca8`.

Repository history shows the established release pattern: changes are merged into `master`, then `master` is merged into `gh-pages`, which triggers the Pages build. The January 14, 2026 Pages builds were initiated by pushes to `gh-pages` after the corresponding `master` changes.

## Maintainer release procedure

Run only after the upstream pull request is approved and merged:

```bash
git fetch origin
git switch gh-pages
git merge --ff-only origin/master
git push origin gh-pages
```

The expected update is a fast-forward because the branches are currently aligned. If `--ff-only` fails, stop and inspect the divergence; do not force-push the production branch.

Before pushing, confirm:

- `CNAME` still contains only `boardstat.beta.nyc`.
- `git diff origin/gh-pages..origin/master -- CNAME` is empty.
- the intended pull-request merge commit is at `origin/master`.
- repository checks and the documented live validation pass on that commit.

After pushing, wait for the Pages deployment to report `built`, then smoke-test the home page and all five borough URLs over HTTPS. Verify live totals, one map, one table, analytics loading, and a narrow viewport with no normal-use console errors.

## Rollback

Do not rewrite `gh-pages`. Revert the migration merge on `master`, review that revert, and repeat the same fast-forward deployment procedure so repository and production history remain auditable.

## Security headers requiring hosting control

The HTML supplies CSP and `no-referrer` policies for the active routes. GitHub Pages does not provide a repository setting for arbitrary response headers; adding `.htaccess` or `_headers` here will not implement the remaining protections. A maintainer controlling a response-header-capable hosting layer must configure these separately:

```http
Strict-Transport-Security: max-age=31536000
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
```

HSTS requires reliable HTTPS on this hostname; do not add `includeSubDomains` or `preload` without checking the wider domain deployment. Confirm correct JavaScript/CSS MIME types before enabling `nosniff`.

If the maintainers confirm BoardStat does not need embedding by external sites, also set `X-Frame-Options: SAMEORIGIN` and an HTTP `Content-Security-Policy: frame-ancestors 'self'`. Same-origin framing must remain permitted for the analytics document. If external embedding is needed, use an explicit approved origin list in `frame-ancestors` and omit the incompatible X-Frame-Options policy. This choice needs the hosting maintainer's requirements; this patch does not change the site's embedding behavior.

After deployment, check actual HTTPS response headers and exercise all dashboard views. On the official hostname, inspect Google collection requests after loading an address/complaint URL and changing filters: `page_location`/`dl` must contain only the canonical page, referrer must be empty, and no filter values may appear. Confirm there is one initial pageview and no dashboard-history pageviews. Localhost and fork previews intentionally load no Google tag. Changes to analytics property settings or custom Google tags require repeating this check.
