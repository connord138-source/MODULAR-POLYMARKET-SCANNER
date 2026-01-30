// ============================================================
// LEARNING.JS - AI Learning, Factor Stats, Confidence & Trend Discovery
// ============================================================

import { KV_KEYS } from './config.js';

// KV keys for learning system
const LEARNING_KEYS = {
  FACTOR_STATS: KV_KEYS.FACTOR_STATS,
  DISCOVERED_PATTERNS: "discovered_patterns",
  PATTERN_CANDIDATES: "pattern_candidates",
  MARKET_TYPE_STATS: "market_type_stats",
  TIME_PATTERNS: "time_patterns",
  VOLUME_BRACKETS: "volume_brackets"
};

/**
 * Update factor statistics when a signal settles
 */
export async function updateFactorStats(env, factors, outcome) {
  if (!env.SIGNALS_CACHE || !factors || factors.length === 0) return;
  
  try {
    let factorStats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.FACTOR_STATS, { type: "json" }) || {};
    
    for (const factor of factors) {
      const factorName = typeof factor === 'object' ? factor.name : factor;
      if (!factorName) continue;
      
      if (!factorStats[factorName]) {
        factorStats[factorName] = {
          wins: 0,
          losses: 0,
          winRate: 50,
          weight: 1.0,
          sampleSize: 0,
          lastUpdated: null,
          isDiscovered: false  // Track if this was auto-discovered
        };
      }
      
      if (outcome === "WIN") {
        factorStats[factorName].wins += 1;
      } else {
        factorStats[factorName].losses += 1;
      }
      
      const total = factorStats[factorName].wins + factorStats[factorName].losses;
      factorStats[factorName].sampleSize = total;
      factorStats[factorName].winRate = Math.round((factorStats[factorName].wins / total) * 100);
      
      // Dynamic weight based on performance AND sample size
      // More data = more confidence in the weight
      const sampleMultiplier = Math.min(1, total / 10); // Full weight at 10+ samples
      const performanceWeight = 0.5 + (factorStats[factorName].winRate / 100) * 1.5;
      factorStats[factorName].weight = 0.5 + (performanceWeight - 0.5) * sampleMultiplier;
      
      factorStats[factorName].lastUpdated = new Date().toISOString();
    }
    
    await env.SIGNALS_CACHE.put(LEARNING_KEYS.FACTOR_STATS, JSON.stringify(factorStats), {
      expirationTtl: 90 * 24 * 60 * 60
    });
    
    return factorStats;
  } catch (e) {
    console.error("Error updating factor stats:", e.message);
    return null;
  }
}

/**
 * Track additional signal metadata for pattern discovery
 */
export async function trackSignalMetadata(env, signal, outcome) {
  if (!env.SIGNALS_CACHE) return;
  
  try {
    // Track market type performance
    await trackMarketTypePerformance(env, signal.marketType, outcome);
    
    // Track volume bracket performance
    await trackVolumeBracket(env, signal.totalVolume, outcome);
    
    // Track time-of-day patterns
    await trackTimePattern(env, signal.detectedAt, outcome);
    
    // Track wallet count patterns
    await trackWalletCountPattern(env, signal.walletCount, outcome);
    
    // Check for new pattern discoveries
    await discoverNewPatterns(env);
    
  } catch (e) {
    console.error("Error tracking signal metadata:", e.message);
  }
}

/**
 * Track market type performance (sports-nba, crypto, politics, etc.)
 */
async function trackMarketTypePerformance(env, marketType, outcome) {
  if (!marketType) return;
  
  let stats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.MARKET_TYPE_STATS, { type: "json" }) || {};
  
  if (!stats[marketType]) {
    stats[marketType] = { wins: 0, losses: 0, winRate: 50 };
  }
  
  if (outcome === "WIN") stats[marketType].wins++;
  else stats[marketType].losses++;
  
  const total = stats[marketType].wins + stats[marketType].losses;
  stats[marketType].winRate = Math.round((stats[marketType].wins / total) * 100);
  
  await env.SIGNALS_CACHE.put(LEARNING_KEYS.MARKET_TYPE_STATS, JSON.stringify(stats), {
    expirationTtl: 90 * 24 * 60 * 60
  });
}

