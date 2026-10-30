import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MENTIONS_FILE = path.resolve(__dirname, '../mentions.json');
const MAX_STORED_MENTIONS = 300;

const ENTITY_PILLAR_MATRICES = {
  airasia: [
    { code: 'PIL-01', domain: 'Digital Booking & App Experience', keywords: ['app booking', 'payment', 'website check-in', 'promo code', 'boarding pass', 'seat selection', 'booking'] },
    { code: 'PIL-02', domain: 'Airport Operations & Ground Handling', keywords: ['check-in counter', 'baggage delay', 'lost luggage', 'terminal queue', 'boarding gate', 'ground staff', 'klia2', 'airport'] },
    { code: 'PIL-03', domain: 'Customer Support & Chatbot (AskBo/AVA)', keywords: ['AskBo', 'Ask Bo', 'AVA', 'support agent', 'live chat', 'refund status', 'refund delay', 'call center', 'refund'] },
    { code: 'PIL-04', domain: 'Flight Operations & Cabin Crew', keywords: ['flight delay', 'flight cancellation', 'pilot', 'cabin crew', 'stewardess', 'in-flight comfort', 'seat comfort', 'safety', 'flight'] },
    { code: 'PIL-05', domain: 'Loyalty, Pricing & Add-ons (Baggage/Meals)', keywords: ['baggage price', 'meal prepay', 'seat upgrade', 'airasia points', 'seat selection cost', 'booking fee', 'ancillary', 'baggage'] }
  ],
  move: [
    { code: 'PIL-01', domain: 'Flights', keywords: ['airasia flights', 'book flight', 'flight search', 'flight change', 'flight schedule', 'seat selection', 'flight voucher', 'travel itinerary', 'ota'] },
    { code: 'PIL-02', domain: 'Hotels & Packages', keywords: ['hotel booking', 'hotel stay', 'SNAP deal', 'flight hotel package', 'room confirmation', 'resort reservation', 'check-in date', 'hotel refund', 'hotel'] },
    { code: 'PIL-03', domain: 'Concerts & Activities', keywords: ['concert tickets', 'experience booking', 'event pass', 'theme park', 'tour booking', 'voucher redemption', 'attraction tickets', 'live show', 'duty-free'] },
    { code: 'PIL-04', domain: 'Rides & Taxis', keywords: ['airasia ride', 'book taxi', 'ride-hailing', 'driver canceled', 'airport transfer', 'ride fare', 'driver location', 'pickup point', 'ride'] },
    { code: 'PIL-05', domain: 'Payments & Points', keywords: ['airasia points', 'BigPay', 'payment gateway', 'failed transaction', 'credit card error', 'double charged', 'points redemption', 'refund processing', 'points'] },
    { code: 'PIL-06', domain: 'App Help & Tech Bugs', keywords: ['app crash', 'login error', 'app update', 'glitch', 'loading screen', 'OTP code', 'slow performance', 'technical error', 'superapp'] }
  ],
  santan: [
    { code: 'PIL-01', domain: 'In-Flight Food & Service Quality', keywords: ['inflight food', 'airline meal', 'Pak Nasser', 'nasi lemak', 'pre-book meal', 'cabin food service', 'hot meal', 'cold meal', 'portion size', 'taste', 'menu variety'] },
    { code: 'PIL-02', domain: 'Retail Product Sales & E-Commerce', keywords: ['Santan retail', 'ready-to-eat', 'freeze-dried', 'Santan coffee', 'coffee capsule', 'online order', 'Shopee', 'Lazada', 'TikTok Shop', 'Santan cafe', 'merchandise'] },
    { code: 'PIL-03', domain: 'Business Partnerships & Company News', keywords: ['Santan partnership', 'B2B catering', 'third-party airline catering', 'franchise', 'outlet launch', 'brand collaboration', 'corporate news', 'Catherine Goh', 'expansion'] },
    { code: 'PIL-04', domain: 'Brand Trust & Food Safety', keywords: ['halal certification', 'food safety', 'hygiene', 'contamination', 'food poisoning', 'expiry date', 'quality control', 'allergen info', 'fresh ingredients', 'customer trust'] }
  ],
  ade: [
    { code: 'PIL-01', domain: 'Plane Maintenance (MRO)', keywords: ['MRO', 'aircraft maintenance', 'C-check', 'D-check', 'base maintenance', 'hangar', 'airframe', 'fleet maintenance', 'aviation engineering', 'aircraft service'] },
    { code: 'PIL-02', domain: 'Client Wins & Partners', keywords: ['MRO contract', 'client win', 'airline partnership', 'airline customer', 'maintenance deal', 'B2B agreement', 'service agreement', 'fleet contract'] },
    { code: 'PIL-03', domain: 'Aviation Tech & Software', keywords: ['RedChain', 'digital logbook', 'maintenance software', 'tech log', 'aviation app', 'digital engineering', 'engineering portal', 'aviation technology'] },
    { code: 'PIL-04', domain: 'Parts & Supply Chain', keywords: ['spare parts', 'components', 'engine swap', 'parts logistics', 'procurement delay', 'tools inventory', 'aircraft parts', 'supply chain', 'material management'] },
    { code: 'PIL-05', domain: 'Engineers, Hiring & Safety', keywords: ['hangar safety', 'aircraft engineer', 'hiring', 'recruitment', 'engineering talent', 'safety standard', 'training program', 'aviation technician', 'work safety'] },
    { code: 'PIL-06', domain: 'Corporate Brand & News', keywords: ['ADE corporate', 'hangar launch', 'CEO news', 'press release', 'media coverage', 'aviation awards', 'company expansion', 'industry news', 'corporate milestone'] }
  ],
  teleport: [
    { code: 'PIL-01', domain: 'Cargo & Freight Operations', keywords: ['cargo space', 'charter flight', 'pallet', 'container', 'heavy freight', 'air cargo', 'commercial belly', 'Teleport cargo', 'general cargo', 'freighter', 'a321f'] },
    { code: 'PIL-02', domain: 'E-Commerce & Parcel Delivery', keywords: ['Teleport delivery', 'parcel drop', 'door-to-door', 'e-commerce parcel', 'parcel tracking', 'transit status', 'package delay', 'shipping delay', 'sorting center', 'parcel'] },
    { code: 'PIL-03', domain: 'Corporate Clients & E-Com Merchants', keywords: ['B2B logistics', 'merchant partnership', 'corporate client', 'logistics agreement', 'fulfillment client', 'API integration', 'seller support', 'business shipping'] },
    { code: 'PIL-04', domain: 'Custom Clearance & Cross-Border Logistics', keywords: ['customs delay', 'warehouse hold', 'clearance customs', 'cross-border', 'duty fee', 'import clearance', 'tax declaration', 'border processing', 'customs'] },
    { code: 'PIL-05', domain: 'Fleet, Warehouses & Network Expansion', keywords: ['delivery partner', 'courier rider', 'warehouse expansion', 'sorting hub', 'logistics facility', 'regional network', 'warehouse capacity'] },
    { code: 'PIL-06', domain: 'Corporate Brand, Leadership & ESG', keywords: ['Teleport corporate', 'Pete Chareonwongsak', 'ESG goals', 'carbon offset', 'leadership news', 'press release', 'logistics award', 'capital raise', 'company milestone'] }
  ]
};

