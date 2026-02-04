var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-C8BKd5/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// src/config.js
var POLYMARKET_API = "https://data-api.polymarket.com";
var ODDS_API_BASE = "https://api.the-odds-api.com/v4";
var KV_KEYS = {
  PENDING_SIGNALS: "pending_signals_v2",
  FACTOR_STATS: "factor_stats_v2",
  SIGNALS_PREFIX: "signal_",
  WALLETS_PREFIX: "wallet:",
  // NOTE: colon not underscore - must match old format!
  LAST_CRON_RUN: "last_cron_run",
  CRON_STATS: "cron_stats",
  // Edge detection keys (NEW!)
  EDGE_CACHE_PREFIX: "edge_detection_",
  LINE_MOVEMENT_PREFIX: "line_movement_",
  BETTING_SPLITS_PREFIX: "betting_splits_",
  SHARP_LINES_PREFIX: "sharp_lines_"
};
var WALLET_TIERS = {
  INSIDER: { minWinRate: 75, minBets: 15, minVolume: 1e5 },
  ELITE: { minWinRate: 68, minBets: 10, minVolume: 5e4 },
  STRONG: { minWinRate: 60, minBets: 8, minVolume: 2e4 },
  AVERAGE: { minWinRate: 50, minBets: 5, minVolume: 0 },
  FADE: { maxWinRate: 42, minBets: 8, minVolume: 0 }
};
var SPORT_KEY_MAP = {
  "nfl": "americanfootball_nfl",
  "nba": "basketball_nba",
  "mlb": "baseball_mlb",
  "nhl": "icehockey_nhl",
  "ncaaf": "americanfootball_ncaaf",
  "cfb": "americanfootball_ncaaf",
  // Alias for Polymarket slug format
  "ncaab": "basketball_ncaab",
  "cbb": "basketball_ncaab",
  // Alias for Polymarket slug format
  "mma": "mma_mixed_martial_arts",
  "ufc": "mma_mixed_martial_arts",
  "epl": "soccer_epl",
  "ucl": "soccer_uefa_champions_league",
  "mls": "soccer_usa_mls",
  "wta": "tennis_wta_australian_open",
  "atp": "tennis_atp_australian_open",
  "lol": null,
  "csgo": null
};
var TEAM_ALIASES = {
  // NFL
  "patriots": "New England Patriots",
  "ne": "New England Patriots",
  "broncos": "Denver Broncos",
  "den": "Denver Broncos",
  "chiefs": "Kansas City Chiefs",
  "kc": "Kansas City Chiefs",
  "bills": "Buffalo Bills",
  "buf": "Buffalo Bills",
  "dolphins": "Miami Dolphins",
  "mia": "Miami Dolphins",
  "jets": "New York Jets",
  "nyj": "New York Jets",
  "ravens": "Baltimore Ravens",
  "bal": "Baltimore Ravens",
  "steelers": "Pittsburgh Steelers",
  "pit": "Pittsburgh Steelers",
  "bengals": "Cincinnati Bengals",
  "cin": "Cincinnati Bengals",
  "browns": "Cleveland Browns",
  "cle": "Cleveland Browns",
  "texans": "Houston Texans",
  "hou": "Houston Texans",
  "colts": "Indianapolis Colts",
  "ind": "Indianapolis Colts",
  "jaguars": "Jacksonville Jaguars",
  "jax": "Jacksonville Jaguars",
  "titans": "Tennessee Titans",
  "ten": "Tennessee Titans",
  "cowboys": "Dallas Cowboys",
  "dal": "Dallas Cowboys",
  "eagles": "Philadelphia Eagles",
  "phi": "Philadelphia Eagles",
  "giants": "New York Giants",
  "nyg": "New York Giants",
  "commanders": "Washington Commanders",
  "was": "Washington Commanders",
  "bears": "Chicago Bears",
  "chi": "Chicago Bears",
  "lions": "Detroit Lions",
  "det": "Detroit Lions",
  "packers": "Green Bay Packers",
  "gb": "Green Bay Packers",
  "vikings": "Minnesota Vikings",
  "min": "Minnesota Vikings",
  "falcons": "Atlanta Falcons",
  "atl": "Atlanta Falcons",
  "panthers": "Carolina Panthers",
  "car": "Carolina Panthers",
  "saints": "New Orleans Saints",
  "no": "New Orleans Saints",
  "buccaneers": "Tampa Bay Buccaneers",
  "tb": "Tampa Bay Buccaneers",
  "cardinals": "Arizona Cardinals",
  "ari": "Arizona Cardinals",
  "49ers": "San Francisco 49ers",
  "sf": "San Francisco 49ers",
  "seahawks": "Seattle Seahawks",
  "sea": "Seattle Seahawks",
  "rams": "Los Angeles Rams",
  "lar": "Los Angeles Rams",
  "chargers": "Los Angeles Chargers",
  "lac": "Los Angeles Chargers",
  "raiders": "Las Vegas Raiders",
  "lv": "Las Vegas Raiders",
  // NBA
  "lakers": "Los Angeles Lakers",
  "lal": "Los Angeles Lakers",
  "celtics": "Boston Celtics",
  "bos": "Boston Celtics",
  "warriors": "Golden State Warriors",
  "gsw": "Golden State Warriors",
  "bucks": "Milwaukee Bucks",
  "mil": "Milwaukee Bucks",
  "heat": "Miami Heat",
  "nuggets": "Denver Nuggets",
  "suns": "Phoenix Suns",
  "phx": "Phoenix Suns",
  "mavericks": "Dallas Mavericks",
  "clippers": "Los Angeles Clippers",
  "sixers": "Philadelphia 76ers",
  "76ers": "Philadelphia 76ers",
  "nets": "Brooklyn Nets",
  "bkn": "Brooklyn Nets",
  "knicks": "New York Knicks",
  "nyk": "New York Knicks",
  "raptors": "Toronto Raptors",
  "tor": "Toronto Raptors",
  "bulls": "Chicago Bulls",
  "cavaliers": "Cleveland Cavaliers",
  "cavs": "Cleveland Cavaliers",
  "pistons": "Detroit Pistons",
  "pacers": "Indiana Pacers",
  "hawks": "Atlanta Hawks",
  "hornets": "Charlotte Hornets",
  "cha": "Charlotte Hornets",
  "magic": "Orlando Magic",
  "orl": "Orlando Magic",
  "wizards": "Washington Wizards",
  "timberwolves": "Minnesota Timberwolves",
  "wolves": "Minnesota Timberwolves",
  "thunder": "Oklahoma City Thunder",
  "okc": "Oklahoma City Thunder",
  "blazers": "Portland Trail Blazers",
  "por": "Portland Trail Blazers",
  "jazz": "Utah Jazz",
  "uta": "Utah Jazz",
  "grizzlies": "Memphis Grizzlies",
  "mem": "Memphis Grizzlies",
  "pelicans": "New Orleans Pelicans",
  "nop": "New Orleans Pelicans",
  "spurs": "San Antonio Spurs",
  "sas": "San Antonio Spurs",
  "rockets": "Houston Rockets",
  "kings": "Sacramento Kings",
  "sac": "Sacramento Kings"
};
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
var VERSION = "18.12.0 - Directional odds + event timing + bet tracking";

// src/utils.js
function getTeamFullName(code) {
  if (!code) return code;
  return TEAM_ALIASES[code.toLowerCase()] || code;
}
__name(getTeamFullName, "getTeamFullName");
function detectSportFromSlug(slug) {
  if (!slug) return null;
  const slugLower = slug.toLowerCase();
  if (slugLower.startsWith("nfl-") || slugLower.includes("-nfl-")) return "nfl";
  if (slugLower.startsWith("nba-") || slugLower.includes("-nba-")) return "nba";
  if (slugLower.startsWith("mlb-") || slugLower.includes("-mlb-")) return "mlb";
  if (slugLower.startsWith("nhl-") || slugLower.includes("-nhl-")) return "nhl";
  if (slugLower.startsWith("cbb-") || slugLower.includes("-cbb-")) return "ncaab";
  if (slugLower.startsWith("cfb-") || slugLower.includes("-cfb-")) return "ncaaf";
  if (slugLower.startsWith("ncaab-") || slugLower.includes("college-basketball")) return "ncaab";
  if (slugLower.startsWith("ncaaf-") || slugLower.includes("college-football")) return "ncaaf";
  if (slugLower.startsWith("ufc-") || slugLower.startsWith("mma-")) return "mma";
  if (slugLower.startsWith("epl-") || slugLower.includes("premier-league")) return "epl";
  if (slugLower.startsWith("wta-")) return "wta";
  if (slugLower.startsWith("atp-")) return "atp";
  if (slugLower.startsWith("lol-")) return "lol";
  return null;
}
__name(detectSportFromSlug, "detectSportFromSlug");
function extractTeamsFromSlug(slug) {
  if (!slug) return null;
  const match = slug.match(/^(?:nfl|nba|mlb|nhl|ncaaf|ncaab|cbb|cfb)-([a-z0-9]+)-([a-z0-9]+)-\d{4}-\d{2}-\d{2}/i);
  if (match) {
    return { away: match[1].toLowerCase(), home: match[2].toLowerCase() };
  }
  return null;
}
__name(extractTeamsFromSlug, "extractTeamsFromSlug");
function americanToProb(odds) {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}
__name(americanToProb, "americanToProb");
var FUTURES_KEYWORDS = [
  // Season/Championship futures
  "win the",
  "winner",
  "championship",
  "super bowl winner",
  "world series winner",
  "stanley cup winner",
  "nba champion",
  "nfl champion",
  "mlb champion",
  "premier league winner",
  "premier league",
  "champions league winner",
  "win the 20",
  "win 20",
  // "Will X win the 2025 championship"
  "ncaa tournament winner",
  "march madness winner",
  "final four",
  // Awards
  "mvp",
  "most valuable",
  "rookie of the year",
  "cy young",
  "heisman",
  "ballon d'or",
  "dpoy",
  "defensive player",
  "coach of the year",
  "naismith",
  "player of the year",
  // Season totals
  "win total",
  "season wins",
  "over/under wins",
  "regular season",
  "make the playoffs",
  "miss the playoffs",
  "playoff seed",
  "division winner",
  "conference winner",
  "win the division",
  "win the conference",
  "first pick",
  "draft",
  "big east",
  "big ten",
  "big 12",
  "acc",
  "sec",
  "pac-12",
  // Conference futures
  // Player props (season-long)
  "passing yards",
  "rushing yards",
  "receiving yards",
  "touchdowns",
  "home runs",
  "batting average",
  "era",
  "strikeouts",
  "points per game",
  "assists per game",
  "rebounds per game",
  "goals scored",
  "clean sheets",
  // Transfer/Team news
  "sign with",
  "trade to",
  "leave the",
  "join the",
  "transfer",
  "retire",
  "fired",
  "hired",
  "contract",
  // Other futures
  "before",
  "by the end of",
  "this season",
  "this year",
  "all-star",
  "pro bowl",
  "hall of fame"
];
var GAME_KEYWORDS = [
  "vs",
  "vs.",
  "@",
  "at",
  "spread",
  "moneyline",
  "money line",
  "ml",
  "over/under",
  "o/u",
  "total points",
  "total runs",
  "total goals",
  "game",
  "match",
  "bout",
  "fight"
];
var GAME_SLUG_PATTERNS = [
  /^(nfl|nba|mlb|nhl|ncaaf|ncaab|cbb|cfb)-[a-z]+-[a-z]+-\d{4}-\d{2}-\d{2}/i,
  // nba-lal-gsw-2026-01-28, cbb-duke-unc-2026-01-31
  /^(ufc|mma)-[a-z]+-vs-[a-z]+-/i,
  // ufc-jones-vs-miocic
  /\d{4}-\d{2}-\d{2}/
  // Contains a specific date
];
function classifyMarket(title, slug) {
  const titleLower = (title || "").toLowerCase();
  const slugLower = (slug || "").toLowerCase();
  for (const keyword of FUTURES_KEYWORDS) {
    if (titleLower.includes(keyword)) {
      return {
        isGame: false,
        marketType: "futures",
        reason: `Contains futures keyword: "${keyword}"`
      };
    }
  }
  for (const pattern of GAME_SLUG_PATTERNS) {
    if (pattern.test(slugLower)) {
      return {
        isGame: true,
        marketType: "game",
        reason: "Matches game slug pattern"
      };
    }
  }
  for (const keyword of GAME_KEYWORDS) {
    if (titleLower.includes(keyword)) {
      if (!titleLower.includes("season") && !titleLower.includes("winner") && !titleLower.includes("champion")) {
        return {
          isGame: true,
          marketType: "game",
          reason: `Contains game keyword: "${keyword}"`
        };
      }
    }
  }
  if (/\b[A-Z][a-z]+\s+(vs\.?|@|at)\s+[A-Z][a-z]+\b/.test(title)) {
    return {
      isGame: true,
      marketType: "game",
      reason: "Contains team vs team pattern"
    };
  }
  return {
    isGame: false,
    marketType: "other",
    reason: "No game indicators found"
  };
}
__name(classifyMarket, "classifyMarket");
function isSportsGame(title, slug) {
  const classification = classifyMarket(title, slug);
  return classification.isGame;
}
__name(isSportsGame, "isSportsGame");
function detectMarketType(title, slug) {
  if (!title) return "other";
  const t = title.toLowerCase();
  const s = (slug || "").toLowerCase();
  const classification = classifyMarket(title, slug);
  if (classification.isGame) {
    if (t.includes("nba") || s.includes("nba-")) return "sports-nba";
    if (t.includes("nfl") || s.includes("nfl-")) return "sports-nfl";
    if (t.includes("mlb") || s.includes("mlb-")) return "sports-mlb";
    if (t.includes("nhl") || s.includes("nhl-")) return "sports-nhl";
    if (s.startsWith("cbb-") || t.includes("college basketball") || t.includes("ncaab")) return "sports-ncaab";
    if (s.startsWith("cfb-") || t.includes("college football") || t.includes("ncaaf")) return "sports-ncaaf";
    if (t.includes("ncaa") || t.includes("college")) return "sports-ncaa";
    if (t.includes("ufc") || t.includes("mma")) return "sports-mma";
    if (t.includes("soccer") || t.includes("premier") || t.includes("champions league")) return "sports-soccer";
    return "sports-other";
  }
  if (classification.marketType === "futures") {
    return "sports-futures";
  }
  if (t.includes("president") || t.includes("election") || t.includes("trump") || t.includes("biden") || t.includes("democrat") || t.includes("republican") || t.includes("governor") || t.includes("senate") || t.includes("congress")) {
    return "politics";
  }
  if (t.includes("bitcoin") || t.includes("ethereum") || t.includes("crypto") || t.includes("btc") || t.includes("eth") || t.includes("sol") || t.includes("doge")) {
    return "crypto";
  }
  if (t.includes("fed") || t.includes("interest rate") || t.includes("inflation") || t.includes("stock") || t.includes("s&p") || t.includes("nasdaq")) {
    return "finance";
  }
  return "other";
}
__name(detectMarketType, "detectMarketType");
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
__name(generateId, "generateId");

