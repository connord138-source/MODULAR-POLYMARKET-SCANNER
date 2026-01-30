// ============================================================
// SIGNALS.JS - Signal Detection and Scoring
// v18.4.7 - Increase trade limit, fix volume tracking
// ============================================================

import { POLYMARKET_API, SCORES, KV_KEYS } from './config.js';
import { detectMarketType, hasEventStarted, generateId, isSportsGame, classifyMarket } from './utils.js';
import { trackWalletBet } from './wallets.js';
import { calculateConfidence } from './learning.js';

// Helper to check if an outcome is a "NO" type bet
function isNoBetOutcome(outcome) {
  if (!outcome) return false;
  const lower = String(outcome).toLowerCase();
  return lower === 'no' || lower === 'false' || lower === '0';
}

// Helper to normalize price to implied YES price
function normalizeToYesPrice(rawPrice, outcome) {
  const price = parseFloat(rawPrice || 0);
  if (isNoBetOutcome(outcome)) {
    return 1 - price;
  }
  return price;
}

// Main scan function
export async function runScan(hours, minScore, env, options = {}) {
  const startTime = Date.now();
  const { sportsOnly = false, includeDebug = false, includeStored = true } = options;
  
  try {
    // INCREASED LIMIT: Fetch more trades to cover longer time periods
    // Polymarket can have 10k+ trades per hour during busy times
    const TRADE_LIMIT = 5000;
    
    const tradesRes = await fetch(`${POLYMARKET_API}/trades?limit=${TRADE_LIMIT}`);
    if (!tradesRes.ok) {
      throw new Error(`Trades API error: ${tradesRes.status}`);
    }
    
    const allTrades = await tradesRes.json();
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const recentTrades = allTrades.filter(t => t.timestamp * 1000 > cutoffTime);
    
    // Debug: Track what we're getting from API
    const apiStats = {
      totalFromApi: allTrades.length,
      withinTimeWindow: recentTrades.length,
      oldestTradeTime: allTrades.length > 0 ? new Date(allTrades[allTrades.length - 1].timestamp * 1000).toISOString() : null,
      newestTradeTime: allTrades.length > 0 ? new Date(allTrades[0].timestamp * 1000).toISOString() : null,
      cutoffTime: new Date(cutoffTime).toISOString()
    };
    
    // Group by market
    const marketGroups = {};
    let skippedFutures = 0;
    let skippedNonSports = 0;
    let skippedStarted = 0;
    let totalVolumeTracked = 0;
    
    for (const trade of recentTrades) {
      const marketKey = trade.eventSlug || trade.slug || trade.market;
      if (!marketKey) continue;
      
      const title = trade.eventTitle || trade.title || marketKey;
      const tradeSize = parseFloat(trade.size || 0);
      
      // If sportsOnly mode, filter out non-game markets
      if (sportsOnly) {
        const classification = classifyMarket(title, marketKey);
        
        // Skip futures/props
        if (!classification.isGame) {
          if (classification.marketType === 'futures') {
            skippedFutures++;
          } else {
            skippedNonSports++;
          }
          continue;
        }
      }
      
      if (!marketGroups[marketKey]) {
        marketGroups[marketKey] = {
          slug: marketKey,
          title: title,
          trades: [],
          totalVolume: 0,
          wallets: new Set()
        };
      }
      
      marketGroups[marketKey].trades.push(trade);
      marketGroups[marketKey].totalVolume += tradeSize;
      marketGroups[marketKey].wallets.add(trade.maker || trade.taker);
      totalVolumeTracked += tradeSize;
    }
    
    // Analyze each market
    const newSignals = [];
    const debugInfo = [];
    const seenMarkets = new Set();
    const skippedReasons = {};
    
    for (const [slug, market] of Object.entries(marketGroups)) {
      const analysis = analyzeMarket(market);
      const classification = classifyMarket(market.title, slug);
      const marketType = detectMarketType(market.title, slug);
      
      seenMarkets.add(slug);
      
      // Track why markets were skipped
      if (analysis.score < minScore) {
        const reason = `score_${Math.floor(analysis.score / 10) * 10}`;
        skippedReasons[reason] = (skippedReasons[reason] || 0) + 1;
      }
      
      if (includeDebug) {
        debugInfo.push({
          slug,
          title: market.title,
          score: analysis.score,
          isGame: classification.isGame,
          marketType,
          reason: classification.reason,
          volume: market.totalVolume,
          largestBet: analysis.largestBet,
          direction: analysis.direction,
          displayPrice: analysis.avgPrice,
          entryPrice: analysis.entryPrice,
          walletCount: market.wallets.size,
          tradeCount: market.trades.length,
          skippedBecause: analysis.score < minScore ? 'below_min_score' : (analysis.skippedReason || null)
        });
      }
      
      if (analysis.score >= minScore) {
        // Build signal object
        const signal = {
          id: generateId(),
          marketSlug: slug,
          marketTitle: market.title,
          score: analysis.score,
          factors: analysis.factors,
          direction: analysis.direction,
          priceAtSignal: analysis.avgPrice,
          entryPrice: analysis.entryPrice,
          isNoBet: analysis.isNoBet,
          largestBet: analysis.largestBet,
          totalVolume: market.totalVolume,
          walletCount: market.wallets.size,
          wallets: Array.from(market.wallets).slice(0, 10),
          topTrades: analysis.topTrades || [],
          detectedAt: new Date().toISOString(),
          marketType: marketType,
          isGame: classification.isGame,
          classification: classification.reason,
          source: 'live'
        };
        
        // Calculate confidence
        const factorNames = analysis.factors.map(f => f.name);
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
          
          for (const wallet of signal.wallets) {
            await trackWalletBet(env, wallet, {
              signalId: signal.id,
              market: signal.marketTitle,
              direction: signal.direction,
              amount: analysis.largestBet,
              price: analysis.avgPrice
            });
          }
        }
      }
    }
    
    // Merge with stored signals
    let allSignals = [...newSignals];
    const seenSlugs = new Set(newSignals.map(s => s.marketSlug));
    
    if (includeStored && env.SIGNALS_CACHE) {
      const storedSignals = await getRecentSignals(env, 50);
      const storedCutoff = Date.now() - (hours * 60 * 60 * 1000);
      
      for (const stored of storedSignals) {
        if (seenSlugs.has(stored.marketSlug)) continue;
        if (seenMarkets.has(stored.marketSlug)) continue;
        
        const signalTime = new Date(stored.detectedAt).getTime();
        if (signalTime >= storedCutoff) {
          if (sportsOnly && !stored.isGame) continue;
          if (stored.score < minScore) continue;
          
          allSignals.push({ ...stored, source: 'stored' });
          seenSlugs.add(stored.marketSlug);
        }
      }
    }
    
    // Dedupe by marketSlug
    const dedupedMap = new Map();
    for (const signal of allSignals) {
      const existing = dedupedMap.get(signal.marketSlug);
      if (!existing || signal.score > existing.score) {
        dedupedMap.set(signal.marketSlug, signal);
      }
    }
    allSignals = Array.from(dedupedMap.values());
    
    // Sort by score
    allSignals.sort((a, b) => b.score - a.score);
    
    const result = {
      success: true,
      version: "18.4.7",
      scanTime: Date.now() - startTime,
      tradesAnalyzed: recentTrades.length,
      marketsAnalyzed: Object.keys(marketGroups).length,
      signalsFound: allSignals.length,
      newSignals: newSignals.length,
      storedSignals: allSignals.length - newSignals.length,
      totalVolumeTracked: Math.round(totalVolumeTracked),
      signals: allSignals.slice(0, 50),
      mode: sportsOnly ? 'sports-games-only' : 'all-markets',
      apiStats  // NEW: Shows what we got from Polymarket API
    };
    
    if (sportsOnly) {
      result.filtered = {
        skippedFutures,
        skippedNonSports,
        skippedStarted,
        gamesAnalyzed: Object.keys(marketGroups).length
      };
    }
    
    if (includeDebug) {
      result.debug = debugInfo.slice(0, 100);
      result.skippedReasons = skippedReasons;
    }
    
    return result;
    
  } catch (e) {
    return {
      success: false,
      error: e.message,
      stack: e.stack
    };
  }
}

