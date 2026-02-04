// ============================================================
// TRADES.JS - Trade Accumulation System
// Polls Polymarket API and stores trades in KV for historical data
// ============================================================

import { POLYMARKET_API } from './config.js';

// KV Keys for trade storage
const TRADES_KV_KEYS = {
  TRADE_BUCKET_PREFIX: 'trades_bucket_',  // trades_bucket_2026-01-30-23 (hourly buckets)
  TRADE_INDEX: 'trades_index',             // List of bucket keys
  LAST_POLL: 'trades_last_poll',
  POLL_STATS: 'trades_poll_stats'
};

// Get bucket key for a timestamp
function getBucketKey(timestamp) {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  return `${TRADES_KV_KEYS.TRADE_BUCKET_PREFIX}${year}-${month}-${day}-${hour}`;
}

// Poll for new trades and store in KV
export async function pollAndStoreTrades(env) {
  if (!env.SIGNALS_CACHE) {
    return { success: false, error: 'No KV storage available' };
  }
  
  const startTime = Date.now();
  
  try {
    // Fetch latest trades from API
    const tradesRes = await fetch(`${POLYMARKET_API}/trades?limit=1000`);
    if (!tradesRes.ok) {
      throw new Error(`Trades API error: ${tradesRes.status}`);
    }
    
    const trades = await tradesRes.json();
    
    // Get last poll timestamp to avoid duplicates
    const lastPollStr = await env.SIGNALS_CACHE.get(TRADES_KV_KEYS.LAST_POLL);
    const lastPollTime = lastPollStr ? parseInt(lastPollStr) : 0;
    
    // Filter to only new trades (after last poll)
    const newTrades = trades.filter(t => {
      const tradeTime = t.timestamp * 1000; // Convert to ms
      return tradeTime > lastPollTime;
    });
    
    if (newTrades.length === 0) {
      // Update last poll time anyway
      await env.SIGNALS_CACHE.put(TRADES_KV_KEYS.LAST_POLL, String(Date.now()));
      return {
        success: true,
        newTrades: 0,
        message: 'No new trades since last poll'
      };
    }
    
    // Group trades by hourly bucket
    const buckets = {};
    for (const trade of newTrades) {
      const tradeTime = trade.timestamp * 1000;
      const bucketKey = getBucketKey(tradeTime);
      
      if (!buckets[bucketKey]) {
        buckets[bucketKey] = [];
      }
      
      // Store minimal trade data to save space
      buckets[bucketKey].push({
        ts: trade.timestamp,
        slug: trade.slug || trade.eventSlug,
        eventSlug: trade.eventSlug,
        title: trade.title,
        outcome: trade.outcome,
        outcomeIndex: trade.outcomeIndex,  // 0 = Yes/Team1, 1 = No/Team2
        side: trade.side,
        price: trade.price,
        size: trade.size,
        proxyWallet: trade.proxyWallet,
        icon: trade.icon
      });
    }
    
    // Store each bucket (merge with existing)
    const bucketKeys = Object.keys(buckets);
    for (const bucketKey of bucketKeys) {
      // Get existing bucket data
      const existingData = await env.SIGNALS_CACHE.get(bucketKey, { type: 'json' }) || [];
      
      // Merge new trades (avoid duplicates by timestamp+wallet+slug)
      const existingSet = new Set(existingData.map(t => `${t.ts}-${t.proxyWallet}-${t.slug}`));
      const newBucketTrades = buckets[bucketKey].filter(t => 
        !existingSet.has(`${t.ts}-${t.proxyWallet}-${t.slug}`)
      );
      
      if (newBucketTrades.length > 0) {
        const mergedTrades = [...existingData, ...newBucketTrades];
        
        // Store with 72 hour TTL (we only need 48h but buffer for safety)
        await env.SIGNALS_CACHE.put(bucketKey, JSON.stringify(mergedTrades), {
          expirationTtl: 72 * 60 * 60
        });
      }
    }
    
    // Update trade index (list of active buckets)
    const existingIndex = await env.SIGNALS_CACHE.get(TRADES_KV_KEYS.TRADE_INDEX, { type: 'json' }) || [];
    const indexSet = new Set(existingIndex);
    for (const key of bucketKeys) {
      indexSet.add(key);
    }
    
    // Clean up old buckets from index (older than 72 hours)
    const cutoffTime = Date.now() - (72 * 60 * 60 * 1000);
    const activeIndex = [...indexSet].filter(key => {
      // Extract date from key: trades_bucket_2026-01-30-23
      const match = key.match(/trades_bucket_(\d{4})-(\d{2})-(\d{2})-(\d{2})/);
      if (!match) return false;
      const bucketDate = new Date(Date.UTC(
        parseInt(match[1]),
        parseInt(match[2]) - 1,
        parseInt(match[3]),
        parseInt(match[4])
      ));
      return bucketDate.getTime() > cutoffTime;
    });
    
    await env.SIGNALS_CACHE.put(TRADES_KV_KEYS.TRADE_INDEX, JSON.stringify(activeIndex), {
      expirationTtl: 72 * 60 * 60
    });
    
    // Update last poll timestamp (use newest trade time)
    const newestTradeTime = Math.max(...newTrades.map(t => t.timestamp * 1000));
    await env.SIGNALS_CACHE.put(TRADES_KV_KEYS.LAST_POLL, String(newestTradeTime));
    
    // Store poll stats
    const stats = {
      lastPoll: new Date().toISOString(),
      tradesStored: newTrades.length,
      bucketsUpdated: bucketKeys.length,
      totalBuckets: activeIndex.length,
      pollDuration: Date.now() - startTime
    };
    await env.SIGNALS_CACHE.put(TRADES_KV_KEYS.POLL_STATS, JSON.stringify(stats));
    
    return {
      success: true,
      newTrades: newTrades.length,
      bucketsUpdated: bucketKeys.length,
      totalBuckets: activeIndex.length,
      duration: Date.now() - startTime
    };
    
  } catch (e) {
    console.error('Poll error:', e);
    return {
      success: false,
      error: e.message
    };
  }
}

