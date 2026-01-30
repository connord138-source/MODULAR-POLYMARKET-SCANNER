// ============================================================
// CONFIG.JS - Constants, Scores, and Configuration
// ============================================================

export const POLYMARKET_API = "https://data-api.polymarket.com";
export const ODDS_API_BASE = "https://api.the-odds-api.com/v4";

// SCORING SYSTEM v8 - Adaptive Learning System
export const SCORES = {
  // WHALE BET SIZE (single bet)
  WHALE_BET_MASSIVE: 80,
  WHALE_BET_LARGE: 60,
  WHALE_BET_NOTABLE: 45,
  WHALE_BET_MEDIUM: 30,
  WHALE_BET_SMALL: 15,
  
  // CONCENTRATION
  CONCENTRATION_SINGLE_WHALE: 25,
  CONCENTRATION_WHALE_DUO: 15,
  CONCENTRATION_HIGH: 10,
  
  // FRESH WALLET + MONEY
  FRESH_WHALE_HUGE: 80,
  FRESH_WHALE_LARGE: 60,
  FRESH_WHALE_NOTABLE: 45,
  FRESH_WHALE_MEDIUM: 30,
  FRESH_WALLET_SMALL: 15,
  
  // COORDINATED
  COORDINATED_WHALES: 30,
  COORDINATED_LARGE: 15,
  
  // VOLUME
  VOLUME_HUGE: 25,
  VOLUME_NOTABLE: 15,
  VOLUME_MODERATE: 8,
  
  // EXTREME ODDS
  EXTREME_LONGSHOT: 35,
  EXTREME_HEAVY_FAVORITE: 25,
  MODERATE_LONGSHOT: 15,
  MODERATE_FAVORITE: 10,
  
  // PROVEN WINNERS
  PROVEN_WINNER_ELITE: 40,
  PROVEN_WINNER_STRONG: 25,
  PROVEN_WINNER_GOOD: 15,
  PROVEN_WINNER_EDGE: 8,
};

// KV Storage Keys
export const KV_KEYS = {
  PENDING_SIGNALS: "pending_signals_v2",
  FACTOR_STATS: "factor_stats_v2",
  SIGNALS_PREFIX: "signal_",
  WALLETS_PREFIX: "wallet:",  // NOTE: colon not underscore - must match old format!
  LAST_CRON_RUN: "last_cron_run",
  CRON_STATS: "cron_stats",
};

export const KV_LINE_MOVEMENT_PREFIX = "line_movement_";

// Wallet Tracking Configuration
export const WALLET_TRACK_RECORD = {
  MIN_BETS_FOR_TRACKING: 3,
  MIN_BETS_FOR_TIER: 5,
  CACHE_HOURS: 24,
  LOOKBACK_DAYS: 90,
};

// Wallet Tier Thresholds
export const WALLET_TIERS = {
  INSIDER: { minWinRate: 75, minBets: 15, minVolume: 100000 },
  ELITE: { minWinRate: 68, minBets: 10, minVolume: 50000 },
  STRONG: { minWinRate: 60, minBets: 8, minVolume: 20000 },
  AVERAGE: { minWinRate: 50, minBets: 5, minVolume: 0 },
  FADE: { maxWinRate: 42, minBets: 8, minVolume: 0 },
};

// Sport key mapping for The Odds API
export const SPORT_KEY_MAP = {
  'nfl': 'americanfootball_nfl',
  'nba': 'basketball_nba',
  'mlb': 'baseball_mlb',
  'nhl': 'icehockey_nhl',
  'ncaaf': 'americanfootball_ncaaf',
  'ncaab': 'basketball_ncaab',
  'mma': 'mma_mixed_martial_arts',
  'ufc': 'mma_mixed_martial_arts',
  'epl': 'soccer_epl',
  'ucl': 'soccer_uefa_champions_league',
  'mls': 'soccer_usa_mls',
  'wta': 'tennis_wta_australian_open',
  'atp': 'tennis_atp_australian_open',
  'lol': null,
  'csgo': null,
};

