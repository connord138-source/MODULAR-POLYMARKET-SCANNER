// ============================================================
// EDGE-DETECTOR.JS - Multi-Source Edge Detection Engine
// v1.0.0 - Combines Polymarket, Betting Splits, Sharp Lines
// ============================================================

// This module combines multiple data sources to generate "Edge Scores"
// for each game, identifying the best betting opportunities

import { getBettingSplits, analyzeSharpMoney, detectReverseLineMovement } from './betting-splits.js';
import { getSharpLineComparison, detectSteamMove, getLineMovement } from './sharp-lines.js';
import { getOddsComparison } from './odds-api.js';

// Edge score weights
const EDGE_WEIGHTS = {
  // Sharp money signals (from betting splits)
  SHARP_MONEY_STRONG: 30,
  SHARP_MONEY_MODERATE: 15,
  
  // Reverse line movement
  RLM_STRONG: 25,
  RLM_MODERATE: 12,
  
  // Pinnacle vs soft book divergence
  PINNACLE_EDGE_LARGE: 20,  // 5%+ edge
  PINNACLE_EDGE_MEDIUM: 10, // 3-5% edge
  PINNACLE_EDGE_SMALL: 5,   // 2-3% edge
  
  // Steam moves
  STEAM_MOVE: 35,
  RAPID_LINE_MOVE: 15,
  
  // Polymarket divergence from Vegas
  POLY_EDGE_HUGE: 25,       // 10%+ difference
  POLY_EDGE_LARGE: 15,      // 5-10% difference
  POLY_EDGE_MEDIUM: 8,      // 3-5% difference
  
  // Multiple signal confirmation
  MULTI_SIGNAL_BONUS: 20,   // When 3+ signals agree
  DUAL_SIGNAL_BONUS: 10,    // When 2 signals agree
};

// Confidence thresholds
const CONFIDENCE_LEVELS = {
  HIGH: 70,      // Strong recommendation
  MEDIUM: 50,    // Worth considering
  LOW: 30,       // Monitor
  NOISE: 0       // Below threshold
};

// ============================================================
// MAIN: Run Full Edge Detection
// ============================================================

/**
 * Run comprehensive edge detection for a sport
 * Combines all data sources and generates edge scores
 */
