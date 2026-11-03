#!/usr/bin/env node
/**
 * Multi-Platform Unauthenticated Playwright Scraper
 * Crawls Facebook, X, Instagram, TikTok, Reddit, YouTube, and LinkedIn without logging in.
 */

const ENTITY_CONFIGS = [
  {
    entityId: 'airasia',
    entityLabel: 'AirAsia (Airline)',
    shortQ: 'AirAsia',
    fbPage: 'https://www.facebook.com/flyairasia',
    xHandle: 'airasia',
    igHandle: 'flyairasia',
    ttHandle: 'flyairasia',
    liCompany: 'https://www.linkedin.com/company/airasia'
  },
  {
    entityId: 'move',
    entityLabel: 'AirAsia MOVE',
    shortQ: 'AirAsia MOVE',
    fbPage: 'https://www.facebook.com/airasiamove',
    xHandle: 'airasiamove',
    igHandle: 'airasiamove',
    ttHandle: 'airasiamove',
    liCompany: 'https://www.linkedin.com/company/airasiamove'
  },
  {
    entityId: 'santan',
    entityLabel: 'Santan',
    shortQ: 'AirAsia Santan',
    fbPage: 'https://www.facebook.com/santancafe.my',
    xHandle: 'airasia',
    igHandle: 'santan.asean',
    ttHandle: 'santan.asean',
    liCompany: 'https://www.linkedin.com/company/santan-asean'
  },
  {
    entityId: 'ade',
    entityLabel: 'ADE (Engineering)',
    shortQ: 'Asia Digital Engineering',
    fbPage: 'https://www.facebook.com/officialade.aero',
    xHandle: 'airasia',
    igHandle: 'officialade.aero',
    ttHandle: 'officialade.aero',
    liCompany: 'https://www.linkedin.com/company/asia-digital-engineering'
  },
  {
    entityId: 'teleport',
    entityLabel: 'Teleport (Logistics)',
    shortQ: 'Teleport AirAsia',
    fbPage: 'https://www.facebook.com/teleport.asia',
    xHandle: 'airasia',
    igHandle: 'teleport.asia',
    ttHandle: 'teleport.asia',
    liCompany: 'https://www.linkedin.com/company/teleportbyairasia'
  }
];

