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

// NBA/Sports team name mappings for readable titles
const TEAM_ABBREVS = {
  'lal': 'Lakers', 'lac': 'Clippers', 'gsw': 'Warriors', 'sac': 'Kings',
  'phx': 'Suns', 'den': 'Nuggets', 'min': 'Timberwolves', 'okc': 'Thunder',
  'por': 'Trail Blazers', 'uta': 'Jazz', 'dal': 'Mavericks', 'hou': 'Rockets',
  'sas': 'Spurs', 'mem': 'Grizzlies', 'nop': 'Pelicans', 'bos': 'Celtics',
  'bkn': 'Nets', 'nyk': 'Knicks', 'phi': 'Sixers', 'tor': 'Raptors',
  'chi': 'Bulls', 'cle': 'Cavaliers', 'det': 'Pistons', 'ind': 'Pacers',
  'mil': 'Bucks', 'atl': 'Hawks', 'cha': 'Hornets', 'mia': 'Heat',
  'orl': 'Magic', 'was': 'Wizards', 'elc': 'Celtics', 'bar': 'Barcelona',
  'bun': 'Bucks', 'dor': 'Dortmund', 'hei': 'Heat', 'cel': 'Celtics',
  'hor': 'Hornets', 'pel': 'Pelicans'
};

// Format market title to be human-readable
function formatMarketTitle(title) {
  if (!title) return 'Unknown Market';
  
  // If it's already a readable title (contains spaces and no dates), return it
  if (title.includes(' ') && !title.match(/^\w{3}\s\w{3}\s\w{3}\s\d{4}/)) {
    return title;
  }
  
  // Try to parse slug format: "lal-elc-bar-2026-01-31" or "lal elc bar 2026 01 31"
  const parts = title.toLowerCase().replace(/-/g, ' ').split(' ').filter(p => p);
  
  // Extract date if present
  let dateStr = '';
  const dateMatch = title.match(/(\d{4})[-\s](\d{2})[-\s](\d{2})/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const date = new Date(year, parseInt(month) - 1, day);
    dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  
  // Try to identify team abbreviations and expand them
  const teams = [];
  for (const part of parts) {
    if (part.length === 3 && TEAM_ABBREVS[part]) {
      teams.push(TEAM_ABBREVS[part]);
    } else if (part.length === 3 && /^[a-z]+$/.test(part)) {
      // Unknown 3-letter abbrev, capitalize it
      teams.push(part.toUpperCase());
    }
  }
  
  if (teams.length >= 2) {
    // Format as "Team1 vs Team2 - Date"
    const matchup = `${teams[0]} vs ${teams[1]}`;
    return dateStr ? `${matchup} - ${dateStr}` : matchup;
  }
  
  // Fallback: just clean up the title
  return title
    .replace(/-/g, ' ')
    .replace(/\d{4}\s?\d{2}\s?\d{2}/g, '') // Remove dates
    .split(' ')
    .filter(w => w.length > 0)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .trim() || 'Unknown Market';
}

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

// Track a new wallet bet with FULL individual trade data
export async function trackWalletBet(env, walletAddress, betData) {
  if (!env.SIGNALS_CACHE || !walletAddress) return null;
  
  const key = KV_KEYS.WALLETS_PREFIX + walletAddress.toLowerCase();
  const tradesKey = `wallet_trades_${walletAddress.toLowerCase()}`;
  
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
    
    // Generate unique trade ID
    const tradeId = `${betData.signalId || betData.market}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    // Check for duplicate bet (same market + similar amount within 5 minutes)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const isDuplicate = stats.recentBets.some(existing => {
      const sameMarket = (existing.market || '').toLowerCase() === (betData.market || '').toLowerCase() ||
                         existing.signalId === betData.signalId;
      const sameAmount = Math.abs((existing.amount || 0) - (betData.amount || 0)) < 10;
      const recentEnough = new Date(existing.timestamp).getTime() > fiveMinutesAgo;
      return sameMarket && sameAmount && recentEnough;
    });
    
    if (isDuplicate) {
      console.log(`Skipping duplicate bet for wallet ${walletAddress.slice(0,8)}... on ${betData.market}`);
      return stats;
    }
    
    // Create detailed trade record
    const tradeRecord = {
      id: tradeId,
      signalId: betData.signalId,
      market: betData.market,
      marketTitle: betData.marketTitle || betData.market,
      direction: betData.direction,
      amount: betData.amount || 0,
      price: betData.price || 0,
      timestamp: new Date().toISOString(),
      outcome: null,
      settledAt: null,
      // P&L tracking fields
      invested: betData.amount || 0,
      returned: 0,
      pnl: 0,
      roi: 0,
      // Current value tracking (for open positions)
      currentPrice: betData.price || 0,
      currentValue: betData.amount || 0,
      unrealizedPnl: 0
    };
    
    stats.pending += 1;
    stats.totalVolume += betData.amount || 0;
    stats.lastBetAt = new Date().toISOString();
    
    // Add to recent bets (keep last 50 for display)
    stats.recentBets.unshift(tradeRecord);
    if (stats.recentBets.length > 50) {
      stats.recentBets = stats.recentBets.slice(0, 50);
    }
    
    // ALSO store in separate trades storage (for full history)
    await storeIndividualTrade(env, walletAddress, tradeRecord);
    
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

// Store individual trade in separate KV for full history
async function storeIndividualTrade(env, walletAddress, trade) {
  if (!env.SIGNALS_CACHE) return;
  
  const tradesKey = `wallet_trades_${walletAddress.toLowerCase()}`;
  
  try {
    let trades = await env.SIGNALS_CACHE.get(tradesKey, { type: 'json' }) || { 
      open: [], 
      resolved: [],
      lastUpdated: null 
    };
    
    // Add to open trades
    trades.open.unshift(trade);
    
    // Keep last 100 open trades max
    if (trades.open.length > 100) {
      trades.open = trades.open.slice(0, 100);
    }
    
    trades.lastUpdated = new Date().toISOString();
    
    await env.SIGNALS_CACHE.put(tradesKey, JSON.stringify(trades), {
      expirationTtl: 180 * 24 * 60 * 60  // 6 months
    });
  } catch (e) {
    console.error("Error storing individual trade:", e.message);
  }
}

// Record bet outcome with FULL P&L calculation
export async function recordWalletOutcome(env, walletAddress, outcome, profitLoss, marketType, betAmount, signalId) {
  if (!env.SIGNALS_CACHE || !walletAddress) return null;
  
  const key = KV_KEYS.WALLETS_PREFIX + walletAddress.toLowerCase();
  const tradesKey = `wallet_trades_${walletAddress.toLowerCase()}`;
  
  try {
    let stats = await env.SIGNALS_CACHE.get(key, { type: "json" });
    if (!stats) return null;
    
    // Calculate actual P&L based on outcome
    // If WIN: returned = invested / price (shares bought), P&L = returned - invested
    // If LOSS: returned = 0, P&L = -invested
    let calculatedPnl = profitLoss || 0;
    let returnedAmount = 0;
    
    // Find the bet in recentBets and update it
    let betFound = false;
    if (stats.recentBets) {
      for (let i = 0; i < stats.recentBets.length; i++) {
        const bet = stats.recentBets[i];
        if ((signalId && bet.signalId === signalId) || 
            (bet.market && bet.market.toLowerCase().includes(signalId?.toLowerCase())) &&
            bet.outcome === null) {
          
          const invested = bet.amount || betAmount || 0;
          const entryPrice = bet.price || 0.5;
          
          if (outcome === "WIN") {
            // Shares = invested / price, Return = shares * 1.0 (winning outcome pays $1)
            const shares = invested / entryPrice;
            returnedAmount = shares;
            calculatedPnl = returnedAmount - invested;
          } else if (outcome === "LOSS") {
            returnedAmount = 0;
            calculatedPnl = -invested;
          }
          
          // Update the bet record with settlement info
          stats.recentBets[i].outcome = outcome;
          stats.recentBets[i].settledAt = new Date().toISOString();
          stats.recentBets[i].returned = returnedAmount;
          stats.recentBets[i].pnl = calculatedPnl;
          stats.recentBets[i].roi = invested > 0 ? Math.round((calculatedPnl / invested) * 100) : 0;
          
          betFound = true;
          break;
        }
      }
    }
    
    // Also update in trades storage
    await updateTradeOutcome(env, walletAddress, signalId, outcome, calculatedPnl, returnedAmount);
    
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
    
    stats.profitLoss = (stats.profitLoss || 0) + calculatedPnl;
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

// Update trade outcome in separate trades storage
async function updateTradeOutcome(env, walletAddress, signalId, outcome, pnl, returned) {
  if (!env.SIGNALS_CACHE) return;
  
  const tradesKey = `wallet_trades_${walletAddress.toLowerCase()}`;
  
  try {
    let trades = await env.SIGNALS_CACHE.get(tradesKey, { type: 'json' });
    if (!trades) return;
    
    // Find and move trade from open to resolved
    const tradeIndex = trades.open.findIndex(t => 
      t.signalId === signalId || 
      (t.market && t.market.toLowerCase().includes(signalId?.toLowerCase()))
    );
    
    if (tradeIndex >= 0) {
      const trade = trades.open[tradeIndex];
      
      // Update trade with settlement info
      trade.outcome = outcome;
      trade.settledAt = new Date().toISOString();
      trade.returned = returned;
      trade.pnl = pnl;
      trade.roi = trade.invested > 0 ? Math.round((pnl / trade.invested) * 100) : 0;
      
      // Move to resolved
      trades.resolved.unshift(trade);
      trades.open.splice(tradeIndex, 1);
      
      // Keep last 200 resolved trades
      if (trades.resolved.length > 200) {
        trades.resolved = trades.resolved.slice(0, 200);
      }
      
      trades.lastUpdated = new Date().toISOString();
      
      await env.SIGNALS_CACHE.put(tradesKey, JSON.stringify(trades), {
        expirationTtl: 180 * 24 * 60 * 60
      });
    }
  } catch (e) {
    console.error("Error updating trade outcome:", e.message);
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

// ============================================================
// GET WALLET P&L - Full trade history with calculations
// ============================================================
export async function getWalletPnL(env, walletAddress) {
  if (!env.SIGNALS_CACHE || !walletAddress) {
    return { success: false, error: "Invalid request" };
  }
  
  const key = KV_KEYS.WALLETS_PREFIX + walletAddress.toLowerCase();
  const tradesKey = `wallet_trades_${walletAddress.toLowerCase()}`;
  
  try {
    // Get wallet stats
    const stats = await env.SIGNALS_CACHE.get(key, { type: "json" });
    if (!stats) {
      return { success: false, error: "Wallet not found" };
    }
    
    // Get detailed trades
    let trades = await env.SIGNALS_CACHE.get(tradesKey, { type: 'json' });
    
    // If no separate trades storage, use recentBets
    if (!trades) {
      trades = {
        open: [],
        resolved: [],
        lastUpdated: null
      };
      
      // Populate from recentBets - DEDUPLICATE by market+amount
      const seen = new Map();
      
      if (stats.recentBets && stats.recentBets.length > 0) {
        for (const bet of stats.recentBets) {
          // Deduplicate
          const dedupKey = `${(bet.market || bet.signalId || '').toLowerCase()}-${Math.round(bet.amount || 0)}`;
          if (seen.has(dedupKey)) continue;
          seen.set(dedupKey, true);
          
          const invested = bet.amount || 0;
          const entryPrice = bet.price || 0.5;
          
          // CALCULATE P&L if bet has outcome but no pnl stored
          let returned = bet.returned || 0;
          let pnl = bet.pnl || 0;
          let roi = bet.roi || 0;
          
          if (bet.outcome === 'WIN' && pnl === 0 && invested > 0) {
            // WIN: shares = invested / price, return = shares * $1
            const shares = invested / entryPrice;
            returned = Math.round(shares * 100) / 100;
            pnl = Math.round((returned - invested) * 100) / 100;
            roi = Math.round((pnl / invested) * 100);
          } else if (bet.outcome === 'LOSS' && pnl === 0 && invested > 0) {
            // LOSS: lose everything
            returned = 0;
            pnl = -invested;
            roi = -100;
          }
          
          // Format market title - make it readable
          let marketTitle = bet.marketTitle || bet.market || '';
          marketTitle = formatMarketTitle(marketTitle);
          
          const tradeRecord = {
            id: bet.id || `${bet.signalId || bet.market}-${bet.timestamp}`,
            signalId: bet.signalId,
            market: bet.market,
            marketTitle: marketTitle,
            direction: bet.direction,
            amount: invested,
            price: entryPrice,
            timestamp: bet.timestamp,
            outcome: bet.outcome,
            settledAt: bet.settledAt,
            invested: invested,
            returned: returned,
            pnl: pnl,
            roi: roi,
            currentPrice: bet.currentPrice || entryPrice,
            currentValue: bet.currentValue || invested,
            unrealizedPnl: bet.unrealizedPnl || 0
          };
          
          // Separate based on outcome - if it has outcome, it's resolved
          if (bet.outcome === 'WIN' || bet.outcome === 'LOSS') {
            trades.resolved.push(tradeRecord);
          } else {
            trades.open.push(tradeRecord);
          }
        }
      }
    }
    
    // Calculate summary P&L stats
    const totalInvested = [...trades.open, ...trades.resolved].reduce((sum, t) => sum + (t.invested || t.amount || 0), 0);
    const totalReturned = trades.resolved.reduce((sum, t) => sum + (t.returned || 0), 0);
    const realizedPnl = trades.resolved.reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    // Calculate unrealized P&L for open positions (estimate based on current holdings)
    let unrealizedPnl = 0;
    for (const trade of trades.open) {
      // If we had current market prices, we'd calculate here
      // For now, estimate based on entry price
      const currentValue = trade.currentValue || trade.amount || 0;
      const invested = trade.invested || trade.amount || 0;
      trade.unrealizedPnl = currentValue - invested;
      unrealizedPnl += trade.unrealizedPnl;
    }
    
    const totalPnl = realizedPnl + unrealizedPnl;
    const roi = totalInvested > 0 ? Math.round((totalPnl / totalInvested) * 100) : 0;
    
    return {
      success: true,
      address: walletAddress.toLowerCase(),
      
      // Summary stats
      summary: {
        totalPnl: Math.round(totalPnl * 100) / 100,
        realizedPnl: Math.round(realizedPnl * 100) / 100,
        unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
        totalInvested: Math.round(totalInvested * 100) / 100,
        totalReturned: Math.round(totalReturned * 100) / 100,
        roi,
        wins: stats.wins || 0,
        losses: stats.losses || 0,
        pending: stats.pending || 0,
        winRate: stats.winRate || 0,
        totalVolume: stats.totalVolume || 0,
        currentStreak: stats.currentStreak || 0,
        bestStreak: stats.bestStreak || 0
      },
      
      // Detailed trade arrays
      openBets: trades.open.map(t => ({
        id: t.id,
        market: t.market,
        marketTitle: t.marketTitle || t.market,
        direction: t.direction,
        invested: t.invested || t.amount || 0,
        entryPrice: t.price || 0,
        currentPrice: t.currentPrice || t.price || 0,
        currentValue: t.currentValue || t.invested || 0,
        unrealizedPnl: t.unrealizedPnl || 0,
        roi: t.roi || 0,
        timestamp: t.timestamp
      })),
      
      resolvedBets: trades.resolved.map(t => ({
        id: t.id,
        market: t.market,
        marketTitle: t.marketTitle || t.market,
        direction: t.direction,
        outcome: t.outcome,
        invested: t.invested || t.amount || 0,
        entryPrice: t.price || 0,
        returned: t.returned || 0,
        pnl: t.pnl || 0,
        roi: t.roi || 0,
        timestamp: t.timestamp,
        settledAt: t.settledAt
      })),
      
      lastUpdated: trades.lastUpdated || stats.lastBetAt
    };
    
  } catch (e) {
    console.error("Error getting wallet P&L:", e.message);
    return { success: false, error: e.message };
  }
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