// src/wallets.js
var KEEPER_THRESHOLDS = {
  MIN_BETS: 3,
  // Need at least 3 bets to evaluate
  MIN_WIN_RATE: 55,
  // Must be above 55% to keep long-term
  MIN_VOLUME: 5e3,
  // Must have bet at least $5k total
  ELITE_WIN_RATE: 65,
  // Elite threshold
  INSIDER_WIN_RATE: 75
  // Insider threshold
};
var TEAM_ABBREVS = {
  "lal": "Lakers",
  "lac": "Clippers",
  "gsw": "Warriors",
  "sac": "Kings",
  "phx": "Suns",
  "den": "Nuggets",
  "min": "Timberwolves",
  "okc": "Thunder",
  "por": "Trail Blazers",
  "uta": "Jazz",
  "dal": "Mavericks",
  "hou": "Rockets",
  "sas": "Spurs",
  "mem": "Grizzlies",
  "nop": "Pelicans",
  "bos": "Celtics",
  "bkn": "Nets",
  "nyk": "Knicks",
  "phi": "Sixers",
  "tor": "Raptors",
  "chi": "Bulls",
  "cle": "Cavaliers",
  "det": "Pistons",
  "ind": "Pacers",
  "mil": "Bucks",
  "atl": "Hawks",
  "cha": "Hornets",
  "mia": "Heat",
  "orl": "Magic",
  "was": "Wizards",
  "elc": "Celtics",
  "bar": "Barcelona",
  "bun": "Bucks",
  "dor": "Dortmund",
  "hei": "Heat",
  "cel": "Celtics",
  "hor": "Hornets",
  "pel": "Pelicans"
};
function formatMarketTitle(title) {
  if (!title) return "Unknown Market";
  if (title.includes(" ") && !title.match(/^\w{3}\s\w{3}\s\w{3}\s\d{4}/)) {
    return title;
  }
  const parts = title.toLowerCase().replace(/-/g, " ").split(" ").filter((p) => p);
  let dateStr = "";
  const dateMatch = title.match(/(\d{4})[-\s](\d{2})[-\s](\d{2})/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const date = new Date(year, parseInt(month) - 1, day);
    dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  const teams = [];
  for (const part of parts) {
    if (part.length === 3 && TEAM_ABBREVS[part]) {
      teams.push(TEAM_ABBREVS[part]);
    } else if (part.length === 3 && /^[a-z]+$/.test(part)) {
      teams.push(part.toUpperCase());
    }
  }
  if (teams.length >= 2) {
    const matchup = `${teams[0]} vs ${teams[1]}`;
    return dateStr ? `${matchup} - ${dateStr}` : matchup;
  }
  return title.replace(/-/g, " ").replace(/\d{4}\s?\d{2}\s?\d{2}/g, "").split(" ").filter((w) => w.length > 0).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ").trim() || "Unknown Market";
}
__name(formatMarketTitle, "formatMarketTitle");
function getWalletTier(stats) {
  if (!stats) return null;
  const { wins, losses, totalBets, totalVolume, winRate } = stats;
  const calculatedWinRate = totalBets > 0 ? wins / totalBets * 100 : 0;
  const wr = winRate || calculatedWinRate;
  if (totalBets < KEEPER_THRESHOLDS.MIN_BETS) return null;
  if (wr >= WALLET_TIERS.INSIDER.minWinRate && totalBets >= WALLET_TIERS.INSIDER.minBets && totalVolume >= WALLET_TIERS.INSIDER.minVolume) {
    return { tier: "INSIDER", winRate: wr, emoji: "\u{1F3AF}" };
  }
  if (wr >= WALLET_TIERS.ELITE.minWinRate && totalBets >= WALLET_TIERS.ELITE.minBets && totalVolume >= WALLET_TIERS.ELITE.minVolume) {
    return { tier: "ELITE", winRate: wr, emoji: "\u{1F3C6}" };
  }
  if (wr >= WALLET_TIERS.STRONG.minWinRate && totalBets >= WALLET_TIERS.STRONG.minBets && totalVolume >= WALLET_TIERS.STRONG.minVolume) {
    return { tier: "STRONG", winRate: wr, emoji: "\u{1F4AA}" };
  }
  if (wr >= WALLET_TIERS.AVERAGE.minWinRate && totalBets >= WALLET_TIERS.AVERAGE.minBets) {
    return { tier: "AVERAGE", winRate: wr, emoji: "\u{1F4CA}" };
  }
  if (wr <= WALLET_TIERS.FADE.maxWinRate && totalBets >= WALLET_TIERS.FADE.minBets) {
    return { tier: "FADE", winRate: wr, emoji: "\u{1F6AB}" };
  }
  return null;
}
__name(getWalletTier, "getWalletTier");
async function trackWalletBet(env, walletAddress, betData) {
  if (!env.SIGNALS_CACHE || !walletAddress) return null;
  const key = KV_KEYS.WALLETS_PREFIX + walletAddress.toLowerCase();
  const tradesKey = `wallet_trades_${walletAddress.toLowerCase()}`;
  try {
    let stats = await env.SIGNALS_CACHE.get(key, { type: "json" });
    if (!stats) {
      stats = {
        address: walletAddress.toLowerCase(),
        firstSeen: (/* @__PURE__ */ new Date()).toISOString(),
        totalBets: 0,
        wins: 0,
        losses: 0,
        pending: 0,
        totalVolume: 0,
        winRate: 0,
        profitLoss: 0,
        tier: null,
        currentStreak: 0,
        bestStreak: 0,
        recentBets: []
      };
    }
    const tradeId = `${betData.signalId || betData.market}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1e3;
    const isDuplicate = stats.recentBets.some((existing) => {
      const sameMarket = (existing.market || "").toLowerCase() === (betData.market || "").toLowerCase() || existing.signalId === betData.signalId;
      const sameAmount = Math.abs((existing.amount || 0) - (betData.amount || 0)) < 10;
      const recentEnough = new Date(existing.timestamp).getTime() > fiveMinutesAgo;
      return sameMarket && sameAmount && recentEnough;
    });
    if (isDuplicate) {
      console.log(`Skipping duplicate bet for wallet ${walletAddress.slice(0, 8)}... on ${betData.market}`);
      return stats;
    }
    const tradeRecord = {
      id: tradeId,
      signalId: betData.signalId,
      market: betData.market,
      marketTitle: betData.marketTitle || betData.market,
      direction: betData.direction,
      amount: betData.amount || 0,
      price: betData.price || 0,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      outcome: null,
      settledAt: null,
      // P&L tracking fields
      invested: betData.amount || 0,
      returned: 0,
      pnl: 0,
      roi: 0,
      // Current value tracking (for open positions)
      currentPrice: betData.price || 0,
      currentValue: betData.amount || 0,
      unrealizedPnl: 0
    };
    stats.pending += 1;
    stats.totalVolume += betData.amount || 0;
    stats.lastBetAt = (/* @__PURE__ */ new Date()).toISOString();
    stats.recentBets.unshift(tradeRecord);
    if (stats.recentBets.length > 50) {
      stats.recentBets = stats.recentBets.slice(0, 50);
    }
    await storeIndividualTrade(env, walletAddress, tradeRecord);
    await env.SIGNALS_CACHE.put(key, JSON.stringify(stats), {
      expirationTtl: 90 * 24 * 60 * 60
    });
    await addToWalletIndex(env, walletAddress);
    return stats;
  } catch (e) {
    console.error("Error tracking wallet bet:", e.message);
    return null;
  }
}
__name(trackWalletBet, "trackWalletBet");
async function storeIndividualTrade(env, walletAddress, trade) {
  if (!env.SIGNALS_CACHE) return;
  const tradesKey = `wallet_trades_${walletAddress.toLowerCase()}`;
  try {
    let trades = await env.SIGNALS_CACHE.get(tradesKey, { type: "json" }) || {
      open: [],
      resolved: [],
      lastUpdated: null
    };
    trades.open.unshift(trade);
    if (trades.open.length > 100) {
      trades.open = trades.open.slice(0, 100);
    }
    trades.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    await env.SIGNALS_CACHE.put(tradesKey, JSON.stringify(trades), {
      expirationTtl: 180 * 24 * 60 * 60
      // 6 months
    });
  } catch (e) {
    console.error("Error storing individual trade:", e.message);
  }
}
__name(storeIndividualTrade, "storeIndividualTrade");
async function recordWalletOutcome(env, walletAddress, outcome, profitLoss, marketType, betAmount, signalId) {
  if (!env.SIGNALS_CACHE || !walletAddress) return null;
  const key = KV_KEYS.WALLETS_PREFIX + walletAddress.toLowerCase();
  const tradesKey = `wallet_trades_${walletAddress.toLowerCase()}`;
  try {
    let stats = await env.SIGNALS_CACHE.get(key, { type: "json" });
    if (!stats) return null;
    let calculatedPnl = profitLoss || 0;
    let returnedAmount = 0;
    let betFound = false;
    if (stats.recentBets) {
      for (let i = 0; i < stats.recentBets.length; i++) {
        const bet = stats.recentBets[i];
        if (signalId && bet.signalId === signalId || bet.market && bet.market.toLowerCase().includes(signalId?.toLowerCase()) && bet.outcome === null) {
          const invested = bet.amount || betAmount || 0;
          const entryPrice = bet.price || 0.5;
          if (outcome === "WIN") {
            const shares = invested / entryPrice;
            returnedAmount = shares;
            calculatedPnl = returnedAmount - invested;
          } else if (outcome === "LOSS") {
            returnedAmount = 0;
            calculatedPnl = -invested;
          }
          stats.recentBets[i].outcome = outcome;
          stats.recentBets[i].settledAt = (/* @__PURE__ */ new Date()).toISOString();
          stats.recentBets[i].returned = returnedAmount;
          stats.recentBets[i].pnl = calculatedPnl;
          stats.recentBets[i].roi = invested > 0 ? Math.round(calculatedPnl / invested * 100) : 0;
          betFound = true;
          break;
        }
      }
    }
    await updateTradeOutcome(env, walletAddress, signalId, outcome, calculatedPnl, returnedAmount);
    stats.totalBets += 1;
    stats.pending = Math.max(0, stats.pending - 1);
    if (outcome === "WIN") {
      stats.wins += 1;
      stats.currentStreak = Math.max(0, stats.currentStreak) + 1;
      stats.bestStreak = Math.max(stats.bestStreak || 0, stats.currentStreak);
    } else if (outcome === "LOSS") {
      stats.losses += 1;
      stats.currentStreak = Math.min(0, stats.currentStreak) - 1;
    }
    stats.profitLoss = (stats.profitLoss || 0) + calculatedPnl;
    stats.winRate = stats.totalBets > 0 ? Math.round(stats.wins / stats.totalBets * 100) : 0;
    stats.tier = getWalletTier(stats)?.tier || null;
    const shouldKeep = evaluateWalletForKeeping(stats);
    if (shouldKeep) {
      await env.SIGNALS_CACHE.put(key, JSON.stringify(stats), {
        expirationTtl: 90 * 24 * 60 * 60
      });
      if (stats.winRate >= KEEPER_THRESHOLDS.MIN_WIN_RATE && stats.totalBets >= KEEPER_THRESHOLDS.MIN_BETS) {
        await updateWinningWalletsCache(env, walletAddress, stats);
      }
    } else if (stats.totalBets >= 5 && stats.winRate < 45) {
      console.log(`Pruning losing wallet ${walletAddress.slice(0, 8)}... (${stats.winRate}% over ${stats.totalBets} bets)`);
      await removeFromWalletIndex(env, walletAddress);
      await env.SIGNALS_CACHE.delete(key);
    }
    return stats;
  } catch (e) {
    console.error("Error recording wallet outcome:", e.message);
    return null;
  }
}
__name(recordWalletOutcome, "recordWalletOutcome");
async function updateTradeOutcome(env, walletAddress, signalId, outcome, pnl, returned) {
  if (!env.SIGNALS_CACHE) return;
  const tradesKey = `wallet_trades_${walletAddress.toLowerCase()}`;
  try {
    let trades = await env.SIGNALS_CACHE.get(tradesKey, { type: "json" });
    if (!trades) return;
    const tradeIndex = trades.open.findIndex(
      (t) => t.signalId === signalId || t.market && t.market.toLowerCase().includes(signalId?.toLowerCase())
    );
    if (tradeIndex >= 0) {
      const trade = trades.open[tradeIndex];
      trade.outcome = outcome;
      trade.settledAt = (/* @__PURE__ */ new Date()).toISOString();
      trade.returned = returned;
      trade.pnl = pnl;
      trade.roi = trade.invested > 0 ? Math.round(pnl / trade.invested * 100) : 0;
      trades.resolved.unshift(trade);
      trades.open.splice(tradeIndex, 1);
      if (trades.resolved.length > 200) {
        trades.resolved = trades.resolved.slice(0, 200);
      }
      trades.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
      await env.SIGNALS_CACHE.put(tradesKey, JSON.stringify(trades), {
        expirationTtl: 180 * 24 * 60 * 60
      });
    }
  } catch (e) {
    console.error("Error updating trade outcome:", e.message);
  }
}
__name(updateTradeOutcome, "updateTradeOutcome");
function evaluateWalletForKeeping(stats) {
  if (stats.pending > 0) return true;
  if (stats.totalBets < KEEPER_THRESHOLDS.MIN_BETS) return true;
  if (stats.winRate >= KEEPER_THRESHOLDS.MIN_WIN_RATE) return true;
  if (stats.totalVolume >= 5e4) return true;
  if (stats.lastBetAt) {
    const daysSinceLastBet = (Date.now() - new Date(stats.lastBetAt).getTime()) / (24 * 60 * 60 * 1e3);
    if (daysSinceLastBet < 7) return true;
  }
  return false;
}
__name(evaluateWalletForKeeping, "evaluateWalletForKeeping");
async function getWalletPnL(env, walletAddress) {
  if (!env.SIGNALS_CACHE || !walletAddress) {
    return { success: false, error: "Invalid request" };
  }
  const key = KV_KEYS.WALLETS_PREFIX + walletAddress.toLowerCase();
  const tradesKey = `wallet_trades_${walletAddress.toLowerCase()}`;
  try {
    const stats = await env.SIGNALS_CACHE.get(key, { type: "json" });
    if (!stats) {
      return { success: false, error: "Wallet not found" };
    }
    let trades = await env.SIGNALS_CACHE.get(tradesKey, { type: "json" });
    if (!trades) {
      trades = {
        open: [],
        resolved: [],
        lastUpdated: null
      };
      const seen = /* @__PURE__ */ new Map();
      if (stats.recentBets && stats.recentBets.length > 0) {
        for (const bet of stats.recentBets) {
          const dedupKey = `${(bet.market || bet.signalId || "").toLowerCase()}-${Math.round(bet.amount || 0)}`;
          if (seen.has(dedupKey)) continue;
          seen.set(dedupKey, true);
          const invested = bet.amount || 0;
          const entryPrice = bet.price || 0.5;
          let returned = bet.returned || 0;
          let pnl = bet.pnl || 0;
          let roi2 = bet.roi || 0;
          if (bet.outcome === "WIN" && pnl === 0 && invested > 0) {
            const shares = invested / entryPrice;
            returned = Math.round(shares * 100) / 100;
            pnl = Math.round((returned - invested) * 100) / 100;
            roi2 = Math.round(pnl / invested * 100);
          } else if (bet.outcome === "LOSS" && pnl === 0 && invested > 0) {
            returned = 0;
            pnl = -invested;
            roi2 = -100;
          }
          let marketTitle = bet.marketTitle || bet.market || "";
          marketTitle = formatMarketTitle(marketTitle);
          const tradeRecord = {
            id: bet.id || `${bet.signalId || bet.market}-${bet.timestamp}`,
            signalId: bet.signalId,
            market: bet.market,
            marketTitle,
            direction: bet.direction,
            amount: invested,
            price: entryPrice,
            timestamp: bet.timestamp,
            outcome: bet.outcome,
            settledAt: bet.settledAt,
            invested,
            returned,
            pnl,
            roi: roi2,
            currentPrice: bet.currentPrice || entryPrice,
            currentValue: bet.currentValue || invested,
            unrealizedPnl: bet.unrealizedPnl || 0
          };
          if (bet.outcome === "WIN" || bet.outcome === "LOSS") {
            trades.resolved.push(tradeRecord);
          } else {
            trades.open.push(tradeRecord);
          }
        }
      }
    }
    const totalInvested = [...trades.open, ...trades.resolved].reduce((sum, t) => sum + (t.invested || t.amount || 0), 0);
    const totalReturned = trades.resolved.reduce((sum, t) => sum + (t.returned || 0), 0);
    const realizedPnl = trades.resolved.reduce((sum, t) => sum + (t.pnl || 0), 0);
    let unrealizedPnl = 0;
    for (const trade of trades.open) {
      const currentValue = trade.currentValue || trade.amount || 0;
      const invested = trade.invested || trade.amount || 0;
      trade.unrealizedPnl = currentValue - invested;
      unrealizedPnl += trade.unrealizedPnl;
    }
    const totalPnl = realizedPnl + unrealizedPnl;
    const roi = totalInvested > 0 ? Math.round(totalPnl / totalInvested * 100) : 0;
    return {
      success: true,
      address: walletAddress.toLowerCase(),
      // Summary stats
      summary: {
        totalPnl: Math.round(totalPnl * 100) / 100,
        realizedPnl: Math.round(realizedPnl * 100) / 100,
        unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
        totalInvested: Math.round(totalInvested * 100) / 100,
        totalReturned: Math.round(totalReturned * 100) / 100,
        roi,
        wins: stats.wins || 0,
        losses: stats.losses || 0,
        pending: stats.pending || 0,
        winRate: stats.winRate || 0,
        totalVolume: stats.totalVolume || 0,
        currentStreak: stats.currentStreak || 0,
        bestStreak: stats.bestStreak || 0
      },
      // Detailed trade arrays
      openBets: trades.open.map((t) => ({
        id: t.id,
        market: t.market,
        marketTitle: t.marketTitle || t.market,
        direction: t.direction,
        invested: t.invested || t.amount || 0,
        entryPrice: t.price || 0,
        currentPrice: t.currentPrice || t.price || 0,
        currentValue: t.currentValue || t.invested || 0,
        unrealizedPnl: t.unrealizedPnl || 0,
        roi: t.roi || 0,
        timestamp: t.timestamp
      })),
      resolvedBets: trades.resolved.map((t) => ({
        id: t.id,
        market: t.market,
        marketTitle: t.marketTitle || t.market,
        direction: t.direction,
        outcome: t.outcome,
        invested: t.invested || t.amount || 0,
        entryPrice: t.price || 0,
        returned: t.returned || 0,
        pnl: t.pnl || 0,
        roi: t.roi || 0,
        timestamp: t.timestamp,
        settledAt: t.settledAt
      })),
      lastUpdated: trades.lastUpdated || stats.lastBetAt
    };
  } catch (e) {
    console.error("Error getting wallet P&L:", e.message);
    return { success: false, error: e.message };
  }
}
__name(getWalletPnL, "getWalletPnL");
async function updateWinningWalletsCache(env, walletAddress, stats) {
  if (!env.SIGNALS_CACHE) return;
  try {
    let cache = await env.SIGNALS_CACHE.get("winning_wallets_cache", { type: "json" }) || { wallets: {}, timestamp: 0 };
    cache.wallets[walletAddress.toLowerCase()] = {
      isWinner: true,
      winRate: stats.winRate,
      record: `${stats.wins}W-${stats.losses}L`,
      tier: stats.tier,
      totalBets: stats.totalBets
    };
    cache.timestamp = Date.now();
    const entries = Object.entries(cache.wallets);
    if (entries.length > 100) {
      entries.sort((a, b) => b[1].winRate - a[1].winRate);
      cache.wallets = Object.fromEntries(entries.slice(0, 100));
    }
    await env.SIGNALS_CACHE.put("winning_wallets_cache", JSON.stringify(cache), {
      expirationTtl: 24 * 60 * 60
      // 24 hours
    });
  } catch (e) {
    console.error("Error updating winning wallets cache:", e.message);
  }
}
__name(updateWinningWalletsCache, "updateWinningWalletsCache");
async function getWalletStats(env, walletAddress) {
  if (!env.SIGNALS_CACHE || !walletAddress) return null;
  const key = KV_KEYS.WALLETS_PREFIX + walletAddress.toLowerCase();
  try {
    const stats = await env.SIGNALS_CACHE.get(key, { type: "json" });
    if (stats) {
      stats.tierInfo = getWalletTier(stats);
    }
    return stats;
  } catch (e) {
    return null;
  }
}
__name(getWalletStats, "getWalletStats");
async function addToWalletIndex(env, walletAddress) {
  if (!env.SIGNALS_CACHE) return;
  try {
    const indexKey = "tracked_wallet_index";
    let index = await env.SIGNALS_CACHE.get(indexKey, { type: "json" }) || [];
    const normalizedAddress = walletAddress.toLowerCase();
    if (!index.includes(normalizedAddress)) {
      index.push(normalizedAddress);
      await env.SIGNALS_CACHE.put(indexKey, JSON.stringify(index), {
        expirationTtl: 365 * 24 * 60 * 60
      });
    }
  } catch (e) {
  }
}
__name(addToWalletIndex, "addToWalletIndex");
async function removeFromWalletIndex(env, walletAddress) {
  if (!env.SIGNALS_CACHE) return;
  try {
    const indexKey = "tracked_wallet_index";
    let index = await env.SIGNALS_CACHE.get(indexKey, { type: "json" }) || [];
    const normalizedAddress = walletAddress.toLowerCase();
    index = index.filter((addr) => addr !== normalizedAddress);
    await env.SIGNALS_CACHE.put(indexKey, JSON.stringify(index), {
      expirationTtl: 365 * 24 * 60 * 60
    });
  } catch (e) {
  }
}
__name(removeFromWalletIndex, "removeFromWalletIndex");
async function getTrackedWallets(env) {
  if (!env.SIGNALS_CACHE) return [];
  try {
    return await env.SIGNALS_CACHE.get("tracked_wallet_index", { type: "json" }) || [];
  } catch (e) {
    return [];
  }
}
__name(getTrackedWallets, "getTrackedWallets");
async function getWalletLeaderboard(env, limit = 50) {
  const walletIndex = await getTrackedWallets(env);
  const wallets = [];
  console.log(`Leaderboard: Checking ${walletIndex.length} wallets`);
  const BATCH_SIZE = 50;
  for (let i = 0; i < Math.min(walletIndex.length, 200); i += BATCH_SIZE) {
    const batch = walletIndex.slice(i, i + BATCH_SIZE);
    for (const address of batch) {
      if (!address) continue;
      const stats = await getWalletStats(env, address);
      if (stats && (stats.totalBets >= 1 || stats.pending > 0)) {
        wallets.push({
          address: stats.address || address,
          wins: stats.wins || 0,
          losses: stats.losses || 0,
          pending: stats.pending || 0,
          totalBets: stats.totalBets || 0,
          winRate: stats.winRate || 0,
          totalVolume: stats.totalVolume || 0,
          tier: stats.tier || (stats.pending > 0 ? "PENDING" : "NEW"),
          tierInfo: getWalletTier(stats),
          profitLoss: stats.profitLoss || 0,
          currentStreak: stats.currentStreak || 0,
          bestStreak: stats.bestStreak || 0,
          lastBetAt: stats.lastBetAt || null
        });
      }
    }
  }
  console.log(`Leaderboard: Found ${wallets.length} active wallets`);
  const tierOrder = { "INSIDER": 0, "ELITE": 1, "STRONG": 2, "AVERAGE": 3, "PENDING": 4, "NEW": 5, "FADE": 6 };
  wallets.sort((a, b) => {
    const aIsWinner = a.winRate >= 55 && a.totalBets >= 3;
    const bIsWinner = b.winRate >= 55 && b.totalBets >= 3;
    if (aIsWinner && !bIsWinner) return -1;
    if (!aIsWinner && bIsWinner) return 1;
    const tierDiff = (tierOrder[a.tier] || 99) - (tierOrder[b.tier] || 99);
    if (tierDiff !== 0) return tierDiff;
    return b.winRate - a.winRate;
  });
  return wallets.slice(0, limit);
}
__name(getWalletLeaderboard, "getWalletLeaderboard");
async function pruneLosingWallets(env) {
  if (!env.SIGNALS_CACHE) return { pruned: 0, kept: 0 };
  const walletIndex = await getTrackedWallets(env);
  let pruned = 0;
  let kept = 0;
  console.log(`Pruning: Checking ${walletIndex.length} wallets`);
  for (const address of walletIndex) {
    if (!address) continue;
    try {
      const stats = await getWalletStats(env, address);
      if (!stats) {
        await removeFromWalletIndex(env, address);
        pruned++;
        continue;
      }
      if (stats.totalBets >= 5 && stats.winRate < 45 && stats.pending === 0) {
        const key = KV_KEYS.WALLETS_PREFIX + address.toLowerCase();
        await env.SIGNALS_CACHE.delete(key);
        await removeFromWalletIndex(env, address);
        pruned++;
        console.log(`Pruned: ${address.slice(0, 8)}... (${stats.winRate}% over ${stats.totalBets} bets)`);
      } else {
        kept++;
      }
    } catch (e) {
      pruned++;
    }
  }
  console.log(`Pruning complete: ${pruned} removed, ${kept} kept`);
  return { pruned, kept };
}
__name(pruneLosingWallets, "pruneLosingWallets");
async function deduplicateWalletBets(env) {
  if (!env.SIGNALS_CACHE) return { walletsProcessed: 0, duplicatesRemoved: 0 };
  const walletIndex = await getTrackedWallets(env);
  let walletsProcessed = 0;
  let duplicatesRemoved = 0;
  console.log(`Deduplicating bets in ${walletIndex.length} wallets`);
  for (const address of walletIndex) {
    if (!address) continue;
    try {
      const key = KV_KEYS.WALLETS_PREFIX + address.toLowerCase();
      const stats = await env.SIGNALS_CACHE.get(key, { type: "json" });
      if (!stats || !stats.recentBets || stats.recentBets.length === 0) continue;
      const originalCount = stats.recentBets.length;
      const seen = /* @__PURE__ */ new Map();
      const uniqueBets = [];
      for (const bet of stats.recentBets) {
        const market = (bet.market || bet.signalId || "").toLowerCase();
        const amount = Math.round(bet.amount || 0);
        const key2 = `${market}-${amount}`;
        if (!seen.has(key2)) {
          seen.set(key2, bet);
          uniqueBets.push(bet);
        } else {
          const existing = seen.get(key2);
          if (bet.outcome && !existing.outcome) {
            existing.outcome = bet.outcome;
            existing.settledAt = bet.settledAt;
          }
        }
      }
      const removed = originalCount - uniqueBets.length;
      if (removed > 0) {
        const wins = uniqueBets.filter((b) => b.outcome === "WIN").length;
        const losses = uniqueBets.filter((b) => b.outcome === "LOSS").length;
        const pending = uniqueBets.filter((b) => !b.outcome).length;
        const totalBets = wins + losses;
        stats.recentBets = uniqueBets;
        stats.wins = wins;
        stats.losses = losses;
        stats.pending = pending;
        stats.totalBets = totalBets;
        stats.winRate = totalBets > 0 ? Math.round(wins / totalBets * 100) : 0;
        await env.SIGNALS_CACHE.put(key, JSON.stringify(stats), {
          expirationTtl: 90 * 24 * 60 * 60
        });
        duplicatesRemoved += removed;
        console.log(`Wallet ${address.slice(0, 8)}...: removed ${removed} duplicates, now ${stats.wins}W-${stats.losses}L (${stats.winRate}%)`);
      }
      walletsProcessed++;
    } catch (e) {
      console.error(`Error deduplicating wallet ${address}:`, e.message);
    }
  }
  console.log(`Deduplication complete: ${walletsProcessed} wallets, ${duplicatesRemoved} duplicates removed`);
  return { walletsProcessed, duplicatesRemoved };
}
__name(deduplicateWalletBets, "deduplicateWalletBets");
async function clearTradeBuckets(env) {
  if (!env.SIGNALS_CACHE) return { cleared: 0 };
  try {
    const index = await env.SIGNALS_CACHE.get("trades_index", { type: "json" }) || [];
    let cleared = 0;
    for (const bucketKey of index) {
      try {
        await env.SIGNALS_CACHE.delete(bucketKey);
        cleared++;
      } catch (e) {
      }
    }
    await env.SIGNALS_CACHE.delete("trades_index");
    await env.SIGNALS_CACHE.delete("trades_last_poll");
    await env.SIGNALS_CACHE.delete("trades_poll_stats");
    console.log(`Cleared ${cleared} trade buckets`);
    return { cleared };
  } catch (e) {
    return { cleared: 0, error: e.message };
  }
}
__name(clearTradeBuckets, "clearTradeBuckets");
async function fullKVCleanup(env) {
  const results = {
    tradeBuckets: await clearTradeBuckets(env),
    walletPrune: await pruneLosingWallets(env)
  };
  return results;
}
__name(fullKVCleanup, "fullKVCleanup");

// src/learning.js
var LEARNING_KEYS = {
  FACTOR_STATS: KV_KEYS.FACTOR_STATS,
  DISCOVERED_PATTERNS: "discovered_patterns",
  PATTERN_CANDIDATES: "pattern_candidates",
  MARKET_TYPE_STATS: "market_type_stats",
  TIME_PATTERNS: "time_patterns",
  VOLUME_BRACKETS: "volume_brackets"
};
async function updateFactorStats(env, factors, outcome) {
  if (!env.SIGNALS_CACHE || !factors || factors.length === 0) return;
  try {
    let factorStats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.FACTOR_STATS, { type: "json" }) || {};
    for (const factor of factors) {
      const factorName = typeof factor === "object" ? factor.factor || factor.name : factor;
      if (!factorName) continue;
      if (!factorStats[factorName]) {
        factorStats[factorName] = {
          wins: 0,
          losses: 0,
          winRate: 50,
          weight: 1,
          sampleSize: 0,
          lastUpdated: null,
          isDiscovered: false
          // Track if this was auto-discovered
        };
      }
      if (outcome === "WIN") {
        factorStats[factorName].wins += 1;
      } else {
        factorStats[factorName].losses += 1;
      }
      const total = factorStats[factorName].wins + factorStats[factorName].losses;
      factorStats[factorName].sampleSize = total;
      factorStats[factorName].winRate = Math.round(factorStats[factorName].wins / total * 100);
      const sampleMultiplier = Math.min(1, total / 10);
      const performanceWeight = 0.5 + factorStats[factorName].winRate / 100 * 1.5;
      factorStats[factorName].weight = 0.5 + (performanceWeight - 0.5) * sampleMultiplier;
      factorStats[factorName].lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    }
    await env.SIGNALS_CACHE.put(LEARNING_KEYS.FACTOR_STATS, JSON.stringify(factorStats), {
      expirationTtl: 90 * 24 * 60 * 60
    });
    return factorStats;
  } catch (e) {
    console.error("Error updating factor stats:", e.message);
    return null;
  }
}
__name(updateFactorStats, "updateFactorStats");
async function trackSignalMetadata(env, signal, outcome) {
  if (!env.SIGNALS_CACHE) return;
  try {
    await trackMarketTypePerformance(env, signal.marketType, outcome);
    await trackVolumeBracket(env, signal.totalVolume, outcome);
    await trackTimePattern(env, signal.detectedAt, outcome);
    await trackWalletCountPattern(env, signal.walletCount, outcome);
    await trackEventTiming(env, signal, outcome);
    await discoverNewPatterns(env);
  } catch (e) {
    console.error("Error tracking signal metadata:", e.message);
  }
}
__name(trackSignalMetadata, "trackSignalMetadata");
async function trackMarketTypePerformance(env, marketType, outcome) {
  if (!marketType) return;
  let stats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.MARKET_TYPE_STATS, { type: "json" }) || {};
  if (!stats[marketType]) {
    stats[marketType] = { wins: 0, losses: 0, winRate: 50 };
  }
  if (outcome === "WIN") stats[marketType].wins++;
  else stats[marketType].losses++;
  const total = stats[marketType].wins + stats[marketType].losses;
  stats[marketType].winRate = Math.round(stats[marketType].wins / total * 100);
  await env.SIGNALS_CACHE.put(LEARNING_KEYS.MARKET_TYPE_STATS, JSON.stringify(stats), {
    expirationTtl: 90 * 24 * 60 * 60
  });
}
__name(trackMarketTypePerformance, "trackMarketTypePerformance");
async function trackVolumeBracket(env, volume, outcome) {
  let stats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.VOLUME_BRACKETS, { type: "json" }) || {};
  let bracket;
  if (volume >= 1e5) bracket = "vol_100k_plus";
  else if (volume >= 5e4) bracket = "vol_50k_100k";
  else if (volume >= 25e3) bracket = "vol_25k_50k";
  else if (volume >= 1e4) bracket = "vol_10k_25k";
  else bracket = "vol_under_10k";
  if (!stats[bracket]) {
    stats[bracket] = { wins: 0, losses: 0, winRate: 50 };
  }
  if (outcome === "WIN") stats[bracket].wins++;
  else stats[bracket].losses++;
  const total = stats[bracket].wins + stats[bracket].losses;
  stats[bracket].winRate = Math.round(stats[bracket].wins / total * 100);
  await env.SIGNALS_CACHE.put(LEARNING_KEYS.VOLUME_BRACKETS, JSON.stringify(stats), {
    expirationTtl: 90 * 24 * 60 * 60
  });
}
__name(trackVolumeBracket, "trackVolumeBracket");
async function trackTimePattern(env, detectedAt, outcome) {
  if (!detectedAt) return;
  let stats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.TIME_PATTERNS, { type: "json" }) || {};
  const hour = new Date(detectedAt).getUTCHours();
  let timeBlock;
  if (hour >= 5 && hour < 12) timeBlock = "morning_5_12";
  else if (hour >= 12 && hour < 17) timeBlock = "afternoon_12_17";
  else if (hour >= 17 && hour < 22) timeBlock = "evening_17_22";
  else timeBlock = "night_22_5";
  const day = new Date(detectedAt).getUTCDay();
  const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][day];
  for (const pattern of [timeBlock, `day_${dayName}`]) {
    if (!stats[pattern]) {
      stats[pattern] = { wins: 0, losses: 0, winRate: 50 };
    }
    if (outcome === "WIN") stats[pattern].wins++;
    else stats[pattern].losses++;
    const total = stats[pattern].wins + stats[pattern].losses;
    stats[pattern].winRate = Math.round(stats[pattern].wins / total * 100);
  }
  await env.SIGNALS_CACHE.put(LEARNING_KEYS.TIME_PATTERNS, JSON.stringify(stats), {
    expirationTtl: 90 * 24 * 60 * 60
  });
}
__name(trackTimePattern, "trackTimePattern");
async function trackWalletCountPattern(env, walletCount, outcome) {
  let stats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.PATTERN_CANDIDATES, { type: "json" }) || {};
  let pattern;
  if (walletCount === 1) pattern = "single_wallet";
  else if (walletCount === 2) pattern = "two_wallets";
  else if (walletCount <= 5) pattern = "few_wallets_3_5";
  else pattern = "many_wallets_6_plus";
  if (!stats[pattern]) {
    stats[pattern] = { wins: 0, losses: 0, winRate: 50, category: "wallet_count" };
  }
  if (outcome === "WIN") stats[pattern].wins++;
  else stats[pattern].losses++;
  const total = stats[pattern].wins + stats[pattern].losses;
  stats[pattern].winRate = Math.round(stats[pattern].wins / total * 100);
  await env.SIGNALS_CACHE.put(LEARNING_KEYS.PATTERN_CANDIDATES, JSON.stringify(stats), {
    expirationTtl: 90 * 24 * 60 * 60
  });
}
__name(trackWalletCountPattern, "trackWalletCountPattern");
async function trackEventTiming(env, signal, outcome) {
  if (!signal.marketSlug && !signal.marketTitle) return;
  const slug = signal.marketSlug || "";
  const dateMatch = slug.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) return;
  const eventDate = new Date(
    parseInt(dateMatch[1]),
    parseInt(dateMatch[2]) - 1,
    parseInt(dateMatch[3])
  );
  eventDate.setUTCHours(24, 0, 0, 0);
  const betTime = signal.lastTradeTime ? new Date(signal.lastTradeTime).getTime() : signal.detectedAt ? new Date(signal.detectedAt).getTime() : null;
  if (!betTime || isNaN(betTime)) return;
  const hoursBeforeEvent = (eventDate.getTime() - betTime) / (1e3 * 60 * 60);
  let timingFactor;
  if (hoursBeforeEvent <= 0) timingFactor = "betDuringEvent";
  else if (hoursBeforeEvent <= 2) timingFactor = "betLast2Hours";
  else if (hoursBeforeEvent <= 6) timingFactor = "betSameDay";
  else if (hoursBeforeEvent <= 24) timingFactor = "betDayBefore";
  else if (hoursBeforeEvent <= 72) timingFactor = "betEarlyDays";
  else timingFactor = "betVeryEarly";
  let stats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.PATTERN_CANDIDATES, { type: "json" }) || {};
  if (!stats[timingFactor]) {
    stats[timingFactor] = { wins: 0, losses: 0, winRate: 50, category: "event_timing" };
  }
  if (outcome === "WIN") stats[timingFactor].wins++;
  else stats[timingFactor].losses++;
  const total = stats[timingFactor].wins + stats[timingFactor].losses;
  stats[timingFactor].winRate = Math.round(stats[timingFactor].wins / total * 100);
  await env.SIGNALS_CACHE.put(LEARNING_KEYS.PATTERN_CANDIDATES, JSON.stringify(stats), {
    expirationTtl: 90 * 24 * 60 * 60
  });
}
__name(trackEventTiming, "trackEventTiming");
async function discoverNewPatterns(env) {
  try {
    const candidates = await env.SIGNALS_CACHE.get(LEARNING_KEYS.PATTERN_CANDIDATES, { type: "json" }) || {};
    const timePatterns = await env.SIGNALS_CACHE.get(LEARNING_KEYS.TIME_PATTERNS, { type: "json" }) || {};
    const volumeBrackets = await env.SIGNALS_CACHE.get(LEARNING_KEYS.VOLUME_BRACKETS, { type: "json" }) || {};
    const marketTypes = await env.SIGNALS_CACHE.get(LEARNING_KEYS.MARKET_TYPE_STATS, { type: "json" }) || {};
    let factorStats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.FACTOR_STATS, { type: "json" }) || {};
    let discovered = await env.SIGNALS_CACHE.get(LEARNING_KEYS.DISCOVERED_PATTERNS, { type: "json" }) || [];
    const allPatterns = { ...candidates, ...timePatterns, ...volumeBrackets, ...marketTypes };
    for (const [patternName, stats] of Object.entries(allPatterns)) {
      const total = (stats.wins || 0) + (stats.losses || 0);
      if (total >= 10 && !factorStats[patternName]) {
        if (stats.winRate >= 60 || stats.winRate <= 35) {
          factorStats[patternName] = {
            wins: stats.wins,
            losses: stats.losses,
            winRate: stats.winRate,
            weight: 0.5 + stats.winRate / 100 * 1.5,
            sampleSize: total,
            lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
            isDiscovered: true,
            discoveredAt: (/* @__PURE__ */ new Date()).toISOString(),
            category: stats.category || "auto_discovered"
          };
          if (!discovered.includes(patternName)) {
            discovered.push(patternName);
          }
          console.log(`\u{1F50D} Discovered new pattern: ${patternName} (${stats.winRate}% over ${total} samples)`);
        }
      }
    }
    await env.SIGNALS_CACHE.put(LEARNING_KEYS.FACTOR_STATS, JSON.stringify(factorStats), {
      expirationTtl: 90 * 24 * 60 * 60
    });
    await env.SIGNALS_CACHE.put(LEARNING_KEYS.DISCOVERED_PATTERNS, JSON.stringify(discovered), {
      expirationTtl: 90 * 24 * 60 * 60
    });
  } catch (e) {
    console.error("Error discovering patterns:", e.message);
  }
}
__name(discoverNewPatterns, "discoverNewPatterns");
async function calculateConfidence(env, factors, signal = {}) {
  if (!env.SIGNALS_CACHE) return null;
  try {
    const factorStats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.FACTOR_STATS, { type: "json" }) || {};
    const marketTypeStats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.MARKET_TYPE_STATS, { type: "json" }) || {};
    const volumeBrackets = await env.SIGNALS_CACHE.get(LEARNING_KEYS.VOLUME_BRACKETS, { type: "json" }) || {};
    const timePatterns = await env.SIGNALS_CACHE.get(LEARNING_KEYS.TIME_PATTERNS, { type: "json" }) || {};
    let components = [];
    if (factors && factors.length > 0) {
      let totalWeight2 = 0;
      let weightedWinRate = 0;
      for (const factor of factors) {
        const factorName = typeof factor === "object" ? factor.factor || factor.name : factor;
        if (!factorName) continue;
        const stats = factorStats[factorName];
        if (stats && stats.sampleSize >= 3) {
          const weight = stats.weight || 1;
          totalWeight2 += weight;
          weightedWinRate += stats.winRate * weight;
        }
      }
      if (totalWeight2 > 0) {
        components.push({
          source: "factors",
          confidence: Math.round(weightedWinRate / totalWeight2),
          weight: 3
          // Factors are most important
        });
      }
    }
    if (signal.marketType && marketTypeStats[signal.marketType]) {
      const stats = marketTypeStats[signal.marketType];
      if (stats.wins + stats.losses >= 5) {
        components.push({
          source: "market_type",
          confidence: stats.winRate,
          weight: 1
        });
      }
    }
    if (signal.totalVolume) {
      let bracket;
      if (signal.totalVolume >= 1e5) bracket = "vol_100k_plus";
      else if (signal.totalVolume >= 5e4) bracket = "vol_50k_100k";
      else if (signal.totalVolume >= 25e3) bracket = "vol_25k_50k";
      else if (signal.totalVolume >= 1e4) bracket = "vol_10k_25k";
      else bracket = "vol_under_10k";
      if (volumeBrackets[bracket]) {
        const stats = volumeBrackets[bracket];
        if (stats.wins + stats.losses >= 5) {
          components.push({
            source: "volume",
            confidence: stats.winRate,
            weight: 1
          });
        }
      }
    }
    if (signal.detectedAt) {
      const hour = new Date(signal.detectedAt).getUTCHours();
      let timeBlock;
      if (hour >= 5 && hour < 12) timeBlock = "morning_5_12";
      else if (hour >= 12 && hour < 17) timeBlock = "afternoon_12_17";
      else if (hour >= 17 && hour < 22) timeBlock = "evening_17_22";
      else timeBlock = "night_22_5";
      if (timePatterns[timeBlock]) {
        const stats = timePatterns[timeBlock];
        if (stats.wins + stats.losses >= 5) {
          components.push({
            source: "time",
            confidence: stats.winRate,
            weight: 0.5
          });
        }
      }
    }
    const candidates = await env.SIGNALS_CACHE.get(LEARNING_KEYS.PATTERN_CANDIDATES, { type: "json" }) || {};
    if (factors) {
      const factorNames = factors.map((f) => typeof f === "object" ? f.factor || f.name : f).filter(Boolean);
      const timingFactors = ["betDuringEvent", "betLast2Hours", "betSameDay", "betDayBefore", "betEarlyDays", "betVeryEarly"];
      for (const tf of timingFactors) {
        if (factorNames.includes(tf) && candidates[tf]) {
          const stats = candidates[tf];
          const total = (stats.wins || 0) + (stats.losses || 0);
          if (total >= 5) {
            components.push({
              source: "event_timing",
              confidence: stats.winRate,
              weight: 1.5
              // Event timing is highly predictive
            });
            break;
          }
        }
      }
    }
    if (components.length === 0) {
      return null;
    }
    let totalWeight = 0;
    let weightedConfidence = 0;
    for (const comp of components) {
      totalWeight += comp.weight;
      weightedConfidence += comp.confidence * comp.weight;
    }
    const finalConfidence = Math.round(weightedConfidence / totalWeight);
    return {
      confidence: Math.max(0, Math.min(100, finalConfidence)),
      components,
      dataPoints: components.length
    };
  } catch (e) {
    console.error("Error calculating confidence:", e.message);
    return null;
  }
}
__name(calculateConfidence, "calculateConfidence");
async function getFactorStats(env) {
  if (!env.SIGNALS_CACHE) return {};
  try {
    return await env.SIGNALS_CACHE.get(LEARNING_KEYS.FACTOR_STATS, { type: "json" }) || {};
  } catch (e) {
    console.error("Error getting factor stats:", e.message);
    return {};
  }
}
__name(getFactorStats, "getFactorStats");
async function getDiscoveredPatterns(env) {
  if (!env.SIGNALS_CACHE) return { patterns: [], candidates: {} };
  try {
    const discovered = await env.SIGNALS_CACHE.get(LEARNING_KEYS.DISCOVERED_PATTERNS, { type: "json" }) || [];
    const candidates = await env.SIGNALS_CACHE.get(LEARNING_KEYS.PATTERN_CANDIDATES, { type: "json" }) || {};
    const timePatterns = await env.SIGNALS_CACHE.get(LEARNING_KEYS.TIME_PATTERNS, { type: "json" }) || {};
    const volumeBrackets = await env.SIGNALS_CACHE.get(LEARNING_KEYS.VOLUME_BRACKETS, { type: "json" }) || {};
    const marketTypes = await env.SIGNALS_CACHE.get(LEARNING_KEYS.MARKET_TYPE_STATS, { type: "json" }) || {};
    const allCandidates = { ...candidates, ...timePatterns, ...volumeBrackets, ...marketTypes };
    const nearPromotion = [];
    for (const [name, stats] of Object.entries(allCandidates)) {
      const total = (stats.wins || 0) + (stats.losses || 0);
      if (total >= 5 && total < 10) {
        nearPromotion.push({
          name,
          ...stats,
          samplesNeeded: 10 - total
        });
      }
    }
    return {
      promotedPatterns: discovered,
      nearPromotion: nearPromotion.sort((a, b) => b.winRate - a.winRate),
      allTracking: {
        candidates: Object.keys(candidates).length,
        timePatterns: Object.keys(timePatterns).length,
        volumeBrackets: Object.keys(volumeBrackets).length,
        marketTypes: Object.keys(marketTypes).length
      }
    };
  } catch (e) {
    console.error("Error getting discovered patterns:", e.message);
    return { patterns: [], candidates: {} };
  }
}
__name(getDiscoveredPatterns, "getDiscoveredPatterns");
async function getAIRecommendation(env) {
  if (!env.SIGNALS_CACHE) return null;
  try {
    const factorStats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.FACTOR_STATS, { type: "json" }) || {};
    const discoveredPatterns = await getDiscoveredPatterns(env);
    const factors = Object.entries(factorStats);
    if (factors.length < 3) {
      return {
        hasRecommendation: false,
        message: "Need more data to generate recommendations",
        patternsTracking: discoveredPatterns.allTracking
      };
    }
    const coreFactors = factors.filter(([name, stats]) => !stats.isDiscovered);
    const discoveredFactors = factors.filter(([name, stats]) => stats.isDiscovered);
    const sorted = factors.filter(([name, stats]) => stats.wins + stats.losses >= 3).sort((a, b) => b[1].winRate - a[1].winRate);
    if (sorted.length < 2) {
      return {
        hasRecommendation: false,
        message: "Need more settled bets to generate recommendations",
        patternsTracking: discoveredPatterns.allTracking
      };
    }
    const bestFactors = sorted.slice(0, 3).map(([name, stats]) => ({
      name,
      winRate: stats.winRate,
      record: `${stats.wins}W-${stats.losses}L`,
      isDiscovered: stats.isDiscovered || false
    }));
    const worstFactors = sorted.slice(-3).reverse().map(([name, stats]) => ({
      name,
      winRate: stats.winRate,
      record: `${stats.wins}W-${stats.losses}L`,
      isDiscovered: stats.isDiscovered || false
    }));
    const avgWinRate = sorted.reduce((sum, [_, s]) => sum + s.winRate, 0) / sorted.length;
    let recommendation;
    if (avgWinRate >= 60) {
      recommendation = "\u{1F525} System is running hot! High confidence in signals with top factors.";
    } else if (avgWinRate >= 55) {
      recommendation = "\u{1F4C8} System performing above average. Follow signals with strong factor combinations.";
    } else if (avgWinRate >= 45) {
      recommendation = "\u{1F4CA} System at baseline. Be selective - prioritize signals with proven factors.";
    } else if (avgWinRate >= 35) {
      recommendation = "\u26A0\uFE0F System underperforming. Consider waiting or fading weak signals.";
    } else {
      recommendation = "\u{1F6A8} System in drawdown. Recommend pausing until patterns stabilize.";
    }
    return {
      hasRecommendation: true,
      overallConfidence: Math.round(avgWinRate),
      bestFactors,
      worstFactors,
      recommendation,
      totalFactorsTracked: factors.length,
      factorsWithData: sorted.length,
      discoveredCount: discoveredFactors.length,
      coreFactorsCount: coreFactors.length,
      patternsNearPromotion: discoveredPatterns.nearPromotion.slice(0, 3),
      patternsTracking: discoveredPatterns.allTracking
    };
  } catch (e) {
    console.error("Error getting AI recommendation:", e.message);
    return null;
  }
}
__name(getAIRecommendation, "getAIRecommendation");
var COMBO_KEY = "factor_combos_v1";
async function trackFactorCombo(env, factors, outcome) {
  if (!env.SIGNALS_CACHE || !factors || factors.length < 2) return;
  try {
    let combos = await env.SIGNALS_CACHE.get(COMBO_KEY, { type: "json" }) || {};
    const factorNames = factors.map((f) => typeof f === "object" ? f.factor || f.name : f).filter(Boolean);
    for (let i = 0; i < factorNames.length; i++) {
      for (let j = i + 1; j < factorNames.length; j++) {
        const combo = [factorNames[i], factorNames[j]].sort().join(" + ");
        if (!combos[combo]) {
          combos[combo] = {
            wins: 0,
            losses: 0,
            winRate: 50,
            factors: [factorNames[i], factorNames[j]].sort(),
            lastUpdated: null
          };
        }
        if (outcome === "WIN") combos[combo].wins++;
        else combos[combo].losses++;
        const total = combos[combo].wins + combos[combo].losses;
        combos[combo].winRate = Math.round(combos[combo].wins / total * 100);
        combos[combo].lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
      }
    }
    const prunedCombos = {};
    for (const [key, stats] of Object.entries(combos)) {
      if (stats.wins + stats.losses >= 2) {
        prunedCombos[key] = stats;
      }
    }
    await env.SIGNALS_CACHE.put(COMBO_KEY, JSON.stringify(prunedCombos), {
      expirationTtl: 90 * 24 * 60 * 60
    });
    return prunedCombos;
  } catch (e) {
    console.error("Error tracking factor combo:", e.message);
    return null;
  }
}
__name(trackFactorCombo, "trackFactorCombo");
async function getFactorCombos(env) {
  if (!env.SIGNALS_CACHE) return { combos: [], bestCombos: [], worstCombos: [] };
  try {
    const combos = await env.SIGNALS_CACHE.get(COMBO_KEY, { type: "json" }) || {};
    const comboArray = Object.entries(combos).map(([name, stats]) => ({ name, ...stats })).filter((c) => c.wins + c.losses >= 3).sort((a, b) => b.winRate - a.winRate);
    return {
      combos: comboArray,
      bestCombos: comboArray.filter((c) => c.winRate >= 60).slice(0, 10),
      worstCombos: comboArray.filter((c) => c.winRate <= 40).slice(-10).reverse(),
      totalTracked: Object.keys(combos).length
    };
  } catch (e) {
    console.error("Error getting factor combos:", e.message);
    return { combos: [], bestCombos: [], worstCombos: [] };
  }
}
__name(getFactorCombos, "getFactorCombos");

// src/polymarket-api.js
var GAMMA_API = "https://gamma-api.polymarket.com";
var CLOB_API = "https://clob.polymarket.com";
var DATA_API = "https://data-api.polymarket.com";
var CACHE_TTL = {
  MARKETS_LIST: 5 * 60,
  // 5 min - market list doesn't change often
  MARKET_PRICES: 60,
  // 1 min - prices update frequently
  MIDPOINT: 30,
  // 30 sec - real-time price
  ORDERBOOK: 30,
  // 30 sec - orderbook
  SPORTS_MARKETS: 5 * 60
  // 5 min - sports market mapping
};
async function getMarkets(env, options = {}) {
  const {
    limit = 100,
    offset = 0,
    closed = false,
    active = true,
    tag_slug = null,
    // e.g., 'sports', 'nba', 'ncaa-cbb'
    slug = null
    // specific market slug
  } = options;
  const cacheKey = `gamma_markets_${tag_slug || "all"}_${limit}_${offset}`;
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: "json" });
      if (cached && Date.now() - cached.timestamp < CACHE_TTL.MARKETS_LIST * 1e3) {
        return { ...cached.data, fromCache: true };
      }
    } catch (e) {
      console.error("Cache read error:", e.message);
    }
  }
  try {
    let url = `${GAMMA_API}/markets?limit=${limit}&offset=${offset}&closed=${closed}&active=${active}`;
    if (tag_slug) url += `&tag_slug=${tag_slug}`;
    if (slug) url += `&slug=${slug}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }
    const markets = await response.json();
    const processed = markets.map((m) => parseMarket(m));
    const result = {
      success: true,
      count: processed.length,
      markets: processed,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (env.SIGNALS_CACHE) {
      await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
        data: result,
        timestamp: Date.now()
      }), { expirationTtl: CACHE_TTL.MARKETS_LIST + 60 });
    }
    return result;
  } catch (e) {
    console.error("Gamma API error:", e.message);
    return { success: false, error: e.message };
  }
}
__name(getMarkets, "getMarkets");
async function getMarketBySlug(env, slug) {
  const cacheKey = `gamma_market_${slug}`;
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: "json" });
      if (cached && Date.now() - cached.timestamp < CACHE_TTL.MARKET_PRICES * 1e3) {
        return { ...cached.data, fromCache: true };
      }
    } catch (e) {
    }
  }
  try {
    const response = await fetch(`${GAMMA_API}/markets?slug=${slug}`);
    if (!response.ok) throw new Error(`Gamma API error: ${response.status}`);
    const markets = await response.json();
    if (!markets || markets.length === 0) {
      return { success: false, error: "Market not found" };
    }
    const market = parseMarket(markets[0]);
    const result = { success: true, market };
    if (env.SIGNALS_CACHE) {
      await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
        data: result,
        timestamp: Date.now()
      }), { expirationTtl: CACHE_TTL.MARKET_PRICES + 60 });
    }
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
}
__name(getMarketBySlug, "getMarketBySlug");
async function getSportsMarkets(env, sport) {
  const seriesIds = await getSportSeriesIds(env, sport);
  if (seriesIds.length === 0) {
    console.log(`No series_ids found for sport: ${sport}`);
    return { success: false, error: `No series_ids for ${sport}`, markets: [] };
  }
  const cacheKey = `sports_events_v3_${sport}_${seriesIds.join("_")}`;
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: "json" });
      if (cached && Date.now() - cached.timestamp < CACHE_TTL.SPORTS_MARKETS * 1e3) {
        return { ...cached.data, fromCache: true };
      }
    } catch (e) {
    }
  }
  try {
    const allGameMarkets = [];
    let totalEvents = 0;
    for (const seriesId of seriesIds) {
      try {
        const response = await fetch(
          `${GAMMA_API}/events?series_id=${seriesId}&tag_id=100639&active=true&closed=false&limit=200&order=startTime&ascending=true`
        );
        if (!response.ok) {
          console.log(`Gamma events API error for series ${seriesId}: ${response.status}`);
          continue;
        }
        const events = await response.json();
        console.log(`Series ${seriesId}: ${events.length} game events for ${sport}`);
        totalEvents += events.length;
        for (const event of events) {
          if (!event.markets || event.markets.length === 0) continue;
          const eventSlug = event.slug;
          let moneylineMarket = null;
          moneylineMarket = event.markets.find((m) => m.slug === eventSlug);
          if (!moneylineMarket) {
            moneylineMarket = event.markets.find((m) => {
              const slug = m.slug || "";
              return /^[a-z]+-[a-z]+-[a-z]+-\d{4}-\d{2}-\d{2}$/.test(slug);
            });
          }
          if (!moneylineMarket) {
            moneylineMarket = event.markets.find((m) => {
              const outcomes = typeof m.outcomes === "string" ? JSON.parse(m.outcomes) : m.outcomes || [];
              if (outcomes.length !== 2) return false;
              const o0 = outcomes[0].toLowerCase();
              const o1 = outcomes[1].toLowerCase();
              return o0 !== "yes" && o0 !== "no" && o0 !== "over" && o0 !== "under" && !m.slug?.includes("-spread") && !m.slug?.includes("-total") && !m.slug?.includes("-assists") && !m.slug?.includes("-points") && !m.slug?.includes("-rebounds") && !m.slug?.includes("-1h-");
            });
          }
          if (moneylineMarket) {
            const parsed = parseMarket(moneylineMarket);
            parsed.eventSlug = event.slug;
            parsed.eventTitle = event.title;
            parsed.eventId = event.id;
            parsed.gameStartTime = event.startDate;
            parsed.totalMarketsInEvent = event.markets.length;
            allGameMarkets.push(parsed);
          }
        }
      } catch (seriesErr) {
        console.error(`Error fetching series ${seriesId}:`, seriesErr.message);
      }
    }
    console.log(`Total: ${allGameMarkets.length} moneyline markets from ${totalEvents} events across ${seriesIds.length} series`);
    const result = {
      success: true,
      sport,
      seriesIds,
      source: "events-api-v3",
      count: allGameMarkets.length,
      eventsCount: totalEvents,
      markets: allGameMarkets,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (env.SIGNALS_CACHE) {
      await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
        data: result,
        timestamp: Date.now()
      }), { expirationTtl: CACHE_TTL.SPORTS_MARKETS + 60 });
    }
    return result;
  } catch (e) {
    console.error(`getSportsMarkets error for ${sport}:`, e.message);
    return { success: false, error: e.message, markets: [] };
  }
}
__name(getSportsMarkets, "getSportsMarkets");
async function getSportSeriesIds(env, sport) {
  const cacheKey = "polymarket_sports_metadata";
  let sportsData = null;
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: "json" });
      if (cached && Date.now() - cached.timestamp < 3600 * 1e3) {
        sportsData = cached.data;
      }
    } catch (e) {
    }
  }
  if (!sportsData) {
    try {
      const response = await fetch(`${GAMMA_API}/sports`);
      if (!response.ok) throw new Error(`Sports API error: ${response.status}`);
      sportsData = await response.json();
      if (env.SIGNALS_CACHE) {
        await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
          data: sportsData,
          timestamp: Date.now()
        }), { expirationTtl: 3600 + 60 });
      }
    } catch (e) {
      console.error("Failed to fetch /sports:", e.message);
      return [];
    }
  }
  const SPORT_SEARCH_KEYS = {
    "nba": ["nba"],
    "nfl": ["nfl"],
    "ncaab": ["ncaab", "cbb"],
    // Both March Madness AND regular season CBB
    "cbb": ["cbb", "ncaab"],
    "ncaaf": ["cfb"],
    "cfb": ["cfb"],
    "nhl": ["nhl"],
    "mlb": ["mlb"],
    "ufc": ["mma"],
    "mma": ["mma"]
  };
  const searchKeys = SPORT_SEARCH_KEYS[sport.toLowerCase()] || [sport.toLowerCase()];
  const sportsList = Array.isArray(sportsData) ? sportsData : Object.values(sportsData);
  const seriesIds = [];
  const seen = /* @__PURE__ */ new Set();
  for (const key of searchKeys) {
    for (const entry of sportsList) {
      const entrySport = (entry.sport || "").toLowerCase();
      const seriesId = entry.series;
      if (entrySport === key && seriesId && !seen.has(seriesId)) {
        seriesIds.push(seriesId);
        seen.add(seriesId);
        console.log(`Found series ${seriesId} for sport ${sport} (matched: ${entrySport})`);
      }
    }
  }
  if (seriesIds.length === 0) {
    console.log(`No series match for sport: ${sport}. Available: ${sportsList.map((s) => s.sport).join(", ")}`);
  }
  return seriesIds;
}
__name(getSportSeriesIds, "getSportSeriesIds");
async function getMidpoint(env, tokenId) {
  const cacheKey = `clob_midpoint_${tokenId}`;
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: "json" });
      if (cached && Date.now() - cached.timestamp < CACHE_TTL.MIDPOINT * 1e3) {
        return { ...cached.data, fromCache: true };
      }
    } catch (e) {
    }
  }
  try {
    const response = await fetch(`${CLOB_API}/midpoint?token_id=${tokenId}`);
    if (!response.ok) throw new Error(`CLOB API error: ${response.status}`);
    const data = await response.json();
    const result = {
      success: true,
      tokenId,
      midpoint: parseFloat(data.mid) || null,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (env.SIGNALS_CACHE && result.midpoint !== null) {
      await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
        data: result,
        timestamp: Date.now()
      }), { expirationTtl: CACHE_TTL.MIDPOINT + 10 });
    }
    return result;
  } catch (e) {
    return { success: false, error: e.message, tokenId };
  }
}
__name(getMidpoint, "getMidpoint");
async function getMidpoints(env, tokenIds) {
  const results = {};
  try {
    const idsParam = tokenIds.join(",");
    const response = await fetch(`${CLOB_API}/midpoints?token_ids=${idsParam}`);
    if (response.ok) {
      const data = await response.json();
      for (const [tokenId, mid] of Object.entries(data)) {
        results[tokenId] = parseFloat(mid) || null;
      }
    }
  } catch (e) {
    console.error("Batch midpoints error:", e.message);
  }
  return results;
}
__name(getMidpoints, "getMidpoints");
async function getPrice(env, tokenId, side = "BUY") {
  try {
    const response = await fetch(`${CLOB_API}/price?token_id=${tokenId}&side=${side}`);
    if (!response.ok) throw new Error(`CLOB API error: ${response.status}`);
    const data = await response.json();
    return {
      success: true,
      tokenId,
      side,
      price: parseFloat(data.price) || null
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
__name(getPrice, "getPrice");
async function getOrderBook(env, tokenId) {
  const cacheKey = `clob_book_${tokenId}`;
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: "json" });
      if (cached && Date.now() - cached.timestamp < CACHE_TTL.ORDERBOOK * 1e3) {
        return { ...cached.data, fromCache: true };
      }
    } catch (e) {
    }
  }
  try {
    const response = await fetch(`${CLOB_API}/book?token_id=${tokenId}`);
    if (!response.ok) throw new Error(`CLOB API error: ${response.status}`);
    const data = await response.json();
    const bestBid = data.bids?.[0]?.price ? parseFloat(data.bids[0].price) : null;
    const bestAsk = data.asks?.[0]?.price ? parseFloat(data.asks[0].price) : null;
    const spread = bestBid && bestAsk ? bestAsk - bestBid : null;
    const midpoint = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : null;
    const bidLiquidity = data.bids?.slice(0, 5).reduce((sum, b) => sum + parseFloat(b.size || 0), 0) || 0;
    const askLiquidity = data.asks?.slice(0, 5).reduce((sum, a) => sum + parseFloat(a.size || 0), 0) || 0;
    const result = {
      success: true,
      tokenId,
      bestBid,
      bestAsk,
      spread,
      midpoint,
      bidLiquidity: Math.round(bidLiquidity),
      askLiquidity: Math.round(askLiquidity),
      bids: data.bids?.slice(0, 10) || [],
      asks: data.asks?.slice(0, 10) || [],
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (env.SIGNALS_CACHE) {
      await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
        data: result,
        timestamp: Date.now()
      }), { expirationTtl: CACHE_TTL.ORDERBOOK + 10 });
    }
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
}
__name(getOrderBook, "getOrderBook");
async function getLastTradePrice(env, tokenId) {
  try {
    const response = await fetch(`${CLOB_API}/last-trade-price?token_id=${tokenId}`);
    if (!response.ok) throw new Error(`CLOB API error: ${response.status}`);
    const data = await response.json();
    return {
      success: true,
      tokenId,
      lastPrice: parseFloat(data.price) || null
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
__name(getLastTradePrice, "getLastTradePrice");
async function getSportsMarketsWithPrices(env, sport) {
  const sportsResult = await getSportsMarkets(env, sport);
  if (!sportsResult.success) {
    return sportsResult;
  }
  const marketsWithPrices = sportsResult.markets.map((market) => {
    const prices = market.outcomePrices || [];
    return {
      slug: market.slug,
      eventSlug: market.eventSlug,
      eventTitle: market.eventTitle,
      question: market.question,
      outcomes: market.outcomes,
      outcomePrices: prices,
      // Real-time prices from Gamma!
      yesPrice: prices[0] !== void 0 && prices[0] !== null ? Math.round(prices[0] * 100) : null,
      noPrice: prices[1] !== void 0 && prices[1] !== null ? Math.round(prices[1] * 100) : null,
      volume: market.volume,
      liquidity: market.liquidity,
      endDate: market.endDate,
      gameStartTime: market.gameStartTime,
      clobTokenIds: market.clobTokenIds,
      // For orderbook lookups
      active: market.active,
      closed: market.closed
    };
  });
  return {
    ...sportsResult,
    markets: marketsWithPrices
  };
}
__name(getSportsMarketsWithPrices, "getSportsMarketsWithPrices");
async function getRecentTrades(env, options = {}) {
  const { limit = 1e3, market = null } = options;
  try {
    let url = `${DATA_API}/trades?limit=${limit}`;
    if (market) url += `&market=${market}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Data API error: ${response.status}`);
    const trades = await response.json();
    return {
      success: true,
      count: trades.length,
      trades
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
__name(getRecentTrades, "getRecentTrades");
function parseMarket(market) {
  let outcomePrices = [];
  if (market.outcomePrices) {
    try {
      outcomePrices = typeof market.outcomePrices === "string" ? JSON.parse(market.outcomePrices) : market.outcomePrices;
      outcomePrices = outcomePrices.map((p) => parseFloat(p));
    } catch (e) {
      console.error("Error parsing outcomePrices:", e.message);
    }
  }
  let outcomes = [];
  if (market.outcomes) {
    try {
      outcomes = typeof market.outcomes === "string" ? JSON.parse(market.outcomes) : market.outcomes;
    } catch (e) {
      console.error("Error parsing outcomes:", e.message);
    }
  }
  let clobTokenIds = [];
  if (market.clobTokenIds) {
    try {
      clobTokenIds = typeof market.clobTokenIds === "string" ? JSON.parse(market.clobTokenIds) : market.clobTokenIds;
    } catch (e) {
    }
  }
  return {
    id: market.id,
    conditionId: market.conditionId,
    slug: market.slug,
    question: market.question,
    description: market.description,
    outcomes,
    outcomePrices,
    clobTokenIds,
    volume: parseFloat(market.volume) || 0,
    volumeNum: market.volumeNum || 0,
    liquidity: parseFloat(market.liquidity) || 0,
    liquidityNum: market.liquidityNum || 0,
    active: market.active,
    closed: market.closed,
    archived: market.archived,
    endDate: market.endDate,
    gameStartTime: market.gameStartTime,
    category: market.category,
    marketType: market.marketType,
    image: market.image,
    icon: market.icon
  };
}
__name(parseMarket, "parseMarket");
async function getEventTimingBySlug(env, slug) {
  if (!slug) return null;
  const timingCacheKey = `event_timing_${slug}`;
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(timingCacheKey, { type: "json" });
      if (cached) return cached;
    } catch (e) {
    }
  }
  const dateMatch = slug.match(/(\d{4})-(\d{2})-(\d{2})/);
  let timing = null;
  try {
    const response = await fetch(`${GAMMA_API}/events?slug=${slug}&limit=1`);
    if (response.ok) {
      const events = await response.json();
      if (events && events.length > 0) {
        const event = events[0];
        timing = {
          eventStartTime: event.startDate || null,
          eventEndTime: event.endDate || null,
          source: "gamma-event"
        };
      }
    }
  } catch (e) {
  }
  if (!timing) {
    try {
      const response = await fetch(`${GAMMA_API}/markets?slug=${slug}&limit=1`);
      if (response.ok) {
        const markets = await response.json();
        if (markets && markets.length > 0) {
          const market = markets[0];
          timing = {
            eventStartTime: null,
            eventEndTime: market.endDate || null,
            source: "gamma-market"
          };
        }
      }
    } catch (e) {
    }
  }
  if (!timing && dateMatch) {
    const eventDate = new Date(
      parseInt(dateMatch[1]),
      parseInt(dateMatch[2]) - 1,
      parseInt(dateMatch[3])
    );
    const slugLower = slug.toLowerCase();
    let estimatedHour = 0;
    if (slugLower.startsWith("nba-") || slugLower.startsWith("nhl-")) {
      estimatedHour = 0;
    } else if (slugLower.startsWith("nfl-")) {
      estimatedHour = 18;
    } else if (slugLower.startsWith("cbb-") || slugLower.startsWith("ncaab-")) {
      estimatedHour = 23;
    }
    eventDate.setUTCHours(estimatedHour, 0, 0, 0);
    const eventEndDate = new Date(eventDate.getTime() + 3 * 60 * 60 * 1e3);
    timing = {
      eventStartTime: eventDate.toISOString(),
      eventEndTime: eventEndDate.toISOString(),
      source: "slug-estimate"
    };
  }
  if (!timing) return null;
  const startTime = timing.eventStartTime ? new Date(timing.eventStartTime).getTime() : null;
  const endTime = timing.eventEndTime ? new Date(timing.eventEndTime).getTime() : null;
  const now = Date.now();
  timing.hoursUntilEvent = startTime ? Math.round((startTime - now) / (1e3 * 60 * 60) * 10) / 10 : null;
  timing.hoursUntilEnd = endTime ? Math.round((endTime - now) / (1e3 * 60 * 60) * 10) / 10 : null;
  timing.eventStatus = startTime ? now < startTime ? "upcoming" : endTime && now < endTime ? "live" : "ended" : "unknown";
  if (env.SIGNALS_CACHE) {
    try {
      await env.SIGNALS_CACHE.put(timingCacheKey, JSON.stringify(timing), {
        expirationTtl: 10 * 60
      });
    } catch (e) {
    }
  }
  return timing;
}
__name(getEventTimingBySlug, "getEventTimingBySlug");
async function batchGetEventTiming(env, slugs) {
  const timingMap = /* @__PURE__ */ new Map();
  const maxLookups = 20;
  const lookupSlugs = slugs.slice(0, maxLookups);
  const results = await Promise.allSettled(
    lookupSlugs.map((slug) => getEventTimingBySlug(env, slug))
  );
  results.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value) {
      timingMap.set(lookupSlugs[i], result.value);
    }
  });
  return timingMap;
}
__name(batchGetEventTiming, "batchGetEventTiming");

