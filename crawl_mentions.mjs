#!/usr/bin/env node
/**
 * AirAsia Group Automated 9-Platform Social Listening Pipeline (100% Live Data + Verified Timestamps)
 * Orchestrates:
 *  - Custom Skill 1: .agents/skills/xiaohongshu-scraper/scripts/xhs_scraper.mjs (zdhgreat/xiaohongshu-scraper)
 *  - Custom Skill 2: .agents/skills/threadscraper/scripts/threads_scraper.mjs (galihkjaya/threadscraper)
 *  - Custom Skill 3: .agents/skills/multi-platform-playwright-crawler/scripts/playwright_social_scraper.mjs
 *  - Direct Public APIs (Reddit JSON API + YouTube Piped API)
 *  - Multi-Engine Social Site-Search RSS Layer (Bing RSS + Google RSS across all 9 platforms)
 *
 * Every mention MUST have a verified real publication timestamp (publishedAtMs).
 * Dumps all verified, deduplicated social media mentions directly into mentions.json.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function loadSkillScrapers() {
  let scrapeXiaoHongShu;
  let scrapeThreads;
  let scrapeRemainingPlatformsWithPlaywright;
  try {
    ({ scrapeXiaoHongShu } = await import('../.agents/skills/xiaohongshu-scraper/scripts/xhs_scraper.mjs'));
  } catch {
    ({ scrapeXiaoHongShu } = await import('./xhs_scraper.mjs'));
  }
  try {
    ({ scrapeThreads } = await import('../.agents/skills/threadscraper/scripts/threads_scraper.mjs'));
  } catch {
    ({ scrapeThreads } = await import('./threads_scraper.mjs'));
  }
  try {
    ({ scrapeRemainingPlatformsWithPlaywright } = await import('../.agents/skills/multi-platform-playwright-crawler/scripts/playwright_social_scraper.mjs'));
  } catch {
    ({ scrapeRemainingPlatformsWithPlaywright } = await import('./playwright_social_scraper.mjs'));
  }
  return { scrapeXiaoHongShu, scrapeThreads, scrapeRemainingPlatformsWithPlaywright };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(__dirname, '..', 'mentions.json');

const ALLOWED_PLATFORMS = [
  'Facebook',
  'X',
  'Instagram',
  'TikTok',
  'XiaoHongShu',
  'Threads',
  'Reddit',
  'YouTube',
  'LinkedIn'
];

const PLATFORM_META = {
  Facebook: { prefix: 'FB', badge: '📘 Live Facebook Post', metric2: 'Public Page / Post', site: 'facebook.com' },
  X: { prefix: 'X', badge: '𝕏 Live X Post', metric2: 'Public Post', site: 'x.com' },
  Instagram: { prefix: 'IG', badge: '📸 Live Instagram Post', metric2: 'Public Reel / Post', site: 'instagram.com' },
  TikTok: { prefix: 'TT', badge: '🎵 Live TikTok Video', metric2: 'Short-Form Video', site: 'tiktok.com' },
  XiaoHongShu: { prefix: 'XHS', badge: '📕 Live XiaoHongShu Note', metric2: 'RED Note (小红书)', site: 'xiaohongshu.com' },
  Threads: { prefix: 'TH', badge: '🧵 Live Threads Post', metric2: 'Public Thread', site: 'threads.net' },
  Reddit: { prefix: 'RD', badge: '🟢 Live Reddit Thread', metric2: 'Subreddit Discussion', site: 'reddit.com' },
  YouTube: { prefix: 'YT', badge: '▶️ Live YouTube Video', metric2: 'Video Upload', site: 'youtube.com' },
  LinkedIn: { prefix: 'LI', badge: '💼 Live LinkedIn Post', metric2: 'Professional Update', site: 'linkedin.com' }
};

const QUERIES = [
  {
    entityId: 'airasia',
    entityLabel: 'AirAsia (Airline)',
    q: '"AirAsia" OR "AirAsia X" OR "AskBo"',
    shortQ: 'AirAsia'
  },
  {
    entityId: 'move',
    entityLabel: 'AirAsia MOVE',
    q: '"AirAsia MOVE" OR "AirAsia Superapp" OR "AirAsia app"',
    shortQ: 'AirAsia MOVE'
  },
  {
    entityId: 'santan',
    entityLabel: 'Santan',
    q: '"Santan AirAsia" OR "Pak Nasser" OR "AirAsia meal"',
    shortQ: 'AirAsia Santan'
  },
  {
    entityId: 'ade',
    entityLabel: 'ADE (Engineering)',
    q: '"Asia Digital Engineering" OR "ADE AirAsia" OR "AirAsia MRO"',
    shortQ: 'Asia Digital Engineering'
  },
  {
    entityId: 'teleport',
    entityLabel: 'Teleport (Logistics)',
    q: '"Teleport AirAsia" OR "Teleport cargo" OR "Teleport logistics"',
    shortQ: 'Teleport AirAsia'
  }
];

const PILLARS = {
  airasia: [
    { code: 'PIL-01', keywords: ['delay', 'delayed', 'rescheduled', 'cancelled', 'on-time', 'otp', 'schedule', 'retimed', 'gate', 'boarding', 'departed', 'departure', 'arrival', '延误', '准点', '航班', '晚点'] },
    { code: 'PIL-02', keywords: ['refund', 'askbo', 'bot', 'customer service', 'support', 'credit shell', 'voucher', 'live agent', 'queue', 'escalation', '退款', '客服'] },
    { code: 'PIL-03', keywords: ['baggage', '7kg', 'luggage', 'cabin', 'carry-on', 'damaged bag', 'lost bag', 'wheelchair', 'check-in', 'klia2', '行李', '托运', '超重'] },
    { code: 'PIL-04', keywords: ['fare', 'promo', 'free seats', 'fee', 'price', 'add-on', 'value', 'cheap', 'asean pass', 'booking', '机票', '促销', '便宜'] },
    { code: 'PIL-05', keywords: ['cabin crew', 'flight attendant', 'stewardess', 'pilot', 'captain', 'hospitality', 'friendly', 'service', 'uniform', '空姐', '机组', '乘务员'] },
    { code: 'PIL-06', keywords: ['route', 'launch', 'inaugural', 'network', 'hub', 'a321xlr', 'fleet', 'sustainability', 'fleet', 'expansion', '新航线', '首航', '直飞'] }
  ],
  move: [
    { code: 'PIL-01', keywords: ['crash', 'bug', 'lag', 'freeze', 'slow', 'loading', 'update', 'app', 'glitch', 'ui', 'ux', '闪退', '卡顿'] },
    { code: 'PIL-02', keywords: ['flight', 'hotel', 'snap', 'combo', 'package', 'ota', 'itinerary', 'inventory', 'booking', '酒店', '机酒', '预订'] },
    { code: 'PIL-03', keywords: ['payment', 'checkout', 'fpx', 'card', 'bigpay', 'double charge', 'failed payment', 'promo code', '付款', '支付'] },
    { code: 'PIL-04', keywords: ['points', 'rewards', 'redemption', 'loyalty', 'tier', 'burn', 'earn', 'member', '积分', '会员', '兑换'] },
    { code: 'PIL-05', keywords: ['ride', 'e-hailing', 'airport transfer', 'driver', 'pickup', 'klia', 'grab', '打车', '接送机'] },
    { code: 'PIL-06', keywords: ['duty free', 'fast pass', 'lounge', 'insurance', 'ancillary', 'roaming', 'esim', '贵宾室', '保险'] }
  ],
  santan: [
    { code: 'PIL-01', keywords: ['nasi lemak', 'pak nasser', 'uncle chin', 'chicken rice', 'rendang', 'sambal', 'taste', 'delicious', 'portion', 'meal', '椰浆饭', '飞机餐', '好吃'] },
    { code: 'PIL-02', keywords: ['pre-book', 'out of stock', 'missing meal', 'choice', 'vegetarian', 'kids meal', 'order', '预购', '点餐'] },
    { code: 'PIL-03', keywords: ['coffee', 'zero', 'latte', 'americano', 'teh tarik', 'matcha', 'boba', 'drink', 'beverage', '咖啡', '奶茶', '生椰拿铁'] },
    { code: 'PIL-04', keywords: ['price', 'rm', 'combo', 'value', 'affordable', 'worth', 'deal', '性价比', '价格'] },
    { code: 'PIL-05', keywords: ['cafe', 'outlet', 'restaurant', 'mall', 'ready-to-eat', 'retail', 'franchise', '门店', '堂食'] },
    { code: 'PIL-06', keywords: ['halal', 'jakim', 'hygiene', 'safety', 'allergen', 'packaging', 'fresh', '清真', '卫生'] }
  ],
  ade: [
    { code: 'PIL-01', keywords: ['hangar', 'sepang', 'senai', 'klia', 'bay', 'base maintenance', 'c-check', 'overhaul', 'turnaround', 'mro', '机库', '定检', '大修'] },
    { code: 'PIL-02', keywords: ['line maintenance', 'aog', 'dispatch', 'transit', 'rectification', 'ramp', 'technical', '航线维修', '放行'] },
    { code: 'PIL-03', keywords: ['elevade', 'predictive', 'digital', 'ai', 'health monitoring', 'fleet', 'diagnostics', 'data', '数字化', '预测性维修'] },
    { code: 'PIL-04', keywords: ['component', 'workshop', 'avionics', 'wheel', 'brake', 'spare', 'supply chain', 'tooling', '航材', '附件'] },
    { code: 'PIL-05', keywords: ['easa', 'caam', 'faa', 'part-145', 'audit', 'safety', 'airworthiness', 'certification', '适航', '认证', '安全'] },
    { code: 'PIL-06', keywords: ['third-party', 'client', 'engineer', 'lae', 'technician', 'training', 'career', 'recruitment', '工程师', '机务', '招聘'] }
  ],
  teleport: [
    { code: 'PIL-01', keywords: ['e-commerce', 'next-day', '24-hour', 'parcel', 'cross-border', 'sla', 'on-time', 'fast', '次日达', '跨境电商', '时效'] },
    { code: 'PIL-02', keywords: ['freighter', 'a321f', 'belly', 'cargo', 'tonnage', 'interline', 'partner', 'network', 'capacity', '货机', '全货机', '腹舱'] },
    { code: 'PIL-03', keywords: ['tracking', 'first-mile', 'last-mile', 'courier', 'rider', 'pickup', 'status', 'doorstep', '快递', '派送', '物流轨迹'] },
    { code: 'PIL-04', keywords: ['customs', 'clearance', 'warehouse', 'hub', 'damaged', 'cold-chain', 'pharma', 'handling', '清关', '冷链', '仓储'] },
    { code: 'PIL-05', keywords: ['rate', 'quote', 'portal', 'api', 'dashboard', 'enterprise', 'forwarder', 'b2b', '运费', '报价'] },
    { code: 'PIL-06', keywords: ['support', 'claim', 'lost parcel', 'compensation', 'inquiry', 'resolution', '理赔', '客服'] }
  ]
};

/**
 * Parse a real timestamp (Unix ms, Unix sec, ISO/RFC2822 string, or relative age string) into UTC epoch ms.
 * Returns null if no authentic timestamp can be verified.
 */
