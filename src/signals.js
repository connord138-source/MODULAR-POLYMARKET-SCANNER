// ============================================================
// SIGNALS.JS - Signal Detection and Scoring
// v18.9.0 - WINNING FOCUS: Track winners, prioritize sports props
// ============================================================

import { POLYMARKET_API, SCORES, KV_KEYS } from './config.js';
import { detectMarketType, generateId, isSportsGame } from './utils.js';
import { trackWalletBet } from './wallets.js';
import { calculateConfidence } from './learning.js';
import { batchGetEventTiming } from './polymarket-api.js';
import { getAccumulatedTrades } from './trades.js';

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
  SCAN_CACHE_TTL: 2 * 60,        // 2 minutes cache
  TRADE_LIMIT: 1500,              // API fetch limit
  MAX_TRADES_PER_MARKET: 10,      // Memory optimization
  SPORTS_SIGNAL_LIMIT: 15,        // Top 15 sports props
  MIN_WALLET_WIN_RATE: 55,        // Only track wallets above 55% win rate
  MIN_WALLET_BETS: 3,             // Minimum bets before tracking
};

// ============================================================
// FACTOR-BASED FILTERING (AI LEARNED)
// ============================================================

// Factors to auto-hide (historically terrible performance)
const FADE_FACTORS = ['sports-mma'];  // 0% win rate

// Factors to heavily penalize
const WEAK_FACTORS = ['vol_100k_plus', 'freshWhale10k', 'whaleSize25k', 'vol_25k_50k', 'betVeryEarly'];  // <20% WR

// Factors to boost (proven winners)
const STRONG_FACTORS = ['volumeHuge', 'sports-other', 'freshWhale5k', 'betLast2Hours', 'betDuringEvent'];  // likely high WR

// Calculate AI-adjusted score based on factor performance
async function calculateAIScore(env, baseScore, scoreBreakdown, marketType, hasWinningWallet) {
  if (!env.SIGNALS_CACHE) return { aiScore: baseScore, multiplier: 1.0, shouldHide: false };
  
  try {
    const factorStats = await env.SIGNALS_CACHE.get('factor_stats_v2', { type: 'json' }) || {};
    
    let multiplier = 1.0;
    let shouldHide = false;
    let boostReasons = [];
    let penaltyReasons = [];
    
    // Check each factor in the signal
    const factors = scoreBreakdown?.map(f => f.factor) || [];
    if (marketType) factors.push(marketType);
    if (hasWinningWallet) factors.push('winningWallet');
    
    for (const factor of factors) {
      const stats = factorStats[factor];
      
      // Skip factors with insufficient data
      if (!stats || (stats.wins + stats.losses) < 5) continue;
      
      const winRate = stats.winRate;
      const sampleSize = stats.wins + stats.losses;
      
      // Confidence factor: more samples = more weight
      const confidenceFactor = Math.min(1, sampleSize / 20);
      
      if (winRate >= 70) {
        // Strong factor: boost significantly
        const boost = 1 + (0.3 * confidenceFactor);
        multiplier *= boost;
        boostReasons.push(`${factor}(${winRate}%)`);
      } else if (winRate >= 55) {
        // Good factor: small boost
        multiplier *= (1 + (0.1 * confidenceFactor));
      } else if (winRate <= 15) {
        // Terrible factor: heavy penalty
        multiplier *= (0.4 * confidenceFactor + (1 - confidenceFactor));
        penaltyReasons.push(`${factor}(${winRate}%)`);
        
        // Auto-hide if dominated by terrible factors
        if (FADE_FACTORS.includes(factor)) {
          shouldHide = true;
        }
      } else if (winRate <= 25) {
        // Weak factor: moderate penalty
        multiplier *= (0.6 * confidenceFactor + (1 - confidenceFactor));
        penaltyReasons.push(`${factor}(${winRate}%)`);
      } else if (winRate <= 35) {
        // Below average: small penalty
        multiplier *= (0.8 * confidenceFactor + (1 - confidenceFactor));
      }
    }
    
    // Cap multiplier range
    multiplier = Math.max(0.3, Math.min(2.0, multiplier));
    
    // Override: Never hide signals with winning wallets
    if (hasWinningWallet) {
      shouldHide = false;
      multiplier = Math.max(multiplier, 1.0);  // At least 1.0x with winning wallet
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
    console.error('Error calculating AI score:', e.message);
    return { aiScore: baseScore, multiplier: 1.0, shouldHide: false };
  }
}

// Get historical win rate for a specific factor
async function getFactorWinRate(env, factorName) {
  if (!env.SIGNALS_CACHE) return null;
  
  try {
    const factorStats = await env.SIGNALS_CACHE.get('factor_stats_v2', { type: 'json' }) || {};
    const stats = factorStats[factorName];
    
    if (!stats || (stats.wins + stats.losses) < 3) return null;
    
    return {
      winRate: stats.winRate,
      record: `${stats.wins}W-${stats.losses}L`,
      weight: stats.weight || 1.0
    };
  } catch (e) {
    return null;
  }
}

// ============================================================
// SCAN RESULT CACHE
// ============================================================
async function getCachedScanResult(env, cacheKey) {
  if (!env.SIGNALS_CACHE) return null;
  
  try {
    const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: 'json' });
    if (cached && cached.timestamp) {
      const age = Date.now() - cached.timestamp;
      if (age < CONFIG.SCAN_CACHE_TTL * 1000) {
        return { ...cached.data, fromCache: true, cacheAge: Math.round(age / 1000) };
      }
    }
  } catch (e) {}
  return null;
}