// src/signals.js
var CONFIG = {
  SCAN_CACHE_TTL: 2 * 60,
  // 2 minutes cache
  TRADE_LIMIT: 1500,
  // API fetch limit
  MAX_TRADES_PER_MARKET: 10,
  // Memory optimization
  SPORTS_SIGNAL_LIMIT: 15,
  // Top 15 sports props
  MIN_WALLET_WIN_RATE: 55,
  // Only track wallets above 55% win rate
  MIN_WALLET_BETS: 3
  // Minimum bets before tracking
};
var FADE_FACTORS = ["sports-mma"];
async function calculateAIScore(env, baseScore, scoreBreakdown, marketType, hasWinningWallet) {
  if (!env.SIGNALS_CACHE) return { aiScore: baseScore, multiplier: 1, shouldHide: false };
  try {
    const factorStats = await env.SIGNALS_CACHE.get("factor_stats_v2", { type: "json" }) || {};
    let multiplier = 1;
    let shouldHide = false;
    let boostReasons = [];
    let penaltyReasons = [];
    const factors = scoreBreakdown?.map((f) => f.factor) || [];
    if (marketType) factors.push(marketType);
    if (hasWinningWallet) factors.push("winningWallet");
    for (const factor of factors) {
      const stats = factorStats[factor];
      if (!stats || stats.wins + stats.losses < 5) continue;
      const winRate = stats.winRate;
      const sampleSize = stats.wins + stats.losses;
      const confidenceFactor = Math.min(1, sampleSize / 20);
      if (winRate >= 70) {
        const boost = 1 + 0.3 * confidenceFactor;
        multiplier *= boost;
        boostReasons.push(`${factor}(${winRate}%)`);
      } else if (winRate >= 55) {
        multiplier *= 1 + 0.1 * confidenceFactor;
      } else if (winRate <= 15) {
        multiplier *= 0.4 * confidenceFactor + (1 - confidenceFactor);
        penaltyReasons.push(`${factor}(${winRate}%)`);
        if (FADE_FACTORS.includes(factor)) {
          shouldHide = true;
        }
      } else if (winRate <= 25) {
        multiplier *= 0.6 * confidenceFactor + (1 - confidenceFactor);
        penaltyReasons.push(`${factor}(${winRate}%)`);
      } else if (winRate <= 35) {
        multiplier *= 0.8 * confidenceFactor + (1 - confidenceFactor);
      }
    }
    multiplier = Math.max(0.3, Math.min(2, multiplier));
    if (hasWinningWallet) {
      shouldHide = false;
      multiplier = Math.max(multiplier, 1);
    }
    const aiScore = Math.round(baseScore * multiplier);
    return {
      aiScore,
      multiplier: Math.round(multiplier * 100) / 100,
      shouldHide,
      boostReasons,
      penaltyReasons
    };
  } catch (e) {
    console.error("Error calculating AI score:", e.message);
    return { aiScore: baseScore, multiplier: 1, shouldHide: false };
  }
}
__name(calculateAIScore, "calculateAIScore");
async function getCachedScanResult(env, cacheKey) {
  if (!env.SIGNALS_CACHE) return null;
  try {
    const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: "json" });
    if (cached && cached.timestamp) {
      const age = Date.now() - cached.timestamp;
      if (age < CONFIG.SCAN_CACHE_TTL * 1e3) {
        return { ...cached.data, fromCache: true, cacheAge: Math.round(age / 1e3) };
      }
    }
  } catch (e) {
  }
  return null;
}
__name(getCachedScanResult, "getCachedScanResult");
async function cacheScanResult(env, cacheKey, data) {
  if (!env.SIGNALS_CACHE) return;
  try {
    await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }), { expirationTtl: CONFIG.SCAN_CACHE_TTL + 60 });
  } catch (e) {
  }
}
__name(cacheScanResult, "cacheScanResult");
var GAMBLING_KEYWORDS = [
  "up or down",
  "bitcoin up or down",
  "ethereum up or down",
  "15m",
  "30m",
  "1h",
  "5m",
  "next 15 minutes",
  "next 30 minutes"
];
function isGamblingMarket(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  return GAMBLING_KEYWORDS.some((kw) => lower.includes(kw));
}
__name(isGamblingMarket, "isGamblingMarket");
function extractWallet(trade) {
  const wallet = trade.proxyWallet || trade.user || trade.maker || trade.taker;
  return wallet && typeof wallet === "string" && wallet.length > 10 ? wallet : null;
}
__name(extractWallet, "extractWallet");
function isNoBetOutcome(outcome) {
  if (!outcome) return false;
  const lower = String(outcome).toLowerCase();
  return lower === "no" || lower === "false" || lower === "0";
}
__name(isNoBetOutcome, "isNoBetOutcome");
async function getWinningWallets(env) {
  if (!env.SIGNALS_CACHE) return /* @__PURE__ */ new Map();
  try {
    const cached = await env.SIGNALS_CACHE.get("winning_wallets_cache", { type: "json" });
    if (cached && cached.timestamp && Date.now() - cached.timestamp < 5 * 60 * 1e3) {
      return new Map(Object.entries(cached.wallets || {}));
    }
  } catch (e) {
  }
  return /* @__PURE__ */ new Map();
}
__name(getWinningWallets, "getWinningWallets");
async function isWinningWallet(env, address, winningWalletsCache) {
  if (!address) return { isWinner: false };
  if (winningWalletsCache.has(address.toLowerCase())) {
    return winningWalletsCache.get(address.toLowerCase());
  }
  if (!env.SIGNALS_CACHE) return { isWinner: false };
  try {
    const walletKey = KV_KEYS.WALLETS_PREFIX + address.toLowerCase();
    const stats = await env.SIGNALS_CACHE.get(walletKey, { type: "json" });
    if (stats && stats.totalBets >= CONFIG.MIN_WALLET_BETS) {
      const winRate = stats.winRate || (stats.totalBets > 0 ? stats.wins / stats.totalBets * 100 : 0);
      if (winRate >= CONFIG.MIN_WALLET_WIN_RATE) {
        return {
          isWinner: true,
          winRate: Math.round(winRate),
          record: `${stats.wins}W-${stats.losses}L`,
          tier: stats.tier || "WINNER",
          totalBets: stats.totalBets
        };
      }
    }
  } catch (e) {
  }
  return { isWinner: false };
}
__name(isWinningWallet, "isWinningWallet");
async function storeSignalForSettlement(env, signal) {
  if (!env.SIGNALS_CACHE || !signal.id) return false;
  try {
    const signalKey = KV_KEYS.SIGNALS_PREFIX + signal.id;
    const signalData = {
      id: signal.id,
      marketSlug: signal.marketSlug,
      marketTitle: signal.marketTitle,
      direction: signal.direction,
      priceAtSignal: signal.displayPrice,
      score: signal.score,
      confidence: signal.confidence,
      detectedAt: (/* @__PURE__ */ new Date()).toISOString(),
      marketType: signal.marketType,
      totalVolume: signal.suspiciousVolume,
      largestBet: signal.largestBet,
      scoreBreakdown: signal.scoreBreakdown || [],
      wallets: signal.topTrades?.map((t) => t.wallet).filter(Boolean) || [],
      hasWinningWallet: signal.hasWinningWallet || false,
      // FIX #3: Track actual bet count (trade count that contributed to this signal)
      betCount: signal.tradeCount || signal.topTrades?.length || 0,
      uniqueWallets: signal.uniqueWallets || 0,
      // FIX #5: Store timing metadata for learning
      firstTradeTime: signal.firstTradeTime || null,
      lastTradeTime: signal.lastTradeTime || null,
      // Event timing: prevents premature settlement + keeps signals visible until event ends
      eventStartTime: signal.eventStartTime || null,
      eventEndTime: signal.eventEndTime || null,
      hoursUntilEvent: signal.hoursUntilEvent || null,
      outcome: null,
      settledAt: null
    };
    await env.SIGNALS_CACHE.put(signalKey, JSON.stringify(signalData), {
      expirationTtl: 7 * 24 * 60 * 60
    });
    let pendingSignals = await env.SIGNALS_CACHE.get(KV_KEYS.PENDING_SIGNALS, { type: "json" }) || [];
    if (!pendingSignals.includes(signal.id)) {
      pendingSignals.push(signal.id);
      if (pendingSignals.length > 300) pendingSignals = pendingSignals.slice(-300);
      await env.SIGNALS_CACHE.put(KV_KEYS.PENDING_SIGNALS, JSON.stringify(pendingSignals), {
        expirationTtl: 30 * 24 * 60 * 60
      });
    }
    return true;
  } catch (e) {
    return false;
  }
}
__name(storeSignalForSettlement, "storeSignalForSettlement");
async function trackWalletIfWorthy(env, wallet, tradeData, signal) {
  if (!env.SIGNALS_CACHE || !wallet) return false;
  const isWorthy = tradeData.amount >= 5e3 || signal.score >= 60 || signal.hasWinningWallet;
  if (isWorthy) {
    try {
      await trackWalletBet(env, wallet, {
        signalId: signal.id,
        market: signal.marketSlug,
        marketTitle: signal.marketTitle,
        // ADD THE READABLE TITLE
        direction: signal.direction,
        amount: tradeData.amount,
        price: tradeData.price
      });
      return true;
    } catch (e) {
    }
  }
  return false;
}
__name(trackWalletIfWorthy, "trackWalletIfWorthy");
async function runScan(hours, minScore, env, options = {}) {
  const startTime = Date.now();
  const { sportsOnly = false, includeDebug = false } = options;
  const cacheKey = `scan_result_${hours}_${minScore}_${sportsOnly ? "sports" : "all"}`;
  const cached = await getCachedScanResult(env, cacheKey);
  if (cached) {
    console.log(`Returning cached scan (age: ${cached.cacheAge}s)`);
    return cached;
  }
  try {
    const winningWallets = await getWinningWallets(env);
    console.log(`Loaded ${winningWallets.size} winning wallets from cache`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8e3);
    let allTrades = [];
    try {
      const tradesRes = await fetch(`${POLYMARKET_API}/trades?limit=${CONFIG.TRADE_LIMIT}`, {
        signal: controller.signal
      });
      if (tradesRes.ok) {
        allTrades = await tradesRes.json();
        console.log(`Fetched ${allTrades.length} trades from API`);
      }
    } catch (e) {
      return { success: true, signals: [], totalSignals: 0, message: "Trade fetch failed", processingTime: Date.now() - startTime };
    } finally {
      clearTimeout(timeout);
    }
    if (!allTrades || allTrades.length === 0) {
      return { success: true, signals: [], totalSignals: 0, message: "No trades", processingTime: Date.now() - startTime };
    }
    if (allTrades.length > 0) {
      console.log("Sample trade structure:", JSON.stringify(allTrades[0]).slice(0, 500));
    }
    const cutoffTime = Date.now() - hours * 60 * 60 * 1e3;
    let debugStats = {
      total: allTrades.length,
      noTitle: 0,
      gambling: 0,
      noTimestamp: 0,
      oldTrade: 0,
      badPrice: 0,
      tooSmall: 0,
      noSlug: 0,
      passed: 0
    };
    const marketMap = /* @__PURE__ */ new Map();
    for (const t of allTrades) {
      const marketTitle = t.title || t.market || t.question || "";
      if (!marketTitle) {
        debugStats.noTitle++;
      }
      if (isGamblingMarket(marketTitle)) {
        debugStats.gambling++;
        continue;
      }
      let tradeTime = t.timestamp || t.createdAt || t.matchTime;
      if (typeof tradeTime === "string") tradeTime = new Date(tradeTime).getTime();
      if (tradeTime && tradeTime < 1e10) tradeTime = tradeTime * 1e3;
      if (!tradeTime) {
        debugStats.noTimestamp++;
        continue;
      }
      if (tradeTime < cutoffTime) {
        debugStats.oldTrade++;
        continue;
      }
      const price = parseFloat(t.price) || 0;
      if (price >= 0.95 || price <= 0.05) {
        debugStats.badPrice++;
        continue;
      }
      let usdValue = parseFloat(t.usd_value) || parseFloat(t.usdcSize) || parseFloat(t.size) || parseFloat(t.amount) || 0;
      if (usdValue < 10) {
        debugStats.tooSmall++;
        continue;
      }
      const slug = t.slug || t.eventSlug || t.market_slug || t.conditionId || "";
      if (sportsOnly && !isSportsGame(slug) && !isSportsGame(marketTitle)) continue;
      const marketKey = slug || marketTitle;
      if (!marketKey) {
        debugStats.noSlug++;
        continue;
      }
      debugStats.passed++;
      if (!marketMap.has(marketKey)) {
        marketMap.set(marketKey, {
          slug: marketKey,
          eventSlug: t.eventSlug,
          title: t.title,
          icon: t.icon,
          trades: [],
          wallets: /* @__PURE__ */ new Set(),
          totalVolume: 0,
          largestBet: 0,
          largestBetOutcome: null,
          firstTradeTime: tradeTime,
          lastTradeTime: tradeTime,
          yesVolume: 0,
          noVolume: 0,
          outcomeVolumes: {}
          // Track volume per outcome name (e.g., {"Panthers": 9003, "Bruins": 441})
        });
      }
      const market = marketMap.get(marketKey);
      if (market.trades.length < CONFIG.MAX_TRADES_PER_MARKET) {
        market.trades.push({
          _usdValue: usdValue,
          _tradeTime: tradeTime,
          price: t.price,
          outcome: t.outcome,
          outcomeIndex: t.outcomeIndex,
          // 0 = Yes/Team1, 1 = No/Team2
          side: t.side,
          // BUY or SELL
          proxyWallet: t.proxyWallet
        });
      }
      market.totalVolume += usdValue;
      if (usdValue > market.largestBet) {
        market.largestBet = usdValue;
        market.largestBetOutcome = t.outcome || null;
      }
      market.firstTradeTime = Math.min(market.firstTradeTime, tradeTime);
      market.lastTradeTime = Math.max(market.lastTradeTime, tradeTime);
      const wallet = extractWallet(t);
      if (wallet) market.wallets.add(wallet);
      const outcomeName = t.outcome ? String(t.outcome) : "";
      const outcomeLower = outcomeName.toLowerCase();
      const isYesNo = outcomeLower === "yes" || outcomeLower === "no" || outcomeLower === "true" || outcomeLower === "false";
      if (isYesNo) {
        const titleStr = market.title || t.title || "";
        const vsMatch = titleStr.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
        if (vsMatch) {
          const team1 = vsMatch[1].trim();
          const team2 = vsMatch[2].trim();
          const isTeam1 = outcomeLower === "yes" || outcomeLower === "true";
          const teamName = isTeam1 ? team1 : team2;
          market.outcomeVolumes[teamName] = (market.outcomeVolumes[teamName] || 0) + usdValue;
        }
        const isNo = t.outcomeIndex === 1 || outcomeLower === "no" || outcomeLower === "false";
        if (isNo) {
          market.noVolume += usdValue;
        } else {
          market.yesVolume += usdValue;
        }
      } else {
        market.outcomeVolumes[outcomeName] = (market.outcomeVolumes[outcomeName] || 0) + usdValue;
        if (isNoBetOutcome(t.outcome)) {
          market.noVolume += usdValue;
        } else {
          market.yesVolume += usdValue;
        }
      }
    }
    console.log(`Grouped into ${marketMap.size} markets`);
    const allSignals = [];
    const sportsSignals = [];
    let signalsStored = 0;
    let walletsTracked = 0;
    for (const [slug, market] of marketMap) {
      const score = calculateSignalScore(market);
      if (score < minScore) continue;
      market.trades.sort((a, b) => b._usdValue - a._usdValue);
      let hasWinningWallet = false;
      let winningWalletInfo = null;
      const topTrades = [];
      for (const t of market.trades.slice(0, 5)) {
        const wallet = extractWallet(t);
        const walletCheck = await isWinningWallet(env, wallet, winningWallets);
        if (walletCheck.isWinner) {
          hasWinningWallet = true;
          winningWalletInfo = { wallet, ...walletCheck };
        }
        topTrades.push({
          wallet,
          amount: Math.round(t._usdValue),
          price: t.price,
          time: new Date(t._tradeTime).toISOString(),
          outcome: t.outcome,
          outcomeIndex: t.outcomeIndex,
          // 0=Yes/Team1, 1=No/Team2
          side: t.side,
          // BUY or SELL
          isWinner: walletCheck.isWinner,
          winnerInfo: walletCheck.isWinner ? walletCheck : null
        });
      }
      const direction = market.yesVolume > market.noVolume ? "YES" : "NO";
      const directionPercent = Math.round(Math.max(market.yesVolume, market.noVolume) / market.totalVolume * 100);
      const outcomeNames = Object.keys(market.outcomeVolumes);
      let dominantOutcome = null;
      let dominantOutcomeVolume = 0;
      for (const [name, vol] of Object.entries(market.outcomeVolumes)) {
        if (vol > dominantOutcomeVolume) {
          dominantOutcome = name;
          dominantOutcomeVolume = vol;
        }
      }
      const rawPrice = market.trades[0] ? parseFloat(market.trades[0].price) : null;
      let displayPrice = null;
      if (rawPrice !== null) {
        displayPrice = Math.round(rawPrice * 100);
      }
      const biggestTradeOutcome = market.trades[0]?.outcome || null;
      console.log(`Signal ${slug}: dominantOutcome=${dominantOutcome} (${dominantOutcomeVolume}), biggestTradeOutcome=${biggestTradeOutcome}, displayPrice=${displayPrice}, outcomeVolumes=${JSON.stringify(market.outcomeVolumes)}`);
      const marketType = detectMarketType(market.title || slug, slug);
      const scoreBreakdown = getScoreBreakdown(market, displayPrice, hasWinningWallet);
      const aiResult = await calculateAIScore(env, score, scoreBreakdown, marketType, hasWinningWallet);
      if (aiResult.shouldHide) {
        console.log(`Hiding signal ${slug}: dominated by weak factors (${aiResult.penaltyReasons.join(", ")})`);
        continue;
      }
      const aiScore = aiResult.aiScore;
      let confidence = Math.round(50 + aiScore / 100 * 25);
      if (hasWinningWallet && winningWalletInfo) {
        const walletBoost = Math.min(15, Math.round((winningWalletInfo.winRate - 50) / 3));
        confidence += walletBoost;
      }
      try {
        if (typeof calculateConfidence === "function" && env.SIGNALS_CACHE) {
          const factorNames = [...scoreBreakdown.map((f) => f.factor), marketType];
          if (hasWinningWallet) factorNames.push("winningWallet");
          const confResult = await calculateConfidence(env, factorNames, {
            marketType,
            totalVolume: market.totalVolume,
            detectedAt: new Date(market.firstTradeTime).toISOString()
          });
          if (confResult && typeof confResult.confidence === "number" && confResult.dataPoints >= 1) {
            confidence = Math.round(confResult.confidence * 0.6 + confidence * 0.4);
          }
        }
      } catch (e) {
      }
      confidence = Math.max(40, Math.min(95, Math.round(confidence)));
      const signal = {
        id: generateId(),
        marketSlug: slug,
        eventSlug: market.eventSlug || slug,
        // Parent event slug for correct Polymarket URLs
        marketTitle: market.title || slug,
        icon: market.icon,
        score,
        // Original raw score
        aiScore,
        // AI-adjusted score (NEW!)
        aiMultiplier: aiResult.multiplier,
        // Show the multiplier (NEW!)
        confidence,
        direction,
        directionPercent,
        displayPrice,
        suspiciousVolume: Math.round(market.totalVolume),
        largestBet: Math.round(market.largestBet),
        uniqueWallets: market.wallets.size,
        tradeCount: market.trades.length,
        firstTradeTime: new Date(market.firstTradeTime).toISOString(),
        lastTradeTime: new Date(market.lastTradeTime).toISOString(),
        topTrades,
        hasWinningWallet,
        winningWalletInfo,
        marketType,
        scoreBreakdown,
        // Priority flag for sports
        isSportsSignal: marketType.startsWith("sports-"),
        // FIX: Accurate bet summary for vs-format markets
        // Use the ACTUAL outcome from trades, not the YES/NO direction guess
        // Polymarket sports trades have outcome = team name (e.g., "Panthers")
        betSummary: (() => {
          const title = market.title || slug;
          const vsMatch = title.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
          if (vsMatch) {
            const team1 = vsMatch[1].trim();
            const team2 = vsMatch[2].trim();
            let whaleTeam = null;
            if (dominantOutcome) {
              const domLower = dominantOutcome.toLowerCase();
              const t1Lower = team1.toLowerCase();
              const t2Lower = team2.toLowerCase();
              if (domLower === t1Lower || t1Lower.includes(domLower) || domLower.includes(t1Lower)) {
                whaleTeam = team1;
              } else if (domLower === t2Lower || t2Lower.includes(domLower) || domLower.includes(t2Lower)) {
                whaleTeam = team2;
              }
            }
            if (!whaleTeam && market.trades[0]) {
              const bigTrade = market.trades[0];
              const outLower = (bigTrade.outcome || "").toLowerCase();
              if (bigTrade.outcomeIndex === 0 || outLower === "yes" || outLower === "true") {
                whaleTeam = team1;
              } else if (bigTrade.outcomeIndex === 1 || outLower === "no" || outLower === "false") {
                whaleTeam = team2;
              } else {
                const t1Lower = team1.toLowerCase();
                const t2Lower = team2.toLowerCase();
                if (t1Lower.includes(outLower) || outLower.includes(t1Lower)) {
                  whaleTeam = team1;
                } else if (t2Lower.includes(outLower) || outLower.includes(t2Lower)) {
                  whaleTeam = team2;
                }
              }
            }
            if (!whaleTeam) {
              whaleTeam = market.yesVolume >= market.noVolume ? team1 : team2;
            }
            const entryPct = displayPrice ? `${displayPrice}%` : "";
            console.log(`betSummary: title="${title}" whaleTeam="${whaleTeam}" dominantOutcome="${dominantOutcome}" biggestTrade=${biggestTradeOutcome}(idx:${market.trades[0]?.outcomeIndex}) displayPrice=${displayPrice}`);
            return `${whaleTeam} @ ${entryPct}`;
          }
          return null;
        })(),
        // NEW: Send team names separately for frontend flexibility
        teamInfo: (() => {
          const title = market.title || slug;
          const vsMatch = title.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
          if (vsMatch) {
            const team1 = vsMatch[1].trim();
            const team2 = vsMatch[2].trim();
            let whaleTeam = team1;
            if (dominantOutcome) {
              const domLower = dominantOutcome.toLowerCase();
              const t2Lower = team2.toLowerCase();
              if (domLower === t2Lower || t2Lower.includes(domLower) || domLower.includes(t2Lower)) {
                whaleTeam = team2;
              }
            } else if (market.trades[0]) {
              const bigTrade = market.trades[0];
              const outLower = (bigTrade.outcome || "").toLowerCase();
              if (bigTrade.outcomeIndex === 1 || outLower === "no" || outLower === "false") {
                whaleTeam = team2;
              }
            }
            return {
              team1,
              team2,
              yesTeam: team1,
              noTeam: team2,
              whaleTeam,
              whaleOutcome: dominantOutcome || biggestTradeOutcome || null,
              whalePrice: displayPrice,
              yesPct: displayPrice,
              noPct: displayPrice ? 100 - displayPrice : null
            };
          }
          return null;
        })()
      };
      allSignals.push(signal);
      if (signal.isSportsSignal) {
        sportsSignals.push(signal);
      }
      try {
        if (await storeSignalForSettlement(env, signal)) signalsStored++;
      } catch (e) {
      }
      for (const trade of topTrades.slice(0, 3)) {
        if (trade.wallet) {
          try {
            if (await trackWalletIfWorthy(env, trade.wallet, trade, signal)) walletsTracked++;
          } catch (e) {
          }
        }
      }
    }
    marketMap.clear();
    try {
      const slugsToLookup = allSignals.map((s) => s.marketSlug).filter(Boolean);
      if (slugsToLookup.length > 0) {
        const timingMap = await batchGetEventTiming(env, slugsToLookup);
        let enriched = 0;
        for (const signal of allSignals) {
          const timing = timingMap.get(signal.marketSlug);
          if (timing) {
            signal.eventStartTime = timing.eventStartTime;
            signal.eventEndTime = timing.eventEndTime;
            signal.hoursUntilEvent = timing.hoursUntilEvent;
            signal.hoursUntilEnd = timing.hoursUntilEnd;
            signal.eventStatus = timing.eventStatus;
            signal.eventTimingSource = timing.source;
            enriched++;
          }
        }
        console.log(`Enriched ${enriched}/${allSignals.length} signals with event timing`);
      }
    } catch (e) {
      console.error("Event timing enrichment error:", e.message);
    }
    allSignals.sort((a, b) => {
      if (a.hasWinningWallet && !b.hasWinningWallet) return -1;
      if (!a.hasWinningWallet && b.hasWinningWallet) return 1;
      return b.score - a.score;
    });
    sportsSignals.sort((a, b) => {
      if (a.hasWinningWallet && !b.hasWinningWallet) return -1;
      if (!a.hasWinningWallet && b.hasWinningWallet) return 1;
      return b.score - a.score;
    });
    const result = {
      success: true,
      signals: allSignals,
      sportsSignals: sportsSignals.slice(0, CONFIG.SPORTS_SIGNAL_LIMIT),
      totalSignals: allSignals.length,
      sportsSignalCount: sportsSignals.length,
      signalsWithWinners: allSignals.filter((s) => s.hasWinningWallet).length,
      tradesProcessed: allTrades.length,
      tradesSource: "api",
      signalsStored,
      walletsTracked,
      winningWalletsInCache: winningWallets.size,
      processingTime: Date.now() - startTime,
      marketsFound: marketMap.size,
      debug: includeDebug ? debugStats : void 0
    };
    await cacheScanResult(env, cacheKey, result);
    return result;
  } catch (e) {
    console.error("Scan error:", e);
    return { success: false, error: e.message, processingTime: Date.now() - startTime };
  }
}
__name(runScan, "runScan");
function calculateSignalScore(market) {
  let score = 0;
  if (market.largestBet >= 1e5) score += 80;
  else if (market.largestBet >= 5e4) score += 60;
  else if (market.largestBet >= 25e3) score += 45;
  else if (market.largestBet >= 1e4) score += 30;
  else if (market.largestBet >= 5e3) score += 15;
  const walletCount = market.wallets.size;
  if (walletCount === 1 && market.totalVolume >= 1e4) score += 25;
  else if (walletCount <= 2 && market.totalVolume >= 2e4) score += 15;
  else if (walletCount <= 5 && market.totalVolume >= 3e4) score += 10;
  if (market.totalVolume >= 5e5) score += 25;
  else if (market.totalVolume >= 1e5) score += 15;
  else if (market.totalVolume >= 5e4) score += 8;
  const dominantPercent = Math.max(market.yesVolume, market.noVolume) / market.totalVolume;
  if (dominantPercent >= 0.9) score += 15;
  else if (dominantPercent >= 0.8) score += 10;
  return Math.min(100, Math.round(score));
}
__name(calculateSignalScore, "calculateSignalScore");
function getScoreBreakdown(market, displayPrice = 50, hasWinningWallet = false) {
  const breakdown = [];
  if (market.largestBet >= 1e5) breakdown.push({ factor: "whaleSize100k", points: 80 });
  else if (market.largestBet >= 5e4) breakdown.push({ factor: "whaleSize50k", points: 60 });
  else if (market.largestBet >= 25e3) breakdown.push({ factor: "whaleSize25k", points: 45 });
  else if (market.largestBet >= 15e3) breakdown.push({ factor: "whaleSize15k", points: 30 });
  else if (market.largestBet >= 8e3) breakdown.push({ factor: "whaleSize8k", points: 20 });
  else if (market.largestBet >= 5e3) breakdown.push({ factor: "whaleSize5k", points: 15 });
  else if (market.largestBet >= 3e3) breakdown.push({ factor: "whaleSize3k", points: 10 });
  const walletCount = market.wallets.size;
  if (walletCount === 1 && market.totalVolume >= 1e4) breakdown.push({ factor: "concentrated", points: 25 });
  else if (walletCount <= 2 && market.totalVolume >= 2e4) breakdown.push({ factor: "concentrated", points: 15 });
  if (market.totalVolume >= 5e5) breakdown.push({ factor: "volumeHuge", points: 25 });
  else if (market.totalVolume >= 1e5) breakdown.push({ factor: "vol_100k_plus", points: 20 });
  else if (market.totalVolume >= 5e4) breakdown.push({ factor: "vol_50k_100k", points: 15 });
  else if (market.totalVolume >= 25e3) breakdown.push({ factor: "vol_25k_50k", points: 12 });
  else if (market.totalVolume >= 1e4) breakdown.push({ factor: "vol_10k_25k", points: 10 });
  else breakdown.push({ factor: "vol_under_10k", points: 5 });
  const price = displayPrice || 50;
  const direction = market.yesVolume > market.noVolume ? "YES" : "NO";
  const effectivePrice = direction === "YES" ? price : 100 - price;
  if (effectivePrice <= 15) {
    breakdown.push({ factor: "buyDeepLongshot", points: 35, desc: "Buying at <15% (deep longshot)" });
  } else if (effectivePrice <= 25) {
    breakdown.push({ factor: "buyLongshot", points: 20, desc: "Buying at 15-25% (longshot)" });
  } else if (effectivePrice <= 40) {
    breakdown.push({ factor: "buyUnderdog", points: 10, desc: "Buying at 25-40% (underdog)" });
  } else if (effectivePrice >= 85) {
    breakdown.push({ factor: "buyHeavyFavorite", points: 10, desc: "Buying at 85%+ (heavy favorite)" });
  } else if (effectivePrice >= 70) {
    breakdown.push({ factor: "buyFavorite", points: 8, desc: "Buying at 70-85% (favorite)" });
  }
  if (price <= 15 || price >= 85) breakdown.push({ factor: "extremeOdds", points: 5 });
  if (market.slug) {
    const eventTiming = getEventTiming(market.slug, market.lastTradeTime);
    if (eventTiming) {
      breakdown.push(eventTiming);
    }
  }
  if (hasWinningWallet) {
    breakdown.push({ factor: "winningWallet", points: 30 });
  }
  return breakdown;
}
__name(getScoreBreakdown, "getScoreBreakdown");
function getEventTiming(slug, lastTradeTime) {
  const dateMatch = (slug || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) return null;
  const eventDate = new Date(
    parseInt(dateMatch[1]),
    parseInt(dateMatch[2]) - 1,
    parseInt(dateMatch[3])
  );
  const estimatedEventStart = new Date(eventDate);
  estimatedEventStart.setUTCHours(24, 0, 0, 0);
  const tradeTime = typeof lastTradeTime === "number" ? lastTradeTime : new Date(lastTradeTime).getTime();
  if (!tradeTime || isNaN(tradeTime)) return null;
  const hoursBeforeEvent = (estimatedEventStart.getTime() - tradeTime) / (1e3 * 60 * 60);
  if (hoursBeforeEvent <= 0) {
    return { factor: "betDuringEvent", points: 20, desc: "Bet placed during/after event start" };
  } else if (hoursBeforeEvent <= 2) {
    return { factor: "betLast2Hours", points: 25, desc: "Bet placed within 2h of event" };
  } else if (hoursBeforeEvent <= 6) {
    return { factor: "betSameDay", points: 15, desc: "Bet placed same day (2-6h before)" };
  } else if (hoursBeforeEvent <= 24) {
    return { factor: "betDayBefore", points: 8, desc: "Bet placed day before event" };
  } else if (hoursBeforeEvent <= 72) {
    return { factor: "betEarlyDays", points: 5, desc: "Bet placed 1-3 days before event" };
  } else {
    return { factor: "betVeryEarly", points: 3, desc: "Bet placed 3+ days before event" };
  }
}
__name(getEventTiming, "getEventTiming");
async function getRecentSignals(env, limit = 20) {
  const cached = await getCachedScanResult(env, "scan_result_48_40_all");
  if (cached && cached.signals) return cached.signals.slice(0, limit);
  const result = await runScan(24, 30, env, { sportsOnly: false });
  return result.signals?.slice(0, limit) || [];
}
__name(getRecentSignals, "getRecentSignals");
async function getSignal(env, signalId) {
  const cached = await getCachedScanResult(env, "scan_result_48_40_all");
  if (cached && cached.signals) return cached.signals.find((s) => s.id === signalId);
  return null;
}
__name(getSignal, "getSignal");