const QUERIES = [
  { entityId: 'airasia', entityLabel: 'AirAsia (Airline)', q: '"AirAsia" OR "AirAsia X" OR "AskBo"', newsQ: '"AirAsia" flight OR airline OR "AirAsia X" OR KLIA2', bskyQ: 'AirAsia', hnQ: 'AirAsia', seQ: 'AirAsia', lemmyQ: 'AirAsia', mastoTag: 'airasia' },
  { entityId: 'move', entityLabel: 'AirAsia MOVE', q: '"AirAsia MOVE" OR "AirAsia Superapp" OR "AirAsia app" OR "AirAsia booking" OR "BigPay AirAsia"', newsQ: '"AirAsia MOVE" OR "AirAsia Superapp" OR "AirAsia app" OR "BigPay AirAsia"', bskyQ: 'AirAsia MOVE', hnQ: 'AirAsia app', seQ: 'AirAsia booking', lemmyQ: 'AirAsia app', mastoTag: 'airasiamove' },
  { entityId: 'santan', entityLabel: 'Santan', q: '"Santan AirAsia" OR "Pak Nasser" OR "AirAsia meal" OR "AirAsia food" OR "AirAsia nasi lemak"', newsQ: '"Santan AirAsia" OR "Pak Nasser" OR "AirAsia meal" OR "Santan inflight"', bskyQ: 'AirAsia meal', hnQ: 'AirAsia meal', seQ: 'AirAsia meal', lemmyQ: 'AirAsia food', mastoTag: 'airasia' },
  { entityId: 'ade', entityLabel: 'ADE (Engineering)', q: '"Asia Digital Engineering" OR "ADE AirAsia" OR "AirAsia MRO" OR "AirAsia maintenance" OR "AirAsia hangar"', newsQ: '"Asia Digital Engineering" OR "ADE AirAsia" OR "AirAsia MRO" OR "AirAsia hangar"', bskyQ: 'Asia Digital Engineering', hnQ: 'Asia Digital Engineering', seQ: 'AirAsia baggage', lemmyQ: 'Asia Digital Engineering', mastoTag: 'airasia' },
  { entityId: 'teleport', entityLabel: 'Teleport (Logistics)', q: '"Teleport AirAsia" OR "AirAsia cargo" OR "Teleport cargo" OR "Teleport logistics" OR "Capital A Teleport"', newsQ: '"Teleport AirAsia" OR "Teleport cargo" OR "Teleport logistics" OR "Capital A Teleport"', bskyQ: 'Teleport AirAsia', hnQ: 'Teleport AirAsia', seQ: 'AirAsia luggage', lemmyQ: 'Teleport AirAsia', mastoTag: 'airasia' }
];

