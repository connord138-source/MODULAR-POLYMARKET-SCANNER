// ============================================================
// POLYMARKET-API.JS - Comprehensive Polymarket API Integration
// v1.0.0 - Real-time prices via Gamma + CLOB APIs
// ============================================================
// 
// This module integrates with ALL useful Polymarket APIs:
// 
// 1. GAMMA API (https://gamma-api.polymarket.com)
//    - GET /markets - List all markets with current prices (outcomePrices)
//    - GET /markets?slug=xxx - Get specific market by slug
//    - GET /events - List events (groups of related markets)
//    - GET /events/{id} - Get event details with all markets
//    
// 2. CLOB API (https://clob.polymarket.com) - Real-time orderbook
//    - GET /midpoint?token_id=xxx - Get midpoint price (best bid + ask / 2)
//    - GET /price?token_id=xxx&side=BUY - Get current buy/sell price
//    - GET /book?token_id=xxx - Get full orderbook
//    - GET /last-trade-price?token_id=xxx - Last executed trade price
//    - GET /spread?token_id=xxx - Current bid-ask spread
//
// 3. DATA API (https://data-api.polymarket.com)
//    - GET /trades - Recent trades with wallet info
//    - GET /activity - Market activity feed
//
// ============================================================

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';
const DATA_API = 'https://data-api.polymarket.com';

// Cache durations
const CACHE_TTL = {
  MARKETS_LIST: 5 * 60,      // 5 min - market list doesn't change often
  MARKET_PRICES: 60,          // 1 min - prices update frequently
  MIDPOINT: 30,               // 30 sec - real-time price
  ORDERBOOK: 30,              // 30 sec - orderbook
  SPORTS_MARKETS: 5 * 60,     // 5 min - sports market mapping
};

// ============================================================
// GAMMA API - Market Discovery & Metadata
// ============================================================

/**
 * Fetch markets from Gamma API with filters
 * Returns markets with outcomePrices (real-time prices!)
 */
export async function getMarkets(env, options = {}) {
  const {
    limit = 100,
    offset = 0,
    closed = false,
    active = true,
    tag_slug = null,  // e.g., 'sports', 'nba', 'ncaa-cbb'
    slug = null,      // specific market slug
  } = options;

  const cacheKey = `gamma_markets_${tag_slug || 'all'}_${limit}_${offset}`;
  
  // Check cache
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: 'json' });
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL.MARKETS_LIST * 1000) {
        return { ...cached.data, fromCache: true };
      }
    } catch (e) {
      console.error('Cache read error:', e.message);
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
    
    // Parse and process markets
    const processed = markets.map(m => parseMarket(m));

    const result = {
      success: true,
      count: processed.length,
      markets: processed,
      timestamp: new Date().toISOString()
    };

    // Cache result
    if (env.SIGNALS_CACHE) {
      await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
        data: result,
        timestamp: Date.now()
      }), { expirationTtl: CACHE_TTL.MARKETS_LIST + 60 });
    }

    return result;
  } catch (e) {
    console.error('Gamma API error:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Get a specific market by slug
 */
export async function getMarketBySlug(env, slug) {
  const cacheKey = `gamma_market_${slug}`;
  
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: 'json' });
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL.MARKET_PRICES * 1000) {
        return { ...cached.data, fromCache: true };
      }
    } catch (e) {}
  }

  try {
    const response = await fetch(`${GAMMA_API}/markets?slug=${slug}`);
    if (!response.ok) throw new Error(`Gamma API error: ${response.status}`);
    
    const markets = await response.json();
    if (!markets || markets.length === 0) {
      return { success: false, error: 'Market not found' };
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

/**
 * Get all sports markets for a specific sport
 * Sports use tag_slugs like: 'nba', 'nfl', 'ncaa-cbb', 'nhl', etc.
 */
export async function getSportsMarkets(env, sport) {
  // Map our sport codes to Polymarket tag slugs
  const sportTagMap = {
    'nba': 'nba',
    'nfl': 'nfl',
    'ncaab': 'ncaa-cbb',
    'cbb': 'ncaa-cbb',
    'ncaaf': 'college-football',
    'cfb': 'college-football',
    'nhl': 'nhl',
    'mlb': 'mlb',
    'ufc': 'ufc',
    'mma': 'mma',
    'epl': 'epl',
    'soccer': 'soccer'
  };

  const tagSlug = sportTagMap[sport.toLowerCase()] || sport.toLowerCase();
  
  const cacheKey = `sports_markets_${tagSlug}`;
  
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: 'json' });
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL.SPORTS_MARKETS * 1000) {
        return { ...cached.data, fromCache: true };
      }
    } catch (e) {}
  }

  try {
    // Fetch active markets for this sport
    const response = await fetch(
      `${GAMMA_API}/markets?tag_slug=${tagSlug}&active=true&closed=false&limit=200`
    );
    
    if (!response.ok) throw new Error(`Gamma API error: ${response.status}`);
    
    const markets = await response.json();
    
    // Filter to only game markets (not futures)
    const gameMarkets = markets
      .map(m => parseMarket(m))
      .filter(m => isGameMarket(m));

    const result = {
      success: true,
      sport,
      tagSlug,
      count: gameMarkets.length,
      markets: gameMarkets,
      timestamp: new Date().toISOString()
    };

    if (env.SIGNALS_CACHE) {
      await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
        data: result,
        timestamp: Date.now()
      }), { expirationTtl: CACHE_TTL.SPORTS_MARKETS + 60 });
    }

    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// CLOB API - Real-Time Prices & Orderbook
