// ============================================================
// SHARP-LINES.JS - Pinnacle/Sharp Book Line Comparison
// v1.0.0 - Compare soft books vs sharp books for edge detection
// ============================================================

// The Odds API includes Pinnacle (sharpest book) and soft books (DK, FD, etc.)
// Strategy: When soft books differ significantly from Pinnacle, there's potential edge

import { ODDS_API_BASE, SPORT_KEY_MAP } from './config.js';

const CACHE_DURATION = {
  ODDS: 5 * 60,      // 5 minutes for odds comparison
  HISTORY: 60 * 60,  // 1 hour for line history
};

// Sharp vs Soft book classification
const BOOK_TIERS = {
  sharp: ['pinnacle', 'circa', 'bookmaker', 'betcris', 'betonline'],
  soft: ['draftkings', 'fanduel', 'betmgm', 'caesars', 'pointsbet', 'wynnbet', 'espnbet', 'fanatics']
};

// ============================================================
// MAIN: Get Sharp vs Soft Book Comparison
// ============================================================

/**
 * Fetch odds from multiple books and compare sharp vs soft lines
 * @param {Object} env - Environment with API keys
 * @param {string} sport - Sport code (nba, nfl, ncaab, etc.)
 * @returns {Object} - Games with sharp/soft line comparison
 */
