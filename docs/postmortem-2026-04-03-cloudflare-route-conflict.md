# Postmortem: SEO And Blog Pages 404 On Production

Date: 2026-04-03

## Summary

Newly added SEO landing pages and blog posts returned `404` on `recipepricer.com`, while the original small set of pages continued to work.

The app build was correct. The production failure was caused by conflicting Cloudflare Worker bindings:

- old zone routes still pointed `recipepricer.com/*` and `www.recipepricer.com/*` to the legacy Worker `recipecalc`
- newer custom domains pointed `recipepricer.com` and `www.recipepricer.com` to the new Worker `recipepricer`

Because the old routes still matched requests, production traffic continued to hit `recipecalc`, which only had the older asset set.

## User Impact

- 7 new SEO landing pages returned `404`
- 4 new blog pages returned `404`
- `sitemap-0.xml` on production only listed the original 5 pages
- existing pages such as `/calculator/` still worked, which made the issue look like a partial asset upload failure

## What Actually Happened

### Commit Timeline

`538daf1` on 2026-04-02:
- switched the primary domain to `recipepricer.com`
- added Cloudflare zone routes in [wrangler.toml](/Users/panke/Programs/side-hustle/recipecalc/wrangler.toml)
- the Worker name was still `recipecalc`

`1b00505` on 2026-04-02:
- renamed the Worker from `recipecalc` to `recipepricer`

`86003f3` on 2026-04-02:
- changed Cloudflare config from zone routes to custom domains
- did not remove the previously created zone routes from Cloudflare

`ff1c0e6` on 2026-04-03:
- added 7 SEO landing pages

`01fda66` on 2026-04-03:
- added the blog engine and 3 seed articles

### Cloudflare State At Incident Time

Production had both of these at the same time:

- custom domains:
  - `recipepricer.com` -> `recipepricer`
  - `www.recipepricer.com` -> `recipepricer`
- stale zone routes:
  - `recipepricer.com/*` -> `recipecalc`
  - `www.recipepricer.com/*` -> `recipecalc`

Requests continued to hit `recipecalc`, not `recipepricer`.

## Why The Symptoms Were Misleading

This looked like an asset upload or wrangler caching issue because:

- local `pnpm build` produced all expected files
- `wrangler deploy` completed successfully
- old pages were still reachable
- only newly added pages were failing

But the real behavior matched the older Worker exactly:

- production `sitemap-0.xml` only listed the original pages
- new prerendered pages were absent
- new `_astro` asset hashes returned `404`
- deleting the stale routes immediately made the new pages return `200`

## Root Cause

The root cause was deployment state drift in Cloudflare:

- the service name changed from `recipecalc` to `recipepricer`
- the deployment model changed from zone routes to custom domains
- the old zone routes were never removed

As a result, production traffic stayed on the old Worker even though new deployments were going to the new Worker.

## Not The Root Cause

The following were investigated but were not the primary cause:

- Astro prerender output
- missing local build artifacts
- Wrangler `4.77 -> 4.80` upgrade
- asset hashing mismatch between local and Cloudflare

Those could have complicated debugging, but they did not cause the outage.

## Resolution

The fix applied on 2026-04-03 was:

1. Verify that `recipepricer` custom domains existed and were correctly attached.
2. Remove the stale zone routes pointing to `recipecalc`.
3. Confirm production traffic now hit `recipepricer`.
4. Delete the obsolete `recipecalc` Worker.

After the stale routes were removed:

- SEO landing pages returned `200`
- blog pages returned `200`
- `sitemap-0.xml` showed all 16 URLs
- new `_astro` assets returned `200`

## Follow-Up Actions

1. When renaming a Worker service, explicitly remove old routes/domains in the same rollout.
2. Do not mix zone routes and custom domains for the same hostname unless there is a documented migration plan.
3. Add post-deploy checks:
   - `curl /sitemap-0.xml`
   - `curl` one newly added page
   - `curl` one newly added `_astro` asset
4. Prefer Cloudflare API verification for incidents involving routes, domains, and bindings; local `wrangler` output alone is not enough.

## Repo Notes

This incident also exposed two repo-level footguns:

- root [wrangler.toml](/Users/panke/Programs/side-hustle/recipecalc/wrangler.toml) can be misleading because Astro deploys via `.wrangler/deploy/config.json` to generated `dist/server/wrangler.json`
- historical Cloudflare state can outlive config changes in git

Git history alone did not reveal the outage. The failure only became obvious after comparing repo state with live Cloudflare routes and custom-domain bindings.