async function cacheScanResult(env, cacheKey, data) {
  if (!env.SIGNALS_CACHE) return;
  try {
    await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }), { expirationTtl: CONFIG.SCAN_CACHE_TTL + 60 });
  } catch (e) {}
}

// ============================================================
// FILTERS
// ============================================================
const GAMBLING_KEYWORDS = [
  'up or down', 'bitcoin up or down', 'ethereum up or down', 
  '15m', '30m', '1h', '5m', 'next 15 minutes', 'next 30 minutes'
];

function isGamblingMarket(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  return GAMBLING_KEYWORDS.some(kw => lower.includes(kw));
}

function extractWallet(trade) {
  const wallet = trade.proxyWallet || trade.user || trade.maker || trade.taker;
  return (wallet && typeof wallet === 'string' && wallet.length > 10) ? wallet : null;
}

function isNoBetOutcome(outcome) {
  if (!outcome) return false;
  const lower = String(outcome).toLowerCase();
  return lower === 'no' || lower === 'false' || lower === '0';
}

// ============================================================
// WINNING WALLET LOOKUP (Check if wallet is a proven winner)
// ============================================================
async function getWinningWallets(env) {
  if (!env.SIGNALS_CACHE) return new Map();
  
  try {
    const cached = await env.SIGNALS_CACHE.get('winning_wallets_cache', { type: 'json' });
    if (cached && cached.timestamp && (Date.now() - cached.timestamp < 5 * 60 * 1000)) {
      return new Map(Object.entries(cached.wallets || {}));
    }
  } catch (e) {}
  
  return new Map();
}

async function isWinningWallet(env, address, winningWalletsCache) {
  if (!address) return { isWinner: false };
  
  // Check cache first
  if (winningWalletsCache.has(address.toLowerCase())) {
    return winningWalletsCache.get(address.toLowerCase());
  }
  
  // Not in cache, check KV directly
  if (!env.SIGNALS_CACHE) return { isWinner: false };
  
  try {
    const walletKey = KV_KEYS.WALLETS_PREFIX + address.toLowerCase();
    const stats = await env.SIGNALS_CACHE.get(walletKey, { type: 'json' });
    
    if (stats && stats.totalBets >= CONFIG.MIN_WALLET_BETS) {
      const winRate = stats.winRate || (stats.totalBets > 0 ? (stats.wins / stats.totalBets) * 100 : 0);
      if (winRate >= CONFIG.MIN_WALLET_WIN_RATE) {
        return {
          isWinner: true,
          winRate: Math.round(winRate),
          record: `${stats.wins}W-${stats.losses}L`,
          tier: stats.tier || 'WINNER',
          totalBets: stats.totalBets
        };
      }
    }
  } catch (e) {}
  
  return { isWinner: false };
}

// ============================================================
// SIGNAL STORAGE (Only store signals with potential)
// ============================================================
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
      detectedAt: new Date().toISOString(),
      marketType: signal.marketType,
      totalVolume: signal.suspiciousVolume,
      largestBet: signal.largestBet,
      scoreBreakdown: signal.scoreBreakdown || [],
      wallets: signal.topTrades?.map(t => t.wallet).filter(Boolean) || [],
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
    
    // Add to pending signals list
    let pendingSignals = await env.SIGNALS_CACHE.get(KV_KEYS.PENDING_SIGNALS, { type: 'json' }) || [];
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

