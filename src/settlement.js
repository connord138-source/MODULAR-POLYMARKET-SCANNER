// ============================================================
// SETTLEMENT.JS - Bet Settlement Logic
// ============================================================

import { POLYMARKET_API, KV_KEYS, SPORT_KEY_MAP } from './config.js';
import { detectSportFromSlug, extractTeamsFromSlug, getTeamFullName } from './utils.js';
import { getGameScores, findMatchingGame } from './odds-api.js';
import { recordWalletOutcome } from './wallets.js';
import { updateFactorStats, trackSignalMetadata } from './learning.js';

// Check market settlement via Polymarket trades
export async function checkMarketSettlement(marketSlug, signalDetectedAt) {
  try {
    const tradesRes = await fetch(`${POLYMARKET_API}/trades?limit=2000`);
    if (!tradesRes.ok) {
      console.log(`Trades API error: ${tradesRes.status}`);
      return null;
    }
    
    const trades = await tradesRes.json();
    
    // Find trades for this market
    let marketTrades = trades.filter(t => 
      t.slug === marketSlug || 
      t.eventSlug === marketSlug
    );
    
    // Try base slug for spread/total markets
    if (marketTrades.length === 0 && (marketSlug.includes('-spread') || marketSlug.includes('-total'))) {
      const baseSlug = marketSlug.replace(/-spread.*$/, '').replace(/-total.*$/, '');
      marketTrades = trades.filter(t => 
        t.slug === baseSlug || t.eventSlug === baseSlug
      );
    }
    
    // Check event date
    const slugDateMatch = (marketSlug || '').match(/(\d{4})-(\d{2})-(\d{2})/);
    let hoursSinceEvent = 0;
    
    if (slugDateMatch) {
      const eventDate = new Date(
        parseInt(slugDateMatch[1]),
        parseInt(slugDateMatch[2]) - 1,
        parseInt(slugDateMatch[3]),
        23, 59, 59
      );
      hoursSinceEvent = (Date.now() - eventDate.getTime()) / (1000 * 60 * 60);
    } else if (signalDetectedAt) {
      const detectedTime = new Date(signalDetectedAt).getTime();
      hoursSinceEvent = (Date.now() - detectedTime) / (1000 * 60 * 60);
    }
    
    if (marketTrades.length === 0) {
      if (hoursSinceEvent > 12) {
        return { 
          settled: true, 
          winningOutcome: "UNKNOWN", 
          resolutionPrice: 0,
          note: `Event ${Math.round(hoursSinceEvent)}h ago, no recent trades`
        };
      }
      return { settled: false };
    }
    
    // Get latest trade
    marketTrades.sort((a, b) => b.timestamp - a.timestamp);
    const latestTrade = marketTrades[0];
    const latestPrice = parseFloat(latestTrade.price);
    
    // Check settlement thresholds
    if (latestPrice >= 0.95) {
      return {
        settled: true,
        winningOutcome: latestTrade.outcome || "Yes",
        resolutionPrice: latestPrice
      };
    }
    
    if (latestPrice <= 0.05) {
      let winningOutcome = "No";
      if (latestTrade.outcome === "No") winningOutcome = "Yes";
      else if (latestTrade.outcome === "Yes") winningOutcome = "No";
      
      return {
        settled: true,
        winningOutcome,
        resolutionPrice: 1 - latestPrice
      };
    }
    
    if (hoursSinceEvent > 24) {
      return { 
        settled: true, 
        winningOutcome: "UNKNOWN", 
        resolutionPrice: latestPrice,
        note: `Event ${Math.round(hoursSinceEvent)}h ago, ambiguous price`
      };
    }
    
    return { settled: false, currentPrice: latestPrice };
    
  } catch (e) {
    console.error(`Error checking settlement for ${marketSlug}:`, e.message);
    return null;
  }
}