function stripHtmlTags(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildEntitySnippet(title, body, maxLen = 360) {
  const cleanTitle = stripHtmlTags(title || '');
  const cleanBody = stripHtmlTags(body || '');
  const full = `${cleanTitle}${cleanBody ? (cleanTitle ? ' — ' : '') + cleanBody : ''}`.replace(/\s+/g, ' ').trim();
  if (!full) return '';
  if (full.length <= maxLen) return full;
  const head = full.slice(0, maxLen - 3);
  const brandRegex = /\b(airasia|air asia|airasiax|capital a|asia digital engineering|santan|pak nasser|teleport|bigpay|askbo|ask bo|klia2|nadia omer|catherine goh|mahesh kumar|pete chareonwongsak)\b/i;
  if (brandRegex.test(head)) {
    return `${head}...`;
  }
  const match = brandRegex.exec(full);
  if (match && typeof match.index === 'number') {
    const prefix = cleanTitle ? `${cleanTitle.slice(0, 120)} — ... ` : '... ';
    const avail = Math.max(80, maxLen - prefix.length - 4);
    const start = Math.max(0, match.index - 45);
    const excerpt = full.slice(start, start + avail).trim();
    return `${prefix}${excerpt}...`;
  }
  return `${head}...`;
}

function isStrictlyRelatedToEntity(entityId, rawText) {
  if (!rawText || typeof rawText !== 'string') return false;
  const lower = rawText.toLowerCase();
  const hasAirAsiaCore = /\b(airasia|air asia|airasiax|capital a|tony fernandes|bo lingam|askbo|ask bo)\b/i.test(lower);

  if (entityId === 'airasia') {
    if (/\b(airasia|air asia|airasiax|askbo|ask bo)\b/i.test(lower)) return true;
    if (/\b(capital a|klia2)\b/i.test(lower) && /\b(flight|flights|airline|airlines|aircraft|plane|boarding|check-in|baggage|luggage|delay|delayed|cancelled|cabin|crew|pilot|terminal|gate|ticket|fare|refund|seat|route|passenger|passengers)\b/i.test(lower)) {
      return true;
    }
    return false;
  }

  if (entityId === 'move') {
    if (/\b(airasia move|move superapp|airasia superapp|airasia super app|nadia omer)\b/i.test(lower)) return true;
    if (/\bbigpay\b/i.test(lower) && /\b(airasia|air asia|capital a|move|app|flight|travel|payment|points|card|wallet|booking)\b/i.test(lower)) return true;
    if (/\b(airasia|air asia)\b/i.test(lower) && /\b(move|superapp|super app|app|website|online booking|book flight|flight booking|hotel|snap|ride|points|bigpay|ota|login|checkout|payment|glitch|crash|voucher|promo code)\b/i.test(lower)) {
      return true;
    }
    return false;
  }

  if (entityId === 'santan') {
    if (/\b(santan dave|dave santan|psychodrama|uk rap|rapper|hip hop|glastonbury|central cee|stormzy)\b/i.test(lower)) {
      return false;
    }
    if (/\b(resepi|masak lemak|lemang|rendang ayam kampung|santan kotak|santan kara|ayam masak|gulai|coconut milk|coconut cream|curry recipe)\b/i.test(lower) && !/\b(airasia|air asia|pak nasser|catherine goh)\b/i.test(lower)) {
      return false;
    }
    if (/\b(pak nasser|catherine goh)\b/i.test(lower)) return true;
    if (/\bsantan\b/i.test(lower) && /\b(airasia|air asia|capital a|inflight|in-flight|airline|flight|cabin|pak nasser|nasi lemak|catering|cafe|ready-to-eat|pre-book meal|airline meal)\b/i.test(lower)) {
      return true;
    }
    if (/\b(airasia|air asia)\b/i.test(lower) && /\b(santan|pak nasser|nasi lemak|inflight meal|in-flight meal|airline meal|cabin meal|inflight food|in-flight food|airline food|cabin food|pre-book meal|meal|catering|menu|boba)\b/i.test(lower)) {
      return true;
    }
    return false;
  }

  if (entityId === 'ade') {
    if (/\b(asia digital engineering|mahesh kumar)\b/i.test(lower)) return true;
    if (/\bade\b/i.test(lower) && /\b(airasia|air asia|capital a|mro|hangar|aircraft maintenance|base maintenance|line maintenance|sepang|aeropolis|redchain|airframe)\b/i.test(lower)) {
      return true;
    }
    if (/\b(airasia|air asia|capital a)\b/i.test(lower) && /\b(asia digital engineering|mro|hangar|aircraft maintenance|base maintenance|line maintenance|c-check|d-check|airframe|redchain|aeropolis|fleet maintenance|aircraft engineer|spare parts|maintenance)\b/i.test(lower)) {
      return true;
    }
    return false;
  }

  if (entityId === 'teleport') {
    if (/\b(roblox|minecraft|valorant|genshin|mage|dungeon|spell|game|gaming|gamer|anime|sci-fi|portal|skyrim|diablo|witcher|pokemon|fortnite|overwatch|starfield|teleporthq|goteleport|gravitational teleport|ssh|kubernetes|k8s|docker|devops|server access|zero trust|sims|warcraft|zelda|elden ring|cyberpunk|baldurs gate|vr|metaverse|quantum)\b/i.test(lower) && !hasAirAsiaCore) {
      return false;
    }
    if (/\b(pete chareonwongsak)\b/i.test(lower)) return true;
    if (/\bteleport\b/i.test(lower) && /\b(airasia|air asia|capital a|a321f|klia|klia2)\b/i.test(lower)) {
      return true;
    }
    if (/\bteleport\b/i.test(lower) && /\b(cargo|freighter|air cargo|belly space|air freight|e-commerce logistics|parcel delivery|cross-border logistics)\b/i.test(lower) && /\b(malaysia|asean|southeast asia|airline|aviation|flight|airport|capital a|airasia)\b/i.test(lower)) {
      return true;
    }
    if (/\b(airasia|air asia|capital a)\b/i.test(lower) && /\b(teleport|cargo|freighter|a321f|air cargo|freight|logistics|parcel delivery|belly space)\b/i.test(lower)) {
      return true;
    }
    return false;
  }

  return false;
}

function classifyText(entityId, rawText) {
  if (!isStrictlyRelatedToEntity(entityId, rawText)) {
    return null;
  }
  const lower = (rawText || '').toLowerCase();
  const matrix = ENTITY_PILLAR_MATRICES[entityId] || ENTITY_PILLAR_MATRICES.airasia;
  let matchedPillar = matrix[0]?.code || 'PIL-01';
  const matchedKeywords = [];
  for (const pil of matrix) {
    for (const kw of pil.keywords || []) {
      if (lower.includes(kw.toLowerCase())) {
        if (matchedKeywords.length === 0) matchedPillar = pil.code;
        if (!matchedKeywords.includes(kw)) matchedKeywords.push(kw);
      }
    }
  }
  if (matchedKeywords.length === 0) {
    matchedKeywords.push(entityId === 'airasia' ? 'AirAsia' : entityId === 'move' ? 'AirAsia MOVE' : entityId === 'santan' ? 'Santan' : entityId === 'ade' ? 'ADE' : 'Teleport');
  }
  const negScore = (lower.match(/\b(delay|delayed|cancelled|cancel|stuck|worst|frustrating|refund|glitch|error|failed|broken|slow|queue|lost|missing|issue|problem|wait|waiting|scam|terrible|late|overcharged|denied)\b/g) || []).length;
  const posScore = (lower.match(/\b(smooth|great|love|best|delicious|good|awesome|fast|impressive|on time|helpful|easy|nice|recommend|resolved|milestone|award|largest|record|expands|launch|launches|crowned|winner|seamless)\b/g) || []).length;
  const sentiment = negScore > posScore ? 'Negative' : posScore > negScore ? 'Positive' : 'Neutral';
  return {
    pillarCode: matchedPillar,
    keywords: matchedKeywords.slice(0, 4),
    sentiment
  };
}

async function fetchRedditForQuery(qObj) {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(qObj.q)}&sort=new&limit=25&raw_json=1`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AirAsia-BrandHealth-LiveCrawler/2.0' }
    });
    if (!res.ok) return [];
    const json = await res.json();
    const children = json?.data?.children || [];
    const out = [];
    for (const child of children) {
      const d = child?.data;
      if (!d || !d.id) continue;
      const rawBody = buildEntitySnippet(d.title || '', d.selftext || '', 360);
      if (!rawBody) continue;
      const cls = classifyText(qObj.entityId, rawBody);
      if (!cls) continue;
      const createdMs = d.created_utc ? d.created_utc * 1000 : Date.now();
      const minsAgo = Math.max(1, Math.round((Date.now() - createdMs) / 60000));
      const ups = Math.max(0, Number(d.ups || d.score || 0));
      const numComments = Math.max(0, Number(d.num_comments || 0));
      const engagementScore = ups + numComments;
      const highReach = ups >= 50 || numComments >= 25;
      out.push({
        id: `REAL-RD-${qObj.entityId}-${d.id}`,
        isLiveScraped: true,
        externalUrl: d.permalink ? `https://www.reddit.com${d.permalink}` : `https://www.reddit.com/comments/${d.id}`,
        category: 'Mentions',
        mentionType: `Reddit Thread (r/${d.subreddit || 'travel'})`,
        digimindQuery: qObj.q,
        entityId: qObj.entityId,
        entityLabel: qObj.entityLabel,
        platform: 'Reddit',
        pillarCode: cls.pillarCode,
        sentiment: cls.sentiment,
        isHighReach: highReach,
        engagementLabel: highReach ? '🔥 High Activity' : '🟢 Live Reddit API',
        viewsCount: engagementScore,
        viewsFormatted: `${ups.toLocaleString()} Upvotes • ${numComments.toLocaleString()} Comments`,
        realMetricPrimary: `${ups.toLocaleString()} Upvotes`,
        realMetricSecondary: `${numComments.toLocaleString()} Comments`,
        realMetricTertiary: `r/${d.subreddit || 'travel'}`,
        minutesAgo: minsAgo,
        createdUtcMs: createdMs,
        authorHandle: `u/${d.author || 'reddit_traveler'}`,
        detectedLanguage: 'Auto-Detected (Live)',
        isNonEnglish: false,
        originalText: rawBody,
        englishText: rawBody,
        keywords: cls.keywords
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchGoogleNewsForQuery(qObj) {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(qObj.newsQ || qObj.q)}&hl=en-MY&gl=MY&ceid=MY:en`;
  try {
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'AirAsia-BrandHealth-LiveCrawler/2.0' }
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 15);
    const out = [];
    for (let idx = 0; idx < items.length; idx++) {
      const block = items[idx][1];
      const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
      const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
      const cleanTitle = buildEntitySnippet(titleMatch ? titleMatch[1] : '', '', 360);
      const link = (linkMatch ? linkMatch[1] : '').trim();
      const sourceName = stripHtmlTags(sourceMatch ? sourceMatch[1] : 'Google News');
      if (!cleanTitle || !link) continue;
      const cls = classifyText(qObj.entityId, cleanTitle);
      if (!cls) continue;
      const pubMs = pubDateMatch ? Date.parse(pubDateMatch[1].trim()) : Date.now();
      const validPubMs = Number.isNaN(pubMs) ? Date.now() : pubMs;
      const minsAgo = Math.max(1, Math.round((Date.now() - validPubMs) / 60000));
      const idSlug = Buffer.from(link).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(-14) || `${qObj.entityId}-${idx}`;
      out.push({
        id: `REAL-GN-${qObj.entityId}-${idSlug}`,
        isLiveScraped: true,
        externalUrl: link,
        category: 'Mentions',
        mentionType: 'Google News Article',
        digimindQuery: qObj.newsQ || qObj.q,
        entityId: qObj.entityId,
        entityLabel: qObj.entityLabel,
        platform: 'Google News',
        pillarCode: cls.pillarCode,
        sentiment: cls.sentiment,
        isHighReach: false,
        engagementLabel: '📰 Live News RSS',
        viewsCount: 1,
        viewsFormatted: 'Syndicated News Mention',
        realMetricPrimary: 'Published Article',
        realMetricSecondary: sourceName,
        realMetricTertiary: 'Google News RSS',
        minutesAgo: minsAgo,
        createdUtcMs: validPubMs,
        authorHandle: `@${sourceName.replace(/\s+/g, '')}`,
        detectedLanguage: 'English',
        isNonEnglish: false,
        originalText: cleanTitle,
        englishText: cleanTitle,
        keywords: cls.keywords
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchBlueskyForQuery(qObj) {
  const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(qObj.bskyQ)}&limit=20&sort=latest`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const posts = json?.posts || [];
    const out = [];
    for (const post of posts) {
      const rec = post?.record || {};
      const rawText = buildEntitySnippet('', rec.text || '', 360);
      if (!rawText) continue;
      const cls = classifyText(qObj.entityId, rawText);
      if (!cls) continue;
      const handle = post?.author?.handle || 'bsky.user';
      const uriParts = String(post.uri || '').split('/');
      const rkey = uriParts[uriParts.length - 1] || '';
      const webUrl = rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : `https://bsky.app/profile/${handle}`;
      const createdMs = Date.parse(rec.createdAt || post.indexedAt || '') || Date.now();
      const minsAgo = Math.max(1, Math.round((Date.now() - createdMs) / 60000));
      const likes = Math.max(0, Number(post.likeCount || 0));
      const reposts = Math.max(0, Number(post.repostCount || 0));
      const replies = Math.max(0, Number(post.replyCount || 0));
      const totalEng = likes + reposts + replies;
      const highReach = totalEng >= 20;
      out.push({
        id: `REAL-BSKY-${qObj.entityId}-${rkey || Math.random().toString(36).slice(2, 9)}`,
        isLiveScraped: true,
        externalUrl: webUrl,
        category: 'Mentions',
        mentionType: 'Bluesky Social Post',
        digimindQuery: qObj.bskyQ,
        entityId: qObj.entityId,
        entityLabel: qObj.entityLabel,
        platform: 'Bluesky',
        pillarCode: cls.pillarCode,
        sentiment: cls.sentiment,
        isHighReach: highReach,
        engagementLabel: highReach ? '🔥 High Activity' : '🦋 Live Bluesky API',
        viewsCount: totalEng,
        viewsFormatted: `${likes} Likes • ${reposts} Reposts • ${replies} Replies`,
        realMetricPrimary: `${likes} Likes`,
        realMetricSecondary: `${reposts} Reposts`,
        realMetricTertiary: `${replies} Replies`,
        minutesAgo: minsAgo,
        createdUtcMs: createdMs,
        authorHandle: `@${handle}`,
        detectedLanguage: 'Auto-Detected (Live)',
        isNonEnglish: false,
        originalText: rawText,
        englishText: rawText,
        keywords: cls.keywords
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchMastodonForQuery(qObj) {
  const url = `https://mastodon.social/api/v1/timelines/tag/${encodeURIComponent(qObj.mastoTag)}?limit=20`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const arr = await res.json();
    if (!Array.isArray(arr)) return [];
    const out = [];
    for (const status of arr) {
      if (!status || !status.id) continue;
      const cleanText = buildEntitySnippet('', status.content || '', 360);
      if (!cleanText) continue;
      const cls = classifyText(qObj.entityId, cleanText);
      if (!cls) continue;
      const createdMs = Date.parse(status.created_at || '') || Date.now();
      const minsAgo = Math.max(1, Math.round((Date.now() - createdMs) / 60000));
      const favs = Math.max(0, Number(status.favourites_count || 0));
      const boosts = Math.max(0, Number(status.reblogs_count || 0));
      const replies = Math.max(0, Number(status.replies_count || 0));
      const totalEng = favs + boosts + replies;
      const acct = status.account?.acct || status.account?.username || 'mastodon_user';
      out.push({
        id: `REAL-MASTO-${qObj.entityId}-${status.id}`,
        isLiveScraped: true,
        externalUrl: status.url || status.uri || 'https://mastodon.social',
        category: 'Mentions',
        mentionType: `Mastodon Fediverse Post (#${qObj.mastoTag})`,
        digimindQuery: `#${qObj.mastoTag}`,
        entityId: qObj.entityId,
        entityLabel: qObj.entityLabel,
        platform: 'Mastodon',
        pillarCode: cls.pillarCode,
        sentiment: cls.sentiment,
        isHighReach: totalEng >= 15,
        engagementLabel: '🐘 Live Mastodon API',
        viewsCount: totalEng,
        viewsFormatted: `${favs} Favourites • ${boosts} Boosts • ${replies} Replies`,
        realMetricPrimary: `${favs} Favourites`,
        realMetricSecondary: `${boosts} Boosts`,
        realMetricTertiary: `${replies} Replies`,
        minutesAgo: minsAgo,
        createdUtcMs: createdMs,
        authorHandle: `@${acct}`,
        detectedLanguage: status.language ? status.language.toUpperCase() : 'EN',
        isNonEnglish: false,
        originalText: cleanText,
        englishText: cleanText,
        keywords: cls.keywords
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchHackerNewsForQuery(qObj) {
  const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent('"' + qObj.hnQ + '"')}&hitsPerPage=15`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const hits = json?.hits || [];
    const out = [];
    for (const h of hits) {
      if (!h || !h.objectID) continue;
      const rawText = buildEntitySnippet(h.title || h.story_title || '', h.comment_text || h.story_text || '', 360);
      if (!rawText) continue;
      const cls = classifyText(qObj.entityId, rawText);
      if (!cls) continue;
      const createdMs = h.created_at_i ? h.created_at_i * 1000 : (Date.parse(h.created_at || '') || Date.now());
      const minsAgo = Math.max(1, Math.round((Date.now() - createdMs) / 60000));
      const pts = Math.max(0, Number(h.points || 0));
      const cmts = Math.max(0, Number(h.num_comments || 0));
      out.push({
        id: `REAL-HN-${qObj.entityId}-${h.objectID}`,
        isLiveScraped: true,
        externalUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
        category: 'Mentions',
        mentionType: h.comment_text ? 'Hacker News Comment' : 'Hacker News Discussion',
        digimindQuery: qObj.hnQ,
        entityId: qObj.entityId,
        entityLabel: qObj.entityLabel,
        platform: 'Hacker News',
        pillarCode: cls.pillarCode,
        sentiment: cls.sentiment,
        isHighReach: pts >= 25 || cmts >= 15,
        engagementLabel: '🟧 Live Hacker News API',
        viewsCount: pts + cmts,
        viewsFormatted: `${pts} Points • ${cmts} Comments`,
        realMetricPrimary: `${pts} Points`,
        realMetricSecondary: `${cmts} Comments`,
        realMetricTertiary: 'YC Algolia API',
        minutesAgo: minsAgo,
        createdUtcMs: createdMs,
        authorHandle: `@${h.author || 'hn_member'}`,
        detectedLanguage: 'English',
        isNonEnglish: false,
        originalText: rawText,
        englishText: rawText,
        keywords: cls.keywords
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchStackExchangeForQuery(qObj) {
  const url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=creation&q=${encodeURIComponent(qObj.seQ)}&site=travel&pagesize=15`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const items = json?.items || [];
    const out = [];
    for (const item of items) {
      if (!item || !item.question_id) continue;
      const cleanTitle = buildEntitySnippet(item.title || '', (item.tags || []).length ? `[Tags: ${(item.tags || []).join(', ')}]` : '', 360);
      if (!cleanTitle) continue;
      const cls = classifyText(qObj.entityId, cleanTitle);
      if (!cls) continue;
      const createdMs = item.creation_date ? item.creation_date * 1000 : Date.now();
      const minsAgo = Math.max(1, Math.round((Date.now() - createdMs) / 60000));
      const views = Math.max(0, Number(item.view_count || 0));
      const answers = Math.max(0, Number(item.answer_count || 0));
      const score = Number(item.score || 0);
      out.push({
        id: `REAL-SE-${qObj.entityId}-${item.question_id}`,
        isLiveScraped: true,
        externalUrl: item.link || `https://travel.stackexchange.com/questions/${item.question_id}`,
        category: 'Mentions',
        mentionType: 'Travel StackExchange Q&A',
        digimindQuery: qObj.seQ,
        entityId: qObj.entityId,
        entityLabel: qObj.entityLabel,
        platform: 'Travel SE',
        pillarCode: cls.pillarCode,
        sentiment: cls.sentiment,
        isHighReach: views >= 500 || score >= 5,
        engagementLabel: '✈️ Live Travel SE API',
        viewsCount: views,
        viewsFormatted: `${views.toLocaleString()} Views • ${answers} Answers • Score ${score}`,
        realMetricPrimary: `${views.toLocaleString()} Real Views`,
        realMetricSecondary: `${answers} Answers`,
        realMetricTertiary: `Score: ${score}`,
        minutesAgo: minsAgo,
        createdUtcMs: createdMs,
        authorHandle: `@${(item.owner?.display_name || 'traveler').replace(/\s+/g, '_')}`,
        detectedLanguage: 'English',
        isNonEnglish: false,
        originalText: cleanTitle,
        englishText: cleanTitle,
        keywords: cls.keywords
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchLemmyForQuery(qObj) {
  const url = `https://lemmy.world/api/v3/search?q=${encodeURIComponent(qObj.lemmyQ)}&type_=Posts&sort=New&limit=15`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const out = [];
    for (const pObj of json?.posts || []) {
      const post = pObj?.post;
      const counts = pObj?.counts || {};
      const creator = pObj?.creator || {};
      const community = pObj?.community || {};
      if (!post || !post.id) continue;
      const rawText = buildEntitySnippet(post.name || '', post.body || '', 360);
      if (!rawText) continue;
      const cls = classifyText(qObj.entityId, rawText);
      if (!cls) continue;
      const createdMs = Date.parse(post.published || '') || Date.now();
      const minsAgo = Math.max(1, Math.round((Date.now() - createdMs) / 60000));
      const score = Math.max(0, Number(counts.score || counts.upvotes || 0));
      const cmts = Math.max(0, Number(counts.comments || 0));
      out.push({
        id: `REAL-LEMMY-P-${qObj.entityId}-${post.id}`,
        isLiveScraped: true,
        externalUrl: post.ap_id || `https://lemmy.world/post/${post.id}`,
        category: 'Mentions',
        mentionType: `Lemmy Thread (c/${community.name || 'travel'})`,
        digimindQuery: qObj.lemmyQ,
        entityId: qObj.entityId,
        entityLabel: qObj.entityLabel,
        platform: 'Lemmy',
        pillarCode: cls.pillarCode,
        sentiment: cls.sentiment,
        isHighReach: score >= 15 || cmts >= 10,
        engagementLabel: '🌐 Live Lemmy API',
        viewsCount: score + cmts,
        viewsFormatted: `${score} Upvotes • ${cmts} Comments`,
        realMetricPrimary: `${score} Upvotes`,
        realMetricSecondary: `${cmts} Comments`,
        realMetricTertiary: `c/${community.name || 'lemmy'}`,
        minutesAgo: minsAgo,
        createdUtcMs: createdMs,
        authorHandle: `@${creator.name || 'lemmy_user'}`,
        detectedLanguage: 'English',
        isNonEnglish: false,
        originalText: rawText,
        englishText: rawText,
        keywords: cls.keywords
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function main() {
  let existing = [];
  try {
    const raw = await fs.readFile(MENTIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    existing = Array.isArray(parsed) ? parsed : (parsed.mentions || []);
  } catch {
    existing = [];
  }

  const allNew = [];
  for (const qObj of QUERIES) {
    const [rd, gn, bsky, masto, hn, se, lemmy] = await Promise.all([
      fetchRedditForQuery(qObj),
      fetchGoogleNewsForQuery(qObj),
      fetchBlueskyForQuery(qObj),
      fetchMastodonForQuery(qObj),
      fetchHackerNewsForQuery(qObj),
      fetchStackExchangeForQuery(qObj),
      fetchLemmyForQuery(qObj)
    ]);
    allNew.push(...rd, ...gn, ...bsky, ...masto, ...hn, ...se, ...lemmy);
  }

  const nowMs = Date.now();
  const mergedMap = new Map();

  for (const item of [...allNew, ...existing]) {
    if (!item || !item.id || !item.externalUrl || !item.entityId) continue;
    if (!isStrictlyRelatedToEntity(item.entityId, item.originalText)) continue;
    const normKey = `${item.entityId}:${String(item.originalText || '').toLowerCase().slice(0, 80)}`;
    if (mergedMap.has(item.id) || mergedMap.has(normKey)) continue;
    const createdMs = item.createdUtcMs || (nowMs - (Number(item.minutesAgo) || 30) * 60000);
    const updatedMinsAgo = Math.max(1, Math.round((nowMs - createdMs) / 60000));
    const normalizedItem = {
      ...item,
      createdUtcMs: createdMs,
      minutesAgo: updatedMinsAgo
    };
    mergedMap.set(item.id, normalizedItem);
    if (normKey) mergedMap.set(normKey, normalizedItem);
  }

  const uniqueMentions = [...new Set(mergedMap.values())]
    .sort((a, b) => (a.minutesAgo || 1) - (b.minutesAgo || 1))
    .slice(0, MAX_STORED_MENTIONS);

  await fs.writeFile(MENTIONS_FILE, JSON.stringify(uniqueMentions, null, 2) + '\n', 'utf8');
  console.log(`Saved ${uniqueMentions.length} real deduplicated mentions across 7 platforms to mentions.json`);
}

main();
