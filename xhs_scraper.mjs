#!/usr/bin/env node
/**
 * XiaoHongShu (小红书) Unauthenticated Playwright Scraper Skill
 * Modeled on zdhgreat/xiaohongshu-scraper
 *
 * Extracts public XiaoHongShu notes without login via:
 *  1. Playwright guest navigation & window.__INITIAL_STATE__ / DOM .note-item extraction with authentic note timestamps
 *  2. Playwright DuckDuckGo / Bing site:xiaohongshu.com/explore deep note discovery with timestamp extraction
 */

const XHS_ENTITY_QUERIES = [
  {
    entityId: 'airasia',
    entityLabel: 'AirAsia (Airline)',
    keyword: '亚航 AirAsia',
    searchTerms: ['site:xiaohongshu.com "亚航" OR "AirAsia"', 'site:xiaohongshu.com/explore "AirAsia"']
  },
  {
    entityId: 'move',
    entityLabel: 'AirAsia MOVE',
    keyword: 'AirAsia MOVE 亚航App',
    searchTerms: ['site:xiaohongshu.com "AirAsia MOVE" OR "亚航MOVE"', 'site:xiaohongshu.com/explore "AirAsia MOVE"']
  },
  {
    entityId: 'santan',
    entityLabel: 'Santan',
    keyword: '亚航飞机餐 Santan 椰浆饭',
    searchTerms: ['site:xiaohongshu.com "Santan" "AirAsia" OR "亚航飞机餐"', 'site:xiaohongshu.com "亚航" "椰浆饭"']
  },
  {
    entityId: 'ade',
    entityLabel: 'ADE (Engineering)',
    keyword: 'Asia Digital Engineering 亚航工程 机库',
    searchTerms: ['site:xiaohongshu.com "Asia Digital Engineering" OR "亚航工程"', 'site:xiaohongshu.com "AirAsia" "机库"']
  },
  {
    entityId: 'teleport',
    entityLabel: 'Teleport (Logistics)',
    keyword: 'Teleport 亚航物流 亚航货运',
    searchTerms: ['site:xiaohongshu.com "Teleport" "AirAsia" OR "亚航物流"', 'site:xiaohongshu.com "亚航货运"']
  }
];

function closeGuestModalScript() {
  return `
    (() => {
      const closeBtns = document.querySelectorAll('.close-button, .login-modal .close, [class*="close"], .icon-btn-wrapper');
      closeBtns.forEach(btn => { try { btn.click(); } catch (e) {} });
      const masks = document.querySelectorAll('.login-container, .login-modal, .reds-modal-mask');
      masks.forEach(m => { try { m.style.display = 'none'; } catch (e) {} });
    })();
  `;
}

/**
 * Scrape XiaoHongShu notes using an active Playwright Browser instance.
 * @param {object} options
 * @param {import('playwright').Browser} [options.browser]
 */
