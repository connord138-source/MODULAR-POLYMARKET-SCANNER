// ============================================================
// BETTING-SPLITS.JS - VSiN/DraftKings Public Betting Data
// v1.1.0 - FIXED: Proper HTML scraping for VSiN betting splits
// ============================================================

// VSiN provides DraftKings betting splits data
// Data updates every 5 minutes and shows:
// - % of Bets (ticket count - mostly public/recreational)
// - % Handle (money wagered - includes sharp/whale action)

const VSIN_BASE = 'https://www.vsin.com';

// Cache duration
const CACHE_DURATION = {
  SPLITS: 5 * 60, // 5 minutes (matches VSiN update frequency)
};

// Sport URL paths on VSiN
const SPORT_PATHS = {
  nba: '/betting-splits/nba/',
  nfl: '/betting-splits/nfl/',
  ncaab: '/betting-splits/ncaab/',
  cbb: '/betting-splits/ncaab/',
  ncaaf: '/betting-splits/ncaaf/',
  cfb: '/betting-splits/ncaaf/',
  nhl: '/betting-splits/nhl/',
  mlb: '/betting-splits/mlb/',
};

// ============================================================
// MAIN: Fetch Betting Splits
// ============================================================

export async function getBettingSplits(env, sport) {
  const normalizedSport = sport.toLowerCase();
  const sportPath = SPORT_PATHS[normalizedSport];
  
  if (!sportPath) {
    return { 
      success: false, 
      error: `Sport '${sport}' not supported`,
      supportedSports: Object.keys(SPORT_PATHS)
    };
  }
  
  // Check cache first
  const cacheKey = `betting_splits_${normalizedSport}`;
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: 'json' });
      if (cached && cached.data) {
        const age = Date.now() - cached.timestamp;
        if (age < CACHE_DURATION.SPLITS * 1000) {
          console.log(`Betting splits cache HIT for ${sport} (age: ${Math.round(age/1000)}s)`);
          return { ...cached.data, fromCache: true, cacheAge: Math.round(age/1000) };
        }
      }
    } catch (e) {
      console.error('Cache read error:', e.message);
    }
  }
  
  try {
    // Scrape VSiN HTML page
    const splits = await scrapeVSiNPage(normalizedSport, sportPath);
    
    const result = {
      success: true,
      sport: normalizedSport,
      source: 'vsin-draftkings',
      timestamp: new Date().toISOString(),
      gamesCount: splits?.length || 0,
      games: splits || [],
      updateFrequency: '5 minutes'
    };
    
    // Cache result if we got data
    if (env.SIGNALS_CACHE && splits && splits.length > 0) {
      try {
        await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
          data: result,
          timestamp: Date.now()
        }), { expirationTtl: CACHE_DURATION.SPLITS + 60 });
      } catch (e) {
        console.error('Cache write error:', e.message);
      }
    }
    
    return result;
    
  } catch (e) {
    console.error('Betting splits fetch error:', e);
    return { 
      success: false, 
      error: e.message,
      sport: normalizedSport
    };
  }
}

// ============================================================
// VSiN HTML Scraper
// ============================================================

