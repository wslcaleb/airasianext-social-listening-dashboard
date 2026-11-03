---
name: xiaohongshu-scraper
description: >-
  Unauthenticated Playwright scraper skill for XiaoHongShu (小红书 / RED) modeled on
  zdhgreat/xiaohongshu-scraper. Use this skill when scraping public XiaoHongShu notes,
  SSR __INITIAL_STATE__ payloads, and search-indexed explore notes without logging in.
---

# XiaoHongShu Scraper Skill (`zdhgreat/xiaohongshu-scraper`)

This workspace skill extracts real public **XiaoHongShu (小红书)** notes for the 5 AirAsia Group entities (`AirAsia (Airline)`, `AirAsia MOVE`, `Santan`, `ADE (Engineering)`, and `Teleport (Logistics)`) without requiring a logged-in account.

## How It Works (Unauthenticated 3-Stage Extraction)

1. **Stage 1 — Playwright Guest Explore & SSR `__INITIAL_STATE__` Extraction**:
   - Launches headless Chromium with anti-automation flags (`--disable-blink-features=AutomationControlled`) and realistic desktop headers.
   - Navigates to public XiaoHongShu explore & search routes (`https://www.xiaohongshu.com/explore` and keyword queries like `亚航`, `AirAsia MOVE`, `亚航飞机餐 Santan`, `亚航工程 ADE`, `Teleport 亚航物流`).
   - Intercepts `window.__INITIAL_STATE__` (`feed.feeds`, `search.feeds`, `note.noteDetailMap`) and visible `.note-item` cards before or behind the guest modal.
2. **Stage 2 — Playwright Search-Indexed Note Discovery (`site:xiaohongshu.com`)**:
   - Queries public search engines via headless Chromium (`site:xiaohongshu.com/explore` and `site:xiaohongshu.com/discovery/item`) to capture newly indexed public RED notes even when XiaoHongShu rate-limits guest IP addresses.
3. **Stage 3 — Automatic Mandarin-to-English Normalization**:
   - Tags Mandarin Chinese notes with `detectedLanguage: 'Mandarin Chinese'` and `isNonEnglish: true` so the dashboard's **1-Click Translate All to English** toggle works seamlessly.

## Usage

### Run Standalone CLI

```bash
node .agents/skills/xiaohongshu-scraper/scripts/xhs_scraper.mjs
```

### Import in Automated Pipeline

Import [`scrapeXiaoHongShu`](file:///C:/Users/calebwee/.gemini/antigravity/scratch/airasia-social-listening-dashboard/.agents/skills/xiaohongshu-scraper/scripts/xhs_scraper.mjs) in [crawl_mentions.mjs](file:///C:/Users/calebwee/.gemini/antigravity/scratch/airasia-social-listening-dashboard/scripts/crawl_mentions.mjs) to merge live XiaoHongShu notes directly into [mentions.json](file:///C:/Users/calebwee/.gemini/antigravity/scratch/airasia-social-listening-dashboard/mentions.json).
