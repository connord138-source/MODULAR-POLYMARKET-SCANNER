# EdgeRunner Scanner Backend v18.11.0

## 🤖 Smart Filtering: AI-Powered Signal Scoring

This version adds **intelligent signal filtering** based on historical factor performance.

---

## What's New in v18.11.0

### 1. AI-Adjusted Signal Scoring

Signals now have an `aiScore` that adjusts the raw score based on factor performance:

```javascript
// Example signal response
{
  "score": 65,           // Raw score
  "aiScore": 85,         // AI-adjusted score (boosted by volumeHuge)
  "aiMultiplier": 1.3,   // The multiplier applied
  "confidence": 72
}
```

**How it works:**
- Factors with 70%+ historical WR get 1.3x boost
- Factors with 55%+ WR get 1.1x boost  
- Factors with ≤25% WR get 0.6x penalty
- Factors with ≤15% WR get 0.4x penalty

### 2. Auto-Hide Bad Signals

Signals dominated by terrible factors (like `sports-mma` at 0% WR) are automatically hidden.

**Exception:** Signals with winning wallets are NEVER hidden.

### 3. Factor Combo Tracking

New tracking for which factor COMBINATIONS perform best:

```
GET /learning/combos
```

### 4. Alert Check Endpoint (Twilio Ready)

```
GET /alerts/check
```

---

## Deployment

```bash
cd v18.11.0-smart-filtering
wrangler deploy
```
