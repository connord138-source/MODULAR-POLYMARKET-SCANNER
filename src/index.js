// ============================================================
// INDEX.JS - Main Router for Polymarket Scanner
// v18.9.0 - Winning Focus: Track winners, prune losers, sports priority
// ============================================================

import { corsHeaders, VERSION, SPORT_KEY_MAP, KV_KEYS } from './config.js';
import { runScan, getRecentSignals, getSignal, getPendingSignalsCount, getTrackedWalletsCount } from './signals.js';
import { getWalletStats, getWalletLeaderboard, getTrackedWallets, pruneLosingWallets, clearTradeBuckets, fullKVCleanup, deduplicateWalletBets } from './wallets.js';
import { getOddsComparison, getGameScores, getGameOdds } from './odds-api.js';
import { processSettledSignals } from './settlement.js';
import { getFactorStats, getAIRecommendation, updateFactorStats, getDiscoveredPatterns } from './learning.js';
import { pollAndStoreTrades, getAccumulatedTrades, getPollStats, clearAccumulatedTrades } from './trades.js';

// Polymarket API functions
import { 
  getSportsMarketsWithPrices, 
  getMarketBySlug,
  getMarkets,
  getMidpoint,
  getMidpoints,
  getOrderBook,
  getPrice,
  getLastTradePrice,
  getRecentTrades
} from './polymarket-api.js';

// NEW: Edge Detection imports
import { runEdgeDetection, quickEdgeCheck } from './edge-detector.js';
import { getBettingSplits, analyzeSharpMoney } from './betting-splits.js';
import { getSharpLineComparison, getLineMovement, trackLineMovement, detectSteamMove, calculateCLV } from './sharp-lines.js';

