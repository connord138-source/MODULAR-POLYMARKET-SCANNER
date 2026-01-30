// ============================================================
// SIGNALS.JS - Signal Detection and Scoring
// v18.5.0 - Port key features from monolithic version:
//   - Fresh wallet detection via activity API
//   - Filter extreme odds (sure bets)
//   - Proper wallet extraction (proxyWallet)
//   - Gambling market filtering
//   - Use accumulated trades from KV when available
// ============================================================

import { POLYMARKET_API, SCORES, KV_KEYS } from './config.js';
import { detectMarketType, hasEventStarted, generateId, isSportsGame, classifyMarket } from './utils.js';
import { trackWalletBet } from './wallets.js';
import { calculateConfidence } from './learning.js';
import { getAccumulatedTrades } from './trades.js';

// ============================================================
// GAMBLING MARKET FILTER
// Short-term gambling markets (crypto up/down, etc.) are noise
// ============================================================
const GAMBLING_KEYWORDS = [
  'up or down',
  'bitcoin up or down',
  'ethereum up or down', 
  'solana up or down',
  'xrp up or down',
  'btc up or down',
  'eth up or down',
  'sol up or down',
  '15m', '30m', '1h', '5m',  // Time-based gambling
  'next 15 minutes',
  'next 30 minutes',
  'next hour'
];

function isGamblingMarket(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  return GAMBLING_KEYWORDS.some(kw => lower.includes(kw));
}

// ============================================================
// WALLET HELPERS
// ============================================================

// Extract wallet address from trade object
function extractWallet(trade) {
  // Polymarket uses 'proxyWallet' field (discovered from API)
  const wallet = trade.proxyWallet || 
                 trade.user || 
                 trade.maker ||
                 trade.taker;
  
  if (wallet && typeof wallet === 'string' && wallet.length > 10) {
    return wallet;
  }
  return null;
}

// Check if an outcome is a "NO" type bet
function isNoBetOutcome(outcome) {
  if (!outcome) return false;
  const lower = String(outcome).toLowerCase();
  return lower === 'no' || lower === 'false' || lower === '0';
}

// Normalize price to implied YES price
function normalizeToYesPrice(rawPrice, outcome) {
  const price = parseFloat(rawPrice || 0);
  if (isNoBetOutcome(outcome)) {
    return 1 - price;
  }
  return price;
}

// ============================================================
// WALLET ACTIVITY FETCHING
// This is what made the old version powerful - detecting fresh wallets
// ============================================================

async function fetchWalletProfiles(wallets) {
  const profiles = {};
  
  // Process in batches of 10 to avoid rate limits
  for (let i = 0; i < wallets.length; i += 10) {
    const batch = wallets.slice(i, i + 10);
    
    await Promise.all(batch.map(async (wallet) => {
      if (!wallet) return;
      
      try {
        const res = await fetch(`${POLYMARKET_API}/activity?user=${wallet}&limit=20`);
        if (res.ok) {
          const activity = await res.json();
          const totalTrades = activity?.length || 0;
          profiles[wallet] = {
            totalTrades,
            isFresh: totalTrades < 10,
            isVeryFresh: totalTrades < 3
          };
        } else {
          // If we can't fetch, assume fresh (conservative)
          profiles[wallet] = { totalTrades: 0, isFresh: true, isVeryFresh: true };
        }
      } catch (e) {
        profiles[wallet] = { totalTrades: 0, isFresh: true, isVeryFresh: true };
      }
    }));
  }
  
  return profiles;
}

// ============================================================
// MAIN SCAN FUNCTION
// ============================================================