// Team name aliases for matching
export const TEAM_ALIASES = {
  // NFL
  'patriots': 'New England Patriots', 'ne': 'New England Patriots',
  'broncos': 'Denver Broncos', 'den': 'Denver Broncos',
  'chiefs': 'Kansas City Chiefs', 'kc': 'Kansas City Chiefs',
  'bills': 'Buffalo Bills', 'buf': 'Buffalo Bills',
  'dolphins': 'Miami Dolphins', 'mia': 'Miami Dolphins',
  'jets': 'New York Jets', 'nyj': 'New York Jets',
  'ravens': 'Baltimore Ravens', 'bal': 'Baltimore Ravens',
  'steelers': 'Pittsburgh Steelers', 'pit': 'Pittsburgh Steelers',
  'bengals': 'Cincinnati Bengals', 'cin': 'Cincinnati Bengals',
  'browns': 'Cleveland Browns', 'cle': 'Cleveland Browns',
  'texans': 'Houston Texans', 'hou': 'Houston Texans',
  'colts': 'Indianapolis Colts', 'ind': 'Indianapolis Colts',
  'jaguars': 'Jacksonville Jaguars', 'jax': 'Jacksonville Jaguars',
  'titans': 'Tennessee Titans', 'ten': 'Tennessee Titans',
  'cowboys': 'Dallas Cowboys', 'dal': 'Dallas Cowboys',
  'eagles': 'Philadelphia Eagles', 'phi': 'Philadelphia Eagles',
  'giants': 'New York Giants', 'nyg': 'New York Giants',
  'commanders': 'Washington Commanders', 'was': 'Washington Commanders',
  'bears': 'Chicago Bears', 'chi': 'Chicago Bears',
  'lions': 'Detroit Lions', 'det': 'Detroit Lions',
  'packers': 'Green Bay Packers', 'gb': 'Green Bay Packers',
  'vikings': 'Minnesota Vikings', 'min': 'Minnesota Vikings',
  'falcons': 'Atlanta Falcons', 'atl': 'Atlanta Falcons',
  'panthers': 'Carolina Panthers', 'car': 'Carolina Panthers',
  'saints': 'New Orleans Saints', 'no': 'New Orleans Saints',
  'buccaneers': 'Tampa Bay Buccaneers', 'tb': 'Tampa Bay Buccaneers',
  'cardinals': 'Arizona Cardinals', 'ari': 'Arizona Cardinals',
  '49ers': 'San Francisco 49ers', 'sf': 'San Francisco 49ers',
  'seahawks': 'Seattle Seahawks', 'sea': 'Seattle Seahawks',
  'rams': 'Los Angeles Rams', 'lar': 'Los Angeles Rams',
  'chargers': 'Los Angeles Chargers', 'lac': 'Los Angeles Chargers',
  'raiders': 'Las Vegas Raiders', 'lv': 'Las Vegas Raiders',
  // NBA
  'lakers': 'Los Angeles Lakers', 'lal': 'Los Angeles Lakers',
  'celtics': 'Boston Celtics', 'bos': 'Boston Celtics',
  'warriors': 'Golden State Warriors', 'gsw': 'Golden State Warriors',
  'bucks': 'Milwaukee Bucks', 'mil': 'Milwaukee Bucks',
  'heat': 'Miami Heat',
  'nuggets': 'Denver Nuggets',
  'suns': 'Phoenix Suns', 'phx': 'Phoenix Suns',
  'mavericks': 'Dallas Mavericks',
  'clippers': 'Los Angeles Clippers',
  'sixers': 'Philadelphia 76ers',
  '76ers': 'Philadelphia 76ers',
  'nets': 'Brooklyn Nets', 'bkn': 'Brooklyn Nets',
  'knicks': 'New York Knicks', 'nyk': 'New York Knicks',
  'raptors': 'Toronto Raptors', 'tor': 'Toronto Raptors',
  'bulls': 'Chicago Bulls',
  'cavaliers': 'Cleveland Cavaliers', 'cavs': 'Cleveland Cavaliers',
  'pistons': 'Detroit Pistons',
  'pacers': 'Indiana Pacers',
  'hawks': 'Atlanta Hawks',
  'hornets': 'Charlotte Hornets', 'cha': 'Charlotte Hornets',
  'magic': 'Orlando Magic', 'orl': 'Orlando Magic',
  'wizards': 'Washington Wizards',
  'timberwolves': 'Minnesota Timberwolves', 'wolves': 'Minnesota Timberwolves',
  'thunder': 'Oklahoma City Thunder', 'okc': 'Oklahoma City Thunder',
  'blazers': 'Portland Trail Blazers', 'por': 'Portland Trail Blazers',
  'jazz': 'Utah Jazz', 'uta': 'Utah Jazz',
  'grizzlies': 'Memphis Grizzlies', 'mem': 'Memphis Grizzlies',
  'pelicans': 'New Orleans Pelicans', 'nop': 'New Orleans Pelicans',
  'spurs': 'San Antonio Spurs', 'sas': 'San Antonio Spurs',
  'rockets': 'Houston Rockets',
  'kings': 'Sacramento Kings', 'sac': 'Sacramento Kings',
};

// CORS Headers
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Version
export const VERSION = "18.5.0 - Fresh wallet detection, filter gambling/sure-bets, wallet activity API";
