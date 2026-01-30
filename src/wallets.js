// ============================================================
// WALLETS.JS - Wallet Tracking and Tier System
// ============================================================

import { KV_KEYS, WALLET_TIERS, WALLET_TRACK_RECORD } from './config.js';

// Get wallet tier based on performance
export function getWalletTier(stats) {
  if (!stats) return null;
  
  const { wins, losses, totalBets, totalVolume, winRate } = stats;
  const calculatedWinRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;
  const wr = winRate || calculatedWinRate;
  
  // Need minimum bets for tier assignment
  if (totalBets < WALLET_TRACK_RECORD.MIN_BETS_FOR_TIER) {
    return null;
  }
  
  // Check tiers in order
  if (wr >= WALLET_TIERS.INSIDER.minWinRate && 
      totalBets >= WALLET_TIERS.INSIDER.minBets && 
      totalVolume >= WALLET_TIERS.INSIDER.minVolume) {
    return { tier: 'INSIDER', winRate: wr, emoji: '🎯' };
  }
  
  if (wr >= WALLET_TIERS.ELITE.minWinRate && 
      totalBets >= WALLET_TIERS.ELITE.minBets && 
      totalVolume >= WALLET_TIERS.ELITE.minVolume) {
    return { tier: 'ELITE', winRate: wr, emoji: '🏆' };
  }
  
  if (wr >= WALLET_TIERS.STRONG.minWinRate && 
      totalBets >= WALLET_TIERS.STRONG.minBets && 
      totalVolume >= WALLET_TIERS.STRONG.minVolume) {
    return { tier: 'STRONG', winRate: wr, emoji: '💪' };
  }
  
  if (wr >= WALLET_TIERS.AVERAGE.minWinRate && 
      totalBets >= WALLET_TIERS.AVERAGE.minBets) {
    return { tier: 'AVERAGE', winRate: wr, emoji: '📊' };
  }
  
  // Check for FADE tier (consistently bad)
  if (wr <= WALLET_TIERS.FADE.maxWinRate && 
      totalBets >= WALLET_TIERS.FADE.minBets) {
    return { tier: 'FADE', winRate: wr, emoji: '🚫' };
  }
  
  return null;
}

// Track a new wallet bet
export async function trackWalletBet(env, walletAddress, betData) {
  if (!env.SIGNALS_CACHE || !walletAddress) return null;
  
  const key = KV_KEYS.WALLETS_PREFIX + walletAddress.toLowerCase();
  
  try {
    let stats = await env.SIGNALS_CACHE.get(key, { type: "json" });
    
    if (!stats) {
      // Initialize new wallet
      stats = {
        address: walletAddress.toLowerCase(),
        firstSeen: new Date().toISOString(),
        totalBets: 0,
        wins: 0,
        losses: 0,
        pending: 0,
        totalVolume: 0,
        winRate: 0,
        profitLoss: 0,
        tier: null,
        currentStreak: 0,
        bestStreak: 0,
        worstStreak: 0,
        recentBets: [],
        edgeMetrics: {
          avgOdds: 0,
          consistencyScore: 0,
          bigBetWinRate: 0,
          totalBigBets: 0,
          bigBetWins: 0,
          roi: 0
        }
      };
    }
    
    // Add new bet
    stats.pending += 1;
    stats.totalVolume += betData.amount || 0;
    stats.lastBetAt = new Date().toISOString();
    
    // Track big bets
    if (betData.amount >= 10000) {
      stats.edgeMetrics.totalBigBets = (stats.edgeMetrics.totalBigBets || 0) + 1;
    }
    
    // Add to recent bets (keep last 20)
    stats.recentBets.unshift({
      signalId: betData.signalId,
      market: betData.market,
      direction: betData.direction,
      amount: betData.amount,
      price: betData.price,
      timestamp: new Date().toISOString(),
      outcome: null
    });
    
    if (stats.recentBets.length > 20) {
      stats.recentBets = stats.recentBets.slice(0, 20);
    }
    
    await env.SIGNALS_CACHE.put(key, JSON.stringify(stats), {
      expirationTtl: 90 * 24 * 60 * 60 // 90 days
    });
    
    // Update wallet index
    await addToWalletIndex(env, walletAddress);
    
    return stats;
  } catch (e) {
    console.error("Error tracking wallet bet:", e.message);
    return null;
  }
}