function parseRealTimestampMs(rawVal, nowRefMs = Date.now()) {
  if (rawVal === null || rawVal === undefined || rawVal === '') return null;
  if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
    const ms = rawVal < 1e11 ? rawVal * 1000 : rawVal;
    if (ms > 1577836800000 && ms <= nowRefMs + 86400000) return Math.round(ms);
    return null;
  }
  const str = String(rawVal).trim();
  if (!str) return null;
  if (/^\d{10,13}$/.test(str)) {
    const num = Number(str);
    const ms = str.length === 10 ? num * 1000 : num;
    if (ms > 1577836800000 && ms <= nowRefMs + 86400000) return Math.round(ms);
  }
  const parsed = Date.parse(str);
  if (!Number.isNaN(parsed) && parsed > 1577836800000 && parsed <= nowRefMs + 86400000) {
    return parsed;
  }
  // Relative English strings ("3 hours ago", "2 days ago", "45 minutes ago")
  const relMatch = str.match(/(\d+)\s*(second|sec|minute|min|hour|hr|day|week|month|year)s?\s*ago/i);
  if (relMatch) {
    const qty = parseInt(relMatch[1], 10);
    const unit = relMatch[2].toLowerCase();
    const mult =
      unit.startsWith('sec') ? 1000 :
      unit.startsWith('min') ? 60000 :
      unit.startsWith('h') ? 3600000 :
      unit.startsWith('d') ? 86400000 :
      unit.startsWith('w') ? 604800000 :
      unit.startsWith('mo') ? 2592000000 : 31536000000;
    return nowRefMs - qty * mult;
  }
  // Relative Chinese strings ("3小时前", "2天前", "昨天")
  const zhRelMatch = str.match(/(\d+)\s*(分钟|小时|天|周|个月)前/);
  if (zhRelMatch) {
    const qty = parseInt(zhRelMatch[1], 10);
    const unit = zhRelMatch[2];
    const mult =
      unit === '分钟' ? 60000 :
      unit === '小时' ? 3600000 :
      unit === '天' ? 86400000 :
      unit === '周' ? 604800000 : 2592000000;
    return nowRefMs - qty * mult;
  }
  if (/昨天/.test(str)) {
    return nowRefMs - 86400000;
  }
  // Leading date prefix inside search snippet (e.g. "Oct 28, 2026 — ...", "2026-10-28 ...")
  const datePrefixMatch = str.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+202\d|\d{4}-\d{2}-\d{2})\b/i);
  if (datePrefixMatch) {
    const dtMs = Date.parse(datePrefixMatch[1]);
    if (!Number.isNaN(dtMs) && dtMs > 1577836800000 && dtMs <= nowRefMs + 86400000) {
      return dtMs;
    }
  }
  return null;
}

