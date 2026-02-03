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
 * Uses /sports endpoint for series_id, then /events?series_id=&tag_id=100639 for game events
 * Each event = one game, containing multiple markets (moneyline, spread, props)
 * We extract only the moneyline market (slug matches event slug with no suffix)
 */
export async function getSportsMarkets(env, sport) {
  const seriesIds = await getSportSeriesIds(env, sport);
  
  if (seriesIds.length === 0) {
    console.log(`No series_ids found for sport: ${sport}`);
    return { success: false, error: `No series_ids for ${sport}`, markets: [] };
  }
  
  const cacheKey = `sports_events_v3_${sport}_${seriesIds.join('_')}`;
  
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: 'json' });
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL.SPORTS_MARKETS * 1000) {
        return { ...cached.data, fromCache: true };
      }
    } catch (e) {}
  }

  try {
    // Query ALL series IDs and combine results
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
          
          // Strategy 1: exact slug match
          moneylineMarket = event.markets.find(m => m.slug === eventSlug);
          
          // Strategy 2: slug with no suffix after date
          if (!moneylineMarket) {
            moneylineMarket = event.markets.find(m => {
              const slug = m.slug || '';
              return /^[a-z]+-[a-z]+-[a-z]+-\d{4}-\d{2}-\d{2}$/.test(slug);
            });
          }
          
          // Strategy 3: outcomes are team names (not Yes/No/Over/Under)
          if (!moneylineMarket) {
            moneylineMarket = event.markets.find(m => {
              const outcomes = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : (m.outcomes || []);
              if (outcomes.length !== 2) return false;
              const o0 = outcomes[0].toLowerCase();
              const o1 = outcomes[1].toLowerCase();
              return o0 !== 'yes' && o0 !== 'no' && o0 !== 'over' && o0 !== 'under' 
                && !m.slug?.includes('-spread') && !m.slug?.includes('-total') 
                && !m.slug?.includes('-assists') && !m.slug?.includes('-points')
                && !m.slug?.includes('-rebounds') && !m.slug?.includes('-1h-');
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
      source: 'events-api-v3',
      count: allGameMarkets.length,
      eventsCount: totalEvents,
      markets: allGameMarkets,
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
    console.error(`getSportsMarkets error for ${sport}:`, e.message);
    return { success: false, error: e.message, markets: [] };
  }
}

/**
 * Get ALL series IDs for a sport from /sports endpoint
 * Returns array since some sports have multiple series (e.g. ncaab has March Madness + regular CBB)
 * Caches the mapping for 1 hour since it rarely changes
 */
async function getSportSeriesIds(env, sport) {
  const cacheKey = 'polymarket_sports_metadata';
  let sportsData = null;
  
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: 'json' });
      if (cached && (Date.now() - cached.timestamp) < 3600 * 1000) {
        sportsData = cached.data;
      }
    } catch (e) {}
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
      console.error('Failed to fetch /sports:', e.message);
      return [];
    }
  }
  
  // Map our sport codes to ALL Polymarket sport codes to query
  // Based on actual /sports API response Feb 2026:
  //   ncaab=39(March Madness), cbb=10470(regular CBB), cwbb=10471(womens)
  //   nba=10345, nhl=10346, nfl=10187, mlb=3, cfb=10210, mma=10500
  const SPORT_SEARCH_KEYS = {
    'nba':   ['nba'],
    'nfl':   ['nfl'],
    'ncaab': ['ncaab', 'cbb'],     // Both March Madness AND regular season CBB
    'cbb':   ['cbb', 'ncaab'],
    'ncaaf': ['cfb'],
    'cfb':   ['cfb'],
    'nhl':   ['nhl'],
    'mlb':   ['mlb'],
    'ufc':   ['mma'],
    'mma':   ['mma'],
  };
  
  const searchKeys = SPORT_SEARCH_KEYS[sport.toLowerCase()] || [sport.toLowerCase()];
  const sportsList = Array.isArray(sportsData) ? sportsData : Object.values(sportsData);
  
  const seriesIds = [];
  const seen = new Set();
  
  for (const key of searchKeys) {
    for (const entry of sportsList) {
      const entrySport = (entry.sport || '').toLowerCase();
      const seriesId = entry.series;
      if (entrySport === key && seriesId && !seen.has(seriesId)) {
        seriesIds.push(seriesId);
        seen.add(seriesId);
        console.log(`Found series ${seriesId} for sport ${sport} (matched: ${entrySport})`);
      }
    }
  }
  
  if (seriesIds.length === 0) {
    console.log(`No series match for sport: ${sport}. Available: ${sportsList.map(s => s.sport).join(', ')}`);
  }
  
  return seriesIds;
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
      eventSlug: market.eventSlug,
      eventTitle: market.eventTitle,
      question: market.question,
      outcomes: market.outcomes,
      outcomePrices: prices, // Real-time prices from Gamma!
      yesPrice: prices[0] !== undefined && prices[0] !== null ? Math.round(prices[0] * 100) : null,
      noPrice: prices[1] !== undefined && prices[1] !== null ? Math.round(prices[1] * 100) : null,
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
// EVENT TIMING LOOKUP
// Enriches signals with event start/end times from Gamma API
// ============================================================

