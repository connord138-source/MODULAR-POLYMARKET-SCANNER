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
    if (cached && cached.data !== undefined && cached.data !== null) {
      const age = Date.now() - cached.timestamp;
      const maxAge = ttlSeconds * 1000;
      
      if (age < maxAge) {
        console.log(`Cache HIT for ${cacheKey} (age: ${Math.round(age/1000)}s)`);
        // Return data directly - don't spread arrays into objects
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
    const vegasOddsRaw = await getGameOdds(env, sportKey, 'h2h,spreads');
    
    // getGameOdds returns through getCachedOrFetch which may wrap the array
    // Handle: raw array, object with numeric keys (spread array), or null
    let vegasOdds = [];
    if (Array.isArray(vegasOddsRaw)) {
      vegasOdds = vegasOddsRaw;
    } else if (vegasOddsRaw && typeof vegasOddsRaw === 'object') {
      // getCachedOrFetch spreads arrays into objects: { 0: game1, 1: game2, fromCache: true }
      // Extract the game entries back out
      const entries = Object.entries(vegasOddsRaw)
        .filter(([key]) => /^\d+$/.test(key))
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([_, val]) => val);
      if (entries.length > 0) {
        vegasOdds = entries;
      }
    }
    
    console.log(`Vegas odds extracted: ${vegasOdds.length} games (raw type: ${Array.isArray(vegasOddsRaw) ? 'array' : typeof vegasOddsRaw})`);
    
    // 2. Fetch Polymarket markets with REAL-TIME prices from Gamma API
    const polyMarkets = await getSportsMarketsWithPrices(env, sport);
    
    console.log(`Vegas games: ${vegasOdds?.length || 0}, Poly markets: ${polyMarkets?.markets?.length || 0}`);
    
    // 3. Build Polymarket lookup by slug patterns
    const polyLookup = buildPolymarketLookup(polyMarkets?.markets || []);
    
    // Debug: log sample lookup keys
    const slugKeys = Object.keys(polyLookup.bySlug).slice(0, 5);
    const teamDateKeys = Object.keys(polyLookup.byTeamDate).slice(0, 10);
    console.log(`Poly lookup sample slugs: ${JSON.stringify(slugKeys)}`);
    console.log(`Poly lookup sample team-dates: ${JSON.stringify(teamDateKeys)}`);
    
    // 4. Match and compare each Vegas game
    const games = (vegasOdds || []).map(vegasGame => {
      const result = processGameWithRealTimePrices(vegasGame, polyLookup);
      if (!result.hasPolymarket) {
        console.log(`NO MATCH: ${vegasGame.away_team} @ ${vegasGame.home_team} (${vegasGame.commence_time?.split('T')[0]})`);
      } else {
        console.log(`MATCHED: ${vegasGame.away_team} @ ${vegasGame.home_team} → ${result.polymarket?.slug}`);
      }
      return result;
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
    
    const slug = market.slug.toLowerCase();
    
    // Store by full slug
    lookup.bySlug[slug] = market;
    
    // Extract date from slug: nba-mem-lal-2026-02-03
    const dateMatch = slug.match(/(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;
    const date = dateMatch[1];
    
    // Extract team abbreviations from slug
    // Format: {sport}-{away}-{home}-{date} e.g. nba-mem-lal-2026-01-04
    const parts = slug.split('-');
    const dateIdx = parts.findIndex(p => /^\d{4}$/.test(p));
    if (dateIdx > 2) {
      const teamParts = parts.slice(1, dateIdx); // e.g. ['mem', 'lal']
      
      // Store by each team abbreviation + date
      for (const abbr of teamParts) {
        const key = `${abbr}-${date}`;
        if (!lookup.byTeamDate[key]) {
          lookup.byTeamDate[key] = market;
        }
      }
      
      // Store by combined abbreviation + date
      const combinedKey = `${teamParts.join('-')}-${date}`;
      lookup.byTeamDate[combinedKey] = market;
    }
    
    // ALSO index by full outcome team names (most reliable for matching)
    // e.g. outcomes: ["Lakers", "Grizzlies"]
    const outcomes = market.outcomes || [];
    for (const outcome of outcomes) {
      // Full outcome name lowercase, alphanumeric only
      const cleanOutcome = outcome.toLowerCase().replace(/[^a-z0-9]/g, '');
      lookup.byTeamDate[`${cleanOutcome}-${date}`] = market;
      
      // Also store individual words from outcome (for "Trail Blazers" -> "blazers")
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
    
    // Index by event title words too (e.g. "Grizzlies vs. Lakers")
    const title = (market.eventTitle || market.question || '').toLowerCase();
    const titleWords = title.split(/[\s.]+/).filter(w => w.length > 3 && w !== 'vs');
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
    // Determine which Polymarket outcome corresponds to which Vegas team
    // outcomes[0] has price outcomePrices[0] (yesPrice), outcomes[1] has outcomePrices[1] (noPrice)
    if (polyMatch.outcomes && polyMatch.outcomes.length >= 2) {
      const homeTeamLower = vegasGame.home_team.toLowerCase();
      const awayTeamLower = vegasGame.away_team.toLowerCase();
      
      const outcome0Lower = polyMatch.outcomes[0].toLowerCase();
      const outcome1Lower = polyMatch.outcomes[1].toLowerCase();
      
      // Use a scoring approach: score how well each outcome matches each team
      // Higher score = better match. This handles same-mascot teams (Rams vs Rams)
      const score_o0_home = teamMatchScore(outcome0Lower, homeTeamLower);
      const score_o0_away = teamMatchScore(outcome0Lower, awayTeamLower);
      const score_o1_home = teamMatchScore(outcome1Lower, homeTeamLower);
      const score_o1_away = teamMatchScore(outcome1Lower, awayTeamLower);
      
      console.log(`Price assignment: o0="${polyMatch.outcomes[0]}" o1="${polyMatch.outcomes[1]}" | home="${vegasGame.home_team}" away="${vegasGame.away_team}" | scores: o0h=${score_o0_home} o0a=${score_o0_away} o1h=${score_o1_home} o1a=${score_o1_away} | yesPrice=${polyMatch.yesPrice} noPrice=${polyMatch.noPrice}`);
      
      // Pick the assignment that maximizes total match score
      const assignNormal = score_o0_home + score_o1_away; // o0=home, o1=away
      const assignFlipped = score_o0_away + score_o1_home; // o0=away, o1=home
      
      if (assignNormal >= assignFlipped && assignNormal > 0) {
        // outcomes[0] = home team, outcomes[1] = away team
        polyHomePrice = polyMatch.yesPrice;
        polyAwayPrice = polyMatch.noPrice;
        console.log(`→ Assignment: NORMAL (o0=home=${polyMatch.yesPrice}¢, o1=away=${polyMatch.noPrice}¢)`);
      } else if (assignFlipped > assignNormal && assignFlipped > 0) {
        // outcomes[0] = away team, outcomes[1] = home team
        polyAwayPrice = polyMatch.yesPrice;
        polyHomePrice = polyMatch.noPrice;
        console.log(`→ Assignment: FLIPPED (o0=away=${polyMatch.yesPrice}¢, o1=home=${polyMatch.noPrice}¢)`);
      } else {
        // Can't determine - log warning but try based on slug order
        console.log(`WARNING: Cannot determine team assignment for ${vegasGame.home_team} vs ${vegasGame.away_team}, outcomes: ${polyMatch.outcomes.join(', ')}`);
        // Poly slug format is typically away-home, so outcomes[0]=away, outcomes[1]=home
        polyAwayPrice = polyMatch.yesPrice;
        polyHomePrice = polyMatch.noPrice;
      }
    } else {
      // No outcomes to match - use raw prices
      polyHomePrice = polyMatch.yesPrice;
      polyAwayPrice = polyMatch.noPrice;
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
      source: 'gamma-api-realtime',
      lastUpdate: new Date().toISOString()
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
  const homeTeam = vegasGame.home_team; // e.g. "Indiana Pacers"
  const awayTeam = vegasGame.away_team; // e.g. "Houston Rockets" 
  const gameDate = vegasGame.commence_time?.split('T')[0]; // e.g. "2026-02-03"
  
  if (!gameDate) return null;
  
  // Check ±1 day for timezone offset (UTC vs ET)
  const d = new Date(gameDate);
  const prevDay = new Date(d); prevDay.setDate(d.getDate() - 1);
  const nextDay = new Date(d); nextDay.setDate(d.getDate() + 1);
  const searchDates = [
    gameDate,
    nextDay.toISOString().split('T')[0],
    prevDay.toISOString().split('T')[0]
  ];
  
  // Extract useful matching tokens from team names
  const homeWords = homeTeam.toLowerCase().split(/\s+/);
  const awayWords = awayTeam.toLowerCase().split(/\s+/);
  const homeLast = homeWords[homeWords.length - 1]; // "pacers"
  const awayLast = awayWords[awayWords.length - 1]; // "rockets"
  
  // NBA team abbreviation map (Vegas full name -> Poly abbreviation)
  const NBA_ABBREV = {
    'hawks': 'atl', 'celtics': 'bos', 'nets': 'bkn', 'hornets': 'cha',
    'bulls': 'chi', 'cavaliers': 'cle', 'mavericks': 'dal', 'nuggets': 'den',
    'pistons': 'det', 'warriors': 'gsw', 'rockets': 'hou', 'pacers': 'ind',
    'clippers': 'lac', 'lakers': 'lal', 'grizzlies': 'mem', 'heat': 'mia',
    'bucks': 'mil', 'timberwolves': 'min', 'pelicans': 'nop', 'knicks': 'nyk',
    'thunder': 'okc', 'magic': 'orl', '76ers': 'phi', 'suns': 'phx',
    'trail blazers': 'por', 'kings': 'sac', 'spurs': 'sas', 'raptors': 'tor',
    'jazz': 'uta', 'wizards': 'was',
  };
  
  // Get abbreviations
  const homeAbbrev = NBA_ABBREV[homeLast] || NBA_ABBREV[homeTeam.toLowerCase().split(' ').slice(1).join(' ')] || null;
  const awayAbbrev = NBA_ABBREV[awayLast] || NBA_ABBREV[awayTeam.toLowerCase().split(' ').slice(1).join(' ')] || null;
  
  for (const date of searchDates) {
    // Strategy 1: Match by team mascot/nickname + date (most reliable)
    // e.g. "pacers-2026-02-04" -> lookup
    const homeKey = `${homeLast}-${date}`;
    const homeMatch = polyLookup.byTeamDate[homeKey];
    if (homeMatch) {
      // Verify the other team is also in this market
      const matchStr = (homeMatch.slug + ' ' + (homeMatch.outcomes || []).join(' ') + ' ' + (homeMatch.eventTitle || '')).toLowerCase();
      if (matchStr.includes(awayLast)) {
        console.log(`MATCHED by mascot: ${awayTeam} @ ${homeTeam} → ${homeMatch.slug}`);
        return homeMatch;
      }
    }
    
    // Strategy 2: Match by NBA abbreviation in slug
    if (homeAbbrev && awayAbbrev) {
      // Try both orderings: away-home and home-away
      const key1 = `${awayAbbrev}-${homeAbbrev}-${date}`;
      const key2 = `${homeAbbrev}-${awayAbbrev}-${date}`;
      if (polyLookup.byTeamDate[key1]) {
        console.log(`MATCHED by abbrev: ${awayTeam} @ ${homeTeam} → ${polyLookup.byTeamDate[key1].slug}`);
        return polyLookup.byTeamDate[key1];
      }
      if (polyLookup.byTeamDate[key2]) {
        console.log(`MATCHED by abbrev: ${awayTeam} @ ${homeTeam} → ${polyLookup.byTeamDate[key2].slug}`);
        return polyLookup.byTeamDate[key2];
      }
    }
    
    // Strategy 3: Match by full team name concatenated
    const homeClean = homeTeam.toLowerCase().replace(/[^a-z0-9]/g, '');
    const awayClean = awayTeam.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (polyLookup.byTeamDate[`${homeClean}-${date}`]) {
      console.log(`MATCHED by fullname: ${awayTeam} @ ${homeTeam} → slug`);
      return polyLookup.byTeamDate[`${homeClean}-${date}`];
    }
    if (polyLookup.byTeamDate[`${awayClean}-${date}`]) {
      return polyLookup.byTeamDate[`${awayClean}-${date}`];
    }
    
    // Strategy 4: Scan all slugs for this date looking for both team indicators
    for (const [slug, market] of Object.entries(polyLookup.bySlug)) {
      if (!slug.includes(date)) continue;
      
      const matchStr = slug + ' ' + (market.outcomes || []).join(' ').toLowerCase() + ' ' + (market.eventTitle || '').toLowerCase();
      
      // Check if both teams are represented
      const hasHome = matchStr.includes(homeLast) || (homeAbbrev && slug.includes(homeAbbrev));
      const hasAway = matchStr.includes(awayLast) || (awayAbbrev && slug.includes(awayAbbrev));
      
      if (hasHome && hasAway) {
        console.log(`MATCHED by scan: ${awayTeam} @ ${homeTeam} → ${slug}`);
        return market;
      }
    }
  }
  
  console.log(`NO MATCH: ${awayTeam} @ ${homeTeam} (${gameDate})`);
  return null;
}

/**
 * Score how well an outcome string matches a team name (0 = no match, higher = better)
 * Uses word-level matching with bonus for distinctive words (city, school, mascot)
 * This handles same-mascot teams like "VCU Rams" vs "Fordham Rams"
 */
function teamMatchScore(outcome, teamName) {
  // Normalize common abbreviations before scoring
  const normalize = (s) => s
    .replace(/\bst\b/g, 'state')
    .replace(/\bn'western\b/g, 'northwestern')
    .replace(/\bsf\b/g, 'san francisco')
    .replace(/\bsfa\b/g, 'stephen f austin');
  
  outcome = normalize(outcome);
  teamName = normalize(teamName);
  
  const outcomeWords = outcome.split(/[\s.]+/).filter(w => w.length > 1);
  const teamWords = teamName.split(/[\s.]+/).filter(w => w.length > 1);
  
  if (outcomeWords.length === 0 || teamWords.length === 0) return 0;
  
  let score = 0;
  let matchedWords = 0;
  
  for (const ow of outcomeWords) {
    for (const tw of teamWords) {
      if (ow === tw) {
        // Exact word match
        score += 10;
        matchedWords++;
      } else if (ow.length > 3 && tw.length > 3 && (ow.includes(tw) || tw.includes(ow))) {
        // Partial word match (e.g. "northwestern" contains "western")
        score += 5;
        matchedWords++;
      }
    }
  }
  
  // Bonus for matching the FULL outcome (all words matched)
  if (matchedWords >= outcomeWords.length && outcomeWords.length > 1) {
    score += 20;
  }
  
  // Bonus for exact substring match (e.g. outcome "VCU Rams" is in "VCU Rams")
  if (teamName.includes(outcome) || outcome.includes(teamName)) {
    score += 50;
  }
  
  return score;
}

/**
 * Check if outcome string matches team name
 * Must match on the DISTINCTIVE part (mascot/nickname), not just shared city/state names
 * e.g. "Tennessee Tech Golden Eagles" vs "Tennessee State Tigers" - shared "Tennessee" should NOT match
 */
function isTeamMatch(outcome, teamName) {
  const outcomeWords = outcome.split(/[\s.]+/).filter(w => w.length > 2);
  const teamWords = teamName.split(/[\s.]+/).filter(w => w.length > 2);
  
  if (outcomeWords.length === 0 || teamWords.length === 0) return false;
  
  // The most reliable identifier is the LAST word (mascot/nickname)
  // e.g. "eagles", "tigers", "rockets", "lakers"
  const outcomeLast = outcomeWords[outcomeWords.length - 1];
  const teamLast = teamWords[teamWords.length - 1];
  
  // If last words match, it's almost certainly the same team
  if (outcomeLast === teamLast || outcomeLast.includes(teamLast) || teamLast.includes(outcomeLast)) {
    return true;
  }
  
  // For short outcome names (1-2 words like "Eagles" or "Golden Eagles"),
  // check if the outcome IS the mascot portion of the team name
  if (outcomeWords.length <= 2) {
    // The outcome should match the END of the team name (the mascot part)
    const teamMascot = teamWords.slice(-outcomeWords.length).join(' ');
    const outcomeStr = outcomeWords.join(' ');
    if (outcomeStr === teamMascot) return true;
  }
  
  // For full team names, require at least 2 distinctive words to match
  // This prevents "tennessee" alone from matching
  const matchingWords = outcomeWords.filter(ow => 
    teamWords.some(tw => ow === tw || (ow.length > 4 && (ow.includes(tw) || tw.includes(ow))))
  );
  
  // Need majority of the shorter name's words to match
  const minWords = Math.min(outcomeWords.length, teamWords.length);
  return matchingWords.length >= Math.max(2, Math.ceil(minWords * 0.6));
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