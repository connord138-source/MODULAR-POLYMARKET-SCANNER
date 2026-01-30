// ============================================================
// ODDS-API.JS - The Odds API Integration with Aggressive Caching
// ============================================================

import { ODDS_API_BASE, SPORT_KEY_MAP, POLYMARKET_API } from './config.js';
import { americanToProb, getTeamFullName } from './utils.js';

// Cache duration in seconds
const CACHE_DURATION = {
  ODDS: 30 * 60,      // 30 minutes for odds (they don't change that fast)
  SCORES: 15 * 60,    // 15 minutes for scores
  COMPARISON: 20 * 60 // 20 minutes for full comparison
};

// Get cached data or fetch fresh
async function getCachedOrFetch(env, cacheKey, fetchFn, ttlSeconds) {
  if (!env.SIGNALS_CACHE) {
    return await fetchFn();
  }
  
  try {
    // Check cache first
    const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: "json" });
    if (cached && cached.data) {
      const age = Date.now() - cached.timestamp;
      const maxAge = ttlSeconds * 1000;
      
      if (age < maxAge) {
        console.log(`Cache HIT for ${cacheKey} (age: ${Math.round(age/1000)}s)`);
        return { ...cached.data, fromCache: true, cacheAge: Math.round(age/1000) };
      }
      console.log(`Cache EXPIRED for ${cacheKey} (age: ${Math.round(age/1000)}s)`);
    }
    
    // Fetch fresh data
    console.log(`Cache MISS for ${cacheKey} - fetching fresh`);
    const freshData = await fetchFn();
    
    // Store in cache
    if (freshData) {
      await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
        data: freshData,
        timestamp: Date.now()
      }), {
        expirationTtl: ttlSeconds + 60 // Add 1 min buffer
      });
    }
    
    return freshData;
  } catch (e) {
    console.error(`Cache error for ${cacheKey}:`, e.message);
    return await fetchFn();
  }
}