// Get accumulated trades for a time window
export async function getAccumulatedTrades(env, hoursBack = 48) {
  if (!env.SIGNALS_CACHE) {
    return { trades: [], fromKV: false };
  }
  
  try {
    // Get bucket index
    const index = await env.SIGNALS_CACHE.get(TRADES_KV_KEYS.TRADE_INDEX, { type: 'json' }) || [];
    
    if (index.length === 0) {
      return { trades: [], fromKV: false, reason: 'No accumulated trades yet' };
    }
    
    // Calculate cutoff time
    const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);
    
    // Fetch all relevant buckets
    const allTrades = [];
    let bucketsRead = 0;
    
    for (const bucketKey of index) {
      // Extract date from key to check if within window
      const match = bucketKey.match(/trades_bucket_(\d{4})-(\d{2})-(\d{2})-(\d{2})/);
      if (!match) continue;
      
      const bucketDate = new Date(Date.UTC(
        parseInt(match[1]),
        parseInt(match[2]) - 1,
        parseInt(match[3]),
        parseInt(match[4])
      ));
      
      // Skip buckets outside our window
      if (bucketDate.getTime() < cutoffTime - (60 * 60 * 1000)) continue; // 1hr buffer
      
      const bucketTrades = await env.SIGNALS_CACHE.get(bucketKey, { type: 'json' });
      if (bucketTrades && Array.isArray(bucketTrades)) {
        // Filter trades within time window
        const validTrades = bucketTrades.filter(t => (t.ts * 1000) >= cutoffTime);
        allTrades.push(...validTrades);
        bucketsRead++;
      }
    }
    
    // Convert back to API format
    const formattedTrades = allTrades.map(t => ({
      timestamp: t.ts,
      slug: t.slug,
      eventSlug: t.eventSlug,
      title: t.title,
      outcome: t.outcome,
      side: t.side,
      price: t.price,
      size: t.size,
      proxyWallet: t.proxyWallet,
      icon: t.icon
    }));
    
    // Sort by timestamp descending (newest first)
    formattedTrades.sort((a, b) => b.timestamp - a.timestamp);
    
    return {
      trades: formattedTrades,
      fromKV: true,
      bucketsRead,
      totalTrades: formattedTrades.length
    };
    
  } catch (e) {
    console.error('Error getting accumulated trades:', e);
    return { trades: [], fromKV: false, error: e.message };
  }
}

// Get poll stats
export async function getPollStats(env) {
  if (!env.SIGNALS_CACHE) {
    return null;
  }
  
  try {
    const stats = await env.SIGNALS_CACHE.get(TRADES_KV_KEYS.POLL_STATS, { type: 'json' });
    const lastPoll = await env.SIGNALS_CACHE.get(TRADES_KV_KEYS.LAST_POLL);
    const index = await env.SIGNALS_CACHE.get(TRADES_KV_KEYS.TRADE_INDEX, { type: 'json' }) || [];
    
    return {
      ...stats,
      lastPollTimestamp: lastPoll ? parseInt(lastPoll) : null,
      activeBuckets: index.length,
      bucketKeys: index.slice(-10) // Last 10 bucket keys for debugging
    };
  } catch (e) {
    return { error: e.message };
  }
}

// Clear all accumulated trades (for testing/reset)
export async function clearAccumulatedTrades(env) {
  if (!env.SIGNALS_CACHE) {
    return { success: false, error: 'No KV storage' };
  }
  
  try {
    const index = await env.SIGNALS_CACHE.get(TRADES_KV_KEYS.TRADE_INDEX, { type: 'json' }) || [];
    
    // Delete all buckets
    for (const key of index) {
      await env.SIGNALS_CACHE.delete(key);
    }
    
    // Clear index and stats
    await env.SIGNALS_CACHE.delete(TRADES_KV_KEYS.TRADE_INDEX);
    await env.SIGNALS_CACHE.delete(TRADES_KV_KEYS.LAST_POLL);
    await env.SIGNALS_CACHE.delete(TRADES_KV_KEYS.POLL_STATS);
    
    return {
      success: true,
      bucketsDeleted: index.length
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
