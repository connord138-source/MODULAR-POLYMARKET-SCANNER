// ============================================================
// UTILS.JS - Helper Functions
// ============================================================

import { TEAM_ALIASES } from './config.js';

// Get full team name from code
export function getTeamFullName(code) {
  if (!code) return code;
  return TEAM_ALIASES[code.toLowerCase()] || code;
}

// Detect sport from Polymarket slug
export function detectSportFromSlug(slug) {
  if (!slug) return null;
  const slugLower = slug.toLowerCase();
  
  if (slugLower.startsWith('nfl-') || slugLower.includes('-nfl-')) return 'nfl';
  if (slugLower.startsWith('nba-') || slugLower.includes('-nba-')) return 'nba';
  if (slugLower.startsWith('mlb-') || slugLower.includes('-mlb-')) return 'mlb';
  if (slugLower.startsWith('nhl-') || slugLower.includes('-nhl-')) return 'nhl';
  if (slugLower.startsWith('ncaaf-') || slugLower.includes('college-football')) return 'ncaaf';
  if (slugLower.startsWith('ncaab-') || slugLower.includes('college-basketball')) return 'ncaab';
  if (slugLower.startsWith('ufc-') || slugLower.startsWith('mma-')) return 'mma';
  if (slugLower.startsWith('epl-') || slugLower.includes('premier-league')) return 'epl';
  if (slugLower.startsWith('wta-')) return 'wta';
  if (slugLower.startsWith('atp-')) return 'atp';
  if (slugLower.startsWith('lol-')) return 'lol';
  
  return null;
}

// Extract team codes from Polymarket slug
export function extractTeamsFromSlug(slug) {
  if (!slug) return null;
  
  const match = slug.match(/^(?:nfl|nba|mlb|nhl|ncaaf|ncaab)-([a-z0-9]+)-([a-z0-9]+)-\d{4}-\d{2}-\d{2}/i);
  if (match) {
    return { away: match[1].toLowerCase(), home: match[2].toLowerCase() };
  }
  return null;
}