/**
 * Track volume bracket performance
 */
async function trackVolumeBracket(env, volume, outcome) {
  let stats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.VOLUME_BRACKETS, { type: "json" }) || {};
  
  // Define volume brackets
  let bracket;
  if (volume >= 100000) bracket = "vol_100k_plus";
  else if (volume >= 50000) bracket = "vol_50k_100k";
  else if (volume >= 25000) bracket = "vol_25k_50k";
  else if (volume >= 10000) bracket = "vol_10k_25k";
  else bracket = "vol_under_10k";
  
  if (!stats[bracket]) {
    stats[bracket] = { wins: 0, losses: 0, winRate: 50 };
  }
  
  if (outcome === "WIN") stats[bracket].wins++;
  else stats[bracket].losses++;
  
  const total = stats[bracket].wins + stats[bracket].losses;
  stats[bracket].winRate = Math.round((stats[bracket].wins / total) * 100);
  
  await env.SIGNALS_CACHE.put(LEARNING_KEYS.VOLUME_BRACKETS, JSON.stringify(stats), {
    expirationTtl: 90 * 24 * 60 * 60
  });
}

/**
 * Track time-of-day patterns
 */
async function trackTimePattern(env, detectedAt, outcome) {
  if (!detectedAt) return;
  
  let stats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.TIME_PATTERNS, { type: "json" }) || {};
  
  const hour = new Date(detectedAt).getUTCHours();
  let timeBlock;
  if (hour >= 5 && hour < 12) timeBlock = "morning_5_12";
  else if (hour >= 12 && hour < 17) timeBlock = "afternoon_12_17";
  else if (hour >= 17 && hour < 22) timeBlock = "evening_17_22";
  else timeBlock = "night_22_5";
  
  // Also track day of week
  const day = new Date(detectedAt).getUTCDay();
  const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][day];
  
  for (const pattern of [timeBlock, `day_${dayName}`]) {
    if (!stats[pattern]) {
      stats[pattern] = { wins: 0, losses: 0, winRate: 50 };
    }
    
    if (outcome === "WIN") stats[pattern].wins++;
    else stats[pattern].losses++;
    
    const total = stats[pattern].wins + stats[pattern].losses;
    stats[pattern].winRate = Math.round((stats[pattern].wins / total) * 100);
  }
  
  await env.SIGNALS_CACHE.put(LEARNING_KEYS.TIME_PATTERNS, JSON.stringify(stats), {
    expirationTtl: 90 * 24 * 60 * 60
  });
}

/**
 * Track wallet count patterns
 */
async function trackWalletCountPattern(env, walletCount, outcome) {
  let stats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.PATTERN_CANDIDATES, { type: "json" }) || {};
  
  let pattern;
  if (walletCount === 1) pattern = "single_wallet";
  else if (walletCount === 2) pattern = "two_wallets";
  else if (walletCount <= 5) pattern = "few_wallets_3_5";
  else pattern = "many_wallets_6_plus";
  
  if (!stats[pattern]) {
    stats[pattern] = { wins: 0, losses: 0, winRate: 50, category: "wallet_count" };
  }
  
  if (outcome === "WIN") stats[pattern].wins++;
  else stats[pattern].losses++;
  
  const total = stats[pattern].wins + stats[pattern].losses;
  stats[pattern].winRate = Math.round((stats[pattern].wins / total) * 100);
  
  await env.SIGNALS_CACHE.put(LEARNING_KEYS.PATTERN_CANDIDATES, JSON.stringify(stats), {
    expirationTtl: 90 * 24 * 60 * 60
  });
}

/**
 * Discover new patterns that should be promoted to official factors
 */