export async function runScan(hours, minScore, env, options = {}) {
  const startTime = Date.now();
  const { sportsOnly = false, includeDebug = false, includeStored = true } = options;
  
  try {
    // ============================================================
    // FETCH TRADES - Try accumulated KV first, fallback to API
    // ============================================================
    let allTrades = [];
    let tradesSource = 'api';
    
    // Try to get accumulated trades from KV
    const accumulated = await getAccumulatedTrades(env, hours);
    
    if (accumulated.fromKV && accumulated.trades.length > 100) {
      // Use accumulated trades if we have a decent amount
      allTrades = accumulated.trades;
      tradesSource = 'kv';
      console.log(`Using ${allTrades.length} accumulated trades from KV`);
    } else {
      // Fallback to direct API call
      const TRADE_LIMIT = 5000;
      const tradesRes = await fetch(`${POLYMARKET_API}/trades?limit=${TRADE_LIMIT}`);
      if (!tradesRes.ok) {
        throw new Error(`Trades API error: ${tradesRes.status}`);
      }
      allTrades = await tradesRes.json();
      console.log(`Using ${allTrades.length} trades from API (KV had ${accumulated.trades?.length || 0})`);
    }
    
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    
    // Debug stats
    const debugCounts = {
      total: allTrades.length,
      tooOld: 0,
      settlement: 0,
      sureBet: 0,
      tooSmall: 0,
      gamblingMarket: 0,
      passed: 0
    };
    
    // API stats for debugging
    const apiStats = {
      tradesSource,
      kvTradesAvailable: accumulated.trades?.length || 0,
      requestedLimit: tradesSource === 'api' ? 5000 : null,
      totalFromSource: allTrades.length,
      oldestTradeTime: allTrades.length > 0 ? new Date(allTrades[allTrades.length - 1].timestamp * 1000).toISOString() : null,
      newestTradeTime: allTrades.length > 0 ? new Date(allTrades[0].timestamp * 1000).toISOString() : null,
      cutoffTime: new Date(cutoffTime).toISOString()
    };
    
    // ============================================================
    // FILTER TRADES (matching old monolithic logic)
    // ============================================================
    const validTrades = [];
    
    for (const t of allTrades) {
      const marketTitle = t.title || t.market || '';
      
      // Filter gambling markets
      if (isGamblingMarket(marketTitle)) {
        debugCounts.gamblingMarket++;
        continue;
      }
      
      // Filter by time
      let tradeTime = t.timestamp;
      if (tradeTime && tradeTime < 1e10) {
        tradeTime = tradeTime * 1000; // Convert seconds to ms
      }
      if (!tradeTime || tradeTime < cutoffTime) {
        debugCounts.tooOld++;
        continue;
      }
      
      const price = parseFloat(t.price) || 0;
      
      // Filter settlement-level prices (basically resolved)
      if (price >= 0.99 || price <= 0.01) {
        debugCounts.settlement++;
        continue;
      }
      
      // Filter "sure bet" trades - odds too extreme to be meaningful
      // Betting at 85%+ is almost guaranteed to win - not real alpha
      if (price >= 0.85 || price <= 0.15) {
        debugCounts.sureBet++;
        continue;
      }
      
      // Calculate USD value
      let usdValue = parseFloat(t.usd_value) || 0;
      if (!usdValue && t.size && t.price) {
        usdValue = parseFloat(t.size) * parseFloat(t.price);
      }
      if (!usdValue && t.size) {
        usdValue = parseFloat(t.size);
      }
      
      // Filter tiny trades
      if (usdValue < 10) {
        debugCounts.tooSmall++;
        continue;
      }
      
      // Attach computed values
      t._tradeTime = tradeTime;
      t._usdValue = usdValue;
      
      debugCounts.passed++;
      validTrades.push(t);
    }
    
    apiStats.validTrades = validTrades.length;
    apiStats.filterStats = debugCounts;
    
    // If sportsOnly, filter further
    if (sportsOnly) {
      const sportsTrades = validTrades.filter(t => {
        const title = t.title || t.eventTitle || '';
        const slug = t.slug || t.eventSlug || '';
        const classification = classifyMarket(title, slug);
        return classification.isGame;
      });
      validTrades.length = 0;
      validTrades.push(...sportsTrades);
    }
    
    // ============================================================
    // FETCH WALLET PROFILES (fresh wallet detection)
    // ============================================================
    const uniqueWallets = [...new Set(validTrades.map(t => extractWallet(t)).filter(Boolean))].slice(0, 100);
    console.log(`Fetching profiles for ${uniqueWallets.length} unique wallets...`);
    
    const walletProfiles = await fetchWalletProfiles(uniqueWallets);
    
    const freshWalletCount = Object.values(walletProfiles).filter(p => p.isFresh).length;
    apiStats.uniqueWallets = uniqueWallets.length;
    apiStats.freshWallets = freshWalletCount;
    
    // ============================================================
    // GROUP TRADES BY MARKET + DIRECTION
    // ============================================================
    const groups = {};
    
    for (const t of validTrades) {
      const marketKey = t.slug || t.eventSlug || t.conditionId;
      const direction = t.outcome || (t.side === "BUY" ? "Yes" : "No");
      const key = `${marketKey}:${direction}`;
      
      if (!groups[key]) {
        groups[key] = {
          marketKey,
          marketTitle: t.title || t.eventTitle || "Unknown Market",
          marketSlug: t.slug || t.eventSlug,
          marketIcon: t.icon,
          direction,
          trades: [],
          wallets: new Set(),
          totalVolume: 0,
          largestBet: 0,
          timestamps: []
        };
      }
      
      const wallet = extractWallet(t);
      groups[key].trades.push(t);
      if (wallet) groups[key].wallets.add(wallet);
      groups[key].totalVolume += t._usdValue;
      groups[key].largestBet = Math.max(groups[key].largestBet, t._usdValue);
      groups[key].timestamps.push(t._tradeTime);
    }
    
    // ============================================================
    // SCORE EACH GROUP AND CREATE SIGNALS
    // ============================================================
    const newSignals = [];
    const debugInfo = [];
    
    for (const [key, g] of Object.entries(groups)) {
      // Skip gambling markets (double check)
      if (isGamblingMarket(g.marketTitle)) continue;
      
      let score = 0;
      const factors = [];
      const numWallets = g.wallets.size || 1;
      
      // Calculate wallet metrics
      const walletVolumes = {};
      let largestFreshWalletBet = 0;
      let freshWalletVolume = 0;
      
      for (const t of g.trades) {
        const wallet = extractWallet(t);
        if (wallet) {
          walletVolumes[wallet] = (walletVolumes[wallet] || 0) + t._usdValue;
          
          const profile = walletProfiles[wallet];
          if (profile?.isFresh) {
            freshWalletVolume += t._usdValue;
            largestFreshWalletBet = Math.max(largestFreshWalletBet, t._usdValue);
          }
        }
      }
      
      // Sort wallets by volume
      const sortedWalletVolumes = Object.values(walletVolumes).sort((a, b) => b - a);
      const topWalletVolume = sortedWalletVolumes[0] || 0;
      const topWalletPct = g.totalVolume > 0 ? topWalletVolume / g.totalVolume : 0;
      
      // Check if largest bet is from a fresh wallet
      const isLargestBetFresh = largestFreshWalletBet >= g.largestBet * 0.95;
      
      // ========== SCORING: FRESH WALLET OR WHALE BET ==========
      // Fresh wallet bets are MORE suspicious than regular whale bets
      if (isLargestBetFresh && largestFreshWalletBet >= 50000) {
        score += SCORES.FRESH_WHALE_HUGE;
        factors.push({ name: 'freshWhale50k', score: SCORES.FRESH_WHALE_HUGE, detail: `🚨 Fresh wallet $${Math.round(largestFreshWalletBet/1000)}k` });
      } else if (isLargestBetFresh && largestFreshWalletBet >= 25000) {
        score += SCORES.FRESH_WHALE_LARGE;
        factors.push({ name: 'freshWhale25k', score: SCORES.FRESH_WHALE_LARGE, detail: `🚨 Fresh wallet $${Math.round(largestFreshWalletBet/1000)}k` });
      } else if (isLargestBetFresh && largestFreshWalletBet >= 10000) {
        score += SCORES.FRESH_WHALE_NOTABLE;
        factors.push({ name: 'freshWhale10k', score: SCORES.FRESH_WHALE_NOTABLE, detail: `⚠️ Fresh wallet $${Math.round(largestFreshWalletBet/1000)}k` });
      } else if (isLargestBetFresh && largestFreshWalletBet >= 5000) {
        score += SCORES.FRESH_WHALE_MEDIUM;
        factors.push({ name: 'freshWhale5k', score: SCORES.FRESH_WHALE_MEDIUM, detail: `Fresh wallet $${Math.round(largestFreshWalletBet/1000)}k` });
      } else if (isLargestBetFresh && largestFreshWalletBet >= 2000) {
        score += SCORES.FRESH_WALLET_SMALL;
        factors.push({ name: 'freshWallet2k', score: SCORES.FRESH_WALLET_SMALL, detail: `Fresh wallet $${Math.round(largestFreshWalletBet/1000)}k` });
      } else if (g.largestBet >= 50000) {
        score += SCORES.WHALE_BET_MASSIVE;
        factors.push({ name: 'whaleSize50k', score: SCORES.WHALE_BET_MASSIVE, detail: `$${Math.round(g.largestBet/1000)}k bet` });
      } else if (g.largestBet >= 25000) {
        score += SCORES.WHALE_BET_LARGE;
        factors.push({ name: 'whaleSize25k', score: SCORES.WHALE_BET_LARGE, detail: `$${Math.round(g.largestBet/1000)}k bet` });
      } else if (g.largestBet >= 15000) {
        score += SCORES.WHALE_BET_NOTABLE;
        factors.push({ name: 'whaleSize15k', score: SCORES.WHALE_BET_NOTABLE, detail: `$${Math.round(g.largestBet/1000)}k bet` });
      } else if (g.largestBet >= 8000) {
        score += SCORES.WHALE_BET_MEDIUM;
        factors.push({ name: 'whaleSize8k', score: SCORES.WHALE_BET_MEDIUM, detail: `$${Math.round(g.largestBet/1000)}k bet` });
      } else if (g.largestBet >= 3000) {
        score += SCORES.WHALE_BET_SMALL;
        factors.push({ name: 'whaleSize3k', score: SCORES.WHALE_BET_SMALL, detail: `$${Math.round(g.largestBet/1000)}k bet` });
      }
      
      // ========== SCORING: CONCENTRATION ==========
      if (numWallets <= 2 && topWalletPct >= 0.80 && topWalletVolume >= 10000) {
        score += SCORES.CONCENTRATION_SINGLE_WHALE;
        factors.push({ name: 'concentrated', score: SCORES.CONCENTRATION_SINGLE_WHALE, detail: 'Single whale dominance' });
      } else if (numWallets === 2 && topWalletPct >= 0.50 && topWalletVolume >= 5000) {
        score += SCORES.CONCENTRATION_WHALE_DUO;
        factors.push({ name: 'concentrated', score: SCORES.CONCENTRATION_WHALE_DUO, detail: 'Whale duo' });
      } else if (topWalletPct >= 0.60 && topWalletVolume >= 5000) {
        score += SCORES.CONCENTRATION_HIGH;
        factors.push({ name: 'concentrated', score: SCORES.CONCENTRATION_HIGH, detail: 'High concentration' });
      }
      
      // ========== SCORING: VOLUME ==========
      if (g.totalVolume >= 100000) {
        score += SCORES.VOLUME_HUGE;
        factors.push({ name: 'volumeHuge', score: SCORES.VOLUME_HUGE, detail: `$${Math.round(g.totalVolume/1000)}k volume` });
      } else if (g.totalVolume >= 50000) {
        score += SCORES.VOLUME_NOTABLE;
        factors.push({ name: 'volumeNotable', score: SCORES.VOLUME_NOTABLE, detail: `$${Math.round(g.totalVolume/1000)}k volume` });
      } else if (g.totalVolume >= 20000) {
        score += SCORES.VOLUME_MODERATE;
        factors.push({ name: 'volumeModerate', score: SCORES.VOLUME_MODERATE, detail: `$${Math.round(g.totalVolume/1000)}k volume` });
      }
      
      // ========== SCORING: COORDINATED ACTION ==========
      if (numWallets >= 3 && g.timestamps.length >= 3) {
        const sortedTimes = [...g.timestamps].sort((a, b) => a - b);
        const timeSpan = sortedTimes[sortedTimes.length - 1] - sortedTimes[0];
        const avgTimeBetween = timeSpan / (sortedTimes.length - 1);
        
        // If 3+ wallets bet within 5 minutes with $10k+ each
        if (timeSpan < 5 * 60 * 1000 && g.largestBet >= 10000) {
          score += SCORES.COORDINATED_WHALES;
          factors.push({ name: 'coordinated', score: SCORES.COORDINATED_WHALES, detail: `${numWallets} wallets in ${Math.round(timeSpan/1000)}s` });
        } else if (timeSpan < 15 * 60 * 1000 && g.totalVolume >= 20000) {
          score += SCORES.COORDINATED_LARGE;
          factors.push({ name: 'coordinated', score: SCORES.COORDINATED_LARGE, detail: `Coordinated buying` });
        }
      }
      
      // Get average entry price (normalized)
      const avgPrice = g.trades.length > 0 
        ? g.trades.reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0) / g.trades.length
        : 0.5;
      const displayPrice = Math.round(normalizeToYesPrice(avgPrice, g.direction) * 100);
      
      // Build top trades list
      const topTrades = g.trades
        .map(t => ({
          wallet: extractWallet(t) || 'unknown',
          amount: t._usdValue,
          price: Math.round(normalizeToYesPrice(parseFloat(t.price) || 0, t.outcome || g.direction) * 100),
          direction: t.outcome || g.direction,
          time: new Date(t._tradeTime).toISOString(),
          isFresh: walletProfiles[extractWallet(t)]?.isFresh || false
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);
      
      // Classification
      const classification = classifyMarket(g.marketTitle, g.marketSlug);
      const marketType = detectMarketType(g.marketTitle, g.marketSlug);
      
      if (includeDebug) {
        debugInfo.push({
          slug: g.marketSlug,
          title: g.marketTitle,
          direction: g.direction,
          score,
          volume: g.totalVolume,
          largestBet: g.largestBet,
          walletCount: numWallets,
          freshWalletBet: largestFreshWalletBet,
          isGame: classification.isGame,
          marketType
        });
      }
      
      // Only create signal if meets threshold
      if (score >= minScore) {
        const walletArray = Array.from(g.wallets).filter(Boolean);
        
        const signal = {
          id: generateId(),
          marketSlug: g.marketSlug,
          marketTitle: g.marketTitle,
          score,
          factors,
          direction: g.direction,
          priceAtSignal: displayPrice,
          entryPrice: displayPrice,
          isNoBet: isNoBetOutcome(g.direction),
          largestBet: g.largestBet,
          totalVolume: g.totalVolume,
          walletCount: walletArray.length,
          wallets: walletArray.slice(0, 10),
          topTrades,
          freshWalletBet: largestFreshWalletBet,
          detectedAt: new Date().toISOString(),
          marketType,
          isGame: classification.isGame,
          classification: classification.reason,
          source: 'live'
        };
        
        // Calculate confidence
        const factorNames = factors.map(f => f.name);
        const confidenceResult = await calculateConfidence(env, factorNames, signal);
        
        if (confidenceResult) {
          signal.confidence = confidenceResult.confidence;
          signal.confidenceComponents = confidenceResult.components;
          signal.confidenceDataPoints = confidenceResult.dataPoints;
        } else {
          signal.confidence = null;
        }
        
        newSignals.push(signal);
        
        // Store signal and track wallets
        if (env.SIGNALS_CACHE) {
          await storeSignal(env, signal);
          
          for (const wallet of walletArray.slice(0, 10)) {
            if (wallet) {
              await trackWalletBet(env, wallet, {
                signalId: signal.id,
                market: signal.marketTitle,
                direction: signal.direction,
                amount: g.largestBet,
                price: displayPrice
              });
            }
          }
        }
      }
    }
    
    // ============================================================
    // MERGE WITH STORED SIGNALS
    // ============================================================
    let allSignals = [...newSignals];
    const seenSlugs = new Set(newSignals.map(s => `${s.marketSlug}:${s.direction}`));
    
    if (includeStored && env.SIGNALS_CACHE) {
      const storedSignals = await getRecentSignals(env, 50);
      const storedCutoff = Date.now() - (hours * 60 * 60 * 1000);
      
      for (const stored of storedSignals) {
        const key = `${stored.marketSlug}:${stored.direction}`;
        if (seenSlugs.has(key)) continue;
        
        const signalTime = new Date(stored.detectedAt).getTime();
        if (signalTime >= storedCutoff) {
          if (sportsOnly && !stored.isGame) continue;
          if (stored.score < minScore) continue;
          
          allSignals.push({ ...stored, source: 'stored' });
          seenSlugs.add(key);
        }
      }
    }
    
    // Sort by score
    allSignals.sort((a, b) => b.score - a.score);
    
    // Calculate total volume
    const totalVolumeTracked = Object.values(groups).reduce((sum, g) => sum + g.totalVolume, 0);
    
    const result = {
      success: true,
      version: "18.5.0",
      scanTime: Date.now() - startTime,
      tradesAnalyzed: validTrades.length,
      marketsAnalyzed: Object.keys(groups).length,
      signalsFound: allSignals.length,
      newSignals: newSignals.length,
      storedSignals: allSignals.length - newSignals.length,
      totalVolumeTracked: Math.round(totalVolumeTracked),
      signals: allSignals.slice(0, 50),
      mode: sportsOnly ? 'sports-games-only' : 'all-markets',
      apiStats
    };
    
    if (includeDebug) {
      result.debug = debugInfo
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 100);
    }
    
    return result;
    
  } catch (e) {
    console.error("Scan error:", e);
    return {
      success: false,
      error: e.message,
      stack: e.stack
    };
  }
}