// src/odds-api.js
var CACHE_DURATION = {
  ODDS: 30 * 60,
  // 30 minutes for Vegas odds
  SCORES: 15 * 60,
  // 15 minutes for scores
  COMPARISON: 10 * 60
  // 10 minutes for full comparison (shorter since we have real-time Poly prices now)
};
async function getCachedOrFetch(env, cacheKey, fetchFn, ttlSeconds) {
  if (!env.SIGNALS_CACHE) {
    return await fetchFn();
  }
  try {
    const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: "json" });
    if (cached && cached.data !== void 0 && cached.data !== null) {
      const age = Date.now() - cached.timestamp;
      const maxAge = ttlSeconds * 1e3;
      if (age < maxAge) {
        console.log(`Cache HIT for ${cacheKey} (age: ${Math.round(age / 1e3)}s)`);
        return cached.data;
      }
    }
    console.log(`Cache MISS for ${cacheKey} - fetching fresh`);
    const freshData = await fetchFn();
    if (freshData) {
      await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
        data: freshData,
        timestamp: Date.now()
      }), { expirationTtl: ttlSeconds + 60 });
    }
    return freshData;
  } catch (e) {
    console.error(`Cache error for ${cacheKey}:`, e.message);
    return await fetchFn();
  }
}
__name(getCachedOrFetch, "getCachedOrFetch");
async function getGameOdds(env, sportKey, markets) {
  if (!env.ODDS_API_KEY) {
    console.log("No ODDS_API_KEY configured");
    return null;
  }
  const cacheKey = `odds_data_${sportKey}_${markets || "h2h,spreads"}`;
  return getCachedOrFetch(env, cacheKey, async () => {
    try {
      const url = `${ODDS_API_BASE}/sports/${sportKey}/odds/?apiKey=${env.ODDS_API_KEY}&regions=us&markets=${markets || "h2h,spreads"}&oddsFormat=american`;
      const response = await fetch(url);
      if (!response.ok) {
        console.error("Odds API error:", response.status);
        return null;
      }
      return await response.json();
    } catch (e) {
      console.error("Error fetching odds:", e.message);
      return null;
    }
  }, CACHE_DURATION.ODDS);
}
__name(getGameOdds, "getGameOdds");
async function getGameScores(env, sportKey, daysFrom) {
  if (!env.ODDS_API_KEY) return null;
  const cacheKey = `odds_scores_${sportKey}_${daysFrom || 3}`;
  return getCachedOrFetch(env, cacheKey, async () => {
    try {
      const url = `${ODDS_API_BASE}/sports/${sportKey}/scores/?apiKey=${env.ODDS_API_KEY}&daysFrom=${daysFrom || 3}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      return null;
    }
  }, CACHE_DURATION.SCORES);
}
__name(getGameScores, "getGameScores");
async function getOddsComparison(env, sport) {
  const sportKey = SPORT_KEY_MAP[sport];
  if (!sportKey) return { success: false, error: "Sport not supported" };
  if (!env.ODDS_API_KEY) {
    return { success: false, error: "Odds API not configured" };
  }
  const cacheKey = `odds_comparison_v2_${sport}`;
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: "json" });
      if (cached && cached.data) {
        const age = Date.now() - cached.timestamp;
        const maxAge = CACHE_DURATION.COMPARISON * 1e3;
        if (age < maxAge) {
          console.log(`Comparison cache HIT for ${sport}`);
          return {
            ...cached.data,
            fromCache: true,
            cacheAge: Math.round(age / 1e3),
            nextRefresh: Math.round((maxAge - age) / 1e3)
          };
        }
      }
    } catch (e) {
    }
  }
  try {
    console.log(`Building odds comparison for ${sport}...`);
    const vegasOddsRaw = await getGameOdds(env, sportKey, "h2h,spreads");
    let vegasOdds = [];
    if (Array.isArray(vegasOddsRaw)) {
      vegasOdds = vegasOddsRaw;
    } else if (vegasOddsRaw && typeof vegasOddsRaw === "object") {
      const entries = Object.entries(vegasOddsRaw).filter(([key]) => /^\d+$/.test(key)).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([_, val]) => val);
      if (entries.length > 0) {
        vegasOdds = entries;
      }
    }
    console.log(`Vegas odds extracted: ${vegasOdds.length} games (raw type: ${Array.isArray(vegasOddsRaw) ? "array" : typeof vegasOddsRaw})`);
    const polyMarkets = await getSportsMarketsWithPrices(env, sport);
    console.log(`Vegas games: ${vegasOdds?.length || 0}, Poly markets: ${polyMarkets?.markets?.length || 0}`);
    const polyLookup = buildPolymarketLookup(polyMarkets?.markets || []);
    const slugKeys = Object.keys(polyLookup.bySlug).slice(0, 5);
    const teamDateKeys = Object.keys(polyLookup.byTeamDate).slice(0, 10);
    console.log(`Poly lookup sample slugs: ${JSON.stringify(slugKeys)}`);
    console.log(`Poly lookup sample team-dates: ${JSON.stringify(teamDateKeys)}`);
    const games = (vegasOdds || []).map((vegasGame) => {
      const result2 = processGameWithRealTimePrices(vegasGame, polyLookup);
      if (!result2.hasPolymarket) {
        console.log(`NO MATCH: ${vegasGame.away_team} @ ${vegasGame.home_team} (${vegasGame.commence_time?.split("T")[0]})`);
      } else {
        console.log(`MATCHED: ${vegasGame.away_team} @ ${vegasGame.home_team} \u2192 ${result2.polymarket?.slug}`);
      }
      return result2;
    });
    games.sort((a, b) => {
      if (a.hasReliablePolyData && !b.hasReliablePolyData) return -1;
      if (!a.hasReliablePolyData && b.hasReliablePolyData) return 1;
      const aEdge = Math.max(a.edge?.home || -100, a.edge?.away || -100);
      const bEdge = Math.max(b.edge?.home || -100, b.edge?.away || -100);
      return bEdge - aEdge;
    });
    const valueBets = games.filter((g) => g.edge?.bestBet && g.hasReliablePolyData).map((g) => ({
      game: `${g.awayTeam} @ ${g.homeTeam}`,
      team: g.edge.bestBet.team,
      edge: g.edge.bestBet.edge,
      type: g.edge.bestBet.type,
      vegasProb: g.edge.bestBet.vegasProb,
      polyPrice: g.edge.bestBet.polyPrice,
      polySlug: g.polymarket?.slug
    }));
    const result = {
      success: true,
      sport,
      sportKey,
      version: "18.6.0-realtime",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      gamesCount: games.length,
      valueBetsCount: valueBets.length,
      polymarketGamesMatched: games.filter((g) => g.hasPolymarket).length,
      polymarketSource: "gamma-api-realtime",
      valueBets,
      games
    };
    if (env.SIGNALS_CACHE) {
      await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
        data: result,
        timestamp: Date.now()
      }), { expirationTtl: CACHE_DURATION.COMPARISON + 60 });
    }
    return result;
  } catch (e) {
    console.error("Odds comparison error:", e);
    return { success: false, error: e.message, stack: e.stack };
  }
}
__name(getOddsComparison, "getOddsComparison");
function buildPolymarketLookup(markets) {
  const lookup = {
    bySlug: {},
    byTeamDate: {}
  };
  for (const market of markets) {
    if (!market.slug) continue;
    const slug = market.slug.toLowerCase();
    lookup.bySlug[slug] = market;
    const dateMatch = slug.match(/(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;
    const date = dateMatch[1];
    const parts = slug.split("-");
    const dateIdx = parts.findIndex((p) => /^\d{4}$/.test(p));
    if (dateIdx > 2) {
      const teamParts = parts.slice(1, dateIdx);
      for (const abbr of teamParts) {
        const key = `${abbr}-${date}`;
        if (!lookup.byTeamDate[key]) {
          lookup.byTeamDate[key] = market;
        }
      }
      const combinedKey = `${teamParts.join("-")}-${date}`;
      lookup.byTeamDate[combinedKey] = market;
    }
    const outcomes = market.outcomes || [];
    for (const outcome of outcomes) {
      const cleanOutcome = outcome.toLowerCase().replace(/[^a-z0-9]/g, "");
      lookup.byTeamDate[`${cleanOutcome}-${date}`] = market;
      const words = outcome.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 3) {
          const wordKey = `${word}-${date}`;
          if (!lookup.byTeamDate[wordKey]) {
            lookup.byTeamDate[wordKey] = market;
          }
        }
      }
    }
    const title = (market.eventTitle || market.question || "").toLowerCase();
    const titleWords = title.split(/[\s.]+/).filter((w) => w.length > 3 && w !== "vs");
    for (const word of titleWords) {
      const wordKey = `${word}-${date}`;
      if (!lookup.byTeamDate[wordKey]) {
        lookup.byTeamDate[wordKey] = market;
      }
    }
  }
  console.log(`Built Polymarket lookup: ${Object.keys(lookup.bySlug).length} by slug, ${Object.keys(lookup.byTeamDate).length} by team-date`);
  return lookup;
}
__name(buildPolymarketLookup, "buildPolymarketLookup");
function processGameWithRealTimePrices(vegasGame, polyLookup) {
  const preferredBooks = ["fanduel", "draftkings", "betmgm"];
  let h2hOdds = null;
  let spreadOdds = null;
  for (const bookKey of preferredBooks) {
    const book = vegasGame.bookmakers?.find((b) => b.key === bookKey);
    if (book) {
      if (!h2hOdds) {
        const h2hMarket = book.markets?.find((m) => m.key === "h2h");
        if (h2hMarket) h2hOdds = h2hMarket.outcomes;
      }
      if (!spreadOdds) {
        const spreadMarket = book.markets?.find((m) => m.key === "spreads");
        if (spreadMarket) spreadOdds = spreadMarket.outcomes;
      }
    }
    if (h2hOdds && spreadOdds) break;
  }
  const vegasHomeProb = h2hOdds?.find((o) => o.name === vegasGame.home_team)?.price ? Math.round(americanToProb(h2hOdds.find((o) => o.name === vegasGame.home_team).price) * 100) : null;
  const vegasAwayProb = h2hOdds?.find((o) => o.name === vegasGame.away_team)?.price ? Math.round(americanToProb(h2hOdds.find((o) => o.name === vegasGame.away_team).price) * 100) : null;
  const polyMatch = findPolymarketMatch(vegasGame, polyLookup);
  let homeEdge = null;
  let awayEdge = null;
  let polyHomePrice = null;
  let polyAwayPrice = null;
  if (polyMatch) {
    if (polyMatch.outcomes && polyMatch.outcomes.length >= 2) {
      const homeTeamLower = vegasGame.home_team.toLowerCase();
      const awayTeamLower = vegasGame.away_team.toLowerCase();
      const outcome0Lower = polyMatch.outcomes[0].toLowerCase();
      const outcome1Lower = polyMatch.outcomes[1].toLowerCase();
      const score_o0_home = teamMatchScore(outcome0Lower, homeTeamLower);
      const score_o0_away = teamMatchScore(outcome0Lower, awayTeamLower);
      const score_o1_home = teamMatchScore(outcome1Lower, homeTeamLower);
      const score_o1_away = teamMatchScore(outcome1Lower, awayTeamLower);
      console.log(`Price assignment: o0="${polyMatch.outcomes[0]}" o1="${polyMatch.outcomes[1]}" | home="${vegasGame.home_team}" away="${vegasGame.away_team}" | scores: o0h=${score_o0_home} o0a=${score_o0_away} o1h=${score_o1_home} o1a=${score_o1_away} | yesPrice=${polyMatch.yesPrice} noPrice=${polyMatch.noPrice}`);
      const assignNormal = score_o0_home + score_o1_away;
      const assignFlipped = score_o0_away + score_o1_home;
      if (assignNormal >= assignFlipped && assignNormal > 0) {
        polyHomePrice = polyMatch.yesPrice;
        polyAwayPrice = polyMatch.noPrice;
        console.log(`\u2192 Assignment: NORMAL (o0=home=${polyMatch.yesPrice}\xA2, o1=away=${polyMatch.noPrice}\xA2)`);
      } else if (assignFlipped > assignNormal && assignFlipped > 0) {
        polyAwayPrice = polyMatch.yesPrice;
        polyHomePrice = polyMatch.noPrice;
        console.log(`\u2192 Assignment: FLIPPED (o0=away=${polyMatch.yesPrice}\xA2, o1=home=${polyMatch.noPrice}\xA2)`);
      } else {
        console.log(`WARNING: Cannot determine team assignment for ${vegasGame.home_team} vs ${vegasGame.away_team}, outcomes: ${polyMatch.outcomes.join(", ")}`);
        polyAwayPrice = polyMatch.yesPrice;
        polyHomePrice = polyMatch.noPrice;
      }
    } else {
      polyHomePrice = polyMatch.yesPrice;
      polyAwayPrice = polyMatch.noPrice;
    }
    if (polyHomePrice !== null && vegasHomeProb !== null) {
      homeEdge = vegasHomeProb - polyHomePrice;
    }
    if (polyAwayPrice !== null && vegasAwayProb !== null) {
      awayEdge = vegasAwayProb - polyAwayPrice;
    }
  }
  let bestBet = null;
  if (homeEdge !== null && homeEdge >= 5) {
    bestBet = {
      team: vegasGame.home_team,
      edge: Math.round(homeEdge),
      type: "moneyline",
      vegasProb: vegasHomeProb,
      polyPrice: polyHomePrice
    };
  } else if (awayEdge !== null && awayEdge >= 5) {
    bestBet = {
      team: vegasGame.away_team,
      edge: Math.round(awayEdge),
      type: "moneyline",
      vegasProb: vegasAwayProb,
      polyPrice: polyAwayPrice
    };
  }
  return {
    id: vegasGame.id,
    homeTeam: vegasGame.home_team,
    awayTeam: vegasGame.away_team,
    commenceTime: vegasGame.commence_time,
    vegas: {
      moneyline: h2hOdds ? {
        home: {
          odds: h2hOdds.find((o) => o.name === vegasGame.home_team)?.price,
          prob: vegasHomeProb
        },
        away: {
          odds: h2hOdds.find((o) => o.name === vegasGame.away_team)?.price,
          prob: vegasAwayProb
        }
      } : null,
      spread: spreadOdds ? {
        home: {
          line: spreadOdds.find((o) => o.name === vegasGame.home_team)?.point,
          odds: spreadOdds.find((o) => o.name === vegasGame.home_team)?.price
        },
        away: {
          line: spreadOdds.find((o) => o.name === vegasGame.away_team)?.point,
          odds: spreadOdds.find((o) => o.name === vegasGame.away_team)?.price
        }
      } : null
    },
    polymarket: polyMatch ? {
      slug: polyMatch.slug,
      outcomes: polyMatch.outcomes,
      // Direct access (backwards compat)
      home: { price: polyHomePrice },
      away: { price: polyAwayPrice },
      // Nested under moneyline (what GameCard.jsx expects)
      moneyline: {
        home: { price: polyHomePrice },
        away: { price: polyAwayPrice }
      },
      volume: polyMatch.volume,
      liquidity: polyMatch.liquidity,
      source: "gamma-api-realtime",
      lastUpdate: (/* @__PURE__ */ new Date()).toISOString()
    } : null,
    edge: {
      home: homeEdge !== null ? Math.round(homeEdge) : null,
      away: awayEdge !== null ? Math.round(awayEdge) : null,
      bestBet
    },
    hasPolymarket: !!polyMatch,
    hasReliablePolyData: !!(polyMatch && (polyHomePrice || polyAwayPrice))
  };
}
__name(processGameWithRealTimePrices, "processGameWithRealTimePrices");
function findPolymarketMatch(vegasGame, polyLookup) {
  const homeTeam = vegasGame.home_team;
  const awayTeam = vegasGame.away_team;
  const gameDate = vegasGame.commence_time?.split("T")[0];
  if (!gameDate) return null;
  const d = new Date(gameDate);
  const prevDay = new Date(d);
  prevDay.setDate(d.getDate() - 1);
  const nextDay = new Date(d);
  nextDay.setDate(d.getDate() + 1);
  const searchDates = [
    gameDate,
    nextDay.toISOString().split("T")[0],
    prevDay.toISOString().split("T")[0]
  ];
  const homeWords = homeTeam.toLowerCase().split(/\s+/);
  const awayWords = awayTeam.toLowerCase().split(/\s+/);
  const homeLast = homeWords[homeWords.length - 1];
  const awayLast = awayWords[awayWords.length - 1];
  const NBA_ABBREV = {
    "hawks": "atl",
    "celtics": "bos",
    "nets": "bkn",
    "hornets": "cha",
    "bulls": "chi",
    "cavaliers": "cle",
    "mavericks": "dal",
    "nuggets": "den",
    "pistons": "det",
    "warriors": "gsw",
    "rockets": "hou",
    "pacers": "ind",
    "clippers": "lac",
    "lakers": "lal",
    "grizzlies": "mem",
    "heat": "mia",
    "bucks": "mil",
    "timberwolves": "min",
    "pelicans": "nop",
    "knicks": "nyk",
    "thunder": "okc",
    "magic": "orl",
    "76ers": "phi",
    "suns": "phx",
    "trail blazers": "por",
    "kings": "sac",
    "spurs": "sas",
    "raptors": "tor",
    "jazz": "uta",
    "wizards": "was"
  };
  const homeAbbrev = NBA_ABBREV[homeLast] || NBA_ABBREV[homeTeam.toLowerCase().split(" ").slice(1).join(" ")] || null;
  const awayAbbrev = NBA_ABBREV[awayLast] || NBA_ABBREV[awayTeam.toLowerCase().split(" ").slice(1).join(" ")] || null;
  for (const date of searchDates) {
    const homeKey = `${homeLast}-${date}`;
    const homeMatch = polyLookup.byTeamDate[homeKey];
    if (homeMatch) {
      const matchStr = (homeMatch.slug + " " + (homeMatch.outcomes || []).join(" ") + " " + (homeMatch.eventTitle || "")).toLowerCase();
      if (matchStr.includes(awayLast)) {
        console.log(`MATCHED by mascot: ${awayTeam} @ ${homeTeam} \u2192 ${homeMatch.slug}`);
        return homeMatch;
      }
    }
    if (homeAbbrev && awayAbbrev) {
      const key1 = `${awayAbbrev}-${homeAbbrev}-${date}`;
      const key2 = `${homeAbbrev}-${awayAbbrev}-${date}`;
      if (polyLookup.byTeamDate[key1]) {
        console.log(`MATCHED by abbrev: ${awayTeam} @ ${homeTeam} \u2192 ${polyLookup.byTeamDate[key1].slug}`);
        return polyLookup.byTeamDate[key1];
      }
      if (polyLookup.byTeamDate[key2]) {
        console.log(`MATCHED by abbrev: ${awayTeam} @ ${homeTeam} \u2192 ${polyLookup.byTeamDate[key2].slug}`);
        return polyLookup.byTeamDate[key2];
      }
    }
    const homeClean = homeTeam.toLowerCase().replace(/[^a-z0-9]/g, "");
    const awayClean = awayTeam.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (polyLookup.byTeamDate[`${homeClean}-${date}`]) {
      console.log(`MATCHED by fullname: ${awayTeam} @ ${homeTeam} \u2192 slug`);
      return polyLookup.byTeamDate[`${homeClean}-${date}`];
    }
    if (polyLookup.byTeamDate[`${awayClean}-${date}`]) {
      return polyLookup.byTeamDate[`${awayClean}-${date}`];
    }
    for (const [slug, market] of Object.entries(polyLookup.bySlug)) {
      if (!slug.includes(date)) continue;
      const matchStr = slug + " " + (market.outcomes || []).join(" ").toLowerCase() + " " + (market.eventTitle || "").toLowerCase();
      const hasHome = matchStr.includes(homeLast) || homeAbbrev && slug.includes(homeAbbrev);
      const hasAway = matchStr.includes(awayLast) || awayAbbrev && slug.includes(awayAbbrev);
      if (hasHome && hasAway) {
        console.log(`MATCHED by scan: ${awayTeam} @ ${homeTeam} \u2192 ${slug}`);
        return market;
      }
    }
  }
  console.log(`NO MATCH: ${awayTeam} @ ${homeTeam} (${gameDate})`);
  return null;
}
__name(findPolymarketMatch, "findPolymarketMatch");
function teamMatchScore(outcome, teamName) {
  const normalize = /* @__PURE__ */ __name((s) => s.replace(/\bst\b/g, "state").replace(/\bn'western\b/g, "northwestern").replace(/\bsf\b/g, "san francisco").replace(/\bsfa\b/g, "stephen f austin"), "normalize");
  outcome = normalize(outcome);
  teamName = normalize(teamName);
  const outcomeWords = outcome.split(/[\s.]+/).filter((w) => w.length > 1);
  const teamWords = teamName.split(/[\s.]+/).filter((w) => w.length > 1);
  if (outcomeWords.length === 0 || teamWords.length === 0) return 0;
  let score = 0;
  let matchedWords = 0;
  for (const ow of outcomeWords) {
    for (const tw of teamWords) {
      if (ow === tw) {
        score += 10;
        matchedWords++;
      } else if (ow.length > 3 && tw.length > 3 && (ow.includes(tw) || tw.includes(ow))) {
        score += 5;
        matchedWords++;
      }
    }
  }
  if (matchedWords >= outcomeWords.length && outcomeWords.length > 1) {
    score += 20;
  }
  if (teamName.includes(outcome) || outcome.includes(teamName)) {
    score += 50;
  }
  return score;
}
__name(teamMatchScore, "teamMatchScore");
function findMatchingGame(games, homeTeamCode, awayTeamCode) {
  if (!games || !Array.isArray(games)) return null;
  const homeFullName = getTeamFullName(homeTeamCode);
  const awayFullName = getTeamFullName(awayTeamCode);
  for (const game of games) {
    const gameHome = (game.home_team || "").toLowerCase();
    const gameAway = (game.away_team || "").toLowerCase();
    const homeMatch = homeFullName.toLowerCase();
    const awayMatch = awayFullName.toLowerCase();
    if ((gameHome.includes(homeMatch) || homeMatch.includes(gameHome)) && (gameAway.includes(awayMatch) || awayMatch.includes(gameAway))) {
      return game;
    }
    if ((gameHome.includes(awayMatch) || awayMatch.includes(gameHome)) && (gameAway.includes(homeMatch) || homeMatch.includes(gameAway))) {
      return game;
    }
  }
  return null;
}
__name(findMatchingGame, "findMatchingGame");

// src/settlement.js
async function checkMarketSettlement(marketSlug, signalDetectedAt) {
  try {
    const tradesRes = await fetch(`${POLYMARKET_API}/trades?limit=2000`);
    if (!tradesRes.ok) {
      console.log(`Trades API error: ${tradesRes.status}`);
      return null;
    }
    const trades = await tradesRes.json();
    let marketTrades = trades.filter(
      (t) => t.slug === marketSlug || t.eventSlug === marketSlug
    );
    if (marketTrades.length === 0 && (marketSlug.includes("-spread") || marketSlug.includes("-total"))) {
      const baseSlug = marketSlug.replace(/-spread.*$/, "").replace(/-total.*$/, "");
      marketTrades = trades.filter(
        (t) => t.slug === baseSlug || t.eventSlug === baseSlug
      );
    }
    const slugDateMatch = (marketSlug || "").match(/(\d{4})-(\d{2})-(\d{2})/);
    let hoursSinceEvent = 0;
    if (slugDateMatch) {
      const eventDate = new Date(
        parseInt(slugDateMatch[1]),
        parseInt(slugDateMatch[2]) - 1,
        parseInt(slugDateMatch[3]),
        23,
        59,
        59
      );
      hoursSinceEvent = (Date.now() - eventDate.getTime()) / (1e3 * 60 * 60);
    } else if (signalDetectedAt) {
      const detectedTime = new Date(signalDetectedAt).getTime();
      hoursSinceEvent = (Date.now() - detectedTime) / (1e3 * 60 * 60);
    }
    if (marketTrades.length === 0) {
      if (hoursSinceEvent > 12) {
        return {
          settled: true,
          winningOutcome: "UNKNOWN",
          resolutionPrice: 0,
          note: `Event ${Math.round(hoursSinceEvent)}h ago, no recent trades`
        };
      }
      return { settled: false };
    }
    marketTrades.sort((a, b) => b.timestamp - a.timestamp);
    const latestTrade = marketTrades[0];
    const latestPrice = parseFloat(latestTrade.price);
    if (latestPrice >= 0.95) {
      return {
        settled: true,
        winningOutcome: latestTrade.outcome || "Yes",
        resolutionPrice: latestPrice
      };
    }
    if (latestPrice <= 0.05) {
      let winningOutcome = "No";
      if (latestTrade.outcome === "No") winningOutcome = "Yes";
      else if (latestTrade.outcome === "Yes") winningOutcome = "No";
      return {
        settled: true,
        winningOutcome,
        resolutionPrice: 1 - latestPrice
      };
    }
    if (hoursSinceEvent > 24) {
      return {
        settled: true,
        winningOutcome: "UNKNOWN",
        resolutionPrice: latestPrice,
        note: `Event ${Math.round(hoursSinceEvent)}h ago, ambiguous price`
      };
    }
    return { settled: false, currentPrice: latestPrice };
  } catch (e) {
    console.error(`Error checking settlement for ${marketSlug}:`, e.message);
    return null;
  }
}
__name(checkMarketSettlement, "checkMarketSettlement");
async function settleWithOddsAPI(env, marketSlug, direction) {
  const sport = detectSportFromSlug(marketSlug);
  if (!sport) return null;
  const sportKey = SPORT_KEY_MAP[sport];
  if (!sportKey) return null;
  const teams = extractTeamsFromSlug(marketSlug);
  if (!teams) return null;
  const scores = await getGameScores(env, sportKey, 3);
  if (!scores) return null;
  const game = findMatchingGame(scores, teams.home, teams.away);
  if (!game) {
    console.log(`No matching game found for ${marketSlug}`);
    return null;
  }
  if (!game.completed) {
    return { status: "pending", game };
  }
  if (!game.scores || game.scores.length < 2) {
    return { status: "no_scores", game };
  }
  const homeScore = parseInt(game.scores.find((s) => s.name === game.home_team)?.score || 0);
  const awayScore = parseInt(game.scores.find((s) => s.name === game.away_team)?.score || 0);
  let winner;
  if (homeScore > awayScore) winner = game.home_team;
  else if (awayScore > homeScore) winner = game.away_team;
  else winner = "tie";
  const isSpread = marketSlug.includes("spread");
  if (isSpread) {
    const spreadMatch = marketSlug.match(/spread-(home|away)-(\d+)pt?(\d)?/i);
    if (spreadMatch) {
      const spreadSide = spreadMatch[1].toLowerCase();
      const spreadPoints = parseFloat(`${spreadMatch[2]}.${spreadMatch[3] || "5"}`);
      let spreadWinner;
      if (spreadSide === "away") {
        spreadWinner = awayScore + spreadPoints > homeScore ? game.away_team : game.home_team;
      } else {
        spreadWinner = homeScore - awayScore > spreadPoints ? game.home_team : game.away_team;
      }
      const dirTeam2 = getTeamFullName(direction);
      const didWin2 = spreadWinner.toLowerCase().includes(dirTeam2.toLowerCase()) || dirTeam2.toLowerCase().includes(spreadWinner.toLowerCase());
      return {
        status: "settled",
        outcome: didWin2 ? "WIN" : "LOSS",
        game,
        homeScore,
        awayScore,
        spread: spreadPoints,
        spreadWinner,
        source: "odds-api"
      };
    }
  }
  const dirTeam = getTeamFullName(direction);
  const didWin = winner.toLowerCase().includes(dirTeam.toLowerCase()) || dirTeam.toLowerCase().includes(winner.toLowerCase());
  return {
    status: "settled",
    outcome: didWin ? "WIN" : "LOSS",
    game,
    homeScore,
    awayScore,
    winner,
    source: "odds-api"
  };
}
__name(settleWithOddsAPI, "settleWithOddsAPI");
async function processSettledSignals(env) {
  if (!env.SIGNALS_CACHE) return { processed: 0, wins: 0, losses: 0 };
  const results = { processed: 0, wins: 0, losses: 0, errors: 0 };
  try {
    let pendingSignals = await env.SIGNALS_CACHE.get(KV_KEYS.PENDING_SIGNALS, { type: "json" }) || [];
    const stillPending = [];
    console.log(`Checking ${pendingSignals.length} pending signals...`);
    for (const signalId of pendingSignals) {
      try {
        const signalKey = KV_KEYS.SIGNALS_PREFIX + signalId;
        const signalData = await env.SIGNALS_CACHE.get(signalKey, { type: "json" });
        if (!signalData || signalData.outcome) {
          continue;
        }
        if (signalData.eventStartTime) {
          const eventStart = new Date(signalData.eventStartTime).getTime();
          const now = Date.now();
          if (now < eventStart) {
            stillPending.push(signalId);
            continue;
          }
          if (signalData.eventEndTime) {
            const eventEnd = new Date(signalData.eventEndTime).getTime();
            if (now < eventEnd + 60 * 60 * 1e3) {
            }
          }
        }
        const sport = detectSportFromSlug(signalData.marketSlug);
        if (sport && SPORT_KEY_MAP[sport] && env.ODDS_API_KEY) {
          const oddsApiResult = await settleWithOddsAPI(env, signalData.marketSlug, signalData.direction);
          if (oddsApiResult?.status === "settled") {
            const outcome2 = oddsApiResult.outcome;
            const profitPct2 = outcome2 === "WIN" ? Math.round((1 - signalData.priceAtSignal / 100) / (signalData.priceAtSignal / 100) * 100) : -100;
            signalData.outcome = outcome2;
            signalData.settledAt = (/* @__PURE__ */ new Date()).toISOString();
            signalData.profitLoss = profitPct2;
            signalData.gameScore = `${oddsApiResult.homeScore}-${oddsApiResult.awayScore}`;
            signalData.settledBy = "odds-api";
            await env.SIGNALS_CACHE.put(signalKey, JSON.stringify(signalData), {
              expirationTtl: 30 * 24 * 60 * 60
            });
            for (const wallet of signalData.wallets || []) {
              await recordWalletOutcome(env, wallet, outcome2, profitPct2, signalData.marketType, signalData.largestBet, signalId);
            }
            const factors = signalData.scoreBreakdown || signalData.factors || [];
            if (factors.length > 0) {
              await updateFactorStats(env, factors, outcome2);
              await trackFactorCombo(env, factors, outcome2);
            }
            await trackSignalMetadata(env, signalData, outcome2);
            results.processed++;
            if (outcome2 === "WIN") results.wins++;
            else results.losses++;
            continue;
          } else if (oddsApiResult?.status === "pending") {
            stillPending.push(signalId);
            continue;
          }
        }
        const settlement = await checkMarketSettlement(signalData.marketSlug, signalData.detectedAt);
        if (!settlement || !settlement.settled) {
          stillPending.push(signalId);
          continue;
        }
        if (settlement.winningOutcome === "UNKNOWN") {
          signalData.outcome = "UNKNOWN";
          signalData.settledAt = (/* @__PURE__ */ new Date()).toISOString();
          await env.SIGNALS_CACHE.put(signalKey, JSON.stringify(signalData), {
            expirationTtl: 7 * 24 * 60 * 60
          });
          results.processed++;
          continue;
        }
        const signalDirection = (signalData.direction || "").toLowerCase();
        const winningOutcome = (settlement.winningOutcome || "").toLowerCase();
        let outcome = "LOSS";
        if (signalDirection === winningOutcome) outcome = "WIN";
        else if (signalDirection === "yes" && winningOutcome === "yes") outcome = "WIN";
        else if (signalDirection === "no" && winningOutcome === "no") outcome = "WIN";
        const entryPrice = signalData.priceAtSignal / 100;
        const profitPct = outcome === "WIN" ? Math.round((1 - entryPrice) / entryPrice * 100) : -100;
        signalData.outcome = outcome;
        signalData.settledAt = (/* @__PURE__ */ new Date()).toISOString();
        signalData.profitLoss = profitPct;
        signalData.settledBy = "polymarket";
        await env.SIGNALS_CACHE.put(signalKey, JSON.stringify(signalData), {
          expirationTtl: 30 * 24 * 60 * 60
        });
        for (const wallet of signalData.wallets || []) {
          await recordWalletOutcome(env, wallet, outcome, profitPct, signalData.marketType, signalData.largestBet, signalId);
        }
        const polyFactors = signalData.scoreBreakdown || signalData.factors || [];
        if (polyFactors.length > 0) {
          await updateFactorStats(env, polyFactors, outcome);
          await trackFactorCombo(env, polyFactors, outcome);
        }
        await trackSignalMetadata(env, signalData, outcome);
        results.processed++;
        if (outcome === "WIN") results.wins++;
        else results.losses++;
      } catch (e) {
        results.errors++;
        stillPending.push(signalId);
      }
    }
    await env.SIGNALS_CACHE.put(KV_KEYS.PENDING_SIGNALS, JSON.stringify(stillPending), {
      expirationTtl: 30 * 24 * 60 * 60
    });
    return results;
  } catch (e) {
    console.error("Error processing settlements:", e.message);
    return results;
  }
}
__name(processSettledSignals, "processSettledSignals");

// src/trades.js
var TRADES_KV_KEYS = {
  TRADE_BUCKET_PREFIX: "trades_bucket_",
  // trades_bucket_2026-01-30-23 (hourly buckets)
  TRADE_INDEX: "trades_index",
  // List of bucket keys
  LAST_POLL: "trades_last_poll",
  POLL_STATS: "trades_poll_stats"
};
function getBucketKey(timestamp) {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  return `${TRADES_KV_KEYS.TRADE_BUCKET_PREFIX}${year}-${month}-${day}-${hour}`;
}
__name(getBucketKey, "getBucketKey");
async function pollAndStoreTrades(env) {
  if (!env.SIGNALS_CACHE) {
    return { success: false, error: "No KV storage available" };
  }
  const startTime = Date.now();
  try {
    const tradesRes = await fetch(`${POLYMARKET_API}/trades?limit=1000`);
    if (!tradesRes.ok) {
      throw new Error(`Trades API error: ${tradesRes.status}`);
    }
    const trades = await tradesRes.json();
    const lastPollStr = await env.SIGNALS_CACHE.get(TRADES_KV_KEYS.LAST_POLL);
    const lastPollTime = lastPollStr ? parseInt(lastPollStr) : 0;
    const newTrades = trades.filter((t) => {
      const tradeTime = t.timestamp * 1e3;
      return tradeTime > lastPollTime;
    });
    if (newTrades.length === 0) {
      await env.SIGNALS_CACHE.put(TRADES_KV_KEYS.LAST_POLL, String(Date.now()));
      return {
        success: true,
        newTrades: 0,
        message: "No new trades since last poll"
      };
    }
    const buckets = {};
    for (const trade of newTrades) {
      const tradeTime = trade.timestamp * 1e3;
      const bucketKey = getBucketKey(tradeTime);
      if (!buckets[bucketKey]) {
        buckets[bucketKey] = [];
      }
      buckets[bucketKey].push({
        ts: trade.timestamp,
        slug: trade.slug || trade.eventSlug,
        eventSlug: trade.eventSlug,
        title: trade.title,
        outcome: trade.outcome,
        outcomeIndex: trade.outcomeIndex,
        // 0 = Yes/Team1, 1 = No/Team2
        side: trade.side,
        price: trade.price,
        size: trade.size,
        proxyWallet: trade.proxyWallet,
        icon: trade.icon
      });
    }
    const bucketKeys = Object.keys(buckets);
    for (const bucketKey of bucketKeys) {
      const existingData = await env.SIGNALS_CACHE.get(bucketKey, { type: "json" }) || [];
      const existingSet = new Set(existingData.map((t) => `${t.ts}-${t.proxyWallet}-${t.slug}`));
      const newBucketTrades = buckets[bucketKey].filter(
        (t) => !existingSet.has(`${t.ts}-${t.proxyWallet}-${t.slug}`)
      );
      if (newBucketTrades.length > 0) {
        const mergedTrades = [...existingData, ...newBucketTrades];
        await env.SIGNALS_CACHE.put(bucketKey, JSON.stringify(mergedTrades), {
          expirationTtl: 72 * 60 * 60
        });
      }
    }
    const existingIndex = await env.SIGNALS_CACHE.get(TRADES_KV_KEYS.TRADE_INDEX, { type: "json" }) || [];
    const indexSet = new Set(existingIndex);
    for (const key of bucketKeys) {
      indexSet.add(key);
    }
    const cutoffTime = Date.now() - 72 * 60 * 60 * 1e3;
    const activeIndex = [...indexSet].filter((key) => {
      const match = key.match(/trades_bucket_(\d{4})-(\d{2})-(\d{2})-(\d{2})/);
      if (!match) return false;
      const bucketDate = new Date(Date.UTC(
        parseInt(match[1]),
        parseInt(match[2]) - 1,
        parseInt(match[3]),
        parseInt(match[4])
      ));
      return bucketDate.getTime() > cutoffTime;
    });
    await env.SIGNALS_CACHE.put(TRADES_KV_KEYS.TRADE_INDEX, JSON.stringify(activeIndex), {
      expirationTtl: 72 * 60 * 60
    });
    const newestTradeTime = Math.max(...newTrades.map((t) => t.timestamp * 1e3));
    await env.SIGNALS_CACHE.put(TRADES_KV_KEYS.LAST_POLL, String(newestTradeTime));
    const stats = {
      lastPoll: (/* @__PURE__ */ new Date()).toISOString(),
      tradesStored: newTrades.length,
      bucketsUpdated: bucketKeys.length,
      totalBuckets: activeIndex.length,
      pollDuration: Date.now() - startTime
    };
    await env.SIGNALS_CACHE.put(TRADES_KV_KEYS.POLL_STATS, JSON.stringify(stats));
    return {
      success: true,
      newTrades: newTrades.length,
      bucketsUpdated: bucketKeys.length,
      totalBuckets: activeIndex.length,
      duration: Date.now() - startTime
    };
  } catch (e) {
    console.error("Poll error:", e);
    return {
      success: false,
      error: e.message
    };
  }
}
__name(pollAndStoreTrades, "pollAndStoreTrades");
async function getAccumulatedTrades(env, hoursBack = 48) {
  if (!env.SIGNALS_CACHE) {
    return { trades: [], fromKV: false };
  }
  try {
    const index = await env.SIGNALS_CACHE.get(TRADES_KV_KEYS.TRADE_INDEX, { type: "json" }) || [];
    if (index.length === 0) {
      return { trades: [], fromKV: false, reason: "No accumulated trades yet" };
    }
    const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1e3;
    const allTrades = [];
    let bucketsRead = 0;
    for (const bucketKey of index) {
      const match = bucketKey.match(/trades_bucket_(\d{4})-(\d{2})-(\d{2})-(\d{2})/);
      if (!match) continue;
      const bucketDate = new Date(Date.UTC(
        parseInt(match[1]),
        parseInt(match[2]) - 1,
        parseInt(match[3]),
        parseInt(match[4])
      ));
      if (bucketDate.getTime() < cutoffTime - 60 * 60 * 1e3) continue;
      const bucketTrades = await env.SIGNALS_CACHE.get(bucketKey, { type: "json" });
      if (bucketTrades && Array.isArray(bucketTrades)) {
        const validTrades = bucketTrades.filter((t) => t.ts * 1e3 >= cutoffTime);
        allTrades.push(...validTrades);
        bucketsRead++;
      }
    }
    const formattedTrades = allTrades.map((t) => ({
      timestamp: t.ts,
      slug: t.slug,
      eventSlug: t.eventSlug,
      title: t.title,
      outcome: t.outcome,
      side: t.side,
      price: t.price,
      size: t.size,
      proxyWallet: t.proxyWallet,
      icon: t.icon
    }));
    formattedTrades.sort((a, b) => b.timestamp - a.timestamp);
    return {
      trades: formattedTrades,
      fromKV: true,
      bucketsRead,
      totalTrades: formattedTrades.length
    };
  } catch (e) {
    console.error("Error getting accumulated trades:", e);
    return { trades: [], fromKV: false, error: e.message };
  }
}
__name(getAccumulatedTrades, "getAccumulatedTrades");
async function getPollStats(env) {
  if (!env.SIGNALS_CACHE) {
    return null;
  }
  try {
    const stats = await env.SIGNALS_CACHE.get(TRADES_KV_KEYS.POLL_STATS, { type: "json" });
    const lastPoll = await env.SIGNALS_CACHE.get(TRADES_KV_KEYS.LAST_POLL);
    const index = await env.SIGNALS_CACHE.get(TRADES_KV_KEYS.TRADE_INDEX, { type: "json" }) || [];
    return {
      ...stats,
      lastPollTimestamp: lastPoll ? parseInt(lastPoll) : null,
      activeBuckets: index.length,
      bucketKeys: index.slice(-10)
      // Last 10 bucket keys for debugging
    };
  } catch (e) {
    return { error: e.message };
  }
}
__name(getPollStats, "getPollStats");
async function clearAccumulatedTrades(env) {
  if (!env.SIGNALS_CACHE) {
    return { success: false, error: "No KV storage" };
  }
  try {
    const index = await env.SIGNALS_CACHE.get(TRADES_KV_KEYS.TRADE_INDEX, { type: "json" }) || [];
    for (const key of index) {
      await env.SIGNALS_CACHE.delete(key);
    }
    await env.SIGNALS_CACHE.delete(TRADES_KV_KEYS.TRADE_INDEX);
    await env.SIGNALS_CACHE.delete(TRADES_KV_KEYS.LAST_POLL);
    await env.SIGNALS_CACHE.delete(TRADES_KV_KEYS.POLL_STATS);
    return {
      success: true,
      bucketsDeleted: index.length
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
__name(clearAccumulatedTrades, "clearAccumulatedTrades");

// src/betting-splits.js
var VSIN_BASE = "https://www.vsin.com";
var CACHE_DURATION2 = {
  SPLITS: 5 * 60
  // 5 minutes (matches VSiN update frequency)
};
var SPORT_PATHS = {
  nba: "/betting-splits/nba/",
  nfl: "/betting-splits/nfl/",
  ncaab: "/betting-splits/ncaab/",
  cbb: "/betting-splits/ncaab/",
  ncaaf: "/betting-splits/ncaaf/",
  cfb: "/betting-splits/ncaaf/",
  nhl: "/betting-splits/nhl/",
  mlb: "/betting-splits/mlb/"
};
async function getBettingSplits(env, sport) {
  const normalizedSport = sport.toLowerCase();
  const sportPath = SPORT_PATHS[normalizedSport];
  if (!sportPath) {
    return {
      success: false,
      error: `Sport '${sport}' not supported`,
      supportedSports: Object.keys(SPORT_PATHS)
    };
  }
  const cacheKey = `betting_splits_${normalizedSport}`;
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: "json" });
      if (cached && cached.data) {
        const age = Date.now() - cached.timestamp;
        if (age < CACHE_DURATION2.SPLITS * 1e3) {
          console.log(`Betting splits cache HIT for ${sport} (age: ${Math.round(age / 1e3)}s)`);
          return { ...cached.data, fromCache: true, cacheAge: Math.round(age / 1e3) };
        }
      }
    } catch (e) {
      console.error("Cache read error:", e.message);
    }
  }
  try {
    const splits = await scrapeVSiNPage(normalizedSport, sportPath);
    const result = {
      success: true,
      sport: normalizedSport,
      source: "vsin-draftkings",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      gamesCount: splits?.length || 0,
      games: splits || [],
      updateFrequency: "5 minutes"
    };
    if (env.SIGNALS_CACHE && splits && splits.length > 0) {
      try {
        await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
          data: result,
          timestamp: Date.now()
        }), { expirationTtl: CACHE_DURATION2.SPLITS + 60 });
      } catch (e) {
        console.error("Cache write error:", e.message);
      }
    }
    return result;
  } catch (e) {
    console.error("Betting splits fetch error:", e);
    return {
      success: false,
      error: e.message,
      sport: normalizedSport
    };
  }
}
__name(getBettingSplits, "getBettingSplits");
async function scrapeVSiNPage(sport, sportPath) {
  const url = `${VSIN_BASE}${sportPath}`;
  console.log(`Scraping VSiN: ${url}`);
  const response = await fetch(url, {
    headers: {
      "Accept": "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });
  if (!response.ok) {
    console.log(`VSiN returned ${response.status}`);
    return [];
  }
  const html = await response.text();
  return parseVSiNHTML(html, sport);
}
__name(scrapeVSiNPage, "scrapeVSiNPage");
function parseVSiNHTML(html, sport) {
  const games = [];
  try {
    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        if (data.bettingSplits || data.games) {
          return parseVSiNJSON(data, sport);
        }
      } catch (e) {
        console.log("Failed to parse embedded JSON:", e.message);
      }
    }
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        if (nextData.props?.pageProps?.games || nextData.props?.pageProps?.bettingSplits) {
          return parseNextJSData(nextData.props.pageProps, sport);
        }
      } catch (e) {
        console.log("Failed to parse Next.js data:", e.message);
      }
    }
    const tableGames = parseHTMLTable(html, sport);
    if (tableGames.length > 0) {
      return tableGames;
    }
    const cardGames = parseGameCards(html, sport);
    if (cardGames.length > 0) {
      return cardGames;
    }
    console.log("No betting splits data found in HTML");
    return [];
  } catch (e) {
    console.error("HTML parse error:", e.message);
    return [];
  }
}
__name(parseVSiNHTML, "parseVSiNHTML");
function parseVSiNJSON(data, sport) {
  const games = [];
  const gamesData = data.bettingSplits?.games || data.games || [];
  for (const game of gamesData) {
    games.push({
      gameId: game.id || game.gameId || `${game.awayTeam}-${game.homeTeam}`,
      homeTeam: game.homeTeam || game.home?.name,
      awayTeam: game.awayTeam || game.away?.name,
      gameTime: game.gameTime || game.startTime,
      spread: {
        home: {
          line: game.spread?.home?.line || game.homeSpread,
          betsPercent: game.spread?.home?.betsPercent || game.homeSpreadBets,
          handlePercent: game.spread?.home?.handlePercent || game.homeSpreadHandle
        },
        away: {
          line: game.spread?.away?.line || game.awaySpread,
          betsPercent: game.spread?.away?.betsPercent || game.awaySpreadBets,
          handlePercent: game.spread?.away?.handlePercent || game.awaySpreadHandle
        }
      },
      moneyline: {
        home: {
          betsPercent: game.moneyline?.home?.betsPercent || game.homeMLBets,
          handlePercent: game.moneyline?.home?.handlePercent || game.homeMLHandle
        },
        away: {
          betsPercent: game.moneyline?.away?.betsPercent || game.awayMLBets,
          handlePercent: game.moneyline?.away?.handlePercent || game.awayMLHandle
        }
      },
      total: {
        line: game.total?.line || game.totalLine,
        over: {
          betsPercent: game.total?.over?.betsPercent || game.overBets,
          handlePercent: game.total?.over?.handlePercent || game.overHandle
        },
        under: {
          betsPercent: game.total?.under?.betsPercent || game.underBets,
          handlePercent: game.total?.under?.handlePercent || game.underHandle
        }
      }
    });
  }
  return games;
}
__name(parseVSiNJSON, "parseVSiNJSON");
function parseNextJSData(pageProps, sport) {
  const games = [];
  const gamesData = pageProps.games || pageProps.bettingSplits || [];
  for (const game of gamesData) {
    games.push({
      gameId: game.id || `${game.away_team}-${game.home_team}`,
      homeTeam: game.home_team || game.homeTeam,
      awayTeam: game.away_team || game.awayTeam,
      gameTime: game.game_time || game.gameTime,
      spread: {
        home: {
          line: game.home_spread_line,
          betsPercent: game.home_spread_bets_pct,
          handlePercent: game.home_spread_handle_pct
        },
        away: {
          line: game.away_spread_line,
          betsPercent: game.away_spread_bets_pct,
          handlePercent: game.away_spread_handle_pct
        }
      },
      moneyline: {
        home: {
          betsPercent: game.home_ml_bets_pct,
          handlePercent: game.home_ml_handle_pct
        },
        away: {
          betsPercent: game.away_ml_bets_pct,
          handlePercent: game.away_ml_handle_pct
        }
      },
      total: {
        line: game.total_line,
        over: {
          betsPercent: game.over_bets_pct,
          handlePercent: game.over_handle_pct
        },
        under: {
          betsPercent: game.under_bets_pct,
          handlePercent: game.under_handle_pct
        }
      }
    });
  }
  return games;
}
__name(parseNextJSData, "parseNextJSData");
function parseHTMLTable(html, sport) {
  const games = [];
  const gameBlockRegex = /<tr[^>]*class="[^"]*game[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  const blocks = html.match(gameBlockRegex) || [];
  for (const block of blocks) {
    const game = parseGameBlock(block);
    if (game) {
      games.push(game);
    }
  }
  return games;
}
__name(parseHTMLTable, "parseHTMLTable");
function parseGameCards(html, sport) {
  const games = [];
  const percentPattern = /(\d{1,3})%/g;
  const teamPatterns = {
    nba: /(Lakers|Celtics|Warriors|Heat|Nets|Knicks|Bulls|Suns|Mavericks|Bucks|76ers|Clippers|Nuggets|Grizzlies|Cavaliers|Hawks|Hornets|Pacers|Magic|Pistons|Raptors|Wizards|Rockets|Spurs|Thunder|Timberwolves|Pelicans|Kings|Blazers|Jazz)/gi,
    nfl: /(Chiefs|Bills|Eagles|49ers|Cowboys|Dolphins|Lions|Ravens|Bengals|Jaguars|Chargers|Jets|Patriots|Broncos|Raiders|Steelers|Browns|Colts|Titans|Texans|Vikings|Packers|Bears|Saints|Buccaneers|Falcons|Panthers|Commanders|Giants|Cardinals|Rams|Seahawks)/gi,
    nhl: /(Bruins|Panthers|Hurricanes|Devils|Rangers|Maple Leafs|Lightning|Islanders|Capitals|Penguins|Senators|Red Wings|Sabres|Flyers|Blue Jackets|Oilers|Stars|Jets|Avalanche|Wild|Blues|Predators|Knights|Kings|Flames|Canucks|Kraken|Sharks|Coyotes|Ducks|Blackhawks)/gi
  };
  return games;
}
__name(parseGameCards, "parseGameCards");
function parseGameBlock(blockHtml) {
  const teamMatch = blockHtml.match(/>([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)</g);
  if (!teamMatch || teamMatch.length < 2) return null;
  const percentages = [];
  const percentMatch = blockHtml.match(/(\d{1,3})%/g);
  if (percentMatch) {
    for (const p of percentMatch) {
      percentages.push(parseInt(p));
    }
  }
  if (percentages.length < 4) return null;
  const teams = teamMatch.map((t) => t.replace(/[><]/g, "").trim());
  return {
    gameId: `${teams[0]}-${teams[1]}`,
    awayTeam: teams[0],
    homeTeam: teams[1],
    spread: {
      away: {
        betsPercent: percentages[0],
        handlePercent: percentages[1]
      },
      home: {
        betsPercent: percentages[2] || 100 - percentages[0],
        handlePercent: percentages[3] || 100 - percentages[1]
      }
    }
  };
}
__name(parseGameBlock, "parseGameBlock");
function analyzeSharpMoney(games) {
  const sharpGames = [];
  for (const game of games) {
    const sharpSignals = [];
    if (game.spread) {
      const homeSpreadDiff = (game.spread.home?.handlePercent || 0) - (game.spread.home?.betsPercent || 0);
      const awaySpreadDiff = (game.spread.away?.handlePercent || 0) - (game.spread.away?.betsPercent || 0);
      if (Math.abs(homeSpreadDiff) >= 15) {
        sharpSignals.push({
          market: "spread",
          side: homeSpreadDiff > 0 ? "home" : "away",
          team: homeSpreadDiff > 0 ? game.homeTeam : game.awayTeam,
          divergence: Math.abs(homeSpreadDiff),
          betsPercent: homeSpreadDiff > 0 ? game.spread.home?.betsPercent : game.spread.away?.betsPercent,
          handlePercent: homeSpreadDiff > 0 ? game.spread.home?.handlePercent : game.spread.away?.handlePercent,
          strength: Math.abs(homeSpreadDiff) >= 25 ? "strong" : "moderate"
        });
      }
    }
    if (game.moneyline) {
      const homeMLDiff = (game.moneyline.home?.handlePercent || 0) - (game.moneyline.home?.betsPercent || 0);
      if (Math.abs(homeMLDiff) >= 15) {
        sharpSignals.push({
          market: "moneyline",
          side: homeMLDiff > 0 ? "home" : "away",
          team: homeMLDiff > 0 ? game.homeTeam : game.awayTeam,
          divergence: Math.abs(homeMLDiff),
          betsPercent: homeMLDiff > 0 ? game.moneyline.home?.betsPercent : game.moneyline.away?.betsPercent,
          handlePercent: homeMLDiff > 0 ? game.moneyline.home?.handlePercent : game.moneyline.away?.handlePercent,
          strength: Math.abs(homeMLDiff) >= 25 ? "strong" : "moderate"
        });
      }
    }
    if (game.total) {
      const overDiff = (game.total.over?.handlePercent || 0) - (game.total.over?.betsPercent || 0);
      if (Math.abs(overDiff) >= 15) {
        sharpSignals.push({
          market: "total",
          side: overDiff > 0 ? "over" : "under",
          divergence: Math.abs(overDiff),
          line: game.total.line,
          betsPercent: overDiff > 0 ? game.total.over?.betsPercent : game.total.under?.betsPercent,
          handlePercent: overDiff > 0 ? game.total.over?.handlePercent : game.total.under?.handlePercent,
          strength: Math.abs(overDiff) >= 25 ? "strong" : "moderate"
        });
      }
    }
    if (sharpSignals.length > 0) {
      sharpGames.push({
        gameId: game.gameId,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        gameTime: game.gameTime,
        sharpSignals,
        strongestSignal: sharpSignals.reduce((a, b) => a.divergence > b.divergence ? a : b)
      });
    }
  }
  sharpGames.sort((a, b) => b.strongestSignal.divergence - a.strongestSignal.divergence);
  return sharpGames;
}
__name(analyzeSharpMoney, "analyzeSharpMoney");

// src/sharp-lines.js
var CACHE_DURATION3 = {
  ODDS: 5 * 60,
  // 5 minutes for odds comparison
  HISTORY: 60 * 60
  // 1 hour for line history
};
var BOOK_TIERS = {
  sharp: ["pinnacle", "circa", "bookmaker", "betcris", "betonline"],
  soft: ["draftkings", "fanduel", "betmgm", "caesars", "pointsbet", "wynnbet", "espnbet", "fanatics"]
};
async function getSharpLineComparison(env, sport) {
  const sportKey = SPORT_KEY_MAP[sport];
  if (!sportKey) {
    return { success: false, error: `Sport '${sport}' not supported` };
  }
  if (!env.ODDS_API_KEY) {
    return { success: false, error: "ODDS_API_KEY not configured" };
  }
  const cacheKey = `sharp_lines_${sport}`;
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: "json" });
      if (cached && cached.data) {
        const age = Date.now() - cached.timestamp;
        if (age < CACHE_DURATION3.ODDS * 1e3) {
          return { ...cached.data, fromCache: true, cacheAge: Math.round(age / 1e3) };
        }
      }
    } catch (e) {
    }
  }
  try {
    const url = `${ODDS_API_BASE}/sports/${sportKey}/odds/?apiKey=${env.ODDS_API_KEY}&regions=us,eu&markets=h2h,spreads,totals&oddsFormat=american&bookmakers=pinnacle,draftkings,fanduel,betmgm,caesars,betonline`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Odds API error: ${response.status}`, details: errorText };
    }
    const games = await response.json();
    const processedGames = games.map((game) => processGameForSharpLines(game));
    processedGames.sort((a, b) => (b.maxEdge || 0) - (a.maxEdge || 0));
    const result = {
      success: true,
      sport,
      sportKey,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      gamesCount: processedGames.length,
      gamesWithEdge: processedGames.filter((g) => g.maxEdge >= 2).length,
      games: processedGames
    };
    if (env.SIGNALS_CACHE) {
      try {
        await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
          data: result,
          timestamp: Date.now()
        }), { expirationTtl: CACHE_DURATION3.ODDS + 60 });
      } catch (e) {
      }
    }
    return result;
  } catch (e) {
    console.error("Sharp lines fetch error:", e);
    return { success: false, error: e.message };
  }
}
__name(getSharpLineComparison, "getSharpLineComparison");
function processGameForSharpLines(game) {
  const result = {
    id: game.id,
    homeTeam: game.home_team,
    awayTeam: game.away_team,
    commenceTime: game.commence_time,
    pinnacle: null,
    consensus: null,
    edges: [],
    maxEdge: 0
  };
  if (!game.bookmakers || game.bookmakers.length === 0) {
    return result;
  }
  const pinnacle = game.bookmakers.find((b) => b.key === "pinnacle");
  const softBooks = game.bookmakers.filter(
    (b) => BOOK_TIERS.soft.includes(b.key)
  );
  if (!pinnacle && softBooks.length === 0) {
    return result;
  }
  const markets = ["h2h", "spreads", "totals"];
  for (const marketKey of markets) {
    const pinnacleMarket = pinnacle?.markets?.find((m) => m.key === marketKey);
    for (const softBook of softBooks) {
      const softMarket = softBook.markets?.find((m) => m.key === marketKey);
      if (!softMarket) continue;
      for (const softOutcome of softMarket.outcomes) {
        const pinnacleOutcome = pinnacleMarket?.outcomes?.find((o) => o.name === softOutcome.name);
        if (pinnacleOutcome) {
          const edge = calculateEdge(softOutcome.price, pinnacleOutcome.price);
          if (Math.abs(edge) >= 2) {
            const edgeInfo = {
              market: marketKey,
              book: softBook.key,
              outcome: softOutcome.name,
              softOdds: softOutcome.price,
              pinnacleOdds: pinnacleOutcome.price,
              edge,
              betOn: edge > 0 ? "soft" : "pinnacle",
              point: softOutcome.point || null,
              pinnaclePoint: pinnacleOutcome.point || null
            };
            result.edges.push(edgeInfo);
            result.maxEdge = Math.max(result.maxEdge, Math.abs(edge));
          }
        }
      }
    }
    if (pinnacleMarket) {
      result.pinnacle = result.pinnacle || {};
      result.pinnacle[marketKey] = {
        outcomes: pinnacleMarket.outcomes.map((o) => ({
          name: o.name,
          price: o.price,
          point: o.point,
          impliedProb: americanToProb2(o.price)
        }))
      };
    }
  }
  result.consensus = calculateConsensus(game.bookmakers, softBooks);
  return result;
}
__name(processGameForSharpLines, "processGameForSharpLines");
function calculateEdge(softOdds, pinnacleOdds) {
  const softProb = americanToProb2(softOdds);
  const pinnacleProb = americanToProb2(pinnacleOdds);
  return Math.round((pinnacleProb - softProb) * 100 * 10) / 10;
}
__name(calculateEdge, "calculateEdge");
function americanToProb2(odds) {
  if (odds >= 100) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}