/**
 * Get event timing (start/end) for a market slug
 * Uses Gamma API events endpoint with aggressive caching
 * Returns { eventStartTime, eventEndTime, hoursUntilEvent } or null
 */
export async function getEventTimingBySlug(env, slug) {
  if (!slug) return null;
  
  // Step 1: Try slug-specific cache first (fast path)
  const timingCacheKey = `event_timing_${slug}`;
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(timingCacheKey, { type: 'json' });
      if (cached) return cached;
    } catch (e) {}
  }
  
  // Step 2: Extract date from slug for estimation
  const dateMatch = slug.match(/(\d{4})-(\d{2})-(\d{2})/);
  
  // Step 3: Try Gamma API direct slug lookup
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
          source: 'gamma-event'
        };
      }
    }
  } catch (e) {
    // Gamma lookup failed, fall through to estimation
  }
  
  // Step 4: If no Gamma event found, try market lookup for endDate
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
            source: 'gamma-market'
          };
        }
      }
    } catch (e) {}
  }
  
  // Step 5: Estimate from slug date if no API data
  if (!timing && dateMatch) {
    const eventDate = new Date(
      parseInt(dateMatch[1]),
      parseInt(dateMatch[2]) - 1,
      parseInt(dateMatch[3])
    );
    
    // Estimate game time based on sport type in slug
    const slugLower = slug.toLowerCase();
    let estimatedHour = 0; // UTC midnight = 7pm ET default
    
    if (slugLower.startsWith('nba-') || slugLower.startsWith('nhl-')) {
      estimatedHour = 0; // ~7pm ET start typical
    } else if (slugLower.startsWith('nfl-')) {
      estimatedHour = 18; // ~1pm ET Sunday start typical
    } else if (slugLower.startsWith('cbb-') || slugLower.startsWith('ncaab-')) {
      estimatedHour = 23; // ~6pm ET typical
    }
    
    eventDate.setUTCHours(estimatedHour, 0, 0, 0);
    
    // End time estimate: game start + 3 hours
    const eventEndDate = new Date(eventDate.getTime() + 3 * 60 * 60 * 1000);
    
    timing = {
      eventStartTime: eventDate.toISOString(),
      eventEndTime: eventEndDate.toISOString(),
      source: 'slug-estimate'
    };
  }
  
  if (!timing) return null;
  
  // Calculate hours until event
  const startTime = timing.eventStartTime ? new Date(timing.eventStartTime).getTime() : null;
  const endTime = timing.eventEndTime ? new Date(timing.eventEndTime).getTime() : null;
  const now = Date.now();
  
  timing.hoursUntilEvent = startTime ? Math.round((startTime - now) / (1000 * 60 * 60) * 10) / 10 : null;
  timing.hoursUntilEnd = endTime ? Math.round((endTime - now) / (1000 * 60 * 60) * 10) / 10 : null;
  timing.eventStatus = startTime 
    ? (now < startTime ? 'upcoming' : (endTime && now < endTime ? 'live' : 'ended'))
    : 'unknown';
  
  // Cache for 10 minutes (event times don't change often)
  if (env.SIGNALS_CACHE) {
    try {
      await env.SIGNALS_CACHE.put(timingCacheKey, JSON.stringify(timing), {
        expirationTtl: 10 * 60
      });
    } catch (e) {}
  }
  
  return timing;
}

/**
 * Batch lookup event timing for multiple slugs (efficient for scan enrichment)
 * Returns Map<slug, timing>
 */
export async function batchGetEventTiming(env, slugs) {
  const timingMap = new Map();
  
  // Limit to prevent API hammering - only enrich top signals
  const maxLookups = 20;
  const lookupSlugs = slugs.slice(0, maxLookups);
  
  // Parallel lookups with individual error handling
  const results = await Promise.allSettled(
    lookupSlugs.map(slug => getEventTimingBySlug(env, slug))
  );
  
  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      timingMap.set(lookupSlugs[i], result.value);
    }
  });
  
  return timingMap;
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
  
  // Event Timing
  getEventTimingBySlug,
  batchGetEventTiming,
  
  // Helpers
  matchPolyToVegas
};
