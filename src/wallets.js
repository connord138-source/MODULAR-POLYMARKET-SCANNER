// ============================================================
// WALLETS.JS - Wallet Tracking (WINNER FOCUSED)
// v18.9.0 - Only persist winning wallets, prune losers
// ============================================================

import { KV_KEYS, WALLET_TIERS, WALLET_TRACK_RECORD } from './config.js';

// Minimum thresholds for keeping a wallet
const KEEPER_THRESHOLDS = {
  MIN_BETS: 3,           // Need at least 3 bets to evaluate
  MIN_WIN_RATE: 55,      // Must be above 55% to keep long-term
  MIN_VOLUME: 5000,      // Must have bet at least $5k total
  ELITE_WIN_RATE: 65,    // Elite threshold
  INSIDER_WIN_RATE: 75,  // Insider threshold
};

// Get wallet tier based on performance
export function getWalletTier(stats) {
  if (!stats) return null;
  
  const { wins, losses, totalBets, totalVolume, winRate } = stats;
  const calculatedWinRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;
  const wr = winRate || calculatedWinRate;
  
  if (totalBets < KEEPER_THRESHOLDS.MIN_BETS) return null;
  
  if (wr >= WALLET_TIERS.INSIDER.minWinRate && totalBets >= WALLET_TIERS.INSIDER.minBets && totalVolume >= WALLET_TIERS.INSIDER.minVolume) {
    return { tier: 'INSIDER', winRate: wr, emoji: '🎯' };
  }
  if (wr >= WALLET_TIERS.ELITE.minWinRate && totalBets >= WALLET_TIERS.ELITE.minBets && totalVolume >= WALLET_TIERS.ELITE.minVolume) {
    return { tier: 'ELITE', winRate: wr, emoji: '🏆' };
  }
  if (wr >= WALLET_TIERS.STRONG.minWinRate && totalBets >= WALLET_TIERS.STRONG.minBets && totalVolume >= WALLET_TIERS.STRONG.minVolume) {
    return { tier: 'STRONG', winRate: wr, emoji: '💪' };
  }
  if (wr >= WALLET_TIERS.AVERAGE.minWinRate && totalBets >= WALLET_TIERS.AVERAGE.minBets) {
    return { tier: 'AVERAGE', winRate: wr, emoji: '📊' };
  }
  if (wr <= WALLET_TIERS.FADE.maxWinRate && totalBets >= WALLET_TIERS.FADE.minBets) {
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
        recentBets: []
      };
    }
    
    // Check for duplicate bet (same market + similar amount = same bet)
    const isDuplicate = stats.recentBets.some(existing => {
      const sameMarket = (existing.market || '').toLowerCase() === (betData.market || '').toLowerCase() ||
                         existing.signalId === betData.signalId;
      const sameAmount = Math.abs((existing.amount || 0) - (betData.amount || 0)) < 10; // Within $10
      return sameMarket && sameAmount;
    });
    
    if (isDuplicate) {
      console.log(`Skipping duplicate bet for wallet ${walletAddress.slice(0,8)}... on ${betData.market}`);
      return stats; // Return existing stats without adding duplicate
    }
    
    stats.pending += 1;
    stats.totalVolume += betData.amount || 0;
    stats.lastBetAt = new Date().toISOString();
    
    // Add new bet to recent bets (no duplicates now)
    stats.recentBets.unshift({
      signalId: betData.signalId,
      market: betData.market,
      direction: betData.direction,
      amount: betData.amount,
      price: betData.price,
      timestamp: new Date().toISOString(),
      outcome: null
    });
    
    // Keep only last 10 recent bets (memory optimization)
    if (stats.recentBets.length > 10) {
      stats.recentBets = stats.recentBets.slice(0, 10);
    }
    
    await env.SIGNALS_CACHE.put(key, JSON.stringify(stats), {
      expirationTtl: 90 * 24 * 60 * 60
    });
    
    await addToWalletIndex(env, walletAddress);
    
    return stats;
  } catch (e) {
    console.error("Error tracking wallet bet:", e.message);
    return null;
  }
}