__name(americanToProb2, "americanToProb");
function calculateConsensus(allBooks, softBooks) {
  const consensus = {};
  const markets = ["h2h", "spreads", "totals"];
  for (const marketKey of markets) {
    const outcomeOdds = {};
    for (const book of softBooks) {
      const market = book.markets?.find((m) => m.key === marketKey);
      if (!market) continue;
      for (const outcome of market.outcomes) {
        if (!outcomeOdds[outcome.name]) {
          outcomeOdds[outcome.name] = [];
        }
        outcomeOdds[outcome.name].push({
          odds: outcome.price,
          point: outcome.point,
          book: book.key
        });
      }
    }
    consensus[marketKey] = {};
    for (const [name, oddsArray] of Object.entries(outcomeOdds)) {
      const avgOdds = Math.round(oddsArray.reduce((sum, o) => sum + o.odds, 0) / oddsArray.length);
      const avgPoint = oddsArray[0]?.point !== void 0 ? Math.round(oddsArray.reduce((sum, o) => sum + (o.point || 0), 0) / oddsArray.length * 10) / 10 : null;
      consensus[marketKey][name] = {
        avgOdds,
        avgPoint,
        impliedProb: Math.round(americanToProb2(avgOdds) * 100),
        books: oddsArray.length
      };
    }
  }
  return consensus;
}
__name(calculateConsensus, "calculateConsensus");
async function trackLineMovement(env, gameId, currentOdds) {
  if (!env.SIGNALS_CACHE) return null;
  const key = `line_movement_${gameId}`;
  try {
    const existing = await env.SIGNALS_CACHE.get(key, { type: "json" }) || { history: [] };
    existing.history.push({
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      odds: currentOdds
    });
    const cutoff = Date.now() - 24 * 60 * 60 * 1e3;
    existing.history = existing.history.filter(
      (h) => new Date(h.timestamp).getTime() > cutoff
    );
    await env.SIGNALS_CACHE.put(key, JSON.stringify(existing), {
      expirationTtl: 24 * 60 * 60 + 3600
      // 25 hours
    });
    return existing;
  } catch (e) {
    console.error("Line tracking error:", e.message);
    return null;
  }
}
__name(trackLineMovement, "trackLineMovement");
async function getLineMovement(env, gameId) {
  if (!env.SIGNALS_CACHE) return null;
  const key = `line_movement_${gameId}`;
  try {
    const data = await env.SIGNALS_CACHE.get(key, { type: "json" });
    if (!data || !data.history || data.history.length < 2) {
      return null;
    }
    const first = data.history[0];
    const last = data.history[data.history.length - 1];
    return {
      gameId,
      snapshots: data.history.length,
      firstSeen: first.timestamp,
      lastUpdate: last.timestamp,
      opening: first.odds,
      current: last.odds,
      movement: calculateMovement(first.odds, last.odds),
      history: data.history
    };
  } catch (e) {
    console.error("Get line movement error:", e.message);
    return null;
  }
}
__name(getLineMovement, "getLineMovement");
function calculateMovement(opening, current) {
  const movement = {
    spread: null,
    total: null,
    moneyline: null
  };
  if (opening?.spread?.home?.point && current?.spread?.home?.point) {
    movement.spread = {
      homeOpen: opening.spread.home.point,
      homeCurrent: current.spread.home.point,
      change: current.spread.home.point - opening.spread.home.point,
      direction: current.spread.home.point > opening.spread.home.point ? "away" : "home"
    };
  }
  if (opening?.total?.over?.point && current?.total?.over?.point) {
    movement.total = {
      open: opening.total.over.point,
      current: current.total.over.point,
      change: current.total.over.point - opening.total.over.point,
      direction: current.total.over.point > opening.total.over.point ? "up" : "down"
    };
  }
  if (opening?.moneyline?.home?.price && current?.moneyline?.home?.price) {
    const openProb = americanToProb2(opening.moneyline.home.price);
    const currentProb = americanToProb2(current.moneyline.home.price);
    movement.moneyline = {
      homeOpen: opening.moneyline.home.price,
      homeCurrent: current.moneyline.home.price,
      probChange: Math.round((currentProb - openProb) * 100),
      direction: currentProb > openProb ? "home" : "away"
    };
  }
  return movement;
}
__name(calculateMovement, "calculateMovement");
function detectSteamMove(lineHistory) {
  if (!lineHistory || !lineHistory.history || lineHistory.history.length < 3) {
    return null;
  }
  const steamMoves = [];
  for (let i = 1; i < lineHistory.history.length; i++) {
    const prev = lineHistory.history[i - 1];
    const curr = lineHistory.history[i];
    const timeDiff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
    const minutesDiff = timeDiff / 6e4;
    if (minutesDiff <= 15) {
      const movement = calculateMovement(prev.odds, curr.odds);
      if (movement.spread && Math.abs(movement.spread.change) >= 0.5) {
        steamMoves.push({
          type: "spread",
          timestamp: curr.timestamp,
          minutesElapsed: Math.round(minutesDiff),
          change: movement.spread.change,
          direction: movement.spread.direction,
          isSteam: minutesDiff <= 5 && Math.abs(movement.spread.change) >= 1
        });
      }
      if (movement.total && Math.abs(movement.total.change) >= 1) {
        steamMoves.push({
          type: "total",
          timestamp: curr.timestamp,
          minutesElapsed: Math.round(minutesDiff),
          change: movement.total.change,
          direction: movement.total.direction,
          isSteam: minutesDiff <= 5 && Math.abs(movement.total.change) >= 1.5
        });
      }
      if (movement.moneyline && Math.abs(movement.moneyline.probChange) >= 3) {
        steamMoves.push({
          type: "moneyline",
          timestamp: curr.timestamp,
          minutesElapsed: Math.round(minutesDiff),
          probChange: movement.moneyline.probChange,
          direction: movement.moneyline.direction,
          isSteam: minutesDiff <= 5 && Math.abs(movement.moneyline.probChange) >= 5
        });
      }
    }
  }
  const steamCount = steamMoves.filter((m) => m.isSteam).length;
  return {
    detected: steamCount > 0,
    steamMoves: steamMoves.filter((m) => m.isSteam),
    allMoves: steamMoves,
    steamCount,
    totalMoves: steamMoves.length
  };
}
__name(detectSteamMove, "detectSteamMove");
function calculateCLV(entryOdds, closingOdds) {
  const entryProb = americanToProb2(entryOdds);
  const closingProb = americanToProb2(closingOdds);
  const clv = Math.round((closingProb - entryProb) * 100 * 10) / 10;
  return {
    entryOdds,
    closingOdds,
    entryProb: Math.round(entryProb * 100),
    closingProb: Math.round(closingProb * 100),
    clv,
    beatClosing: clv > 0,
    description: clv > 0 ? `Beat closing line by ${clv}% (good +EV indicator)` : `Missed closing line by ${Math.abs(clv)}%`
  };
}
__name(calculateCLV, "calculateCLV");

