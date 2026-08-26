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