export async function runEdgeDetection(env, sport) {
  const startTime = Date.now();
  
  try {
    console.log(`Starting edge detection for ${sport}...`);
    
    // Fetch all data sources in parallel
    const [
      vegasPolyComparison,
      sharpLines,
      bettingSplits
    ] = await Promise.all([
      getOddsComparison(env, sport).catch(e => ({ success: false, error: e.message })),
      getSharpLineComparison(env, sport).catch(e => ({ success: false, error: e.message })),
      getBettingSplits(env, sport).catch(e => ({ success: false, error: e.message }))
    ]);
    
    console.log(`Data fetched: Vegas/Poly=${vegasPolyComparison.success}, Sharp=${sharpLines.success}, Splits=${bettingSplits.success}`);
    
    // Build unified game list
    const games = buildUnifiedGameList(
      vegasPolyComparison.games || [],
      sharpLines.games || [],
      bettingSplits.games || []
    );
    
    // Analyze sharp money in betting splits
    const sharpMoneyGames = bettingSplits.success 
      ? analyzeSharpMoney(bettingSplits.games || [])
      : [];
    
    // Calculate edge scores for each game
    const edgeGames = games.map(game => 
      calculateEdgeScore(game, sharpMoneyGames, sharpLines.games || [])
    );
    
    // Sort by edge score (highest first)
    edgeGames.sort((a, b) => b.edgeScore - a.edgeScore);
    
    // Extract top opportunities
    const topEdges = edgeGames
      .filter(g => g.edgeScore >= CONFIDENCE_LEVELS.MEDIUM)
      .slice(0, 10);
    
    // Generate summary
    const summary = generateSummary(edgeGames, topEdges);
    
    return {
      success: true,
      sport,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      dataSources: {
        vegasPolymarket: vegasPolyComparison.success,
        sharpLines: sharpLines.success,
        bettingSplits: bettingSplits.success
      },
      summary,
      topEdges,
      allGames: edgeGames.map(g => ({
        ...g,
        // Remove verbose nested data for cleaner response
        sharpLinesDetail: undefined,
        bettingSplitsDetail: undefined
      }))
    };
    
  } catch (e) {
    console.error('Edge detection error:', e);
    return { 
      success: false, 
      error: e.message,
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Build unified game list from multiple sources
 */
function buildUnifiedGameList(vegasGames, sharpGames, splitsGames) {
  const gamesMap = new Map();
  
  // Add Vegas/Poly games as base
  for (const game of vegasGames) {
    const key = createGameKey(game.homeTeam, game.awayTeam);
    gamesMap.set(key, {
      ...game,
      sources: ['vegas', 'polymarket']
    });
  }
  
  // Merge sharp lines data
  for (const game of sharpGames) {
    const key = createGameKey(game.homeTeam, game.awayTeam);
    if (gamesMap.has(key)) {
      const existing = gamesMap.get(key);
      existing.sharpLinesDetail = game;
      existing.sources.push('sharp');
    } else {
      gamesMap.set(key, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        commenceTime: game.commenceTime,
        sharpLinesDetail: game,
        sources: ['sharp']
      });
    }
  }
  
  // Merge betting splits data
  for (const game of splitsGames) {
    const key = createGameKey(game.homeTeam, game.awayTeam);
    if (gamesMap.has(key)) {
      const existing = gamesMap.get(key);
      existing.bettingSplitsDetail = game;
      existing.sources.push('splits');
    } else {
      gamesMap.set(key, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        bettingSplitsDetail: game,
        sources: ['splits']
      });
    }
  }
  
  return Array.from(gamesMap.values());
}

/**
 * Create consistent game key for matching
 */
function createGameKey(home, away) {
  // Normalize team names for matching
  const normalize = (name) => name?.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(university|college|state|tech)/g, '')
    .trim() || '';
  
  return `${normalize(away)}-${normalize(home)}`;
}

/**
 * Calculate comprehensive edge score for a game
 */
