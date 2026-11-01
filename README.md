# Deal Scout — standalone GitHub website

**Independent of Claude.** This project is a public, static GitHub Pages dashboard with a scheduled Python collector. No passwords, API keys, or private emails belong in this public repository.


## 2026-10-31 interface audit and corrections

The site's initial upload simplified the original saved-search setup and was missing important filters. The current frontend includes:
- **Priority source strip** for Facebook Marketplace and Craigslist with honest connected/not-connected states.
- **Listings tab** with keyword, seller, tracking status, source, sortable price, year, mileage, location text and verification filters, plus a deal-only toggle.
- **Saved Searches tab** with the full original record structure: name, keywords, exclude words, category, maxPrice, marketPrice, dealPct, minYear, maxYear, maxMiles, ZIP, radiusMi, areas, extraUrls, sources, alerts, active and notes.
- **Sources tab** showing all ten source channels (Facebook, Craigslist, OfferUp, Cycle Trader, eBay, Autotrader, PowerSports, MotoHunt, Revtero, owners' forums).
- **Metrics tab** that differentiates records from actual successful collector checks. Source status is only current when a successful check was logged within the past 24 hours.
- **Offline fallback** so the five historical starting records still display if repository JSON cannot be fetched.
- **Smoke tests** in \`tests/dashboard-smoke.cjs\` checking listing display, sources, price rules, saved filters, and JSON fallback. \`pages.yml\` now runs these tests before deploying.

**Critical status:** Five historical leads, one from Craigslist and none from Facebook Marketplace. \`config/feeds.json\` is empty, so no Facebook, Craigslist, eBay or other live collections are connected. Enabling an every-30-minute GitHub Actions schedule alone is not a working collector.

**Missing infrastructure:** GitHub Pages does not provide private backend storage, multi-device sync for search settings, automatic Gmail/Marketplace email ingestion, geocoding for ZIP/radius, or outbound email alerts. ZIP and radius are stored but not currently enforced; city/state text filtering works locally.

For troubleshooting, see [Actions](https://github.com/cbelknap980/deal-scout/actions) → **Publish Deal Scout dashboard**. If deployment succeeded but the display appears stale, refresh with cache cleared. The site URL is [Deal Scout](https://cbelknap980.github.io/deal-scout/).

## Dashboard
- Listings, filters, statuses, and a deal-scoring view.
- Metrics tab with unique listings, private-party leads, source performance and source-run health.
- Sources registry and JSON import/export.
- Historical starter leads are identified as unverified; **do not interpret them as available inventory**.
- Deal scoring: a listing qualifies on price only if it is **at least 15% below the configured market reference AND under your hard price ceiling**.
- Initial market reference ($10,995) comes from the previous *dealer asking price* baseline and may overstate private-party market value.
- Deal rules, new searches, statuses and manual imports are browser-local on the static website. They are not synchronized to another browser or device.

## Publishing on GitHub Pages
1. Open [Repository Settings → Pages](https://github.com/cbelknap980/deal-scout/settings/pages).
2. Under **Build and deployment**, set **Source = GitHub Actions**. The included workflow is \`.github/workflows/pages.yml\`.
3. Open [Actions](https://github.com/cbelknap980/deal-scout/actions) to check **Publish Deal Scout dashboard**. You can run it manually using **Run workflow**.
4. When successful, visit **https://cbelknap980.github.io/deal-scout/**.

If Pages is already enabled from GitHub Actions, step 2 may already be complete. Pages deployments need Actions permissions and can take time to appear.

**Privacy warning:** GitHub Pages is publicly visible. Do not publish home ZIP searches, private emails or personal data in the repository. This version is a public prototype, not an authenticated private dashboard.

## Collector — current status
The independent collector is \`collector.py\` and runs from \`.github/workflows/collector.yml\` every 30 minutes (scheduled runs can be delayed or skipped). It reads only explicitly enabled, authorized RSS/Atom feed sources configured in \`config/feeds.json\`, respects robots restrictions, and saves new records to \`data/listings.json\` and run logs to \`data/runs.json\`. The workflow commits changes back to the public repository.

**No feeds are configured by default.** Therefore a successfully executing workflow **does not imply Facebook, Craigslist or any other live source is being collected**. A feed that lacks pricing will produce an unpriced record requiring verification. The initial dashboard uses five historical leads from the prior comparison.

### Adding a permitted feed
Edit \`config/feeds.json\`:
\`\`\`json
{
  "feeds": [
    {
      "name": "permitted_forum_feed",
      "url": "https://example.org/forum/for-sale/feed.xml",
      "searchId": "daytona-675r",
      "enabled": true,
      "authorizationConfirmed": true
    }
  ]
}
\`\`\`
Use a genuine feed URL and confirm automated access is allowed. The collector fails closed when robots instructions cannot be verified. Website-specific parsing, stronger year/trim filtering, API support and alerting must still be added before treating this as a production deal monitor.

### Facebook Marketplace and Craigslist
This repository does **not** run stealth scrapers against either site. The next integration is ingestion of authorized saved-search email notifications and user-assisted listing imports. Do not commit the content of private inbox messages or credentials to this public repository.

### Other next steps
- Configure a permitted active feed or official API.
- Add secure notification intake off GitHub Pages, with an appropriately private backend or encrypted credentials managed outside the public site.
- Add true multi-device persistent settings and authenticated access if you want a private service.
- Verify new listings against live sources and report seller-confirmed availability separately.

## Tests and local run
Python 3.12+:
\`\`\`bash
python collector.py
python -m http.server 8000
\`\`\`
Then open http://localhost:8000. The site requires no JavaScript packages or build step.

The Metrics tab reports only actual saved records and logged runs, rather than claiming market-wide coverage.