// Record bet outcome
export async function recordWalletOutcome(env, walletAddress, outcome, profitLoss, marketType, betAmount, signalId) {
  if (!env.SIGNALS_CACHE || !walletAddress) return null;
  
  const key = KV_KEYS.WALLETS_PREFIX + walletAddress.toLowerCase();
  
  try {
    let stats = await env.SIGNALS_CACHE.get(key, { type: "json" });
    if (!stats) return null;
    
    // Update recent bet with outcome
    if (signalId && stats.recentBets) {
      for (let i = 0; i < stats.recentBets.length; i++) {
        if (stats.recentBets[i].signalId === signalId && stats.recentBets[i].outcome === null) {
          stats.recentBets[i].outcome = outcome;
          stats.recentBets[i].settledAt = new Date().toISOString();
          break;
        }
      }
    }
    
    stats.totalBets += 1;
    stats.pending = Math.max(0, stats.pending - 1);
    
    if (outcome === "WIN") {
      stats.wins += 1;
      stats.currentStreak = Math.max(0, stats.currentStreak) + 1;
      stats.bestStreak = Math.max(stats.bestStreak || 0, stats.currentStreak);
    } else if (outcome === "LOSS") {
      stats.losses += 1;
      stats.currentStreak = Math.min(0, stats.currentStreak) - 1;
    }
    
    stats.profitLoss += profitLoss || 0;
    stats.winRate = stats.totalBets > 0 ? Math.round((stats.wins / stats.totalBets) * 100) : 0;
    stats.tier = getWalletTier(stats)?.tier || null;
    
    // Determine if wallet should be kept or pruned
    const shouldKeep = evaluateWalletForKeeping(stats);
    
    if (shouldKeep) {
      await env.SIGNALS_CACHE.put(key, JSON.stringify(stats), {
        expirationTtl: 90 * 24 * 60 * 60
      });
      
      // Update winning wallets cache if this is a winner
      if (stats.winRate >= KEEPER_THRESHOLDS.MIN_WIN_RATE && stats.totalBets >= KEEPER_THRESHOLDS.MIN_BETS) {
        await updateWinningWalletsCache(env, walletAddress, stats);
      }
    } else if (stats.totalBets >= 5 && stats.winRate < 45) {
      // Prune consistent losers after 5+ bets
      console.log(`Pruning losing wallet ${walletAddress.slice(0,8)}... (${stats.winRate}% over ${stats.totalBets} bets)`);
      await removeFromWalletIndex(env, walletAddress);
      await env.SIGNALS_CACHE.delete(key);
    }
    
    return stats;
  } catch (e) {
    console.error("Error recording wallet outcome:", e.message);
    return null;
  }
}

// Evaluate if wallet should be kept
function evaluateWalletForKeeping(stats) {
  // Always keep wallets with pending bets
  if (stats.pending > 0) return true;
  
  // Keep if not enough data yet
  if (stats.totalBets < KEEPER_THRESHOLDS.MIN_BETS) return true;
  
  // Keep winners
  if (stats.winRate >= KEEPER_THRESHOLDS.MIN_WIN_RATE) return true;
  
  // Keep high volume (even if not winning yet)
  if (stats.totalVolume >= 50000) return true;
  
  // Keep recent activity (within 7 days)
  if (stats.lastBetAt) {
    const daysSinceLastBet = (Date.now() - new Date(stats.lastBetAt).getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceLastBet < 7) return true;
  }
  
  return false;
}

// Update winning wallets cache (fast lookup for scans)
async function updateWinningWalletsCache(env, walletAddress, stats) {
  if (!env.SIGNALS_CACHE) return;
  
  try {
    let cache = await env.SIGNALS_CACHE.get('winning_wallets_cache', { type: 'json' }) || { wallets: {}, timestamp: 0 };
    
    cache.wallets[walletAddress.toLowerCase()] = {
      isWinner: true,
      winRate: stats.winRate,
      record: `${stats.wins}W-${stats.losses}L`,
      tier: stats.tier,
      totalBets: stats.totalBets
    };
    
    cache.timestamp = Date.now();
    
    // Keep only top 100 winning wallets
    const entries = Object.entries(cache.wallets);
    if (entries.length > 100) {
      entries.sort((a, b) => b[1].winRate - a[1].winRate);
      cache.wallets = Object.fromEntries(entries.slice(0, 100));
    }
    
    await env.SIGNALS_CACHE.put('winning_wallets_cache', JSON.stringify(cache), {
      expirationTtl: 24 * 60 * 60  // 24 hours
    });
  } catch (e) {
    console.error("Error updating winning wallets cache:", e.message);
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
    return null;
  }
}