// Settle sports bet using The Odds API
export async function settleWithOddsAPI(env, marketSlug, direction) {
  const sport = detectSportFromSlug(marketSlug);
  if (!sport) return null;
  
  const sportKey = SPORT_KEY_MAP[sport];
  if (!sportKey) return null;
  
  const teams = extractTeamsFromSlug(marketSlug);
  if (!teams) return null;
  
  const scores = await getGameScores(env, sportKey, 3);
  if (!scores) return null;
  
  const game = findMatchingGame(scores, teams.home, teams.away);
  if (!game) {
    console.log(`No matching game found for ${marketSlug}`);
    return null;
  }
  
  if (!game.completed) {
    return { status: 'pending', game };
  }
  
  if (!game.scores || game.scores.length < 2) {
    return { status: 'no_scores', game };
  }
  
  const homeScore = parseInt(game.scores.find(s => s.name === game.home_team)?.score || 0);
  const awayScore = parseInt(game.scores.find(s => s.name === game.away_team)?.score || 0);
  
  // Determine winner
  let winner;
  if (homeScore > awayScore) winner = game.home_team;
  else if (awayScore > homeScore) winner = game.away_team;
  else winner = 'tie';
  
  // Handle spread bets
  const isSpread = marketSlug.includes('spread');
  if (isSpread) {
    const spreadMatch = marketSlug.match(/spread-(home|away)-(\d+)pt?(\d)?/i);
    if (spreadMatch) {
      const spreadSide = spreadMatch[1].toLowerCase();
      const spreadPoints = parseFloat(`${spreadMatch[2]}.${spreadMatch[3] || '5'}`);
      
      let spreadWinner;
      if (spreadSide === 'away') {
        spreadWinner = (awayScore + spreadPoints) > homeScore ? game.away_team : game.home_team;
      } else {
        spreadWinner = (homeScore - awayScore) > spreadPoints ? game.home_team : game.away_team;
      }
      
      const dirTeam = getTeamFullName(direction);
      const didWin = spreadWinner.toLowerCase().includes(dirTeam.toLowerCase()) ||
                     dirTeam.toLowerCase().includes(spreadWinner.toLowerCase());
      
      return {
        status: 'settled',
        outcome: didWin ? 'WIN' : 'LOSS',
        game,
        homeScore,
        awayScore,
        spread: spreadPoints,
        spreadWinner,
        source: 'odds-api'
      };
    }
  }
  
  // Moneyline bet
  const dirTeam = getTeamFullName(direction);
  const didWin = winner.toLowerCase().includes(dirTeam.toLowerCase()) ||
                 dirTeam.toLowerCase().includes(winner.toLowerCase());
  
  return {
    status: 'settled',
    outcome: didWin ? 'WIN' : 'LOSS',
    game,
    homeScore,
    awayScore,
    winner,
    source: 'odds-api'
  };
}

