---
name: multi-platform-playwright-crawler
description: >-
  Unauthenticated Playwright crawler skill for Facebook, X (Twitter), Instagram, TikTok,
  Reddit, YouTube, and LinkedIn. Use this skill to scrape public posts, embeds, syndication
  timelines, and guest pages across all 7 platforms without logging in.
---

# Multi-Platform Unauthenticated Playwright Crawler Skill

This workspace skill crawls public social media posts across **Facebook**, **X**, **Instagram**, **TikTok**, **Reddit**, **YouTube**, and **LinkedIn** without requiring login credentials.

## Unauthenticated Bypass Techniques Used per Platform

1. **Facebook (`facebook.com`)**:
   - Visits public Facebook pages (`facebook.com/flyairasia`, `airasiamove`, `santancafe.my`, `officialade.aero`, `teleport.asia`), programmatically dismisses the `[aria-label="Close"]` guest login dialog, and extracts `[data-ad-preview="message"]` / `[dir="auto"]` post bodies + search-indexed `site:facebook.com` posts.
2. **X (`x.com`)**:
   - Scrapes X's unauthenticated syndication timeline endpoint (`https://syndication.twitter.com/srv/timeline-profile/screen-name/...`) via Playwright and parses `__NEXT_DATA__` (`props.pageProps.timeline.entries`) along with `site:x.com` status discovery.
3. **Instagram (`instagram.com`)**:
   - Scrapes Instagram's public profile embed endpoints (`https://www.instagram.com/<handle>/embed/`) which render recent reels/posts without triggering Instagram's main login redirect, plus `site:instagram.com` post discovery.
4. **TikTok (`tiktok.com`)**:
   - Loads public TikTok profiles (`tiktok.com/@flyairasia`, `@airasiamove`, `@santan.asean`, `@officialade.aero`, `@teleport.asia`) and parses `#__UNIVERSAL_DATA_FOR_REHYDRATION__` (`ItemModule` video descriptions & metrics) + DOM `[data-e2e="user-post-item-desc"]`.
5. **Reddit (`reddit.com`)**:
   - Scrapes `old.reddit.com/search?q=...&sort=new` DOM `.search-result` nodes via Playwright alongside the public `reddit.com/search.json` endpoint.
6. **YouTube (`youtube.com`)**:
   - Navigates to `youtube.com/results?search_query=...&sp=CAI%253D` (sorted by latest upload) and extracts `window.ytInitialData` `videoRenderer` objects.
7. **LinkedIn (`linkedin.com`)**:
   - Scrapes LinkedIn's public guest organization view (`linkedin.com/company/airasia`, `airasiamove`, `santan-asean`, `asia-digital-engineering`, `teleportbyairasia`) where `.attributed-text-segment-list__content` update cards render without login, plus `site:linkedin.com/posts` search discovery.

## Usage

### Run Standalone CLI

```bash
node .agents/skills/multi-platform-playwright-crawler/scripts/playwright_social_scraper.mjs
```

### Import in Automated Pipeline

Import [`scrapeRemainingPlatformsWithPlaywright`](file:///C:/Users/calebwee/.gemini/antigravity/scratch/airasia-social-listening-dashboard/.agents/skills/multi-platform-playwright-crawler/scripts/playwright_social_scraper.mjs) in [crawl_mentions.mjs](file:///C:/Users/calebwee/.gemini/antigravity/scratch/airasia-social-listening-dashboard/scripts/crawl_mentions.mjs).
