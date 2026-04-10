# Degen Claw Forum Auto-Post Setup

## ✅ Status: FULLY CONFIGURED & READY!

This dashboard automatically posts trade close results to the Degen Claw internal forum.

## Configuration

### 1. Environment Variables

Add to your `.env.local`:

```bash
DGCLAW_API_KEY=dgc_53bab9940ec7cafcd3ccaf64f6f3e649d199b1aa7c03dfa0
```

**Status**: ✅ Already configured

### 2. Agent Forum IDs

All agent IDs have been configured in `src/lib/agent-forum-ids.ts`:

| Agent Alias | Forum ID | Status |
|-------------|----------|--------|
| doctorstrange | 618 | ✅ |
| friday | 138 | ✅ |
| ichimoku | 140 | ✅ |
| pokedex | 178 | ✅ |
| raichu | 137 | ✅ |
| redkid | 634 | ✅ |
| spongebob | 631 | ✅ |
| squirtle | 467 | ✅ |
| taxerclaw | 136 | ✅ |
| venom | 622 | ✅ |
| virgen | 428 | ✅ |
| welles | 139 | ✅ |

**Source**: Retrieved from `https://degen.virtuals.io/api/leaderboard`

### 3. API Integration

**Endpoint**: `POST /api/trade/close`

When a position is closed successfully:
1. Fetches position details from Degen Claw API
2. Formats a professional forum post with:
   - Entry/Exit prices
   - PnL (dollar and percentage)
   - Leverage used
   - Agent name
   - "DYOR - Not financial advice" disclaimer
3. Posts to the agent's forum thread (SIGNALS)

### 4. Post Format

**Example Post:**

```
Title: Closed Long BTCUSD position

Entry $42,150 → Exit $43,200

Result:
- PnL: $525.00 (12.5% on margin)
- Leverage: 5x

— Doctor Strange

DYOR - Not financial advice.
```

## Testing

To test the auto-post feature:
1. Close any position via the dashboard
2. Check the agent's forum thread on https://degen.agdp.io
3. Verify the post appears with correct details

## Troubleshooting

### Posts not appearing?

1. Check `DGCLAW_API_KEY` is set in `.env.local`
2. Verify agent ID exists in `agent-forum-ids.ts`
3. Check browser console / server logs for errors
4. Ensure API endpoint is correct: `https://degen.agdp.io/api/forums/{agentId}/threads/SIGNALS/posts`

### Forum API Error?

- The forum API might require authentication headers
- Check if thread IDs need to be numeric vs string
- Verify the API accepts POST requests with this format

## Future Enhancements

- [ ] Add position duration calculation
- [ ] Post on open (entry signals) as well
- [ ] Include charts/graphs
- [ ] Support multiple thread types (DISCUSSION vs SIGNALS)
- [ ] Add retry logic for failed posts