// Only track wallets that show promise (large bets or part of winning signal)
async function trackWalletIfWorthy(env, wallet, tradeData, signal) {
  if (!env.SIGNALS_CACHE || !wallet) return false;
  
  // Track if: large bet (>$5k) OR signal score is high (>60) OR has winning wallet pattern
  const isWorthy = tradeData.amount >= 5000 || signal.score >= 60 || signal.hasWinningWallet;
  
  if (isWorthy) {
    try {
      await trackWalletBet(env, wallet, {
        signalId: signal.id,
        market: signal.marketSlug,
        marketTitle: signal.marketTitle,  // ADD THE READABLE TITLE
        direction: signal.direction,
        amount: tradeData.amount,
        price: tradeData.price
      });
      return true;
    } catch (e) {}
  }
  return false;
}

// ============================================================
// MAIN SCAN FUNCTION
// ============================================================
export async function runScan(hours, minScore, env, options = {}) {
  const startTime = Date.now();
  const { sportsOnly = false, includeDebug = false } = options;
  
  const cacheKey = `scan_result_${hours}_${minScore}_${sportsOnly ? 'sports' : 'all'}`;
  
  // Try cache first
  const cached = await getCachedScanResult(env, cacheKey);
  if (cached) {
    console.log(`Returning cached scan (age: ${cached.cacheAge}s)`);
    return cached;
  }
  
  try {
    // Load winning wallets cache for quick lookup
    const winningWallets = await getWinningWallets(env);
    console.log(`Loaded ${winningWallets.size} winning wallets from cache`);
    
    // OPTIMIZED: Fetch fresh API trades (fast, limited to ~1500)
    // Then SEPARATELY scan KV for large bets only (to catch whales we missed)
    let allTrades = [];
    let tradesSource = 'api';
    let kvLargeBets = [];
    
    // Step 1: Fetch fresh from API (primary source - fast)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    try {
      const tradesRes = await fetch(`${POLYMARKET_API}/trades?limit=${CONFIG.TRADE_LIMIT}`, {
        signal: controller.signal
      });
      if (tradesRes.ok) {
        allTrades = await tradesRes.json();
        console.log(`Fetched ${allTrades.length} trades from API`);
      }
    } catch (e) {
      console.log('API fetch failed:', e.message);
    } finally {
      clearTimeout(timeout);
    }
    
    // Step 2: Scan KV for LARGE BETS ONLY (>$25k) - these are what matter
    // This is separate from main scan to avoid memory issues
    try {
      const { trades: kvTrades, fromKV } = await getAccumulatedTrades(env, hours);
      if (fromKV && kvTrades.length > 0) {
        // Only extract large bets from KV (don't load everything into main scan)
        kvLargeBets = kvTrades.filter(t => {
          const usdValue = parseFloat(t.size) || 0;
          return usdValue >= 25000;
        });
        
        if (kvLargeBets.length > 0) {
          console.log(`Found ${kvLargeBets.length} large bets ($25k+) in KV`);
          
          // Merge large KV bets into allTrades if not already present
          const apiSet = new Set(allTrades.map(t => `${t.timestamp}-${t.proxyWallet}`));
          const newLargeBets = kvLargeBets.filter(t => {
            const key = `${t.ts || t.timestamp}-${t.proxyWallet}`;
            return !apiSet.has(key);
          }).map(t => ({
            // Convert KV format back to API format
            timestamp: t.ts || t.timestamp,
            slug: t.slug,
            eventSlug: t.eventSlug,
            title: t.title,
            outcome: t.outcome,
            outcomeIndex: t.outcomeIndex,
            side: t.side,
            price: t.price,
            size: t.size,
            usd_value: t.size,  // KV stores as 'size'
            proxyWallet: t.proxyWallet,
            icon: t.icon
          }));
          
          if (newLargeBets.length > 0) {
            allTrades = [...allTrades, ...newLargeBets];
            tradesSource = 'api+kv_whales';
            console.log(`Added ${newLargeBets.length} large bets from KV (total: ${allTrades.length})`);
          }
        }
      }
    } catch (kvErr) {
      console.log('KV large bet scan failed:', kvErr.message);
    }
    
    if (!allTrades || allTrades.length === 0) {
      return { success: true, signals: [], totalSignals: 0, message: 'No trades', processingTime: Date.now() - startTime };
    }
    
    // DEBUG: Log first trade to see structure
    if (allTrades.length > 0) {
      console.log('Sample trade structure:', JSON.stringify(allTrades[0]).slice(0, 500));
    }
    
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    
    // DEBUG counters
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
    
    // Group trades by market
    const marketMap = new Map();
    
    for (const t of allTrades) {
      const marketTitle = t.title || t.market || t.question || '';
      if (!marketTitle) { debugStats.noTitle++; }
      if (isGamblingMarket(marketTitle)) { debugStats.gambling++; continue; }
      
      let tradeTime = t.timestamp || t.createdAt || t.matchTime;
      if (typeof tradeTime === 'string') tradeTime = new Date(tradeTime).getTime();
      if (tradeTime && tradeTime < 1e10) tradeTime = tradeTime * 1000;
      if (!tradeTime) { debugStats.noTimestamp++; continue; }
      if (tradeTime < cutoffTime) { debugStats.oldTrade++; continue; }
      
      const price = parseFloat(t.price) || 0;
      if (price >= 0.95 || price <= 0.05) { debugStats.badPrice++; continue; }
      
      let usdValue = parseFloat(t.usd_value) || parseFloat(t.usdcSize) || parseFloat(t.size) || parseFloat(t.amount) || 0;
      if (usdValue < 10) { debugStats.tooSmall++; continue; }
      
      const slug = t.slug || t.eventSlug || t.market_slug || t.conditionId || '';
      if (sportsOnly && !isSportsGame(slug) && !isSportsGame(marketTitle)) continue;
      
      const marketKey = slug || marketTitle;
      if (!marketKey) { debugStats.noSlug++; continue; }
      
      debugStats.passed++;
      
      if (!marketMap.has(marketKey)) {
        marketMap.set(marketKey, {
          slug: marketKey,
          eventSlug: t.eventSlug,
          title: t.title,
          icon: t.icon,
          trades: [],
          wallets: new Set(),
          totalVolume: 0,
          largestBet: 0,
          largestBetOutcome: null,
          firstTradeTime: tradeTime,
          lastTradeTime: tradeTime,
          yesVolume: 0,
          noVolume: 0,
          outcomeVolumes: {}  // Track volume per outcome name (e.g., {"Panthers": 9003, "Bruins": 441})
        });
      }
      
      const market = marketMap.get(marketKey);
      
      // Keep top trades only (memory optimization)
      if (market.trades.length < CONFIG.MAX_TRADES_PER_MARKET) {
        market.trades.push({ 
          _usdValue: usdValue, 
          _tradeTime: tradeTime,
          price: t.price,
          outcome: t.outcome,
          outcomeIndex: t.outcomeIndex,  // 0 = Yes/Team1, 1 = No/Team2
          side: t.side,                   // BUY or SELL
          proxyWallet: t.proxyWallet
        });
      }
      
      market.totalVolume += usdValue;
      if (usdValue > market.largestBet) {
        market.largestBet = usdValue;
        market.largestBetOutcome = t.outcome || null;  // Track which outcome the biggest bet was on
      }
      market.firstTradeTime = Math.min(market.firstTradeTime, tradeTime);
      market.lastTradeTime = Math.max(market.lastTradeTime, tradeTime);
      
      const wallet = extractWallet(t);
      if (wallet) market.wallets.add(wallet);
      
      // Track volume per outcome - map Yes/No to team names for vs-format markets
      const outcomeName = t.outcome ? String(t.outcome) : '';
      const outcomeLower = outcomeName.toLowerCase();
      const isYesNo = outcomeLower === 'yes' || outcomeLower === 'no' || outcomeLower === 'true' || outcomeLower === 'false';
      
      if (isYesNo) {
        // Polymarket Data API returns "Yes"/"No" even for sports markets
        // Map to team names using the title: "Team1 vs Team2" → Yes=Team1, No=Team2
        const titleStr = market.title || t.title || '';
        const vsMatch = titleStr.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
        if (vsMatch) {
          // Sports market: map Yes/No to team names
          const team1 = vsMatch[1].trim();
          const team2 = vsMatch[2].trim();
          const isTeam1 = outcomeLower === 'yes' || outcomeLower === 'true';
          const teamName = isTeam1 ? team1 : team2;
          market.outcomeVolumes[teamName] = (market.outcomeVolumes[teamName] || 0) + usdValue;
        }
        // Track YES/NO volume using outcomeIndex (more reliable) or outcome string
        const isNo = t.outcomeIndex === 1 || outcomeLower === 'no' || outcomeLower === 'false';
        if (isNo) {
          market.noVolume += usdValue;
        } else {
          market.yesVolume += usdValue;
        }
      } else {
        // Non-Yes/No outcome (could be team name directly in some cases)
        market.outcomeVolumes[outcomeName] = (market.outcomeVolumes[outcomeName] || 0) + usdValue;
        if (isNoBetOutcome(t.outcome)) {
          market.noVolume += usdValue;
        } else {
          market.yesVolume += usdValue;
        }
      }
    }
    
    console.log(`Grouped into ${marketMap.size} markets`);
    
    // Score markets and build signals
    const allSignals = [];
    const sportsSignals = [];
    let signalsStored = 0;
    let walletsTracked = 0;
    
    for (const [slug, market] of marketMap) {
      const score = calculateSignalScore(market);
      if (score < minScore) continue;
      
      market.trades.sort((a, b) => b._usdValue - a._usdValue);
      
      // Check for winning wallets in this market
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
          outcomeIndex: t.outcomeIndex,  // 0=Yes/Team1, 1=No/Team2
          side: t.side,                   // BUY or SELL
          isWinner: walletCheck.isWinner,
          winnerInfo: walletCheck.isWinner ? walletCheck : null
        });
      }
      
      const direction = market.yesVolume > market.noVolume ? 'YES' : 'NO';
      const directionPercent = Math.round((Math.max(market.yesVolume, market.noVolume) / market.totalVolume) * 100);
      
      // Determine the DOMINANT outcome (which team/side the whales are actually betting on)
      // For sports markets, outcome is the team name (e.g., "Panthers"), not "Yes"/"No"
      const outcomeNames = Object.keys(market.outcomeVolumes);
      let dominantOutcome = null;
      let dominantOutcomeVolume = 0;
      for (const [name, vol] of Object.entries(market.outcomeVolumes)) {
        if (vol > dominantOutcomeVolume) {
          dominantOutcome = name;
          dominantOutcomeVolume = vol;
        }
      }
      
      // displayPrice = the entry price of the largest trade's outcome
      // trade.price on Polymarket = the price of THAT trade's outcome token
      // So if whale bought "Panthers" at price 0.56, displayPrice = 56 (Panthers' price)
      const rawPrice = market.trades[0] ? parseFloat(market.trades[0].price) : null;
      let displayPrice = null;
      if (rawPrice !== null) {
        displayPrice = Math.round(rawPrice * 100);
      }
      
      // For logging: which outcome did the biggest trade buy?
      const biggestTradeOutcome = market.trades[0]?.outcome || null;
      console.log(`Signal ${slug}: dominantOutcome=${dominantOutcome} (${dominantOutcomeVolume}), biggestTradeOutcome=${biggestTradeOutcome}, displayPrice=${displayPrice}, outcomeVolumes=${JSON.stringify(market.outcomeVolumes)}`);
      
      const marketType = detectMarketType(market.title || slug, slug);
      const scoreBreakdown = getScoreBreakdown(market, displayPrice, hasWinningWallet);
      
      // ============================================================
      // NEW: AI-POWERED SCORING
      // ============================================================
      const aiResult = await calculateAIScore(env, score, scoreBreakdown, marketType, hasWinningWallet);
      
      // Skip signals that AI says to hide (e.g., MMA with 0% historical WR)
      if (aiResult.shouldHide) {
        console.log(`Hiding signal ${slug}: dominated by weak factors (${aiResult.penaltyReasons.join(', ')})`);
        continue;
      }
      
      // Use AI-adjusted score
      const aiScore = aiResult.aiScore;
      
      // Calculate confidence with winning wallet boost
      let confidence = Math.round(50 + (aiScore / 100) * 25);
      
      // BOOST: Winning wallet adds 10-15% confidence
      if (hasWinningWallet && winningWalletInfo) {
        const walletBoost = Math.min(15, Math.round((winningWalletInfo.winRate - 50) / 3));
        confidence += walletBoost;
      }
      
      // AI learning enhancement
      try {
        if (typeof calculateConfidence === 'function' && env.SIGNALS_CACHE) {
          const factorNames = [...scoreBreakdown.map(f => f.factor), marketType];
          if (hasWinningWallet) factorNames.push('winningWallet');
          
          const confResult = await calculateConfidence(env, factorNames, {
            marketType,
            totalVolume: market.totalVolume,
            detectedAt: new Date(market.firstTradeTime).toISOString()
          });
          
          if (confResult && typeof confResult.confidence === 'number' && confResult.dataPoints >= 1) {
            confidence = Math.round(confResult.confidence * 0.6 + confidence * 0.4);
          }
        }
      } catch (e) {}
      
      confidence = Math.max(40, Math.min(95, Math.round(confidence)));
      
      const signal = {
        id: generateId(),
        marketSlug: slug,
        eventSlug: market.eventSlug || slug,  // Parent event slug for correct Polymarket URLs
        marketTitle: market.title || slug,
        icon: market.icon,
        score,                          // Original raw score
        aiScore,                        // AI-adjusted score (NEW!)
        aiMultiplier: aiResult.multiplier, // Show the multiplier (NEW!)
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
        isSportsSignal: marketType.startsWith('sports-'),
        // FIX: Accurate bet summary for vs-format markets
        // Use the ACTUAL outcome from trades, not the YES/NO direction guess
        // Polymarket sports trades have outcome = team name (e.g., "Panthers")
        betSummary: (() => {
          const title = market.title || slug;
          const vsMatch = title.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
          if (vsMatch) {
            const team1 = vsMatch[1].trim(); // YES token = Team 1
            const team2 = vsMatch[2].trim(); // NO token = Team 2
            
            // Determine which team the whales bet on using multiple signals:
            // 1. dominantOutcome from outcomeVolumes (now mapped to team names)
            // 2. Biggest trade's outcomeIndex (0=Team1, 1=Team2)
            // 3. Biggest trade's outcome mapped via Yes/No → team
            
            let whaleTeam = null;
            
            // BEST: Use dominantOutcome (volume-weighted, now has team names)
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
            
            // FALLBACK: Use biggest trade's outcome + outcomeIndex
            if (!whaleTeam && market.trades[0]) {
              const bigTrade = market.trades[0];
              const outLower = (bigTrade.outcome || '').toLowerCase();
              
              if (bigTrade.outcomeIndex === 0 || outLower === 'yes' || outLower === 'true') {
                whaleTeam = team1;
              } else if (bigTrade.outcomeIndex === 1 || outLower === 'no' || outLower === 'false') {
                whaleTeam = team2;
              } else {
                // Outcome might be a team name directly (some markets)
                const t1Lower = team1.toLowerCase();
                const t2Lower = team2.toLowerCase();
                if (t1Lower.includes(outLower) || outLower.includes(t1Lower)) {
                  whaleTeam = team1;
                } else if (t2Lower.includes(outLower) || outLower.includes(t2Lower)) {
                  whaleTeam = team2;
                }
              }
            }
            
            // LAST RESORT: use volume direction
            if (!whaleTeam) {
              whaleTeam = market.yesVolume >= market.noVolume ? team1 : team2;
            }
            
            // displayPrice = price of the outcome token the whale bought
            const entryPct = displayPrice ? `${displayPrice}%` : '';
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
            
            // Determine which team whales are betting on
            // Use same logic as betSummary: dominantOutcome (team names from outcomeVolumes)
            // or outcomeIndex from biggest trade
            let whaleTeam = team1; // default to team1
            
            // Use dominantOutcome (now properly mapped to team names)
            if (dominantOutcome) {
              const domLower = dominantOutcome.toLowerCase();
              const t2Lower = team2.toLowerCase();
              if (domLower === t2Lower || t2Lower.includes(domLower) || domLower.includes(t2Lower)) {
                whaleTeam = team2;
              }
            } else if (market.trades[0]) {
              // Fallback: use biggest trade's outcomeIndex
              const bigTrade = market.trades[0];
              const outLower = (bigTrade.outcome || '').toLowerCase();
              if (bigTrade.outcomeIndex === 1 || outLower === 'no' || outLower === 'false') {
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
              noPct: displayPrice ? (100 - displayPrice) : null
            };
          }
          return null;
        })()
      };
      
      allSignals.push(signal);
      
      // Separate sports signals for priority handling
      if (signal.isSportsSignal) {
        sportsSignals.push(signal);
      }
      
      // Store signal
      try {
        if (await storeSignalForSettlement(env, signal)) signalsStored++;
      } catch (e) {}
      
      // Track worthy wallets only
      for (const trade of topTrades.slice(0, 3)) {
        if (trade.wallet) {
          try {
            if (await trackWalletIfWorthy(env, trade.wallet, trade, signal)) walletsTracked++;
          } catch (e) {}
        }
      }
    }
    
    // Clear map to free memory
    marketMap.clear();
    
    // ============================================================
    // ENRICH SIGNALS WITH EVENT TIMING (start/end times)
    // Batch lookup from Gamma API with caching
    // ============================================================
    try {
      const slugsToLookup = allSignals.map(s => s.marketSlug).filter(Boolean);
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
      console.error('Event timing enrichment error:', e.message);
      // Non-fatal - signals still work without timing
    }
    
    // Sort all signals by score
    allSignals.sort((a, b) => {
      // Winning wallet signals first
      if (a.hasWinningWallet && !b.hasWinningWallet) return -1;
      if (!a.hasWinningWallet && b.hasWinningWallet) return 1;
      // Then by score
      return b.score - a.score;
    });
    
    // Sort sports signals separately and ensure top 15
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
      signalsWithWinners: allSignals.filter(s => s.hasWinningWallet).length,
      tradesProcessed: allTrades.length,
      tradesSource: 'api',
      signalsStored,
      walletsTracked,
      winningWalletsInCache: winningWallets.size,
      processingTime: Date.now() - startTime,
      marketsFound: marketMap.size,
      debug: includeDebug ? debugStats : undefined
    };
    
    await cacheScanResult(env, cacheKey, result);
    
    return result;
    
  } catch (e) {
    console.error('Scan error:', e);
    return { success: false, error: e.message, processingTime: Date.now() - startTime };
  }
}