// Add to wallet index
async function addToWalletIndex(env, walletAddress) {
  if (!env.SIGNALS_CACHE) return;
  
  try {
    const indexKey = "tracked_wallet_index";
    let index = await env.SIGNALS_CACHE.get(indexKey, { type: "json" }) || [];
    
    const normalizedAddress = walletAddress.toLowerCase();
    if (!index.includes(normalizedAddress)) {
      index.push(normalizedAddress);
      await env.SIGNALS_CACHE.put(indexKey, JSON.stringify(index), {
        expirationTtl: 365 * 24 * 60 * 60
      });
    }
  } catch (e) {}
}

// Remove from wallet index
async function removeFromWalletIndex(env, walletAddress) {
  if (!env.SIGNALS_CACHE) return;
  
  try {
    const indexKey = "tracked_wallet_index";
    let index = await env.SIGNALS_CACHE.get(indexKey, { type: "json" }) || [];
    
    const normalizedAddress = walletAddress.toLowerCase();
    index = index.filter(addr => addr !== normalizedAddress);
    
    await env.SIGNALS_CACHE.put(indexKey, JSON.stringify(index), {
      expirationTtl: 365 * 24 * 60 * 60
    });
  } catch (e) {}
}

// Get tracked wallets
export async function getTrackedWallets(env) {
  if (!env.SIGNALS_CACHE) return [];
  try {
    return await env.SIGNALS_CACHE.get("tracked_wallet_index", { type: "json" }) || [];
  } catch (e) {
    return [];
  }
}

// Get leaderboard (WINNERS ONLY)
export async function getWalletLeaderboard(env, limit = 50) {
  const walletIndex = await getTrackedWallets(env);
  const wallets = [];
  
  console.log(`Leaderboard: Checking ${walletIndex.length} wallets`);
  
  // Process in batches to avoid memory issues
  const BATCH_SIZE = 50;
  for (let i = 0; i < Math.min(walletIndex.length, 200); i += BATCH_SIZE) {
    const batch = walletIndex.slice(i, i + BATCH_SIZE);
    
    for (const address of batch) {
      if (!address) continue;
      
      const stats = await getWalletStats(env, address);
      
      // Only include wallets with meaningful data
      if (stats && (stats.totalBets >= 1 || stats.pending > 0)) {
        wallets.push({
          address: stats.address || address,
          wins: stats.wins || 0,
          losses: stats.losses || 0,
          pending: stats.pending || 0,
          totalBets: stats.totalBets || 0,
          winRate: stats.winRate || 0,
          totalVolume: stats.totalVolume || 0,
          tier: stats.tier || (stats.pending > 0 ? 'PENDING' : 'NEW'),
          tierInfo: getWalletTier(stats),
          profitLoss: stats.profitLoss || 0,
          currentStreak: stats.currentStreak || 0,
          bestStreak: stats.bestStreak || 0,
          lastBetAt: stats.lastBetAt || null
        });
      }
    }
  }
  
  console.log(`Leaderboard: Found ${wallets.length} active wallets`);
  
  // Sort by: WINNERS FIRST, then by win rate
  const tierOrder = { 'INSIDER': 0, 'ELITE': 1, 'STRONG': 2, 'AVERAGE': 3, 'PENDING': 4, 'NEW': 5, 'FADE': 6 };
  wallets.sort((a, b) => {
    // Winners (>55%) first
    const aIsWinner = a.winRate >= 55 && a.totalBets >= 3;
    const bIsWinner = b.winRate >= 55 && b.totalBets >= 3;
    if (aIsWinner && !bIsWinner) return -1;
    if (!aIsWinner && bIsWinner) return 1;
    
    // Then by tier
    const tierDiff = (tierOrder[a.tier] || 99) - (tierOrder[b.tier] || 99);
    if (tierDiff !== 0) return tierDiff;
    
    // Then by win rate
    return b.winRate - a.winRate;
  });
  
  return wallets.slice(0, limit);
}

// ============================================================
// CLEANUP FUNCTIONS
// ============================================================

// Prune losing wallets and old data
export async function pruneLosingWallets(env) {
  if (!env.SIGNALS_CACHE) return { pruned: 0, kept: 0 };
  
  const walletIndex = await getTrackedWallets(env);
  let pruned = 0;
  let kept = 0;
  
  console.log(`Pruning: Checking ${walletIndex.length} wallets`);
  
  for (const address of walletIndex) {
    if (!address) continue;
    
    try {
      const stats = await getWalletStats(env, address);
      
      if (!stats) {
        await removeFromWalletIndex(env, address);
        pruned++;
        continue;
      }
      
      // Prune if: 5+ bets AND below 45% win rate AND no pending
      if (stats.totalBets >= 5 && stats.winRate < 45 && stats.pending === 0) {
        const key = KV_KEYS.WALLETS_PREFIX + address.toLowerCase();
        await env.SIGNALS_CACHE.delete(key);
        await removeFromWalletIndex(env, address);
        pruned++;
        console.log(`Pruned: ${address.slice(0,8)}... (${stats.winRate}% over ${stats.totalBets} bets)`);
      } else {
        kept++;
      }
    } catch (e) {
      pruned++;
    }
  }
  
  console.log(`Pruning complete: ${pruned} removed, ${kept} kept`);
  return { pruned, kept };
}