// ============================================================
// KV STORAGE FUNCTIONS
// ============================================================

async function storeSignal(env, signal) {
  if (!env.SIGNALS_CACHE) return;
  
  try {
    const marketKey = "market_" + signal.marketSlug + "_" + signal.direction;
    const existingMarketSignal = await env.SIGNALS_CACHE.get(marketKey, { type: "json" });
    
    if (existingMarketSignal) {
      if (signal.score >= existingMarketSignal.score) {
        signal.id = existingMarketSignal.id;
        signal.detectedAt = existingMarketSignal.detectedAt;
        signal.updatedAt = new Date().toISOString();
        
        const key = KV_KEYS.SIGNALS_PREFIX + signal.id;
        await env.SIGNALS_CACHE.put(key, JSON.stringify(signal), {
          expirationTtl: 30 * 24 * 60 * 60
        });
        await env.SIGNALS_CACHE.put(marketKey, JSON.stringify({ id: signal.id, score: signal.score }), {
          expirationTtl: 30 * 24 * 60 * 60
        });
      }
      return;
    }
    
    const key = KV_KEYS.SIGNALS_PREFIX + signal.id;
    await env.SIGNALS_CACHE.put(key, JSON.stringify(signal), {
      expirationTtl: 30 * 24 * 60 * 60
    });
    
    await env.SIGNALS_CACHE.put(marketKey, JSON.stringify({ id: signal.id, score: signal.score }), {
      expirationTtl: 30 * 24 * 60 * 60
    });
    
    let pending = await env.SIGNALS_CACHE.get(KV_KEYS.PENDING_SIGNALS, { type: "json" }) || [];
    if (!pending.includes(signal.id)) {
      pending.push(signal.id);
      if (pending.length > 500) {
        pending = pending.slice(-500);
      }
      await env.SIGNALS_CACHE.put(KV_KEYS.PENDING_SIGNALS, JSON.stringify(pending), {
        expirationTtl: 30 * 24 * 60 * 60
      });
    }
  } catch (e) {
    console.error("Error storing signal:", e.message);
  }
}

export async function getRecentSignals(env, limit = 20) {
  if (!env.SIGNALS_CACHE) return [];
  
  try {
    const pending = await env.SIGNALS_CACHE.get(KV_KEYS.PENDING_SIGNALS, { type: "json" }) || [];
    const signals = [];
    
    for (const id of pending.slice(-limit).reverse()) {
      const signal = await env.SIGNALS_CACHE.get(KV_KEYS.SIGNALS_PREFIX + id, { type: "json" });
      if (signal) {
        signals.push(signal);
      }
    }
    
    return signals;
  } catch (e) {
    console.error("Error getting recent signals:", e.message);
    return [];
  }
}

export async function getSignal(env, signalId) {
  if (!env.SIGNALS_CACHE || !signalId) return null;
  
  try {
    return await env.SIGNALS_CACHE.get(KV_KEYS.SIGNALS_PREFIX + signalId, { type: "json" });
  } catch (e) {
    console.error("Error getting signal:", e.message);
    return null;
  }
}
