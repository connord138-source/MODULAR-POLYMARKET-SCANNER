// ============================================================
// SIGNALS.JS - Signal Detection and Scoring
// ============================================================

import { POLYMARKET_API, SCORES, KV_KEYS } from './config.js';
import { detectMarketType, hasEventStarted, generateId, isSportsGame, classifyMarket } from './utils.js';
import { trackWalletBet } from './wallets.js';
import { calculateConfidence } from './learning.js';

// Main scan function
export async function runScan(hours, minScore, env, options = {}) {
  const startTime = Date.now();
  const { sportsOnly = false, includeDebug = false, includeStored = true } = options;
  
  try {
    // Fetch recent trades
    const tradesRes = await fetch(`${POLYMARKET_API}/trades?limit=2000`);
    if (!tradesRes.ok) {
      throw new Error(`Trades API error: ${tradesRes.status}`);
    }
    
    const trades = await tradesRes.json();
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const recentTrades = trades.filter(t => t.timestamp * 1000 > cutoffTime);
    
    // Group by market
    const marketGroups = {};
    let skippedFutures = 0;
    let skippedNonSports = 0;
    
    for (const trade of recentTrades) {
      const marketKey = trade.eventSlug || trade.slug || trade.market;
      if (!marketKey) continue;
      
      const title = trade.eventTitle || trade.title || marketKey;
      
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
      marketGroups[marketKey].totalVolume += parseFloat(trade.size || 0);
      marketGroups[marketKey].wallets.add(trade.maker || trade.taker);
    }
    
    // Analyze each market
    const newSignals = [];
    const debugInfo = [];
    const seenMarkets = new Set();
    
    for (const [slug, market] of Object.entries(marketGroups)) {
      const analysis = analyzeMarket(market);
      const classification = classifyMarket(market.title, slug);
      const marketType = detectMarketType(market.title, slug);
      
      seenMarkets.add(slug);
      
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
          isNoBet: analysis.isNoBet
        });
      }
      
      if (analysis.score >= minScore) {
        // Build signal object first
        const signal = {
          id: generateId(),
          marketSlug: slug,
          marketTitle: market.title,
          score: analysis.score,
          factors: analysis.factors,
          direction: analysis.direction,
          priceAtSignal: analysis.avgPrice,      // Current market YES price
          entryPrice: analysis.entryPrice,       // What they paid
          isNoBet: analysis.isNoBet,             // Whether they bet NO
          largestBet: analysis.largestBet,
          totalVolume: market.totalVolume,
          walletCount: market.wallets.size,
          wallets: Array.from(market.wallets).slice(0, 10),
          detectedAt: new Date().toISOString(),
          marketType: marketType,
          isGame: classification.isGame,
          classification: classification.reason,
          source: 'live'
        };
        
        // Calculate confidence based on ALL available data (factors, market type, volume, time)
        const factorNames = analysis.factors.map(f => f.name);
        const confidenceResult = await calculateConfidence(env, factorNames, signal);
        
        // Add confidence data to signal
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
          
          // Track wallets
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
    
    // Merge with stored signals (so they don't disappear)
    let allSignals = [...newSignals];
    const seenSlugs = new Set(newSignals.map(s => s.marketSlug));
    
    if (includeStored && env.SIGNALS_CACHE) {
      const storedSignals = await getRecentSignals(env, 50);
      const storedCutoff = Date.now() - (hours * 60 * 60 * 1000);
      
      for (const stored of storedSignals) {
        // Don't duplicate if we already have a signal for this market (by slug)
        if (seenSlugs.has(stored.marketSlug)) continue;
        if (seenMarkets.has(stored.marketSlug)) continue;
        
        // Only include if within time window
        const signalTime = new Date(stored.detectedAt).getTime();
        if (signalTime >= storedCutoff) {
          // Apply sportsOnly filter to stored signals too
          if (sportsOnly && !stored.isGame) continue;
          
          // Apply minScore filter
          if (stored.score < minScore) continue;
          
          allSignals.push({ ...stored, source: 'stored' });
          seenSlugs.add(stored.marketSlug);
        }
      }
    }
    
    // Final dedupe pass - keep highest scoring signal per market
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
      scanTime: Date.now() - startTime,
      tradesAnalyzed: recentTrades.length,
      marketsAnalyzed: Object.keys(marketGroups).length,
      signalsFound: allSignals.length,
      newSignals: newSignals.length,
      storedSignals: allSignals.length - newSignals.length,
      signals: allSignals.slice(0, 50),
      mode: sportsOnly ? 'sports-games-only' : 'all-markets'
    };
    
    if (sportsOnly) {
      result.filtered = {
        skippedFutures,
        skippedNonSports,
        gamesAnalyzed: Object.keys(marketGroups).length
      };
    }
    
    if (includeDebug) {
      result.debug = debugInfo.slice(0, 100);
    }
    
    return result;
    
  } catch (e) {
    return {
      success: false,
      error: e.message
    };
  }
}