export async function getSharpLineComparison(env, sport) {
  const sportKey = SPORT_KEY_MAP[sport];
  if (!sportKey) {
    return { success: false, error: `Sport '${sport}' not supported` };
  }
  
  if (!env.ODDS_API_KEY) {
    return { success: false, error: 'ODDS_API_KEY not configured' };
  }
  
  const cacheKey = `sharp_lines_${sport}`;
  
  // Check cache
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: 'json' });
      if (cached && cached.data) {
        const age = Date.now() - cached.timestamp;
        if (age < CACHE_DURATION.ODDS * 1000) {
          return { ...cached.data, fromCache: true, cacheAge: Math.round(age/1000) };
        }
      }
    } catch (e) {}
  }
  
  try {
    // Fetch odds from all US + Pinnacle bookmakers
    const url = `${ODDS_API_BASE}/sports/${sportKey}/odds/?apiKey=${env.ODDS_API_KEY}&regions=us,eu&markets=h2h,spreads,totals&oddsFormat=american&bookmakers=pinnacle,draftkings,fanduel,betmgm,caesars,betonline`;
    
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Odds API error: ${response.status}`, details: errorText };
    }
    
    const games = await response.json();
    
    // Process each game
    const processedGames = games.map(game => processGameForSharpLines(game));
    
    // Sort by edge potential
    processedGames.sort((a, b) => (b.maxEdge || 0) - (a.maxEdge || 0));
    
    const result = {
      success: true,
      sport,
      sportKey,
      timestamp: new Date().toISOString(),
      gamesCount: processedGames.length,
      gamesWithEdge: processedGames.filter(g => g.maxEdge >= 2).length,
      games: processedGames
    };
    
    // Cache result
    if (env.SIGNALS_CACHE) {
      try {
        await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
          data: result,
          timestamp: Date.now()
        }), { expirationTtl: CACHE_DURATION.ODDS + 60 });
      } catch (e) {}
    }
    
    return result;
    
  } catch (e) {
    console.error('Sharp lines fetch error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Process a single game for sharp/soft line comparison
 */
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
  
  // Find Pinnacle (sharp baseline)
  const pinnacle = game.bookmakers.find(b => b.key === 'pinnacle');
  
  // Get soft books
  const softBooks = game.bookmakers.filter(b => 
    BOOK_TIERS.soft.includes(b.key)
  );
  
  if (!pinnacle && softBooks.length === 0) {
    return result;
  }
  
  // Process each market (h2h, spreads, totals)
  const markets = ['h2h', 'spreads', 'totals'];
  
  for (const marketKey of markets) {
    const pinnacleMarket = pinnacle?.markets?.find(m => m.key === marketKey);
    
    for (const softBook of softBooks) {
      const softMarket = softBook.markets?.find(m => m.key === marketKey);
      
      if (!softMarket) continue;
      
      // Compare each outcome
      for (const softOutcome of softMarket.outcomes) {
        const pinnacleOutcome = pinnacleMarket?.outcomes?.find(o => o.name === softOutcome.name);
        
        // Calculate edge vs Pinnacle if available
        if (pinnacleOutcome) {
          const edge = calculateEdge(softOutcome.price, pinnacleOutcome.price);
          
          if (Math.abs(edge) >= 2) {
            const edgeInfo = {
              market: marketKey,
              book: softBook.key,
              outcome: softOutcome.name,
              softOdds: softOutcome.price,
              pinnacleOdds: pinnacleOutcome.price,
              edge: edge,
              betOn: edge > 0 ? 'soft' : 'pinnacle',
              point: softOutcome.point || null,
              pinnaclePoint: pinnacleOutcome.point || null
            };
            
            result.edges.push(edgeInfo);
            result.maxEdge = Math.max(result.maxEdge, Math.abs(edge));
          }
        }
      }
    }
    
    // Store Pinnacle as baseline
    if (pinnacleMarket) {
      result.pinnacle = result.pinnacle || {};
      result.pinnacle[marketKey] = {
        outcomes: pinnacleMarket.outcomes.map(o => ({
          name: o.name,
          price: o.price,
          point: o.point,
          impliedProb: americanToProb(o.price)
        }))
      };
    }
  }
  
  // Calculate consensus line from soft books
  result.consensus = calculateConsensus(game.bookmakers, softBooks);
  
  return result;
}

/**
 * Calculate edge between two odds
 * Positive = soft book offers better odds than Pinnacle
 * Negative = Pinnacle offers better odds
 */
function calculateEdge(softOdds, pinnacleOdds) {
  const softProb = americanToProb(softOdds);
  const pinnacleProb = americanToProb(pinnacleOdds);
  
  // Edge = (Pinnacle implied prob) - (Soft book implied prob)
  // Positive edge means soft book is giving you better odds than the "true" line
  return Math.round((pinnacleProb - softProb) * 100 * 10) / 10;
}

/**
 * Convert American odds to implied probability
 */
function americanToProb(odds) {
  if (odds >= 100) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

/**
 * Calculate consensus line from soft books
 */
function calculateConsensus(allBooks, softBooks) {
  const consensus = {};
  const markets = ['h2h', 'spreads', 'totals'];
  
  for (const marketKey of markets) {
    const outcomeOdds = {};
    
    for (const book of softBooks) {
      const market = book.markets?.find(m => m.key === marketKey);
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
    
    // Calculate average odds for each outcome
    consensus[marketKey] = {};
    for (const [name, oddsArray] of Object.entries(outcomeOdds)) {
      const avgOdds = Math.round(oddsArray.reduce((sum, o) => sum + o.odds, 0) / oddsArray.length);
      const avgPoint = oddsArray[0]?.point !== undefined 
        ? Math.round(oddsArray.reduce((sum, o) => sum + (o.point || 0), 0) / oddsArray.length * 10) / 10
        : null;
      
      consensus[marketKey][name] = {
        avgOdds,
        avgPoint,
        impliedProb: Math.round(americanToProb(avgOdds) * 100),
        books: oddsArray.length
      };
    }
  }
  
  return consensus;
}

// ============================================================
// LINE MOVEMENT TRACKING
// ============================================================

/**
 * Track and store line movement over time
 * @param {Object} env - Environment with KV
 * @param {string} gameId - Unique game identifier
 * @param {Object} currentOdds - Current odds data
 */
export async function trackLineMovement(env, gameId, currentOdds) {
  if (!env.SIGNALS_CACHE) return null;
  
  const key = `line_movement_${gameId}`;
  
  try {
    // Get existing history
    const existing = await env.SIGNALS_CACHE.get(key, { type: 'json' }) || { history: [] };
    
    // Add current snapshot
    existing.history.push({
      timestamp: new Date().toISOString(),
      odds: currentOdds
    });
    
    // Keep only last 24 hours
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    existing.history = existing.history.filter(h => 
      new Date(h.timestamp).getTime() > cutoff
    );
    
    // Store updated history
    await env.SIGNALS_CACHE.put(key, JSON.stringify(existing), {
      expirationTtl: 24 * 60 * 60 + 3600 // 25 hours
    });
    
    return existing;
    
  } catch (e) {
    console.error('Line tracking error:', e.message);
    return null;
  }
}

/**
 * Get line movement history for a game
 */
export async function getLineMovement(env, gameId) {
  if (!env.SIGNALS_CACHE) return null;
  
  const key = `line_movement_${gameId}`;
  
  try {
    const data = await env.SIGNALS_CACHE.get(key, { type: 'json' });
    if (!data || !data.history || data.history.length < 2) {
      return null;
    }
    
    // Calculate movement
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
    console.error('Get line movement error:', e.message);
    return null;
  }
}

/**
 * Calculate how much the line has moved
 */
function calculateMovement(opening, current) {
  const movement = {
    spread: null,
    total: null,
    moneyline: null
  };
  
  // Compare spread
  if (opening?.spread?.home?.point && current?.spread?.home?.point) {
    movement.spread = {
      homeOpen: opening.spread.home.point,
      homeCurrent: current.spread.home.point,
      change: current.spread.home.point - opening.spread.home.point,
      direction: current.spread.home.point > opening.spread.home.point ? 'away' : 'home'
    };
  }
  
  // Compare total
  if (opening?.total?.over?.point && current?.total?.over?.point) {
    movement.total = {
      open: opening.total.over.point,
      current: current.total.over.point,
      change: current.total.over.point - opening.total.over.point,
      direction: current.total.over.point > opening.total.over.point ? 'up' : 'down'
    };
  }
  
  // Compare moneyline
  if (opening?.moneyline?.home?.price && current?.moneyline?.home?.price) {
    const openProb = americanToProb(opening.moneyline.home.price);
    const currentProb = americanToProb(current.moneyline.home.price);
    
    movement.moneyline = {
      homeOpen: opening.moneyline.home.price,
      homeCurrent: current.moneyline.home.price,
      probChange: Math.round((currentProb - openProb) * 100),
      direction: currentProb > openProb ? 'home' : 'away'
    };
  }
  
  return movement;
}

// ============================================================
// STEAM MOVE DETECTION
// ============================================================

/**
 * Detect steam moves (sudden coordinated sharp action)
 * Steam = multiple books move the same direction within minutes
 * @param {Object} lineHistory - Line movement history
 */
export function detectSteamMove(lineHistory) {
  if (!lineHistory || !lineHistory.history || lineHistory.history.length < 3) {
    return null;
  }
  
  const steamMoves = [];
  
  // Look for rapid movement in short time windows (5-15 minutes)
  for (let i = 1; i < lineHistory.history.length; i++) {
    const prev = lineHistory.history[i - 1];
    const curr = lineHistory.history[i];
    
    const timeDiff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
    const minutesDiff = timeDiff / 60000;
    
    // Look for moves within 15-minute window
    if (minutesDiff <= 15) {
      const movement = calculateMovement(prev.odds, curr.odds);
      
      // Check for significant spread movement (0.5+ points)
      if (movement.spread && Math.abs(movement.spread.change) >= 0.5) {
        steamMoves.push({
          type: 'spread',
          timestamp: curr.timestamp,
          minutesElapsed: Math.round(minutesDiff),
          change: movement.spread.change,
          direction: movement.spread.direction,
          isSteam: minutesDiff <= 5 && Math.abs(movement.spread.change) >= 1
        });
      }
      
      // Check for significant total movement (1+ points)
      if (movement.total && Math.abs(movement.total.change) >= 1) {
        steamMoves.push({
          type: 'total',
          timestamp: curr.timestamp,
          minutesElapsed: Math.round(minutesDiff),
          change: movement.total.change,
          direction: movement.total.direction,
          isSteam: minutesDiff <= 5 && Math.abs(movement.total.change) >= 1.5
        });
      }
      
      // Check for significant ML movement (3%+ implied prob)
      if (movement.moneyline && Math.abs(movement.moneyline.probChange) >= 3) {
        steamMoves.push({
          type: 'moneyline',
          timestamp: curr.timestamp,
          minutesElapsed: Math.round(minutesDiff),
          probChange: movement.moneyline.probChange,
          direction: movement.moneyline.direction,
          isSteam: minutesDiff <= 5 && Math.abs(movement.moneyline.probChange) >= 5
        });
      }
    }
  }
  
  const steamCount = steamMoves.filter(m => m.isSteam).length;
  
  return {
    detected: steamCount > 0,
    steamMoves: steamMoves.filter(m => m.isSteam),
    allMoves: steamMoves,
    steamCount,
    totalMoves: steamMoves.length
  };
}

// ============================================================
// CLOSING LINE VALUE (CLV) TRACKING
// ============================================================

/**
 * Compare entry odds to closing line to measure CLV
 * Beating the closing line is the best indicator of +EV betting
 * @param {number} entryOdds - American odds when bet was placed
 * @param {number} closingOdds - Final odds before game starts
 */
export function calculateCLV(entryOdds, closingOdds) {
  const entryProb = americanToProb(entryOdds);
  const closingProb = americanToProb(closingOdds);
  
  // CLV = closing probability - entry probability
  // Positive CLV = you got better odds than the market closed at
  const clv = Math.round((closingProb - entryProb) * 100 * 10) / 10;
  
  return {
    entryOdds,
    closingOdds,
    entryProb: Math.round(entryProb * 100),
    closingProb: Math.round(closingProb * 100),
    clv,
    beatClosing: clv > 0,
    description: clv > 0 
      ? `Beat closing line by ${clv}% (good +EV indicator)`
      : `Missed closing line by ${Math.abs(clv)}%`
  };
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  getSharpLineComparison,
  trackLineMovement,
  getLineMovement,
  detectSteamMove,
  calculateCLV,
  americanToProb
};