// Clean up duplicate bets in all wallets
export async function deduplicateWalletBets(env) {
  if (!env.SIGNALS_CACHE) return { walletsProcessed: 0, duplicatesRemoved: 0 };
  
  const walletIndex = await getTrackedWallets(env);
  let walletsProcessed = 0;
  let duplicatesRemoved = 0;
  
  console.log(`Deduplicating bets in ${walletIndex.length} wallets`);
  
  for (const address of walletIndex) {
    if (!address) continue;
    
    try {
      const key = KV_KEYS.WALLETS_PREFIX + address.toLowerCase();
      const stats = await env.SIGNALS_CACHE.get(key, { type: 'json' });
      
      if (!stats || !stats.recentBets || stats.recentBets.length === 0) continue;
      
      const originalCount = stats.recentBets.length;
      
      // Deduplicate by market + amount
      const seen = new Map();
      const uniqueBets = [];
      
      for (const bet of stats.recentBets) {
        const market = (bet.market || bet.signalId || '').toLowerCase();
        const amount = Math.round(bet.amount || 0);
        const key = `${market}-${amount}`;
        
        if (!seen.has(key)) {
          seen.set(key, bet);
          uniqueBets.push(bet);
        } else {
          // If this one has an outcome and existing doesn't, use this one
          const existing = seen.get(key);
          if (bet.outcome && !existing.outcome) {
            existing.outcome = bet.outcome;
            existing.settledAt = bet.settledAt;
          }
        }
      }
      
      const removed = originalCount - uniqueBets.length;
      
      if (removed > 0) {
        // Recalculate stats based on unique bets
        const wins = uniqueBets.filter(b => b.outcome === 'WIN').length;
        const losses = uniqueBets.filter(b => b.outcome === 'LOSS').length;
        const pending = uniqueBets.filter(b => !b.outcome).length;
        const totalBets = wins + losses;
        
        stats.recentBets = uniqueBets;
        stats.wins = wins;
        stats.losses = losses;
        stats.pending = pending;
        stats.totalBets = totalBets;
        stats.winRate = totalBets > 0 ? Math.round((wins / totalBets) * 100) : 0;
        
        await env.SIGNALS_CACHE.put(key, JSON.stringify(stats), {
          expirationTtl: 90 * 24 * 60 * 60
        });
        
        duplicatesRemoved += removed;
        console.log(`Wallet ${address.slice(0,8)}...: removed ${removed} duplicates, now ${stats.wins}W-${stats.losses}L (${stats.winRate}%)`);
      }
      
      walletsProcessed++;
    } catch (e) {
      console.error(`Error deduplicating wallet ${address}:`, e.message);
    }
  }
  
  console.log(`Deduplication complete: ${walletsProcessed} wallets, ${duplicatesRemoved} duplicates removed`);
  return { walletsProcessed, duplicatesRemoved };
}

// Clear all trade buckets (they're not needed after processing)
export async function clearTradeBuckets(env) {
  if (!env.SIGNALS_CACHE) return { cleared: 0 };
  
  try {
    const index = await env.SIGNALS_CACHE.get('trades_index', { type: 'json' }) || [];
    let cleared = 0;
    
    for (const bucketKey of index) {
      try {
        await env.SIGNALS_CACHE.delete(bucketKey);
        cleared++;
      } catch (e) {}
    }
    
    // Clear index
    await env.SIGNALS_CACHE.delete('trades_index');
    await env.SIGNALS_CACHE.delete('trades_last_poll');
    await env.SIGNALS_CACHE.delete('trades_poll_stats');
    
    console.log(`Cleared ${cleared} trade buckets`);
    return { cleared };
  } catch (e) {
    return { cleared: 0, error: e.message };
  }
}

// Full KV cleanup
export async function fullKVCleanup(env) {
  const results = {
    tradeBuckets: await clearTradeBuckets(env),
    walletPrune: await pruneLosingWallets(env)
  };
  
  return results;
}