export default {
  // Scheduled cron handler - runs every minute to accumulate trades
  async scheduled(event, env, ctx) {
    console.log("Cron triggered:", event.cron);
    
    try {
      // ALWAYS poll for trades first (this runs every minute)
      const pollResult = await pollAndStoreTrades(env);
      console.log("Trade poll result:", pollResult);
      
      // Run settlement check less frequently (check if it's been >10 minutes)
      let settlementResults = null;
      const lastSettlement = await env.SIGNALS_CACHE?.get('last_settlement_run');
      const lastSettlementTime = lastSettlement ? new Date(lastSettlement).getTime() : 0;
      const minutesSinceSettlement = (Date.now() - lastSettlementTime) / 60000;
      
      if (minutesSinceSettlement > 10) {
        settlementResults = await processSettledSignals(env);
        console.log("Settlement results:", settlementResults);
        await env.SIGNALS_CACHE?.put('last_settlement_run', new Date().toISOString());
      }
      
      // Store cron stats
      if (env.SIGNALS_CACHE) {
        try {
          await env.SIGNALS_CACHE.put(KV_KEYS.LAST_CRON_RUN, new Date().toISOString());
          await env.SIGNALS_CACHE.put(KV_KEYS.CRON_STATS, JSON.stringify({
            lastRun: new Date().toISOString(),
            tradePoll: pollResult,
            settlement: settlementResults
          }));
        } catch (e) {
          console.log('KV write failed (quota?):', e.message);
        }
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
      
      if (path === "/scan/sports" || path === "/sports/scan") {
        const hours = parseInt(url.searchParams.get("hours") || "48");
        const minScore = parseInt(url.searchParams.get("minScore") || "40");
        const debug = url.searchParams.get("debug") === "true";
        
        const result = await runScan(hours, minScore, env, { 
          sportsOnly: true, 
          includeDebug: debug 
        });
        
        // Return sports signals with top 15 priority
        return jsonResponse({
          ...result,
          signals: result.sportsSignals || result.signals?.slice(0, 15) || [],
          allSportsSignals: result.signals,
          topSportsCount: (result.sportsSignals || []).length
        });
      }
      
      // NEW: Top 15 sports props endpoint
      if (path === "/scan/sports/top15" || path === "/sports/top15") {
        const result = await runScan(48, 30, env, { sportsOnly: true });
        
        // Filter to ONLY signals with winning wallets or high confidence
        const topSignals = (result.sportsSignals || result.signals || [])
          .filter(s => s.hasWinningWallet || s.confidence >= 65)
          .slice(0, 15);
        
        return jsonResponse({
          success: true,
          signals: topSignals,
          totalSportsSignals: (result.signals || []).length,
          signalsWithWinners: topSignals.filter(s => s.hasWinningWallet).length,
          avgConfidence: topSignals.length > 0 
            ? Math.round(topSignals.reduce((sum, s) => sum + s.confidence, 0) / topSignals.length)
            : 0
        });
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
      
      // ============ EDGE DETECTION ENDPOINTS (NEW!) ============
      
      // Full edge detection - combines all data sources
      if (path === "/edge/detect" || path.match(/^\/edge\/detect\/[a-z]+$/i)) {
        const sport = path.split("/")[3] || url.searchParams.get("sport") || "nba";
        const result = await runEdgeDetection(env, sport);
        return jsonResponse(result);
      }
      
      // Quick edge check (uses cache when available)
      if (path === "/edge/quick" || path.match(/^\/edge\/quick\/[a-z]+$/i)) {
        const sport = path.split("/")[3] || url.searchParams.get("sport") || "nba";
        const result = await quickEdgeCheck(env, sport);
        return jsonResponse(result);
      }
      
      // Betting splits (DraftKings public money flow)
      if (path === "/edge/splits" || path.match(/^\/edge\/splits\/[a-z]+$/i)) {
        const sport = path.split("/")[3] || url.searchParams.get("sport") || "nba";
        const result = await getBettingSplits(env, sport);
        
        // Optionally analyze for sharp money
        if (url.searchParams.get("analyze") === "true" && result.success) {
          const analysis = analyzeSharpMoney(result.games || []);
          return jsonResponse({
            ...result,
            sharpMoneyGames: analysis,
            sharpGamesCount: analysis.length
          });
        }
        
        return jsonResponse(result);
      }
      
      // Sharp line comparison (Pinnacle vs soft books)
      if (path === "/edge/sharp" || path.match(/^\/edge\/sharp\/[a-z]+$/i)) {
        const sport = path.split("/")[3] || url.searchParams.get("sport") || "nba";
        const result = await getSharpLineComparison(env, sport);
        return jsonResponse(result);
      }
      
      // Line movement tracking
      if (path.startsWith("/edge/movement/")) {
        const gameId = path.split("/")[3];
        
        if (request.method === "POST") {
          const body = await request.json();
          const result = await trackLineMovement(env, gameId, body.odds);
          return jsonResponse({ success: true, result });
        } else {
          const history = await getLineMovement(env, gameId);
          
          if (history) {
            const steamMoves = detectSteamMove(history);
            return jsonResponse({ 
              success: true, 
              ...history,
              steamAnalysis: steamMoves
            });
          }
          
          return jsonResponse({ success: false, error: "No line history for game" });
        }
      }
      
      // CLV calculator
      if (path === "/edge/clv") {
        const entryOdds = parseFloat(url.searchParams.get("entry"));
        const closingOdds = parseFloat(url.searchParams.get("closing"));
        
        if (isNaN(entryOdds) || isNaN(closingOdds)) {
          return jsonResponse({ 
            success: false, 
            error: "Provide entry and closing odds as query params (American format)",
            example: "/edge/clv?entry=-110&closing=-125"
          }, 400);
        }
        
        const clv = calculateCLV(entryOdds, closingOdds);
        return jsonResponse({ success: true, ...clv });
      }
      
      // ============ POLYMARKET API ENDPOINTS ============
      
      if (path === "/polymarket/sports" || path.match(/^\/polymarket\/sports\/[a-z]+$/i)) {
        const sport = path.split("/")[3] || url.searchParams.get("sport") || "nba";
        const result = await getSportsMarketsWithPrices(env, sport);
        return jsonResponse(result);
      }
      
      if (path === "/polymarket/markets") {
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const tag_slug = url.searchParams.get("tag") || url.searchParams.get("tag_slug");
        const active = url.searchParams.get("active") !== "false";
        const closed = url.searchParams.get("closed") === "true";
        
        const result = await getMarkets(env, { limit, offset, tag_slug, active, closed });
        return jsonResponse(result);
      }
      
      if (path.startsWith("/polymarket/market/")) {
        const slug = path.split("/").slice(3).join("/");
        const result = await getMarketBySlug(env, slug);
        return jsonResponse(result);
      }
      
      if (path.startsWith("/polymarket/midpoint/")) {
        const tokenId = path.split("/")[3];
        const result = await getMidpoint(env, tokenId);
        return jsonResponse(result);
      }
      
      if (path === "/polymarket/midpoints") {
        const tokenIds = url.searchParams.get("token_ids")?.split(",") || [];
        if (tokenIds.length === 0) {
          return jsonResponse({ error: "token_ids parameter required" }, 400);
        }
        const results = await getMidpoints(env, tokenIds);
        return jsonResponse({ success: true, midpoints: results });
      }
      
      if (path.startsWith("/polymarket/book/")) {
        const tokenId = path.split("/")[3];
        const result = await getOrderBook(env, tokenId);
        return jsonResponse(result);
      }
      
      if (path.startsWith("/polymarket/price/")) {
        const tokenId = path.split("/")[3];
        const side = url.searchParams.get("side") || "BUY";
        const result = await getPrice(env, tokenId, side);
        return jsonResponse(result);
      }
      
      if (path.startsWith("/polymarket/last-trade/")) {
        const tokenId = path.split("/")[3];
        const result = await getLastTradePrice(env, tokenId);
        return jsonResponse(result);
      }
      
      if (path === "/polymarket/trades") {
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const market = url.searchParams.get("market");
        const result = await getRecentTrades(env, { limit, market });
        return jsonResponse(result);
      }
      
      // ============ TRADE ACCUMULATION ENDPOINTS ============
      
      if (path === "/trades/poll") {
        const result = await pollAndStoreTrades(env);
        return jsonResponse(result);
      }
      
      if (path === "/trades/stats") {
        const stats = await getPollStats(env);
        return jsonResponse({ success: true, ...stats });
      }
      
      if (path === "/trades/accumulated") {
        const hours = parseInt(url.searchParams.get("hours") || "48");
        const result = await getAccumulatedTrades(env, hours);
        return jsonResponse({
          success: true,
          fromKV: result.fromKV,
          totalTrades: result.trades?.length || 0,
          bucketsRead: result.bucketsRead || 0,
          oldestTrade: result.trades?.length > 0 
            ? new Date(result.trades[result.trades.length - 1].timestamp * 1000).toISOString()
            : null,
          newestTrade: result.trades?.length > 0
            ? new Date(result.trades[0].timestamp * 1000).toISOString()
            : null,
          sampleTrades: result.trades?.slice(0, 5).map(t => ({
            title: t.title,
            size: t.size,
            price: t.price,
            time: new Date(t.timestamp * 1000).toISOString()
          }))
        });
      }
      
      if (path === "/trades/clear" && request.method === "POST") {
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== "Bearer polymarket-admin-2026") {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const result = await clearAccumulatedTrades(env);
        return jsonResponse(result);
      }
      
      // ============ WALLET ENDPOINTS ============
      
      if (path === "/wallets/leaderboard") {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const wallets = await getWalletLeaderboard(env, limit);
        return jsonResponse({ 
          success: true, 
          wallets,
          count: wallets.length,
          message: wallets.length === 0 ? "No wallet data available yet." : null
        });
      }
      
      if (path.startsWith("/wallet/") && (path.endsWith("/stats") || path.split("/").length === 3)) {
        const address = path.split("/")[2];
        const stats = await getWalletStats(env, address);
        return jsonResponse({ success: !!stats, ...stats });
      }
      
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
      
      // ============ ODDS ENDPOINTS ============
      
      if (path === "/odds/compare-all") {
        const sport = url.searchParams.get("sport") || "nba";
        const result = await getOddsComparison(env, sport);
        return jsonResponse(result);
      }
      
      if (path === "/odds/compare") {
        const sport = url.searchParams.get("sport") || "nba";
        const sportKey = SPORT_KEY_MAP[sport.toLowerCase()];
        
        if (!sportKey) {
          return jsonResponse({ error: `Unknown sport: ${sport}` }, 400);
        }
        
        const odds = await getGameOdds(env, sportKey);
        return jsonResponse({ success: true, sport, odds });
      }
      
      if (path === "/odds/scores") {
        const sport = url.searchParams.get("sport") || "nba";
        const sportKey = SPORT_KEY_MAP[sport.toLowerCase()];
        
        if (!sportKey) {
          return jsonResponse({ error: `Unknown sport: ${sport}` }, 400);
        }
        
        const scores = await getGameScores(env, sportKey);
        return jsonResponse({ success: true, sport, scores });
      }
      
      // ============ LEARNING/AI ENDPOINTS ============
      
      if (path === "/learning/stats") {
        const stats = await getFactorStats(env);
        
        // Get additional context
        let pendingSignals = 0;
        let trackedWallets = 0;
        let marketTypeStats = {};
        let volumeBrackets = {};
        
        if (env.SIGNALS_CACHE) {
          try {
            const pending = await env.SIGNALS_CACHE.get(KV_KEYS.PENDING_SIGNALS, { type: 'json' }) || [];
            pendingSignals = pending.length;
            
            const walletIndex = await env.SIGNALS_CACHE.get('tracked_wallet_index', { type: 'json' }) || [];
            trackedWallets = walletIndex.length;
            
            marketTypeStats = await env.SIGNALS_CACHE.get('market_type_stats', { type: 'json' }) || {};
            volumeBrackets = await env.SIGNALS_CACHE.get('volume_brackets', { type: 'json' }) || {};
          } catch (e) {
            console.error('Error fetching learning context:', e.message);
          }
        }
        
        // Calculate totals
        let totalWins = 0;
        let totalLosses = 0;
        Object.values(stats).forEach(factor => {
          totalWins += factor.wins || 0;
          totalLosses += factor.losses || 0;
        });
        
        return jsonResponse({ 
          success: true, 
          stats,
          pendingSignals,
          trackedWallets,
          summary: {
            totalSignalsProcessed: totalWins + totalLosses,
            overallWinRate: (totalWins + totalLosses) > 0 
              ? Math.round((totalWins / (totalWins + totalLosses)) * 100) 
              : 0,
            totalWins,
            totalLosses,
            factorCount: Object.keys(stats).length
          },
          marketTypeStats,
          volumeBrackets
        });
      }
      
      if (path === "/learning/fades") {
        const stats = await getFactorStats(env);
        
        const fadeFactors = Object.entries(stats)
          .filter(([name, data]) => {
            const total = (data.wins || 0) + (data.losses || 0);
            return total >= 5 && data.winRate < 45;
          })
          .map(([name, data]) => ({
            factor: name,
            winRate: data.winRate,
            record: `${data.wins}W-${data.losses}L`,
            recommendation: 'FADE'
          }))
          .sort((a, b) => a.winRate - b.winRate);
        
        return jsonResponse({ 
          success: true, 
          fades: fadeFactors,
          message: fadeFactors.length > 0 
            ? `Found ${fadeFactors.length} factors to fade` 
            : 'No fade candidates yet'
        });
      }
      
      if (path === "/learning/patterns") {
        const patterns = await getDiscoveredPatterns(env);
        return jsonResponse({ success: true, patterns });
      }
      
      if (path === "/learning/recommendation") {
        const recommendation = await getAIRecommendation(env);
        return jsonResponse({ success: true, recommendation });
      }
      
      if (path === "/learning/leaderboard") {
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const wallets = await getWalletLeaderboard(env, limit);
        
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
        
        return jsonResponse({
          success: true,
          leaderboard: leaderboardData,
          totalTracked: leaderboardData.length,
          tierCounts: {
            insider: leaderboardData.filter(w => w.tier === 'INSIDER').length,
            elite: leaderboardData.filter(w => w.tier === 'ELITE').length,
            strong: leaderboardData.filter(w => w.tier === 'STRONG').length
          }
        });
      }
      
      // ============ DEBUG ENDPOINTS ============
      
      if (path === "/debug/wallets") {
        if (!env.SIGNALS_CACHE) {
          return jsonResponse({ success: false, error: "No cache" });
        }
        
        const walletIndex = await getTrackedWallets(env);
        return jsonResponse({
          success: true,
          totalInIndex: walletIndex.length,
          sampleAddresses: walletIndex.slice(0, 10)
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
        const pollStats = await getPollStats(env);
        
        return jsonResponse({
          success: true,
          lastRun,
          stats,
          pollStats,
          minutesSinceRun: lastRun ? Math.round((Date.now() - new Date(lastRun).getTime()) / 60000) : null
        });
      }
      
      // ============ ADMIN ENDPOINTS ============
      
      // NEW: Prune losing wallets (keep only winners)
      if (path === "/admin/prune-losers" && request.method === "POST") {
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== "Bearer polymarket-admin-2026") {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        
        try {
          const result = await pruneLosingWallets(env);
          return jsonResponse({ 
            success: true, 
            message: `Pruned ${result.pruned} losing wallets, kept ${result.kept} winners`,
            ...result
          });
        } catch (error) {
          return jsonResponse({ error: error.message }, 500);
        }
      }
      
      // NEW: Clear trade buckets (free memory)
      if (path === "/admin/clear-buckets" && request.method === "POST") {
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== "Bearer polymarket-admin-2026") {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        
        try {
          const result = await clearTradeBuckets(env);
          return jsonResponse({ 
            success: true, 
            message: `Cleared ${result.cleared} trade buckets`,
            ...result
          });
        } catch (error) {
          return jsonResponse({ error: error.message }, 500);
        }
      }
      
      // NEW: Full cleanup (buckets + losers)
      if (path === "/admin/full-cleanup" && request.method === "POST") {
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== "Bearer polymarket-admin-2026") {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        
        try {
          const result = await fullKVCleanup(env);
          return jsonResponse({ 
            success: true, 
            message: "Full cleanup complete",
            ...result
          });
        } catch (error) {
          return jsonResponse({ error: error.message }, 500);
        }
      }
      
      // NEW: Deduplicate wallet bets (fix inflated win/loss records)
      if (path === "/admin/dedupe-wallets" && request.method === "POST") {
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== "Bearer polymarket-admin-2026") {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        
        try {
          const result = await deduplicateWalletBets(env);
          return jsonResponse({ 
            success: true, 
            message: `Deduped ${result.walletsProcessed} wallets, removed ${result.duplicatesRemoved} duplicate bets`,
            ...result
          });
        } catch (error) {
          return jsonResponse({ error: error.message }, 500);
        }
      }
      
      if (path === "/admin/reset-wallets" && request.method === "POST") {
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== "Bearer polymarket-admin-2026") {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        
        try {
          await env.SIGNALS_CACHE.delete("tracked_wallet_index");
          return jsonResponse({ 
            success: true, 
            message: "Wallet index cleared."
          });
        } catch (error) {
          return jsonResponse({ error: error.message }, 500);
        }
      }
      
      if (path === "/admin/clear-cache" && request.method === "POST") {
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== "Bearer polymarket-admin-2026") {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        
        try {
          const keysToDelete = [
            'gamma_markets_all_100_0',
            'sports_markets_nba', 'sports_markets_ncaa-cbb', 'sports_markets_nfl', 'sports_markets_nhl',
            'odds_comparison_v2_nba', 'odds_comparison_v2_ncaab', 'odds_comparison_v2_nfl', 'odds_comparison_v2_nhl',
            'edge_detection_nba', 'edge_detection_nfl', 'edge_detection_ncaab',
            'betting_splits_nba', 'betting_splits_nfl', 'betting_splits_ncaab',
            'sharp_lines_nba', 'sharp_lines_nfl', 'sharp_lines_ncaab'
          ];
          
          const deleted = [];
          for (const key of keysToDelete) {
            try {
              await env.SIGNALS_CACHE.delete(key);
              deleted.push(key);
            } catch (e) {}
          }
          
          return jsonResponse({ 
            success: true, 
            message: "All caches cleared",
            deletedKeys: deleted
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
          endpoints: {
            scanner: [
              "GET /scan - Run signal scan",
              "GET /scan/sports - Sports-only scan",
              "GET /signals/recent - Get recent signals"
            ],
            edgeDetection: [
              "GET /edge/detect/:sport - Full edge detection (combines all sources)",
              "GET /edge/quick/:sport - Quick edge check (cached)",
              "GET /edge/splits/:sport - DraftKings betting splits (public money flow)",
              "GET /edge/sharp/:sport - Pinnacle vs soft book comparison",
              "GET /edge/movement/:gameId - Line movement tracking",
              "GET /edge/clv?entry=X&closing=Y - Calculate closing line value"
            ],
            polymarket: [
              "GET /polymarket/sports/:sport - Real-time sports prices",
              "GET /polymarket/markets - List all markets",
              "GET /polymarket/market/:slug - Get market by slug"
            ],
            vegasComparison: [
              "GET /odds/compare-all?sport=nba - Vegas vs Polymarket",
              "GET /odds/scores?sport=nba - Game scores"
            ],
            wallets: [
              "GET /wallets/leaderboard - Wallet leaderboard",
              "GET /wallet/:address/stats - Wallet stats"
            ],
            learning: [
              "GET /learning/stats - Factor statistics",
              "GET /learning/fades - Fade recommendations"
            ]
          }
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