// Get scores/results from The Odds API (CACHED)
export async function getGameScores(env, sportKey, daysFrom) {
  if (!env.ODDS_API_KEY) {
    console.log("No ODDS_API_KEY configured");
    return null;
  }
  
  const cacheKey = `odds_scores_${sportKey}_${daysFrom || 3}`;
  
  return getCachedOrFetch(env, cacheKey, async () => {
    try {
      const url = `${ODDS_API_BASE}/sports/${sportKey}/scores/?apiKey=${env.ODDS_API_KEY}&daysFrom=${daysFrom || 3}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error("Odds API scores error:", response.status);
        return null;
      }
      
      return await response.json();
    } catch (e) {
      console.error("Error fetching scores:", e.message);
      return null;
    }
  }, CACHE_DURATION.SCORES);
}

// Get current odds from The Odds API (CACHED)
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
        console.error("Odds API odds error:", response.status);
        return null;
      }
      
      return await response.json();
    } catch (e) {
      console.error("Error fetching odds:", e.message);
      return null;
    }
  }, CACHE_DURATION.ODDS);
}

// Find matching game in Odds API results
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

// Get Vegas odds with Polymarket comparison (CACHED)
export async function getOddsComparison(env, sport) {
  const sportKey = SPORT_KEY_MAP[sport];
  if (!sportKey) return { success: false, error: "Sport not supported" };
  
  if (!env.ODDS_API_KEY) {
    return { success: false, error: "Odds API not configured" };
  }
  
  const cacheKey = `odds_comparison_${sport}`;
  
  // Check for cached full comparison first
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: "json" });
      if (cached && cached.data) {
        const age = Date.now() - cached.timestamp;
        const maxAge = CACHE_DURATION.COMPARISON * 1000;
        
        if (age < maxAge) {
          console.log(`Comparison cache HIT for ${sport} (age: ${Math.round(age/1000)}s)`);
          return { 
            ...cached.data, 
            fromCache: true, 
            cacheAge: Math.round(age/1000),
            nextRefresh: Math.round((maxAge - age) / 1000)
          };
        }
      }
    } catch (e) {
      console.error("Cache read error:", e.message);
    }
  }
  
  try {
    // 1. Fetch Vegas odds (will use its own cache)
    const oddsData = await getGameOdds(env, sportKey, 'h2h,spreads');
    
    // 2. Fetch recent Polymarket trades (no API cost, just their free endpoint)
    const tradesRes = await fetch(`${POLYMARKET_API}/trades?limit=2000`);
    const allTrades = tradesRes.ok ? await tradesRes.json() : [];
    
    // Filter to sports trades
    const sportPrefix = sport.toLowerCase() + '-';
    const sportsTrades = allTrades.filter(t => 
      (t.eventSlug && t.eventSlug.toLowerCase().startsWith(sportPrefix)) ||
      (t.slug && t.slug.toLowerCase().startsWith(sportPrefix))
    );
    
    // Build Polymarket prices map
    const polyPrices = buildPolymarketPricesMap(sportsTrades);
    
    // Match Vegas games to Polymarket
    const games = (oddsData || []).map(game => {
      return processGameComparison(game, polyPrices);
    });
    
    // Sort by edge
    games.sort((a, b) => {
      const aMaxEdge = Math.max(a.edge.home || -100, a.edge.away || -100);
      const bMaxEdge = Math.max(b.edge.home || -100, b.edge.away || -100);
      return bMaxEdge - aMaxEdge;
    });
    
    const valueBets = games.filter(g => g.edge.bestBet !== null);
    
    const result = {
      success: true,
      sport,
      sportKey,
      timestamp: new Date().toISOString(),
      gamesCount: games.length,
      valueBetsCount: valueBets.length,
      polymarketGamesFound: Object.keys(polyPrices).length,
      polymarketGameKeys: Object.keys(polyPrices),
      valueBets: valueBets.map(g => ({
        game: `${g.awayTeam} @ ${g.homeTeam}`,
        team: g.edge.bestBet.team,
        edge: g.edge.bestBet.edge,
        type: g.edge.bestBet.type,
        vegasProb: g.edge.bestBet.team === g.homeTeam ? g.vegas.moneyline?.home?.prob : g.vegas.moneyline?.away?.prob,
        polyPrice: g.edge.bestBet.team === g.homeTeam ? g.polymarket?.moneyline?.home?.price : g.polymarket?.moneyline?.away?.price
      })),
      games
    };
    
    // Cache the full result
    if (env.SIGNALS_CACHE) {
      try {
        await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
          data: result,
          timestamp: Date.now()
        }), {
          expirationTtl: CACHE_DURATION.COMPARISON + 60
        });
      } catch (e) {
        console.error("Cache write error:", e.message);
      }
    }
    
    return result;
    
  } catch (e) {
    return { success: false, error: e.message, stack: e.stack };
  }
}

// Build map of Polymarket prices by game
function buildPolymarketPricesMap(sportsTrades) {
  const polyPrices = {};
  
  for (const trade of sportsTrades) {
    const slug = trade.eventSlug || trade.slug || '';
    const match = slug.match(/^(nba|nfl|mlb|nhl)-([a-z]+)-([a-z]+)-(\d{4}-\d{2}-\d{2})/i);
    if (!match) continue;
    
    const gameKey = `${match[2]}-${match[3]}-${match[4]}`.toLowerCase();
    const isSpread = slug.includes('-spread');
    const price = parseFloat(trade.price) * 100;
    const outcome = trade.outcome || '';
    
    if (!polyPrices[gameKey]) {
      polyPrices[gameKey] = {
        awayCode: match[2].toLowerCase(),
        homeCode: match[3].toLowerCase(),
        date: match[4],
        moneyline: {},
        spread: {},
        lastUpdate: trade.timestamp
      };
    }
    
    if (trade.timestamp > polyPrices[gameKey].lastUpdate) {
      polyPrices[gameKey].lastUpdate = trade.timestamp;
    }
    
    // Match outcome to team
    const awayTeamFull = getTeamFullName(match[2]).toLowerCase();
    const homeTeamFull = getTeamFullName(match[3]).toLowerCase();
    const outcomeLower = outcome.toLowerCase();
    
    let isAwayTeam = false;
    let isHomeTeam = false;
    
    if (outcomeLower.includes(awayTeamFull) || awayTeamFull.includes(outcomeLower) ||
        outcomeLower === match[2].toLowerCase()) {
      isAwayTeam = true;
    } else if (outcomeLower.includes(homeTeamFull) || homeTeamFull.includes(outcomeLower) ||
               outcomeLower === match[3].toLowerCase()) {
      isHomeTeam = true;
    } else {
      const awayWords = awayTeamFull.split(' ');
      const homeWords = homeTeamFull.split(' ');
      if (awayWords.some(w => w.length > 3 && outcomeLower.includes(w))) {
        isAwayTeam = true;
      } else if (homeWords.some(w => w.length > 3 && outcomeLower.includes(w))) {
        isHomeTeam = true;
      }
    }
    
    if (isSpread) {
      if (isAwayTeam) {
        polyPrices[gameKey].spread.away = { price: Math.round(price), slug };
      } else if (isHomeTeam) {
        polyPrices[gameKey].spread.home = { price: Math.round(price), slug };
      }
    } else {
      if (isAwayTeam) {
        polyPrices[gameKey].moneyline.away = { price: Math.round(price), slug, team: outcome };
      } else if (isHomeTeam) {
        polyPrices[gameKey].moneyline.home = { price: Math.round(price), slug, team: outcome };
      }
    }
  }
  
  // POST-PROCESSING: Fill in missing sides by calculating 100 - otherSide
  for (const [gameKey, data] of Object.entries(polyPrices)) {
    // Moneyline: if we have one side, calculate the other
    if (data.moneyline.away && !data.moneyline.home) {
      data.moneyline.home = { 
        price: Math.round(100 - data.moneyline.away.price), 
        slug: data.moneyline.away.slug, 
        calculated: true 
      };
    } else if (data.moneyline.home && !data.moneyline.away) {
      data.moneyline.away = { 
        price: Math.round(100 - data.moneyline.home.price), 
        slug: data.moneyline.home.slug, 
        calculated: true 
      };
    }
    
    // Spread: if we have one side, calculate the other
    if (data.spread.away && !data.spread.home) {
      data.spread.home = { 
        price: Math.round(100 - data.spread.away.price), 
        slug: data.spread.away.slug, 
        calculated: true 
      };
    } else if (data.spread.home && !data.spread.away) {
      data.spread.away = { 
        price: Math.round(100 - data.spread.home.price), 
        slug: data.spread.home.slug, 
        calculated: true 
      };
    }
  }
  
  return polyPrices;
}

// Process a single game comparison
function processGameComparison(game, polyPrices) {
  // Get Vegas odds from preferred books
  const preferredBooks = ['fanduel', 'draftkings', 'betmgm'];
  let h2hOdds = null;
  let spreadOdds = null;
  
  for (const bookKey of preferredBooks) {
    const book = game.bookmakers?.find(b => b.key === bookKey);
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
  
  // Find matching Polymarket data (accounting for UTC vs ET)
  const gameDate = game.commence_time ? game.commence_time.split('T')[0] : '';
  let prevDate = '';
  if (gameDate) {
    const d = new Date(gameDate);
    d.setDate(d.getDate() - 1);
    prevDate = d.toISOString().split('T')[0];
  }
  
  let polyData = null;
  
  for (const [key, data] of Object.entries(polyPrices)) {
    const awayName = getTeamFullName(data.awayCode).toLowerCase();
    const homeName = getTeamFullName(data.homeCode).toLowerCase();
    
    const vegasAway = game.away_team.toLowerCase();
    const vegasHome = game.home_team.toLowerCase();
    
    const awayMatch = vegasAway.includes(awayName) || awayName.includes(vegasAway) ||
                      vegasAway.split(' ').some(w => w.length > 3 && awayName.includes(w)) ||
                      awayName.split(' ').some(w => w.length > 3 && vegasAway.includes(w));
    const homeMatch = vegasHome.includes(homeName) || homeName.includes(vegasHome) ||
                      vegasHome.split(' ').some(w => w.length > 3 && homeName.includes(w)) ||
                      homeName.split(' ').some(w => w.length > 3 && vegasHome.includes(w));
    
    const dateMatch = key.includes(gameDate) || key.includes(prevDate);
    
    if (awayMatch && homeMatch && dateMatch) {
      polyData = data;
      break;
    }
  }
  
  // Calculate probabilities and edge
  const vegasHomeProb = h2hOdds?.find(o => o.name === game.home_team)?.price ? 
    Math.round(americanToProb(h2hOdds.find(o => o.name === game.home_team).price) * 100) : null;
  const vegasAwayProb = h2hOdds?.find(o => o.name === game.away_team)?.price ?
    Math.round(americanToProb(h2hOdds.find(o => o.name === game.away_team).price) * 100) : null;
  
  let homeEdge = null;
  let awayEdge = null;
  
  if (polyData?.moneyline?.home?.price && vegasHomeProb) {
    homeEdge = vegasHomeProb - polyData.moneyline.home.price;
  }
  if (polyData?.moneyline?.away?.price && vegasAwayProb) {
    awayEdge = vegasAwayProb - polyData.moneyline.away.price;
  }
  
  let bestBet = null;
  if (homeEdge !== null && homeEdge >= 5) {
    bestBet = { team: game.home_team, edge: homeEdge, type: 'moneyline' };
  } else if (awayEdge !== null && awayEdge >= 5) {
    bestBet = { team: game.away_team, edge: awayEdge, type: 'moneyline' };
  }
  
  return {
    id: game.id,
    homeTeam: game.home_team,
    awayTeam: game.away_team,
    commenceTime: game.commence_time,
    vegas: {
      moneyline: h2hOdds ? {
        home: { 
          odds: h2hOdds.find(o => o.name === game.home_team)?.price,
          prob: vegasHomeProb
        },
        away: { 
          odds: h2hOdds.find(o => o.name === game.away_team)?.price,
          prob: vegasAwayProb
        }
      } : null,
      spread: spreadOdds ? {
        home: {
          line: spreadOdds.find(o => o.name === game.home_team)?.point,
          odds: spreadOdds.find(o => o.name === game.home_team)?.price
        },
        away: {
          line: spreadOdds.find(o => o.name === game.away_team)?.point,
          odds: spreadOdds.find(o => o.name === game.away_team)?.price
        }
      } : null
    },
    polymarket: polyData ? {
      moneyline: {
        home: polyData.moneyline.home || null,
        away: polyData.moneyline.away || null
      },
      spread: {
        home: polyData.spread.home || null,
        away: polyData.spread.away || null
      },
      lastUpdate: polyData.lastUpdate
    } : null,
    edge: { home: homeEdge, away: awayEdge, bestBet },
    hasPolymarket: !!polyData
  };
}