// ============================================================
// SCORING
// ============================================================
function calculateSignalScore(market) {
  let score = 0;
  
  // Whale bet size
  if (market.largestBet >= 100000) score += 80;
  else if (market.largestBet >= 50000) score += 60;
  else if (market.largestBet >= 25000) score += 45;
  else if (market.largestBet >= 10000) score += 30;
  else if (market.largestBet >= 5000) score += 15;
  
  // Concentration
  const walletCount = market.wallets.size;
  if (walletCount === 1 && market.totalVolume >= 10000) score += 25;
  else if (walletCount <= 2 && market.totalVolume >= 20000) score += 15;
  else if (walletCount <= 5 && market.totalVolume >= 30000) score += 10;
  
  // Volume
  if (market.totalVolume >= 500000) score += 25;
  else if (market.totalVolume >= 100000) score += 15;
  else if (market.totalVolume >= 50000) score += 8;
  
  // One-sided action
  const dominantPercent = Math.max(market.yesVolume, market.noVolume) / market.totalVolume;
  if (dominantPercent >= 0.90) score += 15;
  else if (dominantPercent >= 0.80) score += 10;
  
  return Math.min(100, Math.round(score));
}

function getScoreBreakdown(market, displayPrice = 50, hasWinningWallet = false) {
  const breakdown = [];
  
  // Whale size
  if (market.largestBet >= 100000) breakdown.push({ factor: 'whaleSize100k', points: 80 });
  else if (market.largestBet >= 50000) breakdown.push({ factor: 'whaleSize50k', points: 60 });
  else if (market.largestBet >= 25000) breakdown.push({ factor: 'whaleSize25k', points: 45 });
  else if (market.largestBet >= 15000) breakdown.push({ factor: 'whaleSize15k', points: 30 });
  else if (market.largestBet >= 8000) breakdown.push({ factor: 'whaleSize8k', points: 20 });
  else if (market.largestBet >= 5000) breakdown.push({ factor: 'whaleSize5k', points: 15 });
  else if (market.largestBet >= 3000) breakdown.push({ factor: 'whaleSize3k', points: 10 });
  
  // Concentration
  const walletCount = market.wallets.size;
  if (walletCount === 1 && market.totalVolume >= 10000) breakdown.push({ factor: 'concentrated', points: 25 });
  else if (walletCount <= 2 && market.totalVolume >= 20000) breakdown.push({ factor: 'concentrated', points: 15 });
  
  // Volume
  if (market.totalVolume >= 500000) breakdown.push({ factor: 'volumeHuge', points: 25 });
  else if (market.totalVolume >= 100000) breakdown.push({ factor: 'vol_100k_plus', points: 20 });
  else if (market.totalVolume >= 50000) breakdown.push({ factor: 'vol_50k_100k', points: 15 });
  else if (market.totalVolume >= 25000) breakdown.push({ factor: 'vol_25k_50k', points: 12 });
  else if (market.totalVolume >= 10000) breakdown.push({ factor: 'vol_10k_25k', points: 10 });
  else breakdown.push({ factor: 'vol_under_10k', points: 5 });
  
  // === IMPROVEMENT #4: Split odds into DIRECTIONAL factors ===
  // Instead of one "extremeOdds" bucket, track buying cheap longshots vs expensive favorites separately
  const price = displayPrice || 50;
  const direction = market.yesVolume > market.noVolume ? 'YES' : 'NO';
  // effectivePrice = the price the whales are BUYING at
  // If direction=YES, they buy at displayPrice. If direction=NO, they buy at (100-displayPrice)
  const effectivePrice = direction === 'YES' ? price : (100 - price);
  
  if (effectivePrice <= 15) {
    breakdown.push({ factor: 'buyDeepLongshot', points: 35, desc: 'Buying at <15% (deep longshot)' });
  } else if (effectivePrice <= 25) {
    breakdown.push({ factor: 'buyLongshot', points: 20, desc: 'Buying at 15-25% (longshot)' });
  } else if (effectivePrice <= 40) {
    breakdown.push({ factor: 'buyUnderdog', points: 10, desc: 'Buying at 25-40% (underdog)' });
  } else if (effectivePrice >= 85) {
    breakdown.push({ factor: 'buyHeavyFavorite', points: 10, desc: 'Buying at 85%+ (heavy favorite)' });
  } else if (effectivePrice >= 70) {
    breakdown.push({ factor: 'buyFavorite', points: 8, desc: 'Buying at 70-85% (favorite)' });
  }
  // 40-70% range = no odds factor (fair price territory)
  
  // Keep legacy extremeOdds for backwards compat with existing stats (but lower points)
  if (price <= 15 || price >= 85) breakdown.push({ factor: 'extremeOdds', points: 5 });
  
  // === IMPROVEMENT #5: Time-to-event factors ===
  // How close to event start was the bet placed?
  if (market.slug) {
    const eventTiming = getEventTiming(market.slug, market.lastTradeTime);
    if (eventTiming) {
      breakdown.push(eventTiming);
    }
  }
  
  // WINNING WALLET FACTOR (high value!)
  if (hasWinningWallet) {
    breakdown.push({ factor: 'winningWallet', points: 30 });
  }
  
  return breakdown;
}