async function scrapeVSiNPage(sport, sportPath) {
  const url = `${VSIN_BASE}${sportPath}`;
  
  console.log(`Scraping VSiN: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  
  if (!response.ok) {
    console.log(`VSiN returned ${response.status}`);
    return [];
  }
  
  const html = await response.text();
  
  // Parse the HTML to extract betting splits data
  return parseVSiNHTML(html, sport);
}

// ============================================================
// HTML Parser - Extract betting splits from VSiN page
// ============================================================

function parseVSiNHTML(html, sport) {
  const games = [];
  
  try {
    // VSiN uses a table structure for betting splits
    // Look for game rows with betting percentages
    
    // Pattern 1: Look for data in JSON embedded in script tags
    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        if (data.bettingSplits || data.games) {
          return parseVSiNJSON(data, sport);
        }
      } catch (e) {
        console.log('Failed to parse embedded JSON:', e.message);
      }
    }
    
    // Pattern 2: Look for Next.js data
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        if (nextData.props?.pageProps?.games || nextData.props?.pageProps?.bettingSplits) {
          return parseNextJSData(nextData.props.pageProps, sport);
        }
      } catch (e) {
        console.log('Failed to parse Next.js data:', e.message);
      }
    }
    
    // Pattern 3: Parse HTML table structure
    // Look for betting-splits-table or similar
    const tableGames = parseHTMLTable(html, sport);
    if (tableGames.length > 0) {
      return tableGames;
    }
    
    // Pattern 4: Look for game cards/rows with regex
    const cardGames = parseGameCards(html, sport);
    if (cardGames.length > 0) {
      return cardGames;
    }
    
    console.log('No betting splits data found in HTML');
    return [];
    
  } catch (e) {
    console.error('HTML parse error:', e.message);
    return [];
  }
}

// Parse VSiN JSON structure
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

// Parse Next.js data structure
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

// Parse HTML table structure
function parseHTMLTable(html, sport) {
  const games = [];
  
  // Look for table rows with team names and percentages
  // VSiN typically has: Team | Spread | Bets% | Handle% | ML | Bets% | Handle%
  
  // Match game blocks - look for patterns like "Lakers vs Celtics" or team names with percentages
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

// Parse individual game card/row from HTML
function parseGameCards(html, sport) {
  const games = [];
  
  // Look for percentage patterns near team names
  // Pattern: TeamName followed by numbers like "45%" or "55%"
  const percentPattern = /(\d{1,3})%/g;
  
  // Find sections that look like game data
  // This is a fallback pattern matcher
  const teamPatterns = {
    nba: /(Lakers|Celtics|Warriors|Heat|Nets|Knicks|Bulls|Suns|Mavericks|Bucks|76ers|Clippers|Nuggets|Grizzlies|Cavaliers|Hawks|Hornets|Pacers|Magic|Pistons|Raptors|Wizards|Rockets|Spurs|Thunder|Timberwolves|Pelicans|Kings|Blazers|Jazz)/gi,
    nfl: /(Chiefs|Bills|Eagles|49ers|Cowboys|Dolphins|Lions|Ravens|Bengals|Jaguars|Chargers|Jets|Patriots|Broncos|Raiders|Steelers|Browns|Colts|Titans|Texans|Vikings|Packers|Bears|Saints|Buccaneers|Falcons|Panthers|Commanders|Giants|Cardinals|Rams|Seahawks)/gi,
    nhl: /(Bruins|Panthers|Hurricanes|Devils|Rangers|Maple Leafs|Lightning|Islanders|Capitals|Penguins|Senators|Red Wings|Sabres|Flyers|Blue Jackets|Oilers|Stars|Jets|Avalanche|Wild|Blues|Predators|Knights|Kings|Flames|Canucks|Kraken|Sharks|Coyotes|Ducks|Blackhawks)/gi,
  };
  
  // For now, return empty if we can't find structured data
  // The HTML parsing would need to be customized based on VSiN's actual HTML structure
  return games;
}

// Parse a single game block
function parseGameBlock(blockHtml) {
  // Extract team names
  const teamMatch = blockHtml.match(/>([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)</g);
  if (!teamMatch || teamMatch.length < 2) return null;
  
  // Extract percentages
  const percentages = [];
  const percentMatch = blockHtml.match(/(\d{1,3})%/g);
  if (percentMatch) {
    for (const p of percentMatch) {
      percentages.push(parseInt(p));
    }
  }
  
  // Need at least 4 percentages (spread bets/handle for each team)
  if (percentages.length < 4) return null;
  
  const teams = teamMatch.map(t => t.replace(/[><]/g, '').trim());
  
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
        betsPercent: percentages[2] || (100 - percentages[0]),
        handlePercent: percentages[3] || (100 - percentages[1])
      }
    }
  };
}

// ============================================================
// SHARP MONEY ANALYSIS
// ============================================================

/**
 * Analyze games for sharp money indicators
 * Sharp money = when handle% diverges significantly from bets%
 */
export function analyzeSharpMoney(games) {
  const sharpGames = [];
  
  for (const game of games) {
    const sharpSignals = [];
    
    // Check spread
    if (game.spread) {
      const homeSpreadDiff = (game.spread.home?.handlePercent || 0) - (game.spread.home?.betsPercent || 0);
      const awaySpreadDiff = (game.spread.away?.handlePercent || 0) - (game.spread.away?.betsPercent || 0);
      
      // 15%+ divergence = sharp money signal
      if (Math.abs(homeSpreadDiff) >= 15) {
        sharpSignals.push({
          market: 'spread',
          side: homeSpreadDiff > 0 ? 'home' : 'away',
          team: homeSpreadDiff > 0 ? game.homeTeam : game.awayTeam,
          divergence: Math.abs(homeSpreadDiff),
          betsPercent: homeSpreadDiff > 0 ? game.spread.home?.betsPercent : game.spread.away?.betsPercent,
          handlePercent: homeSpreadDiff > 0 ? game.spread.home?.handlePercent : game.spread.away?.handlePercent,
          strength: Math.abs(homeSpreadDiff) >= 25 ? 'strong' : 'moderate'
        });
      }
    }
    
    // Check moneyline
    if (game.moneyline) {
      const homeMLDiff = (game.moneyline.home?.handlePercent || 0) - (game.moneyline.home?.betsPercent || 0);
      
      if (Math.abs(homeMLDiff) >= 15) {
        sharpSignals.push({
          market: 'moneyline',
          side: homeMLDiff > 0 ? 'home' : 'away',
          team: homeMLDiff > 0 ? game.homeTeam : game.awayTeam,
          divergence: Math.abs(homeMLDiff),
          betsPercent: homeMLDiff > 0 ? game.moneyline.home?.betsPercent : game.moneyline.away?.betsPercent,
          handlePercent: homeMLDiff > 0 ? game.moneyline.home?.handlePercent : game.moneyline.away?.handlePercent,
          strength: Math.abs(homeMLDiff) >= 25 ? 'strong' : 'moderate'
        });
      }
    }
    
    // Check total
    if (game.total) {
      const overDiff = (game.total.over?.handlePercent || 0) - (game.total.over?.betsPercent || 0);
      
      if (Math.abs(overDiff) >= 15) {
        sharpSignals.push({
          market: 'total',
          side: overDiff > 0 ? 'over' : 'under',
          divergence: Math.abs(overDiff),
          line: game.total.line,
          betsPercent: overDiff > 0 ? game.total.over?.betsPercent : game.total.under?.betsPercent,
          handlePercent: overDiff > 0 ? game.total.over?.handlePercent : game.total.under?.handlePercent,
          strength: Math.abs(overDiff) >= 25 ? 'strong' : 'moderate'
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
  
  // Sort by strongest divergence
  sharpGames.sort((a, b) => b.strongestSignal.divergence - a.strongestSignal.divergence);
  
  return sharpGames;
}

// ============================================================
// REVERSE LINE MOVEMENT DETECTION
// ============================================================

/**
 * Detect reverse line movement
 * RLM = line moves opposite to public betting direction
 * Requires current line and opening line comparison
 */
export function detectReverseLineMovement(games, lineHistory = {}) {
  const rlmGames = [];
  
  for (const game of games) {
    const gameHistory = lineHistory[game.gameId];
    if (!gameHistory) continue;
    
    const openingSpread = gameHistory.openingSpread;
    const currentSpread = game.spread?.home?.line;
    
    if (openingSpread === undefined || currentSpread === undefined) continue;
    
    const lineMove = currentSpread - openingSpread;
    const publicSide = (game.spread?.home?.betsPercent || 0) > 50 ? 'home' : 'away';
    const publicPercent = Math.max(game.spread?.home?.betsPercent || 0, game.spread?.away?.betsPercent || 0);
    
    // RLM: Line moves toward the less popular side
    // If public is on home (>60%) but line moves toward away (home spread increases)
    const isRLM = (publicSide === 'home' && lineMove > 0) || (publicSide === 'away' && lineMove < 0);
    
    if (isRLM && publicPercent >= 60 && Math.abs(lineMove) >= 0.5) {
      rlmGames.push({
        gameId: game.gameId,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        openingSpread,
        currentSpread,
        lineMove,
        publicSide,
        publicPercent,
        sharpSide: publicSide === 'home' ? 'away' : 'home',
        strength: publicPercent >= 70 ? 'strong' : 'moderate'
      });
    }
  }
  
  return rlmGames;
}