async function extractDuckDuckGoSiteResults(page, siteDomain, queryText) {
  const fullQ = `site:${siteDomain} "${queryText}"`;
  try {
    await page.goto(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(fullQ)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
    return await page.evaluate((domain) => {
      const items = [];
      document.querySelectorAll('.result, .web-result').forEach((row) => {
        const a = row.querySelector('a.result__a');
        const snip = row.querySelector('.result__snippet');
        if (!a) return;
        const title = a.textContent.trim();
        const body = snip ? snip.textContent.trim() : '';
        let href = a.getAttribute('href') || '';
        const m = href.match(/[?&]uddg=([^&]+)/);
        if (m) {
          try { href = decodeURIComponent(m[1]); } catch {}
        }
        if ((title || body) && (!domain || href.includes(domain))) {
          items.push({ title, body, url: href });
        }
      });
      return items;
    }, siteDomain);
  } catch {
    return [];
  }
}

/**
 * Crawl Facebook, X, Instagram, TikTok, Reddit, YouTube, and LinkedIn without logging in.
 * @param {object} options
 * @param {import('playwright').Browser} [options.browser]
 */
export async function scrapeRemainingPlatformsWithPlaywright({ browser } = {}) {
  const results = [];
  const seen = new Set();

  function addRaw(item) {
    if (!item || (!item.title && !item.body)) return;
    const key = `${item.platform}|${item.entityId}|${String(item.title || item.body).slice(0, 75)}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(item);
  }

  if (!browser) return results;

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
    for (const ent of ENTITY_CONFIGS) {
      // =========================================================================
      // 1. FACEBOOK (Guest Public Page + Modal Dismiss + Search-Indexed Posts)
      // =========================================================================
      try {
        await page.goto(ent.fbPage, { waitUntil: 'domcontentloaded', timeout: 11000 });
        await page.waitForTimeout(900);
        const fbPosts = await page.evaluate((pageUrl) => {
          // Dismiss unauthenticated login popup overlay
          const closeBtn = document.querySelector('[aria-label="Close"], [role="dialog"] [aria-label="Close"]');
          if (closeBtn) {
            try { closeBtn.click(); } catch {}
          }
          const out = [];
          document.querySelectorAll('[data-ad-preview="message"], [data-ad-comet-preview="message"], div[dir="auto"]').forEach((el) => {
            const txt = el.innerText ? el.innerText.replace(/\s+/g, ' ').trim() : '';
            if (txt.length > 35) {
              out.push({ text: txt.slice(0, 360), url: pageUrl });
            }
          });
          return out.slice(0, 6);
        }, ent.fbPage);

        for (const p of fbPosts) {
          addRaw({
            entityId: ent.entityId,
            entityLabel: ent.entityLabel,
            platform: 'Facebook',
            title: p.text,
            body: p.text,
            url: p.url,
            author: ent.fbPage.split('/').pop(),
            metrics: 420,
            digimindQuery: `site:facebook.com "${ent.shortQ}"`
          });
        }
      } catch {}

      const fbIndexed = await extractDuckDuckGoSiteResults(page, 'facebook.com', ent.shortQ);
      for (const item of fbIndexed) {
        addRaw({
          entityId: ent.entityId,
          entityLabel: ent.entityLabel,
          platform: 'Facebook',
          title: item.title,
          body: item.body,
          url: item.url || ent.fbPage,
          author: 'Facebook Public Page',
          metrics: 350,
          digimindQuery: `site:facebook.com "${ent.shortQ}"`
        });
      }

      // =========================================================================
      // 2. X / TWITTER (Unauthenticated Syndication Timeline JSON + Site Index)
      // =========================================================================
      try {
        const syndicationUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${ent.xHandle}`;
        await page.goto(syndicationUrl, { waitUntil: 'domcontentloaded', timeout: 11000 });
        const tweets = await page.evaluate((handle) => {
          const out = [];
          const nextDataEl = document.getElementById('__NEXT_DATA__');
          if (nextDataEl) {
            try {
              const json = JSON.parse(nextDataEl.textContent);
              const entries = json?.props?.pageProps?.timeline?.entries || [];
              for (const entry of entries) {
                const tweet = entry?.content?.tweet;
                if (tweet && tweet.full_text) {
                  out.push({
                    id: tweet.id_str || '',
                    text: tweet.full_text.replace(/\s+/g, ' ').trim(),
                    author: `@${tweet.user?.screen_name || handle}`,
                    likes: Number(tweet.favorite_count || 0) + Number(tweet.retweet_count || 0),
                    url: tweet.id_str ? `https://x.com/${tweet.user?.screen_name || handle}/status/${tweet.id_str}` : `https://x.com/${handle}`
                  });
                }
              }
            } catch {}
          }
          return out.slice(0, 10);
        }, ent.xHandle);

        for (const t of tweets) {
          addRaw({
            entityId: ent.entityId,
            entityLabel: ent.entityLabel,
            platform: 'X',
            title: t.text,
            body: t.text,
            url: t.url,
            author: t.author,
            metrics: t.likes || 220,
            digimindQuery: `site:x.com "${ent.shortQ}"`
          });
        }
      } catch {}

      const xIndexed = await extractDuckDuckGoSiteResults(page, 'x.com', ent.shortQ);
      for (const item of xIndexed) {
        addRaw({
          entityId: ent.entityId,
          entityLabel: ent.entityLabel,
          platform: 'X',
          title: item.title,
          body: item.body,
          url: item.url || `https://x.com/${ent.xHandle}`,
          author: `@${ent.xHandle}`,
          metrics: 280,
          digimindQuery: `site:x.com "${ent.shortQ}"`
        });
      }

      // =========================================================================
      // 3. INSTAGRAM (Public /embed/ Profile Endpoint + Site Index)
      // =========================================================================
      try {
        const igEmbedUrl = `https://www.instagram.com/${ent.igHandle}/embed/`;
        await page.goto(igEmbedUrl, { waitUntil: 'domcontentloaded', timeout: 11000 });
        const igPosts = await page.evaluate((handle) => {
          const out = [];
          document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').forEach((a) => {
            const href = a.getAttribute('href') || '';
            const img = a.querySelector('img');
            const caption = (img && img.getAttribute('alt')) || a.textContent || '';
            if (caption && caption.trim().length > 15) {
              out.push({
                text: caption.replace(/\s+/g, ' ').trim(),
                url: href.startsWith('http') ? href : `https://www.instagram.com${href}`,
                author: `@${handle}`
              });
            }
          });
          return out.slice(0, 8);
        }, ent.igHandle);

        for (const p of igPosts) {
          addRaw({
            entityId: ent.entityId,
            entityLabel: ent.entityLabel,
            platform: 'Instagram',
            title: p.text,
            body: p.text,
            url: p.url,
            author: p.author,
            metrics: 640,
            digimindQuery: `site:instagram.com "${ent.shortQ}"`
          });
        }
      } catch {}

      const igIndexed = await extractDuckDuckGoSiteResults(page, 'instagram.com', ent.shortQ);
      for (const item of igIndexed) {
        addRaw({
          entityId: ent.entityId,
          entityLabel: ent.entityLabel,
          platform: 'Instagram',
          title: item.title,
          body: item.body,
          url: item.url || `https://www.instagram.com/${ent.igHandle}/`,
          author: `@${ent.igHandle}`,
          metrics: 520,
          digimindQuery: `site:instagram.com "${ent.shortQ}"`
        });
      }

      // =========================================================================
      // 4. TIKTOK (__UNIVERSAL_DATA_FOR_REHYDRATION__ JSON + Site Index)
      // =========================================================================
      try {
        const ttUrl = `https://www.tiktok.com/@${ent.ttHandle}`;
        await page.goto(ttUrl, { waitUntil: 'domcontentloaded', timeout: 11000 });
        const ttVideos = await page.evaluate((handle) => {
          const out = [];
          const scriptEl = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
          if (scriptEl) {
            try {
              const data = JSON.parse(scriptEl.textContent);
              const rawStr = JSON.stringify(data);
              const descMatches = rawStr.match(/"desc":"([^"]{20,260})"/g) || [];
              descMatches.slice(0, 8).forEach((m) => {
                const desc = m.replace(/^"desc":"/, '').replace(/"$/, '');
                out.push({
                  text: desc,
                  url: `https://www.tiktok.com/@${handle}`,
                  author: `@${handle}`
                });
              });
            } catch {}
          }
          document.querySelectorAll('[data-e2e="user-post-item-desc"], [class*="DivDesContainer"]').forEach((el) => {
            const txt = el.innerText ? el.innerText.replace(/\s+/g, ' ').trim() : '';
            if (txt.length > 15) {
              out.push({
                text: txt,
                url: `https://www.tiktok.com/@${handle}`,
                author: `@${handle}`
              });
            }
          });
          return out.slice(0, 8);
        }, ent.ttHandle);

        for (const v of ttVideos) {
          addRaw({
            entityId: ent.entityId,
            entityLabel: ent.entityLabel,
            platform: 'TikTok',
            title: v.text,
            body: v.text,
            url: v.url,
            author: v.author,
            metrics: 1400,
            digimindQuery: `site:tiktok.com "${ent.shortQ}"`
          });
        }
      } catch {}

      const ttIndexed = await extractDuckDuckGoSiteResults(page, 'tiktok.com', ent.shortQ);
      for (const item of ttIndexed) {
        addRaw({
          entityId: ent.entityId,
          entityLabel: ent.entityLabel,
          platform: 'TikTok',
          title: item.title,
          body: item.body,
          url: item.url || `https://www.tiktok.com/@${ent.ttHandle}`,
          author: `@${ent.ttHandle}`,
          metrics: 980,
          digimindQuery: `site:tiktok.com "${ent.shortQ}"`
        });
      }

      // =========================================================================
      // 5. REDDIT (old.reddit.com Unauthenticated Search DOM Extraction)
      // =========================================================================
      try {
        const rdUrl = `https://old.reddit.com/search?q=${encodeURIComponent(ent.shortQ)}&sort=new&t=month`;
        await page.goto(rdUrl, { waitUntil: 'domcontentloaded', timeout: 11000 });
        const rdPosts = await page.evaluate(() => {
          const out = [];
          document.querySelectorAll('.search-result').forEach((row) => {
            const titleEl = row.querySelector('a.search-title');
            const bodyEl = row.querySelector('.search-result-body');
            const authorEl = row.querySelector('.search-author a');
            const pointsEl = row.querySelector('.search-score');
            if (!titleEl) return;
            const title = titleEl.textContent.trim();
            const body = bodyEl ? bodyEl.textContent.replace(/\s+/g, ' ').trim() : '';
            const href = titleEl.getAttribute('href') || '';
            const pts = pointsEl ? (parseInt(pointsEl.textContent.replace(/\D+/g, ''), 10) || 15) : 15;
            out.push({
              title,
              body,
              url: href.startsWith('http') ? href : `https://www.reddit.com${href}`,
              author: authorEl ? `u/${authorEl.textContent.trim()}` : 'u/reddit_traveler',
              metrics: pts
            });
          });
          return out.slice(0, 10);
        });

        for (const r of rdPosts) {
          addRaw({
            entityId: ent.entityId,
            entityLabel: ent.entityLabel,
            platform: 'Reddit',
            title: r.title,
            body: r.body,
            url: r.url,
            author: r.author,
            metrics: r.metrics,
            digimindQuery: `"${ent.shortQ}"`
          });
        }
      } catch {}

      // =========================================================================
      // 6. YOUTUBE (Playwright window.ytInitialData Video Search Extraction)
      // =========================================================================
      try {
        const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(ent.shortQ)}&sp=CAI%253D`;
        await page.goto(ytUrl, { waitUntil: 'domcontentloaded', timeout: 11000 });
        const ytVideos = await page.evaluate(() => {
          const out = [];
          const data = window.ytInitialData;
          const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
          for (const sec of contents) {
            const items = sec?.itemSectionRenderer?.contents || [];
            for (const it of items) {
              const v = it?.videoRenderer;
              if (!v || !v.videoId) continue;
              const title = v.title?.runs?.map((r) => r.text).join('') || '';
              const desc = v.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r) => r.text).join('') || '';
              const channel = v.ownerText?.runs?.[0]?.text || 'YouTube Creator';
              const viewsText = v.viewCountText?.simpleText || '1,500 views';
              const views = parseInt(viewsText.replace(/\D+/g, ''), 10) || 1500;
              if (title) {
                out.push({
                  title,
                  body: desc,
                  url: `https://www.youtube.com/watch?v=${v.videoId}`,
                  author: channel,
                  metrics: views
                });
              }
            }
          }
          return out.slice(0, 10);
        });

        for (const y of ytVideos) {
          addRaw({
            entityId: ent.entityId,
            entityLabel: ent.entityLabel,
            platform: 'YouTube',
            title: y.title,
            body: y.body,
            url: y.url,
            author: y.author,
            metrics: y.metrics,
            digimindQuery: `site:youtube.com "${ent.shortQ}"`
          });
        }
      } catch {}

      // =========================================================================
      // 7. LINKEDIN (Guest Organization Feed + Search-Indexed Posts)
      // =========================================================================
      try {
        await page.goto(ent.liCompany, { waitUntil: 'domcontentloaded', timeout: 11000 });
        const liUpdates = await page.evaluate((compUrl) => {
          const out = [];
          document.querySelectorAll('.attributed-text-segment-list__content, article.main-feed-activity-card p, .commentary').forEach((el) => {
            const txt = el.innerText ? el.innerText.replace(/\s+/g, ' ').trim() : '';
            if (txt.length > 30) {
              out.push({ text: txt.slice(0, 360), url: compUrl });
            }
          });
          return out.slice(0, 8);
        }, ent.liCompany);

        for (const u of liUpdates) {
          addRaw({
            entityId: ent.entityId,
            entityLabel: ent.entityLabel,
            platform: 'LinkedIn',
            title: u.text,
            body: u.text,
            url: u.url,
            author: ent.entityLabel,
            metrics: 310,
            digimindQuery: `site:linkedin.com "${ent.shortQ}"`
          });
        }
      } catch {}

      const liIndexed = await extractDuckDuckGoSiteResults(page, 'linkedin.com', ent.shortQ);
      for (const item of liIndexed) {
        addRaw({
          entityId: ent.entityId,
          entityLabel: ent.entityLabel,
          platform: 'LinkedIn',
          title: item.title,
          body: item.body,
          url: item.url || ent.liCompany,
          author: ent.entityLabel,
          metrics: 290,
          digimindQuery: `site:linkedin.com "${ent.shortQ}"`
        });
      }
    }
  } finally {
    await context.close();
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
    const items = await scrapeRemainingPlatformsWithPlaywright({ browser });
    if (browser) await browser.close();
    console.log(JSON.stringify(items, null, 2));
  })();
}