// Analyze a market for signals
function analyzeMarket(market) {
  const { trades, totalVolume, wallets } = market;
  
  let score = 0;
  const factors = [];
  
  // Track prices and directions
  let largestBet = 0;
  let largestBetDirection = null;
  let largestBetPrice = 0;
  
  // Group trades by direction with their prices
  const directionData = {};
  
  for (const trade of trades) {
    const price = parseFloat(trade.price || 0);
    const size = parseFloat(trade.size || 0);
    const direction = trade.outcome || trade.side || 'unknown';
    
    if (size > largestBet) {
      largestBet = size;
      largestBetDirection = direction;
      largestBetPrice = price;
    }
    
    if (!directionData[direction]) {
      directionData[direction] = { volume: 0, totalPrice: 0, count: 0 };
    }
    directionData[direction].volume += size;
    directionData[direction].totalPrice += price;
    directionData[direction].count += 1;
  }
  
  // Determine dominant direction by volume
  let dominantDirection = largestBetDirection;
  let maxVolume = 0;
  for (const [dir, data] of Object.entries(directionData)) {
    if (data.volume > maxVolume) {
      maxVolume = data.volume;
      dominantDirection = dir;
    }
  }
  
  // Calculate the entry price for the dominant direction
  // This is what they paid (e.g., 77 cents for NO shares)
  const dominantData = directionData[dominantDirection] || { totalPrice: 0, count: 1 };
  const avgEntryPrice = dominantData.count > 0 
    ? Math.round((dominantData.totalPrice / dominantData.count) * 100) 
    : 50;
  
  // For display, we want to show the IMPLIED market price
  // If they bet NO at 77 cents, the YES price is ~23%
  // If they bet YES at 77 cents, the YES price is 77%
  let displayPrice = avgEntryPrice;
  
  // Normalize direction names
  const dirLower = (dominantDirection || '').toLowerCase();
  const isNoBet = dirLower === 'no' || dirLower === 'false' || dirLower === '0';
  
  // If they bet NO, the display should show what they're betting AGAINST
  // i.e., if NO is 77 cents, YES is ~23 cents
  if (isNoBet) {
    displayPrice = 100 - avgEntryPrice;
  }
  
  // Skip if event has started (use display price for this check)
  if (hasEventStarted(market.title, market.slug, displayPrice)) {
    return { score: 0, factors: [], direction: dominantDirection, avgPrice: displayPrice, entryPrice: avgEntryPrice, largestBet };
  }
  
  // Use entry price for scoring (what they actually paid)
  const priceForScoring = avgEntryPrice;
  
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
  
  // SCORING: Extreme odds (based on what they're betting ON, use displayPrice)
  // If they bet NO on a 5% YES market, they got great value (95% NO)
  // If they bet YES on a 5% market, that's a longshot
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
    avgPrice: displayPrice,      // Current market price (what YES is at)
    entryPrice: avgEntryPrice,   // What they paid
    largestBet,
    isNoBet                      // Whether they bet NO
  };
}

// Store signal in KV (deduped by marketSlug)
async function storeSignal(env, signal) {
  if (!env.SIGNALS_CACHE) return;
  
  try {
    // Use marketSlug as the dedup key, not signal.id
    // This prevents the same market from being stored multiple times
    const marketKey = "market_" + signal.marketSlug;
    
    // Check if we already have a signal for this market
    const existingMarketSignal = await env.SIGNALS_CACHE.get(marketKey, { type: "json" });
    
    if (existingMarketSignal) {
      // Update existing signal with fresh data if score is same or higher
      if (signal.score >= existingMarketSignal.score) {
        // Keep the original ID and detection time
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
      // If existing signal has higher score, don't overwrite
      return;
    }
    
    // New market - store it
    const key = KV_KEYS.SIGNALS_PREFIX + signal.id;
    await env.SIGNALS_CACHE.put(key, JSON.stringify(signal), {
      expirationTtl: 30 * 24 * 60 * 60 // 30 days
    });
    
    // Store market -> signal ID mapping
    await env.SIGNALS_CACHE.put(marketKey, JSON.stringify({ id: signal.id, score: signal.score }), {
      expirationTtl: 30 * 24 * 60 * 60
    });
    
    // Add to pending signals list
    let pending = await env.SIGNALS_CACHE.get(KV_KEYS.PENDING_SIGNALS, { type: "json" }) || [];
    if (!pending.includes(signal.id)) {
      pending.push(signal.id);
      // Keep last 500
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