function calculateEdgeScore(game, sharpMoneyGames, sharpLinesGames) {
  const signals = [];
  let totalScore = 0;
  let sharpSide = null;
  let confidence = 'low';
  
  // 1. Check Polymarket vs Vegas edge
  if (game.edge) {
    const homeEdge = game.edge.home || 0;
    const awayEdge = game.edge.away || 0;
    const maxPolyEdge = Math.max(Math.abs(homeEdge), Math.abs(awayEdge));
    
    if (maxPolyEdge >= 10) {
      totalScore += EDGE_WEIGHTS.POLY_EDGE_HUGE;
      signals.push({
        type: 'polymarket_divergence',
        strength: 'huge',
        edge: maxPolyEdge,
        side: homeEdge > awayEdge ? game.homeTeam : game.awayTeam
      });
      sharpSide = sharpSide || (homeEdge > awayEdge ? 'home' : 'away');
    } else if (maxPolyEdge >= 5) {
      totalScore += EDGE_WEIGHTS.POLY_EDGE_LARGE;
      signals.push({
        type: 'polymarket_divergence',
        strength: 'large',
        edge: maxPolyEdge,
        side: homeEdge > awayEdge ? game.homeTeam : game.awayTeam
      });
      sharpSide = sharpSide || (homeEdge > awayEdge ? 'home' : 'away');
    } else if (maxPolyEdge >= 3) {
      totalScore += EDGE_WEIGHTS.POLY_EDGE_MEDIUM;
      signals.push({
        type: 'polymarket_divergence',
        strength: 'medium',
        edge: maxPolyEdge
      });
    }
  }
  
  // 2. Check sharp money signals (from betting splits)
  const sharpGame = sharpMoneyGames.find(g => 
    createGameKey(g.homeTeam, g.awayTeam) === createGameKey(game.homeTeam, game.awayTeam)
  );
  
  if (sharpGame && sharpGame.sharpSignals) {
    for (const signal of sharpGame.sharpSignals) {
      if (signal.isStrong) {
        totalScore += EDGE_WEIGHTS.SHARP_MONEY_STRONG;
        signals.push({
          type: 'sharp_money',
          strength: 'strong',
          market: signal.type,
          sharpSide: signal.sharpSide,
          divergence: signal.sharpStrength
        });
        sharpSide = sharpSide || (signal.sharpSide === game.homeTeam ? 'home' : 'away');
      } else {
        totalScore += EDGE_WEIGHTS.SHARP_MONEY_MODERATE;
        signals.push({
          type: 'sharp_money',
          strength: 'moderate',
          market: signal.type,
          sharpSide: signal.sharpSide,
          divergence: signal.sharpStrength
        });
      }
    }
  }
  
  // 3. Check Pinnacle vs soft book edges
  if (game.sharpLinesDetail && game.sharpLinesDetail.edges) {
    const pinnacleEdges = game.sharpLinesDetail.edges;
    const maxPinEdge = Math.max(...pinnacleEdges.map(e => Math.abs(e.edge)), 0);
    
    if (maxPinEdge >= 5) {
      totalScore += EDGE_WEIGHTS.PINNACLE_EDGE_LARGE;
      const bestEdge = pinnacleEdges.find(e => Math.abs(e.edge) === maxPinEdge);
      signals.push({
        type: 'pinnacle_divergence',
        strength: 'large',
        edge: maxPinEdge,
        market: bestEdge?.market,
        outcome: bestEdge?.outcome,
        book: bestEdge?.book
      });
    } else if (maxPinEdge >= 3) {
      totalScore += EDGE_WEIGHTS.PINNACLE_EDGE_MEDIUM;
      signals.push({
        type: 'pinnacle_divergence',
        strength: 'medium',
        edge: maxPinEdge
      });
    } else if (maxPinEdge >= 2) {
      totalScore += EDGE_WEIGHTS.PINNACLE_EDGE_SMALL;
      signals.push({
        type: 'pinnacle_divergence',
        strength: 'small',
        edge: maxPinEdge
      });
    }
  }
  
  // 4. Check for signal agreement (multiple sources pointing same direction)
  const uniqueSignalTypes = new Set(signals.map(s => s.type));
  if (uniqueSignalTypes.size >= 3) {
    totalScore += EDGE_WEIGHTS.MULTI_SIGNAL_BONUS;
    signals.push({
      type: 'confirmation',
      strength: 'triple',
      description: '3+ independent signals agree'
    });
    confidence = 'high';
  } else if (uniqueSignalTypes.size >= 2) {
    totalScore += EDGE_WEIGHTS.DUAL_SIGNAL_BONUS;
    signals.push({
      type: 'confirmation',
      strength: 'dual',
      description: '2 independent signals agree'
    });
    confidence = 'medium';
  }
  
  // Determine confidence level
  if (totalScore >= CONFIDENCE_LEVELS.HIGH) {
    confidence = 'high';
  } else if (totalScore >= CONFIDENCE_LEVELS.MEDIUM) {
    confidence = 'medium';
  } else if (totalScore >= CONFIDENCE_LEVELS.LOW) {
    confidence = 'low';
  }
  
  // Generate recommendation
  const recommendation = generateRecommendation(game, signals, sharpSide, confidence);
  
  return {
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    commenceTime: game.commenceTime,
    edgeScore: Math.min(100, Math.round(totalScore)),
    confidence,
    signalCount: signals.length,
    signals,
    sharpSide,
    recommendation,
    vegas: game.vegas,
    polymarket: game.polymarket,
    edge: game.edge
  };
}

/**
 * Generate human-readable recommendation
 */
