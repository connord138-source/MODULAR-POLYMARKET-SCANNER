// ============================================================
// ODDS-API.JS - Vegas Odds + Polymarket Real-Time Comparison
// v18.6.0 - Uses Gamma API for real-time Polymarket prices
// ============================================================

import { ODDS_API_BASE, SPORT_KEY_MAP } from './config.js';
import { americanToProb, getTeamFullName } from './utils.js';
import { getSportsMarketsWithPrices, getMidpoint, getOrderBook } from './polymarket-api.js';

// Cache duration in seconds
const CACHE_DURATION = {
  ODDS: 30 * 60,      // 30 minutes for Vegas odds
  SCORES: 15 * 60,    // 15 minutes for scores
  COMPARISON: 10 * 60 // 10 minutes for full comparison (shorter since we have real-time Poly prices now)
};

// Map sport codes to Polymarket tag slugs
const POLYMARKET_SPORT_MAP = {
  'nba': 'nba',
  'nfl': 'nfl',
  'ncaab': 'ncaa-cbb',
  'cbb': 'ncaa-cbb',
  'ncaaf': 'college-football',
  'cfb': 'college-football',
  'nhl': 'nhl',
  'mlb': 'mlb',
  'ufc': 'ufc',
  'mma': 'mma'
};

// ============================================================
// VEGAS ODDS (The Odds API)
// ============================================================