/**
 * IMPROVEMENT #5: Calculate time-to-event and return a timing factor
 * Bets placed close to game time are much more likely to be informed
 */
function getEventTiming(slug, lastTradeTime) {
  // Extract event date from slug (e.g., "nba-bos-lal-2026-02-03")
  const dateMatch = (slug || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) return null;
  
  const eventDate = new Date(
    parseInt(dateMatch[1]),
    parseInt(dateMatch[2]) - 1,
    parseInt(dateMatch[3])
  );
  
  // Estimate event start time based on sport
  // Most games start evening ET (7-10pm), so estimate 00:00-03:00 UTC next day
  // For afternoon games, ~5pm ET = 22:00 UTC
  // We'll use midnight UTC as a rough event start for the game date
  const estimatedEventStart = new Date(eventDate);
  estimatedEventStart.setUTCHours(24, 0, 0, 0); // End of event date UTC ≈ evening ET
  
  const tradeTime = typeof lastTradeTime === 'number' ? lastTradeTime : new Date(lastTradeTime).getTime();
  if (!tradeTime || isNaN(tradeTime)) return null;
  
  const hoursBeforeEvent = (estimatedEventStart.getTime() - tradeTime) / (1000 * 60 * 60);
  
  if (hoursBeforeEvent <= 0) {
    // Bet placed DURING or AFTER event (live betting / in-game)
    return { factor: 'betDuringEvent', points: 20, desc: 'Bet placed during/after event start' };
  } else if (hoursBeforeEvent <= 2) {
    // Within 2 hours of event start — very late money
    return { factor: 'betLast2Hours', points: 25, desc: 'Bet placed within 2h of event' };
  } else if (hoursBeforeEvent <= 6) {
    // Same day, close to game time
    return { factor: 'betSameDay', points: 15, desc: 'Bet placed same day (2-6h before)' };
  } else if (hoursBeforeEvent <= 24) {
    // Day before
    return { factor: 'betDayBefore', points: 8, desc: 'Bet placed day before event' };
  } else if (hoursBeforeEvent <= 72) {
    // 1-3 days before
    return { factor: 'betEarlyDays', points: 5, desc: 'Bet placed 1-3 days before event' };
  } else {
    // Very early bet (3+ days)
    return { factor: 'betVeryEarly', points: 3, desc: 'Bet placed 3+ days before event' };
  }
}

// ============================================================
// HELPER EXPORTS
// ============================================================
export async function getRecentSignals(env, limit = 20) {
  const cached = await getCachedScanResult(env, 'scan_result_48_40_all');
  if (cached && cached.signals) return cached.signals.slice(0, limit);
  const result = await runScan(24, 30, env, { sportsOnly: false });
  return result.signals?.slice(0, limit) || [];
}

export async function getSignal(env, signalId) {
  const cached = await getCachedScanResult(env, 'scan_result_48_40_all');
  if (cached && cached.signals) return cached.signals.find(s => s.id === signalId);
  return null;
}

export async function getPendingSignalsCount(env) {
  if (!env.SIGNALS_CACHE) return 0;
  try {
    const pending = await env.SIGNALS_CACHE.get(KV_KEYS.PENDING_SIGNALS, { type: 'json' }) || [];
    return pending.length;
  } catch (e) { return 0; }
}

export async function getTrackedWalletsCount(env) {
  if (!env.SIGNALS_CACHE) return 0;
  try {
    const index = await env.SIGNALS_CACHE.get('tracked_wallet_index', { type: 'json' }) || [];
    return index.length;
  } catch (e) { return 0; }
}