function generateRecommendation(game, signals, sharpSide, confidence) {
  if (signals.length === 0) {
    return {
      action: 'PASS',
      summary: 'No significant edges detected',
      details: null
    };
  }
  
  const sharpTeam = sharpSide === 'home' ? game.homeTeam : 
                    sharpSide === 'away' ? game.awayTeam : null;
  
  // Analyze signals
  const hasPolyEdge = signals.some(s => s.type === 'polymarket_divergence');
  const hasSharpMoney = signals.some(s => s.type === 'sharp_money');
  const hasPinnacleEdge = signals.some(s => s.type === 'pinnacle_divergence');
  const hasConfirmation = signals.some(s => s.type === 'confirmation');
  
  let action = 'MONITOR';
  let summary = '';
  const details = [];
  
  if (confidence === 'high') {
    action = 'STRONG';
    summary = `Strong edge on ${sharpTeam || 'undetermined side'}`;
  } else if (confidence === 'medium') {
    action = 'CONSIDER';
    summary = `Moderate edge detected`;
  } else {
    summary = 'Minor edge signals';
  }
  
  // Build detail strings
  if (hasPolyEdge) {
    const polySignal = signals.find(s => s.type === 'polymarket_divergence');
    details.push(`Polymarket ${polySignal.strength} divergence (${polySignal.edge}% vs Vegas)`);
  }
  
  if (hasSharpMoney) {
    const sharpSignal = signals.find(s => s.type === 'sharp_money');
    details.push(`Sharp money on ${sharpSignal.sharpSide} (${sharpSignal.divergence}% handle vs bets divergence)`);
  }
  
  if (hasPinnacleEdge) {
    const pinSignal = signals.find(s => s.type === 'pinnacle_divergence');
    details.push(`Pinnacle edge: ${pinSignal.edge}% vs soft books on ${pinSignal.market}`);
  }
  
  if (hasConfirmation) {
    const confSignal = signals.find(s => s.type === 'confirmation');
    details.push(confSignal.description);
  }
  
  return {
    action,
    summary,
    betSide: sharpTeam,
    details
  };
}

/**
 * Generate overall summary
 */
function generateSummary(allGames, topEdges) {
  return {
    totalGames: allGames.length,
    gamesWithEdge: allGames.filter(g => g.edgeScore >= CONFIDENCE_LEVELS.LOW).length,
    highConfidence: allGames.filter(g => g.confidence === 'high').length,
    mediumConfidence: allGames.filter(g => g.confidence === 'medium').length,
    topOpportunities: topEdges.map(g => ({
      game: `${g.awayTeam} @ ${g.homeTeam}`,
      score: g.edgeScore,
      confidence: g.confidence,
      recommendation: g.recommendation.summary
    }))
  };
}

// ============================================================
// QUICK EDGE CHECK (Lightweight version)
// ============================================================

/**
 * Quick edge check without full data fetch
 * Uses cached data when available
 */
export async function quickEdgeCheck(env, sport) {
  // Just check for cached edge data
  const cacheKey = `edge_detection_${sport}`;
  
  if (env.SIGNALS_CACHE) {
    try {
      const cached = await env.SIGNALS_CACHE.get(cacheKey, { type: 'json' });
      if (cached && cached.data) {
        const age = Date.now() - cached.timestamp;
        if (age < 10 * 60 * 1000) { // 10 minute cache
          return { ...cached.data, fromCache: true };
        }
      }
    } catch (e) {}
  }
  
  // Run full detection if no cache
  const result = await runEdgeDetection(env, sport);
  
  // Cache result
  if (env.SIGNALS_CACHE && result.success) {
    try {
      await env.SIGNALS_CACHE.put(cacheKey, JSON.stringify({
        data: result,
        timestamp: Date.now()
      }), { expirationTtl: 660 }); // 11 minutes
    } catch (e) {}
  }
  
  return result;
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  runEdgeDetection,
  quickEdgeCheck,
  EDGE_WEIGHTS,
  CONFIDENCE_LEVELS
};