async function getCachedOrFetch(env, cacheKey, fetchFn, ttlSeconds) {
  if (!env.SIGNALS_CACHE) {
    return await fetchFn();
  }
  
  try {
    const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: "json" });
    if (cached && cached.data) {
      const age = Date.now() - cached.timestamp;
      const maxAge = ttlSeconds * 1000;
      
      if (age < maxAge) {
        console.log(`Cache HIT for ${cacheKey} (age: ${Math.round(age/1000)}s)`);
        return { ...cached.data, fromCache: true, cacheAge: Math.round(age/1000) };
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

export async function getGameOdds(env, sportKey, markets) {
  if (!env.ODDS_API_KEY) {
    console.log("No ODDS_API_KEY configured");
    return null;
  }
  
  const cacheKey = `odds_data_${sportKey}_${markets || 'h2h,spreads'}`;
  
  return getCachedOrFetch(env, cacheKey, async () => {
    try {
      const url = `${ODDS_API_BASE}/sports/${sportKey}/odds/?apiKey=${env.ODDS_API_KEY}&regions=us&markets=${markets || 'h2h,spreads'}&oddsFormat=american`;
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

export async function getGameScores(env, sportKey, daysFrom) {
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

// ============================================================
// MAIN: Vegas + Polymarket Comparison with REAL-TIME PRICES
// ============================================================

export async function getOddsComparison(env, sport) {
  const sportKey = SPORT_KEY_MAP[sport];
  if (!sportKey) return { success: false, error: "Sport not supported" };
  
  if (!env.ODDS_API_KEY) {
    return { success: false, error: "Odds API not configured" };
  }
  
  const cacheKey = `odds_comparison_v2_${sport}`;
  
  // Check cache (shorter TTL now that we have real-time Poly prices)
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: "json" });
      if (cached && cached.data) {
        const age = Date.now() - cached.timestamp;
        const maxAge = CACHE_DURATION.COMPARISON * 1000;
        
        if (age < maxAge) {
          console.log(`Comparison cache HIT for ${sport}`);
          return { 
            ...cached.data, 
            fromCache: true, 
            cacheAge: Math.round(age/1000),
            nextRefresh: Math.round((maxAge - age) / 1000)
          };
        }
      }
    } catch (e) {}
  }
  
  try {
    console.log(`Building odds comparison for ${sport}...`);
    
    // 1. Fetch Vegas odds
    const vegasOdds = await getGameOdds(env, sportKey, 'h2h,spreads');
    
    // 2. Fetch Polymarket markets with REAL-TIME prices from Gamma API
    const polyMarkets = await getSportsMarketsWithPrices(env, sport);
    
    console.log(`Vegas games: ${vegasOdds?.length || 0}, Poly markets: ${polyMarkets?.markets?.length || 0}`);
    
    // 3. Build Polymarket lookup by slug patterns
    const polyLookup = buildPolymarketLookup(polyMarkets?.markets || []);
    
    // 4. Match and compare each Vegas game
    const games = (vegasOdds || []).map(vegasGame => {
      return processGameWithRealTimePrices(vegasGame, polyLookup);
    });
    
    // 5. Sort by edge (reliable data first)
    games.sort((a, b) => {
      if (a.hasReliablePolyData && !b.hasReliablePolyData) return -1;
      if (!a.hasReliablePolyData && b.hasReliablePolyData) return 1;
      
      const aEdge = Math.max(a.edge?.home || -100, a.edge?.away || -100);
      const bEdge = Math.max(b.edge?.home || -100, b.edge?.away || -100);
      return bEdge - aEdge;
    });
    
    // 6. Extract value bets (only from reliable data)
    const valueBets = games
      .filter(g => g.edge?.bestBet && g.hasReliablePolyData)
      .map(g => ({
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
      version: '18.6.0-realtime',
      timestamp: new Date().toISOString(),
      gamesCount: games.length,
      valueBetsCount: valueBets.length,
      polymarketGamesMatched: games.filter(g => g.hasPolymarket).length,
      polymarketSource: 'gamma-api-realtime',
      valueBets,
      games
    };
    
    // Cache result
    if (env.SIGNALS_CACHE) {
      await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
        data: result,
        timestamp: Date.now()
      }), { expirationTtl: CACHE_DURATION.COMPARISON + 60 });
    }
    
    return result;
    
  } catch (e) {
    console.error('Odds comparison error:', e);
    return { success: false, error: e.message, stack: e.stack };
  }
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Build a lookup of Polymarket markets by various keys
 */
function buildPolymarketLookup(markets) {
  const lookup = {
    bySlug: {},
    byTeamDate: {}
  };
  
  for (const market of markets) {
    if (!market.slug) continue;
    
    // Store by full slug
    lookup.bySlug[market.slug.toLowerCase()] = market;
    
    // Parse slug to create team-date key
    // Format: cbb-duke-vtech-2026-01-31
    const slugParts = market.slug.toLowerCase().split('-');
    const dateMatch = market.slug.match(/(\d{4}-\d{2}-\d{2})/);
    
    if (dateMatch) {
      const date = dateMatch[1];
      // Remove sport prefix and date, keep team parts
      const sportPrefix = slugParts[0];
      const dateIdx = slugParts.findIndex(p => /^\d{4}$/.test(p));
      
      if (dateIdx > 1) {
        const teamParts = slugParts.slice(1, dateIdx);
        const teamKey = teamParts.join('-');
        
        // Store by team-date combo
        const key = `${teamKey}-${date}`;
        lookup.byTeamDate[key] = market;
        
        // Also store individual team names for fuzzy matching
        for (const team of teamParts) {
          if (team.length > 2) {
            const teamDateKey = `${team}-${date}`;
            if (!lookup.byTeamDate[teamDateKey]) {
              lookup.byTeamDate[teamDateKey] = market;
            }
          }
        }
      }
    }
    
    // Also try to extract from outcomes (team names)
    if (market.outcomes && market.outcomes.length >= 2) {
      const dateMatch = market.slug.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        for (const outcome of market.outcomes) {
          const teamName = outcome.toLowerCase().replace(/[^a-z0-9]/g, '');
          const key = `${teamName}-${dateMatch[1]}`;
          lookup.byTeamDate[key] = market;
        }
      }
    }
  }
  
  console.log(`Built Polymarket lookup: ${Object.keys(lookup.bySlug).length} by slug, ${Object.keys(lookup.byTeamDate).length} by team-date`);
  
  return lookup;
}

/**
 * Process a single Vegas game with real-time Polymarket prices
 */
function processGameWithRealTimePrices(vegasGame, polyLookup) {
  // Get Vegas odds from preferred books
  const preferredBooks = ['fanduel', 'draftkings', 'betmgm'];
  let h2hOdds = null;
  let spreadOdds = null;
  
  for (const bookKey of preferredBooks) {
    const book = vegasGame.bookmakers?.find(b => b.key === bookKey);
    if (book) {
      if (!h2hOdds) {
        const h2hMarket = book.markets?.find(m => m.key === 'h2h');
        if (h2hMarket) h2hOdds = h2hMarket.outcomes;
      }
      if (!spreadOdds) {
        const spreadMarket = book.markets?.find(m => m.key === 'spreads');
        if (spreadMarket) spreadOdds = spreadMarket.outcomes;
      }
    }
    if (h2hOdds && spreadOdds) break;
  }
  
  // Calculate Vegas probabilities
  const vegasHomeProb = h2hOdds?.find(o => o.name === vegasGame.home_team)?.price ? 
    Math.round(americanToProb(h2hOdds.find(o => o.name === vegasGame.home_team).price) * 100) : null;
  const vegasAwayProb = h2hOdds?.find(o => o.name === vegasGame.away_team)?.price ?
    Math.round(americanToProb(h2hOdds.find(o => o.name === vegasGame.away_team).price) * 100) : null;
  
  // Find matching Polymarket data
  const polyMatch = findPolymarketMatch(vegasGame, polyLookup);
  
  // Calculate edge if we have both prices
  let homeEdge = null;
  let awayEdge = null;
  let polyHomePrice = null;
  let polyAwayPrice = null;
  
  if (polyMatch) {
    // Use real-time prices from Gamma API
    polyHomePrice = polyMatch.yesPrice;
    polyAwayPrice = polyMatch.noPrice;
    
    // Determine which outcome is home team
    // Polymarket outcomes array: typically [Team1, Team2] matching Yes/No prices
    if (polyMatch.outcomes && polyMatch.outcomes.length >= 2) {
      const homeTeamLower = vegasGame.home_team.toLowerCase();
      const awayTeamLower = vegasGame.away_team.toLowerCase();
      
      // Check if outcomes[0] matches home or away
      const outcome0Lower = polyMatch.outcomes[0].toLowerCase();
      const outcome1Lower = polyMatch.outcomes[1].toLowerCase();
      
      const outcome0IsHome = isTeamMatch(outcome0Lower, homeTeamLower);
      const outcome0IsAway = isTeamMatch(outcome0Lower, awayTeamLower);
      
      if (outcome0IsHome) {
        polyHomePrice = polyMatch.yesPrice;
        polyAwayPrice = polyMatch.noPrice;
      } else if (outcome0IsAway) {
        polyAwayPrice = polyMatch.yesPrice;
        polyHomePrice = polyMatch.noPrice;
      }
    }
    
    // Calculate edge
    if (polyHomePrice !== null && vegasHomeProb !== null) {
      homeEdge = vegasHomeProb - polyHomePrice;
    }
    if (polyAwayPrice !== null && vegasAwayProb !== null) {
      awayEdge = vegasAwayProb - polyAwayPrice;
    }
  }
  
  // Determine best bet (require at least 5% edge)
  let bestBet = null;
  if (homeEdge !== null && homeEdge >= 5) {
    bestBet = { 
      team: vegasGame.home_team, 
      edge: Math.round(homeEdge), 
      type: 'moneyline',
      vegasProb: vegasHomeProb,
      polyPrice: polyHomePrice
    };
  } else if (awayEdge !== null && awayEdge >= 5) {
    bestBet = { 
      team: vegasGame.away_team, 
      edge: Math.round(awayEdge), 
      type: 'moneyline',
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
          odds: h2hOdds.find(o => o.name === vegasGame.home_team)?.price,
          prob: vegasHomeProb
        },
        away: { 
          odds: h2hOdds.find(o => o.name === vegasGame.away_team)?.price,
          prob: vegasAwayProb
        }
      } : null,
      spread: spreadOdds ? {
        home: {
          line: spreadOdds.find(o => o.name === vegasGame.home_team)?.point,
          odds: spreadOdds.find(o => o.name === vegasGame.home_team)?.price
        },
        away: {
          line: spreadOdds.find(o => o.name === vegasGame.away_team)?.point,
          odds: spreadOdds.find(o => o.name === vegasGame.away_team)?.price
        }
      } : null
    },
    polymarket: polyMatch ? {
      slug: polyMatch.slug,
      outcomes: polyMatch.outcomes,
      home: { price: polyHomePrice },
      away: { price: polyAwayPrice },
      volume: polyMatch.volume,
      liquidity: polyMatch.liquidity,
      source: 'gamma-api-realtime'
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

/**
 * Find matching Polymarket market for a Vegas game
 */
function findPolymarketMatch(vegasGame, polyLookup) {
  const homeTeam = vegasGame.home_team.toLowerCase();
  const awayTeam = vegasGame.away_team.toLowerCase();
  const gameDate = vegasGame.commence_time?.split('T')[0];
  
  // Also check previous day (UTC vs ET timezone issues)
  let prevDate = null;
  if (gameDate) {
    const d = new Date(gameDate);
    d.setDate(d.getDate() - 1);
    prevDate = d.toISOString().split('T')[0];
  }
  
  // Try various matching strategies
  const searchDates = [gameDate, prevDate].filter(Boolean);
  
  for (const date of searchDates) {
    // Try by team name parts
    const homeWords = homeTeam.split(' ').filter(w => w.length > 3);
    const awayWords = awayTeam.split(' ').filter(w => w.length > 3);
    
    // Try each word from team names
    for (const homeWord of homeWords) {
      const key = `${homeWord}-${date}`;
      const match = polyLookup.byTeamDate[key];
      
      if (match) {
        // Verify the match includes the other team too
        const matchStr = (match.slug + ' ' + (match.outcomes || []).join(' ')).toLowerCase();
        const hasAway = awayWords.some(w => matchStr.includes(w));
        
        if (hasAway) {
          return match;
        }
      }
    }
    
    // Try normalized team names
    for (const homeWord of homeWords) {
      for (const awayWord of awayWords) {
        // Try both orderings
        const key1 = `${awayWord}-${homeWord}-${date}`;
        const key2 = `${homeWord}-${awayWord}-${date}`;
        
        if (polyLookup.byTeamDate[key1]) return polyLookup.byTeamDate[key1];
        if (polyLookup.byTeamDate[key2]) return polyLookup.byTeamDate[key2];
      }
    }
  }
  
  return null;
}

/**
 * Check if outcome string matches team name
 */
function isTeamMatch(outcome, teamName) {
  const outcomeWords = outcome.split(' ').filter(w => w.length > 3);
  const teamWords = teamName.split(' ').filter(w => w.length > 3);
  
  return teamWords.some(tw => 
    outcomeWords.some(ow => ow.includes(tw) || tw.includes(ow))
  );
}

// ============================================================
// FIND MATCHING GAME (used by settlement.js)
// ============================================================

/**
 * Find matching game in Odds API results
 * @param {Array} games - Array of games from Odds API
 * @param {string} homeTeamCode - Home team code
 * @param {string} awayTeamCode - Away team code
 * @returns {Object|null} - Matching game or null
 */
export function findMatchingGame(games, homeTeamCode, awayTeamCode) {
  if (!games || !Array.isArray(games)) return null;
  
  const homeFullName = getTeamFullName(homeTeamCode);
  const awayFullName = getTeamFullName(awayTeamCode);
  
  for (const game of games) {
    const gameHome = (game.home_team || '').toLowerCase();
    const gameAway = (game.away_team || '').toLowerCase();
    const homeMatch = homeFullName.toLowerCase();
    const awayMatch = awayFullName.toLowerCase();
    
    if ((gameHome.includes(homeMatch) || homeMatch.includes(gameHome)) &&
        (gameAway.includes(awayMatch) || awayMatch.includes(gameAway))) {
      return game;
    }
    if ((gameHome.includes(awayMatch) || awayMatch.includes(gameHome)) &&
        (gameAway.includes(homeMatch) || homeMatch.includes(gameAway))) {
      return game;
    }
  }
  
  return null;
}