async function discoverNewPatterns(env) {
  try {
    const candidates = await env.SIGNALS_CACHE.get(LEARNING_KEYS.PATTERN_CANDIDATES, { type: "json" }) || {};
    const timePatterns = await env.SIGNALS_CACHE.get(LEARNING_KEYS.TIME_PATTERNS, { type: "json" }) || {};
    const volumeBrackets = await env.SIGNALS_CACHE.get(LEARNING_KEYS.VOLUME_BRACKETS, { type: "json" }) || {};
    const marketTypes = await env.SIGNALS_CACHE.get(LEARNING_KEYS.MARKET_TYPE_STATS, { type: "json" }) || {};
    
    let factorStats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.FACTOR_STATS, { type: "json" }) || {};
    let discovered = await env.SIGNALS_CACHE.get(LEARNING_KEYS.DISCOVERED_PATTERNS, { type: "json" }) || [];
    
    // Check all pattern sources for promotable patterns
    const allPatterns = { ...candidates, ...timePatterns, ...volumeBrackets, ...marketTypes };
    
    for (const [patternName, stats] of Object.entries(allPatterns)) {
      const total = (stats.wins || 0) + (stats.losses || 0);
      
      // Promote pattern to official factor if:
      // 1. At least 10 samples
      // 2. Win rate >= 60% OR <= 35% (strong signal either way)
      // 3. Not already a factor
      if (total >= 10 && !factorStats[patternName]) {
        if (stats.winRate >= 60 || stats.winRate <= 35) {
          factorStats[patternName] = {
            wins: stats.wins,
            losses: stats.losses,
            winRate: stats.winRate,
            weight: 0.5 + (stats.winRate / 100) * 1.5,
            sampleSize: total,
            lastUpdated: new Date().toISOString(),
            isDiscovered: true,
            discoveredAt: new Date().toISOString(),
            category: stats.category || "auto_discovered"
          };
          
          if (!discovered.includes(patternName)) {
            discovered.push(patternName);
          }
          
          console.log(`🔍 Discovered new pattern: ${patternName} (${stats.winRate}% over ${total} samples)`);
        }
      }
    }
    
    await env.SIGNALS_CACHE.put(LEARNING_KEYS.FACTOR_STATS, JSON.stringify(factorStats), {
      expirationTtl: 90 * 24 * 60 * 60
    });
    
    await env.SIGNALS_CACHE.put(LEARNING_KEYS.DISCOVERED_PATTERNS, JSON.stringify(discovered), {
      expirationTtl: 90 * 24 * 60 * 60
    });
    
  } catch (e) {
    console.error("Error discovering patterns:", e.message);
  }
}

/**
 * Calculate confidence score for a signal based on ALL available data
 */
export async function calculateConfidence(env, factors, signal = {}) {
  if (!env.SIGNALS_CACHE) return null;
  
  try {
    const factorStats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.FACTOR_STATS, { type: "json" }) || {};
    const marketTypeStats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.MARKET_TYPE_STATS, { type: "json" }) || {};
    const volumeBrackets = await env.SIGNALS_CACHE.get(LEARNING_KEYS.VOLUME_BRACKETS, { type: "json" }) || {};
    const timePatterns = await env.SIGNALS_CACHE.get(LEARNING_KEYS.TIME_PATTERNS, { type: "json" }) || {};
    
    let components = [];
    
    // 1. Factor-based confidence (primary)
    if (factors && factors.length > 0) {
      let totalWeight = 0;
      let weightedWinRate = 0;
      
      for (const factor of factors) {
        const factorName = typeof factor === 'object' ? factor.name : factor;
        if (!factorName) continue;
        
        const stats = factorStats[factorName];
        if (stats && stats.sampleSize >= 3) {
          const weight = stats.weight || 1.0;
          totalWeight += weight;
          weightedWinRate += stats.winRate * weight;
        }
      }
      
      if (totalWeight > 0) {
        components.push({
          source: 'factors',
          confidence: Math.round(weightedWinRate / totalWeight),
          weight: 3  // Factors are most important
        });
      }
    }
    
    // 2. Market type confidence
    if (signal.marketType && marketTypeStats[signal.marketType]) {
      const stats = marketTypeStats[signal.marketType];
      if ((stats.wins + stats.losses) >= 5) {
        components.push({
          source: 'market_type',
          confidence: stats.winRate,
          weight: 1
        });
      }
    }
    
    // 3. Volume bracket confidence
    if (signal.totalVolume) {
      let bracket;
      if (signal.totalVolume >= 100000) bracket = "vol_100k_plus";
      else if (signal.totalVolume >= 50000) bracket = "vol_50k_100k";
      else if (signal.totalVolume >= 25000) bracket = "vol_25k_50k";
      else if (signal.totalVolume >= 10000) bracket = "vol_10k_25k";
      else bracket = "vol_under_10k";
      
      if (volumeBrackets[bracket]) {
        const stats = volumeBrackets[bracket];
        if ((stats.wins + stats.losses) >= 5) {
          components.push({
            source: 'volume',
            confidence: stats.winRate,
            weight: 1
          });
        }
      }
    }
    
    // 4. Time pattern confidence
    if (signal.detectedAt) {
      const hour = new Date(signal.detectedAt).getUTCHours();
      let timeBlock;
      if (hour >= 5 && hour < 12) timeBlock = "morning_5_12";
      else if (hour >= 12 && hour < 17) timeBlock = "afternoon_12_17";
      else if (hour >= 17 && hour < 22) timeBlock = "evening_17_22";
      else timeBlock = "night_22_5";
      
      if (timePatterns[timeBlock]) {
        const stats = timePatterns[timeBlock];
        if ((stats.wins + stats.losses) >= 5) {
          components.push({
            source: 'time',
            confidence: stats.winRate,
            weight: 0.5
          });
        }
      }
    }
    
    // Calculate weighted average confidence
    if (components.length === 0) {
      return null;  // Not enough data
    }
    
    let totalWeight = 0;
    let weightedConfidence = 0;
    
    for (const comp of components) {
      totalWeight += comp.weight;
      weightedConfidence += comp.confidence * comp.weight;
    }
    
    const finalConfidence = Math.round(weightedConfidence / totalWeight);
    
    return {
      confidence: Math.max(0, Math.min(100, finalConfidence)),
      components,
      dataPoints: components.length
    };
  } catch (e) {
    console.error("Error calculating confidence:", e.message);
    return null;
  }
}

