---
name: threadscraper
description: >-
  Unauthenticated Playwright scraper skill for Meta Threads (threads.net) modeled on
  galihkjaya/threadscraper. Use this skill when scraping public Threads profiles,
  embedded Relay data-sjs JSON scripts, and public Threads discussions without logging in.
---

# ThreadScraper Skill (`galihkjaya/threadscraper`)

This workspace skill crawls public **Meta Threads (`threads.net`)** posts and replies for the 5 AirAsia Group entities (`AirAsia (Airline)`, `AirAsia MOVE`, `Santan`, `ADE (Engineering)`, and `Teleport (Logistics)`) without logging in.

## How It Works (Unauthenticated 3-Stage Extraction)

1. **Stage 1 — Embedded Relay JSON (`script[type="application/json"][data-sjs]`) Extraction**:
   - Meta Threads embeds full `thread_items` objects inside `<script type="application/json" data-sjs>` tags on public profile pages (`https://www.threads.net/@flyairasia`, `@airasiamove`, `@santan.asean`, `@officialade.aero`, `@teleport.asia`).
   - The scraper recursively traverses those JSON trees to extract `post.caption.text`, `post.code`, `post.like_count`, and `post.user.username`.
2. **Stage 2 — Public DOM `[data-pressable-container="true"]` Extraction**:
   - Captures visible public post containers rendered in the guest viewport.
3. **Stage 3 — Search-Indexed Threads Discovery (`site:threads.net`)**:
   - Uses Playwright to scrape search-indexed `site:threads.net` posts across all 5 AirAsia Group entities so community discussions from non-official handles are also captured.

## Usage

### Run Standalone CLI

```bash
node .agents/skills/threadscraper/scripts/threads_scraper.mjs
```

### Import in Automated Pipeline

Import [`scrapeThreads`](file:///C:/Users/calebwee/.gemini/antigravity/scratch/airasia-social-listening-dashboard/.agents/skills/threadscraper/scripts/threads_scraper.mjs) in [crawl_mentions.mjs](file:///C:/Users/calebwee/.gemini/antigravity/scratch/airasia-social-listening-dashboard/scripts/crawl_mentions.mjs) to merge live Threads posts directly into [mentions.json](file:///C:/Users/calebwee/.gemini/antigravity/scratch/airasia-social-listening-dashboard/mentions.json).