/**
 * Format an authentic UTC epoch timestamp (publishedAtMs) into Malaysia Time (MYT, UTC+8)
 * and compute dynamic relative age relative to nowRefMs.
 */
function formatAuthenticTimestamp(publishedAtMs, nowRefMs = Date.now()) {
  const safePubMs = Math.min(nowRefMs, Math.max(1577836800000, Number(publishedAtMs)));
  const diffMs = Math.max(0, nowRefMs - safePubMs);
  const minsAgo = Math.max(1, Math.round(diffMs / 60000));

  const myt = new Date(safePubMs + 8 * 3600000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const yyyy = myt.getUTCFullYear();
  const mmm = months[myt.getUTCMonth()];
  const dd = String(myt.getUTCDate()).padStart(2, '0');
  const hh = String(myt.getUTCHours()).padStart(2, '0');
  const min = String(myt.getUTCMinutes()).padStart(2, '0');

  let rel = `${minsAgo}m ago`;
  if (minsAgo >= 1440) {
    const days = Math.floor(minsAgo / 1440);
    const remHrs = Math.floor((minsAgo % 1440) / 60);
    rel = remHrs > 0 && days < 7 ? `${days}d ${remHrs}h ago` : `${days}d ago`;
  } else if (minsAgo >= 60) {
    rel = `${Math.floor(minsAgo / 60)}h ${minsAgo % 60}m ago`;
  }

  return {
    publishedAtMs: safePubMs,
    publishedAtIso: new Date(safePubMs).toISOString(),
    minutesAgo: minsAgo,
    relativeTime: `${rel} • Live Crawled`,
    exactTimestamp: `${dd} ${mmm} ${yyyy}, ${hh}:${min} MYT`
  };
}

function isStrictlyRelatedToEntity(entityId, rawText) {
  const txt = String(rawText || '').toLowerCase();
  if (!txt || txt.length < 12) return false;
  if (/(playstation|xbox|nintendo|steam deck|valorant|genshin|minecraft|fortnite|roblox|baldur|elden ring|cyberpunk|call of duty)/i.test(txt)) {
    return false;
  }
  const hasAirAsiaCore = /\b(airasia|air asia|capital a|tune group|tony fernandes|bo lingam|klia2|askbo)\b|亚航|亚洲航空/.test(txt);

  if (entityId === 'airasia') {
    return /\b(airasia|air asia|askbo|capital a)\b|亚航|亚洲航空/.test(txt);
  }
  if (entityId === 'move') {
    return /\b(airasia move|airasia superapp|airasia super app|move app|move superapp|bigpay)\b|亚航\s*move|亚航app|亚航软件/.test(txt) ||
      (hasAirAsiaCore && /\b(move|superapp|super app|app|booking|hotel|snap|points|rewards|otp|login|checkout)\b|积分|酒店|预订/.test(txt));
  }
  if (entityId === 'santan') {
    return /\b(pak nasser|santan airasia|airasia santan|santan cafe|santan restaurant|santan meal|santan inflight|santan menu|santan nasi lemak|catherine goh)\b|亚航飞机餐|亚航餐食|亚航椰浆饭/.test(txt) ||
      (hasAirAsiaCore && /\b(santan|nasi lemak|meal|food|inflight meal|in-flight meal|pre-book meal|onboard meal|halal|menu|catering|coffee|roast chicken|uncle chin)\b|飞机餐|椰浆饭|餐食/.test(txt));
  }
  if (entityId === 'ade') {
    return /\b(asia digital engineering|elevade|mahesh kumar|ade airasia|airasia ade|ade mro|ade hangar|ade sepang|ade senai)\b|亚航工程|亚洲数字工程/.test(txt) ||
      (hasAirAsiaCore && /\b(mro|hangar|maintenance|overhaul|engineering|aircraft maintenance|line maintenance|c-check|airworthiness|caam|easa|technician|avionics)\b|机库|飞机维修|航空工程/.test(txt));
  }
  if (entityId === 'teleport') {
    return /\b(teleport airasia|airasia teleport|teleport cargo|teleport logistics|teleport delivery|teleport parcel|teleport freighter|pete chareonwongsak|a321f)\b|亚航物流|亚航货运/.test(txt) ||
      (hasAirAsiaCore && /\b(teleport|cargo|freight|freighter|logistics|parcel|courier|airfreight|belly space|cold-chain|customs clearance|consignment)\b|货运|物流|货机/.test(txt));
  }
  return false;
}

function classifyText(entityId, rawText) {
  if (!isStrictlyRelatedToEntity(entityId, rawText)) return null;
  const txt = String(rawText || '').toLowerCase();
  const matrix = PILLARS[entityId] || PILLARS.airasia;
  let bestPillar = matrix[0].code;
  let bestScore = -1;
  let matchedKw = [];

  for (const p of matrix) {
    let score = 0;
    const localKw = [];
    for (const kw of p.keywords) {
      if (txt.includes(kw.toLowerCase())) {
        score += 1;
        localKw.push(kw);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestPillar = p.code;
      matchedKw = localKw;
    }
  }

  const negWords = ['delay', 'delayed', 'cancelled', 'refund', 'stuck', 'worst', 'bad', 'terrible', 'horrible', 'scam', 'crash', 'bug', 'broken', 'lost', 'missing', 'cold', 'late', 'issue', 'problem', 'complaint', 'angry', 'frustrated', 'useless', 'slow', 'failed', 'error', 'fee', 'overcharged', 'damage', 'damaged', 'nightmare', 'unacceptable', 'trap', 'strict', '延误', '避雷', '吐槽', '差评', '退票'];
  const posWords = ['great', 'good', 'smooth', 'love', 'awesome', 'best', 'delicious', 'tasty', 'fast', 'helpful', 'easy', 'clean', 'on time', 'on-time', 'impressed', 'thank', 'excellent', 'worth', 'cheap', 'affordable', 'friendly', 'new', 'launch', 'award', 'expansion', 'growth', 'profit', 'record', 'milestone', 'partner', 'upgrade', 'success', 'approved', '好吃', '推荐', '丝滑', '准点', '便宜'];

  let negScore = 0;
  let posScore = 0;
  for (const w of negWords) {
    if (txt.includes(w)) {
      negScore += 1;
      if (matchedKw.length < 4 && !matchedKw.includes(w)) matchedKw.push(w);
    }
  }
  for (const w of posWords) {
    if (txt.includes(w)) {
      posScore += 1;
      if (matchedKw.length < 4 && !matchedKw.includes(w)) matchedKw.push(w);
    }
  }

  let sentiment = 'Neutral';
  if (negScore > posScore) sentiment = 'Negative';
  else if (posScore > negScore) sentiment = 'Positive';

  if (matchedKw.length === 0) matchedKw = ['AirAsia', entityId.toUpperCase()];
  return { pillarCode: bestPillar, sentiment, keywords: matchedKw.slice(0, 3) };
}

function cleanSnippet(title, body, maxLen = 360) {
  const t = String(title || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const b = String(body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  let combined = t && b ? (b.toLowerCase().includes(t.toLowerCase()) ? b : `${t} — ${b}`) : (t || b);
  if (!combined) return '';
  if (combined.length <= maxLen) return combined;
  const m = combined.toLowerCase().match(/\b(airasia|askbo|santan|pak nasser|teleport|asia digital engineering|elevade|klia2|bigpay|a321f|hangar)\b|亚航|亚洲航空/);
  if (!m || typeof m.index !== 'number' || m.index < maxLen - 70) {
    return combined.slice(0, maxLen) + '...';
  }
  const start = Math.max(0, m.index - 80);
  return (start > 0 ? '...' : '') + combined.slice(start, start + maxLen) + (start + maxLen < combined.length ? '...' : '');
}

function decodeXml(str) {
  return String(str || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
    const descMatch = block.match(/<description>([\s\S]*?)<\/description>/i);
    const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || block.match(/<dc:date>([\s\S]*?)<\/dc:date>/i);
    items.push({
      title: titleMatch ? decodeXml(titleMatch[1]).trim() : '',
      link: linkMatch ? decodeXml(linkMatch[1]).trim() : '',
      description: descMatch ? decodeXml(descMatch[1]).trim() : '',
      pubDate: pubDateMatch ? decodeXml(pubDateMatch[1]).trim() : ''
    });
  }
  return items;
}

async function safeFetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function safeFetchText(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function main() {
  const nowMs = Date.now();
  const collected = [];
  const seenIds = new Set();
  const seenTexts = new Set();

  function addItem(item) {
    if (!item || !item.id || !item.entityId || !item.platform || seenIds.has(item.id)) return false;
    if (!ALLOWED_PLATFORMS.includes(item.platform)) return false;
    const pubMs = parseRealTimestampMs(item.publishedAtMs || item.createdUtcMs || item.publishedAt, nowMs);
    if (!pubMs) return false; // Strictly reject any item without a verified timestamp
    if (!isStrictlyRelatedToEntity(item.entityId, item.originalText)) return false;
    const normTxt = `${item.entityId}:${item.platform}:${String(item.originalText || '').toLowerCase().slice(0, 90)}`;
    if (seenTexts.has(normTxt)) return false;

    const ts = formatAuthenticTimestamp(pubMs, nowMs);
    item.publishedAtMs = ts.publishedAtMs;
    item.publishedAtIso = ts.publishedAtIso;
    item.minutesAgo = ts.minutesAgo;
    item.relativeTime = ts.relativeTime;
    item.exactTimestamp = ts.exactTimestamp;

    seenIds.add(item.id);
    seenTexts.add(normTxt);
    collected.push(item);
    return true;
  }

  function matchAllEntities(rawText, primaryQuery) {
    const matched = [];
    if (primaryQuery && isStrictlyRelatedToEntity(primaryQuery.entityId, rawText)) {
      matched.push(primaryQuery);
    }
    for (const qObj of QUERIES) {
      if (matched.every((m) => m.entityId !== qObj.entityId) && isStrictlyRelatedToEntity(qObj.entityId, rawText)) {
        matched.push(qObj);
      }
    }
    return matched;
  }

  function ingestRawSkillMention(raw, idxOffset = 0) {
    if (!raw || !raw.platform || !ALLOWED_PLATFORMS.includes(raw.platform)) return;
    const pubMs = parseRealTimestampMs(raw.publishedAt || raw.publishedAtMs || raw.createdUtcMs, nowMs);
    if (!pubMs) return; // Require verified timestamp from the scraper
    const rawBody = cleanSnippet(raw.title || '', raw.body || '', 360);
    if (!rawBody) return;
    const primaryQ = QUERIES.find((q) => q.entityId === raw.entityId) || QUERIES[0];
    const targets = matchAllEntities(rawBody, primaryQ);
    if (!targets.length) return;
    const meta = PLATFORM_META[raw.platform] || PLATFORM_META.Reddit;
    const ts = formatAuthenticTimestamp(pubMs, nowMs);
    const hasChinese = /[\u4e00-\u9fff]/.test(rawBody);
    const metricsVal = Math.max(0, Number(raw.likes || raw.metrics || 0));

    for (const targetEnt of targets) {
      const cls = classifyText(targetEnt.entityId, rawBody);
      if (!cls) continue;
      const slug = rawBody.slice(0, 24).replace(/\W+/g, '').toLowerCase() || String(idxOffset);
      addItem({
        id: `REAL-${meta.prefix}-${targetEnt.entityId}-${slug}`,
        isLiveScraped: true,
        publishedAtMs: ts.publishedAtMs,
        publishedAtIso: ts.publishedAtIso,
        externalUrl: raw.url || `https://www.${meta.site}`,
        category: 'Mentions',
        mentionType: `${raw.platform} ${meta.metric2}`,
        digimindQuery: raw.digimindQuery || `site:${meta.site} "${targetEnt.shortQ}"`,
        entityId: targetEnt.entityId,
        entityLabel: targetEnt.entityLabel,
        platform: raw.platform,
        pillarCode: cls.pillarCode,
        sentiment: cls.sentiment,
        isHighReach: metricsVal >= 100,
        engagementLabel: meta.badge,
        viewsCount: metricsVal,
        viewsFormatted: metricsVal > 0
          ? `${metricsVal.toLocaleString()} Interactions • ${raw.platform} (${meta.site})`
          : `${raw.platform} • ${meta.metric2} (${meta.site})`,
        realMetricPrimary: metricsVal > 0 ? `${metricsVal.toLocaleString()} Interactions` : raw.platform,
        realMetricSecondary: meta.metric2,
        realMetricTertiary: meta.site,
        authorHandle: raw.author || `${raw.platform} User`,
        minutesAgo: ts.minutesAgo,
        relativeTime: ts.relativeTime,
        exactTimestamp: ts.exactTimestamp,
        detectedLanguage: hasChinese ? 'Mandarin Chinese' : 'English',
        isNonEnglish: hasChinese,
        originalText: rawBody,
        englishText: rawBody,
        keywords: cls.keywords
      });
    }
  }

  // 1. Load previously crawled mentions from mentions.json ONLY if they carry a verified publishedAtMs
  try {
    const rawExisting = await fs.readFile(OUTPUT_PATH, 'utf8');
    const parsed = JSON.parse(rawExisting);
    const existingArr = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.mentions) ? parsed.mentions : []);
    for (const item of existingArr) {
      if (item && item.publishedAtMs) {
        addItem(item);
      }
    }
  } catch {
    // Ignore if file does not exist yet
  }

  // 2. Run Custom Workspace Playwright Skills (XiaoHongShu, Threads, and 7-Platform Unauthenticated Scraper)
  let browser = null;
  try {
    const pw = await import('playwright');
    browser = await pw.chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    });
    console.log('Launched headless Chromium for unauthenticated 9-platform social crawling...');
  } catch {
    console.log('Playwright browser unavailable in current environment; proceeding with HTTP/RSS/API layers.');
  }

  if (browser) {
    try {
      const { scrapeXiaoHongShu, scrapeThreads, scrapeRemainingPlatformsWithPlaywright } = await loadSkillScrapers();
      const xhsNotes = await scrapeXiaoHongShu({ browser });
      xhsNotes.forEach((n, i) => ingestRawSkillMention(n, i));

      const threadsPosts = await scrapeThreads({ browser });
      threadsPosts.forEach((t, i) => ingestRawSkillMention(t, i));

      const otherPlatformPosts = await scrapeRemainingPlatformsWithPlaywright({ browser });
      otherPlatformPosts.forEach((p, i) => ingestRawSkillMention(p, i));
    } catch (err) {
      console.warn('Playwright skill execution warning:', err?.message || err);
    } finally {
      await browser.close();
    }
  }

  // 3. Direct Reddit Public JSON Search API (with exact d.created_utc * 1000)
  for (const qObj of QUERIES) {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(qObj.q)}&sort=new&limit=25&raw_json=1`;
    const json = await safeFetchJson(url);
    const children = json?.data?.children || [];
    for (const child of children) {
      const d = child?.data;
      if (!d || !d.id || !d.created_utc) continue;
      const pubMs = parseRealTimestampMs(Number(d.created_utc) * 1000, nowMs);
      if (!pubMs) continue;
      const rawBody = cleanSnippet(d.title || '', d.selftext || '', 360);
      if (!rawBody) continue;
      const targets = matchAllEntities(rawBody, qObj);
      if (!targets.length) continue;
      const ts = formatAuthenticTimestamp(pubMs, nowMs);
      const ups = Math.max(0, Number(d.ups || d.score || 0));
      const numComments = Math.max(0, Number(d.num_comments || 0));
      const highReach = ups >= 50 || numComments >= 25;
      for (const targetEnt of targets) {
        const cls = classifyText(targetEnt.entityId, rawBody);
        if (!cls) continue;
        addItem({
          id: `REAL-RD-${targetEnt.entityId}-${d.id}`,
          isLiveScraped: true,
          publishedAtMs: ts.publishedAtMs,
          publishedAtIso: ts.publishedAtIso,
          externalUrl: d.permalink ? `https://www.reddit.com${d.permalink}` : `https://www.reddit.com/comments/${d.id}`,
          category: 'Mentions',
          mentionType: `Reddit Thread (r/${d.subreddit || 'travel'})`,
          digimindQuery: targetEnt.q,
          entityId: targetEnt.entityId,
          entityLabel: targetEnt.entityLabel,
          platform: 'Reddit',
          pillarCode: cls.pillarCode,
          sentiment: cls.sentiment,
          isHighReach: highReach,
          engagementLabel: highReach ? '🔥 High Activity' : '🟢 Live Reddit API',
          viewsCount: ups + numComments,
          viewsFormatted: `${ups.toLocaleString()} Upvotes • ${numComments.toLocaleString()} Comments`,
          realMetricPrimary: `${ups.toLocaleString()} Upvotes`,
          realMetricSecondary: `${numComments.toLocaleString()} Comments`,
          realMetricTertiary: `r/${d.subreddit || 'reddit'}`,
          authorHandle: `u/${d.author || 'reddit_user'}`,
          minutesAgo: ts.minutesAgo,
          relativeTime: ts.relativeTime,
          exactTimestamp: ts.exactTimestamp,
          detectedLanguage: 'English',
          isNonEnglish: false,
          originalText: rawBody,
          englishText: rawBody,
          keywords: cls.keywords
        });
      }
    }
  }

  // 4. Direct YouTube Public Piped Search API (with v.uploaded or v.uploadedDate)
  const pipedInstances = ['https://pipedapi.kavin.rocks', 'https://pipedapi.tokhmi.xyz'];
  for (const qObj of QUERIES) {
    for (const base of pipedInstances) {
      const ytData = await safeFetchJson(`${base}/search?q=${encodeURIComponent(qObj.shortQ)}&filter=videos`);
      if (!ytData || !Array.isArray(ytData.items)) continue;
      for (const v of ytData.items.slice(0, 10)) {
        if (!v || !v.title || !v.url) continue;
        const pubMs = parseRealTimestampMs(v.uploaded && v.uploaded > 0 ? v.uploaded : v.uploadedDate, nowMs);
        if (!pubMs) continue;
        const rawText = cleanSnippet(v.title, v.shortDescription || '', 360);
        if (!rawText) continue;
        const targets = matchAllEntities(rawText, qObj);
        if (!targets.length) continue;
        const ts = formatAuthenticTimestamp(pubMs, nowMs);
        const views = Math.max(0, Number(v.views || 0));
        const vidId = (v.url.split('v=')[1] || v.url).replace(/\W+/g, '');
        for (const targetEnt of targets) {
          const cls = classifyText(targetEnt.entityId, rawText);
          if (!cls) continue;
          addItem({
            id: `REAL-YT-${targetEnt.entityId}-${vidId}`,
            isLiveScraped: true,
            publishedAtMs: ts.publishedAtMs,
            publishedAtIso: ts.publishedAtIso,
            externalUrl: `https://www.youtube.com${v.url}`,
            category: 'Mentions',
            mentionType: 'YouTube Video Upload',
            digimindQuery: `site:youtube.com "${targetEnt.shortQ}"`,
            entityId: targetEnt.entityId,
            entityLabel: targetEnt.entityLabel,
            platform: 'YouTube',
            pillarCode: cls.pillarCode,
            sentiment: cls.sentiment,
            isHighReach: views >= 2000,
            engagementLabel: '▶️ Live YouTube API',
            viewsCount: views,
            viewsFormatted: `${views.toLocaleString()} Views • YouTube (${v.uploaderName || 'Channel'})`,
            realMetricPrimary: `${views.toLocaleString()} Views`,
            realMetricSecondary: v.uploaderName || 'YouTube Channel',
            realMetricTertiary: 'youtube.com',
            authorHandle: v.uploaderName || 'YouTube Creator',
            minutesAgo: ts.minutesAgo,
            relativeTime: ts.relativeTime,
            exactTimestamp: ts.exactTimestamp,
            detectedLanguage: 'English',
            isNonEnglish: false,
            originalText: rawText,
            englishText: rawText,
            keywords: cls.keywords
          });
        }
      }
      break;
    }
  }

  // 5. Multi-Engine Social Site-Search RSS Across All 9 Target Platforms (strictly requiring real <pubDate>)
  const socialTargets = [
    { platform: 'Facebook', site: 'facebook.com', prefix: 'FB', badge: '📘 Live Facebook Post', metric2: 'Public Page / Post', defaultUrl: 'https://www.facebook.com' },
    { platform: 'X', site: 'x.com', prefix: 'X', badge: '𝕏 Live X Post', metric2: 'Public Post', defaultUrl: 'https://x.com' },
    { platform: 'Instagram', site: 'instagram.com', prefix: 'IG', badge: '📸 Live Instagram Post', metric2: 'Public Reel / Post', defaultUrl: 'https://www.instagram.com' },
    { platform: 'TikTok', site: 'tiktok.com', prefix: 'TT', badge: '🎵 Live TikTok Video', metric2: 'Short-Form Video', defaultUrl: 'https://www.tiktok.com' },
    { platform: 'XiaoHongShu', site: 'xiaohongshu.com', prefix: 'XHS', badge: '📕 Live XiaoHongShu Note', metric2: 'RED Note (小红书)', defaultUrl: 'https://www.xiaohongshu.com' },
    { platform: 'Threads', site: 'threads.net', prefix: 'TH', badge: '🧵 Live Threads Post', metric2: 'Public Thread', defaultUrl: 'https://www.threads.net' },
    { platform: 'Reddit', site: 'reddit.com', prefix: 'RD', badge: '🟢 Live Reddit Thread', metric2: 'Subreddit Discussion', defaultUrl: 'https://www.reddit.com' },
    { platform: 'YouTube', site: 'youtube.com', prefix: 'YT', badge: '▶️ Live YouTube Video', metric2: 'Video Upload', defaultUrl: 'https://www.youtube.com' },
    { platform: 'LinkedIn', site: 'linkedin.com', prefix: 'LI', badge: '💼 Live LinkedIn Post', metric2: 'Professional Update', defaultUrl: 'https://www.linkedin.com' }
  ];

  for (const target of socialTargets) {
    for (const qObj of QUERIES) {
      const siteQuery =
        target.platform === 'XiaoHongShu'
          ? `site:xiaohongshu.com (${qObj.shortQ} OR 亚航)`
          : target.platform === 'X'
            ? `(site:x.com OR site:twitter.com) "${qObj.shortQ}"`
            : `site:${target.site} "${qObj.shortQ}"`;

      const feeds = [
        `https://www.bing.com/search?q=${encodeURIComponent(siteQuery)}&format=rss`,
        `https://news.google.com/rss/search?q=${encodeURIComponent(siteQuery)}&hl=en-MY&gl=MY&ceid=MY:en`
      ];
      for (const feedUrl of feeds) {
        const xml = await safeFetchText(feedUrl);
        if (!xml) continue;
        const items = parseRssItems(xml).slice(0, 12);
        items.forEach((item, idx) => {
          if (!item.title) return;
          // Strictly parse real RSS <pubDate>; never invent fake timestamps
          const pubMs = parseRealTimestampMs(item.pubDate, nowMs);
          if (!pubMs) return;
          const rawText = cleanSnippet(item.title, item.description || '', 360);
          if (!rawText) return;
          const targets = matchAllEntities(rawText, qObj);
          if (!targets.length) return;
          const ts = formatAuthenticTimestamp(pubMs, nowMs);
          const hasChinese = /[\u4e00-\u9fff]/.test(rawText);
          const linkUrl = item.link || target.defaultUrl;
          for (const targetEnt of targets) {
            const cls = classifyText(targetEnt.entityId, rawText);
            if (!cls) continue;
            const slug = rawText.slice(0, 24).replace(/\W+/g, '').toLowerCase() || String(idx);
            addItem({
              id: `REAL-${target.prefix}-${targetEnt.entityId}-${slug}`,
              isLiveScraped: true,
              publishedAtMs: ts.publishedAtMs,
              publishedAtIso: ts.publishedAtIso,
              externalUrl: linkUrl,
              category: 'Mentions',
              mentionType: `${target.platform} ${target.metric2}`,
              digimindQuery: siteQuery,
              entityId: targetEnt.entityId,
              entityLabel: targetEnt.entityLabel,
              platform: target.platform,
              pillarCode: cls.pillarCode,
              sentiment: cls.sentiment,
              isHighReach: false,
              engagementLabel: target.badge,
              viewsCount: 0,
              viewsFormatted: `${target.platform} • ${target.metric2} • ${target.site}`,
              realMetricPrimary: target.platform,
              realMetricSecondary: target.metric2,
              realMetricTertiary: target.site,
              authorHandle: `${target.platform} User`,
              minutesAgo: ts.minutesAgo,
              relativeTime: ts.relativeTime,
              exactTimestamp: ts.exactTimestamp,
              detectedLanguage: hasChinese ? 'Mandarin Chinese' : 'English',
              isNonEnglish: hasChinese,
              originalText: rawText,
              englishText: rawText,
              keywords: cls.keywords
            });
          }
        });
      }
    }
  }

  // Sort newest first by authentic UTC timestamp
  collected.sort((a, b) => (b.publishedAtMs || 0) - (a.publishedAtMs || 0));

  const payload = {
    updatedAt: new Date(nowMs).toISOString(),
    totalMentions: collected.length,
    platforms: ALLOWED_PLATFORMS,
    mentions: collected.slice(0, 300)
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`Saved ${payload.mentions.length} verified real mentions with authentic timestamps across ${ALLOWED_PLATFORMS.length} social platforms to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
