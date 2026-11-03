#!/usr/bin/env node
/**
 * ThreadScraper (threads.net) Unauthenticated Playwright Scraper Skill
 * Modeled on galihkjaya/threadscraper
 *
 * Extracts public Meta Threads posts without login via:
 *  1. Playwright extraction of <script type="application/json" data-sjs> Relay payloads (thread_items + post.taken_at)
 *  2. Playwright DOM [data-pressable-container="true"] post extraction with <time datetime>
 *  3. Playwright search-indexed site:threads.net discovery across all 5 AirAsia Group entities
 */

const THREADS_TARGETS = [
  {
    entityId: 'airasia',
    entityLabel: 'AirAsia (Airline)',
    handle: 'flyairasia',
    profileUrl: 'https://www.threads.net/@flyairasia',
    searchQuery: 'site:threads.net "AirAsia" OR "flyairasia"'
  },
  {
    entityId: 'move',
    entityLabel: 'AirAsia MOVE',
    handle: 'airasiamove',
    profileUrl: 'https://www.threads.net/@airasiamove',
    searchQuery: 'site:threads.net "AirAsia MOVE" OR "airasiamove"'
  },
  {
    entityId: 'santan',
    entityLabel: 'Santan',
    handle: 'santan.asean',
    profileUrl: 'https://www.threads.net/@santan.asean',
    searchQuery: 'site:threads.net "Santan" "AirAsia" OR "Pak Nasser"'
  },
  {
    entityId: 'ade',
    entityLabel: 'ADE (Engineering)',
    handle: 'officialade.aero',
    profileUrl: 'https://www.threads.net/@officialade.aero',
    searchQuery: 'site:threads.net "Asia Digital Engineering" OR "officialade.aero"'
  },
  {
    entityId: 'teleport',
    entityLabel: 'Teleport (Logistics)',
    handle: 'teleport.asia',
    profileUrl: 'https://www.threads.net/@teleport.asia',
    searchQuery: 'site:threads.net "Teleport" "AirAsia" OR "teleport.asia"'
  }
];

/**
 * Scrape public Threads posts using an active Playwright Browser instance.
 * @param {object} options
 * @param {import('playwright').Browser} [options.browser]
 */
export async function scrapeThreads({ browser } = {}) {
  const results = [];
  const seenKeys = new Set();

  function pushThread(item) {
    if (!item || (!item.title && !item.body) || !item.publishedAt) return;
    const key = `${item.entityId}|${(item.url || '')}|${String(item.body || item.title).slice(0, 70)}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    results.push(item);
  }

  if (browser) {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 900 }
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    try {
      for (const target of THREADS_TARGETS) {
        // 1. Direct Threads Public Profile Relay data-sjs JSON & DOM Extraction
        try {
          await page.goto(target.profileUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
          await page.waitForTimeout(1000);

          const extracted = await page.evaluate((defaultHandle) => {
            const posts = [];

            function walkRelayObject(obj) {
              if (!obj || typeof obj !== 'object') return;
              if (Array.isArray(obj.thread_items)) {
                for (const ti of obj.thread_items) {
                  const post = ti?.post;
                  const text = post?.caption?.text;
                  const takenAtSec = Number(post?.taken_at || 0);
                  if (text && text.length > 15 && takenAtSec > 0) {
                    const user = post?.user?.username || defaultHandle;
                    const code = post?.code || '';
                    const likes = Number(post?.like_count || 0);
                    posts.push({
                      text,
                      author: `@${user}`,
                      likes,
                      publishedAt: takenAtSec * 1000,
                      url: code ? `https://www.threads.net/@${user}/post/${code}` : `https://www.threads.net/@${user}`
                    });
                  }
                }
              }
              for (const k of Object.keys(obj)) {
                walkRelayObject(obj[k]);
              }
            }

            document.querySelectorAll('script[type="application/json"][data-sjs]').forEach((scr) => {
              try {
                const parsed = JSON.parse(scr.textContent);
                walkRelayObject(parsed);
              } catch {}
            });

            // DOM fallback for visible thread containers with <time datetime>
            document.querySelectorAll('[data-pressable-container="true"]').forEach((el) => {
              const txt = el.innerText ? el.innerText.replace(/\s+/g, ' ').trim() : '';
              const timeEl = el.querySelector('time');
              const dtAttr = timeEl ? (timeEl.getAttribute('datetime') || timeEl.textContent.trim()) : '';
              if (txt.length > 25 && dtAttr) {
                const postLink = el.querySelector('a[href*="/post/"]');
                const href = postLink ? postLink.getAttribute('href') : '';
                posts.push({
                  text: txt.slice(0, 360),
                  author: `@${defaultHandle}`,
                  likes: 0,
                  publishedAt: dtAttr,
                  url: href ? (href.startsWith('http') ? href : `https://www.threads.net${href}`) : `https://www.threads.net/@${defaultHandle}`
                });
              }
            });

            return posts;
          }, target.handle);

          for (const p of extracted) {
            pushThread({
              entityId: target.entityId,
              entityLabel: target.entityLabel,
              platform: 'Threads',
              title: p.text,
              body: p.text,
              url: p.url,
              author: p.author,
              likes: p.likes,
              publishedAt: p.publishedAt,
              digimindQuery: `site:threads.net "@${target.handle}"`
            });
          }
        } catch {
          // Proceed to Stage 2 search discovery
        }

        // 2. Playwright Search-Indexed Threads Discovery (site:threads.net)
        try {
          const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(target.searchQuery)}`;
          await page.goto(ddgUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
          const searchPosts = await page.evaluate(() => {
            const out = [];
            document.querySelectorAll('.result, .web-result').forEach((row) => {
              const a = row.querySelector('a.result__a');
              const snip = row.querySelector('.result__snippet');
              const tsEl = row.querySelector('.result__timestamp, time');
              if (!a) return;
              const title = a.textContent.trim();
              const snippet = snip ? snip.textContent.trim() : '';
              const tsText = tsEl ? (tsEl.getAttribute('datetime') || tsEl.textContent.trim()) : '';
              let href = a.getAttribute('href') || '';
              const uddgMatch = href.match(/[?&]uddg=([^&]+)/);
              if (uddgMatch) {
                try { href = decodeURIComponent(uddgMatch[1]); } catch {}
              }
              if (title || snippet) out.push({ title, snippet, url: href, publishedAt: tsText || snippet });
            });
            return out;
          });

          for (const sp of searchPosts) {
            pushThread({
              entityId: target.entityId,
              entityLabel: target.entityLabel,
              platform: 'Threads',
              title: sp.title,
              body: sp.snippet,
              url: sp.url && sp.url.includes('threads.net') ? sp.url : target.profileUrl,
              author: `@${target.handle}`,
              likes: 0,
              publishedAt: sp.publishedAt,
              digimindQuery: target.searchQuery
            });
          }
        } catch {
          // Ignore individual timeout
        }
      }
    } finally {
      await context.close();
    }
  }

  return results;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  (async () => {
    let browser = null;
    try {
      const pw = await import('playwright');
      browser = await pw.chromium.launch({ headless: true });
    } catch {
      console.log('Playwright not installed or browser binary missing.');
    }
    const items = await scrapeThreads({ browser });
    if (browser) await browser.close();
    console.log(JSON.stringify(items, null, 2));
  })();
}