// Convert American odds to implied probability
export function americanToProb(odds) {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

// Convert probability to American odds
export function probToAmerican(prob) {
  if (prob >= 0.5) {
    return Math.round(-100 * prob / (1 - prob));
  } else {
    return Math.round(100 * (1 - prob) / prob);
  }
}

// ============================================================
// MARKET CLASSIFICATION - Determines if market is a real game
// ============================================================

// Keywords that indicate FUTURES/PROPS (NOT actual games)
const FUTURES_KEYWORDS = [
  // Season/Championship futures
  'win the', 'winner', 'championship', 'super bowl winner', 'world series winner',
  'stanley cup winner', 'nba champion', 'nfl champion', 'mlb champion',
  'premier league winner', 'premier league', 'champions league winner',
  'win the 20', 'win 20', // "Will X win the 2025 championship"
  
  // Awards
  'mvp', 'most valuable', 'rookie of the year', 'cy young', 'heisman',
  'ballon d\'or', 'dpoy', 'defensive player', 'coach of the year',
  
  // Season totals
  'win total', 'season wins', 'over/under wins', 'regular season',
  'make the playoffs', 'miss the playoffs', 'playoff seed',
  'division winner', 'conference winner', 'win the division',
  'win the conference', 'first pick', 'draft',
  
  // Player props (season-long)
  'passing yards', 'rushing yards', 'receiving yards', 'touchdowns',
  'home runs', 'batting average', 'era', 'strikeouts',
  'points per game', 'assists per game', 'rebounds per game',
  'goals scored', 'clean sheets',
  
  // Transfer/Team news
  'sign with', 'trade to', 'leave the', 'join the', 'transfer',
  'retire', 'fired', 'hired', 'contract',
  
  // Other futures
  'before', 'by the end of', 'this season', 'this year',
  'all-star', 'pro bowl', 'hall of fame'
];

// Keywords that indicate ACTUAL GAMES
const GAME_KEYWORDS = [
  'vs', 'vs.', '@', 'at',
  'spread', 'moneyline', 'money line', 'ml',
  'over/under', 'o/u', 'total points', 'total runs', 'total goals',
  'game', 'match', 'bout', 'fight'
];

// Patterns for actual game slugs (team-team-date format)
const GAME_SLUG_PATTERNS = [
  /^(nfl|nba|mlb|nhl|ncaaf|ncaab)-[a-z]+-[a-z]+-\d{4}-\d{2}-\d{2}/i,  // nba-lal-gsw-2026-01-28
  /^(ufc|mma)-[a-z]+-vs-[a-z]+-/i,  // ufc-jones-vs-miocic
  /\d{4}-\d{2}-\d{2}/  // Contains a specific date
];

/**
 * Determines if a market is an actual sports game (not futures/props)
 * @returns {object} { isGame: boolean, marketType: string, reason: string }
 */
export function classifyMarket(title, slug) {
  const titleLower = (title || '').toLowerCase();
  const slugLower = (slug || '').toLowerCase();
  
  // Check for futures keywords first (these disqualify as games)
  for (const keyword of FUTURES_KEYWORDS) {
    if (titleLower.includes(keyword)) {
      return {
        isGame: false,
        marketType: 'futures',
        reason: `Contains futures keyword: "${keyword}"`
      };
    }
  }
  
  // Check slug pattern for game format
  for (const pattern of GAME_SLUG_PATTERNS) {
    if (pattern.test(slugLower)) {
      return {
        isGame: true,
        marketType: 'game',
        reason: 'Matches game slug pattern'
      };
    }
  }
  
  // Check for game keywords
  for (const keyword of GAME_KEYWORDS) {
    if (titleLower.includes(keyword)) {
      // Double-check it's not a futures market in disguise
      if (!titleLower.includes('season') && !titleLower.includes('winner') && !titleLower.includes('champion')) {
        return {
          isGame: true,
          marketType: 'game',
          reason: `Contains game keyword: "${keyword}"`
        };
      }
    }
  }
  
  // Check for "Team A vs Team B" or "Team A @ Team B" patterns in title
  if (/\b[A-Z][a-z]+\s+(vs\.?|@|at)\s+[A-Z][a-z]+\b/.test(title)) {
    return {
      isGame: true,
      marketType: 'game',
      reason: 'Contains team vs team pattern'
    };
  }
  
  // Default: not a game
  return {
    isGame: false,
    marketType: 'other',
    reason: 'No game indicators found'
  };
}

/**
 * Check if market should be included in sports scanner
 * Returns true only for actual games with dates
 */
export function isSportsGame(title, slug) {
  const classification = classifyMarket(title, slug);
  return classification.isGame;
}

// Detect market type from title (enhanced version)
export function detectMarketType(title, slug) {
  if (!title) return "other";
  const t = title.toLowerCase();
  const s = (slug || '').toLowerCase();
  
  // Check if it's an actual sports game first
  const classification = classifyMarket(title, slug);
  if (classification.isGame) {
    // Determine which sport
    if (t.includes('nba') || s.includes('nba-')) return 'sports-nba';
    if (t.includes('nfl') || s.includes('nfl-')) return 'sports-nfl';
    if (t.includes('mlb') || s.includes('mlb-')) return 'sports-mlb';
    if (t.includes('nhl') || s.includes('nhl-')) return 'sports-nhl';
    if (t.includes('ncaa') || t.includes('college')) return 'sports-ncaa';
    if (t.includes('ufc') || t.includes('mma')) return 'sports-mma';
    if (t.includes('soccer') || t.includes('premier') || t.includes('champions league')) return 'sports-soccer';
    return 'sports-other';
  }
  
  // Check for futures/props (sports but not games)
  if (classification.marketType === 'futures') {
    return 'sports-futures';
  }
  
  // Non-sports categories
  if (t.includes("president") || t.includes("election") || t.includes("trump") || 
      t.includes("biden") || t.includes("democrat") || t.includes("republican") ||
      t.includes("governor") || t.includes("senate") || t.includes("congress")) {
    return "politics";
  }
  if (t.includes("bitcoin") || t.includes("ethereum") || t.includes("crypto") || 
      t.includes("btc") || t.includes("eth") || t.includes("sol") || t.includes("doge")) {
    return "crypto";
  }
  if (t.includes("fed") || t.includes("interest rate") || t.includes("inflation") ||
      t.includes("stock") || t.includes("s&p") || t.includes("nasdaq")) {
    return "finance";
  }
  
  return "other";
}

// Check if event has already started
export function hasEventStarted(title, slug, avgPrice) {
  const now = Date.now();
  const EST_OFFSET = -5 * 60 * 60 * 1000;
  const estNow = new Date(now + EST_OFFSET);
  const currentHourEST = estNow.getUTCHours();
  
  const todayYear = estNow.getUTCFullYear();
  const todayMonth = estNow.getUTCMonth() + 1;
  const todayDay = estNow.getUTCDate();
  const todayStr = `${todayYear}-${String(todayMonth).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;
  
  const dateMatch = (slug || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  
  if (dateMatch) {
    const eventDateStr = dateMatch[0];
    const eventYear = parseInt(dateMatch[1]);
    const eventMonth = parseInt(dateMatch[2]);
    const eventDay = parseInt(dateMatch[3]);
    
    // If event date is before today, it's definitely started
    if (eventDateStr < todayStr) {
      return true;
    }
    
    // If event is today, check time
    if (eventDateStr === todayStr) {
      // Most sports games start in evening (after 6pm EST)
      // During day, assume not started. After 8pm, assume started.
      if (currentHourEST >= 20) {
        return true;
      }
      // Between 6pm-8pm, check price
      if (currentHourEST >= 18 && (avgPrice > 90 || avgPrice < 10)) {
        return true;
      }
    }
  }
  
  // Check for extreme prices indicating completion
  if (avgPrice > 95 || avgPrice < 5) {
    return true;
  }
  
  return false;
}

// Format currency
export function formatCurrency(amount) {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}k`;
  }
  return `$${amount.toFixed(0)}`;
}

// Generate unique ID
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}