// Record bet outcome for a wallet
export async function recordWalletOutcome(env, walletAddress, outcome, profitLoss, marketType, betAmount, signalId) {
  if (!env.SIGNALS_CACHE || !walletAddress) return null;
  
  const key = KV_KEYS.WALLETS_PREFIX + walletAddress.toLowerCase();
  
  try {
    let stats = await env.SIGNALS_CACHE.get(key, { type: "json" });
    if (!stats) return null;
    
    // Initialize edge metrics if missing
    if (!stats.edgeMetrics) {
      stats.edgeMetrics = {
        avgOdds: 0,
        consistencyScore: 0,
        bigBetWinRate: 0,
        totalBigBets: 0,
        bigBetWins: 0,
        roi: 0
      };
    }
    
    // Update the specific bet in recentBets if signalId provided
    if (signalId && stats.recentBets && stats.recentBets.length > 0) {
      for (let i = 0; i < stats.recentBets.length; i++) {
        if (stats.recentBets[i].signalId === signalId && stats.recentBets[i].outcome === null) {
          stats.recentBets[i].outcome = outcome;
          stats.recentBets[i].settledAt = new Date().toISOString();
          break;
        }
      }
    }
    
    // Update stats
    stats.totalBets += 1;
    stats.pending = Math.max(0, stats.pending - 1);
    
    if (outcome === "WIN") {
      stats.wins += 1;
      stats.currentStreak = Math.max(0, stats.currentStreak) + 1;
      stats.bestStreak = Math.max(stats.bestStreak || 0, stats.currentStreak);
      
      if (betAmount >= 10000) {
        stats.edgeMetrics.bigBetWins = (stats.edgeMetrics.bigBetWins || 0) + 1;
      }
    } else if (outcome === "LOSS") {
      stats.losses += 1;
      stats.currentStreak = Math.min(0, stats.currentStreak) - 1;
      stats.worstStreak = Math.min(stats.worstStreak || 0, stats.currentStreak);
    }
    
    stats.profitLoss += profitLoss || 0;
    stats.winRate = stats.totalBets > 0 ? Math.round((stats.wins / stats.totalBets) * 100) : 0;
    stats.tier = getWalletTier(stats)?.tier || null;
    
    // Calculate edge metrics
    if (stats.edgeMetrics.totalBigBets > 0) {
      stats.edgeMetrics.bigBetWinRate = Math.round(
        ((stats.edgeMetrics.bigBetWins || 0) / stats.edgeMetrics.totalBigBets) * 100
      );
    }
    
    if (stats.totalVolume > 0) {
      stats.edgeMetrics.roi = Math.round((stats.profitLoss / stats.totalVolume) * 100);
    }
    
    await env.SIGNALS_CACHE.put(key, JSON.stringify(stats), {
      expirationTtl: 90 * 24 * 60 * 60
    });
    
    return stats;
  } catch (e) {
    console.error("Error recording wallet outcome:", e.message);
    return null;
  }
}

// Get wallet stats
export async function getWalletStats(env, walletAddress) {
  if (!env.SIGNALS_CACHE || !walletAddress) return null;
  
  const key = KV_KEYS.WALLETS_PREFIX + walletAddress.toLowerCase();
  
  try {
    const stats = await env.SIGNALS_CACHE.get(key, { type: "json" });
    if (stats) {
      stats.tierInfo = getWalletTier(stats);
    }
    return stats;
  } catch (e) {
    console.error("Error getting wallet stats:", e.message);
    return null;
  }
}

// Add wallet to index
async function addToWalletIndex(env, walletAddress) {
  if (!env.SIGNALS_CACHE) return;
  
  try {
    const indexKey = "tracked_wallet_index";
    let index = await env.SIGNALS_CACHE.get(indexKey, { type: "json" }) || [];
    
    const normalizedAddress = walletAddress.toLowerCase();
    if (!index.includes(normalizedAddress)) {
      index.push(normalizedAddress);
      await env.SIGNALS_CACHE.put(indexKey, JSON.stringify(index), {
        expirationTtl: 365 * 24 * 60 * 60 // 1 year
      });
    }
  } catch (e) {
    console.error("Error updating wallet index:", e.message);
  }
}

// Get all tracked wallets
export async function getTrackedWallets(env) {
  if (!env.SIGNALS_CACHE) return [];
  
  try {
    const indexKey = "tracked_wallet_index";
    return await env.SIGNALS_CACHE.get(indexKey, { type: "json" }) || [];
  } catch (e) {
    console.error("Error getting wallet index:", e.message);
    return [];
  }
}

// Get leaderboard
export async function getWalletLeaderboard(env, limit = 20) {
  const walletIndex = await getTrackedWallets(env);
  const wallets = [];
  
  console.log(`Leaderboard: Found ${walletIndex.length} wallets in index`);
  
  for (const address of walletIndex) {
    if (!address) continue; // Skip null/undefined addresses
    
    const stats = await getWalletStats(env, address);
    
    // Include wallets that have any activity (bets OR pending)
    if (stats && (stats.totalBets > 0 || stats.pending > 0)) {
      let displayTier = stats.tier;
      if (!displayTier) {
        if (stats.totalBets > 0) {
          displayTier = 'NEW';
        } else if (stats.pending > 0) {
          displayTier = 'PENDING';
        }
      }
      
      wallets.push({
        address: stats.address || address,
        wins: stats.wins || 0,
        losses: stats.losses || 0,
        pending: stats.pending || 0,
        totalBets: stats.totalBets || 0,
        winRate: stats.winRate || 0,
        totalVolume: stats.totalVolume || 0,
        tier: displayTier || 'UNKNOWN',
        tierInfo: getWalletTier(stats),
        profitLoss: stats.profitLoss || 0,
        currentStreak: stats.currentStreak || 0,
        bestStreak: stats.bestStreak || 0,
        lastBetAt: stats.lastBetAt || null
      });
    }
  }
  
  console.log(`Leaderboard: ${wallets.length} wallets with activity`);
  
  // Sort by tier quality, then win rate
  const tierOrder = { 'INSIDER': 0, 'ELITE': 1, 'STRONG': 2, 'AVERAGE': 3, 'NEW': 4, 'PENDING': 5, 'FADE': 6, 'UNKNOWN': 7 };
  wallets.sort((a, b) => {
    const tierDiff = (tierOrder[a.tier] || 99) - (tierOrder[b.tier] || 99);
    if (tierDiff !== 0) return tierDiff;
    return b.winRate - a.winRate;
  });
  
  return wallets.slice(0, limit);
}