// ============================================================

/**
 * Get real-time midpoint price for a token
 * This is the most accurate current price!
 */
export async function getMidpoint(env, tokenId) {
  const cacheKey = `clob_midpoint_${tokenId}`;
  
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: 'json' });
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL.MIDPOINT * 1000) {
        return { ...cached.data, fromCache: true };
      }
    } catch (e) {}
  }

  try {
    const response = await fetch(`${CLOB_API}/midpoint?token_id=${tokenId}`);
    if (!response.ok) throw new Error(`CLOB API error: ${response.status}`);
    
    const data = await response.json();
    
    const result = {
      success: true,
      tokenId,
      midpoint: parseFloat(data.mid) || null,
      timestamp: new Date().toISOString()
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

/**
 * Get midpoints for multiple tokens at once (batched)
 */
export async function getMidpoints(env, tokenIds) {
  const results = {};
  
  // Batch fetch - CLOB supports this
  try {
    const idsParam = tokenIds.join(',');
    const response = await fetch(`${CLOB_API}/midpoints?token_ids=${idsParam}`);
    
    if (response.ok) {
      const data = await response.json();
      // Response format: { "token_id": "0.65", ... }
      for (const [tokenId, mid] of Object.entries(data)) {
        results[tokenId] = parseFloat(mid) || null;
      }
    }
  } catch (e) {
    console.error('Batch midpoints error:', e.message);
  }

  return results;
}

/**
 * Get the current best price for a side (BUY or SELL)
 */
export async function getPrice(env, tokenId, side = 'BUY') {
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

/**
 * Get full orderbook for a token
 */
export async function getOrderBook(env, tokenId) {
  const cacheKey = `clob_book_${tokenId}`;
  
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: 'json' });
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL.ORDERBOOK * 1000) {
        return { ...cached.data, fromCache: true };
      }
    } catch (e) {}
  }

  try {
    const response = await fetch(`${CLOB_API}/book?token_id=${tokenId}`);
    if (!response.ok) throw new Error(`CLOB API error: ${response.status}`);
    
    const data = await response.json();
    
    // Calculate best bid/ask and spread
    const bestBid = data.bids?.[0]?.price ? parseFloat(data.bids[0].price) : null;
    const bestAsk = data.asks?.[0]?.price ? parseFloat(data.asks[0].price) : null;
    const spread = (bestBid && bestAsk) ? (bestAsk - bestBid) : null;
    const midpoint = (bestBid && bestAsk) ? (bestBid + bestAsk) / 2 : null;
    
    // Calculate total liquidity at top levels
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
      timestamp: new Date().toISOString()
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

/**
 * Get last trade price for a token
 */
export async function getLastTradePrice(env, tokenId) {
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

// ============================================================
// COMBINED: Vegas Odds Comparison with Real-Time Poly Prices
// ============================================================

/**
 * Get sports markets with REAL-TIME prices for Vegas comparison
 * This is the PROPER way to compare - uses Gamma API's outcomePrices
 */
export async function getSportsMarketsWithPrices(env, sport) {
  const sportsResult = await getSportsMarkets(env, sport);
  
  if (!sportsResult.success) {
    return sportsResult;
  }

  // The Gamma API already returns outcomePrices!
  // We just need to structure it for our Vegas comparison
  const marketsWithPrices = sportsResult.markets.map(market => {
    // outcomePrices is already parsed in parseMarket()
    const prices = market.outcomePrices || [];
    
    return {
      slug: market.slug,
      question: market.question,
      outcomes: market.outcomes,
      outcomePrices: prices, // Real-time prices from Gamma!
      yesPrice: prices[0] ? Math.round(prices[0] * 100) : null,
      noPrice: prices[1] ? Math.round(prices[1] * 100) : null,
      volume: market.volume,
      liquidity: market.liquidity,
      endDate: market.endDate,
      gameStartTime: market.gameStartTime,
      clobTokenIds: market.clobTokenIds, // For orderbook lookups
      active: market.active,
      closed: market.closed
    };
  });

  return {
    ...sportsResult,
    markets: marketsWithPrices
  };
}

/**
 * Build a lookup map of Polymarket prices by game
 * Uses slug parsing to match with Vegas games
 */
export async function buildPolymarketPricesFromGamma(env, sport) {
  const marketsResult = await getSportsMarketsWithPrices(env, sport);
  
  if (!marketsResult.success) {
    return { success: false, error: marketsResult.error, prices: {} };
  }

  const pricesMap = {};

  for (const market of marketsResult.markets) {
    // Parse slug to extract game info
    // Format: cbb-duke-vtech-2026-01-31 or nba-lal-gsw-2026-01-28
    const slugMatch = market.slug?.match(/^([a-z]+)-(.+)-(\d{4}-\d{2}-\d{2})(?:-spread)?$/i);
    
    if (!slugMatch) continue;

    const sportCode = slugMatch[1];
    const teamsStr = slugMatch[2];
    const dateStr = slugMatch[3];
    const isSpread = market.slug.includes('-spread');

    // Try to split teams - this is tricky for multi-word names
    // We'll use the market outcomes to get team names
    const outcomes = market.outcomes || [];
    
    // Generate a game key for matching
    const gameKey = `${teamsStr}-${dateStr}`.toLowerCase();
    
    if (!pricesMap[gameKey]) {
      pricesMap[gameKey] = {
        slug: market.slug,
        date: dateStr,
        outcomes: outcomes,
        moneyline: {},
        spread: {},
        volume: market.volume,
        liquidity: market.liquidity,
        clobTokenIds: market.clobTokenIds,
        lastUpdate: new Date().toISOString()
      };
    }

    // Store prices
    if (isSpread) {
      if (market.yesPrice !== null) {
        pricesMap[gameKey].spread.yes = market.yesPrice;
        pricesMap[gameKey].spread.no = market.noPrice;
      }
    } else {
      // Moneyline - outcomes[0] is typically home/favorite
      if (market.yesPrice !== null) {
        pricesMap[gameKey].moneyline.yes = market.yesPrice;
        pricesMap[gameKey].moneyline.no = market.noPrice;
        pricesMap[gameKey].moneyline.outcomes = outcomes;
      }
    }
  }

  return {
    success: true,
    sport,
    pricesCount: Object.keys(pricesMap).length,
    prices: pricesMap,
    timestamp: new Date().toISOString()
  };
}

// ============================================================
// DATA API - Trades & Activity
// ============================================================

/**
 * Get recent trades (with wallet info for scanner)
 */
export async function getRecentTrades(env, options = {}) {
  const { limit = 1000, market = null } = options;
  
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

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Parse a market object from Gamma API
 */
function parseMarket(market) {
  // outcomePrices comes as a JSON string like '["0.87","0.13"]'
  let outcomePrices = [];
  if (market.outcomePrices) {
    try {
      outcomePrices = typeof market.outcomePrices === 'string' 
        ? JSON.parse(market.outcomePrices)
        : market.outcomePrices;
      outcomePrices = outcomePrices.map(p => parseFloat(p));
    } catch (e) {
      console.error('Error parsing outcomePrices:', e.message);
    }
  }

  // outcomes comes as a JSON string like '["Yes","No"]' or team names
  let outcomes = [];
  if (market.outcomes) {
    try {
      outcomes = typeof market.outcomes === 'string'
        ? JSON.parse(market.outcomes)
        : market.outcomes;
    } catch (e) {
      console.error('Error parsing outcomes:', e.message);
    }
  }

  // clobTokenIds - needed for CLOB API lookups
  let clobTokenIds = [];
  if (market.clobTokenIds) {
    try {
      clobTokenIds = typeof market.clobTokenIds === 'string'
        ? JSON.parse(market.clobTokenIds)
        : market.clobTokenIds;
    } catch (e) {}
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

/**
 * Check if market is a game (not futures/props)
 */
function isGameMarket(market) {
  const slug = (market.slug || '').toLowerCase();
  const question = (market.question || '').toLowerCase();
  
  // Futures keywords to exclude
  const futuresKeywords = [
    'champion', 'winner', 'mvp', 'playoff', 'seed',
    'division', 'conference', 'season', 'draft', 'award',
    'rookie of the year', 'player of the year'
  ];
  
  if (futuresKeywords.some(kw => question.includes(kw))) {
    return false;
  }
  
  // Game indicators
  // Has a date in slug: nba-lal-gsw-2026-01-28
  if (/\d{4}-\d{2}-\d{2}/.test(slug)) {
    return true;
  }
  
  // Has "vs" in question
  if (question.includes(' vs ') || question.includes(' @ ')) {
    return true;
  }
  
  return false;
}

/**
 * Match a Polymarket slug to a Vegas game
 */
export function matchPolyToVegas(polySlug, vegasHomeTeam, vegasAwayTeam, vegasDate) {
  if (!polySlug) return null;
  
  const slugLower = polySlug.toLowerCase();
  const homeLower = vegasHomeTeam.toLowerCase();
  const awayLower = vegasAwayTeam.toLowerCase();
  
  // Extract words from team names for matching
  const homeWords = homeLower.split(' ').filter(w => w.length > 3);
  const awayWords = awayLower.split(' ').filter(w => w.length > 3);
  
  // Check if slug contains team name parts
  const homeMatch = homeWords.some(w => slugLower.includes(w));
  const awayMatch = awayWords.some(w => slugLower.includes(w));
  
  // Check date
  const dateMatch = vegasDate && slugLower.includes(vegasDate);
  
  return homeMatch && awayMatch && dateMatch;
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  // Gamma API
  getMarkets,
  getMarketBySlug,
  getSportsMarkets,
  getSportsMarketsWithPrices,
  buildPolymarketPricesFromGamma,
  
  // CLOB API
  getMidpoint,
  getMidpoints,
  getPrice,
  getOrderBook,
  getLastTradePrice,
  
  // Data API
  getRecentTrades,
  
  // Helpers
  matchPolyToVegas
};