// Process settled signals
export async function processSettledSignals(env) {
  if (!env.SIGNALS_CACHE) return { processed: 0, wins: 0, losses: 0 };
  
  const results = { processed: 0, wins: 0, losses: 0, errors: 0 };
  
  try {
    let pendingSignals = await env.SIGNALS_CACHE.get(KV_KEYS.PENDING_SIGNALS, { type: "json" }) || [];
    const stillPending = [];
    
    console.log(`Checking ${pendingSignals.length} pending signals...`);
    
    for (const signalId of pendingSignals) {
      try {
        const signalKey = KV_KEYS.SIGNALS_PREFIX + signalId;
        const signalData = await env.SIGNALS_CACHE.get(signalKey, { type: "json" });
        
        if (!signalData || signalData.outcome) {
          continue;
        }
        
        // Try Odds API first for sports
        const sport = detectSportFromSlug(signalData.marketSlug);
        
        if (sport && SPORT_KEY_MAP[sport] && env.ODDS_API_KEY) {
          const oddsApiResult = await settleWithOddsAPI(env, signalData.marketSlug, signalData.direction);
          
          if (oddsApiResult?.status === 'settled') {
            const outcome = oddsApiResult.outcome;
            const profitPct = outcome === "WIN" 
              ? Math.round(((1 - (signalData.priceAtSignal / 100)) / (signalData.priceAtSignal / 100)) * 100)
              : -100;
            
            signalData.outcome = outcome;
            signalData.settledAt = new Date().toISOString();
            signalData.profitLoss = profitPct;
            signalData.gameScore = `${oddsApiResult.homeScore}-${oddsApiResult.awayScore}`;
            signalData.settledBy = 'odds-api';
            
            await env.SIGNALS_CACHE.put(signalKey, JSON.stringify(signalData), {
              expirationTtl: 30 * 24 * 60 * 60
            });
            
            // Update wallet stats
            for (const wallet of (signalData.wallets || [])) {
              await recordWalletOutcome(env, wallet, outcome, profitPct, signalData.marketType, signalData.largestBet, signalId);
            }
            
            // Update factor stats for AI learning
            if (signalData.factors && signalData.factors.length > 0) {
              await updateFactorStats(env, signalData.factors, outcome);
            }
            
            // Track signal metadata for pattern discovery
            await trackSignalMetadata(env, signalData, outcome);
            
            results.processed++;
            if (outcome === "WIN") results.wins++;
            else results.losses++;
            
            continue;
          } else if (oddsApiResult?.status === 'pending') {
            stillPending.push(signalId);
            continue;
          }
        }
        
        // Fall back to Polymarket settlement
        const settlement = await checkMarketSettlement(signalData.marketSlug, signalData.detectedAt);
        
        if (!settlement || !settlement.settled) {
          stillPending.push(signalId);
          continue;
        }
        
        // Handle UNKNOWN
        if (settlement.winningOutcome === "UNKNOWN") {
          signalData.outcome = "UNKNOWN";
          signalData.settledAt = new Date().toISOString();
          await env.SIGNALS_CACHE.put(signalKey, JSON.stringify(signalData), {
            expirationTtl: 7 * 24 * 60 * 60
          });
          results.processed++;
          continue;
        }
        
        // Determine win/loss
        const signalDirection = (signalData.direction || "").toLowerCase();
        const winningOutcome = (settlement.winningOutcome || "").toLowerCase();
        
        let outcome = "LOSS";
        if (signalDirection === winningOutcome) outcome = "WIN";
        else if (signalDirection === "yes" && winningOutcome === "yes") outcome = "WIN";
        else if (signalDirection === "no" && winningOutcome === "no") outcome = "WIN";
        
        const entryPrice = signalData.priceAtSignal / 100;
        const profitPct = outcome === "WIN" 
          ? Math.round(((1 - entryPrice) / entryPrice) * 100)
          : -100;
        
        signalData.outcome = outcome;
        signalData.settledAt = new Date().toISOString();
        signalData.profitLoss = profitPct;
        signalData.settledBy = 'polymarket';
        
        await env.SIGNALS_CACHE.put(signalKey, JSON.stringify(signalData), {
          expirationTtl: 30 * 24 * 60 * 60
        });
        
        // Update wallet stats
        for (const wallet of (signalData.wallets || [])) {
          await recordWalletOutcome(env, wallet, outcome, profitPct, signalData.marketType, signalData.largestBet, signalId);
        }
        
        // Update factor stats for AI learning
        if (signalData.factors && signalData.factors.length > 0) {
          await updateFactorStats(env, signalData.factors, outcome);
        }
        
        // Track signal metadata for pattern discovery
        await trackSignalMetadata(env, signalData, outcome);
        
        results.processed++;
        if (outcome === "WIN") results.wins++;
        else results.losses++;
        
      } catch (e) {
        results.errors++;
        stillPending.push(signalId);
      }
    }
    
    // Update pending list
    await env.SIGNALS_CACHE.put(KV_KEYS.PENDING_SIGNALS, JSON.stringify(stillPending), {
      expirationTtl: 30 * 24 * 60 * 60
    });
    
    return results;
    
  } catch (e) {
    console.error("Error processing settlements:", e.message);
    return results;
  }
}