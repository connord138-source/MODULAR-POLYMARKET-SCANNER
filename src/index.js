// ============================================================
// INDEX.JS - Main Router for Polymarket Scanner
// v18.9.0 - Winning Focus: Track winners, prune losers, sports priority
// ============================================================

import { corsHeaders, VERSION, SPORT_KEY_MAP, KV_KEYS, POLYMARKET_API } from './config.js';
import { runScan, getRecentSignals, getSignal, getPendingSignalsCount, getTrackedWalletsCount } from './signals.js';
import { getWalletStats, getWalletLeaderboard, getTrackedWallets, pruneLosingWallets, clearTradeBuckets, fullKVCleanup, deduplicateWalletBets, getWalletPnL } from './wallets.js';
import { getOddsComparison, getGameScores, getGameOdds } from './odds-api.js';
import { processSettledSignals } from './settlement.js';
import { getFactorStats, getAIRecommendation, updateFactorStats, getDiscoveredPatterns, getFactorCombos, hasStrongCombo } from './learning.js';
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
        const pnlData = await getWalletPnL(env, address);
        return jsonResponse(pnlData);
      }
      
      // ============ ODDS ENDPOINTS ============
      
      if (path === "/odds/compare-all") {
        const sport = url.searchParams.get("sport") || "nba";
        const result = await getOddsComparison(env, sport);
        return jsonResponse(result);
      }
      
      // Debug endpoint to test Polymarket market fetching
      if (path === "/debug/poly-markets") {
        const sport = url.searchParams.get("sport") || "nba";
        try {
          const polyMarkets = await getSportsMarketsWithPrices(env, sport);
          return jsonResponse({
            success: true,
            sport,
            marketsFound: polyMarkets?.markets?.length || 0,
            fromCache: polyMarkets?.fromCache || false,
            source: polyMarkets?.source || 'unknown',
            seriesId: polyMarkets?.seriesId || null,
            eventsCount: polyMarkets?.eventsCount || 0,
            sampleMarkets: (polyMarkets?.markets || []).slice(0, 5).map(m => ({
              slug: m.slug,
              eventSlug: m.eventSlug,
              eventTitle: m.eventTitle,
              question: m.question,
              outcomes: m.outcomes,
              outcomePrices: m.outcomePrices,
              yesPrice: m.yesPrice,
              noPrice: m.noPrice,
              gameStartTime: m.gameStartTime
            })),
            error: polyMarkets?.error || null
          });
        } catch (e) {
          return jsonResponse({ success: false, error: e.message, stack: e.stack });
        }
      }
      
      // Debug: show raw /sports metadata from Gamma API
      if (path === "/debug/sports-meta") {
        try {
          const response = await fetch(`https://gamma-api.polymarket.com/sports`);
          const data = await response.json();
          return jsonResponse({ success: true, status: response.status, data });
        } catch (e) {
          return jsonResponse({ success: false, error: e.message });
        }
      }
      
      // Debug: test raw events fetch for a series_id
      if (path === "/debug/events-raw") {
        const seriesId = url.searchParams.get("series_id") || "10345";
        try {
          const response = await fetch(
            `https://gamma-api.polymarket.com/events?series_id=${seriesId}&active=true&closed=false&limit=10&order=startTime&ascending=true`
          );
          const data = await response.json();
          return jsonResponse({
            success: true,
            seriesId,
            status: response.status,
            eventsReturned: Array.isArray(data) ? data.length : 'not array',
            sampleEvents: (Array.isArray(data) ? data : []).slice(0, 3).map(e => ({
              id: e.id,
              slug: e.slug,
              title: e.title,
              startDate: e.startDate,
              marketsCount: e.markets?.length || 0,
              sampleMarket: e.markets?.[0] ? {
                question: e.markets[0].question,
                slug: e.markets[0].slug,
                outcomes: e.markets[0].outcomes,
                outcomePrices: e.markets[0].outcomePrices
              } : null
            }))
          });
        } catch (e) {
          return jsonResponse({ success: false, error: e.message });
        }
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
          volumeBrackets,
          // Factor descriptions for frontend display
          factorDescriptions: {
            // Whale size
            whaleSize100k: 'Largest single bet > $100K',
            whaleSize50k: 'Largest single bet $50K-$100K',
            whaleSize25k: 'Largest single bet $25K-$50K',
            whaleSize15k: 'Largest single bet $15K-$25K',
            whaleSize8k: 'Largest single bet $8K-$15K',
            whaleSize5k: 'Largest single bet $5K-$8K',
            whaleSize3k: 'Largest single bet $3K-$5K',
            // Volume
            volumeHuge: 'Total market volume > $500K',
            volumeModerate: 'Total market volume $50K-$100K',
            volumeNotable: 'Total market volume $100K-$500K',
            vol_100k_plus: 'Signal volume over $100K',
            vol_50k_100k: 'Signal volume $50K-$100K',
            vol_25k_50k: 'Signal volume $25K-$50K',
            vol_10k_25k: 'Signal volume $10K-$25K',
            vol_under_10k: 'Signal volume under $10K',
            // Concentration
            concentrated: 'Betting heavily concentrated (>70% one direction)',
            coordinated: 'Multiple wallets betting same direction within minutes',
            // Directional odds (IMPROVEMENT #4)
            buyDeepLongshot: 'Buying at <15% (deep longshot)',
            buyLongshot: 'Buying at 15-25% (longshot)',
            buyUnderdog: 'Buying at 25-40% (underdog)',
            buyFavorite: 'Buying at 70-85% (favorite)',
            buyHeavyFavorite: 'Buying at 85%+ (heavy favorite)',
            // Legacy odds
            extremeOdds: 'Entry price < 20% or > 80% (legacy)',
            moderateLongshot: 'Betting on longshot (20-40% odds)',
            moderateFavorite: 'Betting on favorite (60-80% odds)',
            // Event timing (IMPROVEMENT #5)
            betDuringEvent: 'Bet placed during/after event start (live)',
            betLast2Hours: 'Bet placed within 2 hours of event',
            betSameDay: 'Bet placed same day (2-6h before)',
            betDayBefore: 'Bet placed day before event',
            betEarlyDays: 'Bet placed 1-3 days before event',
            betVeryEarly: 'Bet placed 3+ days before event',
            // Wallets
            winningWallet: 'Signal includes wallet with 55%+ win rate',
            freshWhale5k: 'New wallet betting $5K+ (< 5 prior bets)',
            freshWhale10k: 'New wallet betting $10K+ (< 5 prior bets)',
            // Market types
            'sports-nba': 'NBA basketball game',
            'sports-nfl': 'NFL football game',
            'sports-nhl': 'NHL hockey game',
            'sports-ncaab': 'NCAA basketball game',
            'sports-mma': 'MMA/UFC fight',
            'sports-other': 'Other sports market',
            'sports-futures': 'Futures/Championship market',
            crypto: 'Cryptocurrency market',
            politics: 'Political market',
            other: 'Other market type',
            // Wallet count
            single_wallet: 'Single wallet signal',
            two_wallets: 'Two wallets in signal',
            few_wallets_3_5: '3-5 wallets in signal',
            many_wallets_6_plus: '6+ wallets in signal',
            // Time of day
            morning_5_12: 'Signal detected 5am-12pm ET',
            afternoon_12_17: 'Signal detected 12pm-5pm ET',
            evening_17_22: 'Signal detected 5pm-10pm ET',
            night_22_5: 'Signal detected 10pm-5am ET',
            // Days
            day_monday: 'Signal detected on Monday',
            day_tuesday: 'Signal detected on Tuesday',
            day_wednesday: 'Signal detected on Wednesday',
            day_thursday: 'Signal detected on Thursday',
            day_friday: 'Signal detected on Friday',
            day_saturday: 'Signal detected on Saturday',
            day_sunday: 'Signal detected on Sunday',
          }
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
      
      // ============================================================
      // NEW: Factor Combo Tracking Endpoint
      // ============================================================
      if (path === "/learning/combos") {
        const combos = await getFactorCombos(env);
        return jsonResponse({ 
          success: true, 
          ...combos,
          message: combos.bestCombos.length > 0 
            ? `Found ${combos.bestCombos.length} strong combos, ${combos.worstCombos.length} weak combos`
            : 'Need more settled signals to identify combos'
        });
      }
      
      // ============================================================
      // NEW: Alert Check Endpoint (for Twilio integration)
      // ============================================================
      if (path === "/alerts/check") {
        const alerts = [];
        
        // Get recent signals
        const recentSignals = await getRecentSignals(env, 50);
        const factorStats = await getFactorStats(env);
        
        for (const signal of recentSignals) {
          const alertReasons = [];
          let priority = 'LOW';
          
          // Check 1: Elite wallet betting
          if (signal.hasWinningWallet && signal.largestBet >= 25000) {
            alertReasons.push(`🏆 Elite wallet bet $${signal.largestBet.toLocaleString()}`);
            priority = 'HIGH';
          }
          
          // Check 2: High-performing factor combo
          const factors = signal.scoreBreakdown?.map(f => f.factor) || [];
          const hasVolumeHuge = factors.includes('volumeHuge');
          const hasFreshWhale = factors.includes('freshWhale5k');
          
          if (hasVolumeHuge && hasFreshWhale) {
            alertReasons.push('🔥 High-prob combo: volumeHuge + freshWhale5k');
            priority = 'CRITICAL';
          } else if (hasVolumeHuge) {
            alertReasons.push('📈 volumeHuge factor (88% historical WR)');
            if (priority === 'LOW') priority = 'MEDIUM';
          }
          
          // Check 3: AI score is very high
          if (signal.aiScore && signal.aiScore >= 80) {
            alertReasons.push(`🤖 High AI Score: ${signal.aiScore}`);
            if (priority === 'LOW') priority = 'MEDIUM';
          }
          
          // Only create alert if we have reasons
          if (alertReasons.length > 0) {
            alerts.push({
              id: signal.id,
              type: priority === 'CRITICAL' ? 'HIGH_PROBABILITY_COMBO' : 
                    priority === 'HIGH' ? 'ELITE_WALLET_BET' : 'NOTABLE_SIGNAL',
              priority,
              market: signal.marketTitle,
              direction: signal.direction,
              price: signal.displayPrice,
              amount: signal.largestBet,
              reasons: alertReasons,
              aiScore: signal.aiScore,
              confidence: signal.confidence,
              timestamp: signal.firstTradeTime
            });
          }
        }
        
        // Sort by priority
        const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        
        return jsonResponse({
          success: true,
          alerts: alerts.slice(0, 20),  // Top 20 alerts
          totalAlerts: alerts.length,
          criticalCount: alerts.filter(a => a.priority === 'CRITICAL').length,
          highCount: alerts.filter(a => a.priority === 'HIGH').length
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
      
      // ============ DEBUG ENDPOINTS ============
      
      // Debug: Show raw trades from API (no filtering)
      if (path === "/debug/raw-trades") {
        const limit = parseInt(url.searchParams.get("limit") || "100");
        try {
          const tradesRes = await fetch(`${POLYMARKET_API}/trades?limit=${limit}`);
          if (!tradesRes.ok) {
            return jsonResponse({ error: `API returned ${tradesRes.status}` }, 500);
          }
          const trades = await tradesRes.json();
          
          // Find large bets
          const largeBets = trades.filter(t => {
            const usdValue = parseFloat(t.usd_value) || parseFloat(t.usdcSize) || parseFloat(t.size) || 0;
            return usdValue >= 10000;
          }).map(t => ({
            title: t.title || t.market,
            amount: parseFloat(t.usd_value) || parseFloat(t.usdcSize) || parseFloat(t.size) || 0,
            wallet: t.proxyWallet,
            outcome: t.outcome,
            price: t.price,
            timestamp: t.timestamp,
            timeAgo: Math.round((Date.now() / 1000 - t.timestamp) / 60) + ' mins ago'
          }));
          
          return jsonResponse({
            success: true,
            totalTrades: trades.length,
            largeBets: largeBets,
            largeBetCount: largeBets.length,
            oldestTradeAge: trades.length > 0 ? Math.round((Date.now() / 1000 - trades[trades.length - 1].timestamp) / 60) + ' mins' : null,
            newestTradeAge: trades.length > 0 ? Math.round((Date.now() / 1000 - trades[0].timestamp) / 60) + ' mins' : null,
            sampleTrade: trades[0] ? {
              title: trades[0].title,
              amount: parseFloat(trades[0].usd_value) || parseFloat(trades[0].usdcSize) || parseFloat(trades[0].size),
              timestamp: trades[0].timestamp,
              allFields: Object.keys(trades[0])
            } : null
          });
        } catch (e) {
          return jsonResponse({ error: e.message }, 500);
        }
      }
      
      // Debug: Show accumulated trades from KV
      if (path === "/debug/kv-trades") {
        const hours = parseInt(url.searchParams.get("hours") || "24");
        const minAmount = parseInt(url.searchParams.get("minAmount") || "10000");
        
        try {
          const { trades, fromKV, bucketsRead, totalTrades } = await getAccumulatedTrades(env, hours);
          
          const largeBets = trades.filter(t => {
            const usdValue = parseFloat(t.size) || 0;
            return usdValue >= minAmount;
          }).map(t => ({
            title: t.title,
            slug: t.slug,
            amount: parseFloat(t.size) || 0,
            wallet: t.proxyWallet,
            outcome: t.outcome,
            price: t.price,
            timestamp: t.timestamp,
            timeAgo: Math.round((Date.now() / 1000 - t.timestamp) / 60) + ' mins ago'
          })).sort((a, b) => b.amount - a.amount);
          
          return jsonResponse({
            success: true,
            fromKV,
            bucketsRead,
            totalTrades,
            largeBets: largeBets.slice(0, 50),
            largeBetCount: largeBets.length,
            largestBet: largeBets[0] || null
          });
        } catch (e) {
          return jsonResponse({ error: e.message }, 500);
        }
      }
      
      // Debug: Show what the scan would filter
      if (path === "/debug/scan-filters") {
        const hours = parseInt(url.searchParams.get("hours") || "48");
        
        try {
          const tradesRes = await fetch(`${POLYMARKET_API}/trades?limit=2000`);
          const trades = await tradesRes.json();
          
          const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
          
          const stats = {
            total: trades.length,
            passed: 0,
            filtered: {
              noTitle: 0,
              gambling: 0,
              tooOld: 0,
              badPrice: 0,
              tooSmall: 0,
              noSlug: 0
            },
            largeBetsFiltered: [],
            largeBetsPassed: []
          };
          
          const GAMBLING_KEYWORDS = ['up or down', '15m', '30m', '1h', '5m'];
          
          for (const t of trades) {
            const usdValue = parseFloat(t.usd_value) || parseFloat(t.usdcSize) || parseFloat(t.size) || 0;
            const isLarge = usdValue >= 25000;
            
            const marketTitle = t.title || t.market || '';
            if (!marketTitle) { 
              stats.filtered.noTitle++; 
              if (isLarge) stats.largeBetsFiltered.push({ reason: 'noTitle', amount: usdValue, title: marketTitle });
              continue; 
            }
            
            const isGambling = GAMBLING_KEYWORDS.some(kw => marketTitle.toLowerCase().includes(kw));
            if (isGambling) { 
              stats.filtered.gambling++; 
              if (isLarge) stats.largeBetsFiltered.push({ reason: 'gambling', amount: usdValue, title: marketTitle });
              continue; 
            }
            
            let tradeTime = t.timestamp * 1000;
            if (tradeTime < cutoffTime) { 
              stats.filtered.tooOld++; 
              if (isLarge) stats.largeBetsFiltered.push({ reason: 'tooOld', amount: usdValue, title: marketTitle, age: Math.round((Date.now() - tradeTime) / 3600000) + 'h' });
              continue; 
            }
            
            const price = parseFloat(t.price) || 0;
            if (price >= 0.95 || price <= 0.05) { 
              stats.filtered.badPrice++; 
              if (isLarge) stats.largeBetsFiltered.push({ reason: 'badPrice', amount: usdValue, title: marketTitle, price });
              continue; 
            }
            
            if (usdValue < 10) { 
              stats.filtered.tooSmall++; 
              continue; 
            }
            
            const slug = t.slug || t.eventSlug || '';
            if (!slug && !marketTitle) { 
              stats.filtered.noSlug++; 
              if (isLarge) stats.largeBetsFiltered.push({ reason: 'noSlug', amount: usdValue, title: marketTitle });
              continue; 
            }
            
            stats.passed++;
            if (isLarge) {
              stats.largeBetsPassed.push({ amount: usdValue, title: marketTitle, wallet: t.proxyWallet?.slice(0, 10) + '...' });
            }
          }
          
          return jsonResponse({
            success: true,
            ...stats,
            summary: `${stats.passed}/${stats.total} trades passed filters. ${stats.largeBetsPassed.length} large bets ($25k+) passed, ${stats.largeBetsFiltered.length} filtered out.`
          });
        } catch (e) {
          return jsonResponse({ error: e.message }, 500);
        }
      }
      
      // Debug: Check poll status and trade accumulation health
      if (path === "/debug/poll-health") {
        const pollStats = await getPollStats(env);
        const cronStats = env.SIGNALS_CACHE ? await env.SIGNALS_CACHE.get('cron_stats', { type: 'json' }) : null;
        const lastCronRun = env.SIGNALS_CACHE ? await env.SIGNALS_CACHE.get('last_cron_run') : null;
        
        return jsonResponse({
          success: true,
          pollStats,
          cronStats,
          lastCronRun,
          minutesSinceCron: lastCronRun ? Math.round((Date.now() - new Date(lastCronRun).getTime()) / 60000) : null,
          diagnosis: {
            cronRunning: lastCronRun && (Date.now() - new Date(lastCronRun).getTime()) < 5 * 60 * 1000,
            tradesAccumulating: pollStats?.tradesStored > 0,
            bucketsHealthy: pollStats?.activeBuckets > 0
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