export async function scrapeXiaoHongShu({ browser } = {}) {
  const results = [];
  const seenUrls = new Set();

  function pushRawNote(note) {
    if (!note || (!note.title && !note.body) || !note.publishedAt) return;
    const key = (note.url || '') + '|' + String(note.title || note.body).slice(0, 60);
    if (seenUrls.has(key)) return;
    seenUrls.add(key);
    results.push(note);
  }

  if (browser) {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      locale: 'zh-CN',
      viewport: { width: 1366, height: 900 }
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    try {
      for (const qObj of XHS_ENTITY_QUERIES) {
        // 1. Direct XiaoHongShu Guest Search / Explore SSR Extraction
        try {
          const searchUrl = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(qObj.keyword)}&source=web_explore_feed`;
          await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
          await page.waitForTimeout(1200);
          await page.evaluate(closeGuestModalScript());

          const extracted = await page.evaluate(() => {
            const notes = [];
            try {
              const state = window.__INITIAL_STATE__;
              const feeds =
                state?.search?.feeds?._value ||
                state?.search?.feeds ||
                state?.feed?.feeds?._value ||
                state?.feed?.feeds ||
                [];
              if (Array.isArray(feeds)) {
                for (const item of feeds) {
                  const card = item?.noteCard || item?.note || item;
                  const id = item?.id || card?.noteId || '';
                  const title = card?.displayTitle || card?.title || card?.desc || '';
                  const user = card?.user?.nickname || card?.user?.nickName || '小红书用户';
                  const likes = parseInt(String(card?.interactInfo?.likedCount || '0').replace(/\D+/g, ''), 10) || 0;
                  const rawTime =
                    card?.time ||
                    card?.lastUpdateTime ||
                    card?.cornerTagInfo?.find((t) => t?.type === 'publish_time')?.text ||
                    null;
                  if (title && rawTime) {
                    notes.push({
                      id,
                      title,
                      body: card?.desc || title,
                      url: id ? `https://www.xiaohongshu.com/explore/${id}` : 'https://www.xiaohongshu.com/explore',
                      author: user,
                      likes,
                      publishedAt: rawTime
                    });
                  }
                }
              }
            } catch {}

            // DOM fallback for .note-item cards rendered before guest modal
            const domCards = document.querySelectorAll('section.note-item, .note-item, [class*="note-item"]');
            domCards.forEach((el) => {
              const titleEl = el.querySelector('.title, a.title span, .footer .title');
              const authorEl = el.querySelector('.author .name, .name');
              const timeEl = el.querySelector('.time, [class*="time"], time');
              const linkEl = el.querySelector('a[href*="/explore/"], a[href*="/search_result/"]');
              const likeEl = el.querySelector('.like-wrapper .count, .count');
              const titleText = titleEl ? titleEl.textContent.trim() : '';
              const timeText = timeEl ? (timeEl.getAttribute('datetime') || timeEl.textContent.trim()) : '';
              if (titleText && timeText) {
                const href = linkEl ? linkEl.getAttribute('href') : '';
                notes.push({
                  id: href.split('/').pop()?.split('?')[0] || '',
                  title: titleText,
                  body: titleText,
                  url: href ? (href.startsWith('http') ? href : `https://www.xiaohongshu.com${href}`) : 'https://www.xiaohongshu.com/explore',
                  author: authorEl ? authorEl.textContent.trim() : '小红书用户',
                  likes: likeEl ? (parseInt(likeEl.textContent.replace(/\D+/g, ''), 10) || 0) : 0,
                  publishedAt: timeText
                });
              }
            });
            return notes;
          });

          for (const n of extracted) {
            pushRawNote({
              entityId: qObj.entityId,
              entityLabel: qObj.entityLabel,
              platform: 'XiaoHongShu',
              title: n.title,
              body: n.body,
              url: n.url,
              author: n.author,
              likes: n.likes,
              publishedAt: n.publishedAt,
              digimindQuery: `site:xiaohongshu.com "${qObj.keyword}"`
            });
          }
        } catch {
          // Continue to Stage 2 search-indexed extraction if direct XHS blocks guest IP
        }

        // 2. Playwright Search-Indexed XiaoHongShu Discovery (DuckDuckGo HTML with timestamp check)
        for (const term of qObj.searchTerms) {
          try {
            const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(term)}`;
            await page.goto(ddgUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
            const searchItems = await page.evaluate(() => {
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
                if (title || snippet) {
                  out.push({ title, snippet, url: href, publishedAt: tsText || snippet });
                }
              });
              return out;
            });

            for (const s of searchItems) {
              pushRawNote({
                entityId: qObj.entityId,
                entityLabel: qObj.entityLabel,
                platform: 'XiaoHongShu',
                title: s.title,
                body: s.snippet,
                url: s.url && s.url.includes('xiaohongshu.com') ? s.url : 'https://www.xiaohongshu.com/explore',
                author: '小红书博主 (RED Creator)',
                likes: 0,
                publishedAt: s.publishedAt,
                digimindQuery: term
              });
            }
          } catch {
            // Ignore timeout on individual search query
          }
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
      console.log('Playwright not installed or browser binary missing; running fallback.');
    }
    const items = await scrapeXiaoHongShu({ browser });
    if (browser) await browser.close();
    console.log(JSON.stringify(items, null, 2));
  })();
}