// Analyze a market for signals
function analyzeMarket(market) {
  const { trades, totalVolume, wallets } = market;
  
  let score = 0;
  const factors = [];
  let skippedReason = null;
  
  // Track prices and directions
  let largestBet = 0;
  let largestBetDirection = null;
  let largestBetPrice = 0;
  
  const directionData = {};
  const tradesList = [];
  
  for (const trade of trades) {
    const rawPrice = parseFloat(trade.price || 0);
    const size = parseFloat(trade.size || 0);
    const direction = trade.outcome || trade.side || 'unknown';
    const wallet = trade.maker || trade.taker || 'unknown';
    const timestamp = trade.timestamp ? new Date(trade.timestamp * 1000).toISOString() : new Date().toISOString();
    
    const normalizedPrice = normalizeToYesPrice(rawPrice, direction);
    
    if (size > largestBet) {
      largestBet = size;
      largestBetDirection = direction;
      largestBetPrice = rawPrice;
    }
    
    if (!directionData[direction]) {
      directionData[direction] = { volume: 0, totalPrice: 0, count: 0 };
    }
    directionData[direction].volume += size;
    directionData[direction].totalPrice += rawPrice;
    directionData[direction].count += 1;
    
    tradesList.push({
      wallet,
      amount: size,
      price: Math.round(normalizedPrice * 100),
      direction,
      time: timestamp,
      rawPrice: Math.round(rawPrice * 100),
      isNo: isNoBetOutcome(direction)
    });
  }
  
  const topTrades = tradesList
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
  
  // Determine dominant direction
  let dominantDirection = largestBetDirection;
  let maxVolume = 0;
  for (const [dir, data] of Object.entries(directionData)) {
    if (data.volume > maxVolume) {
      maxVolume = data.volume;
      dominantDirection = dir;
    }
  }
  
  const dominantData = directionData[dominantDirection] || { totalPrice: 0, count: 1 };
  const avgRawEntryPrice = dominantData.count > 0 
    ? (dominantData.totalPrice / dominantData.count)
    : 0.5;
  
  const dominantIsNoBet = isNoBetOutcome(dominantDirection);
  const normalizedEntryPrice = normalizeToYesPrice(avgRawEntryPrice, dominantDirection);
  const displayPrice = Math.round(normalizedEntryPrice * 100);
  const avgEntryPrice = displayPrice;
  
  // REMOVED: hasEventStarted check that was filtering too aggressively
  // The extreme price check (>95 or <5) was filtering legitimate bets
  // We'll let the frontend handle displaying "started" status instead
  
  // Only skip if the event date is clearly in the past
  const dateMatch = (market.slug || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    const eventDate = new Date(dateMatch[0]);
    const now = new Date();
    // Only skip if event date is more than 1 day ago
    if (eventDate < new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
      skippedReason = 'event_in_past';
      return { score: 0, factors: [], direction: dominantDirection, avgPrice: displayPrice, entryPrice: avgEntryPrice, largestBet, topTrades: [], skippedReason };
    }
  }
  
  // SCORING: Whale bet size
  if (largestBet >= 50000) {
    score += SCORES.WHALE_BET_MASSIVE;
    factors.push({ name: 'whaleSize50k', score: SCORES.WHALE_BET_MASSIVE, detail: `$${Math.round(largestBet/1000)}k bet` });
  } else if (largestBet >= 25000) {
    score += SCORES.WHALE_BET_LARGE;
    factors.push({ name: 'whaleSize25k', score: SCORES.WHALE_BET_LARGE, detail: `$${Math.round(largestBet/1000)}k bet` });
  } else if (largestBet >= 15000) {
    score += SCORES.WHALE_BET_NOTABLE;
    factors.push({ name: 'whaleSize15k', score: SCORES.WHALE_BET_NOTABLE, detail: `$${Math.round(largestBet/1000)}k bet` });
  } else if (largestBet >= 8000) {
    score += SCORES.WHALE_BET_MEDIUM;
    factors.push({ name: 'whaleSize8k', score: SCORES.WHALE_BET_MEDIUM, detail: `$${Math.round(largestBet/1000)}k bet` });
  } else if (largestBet >= 3000) {
    score += SCORES.WHALE_BET_SMALL;
    factors.push({ name: 'whaleSize3k', score: SCORES.WHALE_BET_SMALL, detail: `$${Math.round(largestBet/1000)}k bet` });
  }
  
  // SCORING: Volume
  if (totalVolume >= 100000) {
    score += SCORES.VOLUME_HUGE;
    factors.push({ name: 'volumeHuge', score: SCORES.VOLUME_HUGE, detail: `$${Math.round(totalVolume/1000)}k volume` });
  } else if (totalVolume >= 50000) {
    score += SCORES.VOLUME_NOTABLE;
    factors.push({ name: 'volumeNotable', score: SCORES.VOLUME_NOTABLE, detail: `$${Math.round(totalVolume/1000)}k volume` });
  } else if (totalVolume >= 20000) {
    score += SCORES.VOLUME_MODERATE;
    factors.push({ name: 'volumeModerate', score: SCORES.VOLUME_MODERATE, detail: `$${Math.round(totalVolume/1000)}k volume` });
  }
  
  // SCORING: Extreme odds
  if (displayPrice <= 15) {
    score += SCORES.EXTREME_LONGSHOT;
    factors.push({ name: 'extremeOdds', score: SCORES.EXTREME_LONGSHOT, detail: `Longshot at ${displayPrice}%` });
  } else if (displayPrice >= 85) {
    score += SCORES.EXTREME_HEAVY_FAVORITE;
    factors.push({ name: 'extremeOdds', score: SCORES.EXTREME_HEAVY_FAVORITE, detail: `Heavy favorite at ${displayPrice}%` });
  } else if (displayPrice <= 25) {
    score += SCORES.MODERATE_LONGSHOT;
    factors.push({ name: 'moderateLongshot', score: SCORES.MODERATE_LONGSHOT, detail: `Longshot at ${displayPrice}%` });
  } else if (displayPrice >= 75) {
    score += SCORES.MODERATE_FAVORITE;
    factors.push({ name: 'moderateFavorite', score: SCORES.MODERATE_FAVORITE, detail: `Favorite at ${displayPrice}%` });
  }
  
  // SCORING: Concentration
  if (wallets.size === 1 && largestBet >= 10000) {
    score += SCORES.CONCENTRATION_SINGLE_WHALE;
    factors.push({ name: 'concentrated', score: SCORES.CONCENTRATION_SINGLE_WHALE, detail: 'Single whale dominance' });
  } else if (wallets.size <= 2 && largestBet >= 5000) {
    score += SCORES.CONCENTRATION_WHALE_DUO;
    factors.push({ name: 'concentrated', score: SCORES.CONCENTRATION_WHALE_DUO, detail: 'Whale duo' });
  } else if (wallets.size <= 3 && largestBet >= 5000) {
    score += SCORES.CONCENTRATION_HIGH;
    factors.push({ name: 'concentrated', score: SCORES.CONCENTRATION_HIGH, detail: 'High concentration' });
  }
  
  return {
    score,
    factors,
    direction: dominantDirection,
    avgPrice: displayPrice,
    entryPrice: avgEntryPrice,
    largestBet,
    isNoBet: dominantIsNoBet,
    topTrades,
    skippedReason
  };
}

// Store signal in KV
async function storeSignal(env, signal) {
  if (!env.SIGNALS_CACHE) return;
  
  try {
    const marketKey = "market_" + signal.marketSlug;
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

// Get recent signals
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

// Get signal by ID
export async function getSignal(env, signalId) {
  if (!env.SIGNALS_CACHE || !signalId) return null;
  
  try {
    return await env.SIGNALS_CACHE.get(KV_KEYS.SIGNALS_PREFIX + signalId, { type: "json" });
  } catch (e) {
    console.error("Error getting signal:", e.message);
    return null;
  }
}
