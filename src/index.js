// ============================================================
// INDEX.JS - Main Router for Polymarket Scanner
// v18.0.0 - Modular Architecture
// ============================================================

import { corsHeaders, VERSION, SPORT_KEY_MAP, KV_KEYS } from './config.js';
import { runScan, getRecentSignals, getSignal } from './signals.js';
import { getWalletStats, getWalletLeaderboard, getTrackedWallets } from './wallets.js';
import { getOddsComparison, getGameScores, getGameOdds } from './odds-api.js';
import { processSettledSignals } from './settlement.js';
import { getFactorStats, getAIRecommendation, updateFactorStats, getDiscoveredPatterns } from './learning.js';

export default {
  // Scheduled cron handler
  async scheduled(event, env, ctx) {
    console.log("Cron triggered:", event.cron);
    
    try {
      // Run settlement check
      const settlementResults = await processSettledSignals(env);
      console.log("Settlement results:", settlementResults);
      
      // Store cron stats
      if (env.SIGNALS_CACHE) {
        await env.SIGNALS_CACHE.put(KV_KEYS.LAST_CRON_RUN, new Date().toISOString());
        await env.SIGNALS_CACHE.put(KV_KEYS.CRON_STATS, JSON.stringify({
          lastRun: new Date().toISOString(),
          settlement: settlementResults
        }));
      }
      
    } catch (e) {
      console.error("Cron error:", e.message);
    }
  },
  
  // HTTP request handler
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // ============ SCAN ENDPOINTS ============
      
      // Main scan - supports all markets or sports-only mode
      if (path === "/scan" || path === "/api/scan") {
        const hours = parseInt(url.searchParams.get("hours") || "48");
        const minScore = parseInt(url.searchParams.get("minScore") || "40");
        const sportsOnly = url.searchParams.get("sportsOnly") === "true" || url.searchParams.get("sports") === "true";
        const debug = url.searchParams.get("debug") === "true";
        
        const result = await runScan(hours, minScore, env, { 
          sportsOnly, 
          includeDebug: debug 
        });
        return jsonResponse(result);
      }
      
      // Sports-only scan (dedicated endpoint)
      if (path === "/scan/sports" || path === "/sports/scan") {
        const hours = parseInt(url.searchParams.get("hours") || "48");
        const minScore = parseInt(url.searchParams.get("minScore") || "40");
        const debug = url.searchParams.get("debug") === "true";
        
        const result = await runScan(hours, minScore, env, { 
          sportsOnly: true, 
          includeDebug: debug 
        });
        return jsonResponse(result);
      }
      
      if (path === "/signals/recent") {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const signals = await getRecentSignals(env, limit);
        return jsonResponse({ success: true, signals });
      }
      
      if (path.startsWith("/signal/")) {
        const signalId = path.split("/")[2];
        const signal = await getSignal(env, signalId);
        return jsonResponse({ success: !!signal, signal });
      }
      
      // ============ WALLET ENDPOINTS ============
      
      if (path === "/wallets/leaderboard") {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const wallets = await getWalletLeaderboard(env, limit);
        return jsonResponse({ 
          success: true, 
          wallets,
          count: wallets.length,
          message: wallets.length === 0 ? "No wallet data available yet. Wallets will appear after signals are tracked and settled." : null
        });
      }
      
      // Wallet stats - supports both /wallet/{address} and /wallet/{address}/stats
      if (path.startsWith("/wallet/") && (path.endsWith("/stats") || path.split("/").length === 3)) {
        const address = path.split("/")[2];
        const stats = await getWalletStats(env, address);
        return jsonResponse({ success: !!stats, ...stats });
      }
      
      // Wallet PnL endpoint
      if (path.startsWith("/wallet/") && path.endsWith("/pnl")) {
        const address = path.split("/")[2];
        const stats = await getWalletStats(env, address);
        
        if (!stats) {
          return jsonResponse({ success: false, error: "Wallet not found" });
        }
        
        return jsonResponse({ 
          success: true,
          address: stats.address,
          totalPnl: stats.profitLoss || 0,
          roi: stats.edgeMetrics?.roi || 0,
          totalVolume: stats.totalVolume || 0,
          wins: stats.wins || 0,
          losses: stats.losses || 0,
          winRate: stats.winRate || 0,
          recentBets: stats.recentBets || []
        });
      }
      
      // Learning specialization endpoint
      if (path.startsWith("/learning/specialization/")) {
        const address = path.split("/")[3];
        const stats = await getWalletStats(env, address);
        
        if (!stats) {
          return jsonResponse({ success: false, error: "Wallet not found" });
        }
        
        // Analyze bet patterns to determine specialization
        const recentBets = stats.recentBets || [];
        const categories = {};
        
        recentBets.forEach(bet => {
          const market = (bet.market || '').toLowerCase();
          let category = 'other';
          
          if (market.includes('nba') || market.includes('nfl') || market.includes('mlb') || 
              market.includes('nhl') || market.includes('sports')) {
            category = 'sports';
          } else if (market.includes('bitcoin') || market.includes('crypto') || market.includes('btc') || 
                     market.includes('eth') || market.includes('token')) {
            category = 'crypto';
          } else if (market.includes('election') || market.includes('trump') || market.includes('biden') ||
                     market.includes('president') || market.includes('congress')) {
            category = 'politics';
          }
          
          categories[category] = (categories[category] || 0) + 1;
        });
        
        // Find primary specialization
        let primaryCategory = 'general';
        let maxCount = 0;
        for (const [cat, count] of Object.entries(categories)) {
          if (count > maxCount) {
            maxCount = count;
            primaryCategory = cat;
          }
        }
        
        return jsonResponse({
          success: true,
          address: stats.address,
          specialization: primaryCategory,
          categories,
          totalBets: recentBets.length,
          expertise: maxCount >= 5 ? 'expert' : maxCount >= 3 ? 'intermediate' : 'novice'
        });
      }
      
      // ============ ODDS ENDPOINTS ============
      
      if (path === "/odds/compare-all") {
        const sport = url.searchParams.get("sport") || "nba";
        const result = await getOddsComparison(env, sport);
        return jsonResponse(result);
      }
      
      // Debug endpoint to see raw Polymarket sports data
      if (path === "/debug/poly-sports") {
        const sport = url.searchParams.get("sport") || "nba";
        const POLYMARKET_API = "https://data-api.polymarket.com";
        
        try {
          const tradesRes = await fetch(`${POLYMARKET_API}/trades?limit=2000`);
          const allTrades = tradesRes.ok ? await tradesRes.json() : [];
          
          // Filter to sports trades
          const sportPrefix = sport.toLowerCase() + '-';
          const sportsTrades = allTrades.filter(t => {
            const slug = (t.eventSlug || t.slug || '').toLowerCase();
            return slug.startsWith(sportPrefix);
          });
          
          // Get unique slugs
          const uniqueSlugs = [...new Set(sportsTrades.map(t => t.eventSlug || t.slug))];
          
          // Sample trades with full data
          const sampleTrades = sportsTrades.slice(0, 30).map(t => ({
            eventSlug: t.eventSlug,
            slug: t.slug,
            outcome: t.outcome,
            price: t.price,
            timestamp: t.timestamp
          }));
          
          return jsonResponse({
            success: true,
            totalTrades: allTrades.length,
            sportTradesCount: sportsTrades.length,
            uniqueSlugs: uniqueSlugs.slice(0, 30),
            sampleTrades
          });
        } catch (e) {
          return jsonResponse({ success: false, error: e.message });
        }
      }
      
      if (path === "/odds/compare") {
        const sport = url.searchParams.get("sport") || "nba";
        const sportKey = SPORT_KEY_MAP[sport];
        
        if (!sportKey) {
          return jsonResponse({ success: false, error: "Sport not supported" });
        }
        
        if (!env.ODDS_API_KEY) {
          return jsonResponse({ success: false, error: "Odds API not configured" });
        }
        
        const oddsData = await getGameOdds(env, sportKey, 'h2h,spreads');
        return jsonResponse({ 
          success: true, 
          sport, 
          sportKey, 
          gamesCount: oddsData?.length || 0,
          games: oddsData || []
        });
      }
      
      if (path === "/odds/scores") {
        const sport = url.searchParams.get("sport") || "nba";
        const days = parseInt(url.searchParams.get("days") || "3");
        const sportKey = SPORT_KEY_MAP[sport];
        
        if (!sportKey) {
          return jsonResponse({ success: false, error: "Sport not supported" });
        }
        
        const scores = await getGameScores(env, sportKey, days);
        return jsonResponse({ success: true, sport, daysBack: days, games: scores || [] });
      }
      
      // ============ LEARNING/DEBUG ENDPOINTS ============
      
      if (path === "/learning/stats") {
        if (!env.SIGNALS_CACHE) {
          return jsonResponse({ success: false, error: "No cache configured" });
        }
        
        const factorStats = await getFactorStats(env);
        const pending = await env.SIGNALS_CACHE.get(KV_KEYS.PENDING_SIGNALS, { type: "json" }) || [];
        const walletIndex = await getTrackedWallets(env);
        const aiRecommendation = await getAIRecommendation(env);
        
        // Calculate overall stats
        let totalWins = 0;
        let totalLosses = 0;
        for (const stats of Object.values(factorStats)) {
          totalWins += stats.wins || 0;
          totalLosses += stats.losses || 0;
        }
        const totalProcessed = totalWins + totalLosses;
        const overallWinRate = totalProcessed > 0 ? Math.round((totalWins / totalProcessed) * 100) : 0;
        
        return jsonResponse({
          success: true,
          pendingSignals: pending.length,
          trackedWallets: walletIndex.length,
          factorStats,
          totalFactors: Object.keys(factorStats).length,
          signalsProcessed: totalProcessed,
          overallWinRate,
          totalWins,
          totalLosses,
          aiRecommendation
        });
      }
      
      // AI Recommendation endpoint
      if (path === "/learning/recommendation") {
        const recommendation = await getAIRecommendation(env);
        return jsonResponse({
          success: true,
          ...recommendation
        });
      }
      
      // Discovered patterns endpoint - shows auto-discovered trends
      if (path === "/learning/patterns" || path === "/learning/discoveries") {
        const patterns = await getDiscoveredPatterns(env);
        const factorStats = await getFactorStats(env);
        
        // Find all discovered factors
        const discoveredFactors = Object.entries(factorStats)
          .filter(([name, stats]) => stats.isDiscovered)
          .map(([name, stats]) => ({
            name,
            winRate: stats.winRate,
            record: `${stats.wins}W-${stats.losses}L`,
            weight: stats.weight,
            discoveredAt: stats.discoveredAt,
            category: stats.category
          }))
          .sort((a, b) => b.winRate - a.winRate);
        
        return jsonResponse({
          success: true,
          discoveredFactors,
          totalDiscovered: discoveredFactors.length,
          patternsNearPromotion: patterns.nearPromotion,
          tracking: patterns.allTracking
        });
      }
      
      // Learning leaderboard - returns wallet data in format expected by WhaleWatchers
      if (path === "/learning/leaderboard") {
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const wallets = await getWalletLeaderboard(env, limit);
        
        // Transform to format frontend expects
        const leaderboardData = wallets.map(w => ({
          address: w.address,
          tier: w.tier || 'NEW',
          winRate: w.winRate || 0,
          wins: w.wins || 0,
          losses: w.losses || 0,
          pending: w.pending || 0,
          totalBets: w.totalBets || 0,
          record: `${w.wins || 0}W-${w.losses || 0}L`,
          currentStreak: w.currentStreak || 0,
          bestStreak: w.bestStreak || 0,
          totalVolume: w.totalVolume || 0,
          profitLoss: w.profitLoss || 0,
          lastBetAt: w.lastBetAt
        }));
        
        // Calculate tier counts
        const insiderCount = leaderboardData.filter(w => w.tier === 'INSIDER').length;
        const eliteCount = leaderboardData.filter(w => w.tier === 'ELITE').length;
        const strongCount = leaderboardData.filter(w => w.tier === 'STRONG').length;
        
        return jsonResponse({
          success: true,
          leaderboard: leaderboardData,
          totalTracked: leaderboardData.length,
          tierCounts: {
            insider: insiderCount,
            elite: eliteCount,
            strong: strongCount
          }
        });
      }
      
      // Debug wallet data
      if (path === "/debug/wallets") {
        if (!env.SIGNALS_CACHE) {
          return jsonResponse({ success: false, error: "No cache" });
        }
        
        const walletIndex = await getTrackedWallets(env);
        const sampleWallets = [];
        
        // Try to fetch first 5 wallets to see data structure
        for (const address of walletIndex.slice(0, 5)) {
          if (!address) {
            sampleWallets.push({ address: "NULL", error: "null address in index" });
            continue;
          }
          
          // Try different key formats
          const key1 = "wallet_" + address.toLowerCase();
          const key2 = "wallet_" + address;
          const key3 = address;
          
          const data1 = await env.SIGNALS_CACHE.get(key1, { type: "json" });
          const data2 = await env.SIGNALS_CACHE.get(key2, { type: "json" });
          const data3 = await env.SIGNALS_CACHE.get(key3, { type: "json" });
          
          sampleWallets.push({
            address,
            key1_found: !!data1,
            key2_found: !!data2,
            key3_found: !!data3,
            data: data1 || data2 || data3 || null
          });
        }
        
        return jsonResponse({
          success: true,
          totalInIndex: walletIndex.length,
          sampleAddresses: walletIndex.slice(0, 10),
          sampleWallets
        });
      }
      
      if (path === "/settlement/run") {
        const results = await processSettledSignals(env);
        return jsonResponse({ success: true, results });
      }
      
      if (path === "/cron-status") {
        if (!env.SIGNALS_CACHE) {
          return jsonResponse({ success: false, error: "No cache" });
        }
        
        const lastRun = await env.SIGNALS_CACHE.get(KV_KEYS.LAST_CRON_RUN);
        const stats = await env.SIGNALS_CACHE.get(KV_KEYS.CRON_STATS, { type: "json" });
        
        return jsonResponse({
          success: true,
          lastRun,
          stats,
          minutesSinceRun: lastRun ? Math.round((Date.now() - new Date(lastRun).getTime()) / 60000) : null
        });
      }
      
      // ============ ADMIN ENDPOINTS ============
      
      // Admin endpoint to reset stale wallet data
      if (path === "/admin/reset-wallets" && request.method === "POST") {
        const authHeader = request.headers.get("Authorization");
        // Simple auth - change this secret in production!
        if (authHeader !== "Bearer polymarket-admin-2026") {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        
        try {
          const clearedKeys = [];
          
          // Clear wallet index
          await env.SIGNALS_CACHE.delete("tracked_wallet_index");
          clearedKeys.push("tracked_wallet_index");
          
          // Get and clear all wallet_* keys (the old format that has null addresses)
          // Note: KV doesn't support list, so we just clear the index which is the main issue
          
          return jsonResponse({ 
            success: true, 
            message: "Wallet index cleared. New signals will repopulate leaderboard with fresh data.",
            clearedKeys,
            note: "Individual wallet stats remain but won't appear in leaderboard until re-tracked"
          });
        } catch (error) {
          return jsonResponse({ error: error.message }, 500);
        }
      }
      
      // Debug endpoint to see wallet data structure issues
      if (path === "/admin/wallet-debug") {
        if (!env.SIGNALS_CACHE) {
          return jsonResponse({ success: false, error: "No cache" });
        }
        
        try {
          const walletIndex = await env.SIGNALS_CACHE.get("tracked_wallet_index", { type: "json" }) || [];
          
          // Check for problematic entries
          const issues = {
            nullEntries: walletIndex.filter(w => w === null).length,
            undefinedEntries: walletIndex.filter(w => w === undefined).length,
            emptyStrings: walletIndex.filter(w => w === '').length,
            validAddresses: walletIndex.filter(w => w && typeof w === 'string' && w.startsWith('0x')).length
          };
          
          // Sample the first few to show structure
          const sampleEntries = walletIndex.slice(0, 10).map((entry, i) => ({
            index: i,
            value: entry,
            type: typeof entry,
            isNull: entry === null,
            isValid: entry && typeof entry === 'string' && entry.startsWith('0x')
          }));
          
          return jsonResponse({
            success: true,
            totalInIndex: walletIndex.length,
            issues,
            sampleEntries,
            recommendation: issues.nullEntries > 0 || issues.undefinedEntries > 0 
              ? "Run POST /admin/reset-wallets to clear corrupted data" 
              : "Index looks healthy"
          });
        } catch (error) {
          return jsonResponse({ error: error.message }, 500);
        }
      }
      
      // ============ HEALTH/INFO ============
      
      if (path === "/" || path === "/health") {
        return jsonResponse({
          status: "ok",
          version: VERSION,
          endpoints: [
            "GET /scan - Run signal scan",
            "GET /signals/recent - Get recent signals",
            "GET /wallets/leaderboard - Get wallet leaderboard",
            "GET /wallet/{address}/stats - Get wallet stats",
            "GET /odds/compare-all?sport=nba - Vegas vs Polymarket comparison",
            "GET /odds/compare?sport=nba - Vegas odds only",
            "GET /odds/scores?sport=nba - Game scores",
            "GET /learning/stats - AI learning stats",
            "GET /settlement/run - Manual settlement trigger",
            "GET /cron-status - Cron job status"
          ]
        });
      }
      
      // 404
      return jsonResponse({ error: "Not found", path }, 404);
      
    } catch (e) {
      return jsonResponse({ error: e.message, stack: e.stack }, 500);
    }
  }
};

// Helper function for JSON responses
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