/**
 * Get factor statistics
 */
export async function getFactorStats(env) {
  if (!env.SIGNALS_CACHE) return {};
  
  try {
    return await env.SIGNALS_CACHE.get(LEARNING_KEYS.FACTOR_STATS, { type: "json" }) || {};
  } catch (e) {
    console.error("Error getting factor stats:", e.message);
    return {};
  }
}

/**
 * Get all discovered patterns
 */
export async function getDiscoveredPatterns(env) {
  if (!env.SIGNALS_CACHE) return { patterns: [], candidates: {} };
  
  try {
    const discovered = await env.SIGNALS_CACHE.get(LEARNING_KEYS.DISCOVERED_PATTERNS, { type: "json" }) || [];
    const candidates = await env.SIGNALS_CACHE.get(LEARNING_KEYS.PATTERN_CANDIDATES, { type: "json" }) || {};
    const timePatterns = await env.SIGNALS_CACHE.get(LEARNING_KEYS.TIME_PATTERNS, { type: "json" }) || {};
    const volumeBrackets = await env.SIGNALS_CACHE.get(LEARNING_KEYS.VOLUME_BRACKETS, { type: "json" }) || {};
    const marketTypes = await env.SIGNALS_CACHE.get(LEARNING_KEYS.MARKET_TYPE_STATS, { type: "json" }) || {};
    
    // Find patterns close to promotion threshold
    const allCandidates = { ...candidates, ...timePatterns, ...volumeBrackets, ...marketTypes };
    const nearPromotion = [];
    
    for (const [name, stats] of Object.entries(allCandidates)) {
      const total = (stats.wins || 0) + (stats.losses || 0);
      if (total >= 5 && total < 10) {
        nearPromotion.push({
          name,
          ...stats,
          samplesNeeded: 10 - total
        });
      }
    }
    
    return {
      promotedPatterns: discovered,
      nearPromotion: nearPromotion.sort((a, b) => b.winRate - a.winRate),
      allTracking: {
        candidates: Object.keys(candidates).length,
        timePatterns: Object.keys(timePatterns).length,
        volumeBrackets: Object.keys(volumeBrackets).length,
        marketTypes: Object.keys(marketTypes).length
      }
    };
  } catch (e) {
    console.error("Error getting discovered patterns:", e.message);
    return { patterns: [], candidates: {} };
  }
}

/**
 * Reset factor stats (for testing)
 */
