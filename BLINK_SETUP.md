# Blink Lightning Integration Setup

## Overview
Satsflow uses **Blink** (formerly Bitcoin Beach Wallet) for Lightning Network payments. This allows users to earn satoshis for health tracking and withdraw to any Lightning wallet.

## Architecture: Pooled Wallet Approach

```
┌─────────────────┐
│  Your Blink     │  ← One wallet holds all sats
│  Pooled Wallet  │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Satsflow│
    │ Backend │  ← Tracks individual user balances in DB
    └────┬────┘
         │
    ┌────┴────────────────┐
    │  User Balances      │
    │  Alice: 150 sats    │
    │  Bob:   320 sats    │
    │  Carol: 75 sats     │
    └─────────────────────┘
```

**How it works:**
1. User earns reward → Balance updated in YOUR database
2. User withdraws → Sats sent from YOUR Blink wallet to their Lightning address
3. You maintain one Blink wallet, track user balances internally

## Setup Steps

### 1. Create Blink Account

1. Download Blink app: https://www.blink.sv/
2. Create account (no KYC for small amounts)
3. Fund your wallet with initial sats (e.g., 100,000 sats = ~$30)

### 2. Get API Credentials

1. Go to https://dashboard.blink.sv/
2. Navigate to **API Keys**
3. Create new API key with permissions:
   - ✅ Read balance
   - ✅ Send payments
4. Copy your:
   - `API Key`
   - `Wallet ID`

### 3. Add to Environment Variables

Edit `.env`:

```env
# Blink Lightning Integration
BLINK_API_KEY=your_api_key_here
BLINK_WALLET_ID=your_wallet_id_here
BLINK_API_URL=https://api.blink.sv/graphql
```

### 4. Test the Integration

```bash
# Start server
npm run dev

# Test wallet endpoint
curl -X GET http://localhost:3000/api/v1/wallets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test withdrawal
curl -X POST http://localhost:3000/api/v1/wallets/withdraw \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amountSats": 50,
    "destination": "user@getalby.com",
    "type": "address"
  }'
```

## API Endpoints

### Get Wallet Balance
```
GET /api/v1/wallets
Response: { wallet: { balanceSats: 150 }, stats: { totalEarned: 200 } }
```

### Withdraw Sats
```
POST /api/v1/wallets/withdraw
Body: {
  "amountSats": 100,
  "destination": "user@getalby.com",  // Lightning address
  "type": "address"                    // or "invoice"
}
```

### Get Reward History
```
GET /api/v1/wallets/rewards?page=1&limit=20
```

## Reward Triggers

Rewards are automatically given when users:
- Log daily health data: **10 sats**
- Complete a full cycle: **50 sats**
- 7-day streak: **25 sats**
- 30-day streak: **100 sats**
- First forum post: **20 sats**

## Cost Estimation

**Monthly costs** (assuming 1,000 active users):
- Average user earns: ~200 sats/month
- Total payout: 200,000 sats (~$60/month)
- Blink fees: **FREE** for small transactions
- Lightning network fees: ~1-2 sats per withdrawal

**Initial funding**: Start with 100,000 sats (~$30) and top up as needed.

## Alternative: Individual Wallets

If you want each user to have their own Blink wallet:

1. Use Blink's account creation API
2. Store user's Blink wallet ID in database
3. Send rewards directly to their Blink wallet
4. Users manage their own keys

**Trade-offs:**
- ✅ True self-custody
- ✅ Users can access via Blink app
- ❌ More complex (need to manage API keys per user)
- ❌ More API calls

## Security Notes

- ✅ Keep `BLINK_API_KEY` secret (never commit to git)
- ✅ Set withdrawal limits in Blink dashboard
- ✅ Monitor your pooled wallet balance
- ✅ Set up alerts for low balance
- ✅ Rate limit withdrawal endpoints (already done)

## Monitoring

Check your Blink wallet balance:
```javascript
const blinkService = require('./services/blink.service');
const balance = await blinkService.getBalance();
console.log(`Pooled wallet balance: ${balance} sats`);
```

## Troubleshooting

**Error: "Insufficient balance"**
- Top up your Blink wallet

**Error: "Invalid Lightning address"**
- Format must be: `username@domain.com`
- Test with: `test@blink.sv`

**Error: "Payment failed"**
- Check recipient's Lightning address is active
- Ensure your wallet has enough balance
- Check Blink API status

## Next Steps

1. ✅ Set up Blink account
2. ✅ Add API keys to `.env`
3. ✅ Test with small amounts
4. ⏳ Integrate reward triggers (see below)
5. ⏳ Add withdrawal UI in mobile app
6. ⏳ Monitor and top up wallet regularly

## Integrating Rewards into Existing Code

Add to `cycle.service.js` after logging:
```javascript
const rewardService = require('./reward.service');
await rewardService.rewardDailyLog(userId);
```

Add to `cycle.service.js` after ending period:
```javascript
await rewardService.rewardCompleteCycle(userId);
```