// src/edge-detector.js
var EDGE_WEIGHTS = {
  // Sharp money signals (from betting splits)
  SHARP_MONEY_STRONG: 30,
  SHARP_MONEY_MODERATE: 15,
  // Reverse line movement
  RLM_STRONG: 25,
  RLM_MODERATE: 12,
  // Pinnacle vs soft book divergence
  PINNACLE_EDGE_LARGE: 20,
  // 5%+ edge
  PINNACLE_EDGE_MEDIUM: 10,
  // 3-5% edge
  PINNACLE_EDGE_SMALL: 5,
  // 2-3% edge
  // Steam moves
  STEAM_MOVE: 35,
  RAPID_LINE_MOVE: 15,
  // Polymarket divergence from Vegas
  POLY_EDGE_HUGE: 25,
  // 10%+ difference
  POLY_EDGE_LARGE: 15,
  // 5-10% difference
  POLY_EDGE_MEDIUM: 8,
  // 3-5% difference
  // Multiple signal confirmation
  MULTI_SIGNAL_BONUS: 20,
  // When 3+ signals agree
  DUAL_SIGNAL_BONUS: 10
  // When 2 signals agree
};
var CONFIDENCE_LEVELS = {
  HIGH: 70,
  // Strong recommendation
  MEDIUM: 50,
  // Worth considering
  LOW: 30,
  // Monitor
  NOISE: 0
  // Below threshold
};
async function runEdgeDetection(env, sport) {
  const startTime = Date.now();
  try {
    console.log(`Starting edge detection for ${sport}...`);
    const [
      vegasPolyComparison,
      sharpLines,
      bettingSplits
    ] = await Promise.all([
      getOddsComparison(env, sport).catch((e) => ({ success: false, error: e.message })),
      getSharpLineComparison(env, sport).catch((e) => ({ success: false, error: e.message })),
      getBettingSplits(env, sport).catch((e) => ({ success: false, error: e.message }))
    ]);
    console.log(`Data fetched: Vegas/Poly=${vegasPolyComparison.success}, Sharp=${sharpLines.success}, Splits=${bettingSplits.success}`);
    const games = buildUnifiedGameList(
      vegasPolyComparison.games || [],
      sharpLines.games || [],
      bettingSplits.games || []
    );
    const sharpMoneyGames = bettingSplits.success ? analyzeSharpMoney(bettingSplits.games || []) : [];
    const edgeGames = games.map(
      (game) => calculateEdgeScore(game, sharpMoneyGames, sharpLines.games || [])
    );
    edgeGames.sort((a, b) => b.edgeScore - a.edgeScore);
    const topEdges = edgeGames.filter((g) => g.edgeScore >= CONFIDENCE_LEVELS.MEDIUM).slice(0, 10);
    const summary = generateSummary(edgeGames, topEdges);
    return {
      success: true,
      sport,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      processingTime: Date.now() - startTime,
      dataSources: {
        vegasPolymarket: vegasPolyComparison.success,
        sharpLines: sharpLines.success,
        bettingSplits: bettingSplits.success
      },
      summary,
      topEdges,
      allGames: edgeGames.map((g) => ({
        ...g,
        // Remove verbose nested data for cleaner response
        sharpLinesDetail: void 0,
        bettingSplitsDetail: void 0
      }))
    };
  } catch (e) {
    console.error("Edge detection error:", e);
    return {
      success: false,
      error: e.message,
      processingTime: Date.now() - startTime
    };
  }
}
__name(runEdgeDetection, "runEdgeDetection");
function buildUnifiedGameList(vegasGames, sharpGames, splitsGames) {
  const gamesMap = /* @__PURE__ */ new Map();
  for (const game of vegasGames) {
    const key = createGameKey(game.homeTeam, game.awayTeam);
    gamesMap.set(key, {
      ...game,
      sources: ["vegas", "polymarket"]
    });
  }
  for (const game of sharpGames) {
    const key = createGameKey(game.homeTeam, game.awayTeam);
    if (gamesMap.has(key)) {
      const existing = gamesMap.get(key);
      existing.sharpLinesDetail = game;
      existing.sources.push("sharp");
    } else {
      gamesMap.set(key, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        commenceTime: game.commenceTime,
        sharpLinesDetail: game,
        sources: ["sharp"]
      });
    }
  }
  for (const game of splitsGames) {
    const key = createGameKey(game.homeTeam, game.awayTeam);
    if (gamesMap.has(key)) {
      const existing = gamesMap.get(key);
      existing.bettingSplitsDetail = game;
      existing.sources.push("splits");
    } else {
      gamesMap.set(key, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        bettingSplitsDetail: game,
        sources: ["splits"]
      });
    }
  }
  return Array.from(gamesMap.values());
}
__name(buildUnifiedGameList, "buildUnifiedGameList");
function createGameKey(home, away) {
  const normalize = /* @__PURE__ */ __name((name) => name?.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(university|college|state|tech)/g, "").trim() || "", "normalize");
  return `${normalize(away)}-${normalize(home)}`;
}
__name(createGameKey, "createGameKey");
function calculateEdgeScore(game, sharpMoneyGames, sharpLinesGames) {
  const signals = [];
  let totalScore = 0;
  let sharpSide = null;
  let confidence = "low";
  if (game.edge) {
    const homeEdge = game.edge.home || 0;
    const awayEdge = game.edge.away || 0;
    const maxPolyEdge = Math.max(Math.abs(homeEdge), Math.abs(awayEdge));
    if (maxPolyEdge >= 10) {
      totalScore += EDGE_WEIGHTS.POLY_EDGE_HUGE;
      signals.push({
        type: "polymarket_divergence",
        strength: "huge",
        edge: maxPolyEdge,
        side: homeEdge > awayEdge ? game.homeTeam : game.awayTeam
      });
      sharpSide = sharpSide || (homeEdge > awayEdge ? "home" : "away");
    } else if (maxPolyEdge >= 5) {
      totalScore += EDGE_WEIGHTS.POLY_EDGE_LARGE;
      signals.push({
        type: "polymarket_divergence",
        strength: "large",
        edge: maxPolyEdge,
        side: homeEdge > awayEdge ? game.homeTeam : game.awayTeam
      });
      sharpSide = sharpSide || (homeEdge > awayEdge ? "home" : "away");
    } else if (maxPolyEdge >= 3) {
      totalScore += EDGE_WEIGHTS.POLY_EDGE_MEDIUM;
      signals.push({
        type: "polymarket_divergence",
        strength: "medium",
        edge: maxPolyEdge
      });
    }
  }
  const sharpGame = sharpMoneyGames.find(
    (g) => createGameKey(g.homeTeam, g.awayTeam) === createGameKey(game.homeTeam, game.awayTeam)
  );
  if (sharpGame && sharpGame.sharpSignals) {
    for (const signal of sharpGame.sharpSignals) {
      if (signal.isStrong) {
        totalScore += EDGE_WEIGHTS.SHARP_MONEY_STRONG;
        signals.push({
          type: "sharp_money",
          strength: "strong",
          market: signal.type,
          sharpSide: signal.sharpSide,
          divergence: signal.sharpStrength
        });
        sharpSide = sharpSide || (signal.sharpSide === game.homeTeam ? "home" : "away");
      } else {
        totalScore += EDGE_WEIGHTS.SHARP_MONEY_MODERATE;
        signals.push({
          type: "sharp_money",
          strength: "moderate",
          market: signal.type,
          sharpSide: signal.sharpSide,
          divergence: signal.sharpStrength
        });
      }
    }
  }
  if (game.sharpLinesDetail && game.sharpLinesDetail.edges) {
    const pinnacleEdges = game.sharpLinesDetail.edges;
    const maxPinEdge = Math.max(...pinnacleEdges.map((e) => Math.abs(e.edge)), 0);
    if (maxPinEdge >= 5) {
      totalScore += EDGE_WEIGHTS.PINNACLE_EDGE_LARGE;
      const bestEdge = pinnacleEdges.find((e) => Math.abs(e.edge) === maxPinEdge);
      signals.push({
        type: "pinnacle_divergence",
        strength: "large",
        edge: maxPinEdge,
        market: bestEdge?.market,
        outcome: bestEdge?.outcome,
        book: bestEdge?.book
      });
    } else if (maxPinEdge >= 3) {
      totalScore += EDGE_WEIGHTS.PINNACLE_EDGE_MEDIUM;
      signals.push({
        type: "pinnacle_divergence",
        strength: "medium",
        edge: maxPinEdge
      });
    } else if (maxPinEdge >= 2) {
      totalScore += EDGE_WEIGHTS.PINNACLE_EDGE_SMALL;
      signals.push({
        type: "pinnacle_divergence",
        strength: "small",
        edge: maxPinEdge
      });
    }
  }
  const uniqueSignalTypes = new Set(signals.map((s) => s.type));
  if (uniqueSignalTypes.size >= 3) {
    totalScore += EDGE_WEIGHTS.MULTI_SIGNAL_BONUS;
    signals.push({
      type: "confirmation",
      strength: "triple",
      description: "3+ independent signals agree"
    });
    confidence = "high";
  } else if (uniqueSignalTypes.size >= 2) {
    totalScore += EDGE_WEIGHTS.DUAL_SIGNAL_BONUS;
    signals.push({
      type: "confirmation",
      strength: "dual",
      description: "2 independent signals agree"
    });
    confidence = "medium";
  }
  if (totalScore >= CONFIDENCE_LEVELS.HIGH) {
    confidence = "high";
  } else if (totalScore >= CONFIDENCE_LEVELS.MEDIUM) {
    confidence = "medium";
  } else if (totalScore >= CONFIDENCE_LEVELS.LOW) {
    confidence = "low";
  }
  const recommendation = generateRecommendation(game, signals, sharpSide, confidence);
  return {
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    commenceTime: game.commenceTime,
    edgeScore: Math.min(100, Math.round(totalScore)),
    confidence,
    signalCount: signals.length,
    signals,
    sharpSide,
    recommendation,
    vegas: game.vegas,
    polymarket: game.polymarket,
    edge: game.edge
  };
}
__name(calculateEdgeScore, "calculateEdgeScore");
function generateRecommendation(game, signals, sharpSide, confidence) {
  if (signals.length === 0) {
    return {
      action: "PASS",
      summary: "No significant edges detected",
      details: null
    };
  }
  const sharpTeam = sharpSide === "home" ? game.homeTeam : sharpSide === "away" ? game.awayTeam : null;
  const hasPolyEdge = signals.some((s) => s.type === "polymarket_divergence");
  const hasSharpMoney = signals.some((s) => s.type === "sharp_money");
  const hasPinnacleEdge = signals.some((s) => s.type === "pinnacle_divergence");
  const hasConfirmation = signals.some((s) => s.type === "confirmation");
  let action = "MONITOR";
  let summary = "";
  const details = [];
  if (confidence === "high") {
    action = "STRONG";
    summary = `Strong edge on ${sharpTeam || "undetermined side"}`;
  } else if (confidence === "medium") {
    action = "CONSIDER";
    summary = `Moderate edge detected`;
  } else {
    summary = "Minor edge signals";
  }
  if (hasPolyEdge) {
    const polySignal = signals.find((s) => s.type === "polymarket_divergence");
    details.push(`Polymarket ${polySignal.strength} divergence (${polySignal.edge}% vs Vegas)`);
  }
  if (hasSharpMoney) {
    const sharpSignal = signals.find((s) => s.type === "sharp_money");
    details.push(`Sharp money on ${sharpSignal.sharpSide} (${sharpSignal.divergence}% handle vs bets divergence)`);
  }
  if (hasPinnacleEdge) {
    const pinSignal = signals.find((s) => s.type === "pinnacle_divergence");
    details.push(`Pinnacle edge: ${pinSignal.edge}% vs soft books on ${pinSignal.market}`);
  }
  if (hasConfirmation) {
    const confSignal = signals.find((s) => s.type === "confirmation");
    details.push(confSignal.description);
  }
  return {
    action,
    summary,
    betSide: sharpTeam,
    details
  };
}
__name(generateRecommendation, "generateRecommendation");
function generateSummary(allGames, topEdges) {
  return {
    totalGames: allGames.length,
    gamesWithEdge: allGames.filter((g) => g.edgeScore >= CONFIDENCE_LEVELS.LOW).length,
    highConfidence: allGames.filter((g) => g.confidence === "high").length,
    mediumConfidence: allGames.filter((g) => g.confidence === "medium").length,
    topOpportunities: topEdges.map((g) => ({
      game: `${g.awayTeam} @ ${g.homeTeam}`,
      score: g.edgeScore,
      confidence: g.confidence,
      recommendation: g.recommendation.summary
    }))
  };
}
__name(generateSummary, "generateSummary");
async function quickEdgeCheck(env, sport) {
  const cacheKey = `edge_detection_${sport}`;
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: "json" });
      if (cached && cached.data) {
        const age = Date.now() - cached.timestamp;
        if (age < 10 * 60 * 1e3) {
          return { ...cached.data, fromCache: true };
        }
      }
    } catch (e) {
    }
  }
  const result = await runEdgeDetection(env, sport);
  if (env.SIGNALS_CACHE && result.success) {
    try {
      await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
        data: result,
        timestamp: Date.now()
      }), { expirationTtl: 660 });
    } catch (e) {
    }
  }
  return result;
}
__name(quickEdgeCheck, "quickEdgeCheck");