export async function resetFactorStats(env) {
  if (!env.SIGNALS_CACHE) return;
  
  try {
    await env.SIGNALS_CACHE.put(LEARNING_KEYS.FACTOR_STATS, JSON.stringify({}));
    await env.SIGNALS_CACHE.put(LEARNING_KEYS.DISCOVERED_PATTERNS, JSON.stringify([]));
    await env.SIGNALS_CACHE.put(LEARNING_KEYS.PATTERN_CANDIDATES, JSON.stringify({}));
    await env.SIGNALS_CACHE.put(LEARNING_KEYS.TIME_PATTERNS, JSON.stringify({}));
    await env.SIGNALS_CACHE.put(LEARNING_KEYS.VOLUME_BRACKETS, JSON.stringify({}));
    await env.SIGNALS_CACHE.put(LEARNING_KEYS.MARKET_TYPE_STATS, JSON.stringify({}));
  } catch (e) {
    console.error("Error resetting factor stats:", e.message);
  }
}

/**
 * Get AI recommendation based on current factor performance
 */
export async function getAIRecommendation(env) {
  if (!env.SIGNALS_CACHE) return null;
  
  try {
    const factorStats = await env.SIGNALS_CACHE.get(LEARNING_KEYS.FACTOR_STATS, { type: "json" }) || {};
    const discoveredPatterns = await getDiscoveredPatterns(env);
    const factors = Object.entries(factorStats);
    
    if (factors.length < 3) {
      return {
        hasRecommendation: false,
        message: "Need more data to generate recommendations",
        patternsTracking: discoveredPatterns.allTracking
      };
    }
    
    // Separate core factors from discovered
    const coreFactors = factors.filter(([name, stats]) => !stats.isDiscovered);
    const discoveredFactors = factors.filter(([name, stats]) => stats.isDiscovered);
    
    // Find best and worst performing factors (with sufficient data)
    const sorted = factors
      .filter(([name, stats]) => (stats.wins + stats.losses) >= 3)
      .sort((a, b) => b[1].winRate - a[1].winRate);
    
    if (sorted.length < 2) {
      return {
        hasRecommendation: false,
        message: "Need more settled bets to generate recommendations",
        patternsTracking: discoveredPatterns.allTracking
      };
    }
    
    const bestFactors = sorted.slice(0, 3).map(([name, stats]) => ({
      name,
      winRate: stats.winRate,
      record: `${stats.wins}W-${stats.losses}L`,
      isDiscovered: stats.isDiscovered || false
    }));
    
    const worstFactors = sorted.slice(-3).reverse().map(([name, stats]) => ({
      name,
      winRate: stats.winRate,
      record: `${stats.wins}W-${stats.losses}L`,
      isDiscovered: stats.isDiscovered || false
    }));
    
    // Calculate overall confidence
    const avgWinRate = sorted.reduce((sum, [_, s]) => sum + s.winRate, 0) / sorted.length;
    
    // Generate dynamic recommendation
    let recommendation;
    if (avgWinRate >= 60) {
      recommendation = "🔥 System is running hot! High confidence in signals with top factors.";
    } else if (avgWinRate >= 55) {
      recommendation = "📈 System performing above average. Follow signals with strong factor combinations.";
    } else if (avgWinRate >= 45) {
      recommendation = "📊 System at baseline. Be selective - prioritize signals with proven factors.";
    } else if (avgWinRate >= 35) {
      recommendation = "⚠️ System underperforming. Consider waiting or fading weak signals.";
    } else {
      recommendation = "🚨 System in drawdown. Recommend pausing until patterns stabilize.";
    }
    
    return {
      hasRecommendation: true,
      overallConfidence: Math.round(avgWinRate),
      bestFactors,
      worstFactors,
      recommendation,
      totalFactorsTracked: factors.length,
      factorsWithData: sorted.length,
      discoveredCount: discoveredFactors.length,
      coreFactorsCount: coreFactors.length,
      patternsNearPromotion: discoveredPatterns.nearPromotion.slice(0, 3),
      patternsTracking: discoveredPatterns.allTracking
    };
  } catch (e) {
    console.error("Error getting AI recommendation:", e.message);
    return null;
  }
}