// src/index.js
var src_default = {
  // Scheduled cron handler - runs every minute to accumulate trades
  async scheduled(event, env, ctx) {
    console.log("Cron triggered:", event.cron);
    try {
      const pollResult = await pollAndStoreTrades(env);
      console.log("Trade poll result:", pollResult);
      let settlementResults = null;
      const lastSettlement = await env.SIGNALS_CACHE?.get("last_settlement_run");
      const lastSettlementTime = lastSettlement ? new Date(lastSettlement).getTime() : 0;
      const minutesSinceSettlement = (Date.now() - lastSettlementTime) / 6e4;
      if (minutesSinceSettlement > 10) {
        settlementResults = await processSettledSignals(env);
        console.log("Settlement results:", settlementResults);
        await env.SIGNALS_CACHE?.put("last_settlement_run", (/* @__PURE__ */ new Date()).toISOString());
      }
      if (env.SIGNALS_CACHE) {
        try {
          await env.SIGNALS_CACHE.put(KV_KEYS.LAST_CRON_RUN, (/* @__PURE__ */ new Date()).toISOString());
          await env.SIGNALS_CACHE.put(KV_KEYS.CRON_STATS, JSON.stringify({
            lastRun: (/* @__PURE__ */ new Date()).toISOString(),
            tradePoll: pollResult,
            settlement: settlementResults
          }));
        } catch (e) {
          console.log("KV write failed (quota?):", e.message);
        }
      }
    } catch (e) {
      console.error("Cron error:", e.message);
    }
  },
  // HTTP request handler
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    try {
      if (path === "/scan" || path === "/api/scan") {
        const hours = parseInt(url.searchParams.get("hours") || "48");
        const minScore = parseInt(url.searchParams.get("minScore") || "40");
        const sportsOnly = url.searchParams.get("sportsOnly") === "true" || url.searchParams.get("sports") === "true";
        const debug = url.searchParams.get("debug") === "true";
        const result = await runScan(hours, minScore, env, {
          sportsOnly,
          includeDebug: debug
        });
        return jsonResponse(result);
      }
      if (path === "/scan/sports" || path === "/sports/scan") {
        const hours = parseInt(url.searchParams.get("hours") || "48");
        const minScore = parseInt(url.searchParams.get("minScore") || "40");
        const debug = url.searchParams.get("debug") === "true";
        const result = await runScan(hours, minScore, env, {
          sportsOnly: true,
          includeDebug: debug
        });
        return jsonResponse({
          ...result,
          signals: result.sportsSignals || result.signals?.slice(0, 15) || [],
          allSportsSignals: result.signals,
          topSportsCount: (result.sportsSignals || []).length
        });
      }
      if (path === "/scan/sports/top15" || path === "/sports/top15") {
        const result = await runScan(48, 30, env, { sportsOnly: true });
        const topSignals = (result.sportsSignals || result.signals || []).filter((s) => s.hasWinningWallet || s.confidence >= 65).slice(0, 15);
        return jsonResponse({
          success: true,
          signals: topSignals,
          totalSportsSignals: (result.signals || []).length,
          signalsWithWinners: topSignals.filter((s) => s.hasWinningWallet).length,
          avgConfidence: topSignals.length > 0 ? Math.round(topSignals.reduce((sum, s) => sum + s.confidence, 0) / topSignals.length) : 0
        });
      }
      if (path === "/signals/recent") {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const signals = await getRecentSignals(env, limit);
        return jsonResponse({ success: true, signals });
      }
      if (path.startsWith("/signal/")) {
        const signalId = path.split("/")[2];
        const signal = await getSignal(env, signalId);
        return jsonResponse({ success: !!signal, signal });
      }
      if (path === "/edge/detect" || path.match(/^\/edge\/detect\/[a-z]+$/i)) {
        const sport = path.split("/")[3] || url.searchParams.get("sport") || "nba";
        const result = await runEdgeDetection(env, sport);
        return jsonResponse(result);
      }
      if (path === "/edge/quick" || path.match(/^\/edge\/quick\/[a-z]+$/i)) {
        const sport = path.split("/")[3] || url.searchParams.get("sport") || "nba";
        const result = await quickEdgeCheck(env, sport);
        return jsonResponse(result);
      }
      if (path === "/edge/splits" || path.match(/^\/edge\/splits\/[a-z]+$/i)) {
        const sport = path.split("/")[3] || url.searchParams.get("sport") || "nba";
        const result = await getBettingSplits(env, sport);
        if (url.searchParams.get("analyze") === "true" && result.success) {
          const analysis = analyzeSharpMoney(result.games || []);
          return jsonResponse({
            ...result,
            sharpMoneyGames: analysis,
            sharpGamesCount: analysis.length
          });
        }
        return jsonResponse(result);
      }
      if (path === "/edge/sharp" || path.match(/^\/edge\/sharp\/[a-z]+$/i)) {
        const sport = path.split("/")[3] || url.searchParams.get("sport") || "nba";
        const result = await getSharpLineComparison(env, sport);
        return jsonResponse(result);
      }
      if (path.startsWith("/edge/movement/")) {
        const gameId = path.split("/")[3];
        if (request.method === "POST") {
          const body = await request.json();
          const result = await trackLineMovement(env, gameId, body.odds);
          return jsonResponse({ success: true, result });
        } else {
          const history = await getLineMovement(env, gameId);
          if (history) {
            const steamMoves = detectSteamMove(history);
            return jsonResponse({
              success: true,
              ...history,
              steamAnalysis: steamMoves
            });
          }
          return jsonResponse({ success: false, error: "No line history for game" });
        }
      }
      if (path === "/edge/clv") {
        const entryOdds = parseFloat(url.searchParams.get("entry"));
        const closingOdds = parseFloat(url.searchParams.get("closing"));
        if (isNaN(entryOdds) || isNaN(closingOdds)) {
          return jsonResponse({
            success: false,
            error: "Provide entry and closing odds as query params (American format)",
            example: "/edge/clv?entry=-110&closing=-125"
          }, 400);
        }
        const clv = calculateCLV(entryOdds, closingOdds);
        return jsonResponse({ success: true, ...clv });
      }
      if (path === "/polymarket/sports" || path.match(/^\/polymarket\/sports\/[a-z]+$/i)) {
        const sport = path.split("/")[3] || url.searchParams.get("sport") || "nba";
        const result = await getSportsMarketsWithPrices(env, sport);
        return jsonResponse(result);
      }
      if (path === "/polymarket/markets") {
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const tag_slug = url.searchParams.get("tag") || url.searchParams.get("tag_slug");
        const active = url.searchParams.get("active") !== "false";
        const closed = url.searchParams.get("closed") === "true";
        const result = await getMarkets(env, { limit, offset, tag_slug, active, closed });
        return jsonResponse(result);
      }
      if (path.startsWith("/polymarket/market/")) {
        const slug = path.split("/").slice(3).join("/");
        const result = await getMarketBySlug(env, slug);
        return jsonResponse(result);
      }
      if (path.startsWith("/polymarket/midpoint/")) {
        const tokenId = path.split("/")[3];
        const result = await getMidpoint(env, tokenId);
        return jsonResponse(result);
      }
      if (path === "/polymarket/midpoints") {
        const tokenIds = url.searchParams.get("token_ids")?.split(",") || [];
        if (tokenIds.length === 0) {
          return jsonResponse({ error: "token_ids parameter required" }, 400);
        }
        const results = await getMidpoints(env, tokenIds);
        return jsonResponse({ success: true, midpoints: results });
      }
      if (path.startsWith("/polymarket/book/")) {
        const tokenId = path.split("/")[3];
        const result = await getOrderBook(env, tokenId);
        return jsonResponse(result);
      }
      if (path.startsWith("/polymarket/price/")) {
        const tokenId = path.split("/")[3];
        const side = url.searchParams.get("side") || "BUY";
        const result = await getPrice(env, tokenId, side);
        return jsonResponse(result);
      }
      if (path.startsWith("/polymarket/last-trade/")) {
        const tokenId = path.split("/")[3];
        const result = await getLastTradePrice(env, tokenId);
        return jsonResponse(result);
      }
      if (path === "/polymarket/trades") {
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const market = url.searchParams.get("market");
        const result = await getRecentTrades(env, { limit, market });
        return jsonResponse(result);
      }
      if (path === "/trades/poll") {
        const result = await pollAndStoreTrades(env);
        return jsonResponse(result);
      }
      if (path === "/trades/stats") {
        const stats = await getPollStats(env);
        return jsonResponse({ success: true, ...stats });
      }
      if (path === "/trades/accumulated") {
        const hours = parseInt(url.searchParams.get("hours") || "48");
        const result = await getAccumulatedTrades(env, hours);
        return jsonResponse({
          success: true,
          fromKV: result.fromKV,
          totalTrades: result.trades?.length || 0,
          bucketsRead: result.bucketsRead || 0,
          oldestTrade: result.trades?.length > 0 ? new Date(result.trades[result.trades.length - 1].timestamp * 1e3).toISOString() : null,
          newestTrade: result.trades?.length > 0 ? new Date(result.trades[0].timestamp * 1e3).toISOString() : null,
          sampleTrades: result.trades?.slice(0, 5).map((t) => ({
            title: t.title,
            size: t.size,
            price: t.price,
            time: new Date(t.timestamp * 1e3).toISOString()
          }))
        });
      }
      if (path === "/trades/clear" && request.method === "POST") {
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== "Bearer polymarket-admin-2026") {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const result = await clearAccumulatedTrades(env);
        return jsonResponse(result);
      }
      if (path === "/wallets/leaderboard") {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const wallets = await getWalletLeaderboard(env, limit);
        return jsonResponse({
          success: true,
          wallets,
          count: wallets.length,
          message: wallets.length === 0 ? "No wallet data available yet." : null
        });
      }
      if (path.startsWith("/wallet/") && (path.endsWith("/stats") || path.split("/").length === 3)) {
        const address = path.split("/")[2];
        const stats = await getWalletStats(env, address);
        return jsonResponse({ success: !!stats, ...stats });
      }
      if (path.startsWith("/wallet/") && path.endsWith("/pnl")) {
        const address = path.split("/")[2];
        const pnlData = await getWalletPnL(env, address);
        return jsonResponse(pnlData);
      }
      if (path === "/odds/compare-all") {
        const sport = url.searchParams.get("sport") || "nba";
        const result = await getOddsComparison(env, sport);
        return jsonResponse(result);
      }
      if (path === "/debug/poly-markets") {
        const sport = url.searchParams.get("sport") || "nba";
        try {
          const polyMarkets = await getSportsMarketsWithPrices(env, sport);
          return jsonResponse({
            success: true,
            sport,
            marketsFound: polyMarkets?.markets?.length || 0,
            fromCache: polyMarkets?.fromCache || false,
            source: polyMarkets?.source || "unknown",
            seriesId: polyMarkets?.seriesId || null,
            eventsCount: polyMarkets?.eventsCount || 0,
            sampleMarkets: (polyMarkets?.markets || []).slice(0, 5).map((m) => ({
              slug: m.slug,
              eventSlug: m.eventSlug,
              eventTitle: m.eventTitle,
              question: m.question,
              outcomes: m.outcomes,
              outcomePrices: m.outcomePrices,
              yesPrice: m.yesPrice,
              noPrice: m.noPrice,
              gameStartTime: m.gameStartTime
            })),
            error: polyMarkets?.error || null
          });
        } catch (e) {
          return jsonResponse({ success: false, error: e.message, stack: e.stack });
        }
      }
      if (path === "/debug/sports-meta") {
        try {
          const response = await fetch(`https://gamma-api.polymarket.com/sports`);
          const data = await response.json();
          return jsonResponse({ success: true, status: response.status, data });
        } catch (e) {
          return jsonResponse({ success: false, error: e.message });
        }
      }
      if (path === "/debug/events-raw") {
        const seriesId = url.searchParams.get("series_id") || "10345";
        try {
          const response = await fetch(
            `https://gamma-api.polymarket.com/events?series_id=${seriesId}&active=true&closed=false&limit=10&order=startTime&ascending=true`
          );
          const data = await response.json();
          return jsonResponse({
            success: true,
            seriesId,
            status: response.status,
            eventsReturned: Array.isArray(data) ? data.length : "not array",
            sampleEvents: (Array.isArray(data) ? data : []).slice(0, 3).map((e) => ({
              id: e.id,
              slug: e.slug,
              title: e.title,
              startDate: e.startDate,
              marketsCount: e.markets?.length || 0,
              sampleMarket: e.markets?.[0] ? {
                question: e.markets[0].question,
                slug: e.markets[0].slug,
                outcomes: e.markets[0].outcomes,
                outcomePrices: e.markets[0].outcomePrices
              } : null
            }))
          });
        } catch (e) {
          return jsonResponse({ success: false, error: e.message });
        }
      }
      if (path === "/odds/compare") {
        const sport = url.searchParams.get("sport") || "nba";
        const sportKey = SPORT_KEY_MAP[sport.toLowerCase()];
        if (!sportKey) {
          return jsonResponse({ error: `Unknown sport: ${sport}` }, 400);
        }
        const odds = await getGameOdds(env, sportKey);
        return jsonResponse({ success: true, sport, odds });
      }
      if (path === "/odds/scores") {
        const sport = url.searchParams.get("sport") || "nba";
        const sportKey = SPORT_KEY_MAP[sport.toLowerCase()];
        if (!sportKey) {
          return jsonResponse({ error: `Unknown sport: ${sport}` }, 400);
        }
        const scores = await getGameScores(env, sportKey);
        return jsonResponse({ success: true, sport, scores });
      }
      if (path === "/learning/stats") {
        const stats = await getFactorStats(env);
        let pendingSignals = 0;
        let trackedWallets = 0;
        let marketTypeStats = {};
        let volumeBrackets = {};
        if (env.SIGNALS_CACHE) {
          try {
            const pending = await env.SIGNALS_CACHE.get(KV_KEYS.PENDING_SIGNALS, { type: "json" }) || [];
            pendingSignals = pending.length;
            const walletIndex = await env.SIGNALS_CACHE.get("tracked_wallet_index", { type: "json" }) || [];
            trackedWallets = walletIndex.length;
            marketTypeStats = await env.SIGNALS_CACHE.get("market_type_stats", { type: "json" }) || {};
            volumeBrackets = await env.SIGNALS_CACHE.get("volume_brackets", { type: "json" }) || {};
          } catch (e) {
            console.error("Error fetching learning context:", e.message);
          }
        }
        let totalWins = 0;
        let totalLosses = 0;
        Object.values(stats).forEach((factor) => {
          totalWins += factor.wins || 0;
          totalLosses += factor.losses || 0;
        });
        return jsonResponse({
          success: true,
          stats,
          pendingSignals,
          trackedWallets,
          summary: {
            totalSignalsProcessed: totalWins + totalLosses,
            overallWinRate: totalWins + totalLosses > 0 ? Math.round(totalWins / (totalWins + totalLosses) * 100) : 0,
            totalWins,
            totalLosses,
            factorCount: Object.keys(stats).length
          },
          marketTypeStats,
          volumeBrackets,
          // Factor descriptions for frontend display
          factorDescriptions: {
            // Whale size
            whaleSize100k: "Largest single bet > $100K",
            whaleSize50k: "Largest single bet $50K-$100K",
            whaleSize25k: "Largest single bet $25K-$50K",
            whaleSize15k: "Largest single bet $15K-$25K",
            whaleSize8k: "Largest single bet $8K-$15K",
            whaleSize5k: "Largest single bet $5K-$8K",
            whaleSize3k: "Largest single bet $3K-$5K",
            // Volume
            volumeHuge: "Total market volume > $500K",
            volumeModerate: "Total market volume $50K-$100K",
            volumeNotable: "Total market volume $100K-$500K",
            vol_100k_plus: "Signal volume over $100K",
            vol_50k_100k: "Signal volume $50K-$100K",
            vol_25k_50k: "Signal volume $25K-$50K",
            vol_10k_25k: "Signal volume $10K-$25K",
            vol_under_10k: "Signal volume under $10K",
            // Concentration
            concentrated: "Betting heavily concentrated (>70% one direction)",
            coordinated: "Multiple wallets betting same direction within minutes",
            // Directional odds (IMPROVEMENT #4)
            buyDeepLongshot: "Buying at <15% (deep longshot)",
            buyLongshot: "Buying at 15-25% (longshot)",
            buyUnderdog: "Buying at 25-40% (underdog)",
            buyFavorite: "Buying at 70-85% (favorite)",
            buyHeavyFavorite: "Buying at 85%+ (heavy favorite)",
            // Legacy odds
            extremeOdds: "Entry price < 20% or > 80% (legacy)",
            moderateLongshot: "Betting on longshot (20-40% odds)",
            moderateFavorite: "Betting on favorite (60-80% odds)",
            // Event timing (IMPROVEMENT #5)
            betDuringEvent: "Bet placed during/after event start (live)",
            betLast2Hours: "Bet placed within 2 hours of event",
            betSameDay: "Bet placed same day (2-6h before)",
            betDayBefore: "Bet placed day before event",
            betEarlyDays: "Bet placed 1-3 days before event",
            betVeryEarly: "Bet placed 3+ days before event",
            // Wallets
            winningWallet: "Signal includes wallet with 55%+ win rate",
            freshWhale5k: "New wallet betting $5K+ (< 5 prior bets)",
            freshWhale10k: "New wallet betting $10K+ (< 5 prior bets)",
            // Market types
            "sports-nba": "NBA basketball game",
            "sports-nfl": "NFL football game",
            "sports-nhl": "NHL hockey game",
            "sports-ncaab": "NCAA basketball game",
            "sports-mma": "MMA/UFC fight",
            "sports-other": "Other sports market",
            "sports-futures": "Futures/Championship market",
            crypto: "Cryptocurrency market",
            politics: "Political market",
            other: "Other market type",
            // Wallet count
            single_wallet: "Single wallet signal",
            two_wallets: "Two wallets in signal",
            few_wallets_3_5: "3-5 wallets in signal",
            many_wallets_6_plus: "6+ wallets in signal",
            // Time of day
            morning_5_12: "Signal detected 5am-12pm ET",
            afternoon_12_17: "Signal detected 12pm-5pm ET",
            evening_17_22: "Signal detected 5pm-10pm ET",
            night_22_5: "Signal detected 10pm-5am ET",
            // Days
            day_monday: "Signal detected on Monday",
            day_tuesday: "Signal detected on Tuesday",
            day_wednesday: "Signal detected on Wednesday",
            day_thursday: "Signal detected on Thursday",
            day_friday: "Signal detected on Friday",
            day_saturday: "Signal detected on Saturday",
            day_sunday: "Signal detected on Sunday"
          }
        });
      }
      if (path === "/learning/fades") {
        const stats = await getFactorStats(env);
        const fadeFactors = Object.entries(stats).filter(([name, data]) => {
          const total = (data.wins || 0) + (data.losses || 0);
          return total >= 5 && data.winRate < 45;
        }).map(([name, data]) => ({
          factor: name,
          winRate: data.winRate,
          record: `${data.wins}W-${data.losses}L`,
          recommendation: "FADE"
        })).sort((a, b) => a.winRate - b.winRate);
        return jsonResponse({
          success: true,
          fades: fadeFactors,
          message: fadeFactors.length > 0 ? `Found ${fadeFactors.length} factors to fade` : "No fade candidates yet"
        });
      }
      if (path === "/learning/combos") {
        const combos = await getFactorCombos(env);
        return jsonResponse({
          success: true,
          ...combos,
          message: combos.bestCombos.length > 0 ? `Found ${combos.bestCombos.length} strong combos, ${combos.worstCombos.length} weak combos` : "Need more settled signals to identify combos"
        });
      }
      if (path === "/alerts/check") {
        const alerts = [];
        const recentSignals = await getRecentSignals(env, 50);
        const factorStats = await getFactorStats(env);
        for (const signal of recentSignals) {
          const alertReasons = [];
          let priority = "LOW";
          if (signal.hasWinningWallet && signal.largestBet >= 25e3) {
            alertReasons.push(`\u{1F3C6} Elite wallet bet $${signal.largestBet.toLocaleString()}`);
            priority = "HIGH";
          }
          const factors = signal.scoreBreakdown?.map((f) => f.factor) || [];
          const hasVolumeHuge = factors.includes("volumeHuge");
          const hasFreshWhale = factors.includes("freshWhale5k");
          if (hasVolumeHuge && hasFreshWhale) {
            alertReasons.push("\u{1F525} High-prob combo: volumeHuge + freshWhale5k");
            priority = "CRITICAL";
          } else if (hasVolumeHuge) {
            alertReasons.push("\u{1F4C8} volumeHuge factor (88% historical WR)");
            if (priority === "LOW") priority = "MEDIUM";
          }
          if (signal.aiScore && signal.aiScore >= 80) {
            alertReasons.push(`\u{1F916} High AI Score: ${signal.aiScore}`);
            if (priority === "LOW") priority = "MEDIUM";
          }
          if (alertReasons.length > 0) {
            alerts.push({
              id: signal.id,
              type: priority === "CRITICAL" ? "HIGH_PROBABILITY_COMBO" : priority === "HIGH" ? "ELITE_WALLET_BET" : "NOTABLE_SIGNAL",
              priority,
              market: signal.marketTitle,
              direction: signal.direction,
              price: signal.displayPrice,
              amount: signal.largestBet,
              reasons: alertReasons,
              aiScore: signal.aiScore,
              confidence: signal.confidence,
              timestamp: signal.firstTradeTime
            });
          }
        }
        const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        return jsonResponse({
          success: true,
          alerts: alerts.slice(0, 20),
          // Top 20 alerts
          totalAlerts: alerts.length,
          criticalCount: alerts.filter((a) => a.priority === "CRITICAL").length,
          highCount: alerts.filter((a) => a.priority === "HIGH").length
        });
      }
      if (path === "/learning/patterns") {
        const patterns = await getDiscoveredPatterns(env);
        return jsonResponse({ success: true, patterns });
      }
      if (path === "/learning/recommendation") {
        const recommendation = await getAIRecommendation(env);
        return jsonResponse({ success: true, recommendation });
      }
      if (path === "/learning/leaderboard") {
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const wallets = await getWalletLeaderboard(env, limit);
        const leaderboardData = wallets.map((w) => ({
          address: w.address,
          tier: w.tier || "NEW",
          winRate: w.winRate || 0,
          wins: w.wins || 0,
          losses: w.losses || 0,
          pending: w.pending || 0,
          totalBets: w.totalBets || 0,
          record: `${w.wins || 0}W-${w.losses || 0}L`,
          currentStreak: w.currentStreak || 0,
          bestStreak: w.bestStreak || 0,
          totalVolume: w.totalVolume || 0,
          profitLoss: w.profitLoss || 0,
          lastBetAt: w.lastBetAt
        }));
        return jsonResponse({
          success: true,
          leaderboard: leaderboardData,
          totalTracked: leaderboardData.length,
          tierCounts: {
            insider: leaderboardData.filter((w) => w.tier === "INSIDER").length,
            elite: leaderboardData.filter((w) => w.tier === "ELITE").length,
            strong: leaderboardData.filter((w) => w.tier === "STRONG").length
          }
        });
      }
      if (path === "/debug/wallets") {
        if (!env.SIGNALS_CACHE) {
          return jsonResponse({ success: false, error: "No cache" });
        }
        const walletIndex = await getTrackedWallets(env);
        return jsonResponse({
          success: true,
          totalInIndex: walletIndex.length,
          sampleAddresses: walletIndex.slice(0, 10)
        });
      }
      if (path === "/settlement/run") {
        const results = await processSettledSignals(env);
        return jsonResponse({ success: true, results });
      }
      if (path === "/cron-status") {
        if (!env.SIGNALS_CACHE) {
          return jsonResponse({ success: false, error: "No cache" });
        }
        const lastRun = await env.SIGNALS_CACHE.get(KV_KEYS.LAST_CRON_RUN);
        const stats = await env.SIGNALS_CACHE.get(KV_KEYS.CRON_STATS, { type: "json" });
        const pollStats = await getPollStats(env);
        return jsonResponse({
          success: true,
          lastRun,
          stats,
          pollStats,
          minutesSinceRun: lastRun ? Math.round((Date.now() - new Date(lastRun).getTime()) / 6e4) : null
        });
      }
      if (path === "/admin/prune-losers" && request.method === "POST") {
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== "Bearer polymarket-admin-2026") {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        try {
          const result = await pruneLosingWallets(env);
          return jsonResponse({
            success: true,
            message: `Pruned ${result.pruned} losing wallets, kept ${result.kept} winners`,
            ...result
          });
        } catch (error) {
          return jsonResponse({ error: error.message }, 500);
        }
      }
      if (path === "/admin/clear-buckets" && request.method === "POST") {
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== "Bearer polymarket-admin-2026") {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        try {
          const result = await clearTradeBuckets(env);
          return jsonResponse({
            success: true,
            message: `Cleared ${result.cleared} trade buckets`,
            ...result
          });
        } catch (error) {
          return jsonResponse({ error: error.message }, 500);
        }
      }
      if (path === "/admin/full-cleanup" && request.method === "POST") {
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== "Bearer polymarket-admin-2026") {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        try {
          const result = await fullKVCleanup(env);
          return jsonResponse({
            success: true,
            message: "Full cleanup complete",
            ...result
          });
        } catch (error) {
          return jsonResponse({ error: error.message }, 500);
        }
      }
      if (path === "/admin/dedupe-wallets" && request.method === "POST") {
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== "Bearer polymarket-admin-2026") {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        try {
          const result = await deduplicateWalletBets(env);
          return jsonResponse({
            success: true,
            message: `Deduped ${result.walletsProcessed} wallets, removed ${result.duplicatesRemoved} duplicate bets`,
            ...result
          });
        } catch (error) {
          return jsonResponse({ error: error.message }, 500);
        }
      }
      if (path === "/admin/reset-wallets" && request.method === "POST") {
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== "Bearer polymarket-admin-2026") {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        try {
          await env.SIGNALS_CACHE.delete("tracked_wallet_index");
          return jsonResponse({
            success: true,
            message: "Wallet index cleared."
          });
        } catch (error) {
          return jsonResponse({ error: error.message }, 500);
        }
      }
      if (path === "/admin/clear-cache" && request.method === "POST") {
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== "Bearer polymarket-admin-2026") {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        try {
          const keysToDelete = [
            "gamma_markets_all_100_0",
            "sports_markets_nba",
            "sports_markets_ncaa-cbb",
            "sports_markets_nfl",
            "sports_markets_nhl",
            "odds_comparison_v2_nba",
            "odds_comparison_v2_ncaab",
            "odds_comparison_v2_nfl",
            "odds_comparison_v2_nhl",
            "edge_detection_nba",
            "edge_detection_nfl",
            "edge_detection_ncaab",
            "betting_splits_nba",
            "betting_splits_nfl",
            "betting_splits_ncaab",
            "sharp_lines_nba",
            "sharp_lines_nfl",
            "sharp_lines_ncaab"
          ];
          const deleted = [];
          for (const key of keysToDelete) {
            try {
              await env.SIGNALS_CACHE.delete(key);
              deleted.push(key);
            } catch (e) {
            }
          }
          return jsonResponse({
            success: true,
            message: "All caches cleared",
            deletedKeys: deleted
          });
        } catch (error) {
          return jsonResponse({ error: error.message }, 500);
        }
      }
      if (path === "/" || path === "/health") {
        return jsonResponse({
          status: "ok",
          version: VERSION,
          endpoints: {
            scanner: [
              "GET /scan - Run signal scan",
              "GET /scan/sports - Sports-only scan",
              "GET /signals/recent - Get recent signals"
            ],
            edgeDetection: [
              "GET /edge/detect/:sport - Full edge detection (combines all sources)",
              "GET /edge/quick/:sport - Quick edge check (cached)",
              "GET /edge/splits/:sport - DraftKings betting splits (public money flow)",
              "GET /edge/sharp/:sport - Pinnacle vs soft book comparison",
              "GET /edge/movement/:gameId - Line movement tracking",
              "GET /edge/clv?entry=X&closing=Y - Calculate closing line value"
            ],
            polymarket: [
              "GET /polymarket/sports/:sport - Real-time sports prices",
              "GET /polymarket/markets - List all markets",
              "GET /polymarket/market/:slug - Get market by slug"
            ],
            vegasComparison: [
              "GET /odds/compare-all?sport=nba - Vegas vs Polymarket",
              "GET /odds/scores?sport=nba - Game scores"
            ],
            wallets: [
              "GET /wallets/leaderboard - Wallet leaderboard",
              "GET /wallet/:address/stats - Wallet stats"
            ],
            learning: [
              "GET /learning/stats - Factor statistics",
              "GET /learning/fades - Fade recommendations"
            ]
          }
        });
      }
      return jsonResponse({ error: "Not found", path }, 404);
    } catch (e) {
      return jsonResponse({ error: e.message, stack: e.stack }, 500);
    }
  }
};
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
__name(jsonResponse, "jsonResponse");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-C8BKd5/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-C8BKd5/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
