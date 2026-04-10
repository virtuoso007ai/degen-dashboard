# DegenClaw arena (skill özeti)

Ekrandaki “deploy → skill → register → compete” akışı ve `dgclaw.sh` ile bu repodaki `degen:*` script’lerin ilişkisi: **[DEGENCLAW_SKILL.md](./DEGENCLAW_SKILL.md)**.

---

# dgclaw subscribe (what we use)

Creates a buyer job for the **dgclaw-subscription** agent’s `subscribe` offering. No extra JSON files — subscriber is the **active agent’s wallet** from `config.json` (the same identity as `LITE_AGENT_API_KEY`).

```bash
npm run dgclaw:subscribe
```

Windows (from `virtuals-protocol-acp/`):

```bat
dgclaw-subscribe.cmd
```

Optional env:

- `ACP_SUBSCRIBER_WALLET` — override subscriber address (defaults to active agent).
- `FORUM_TOKEN_ADDRESS` — override the default forum token in `constants.ts`.

---

## Degen Claw scripts (optional)

**`join_leaderboard`:** RSA keypair (OpenSSL), put public PEM in `degen_join_requirements.json` or `JOIN_LEADERBOARD_PUBLIC_KEY`, run `npm run degen:join`; decrypt `encryptedApiKey` with `npm run degen:join:decrypt`. Full flow: [JOIN_LEADERBOARD.md](./JOIN_LEADERBOARD.md).

**`buy_agent_token`:** Degen’de **`amount` = token adedi** (başarılı job böyle). `npm run degen:buy:token -- <usdc> <token> [ticker]` ilk sayıyı token adedine çevirir (`amount ≈ usdc × BUY_TOKEN_PER_USDC`, varsayılan **10** ≈ önceki “10 token ≈ 1 USDC” gözlemi). Birebir adet: `--tokens`. `usdcAmount` kullanma — negotiation reddi görüldü.

Perp scripts (`post-perp-*.ts`) are below.

### ETH — TA sinyali → Degen `perp_trade` (MVP)

**Üretim (önerilen): 15m scalp** — `npm run degen:eth:signal` veya `npm run degen:eth:signal:scalp`. **15m** mum, **EMA 8/21**, **RSI 9**. Tekrar için `eth-signal-state.json` (gitignore).

**`SIGNAL_MODE`** (varsayılan **`multi`** — EMA veya RSI momentum veya MACD kesişiminden biri tetikler; aynı mumda long+short çakışırsa iptal):

| Mod | Açıklama |
| --- | --- |
| `multi` | EMA kesişimi **veya** RSI scalp dönüşü **veya** MACD/sinyal kesişimi |
| `ema` | Sadece EMA hızlı/yavaş (seyrek) |
| `rsi` | RSI aşırı bölge + mum içi dönüş (daha sık) |
| `macd` | MACD çizgisi / sinyal çizgisi kesişimi |

| Profil | Mum | EMA / RSI |
| --- | --- | --- |
| `scalp` (varsayılan) | 15m | 8 / 21, RSI 9 |
| `intraday` | 30m | 8 / 21, RSI 9 |
| `swing` | 1h | 12 / 26, RSI 14 |

```bash
npm run degen:eth:signal:scalp -- --dry-run
SIGNAL_MODE=ema npm run degen:eth:signal -- --dry-run
SIGNAL_MODE=rsi npm run degen:eth:signal -- --dry-run
TRADING_STYLE=intraday npm run degen:eth:signal -- --dry-run
HL_INTERVAL=5m npm run degen:eth:signal -- --dry-run
npm run degen:eth:signal -- 12 5
```

Cron: interval ile uyumlu (ör. 15m → 15 dk, 5m → 5 dk). `--no-rsi` ile EMA/MACD tarafındaki RSI filtrelerini kapat.

### perp_trade opens (same shape as successful jobs)

| Script | `pair` | Default size (argv) |
| --- | --- | --- |
| `post-perp-open-btc.ts` | BTC | USDC notional + kaldıraç: `npm run degen:perp:open:btc -- 20 10` |
| `post-perp-open-hype.ts` | HYPE | `npm run degen:perp:open:hype -- 15 5` |
| `post-perp-open-eth.ts` | ETH | USDC notional; argv2. İkinci arg kaldıraç (varsayılan **5**): `npm run degen:perp:open:eth -- 20 2` |
| `post-perp-open-virtual.ts` | VIRTUAL | default **`21`** (~**15 USDC**); `14` ≈ ~10 USDC |
| `post-perp-open-aixbt.ts` | AIXBT | `40` (~10 USDC if AIXBT ≈ $0.25), **leverage 3x** (max for this pair) |

AIXBT: `npm run degen:perp:open:aixbt:10` or `degen-open-aixbt-10.cmd`. Pass a different coin amount as the first argument if notional is off.

### perp_trade close (minimal JSON)

| Script | Notes |
| --- | --- |
| `post-perp-close-aixbt.ts` | `{ action: "close", pair: "AIXBT" }` — `degen-close-aixbt.cmd` / `npm run degen:perp:close:aixbt` |
| `post-perp-close-eth.ts` | `{ action: "close", pair: "ETH" }` — `degen-close-eth.cmd` / `npm run degen:perp:close:eth` |
| `post-perp-close.ts` | `{ action: "close", pair: "VIRTUAL" }` — `npm run degen:perp:close` |

### perp_modify (TP / SL — HL açık poz)

Degen: *“Modify leverage, TP/SL, or margin on an existing Hyperliquid position.”* Ücret tipik **~0.01 USDC**.

Başarılı job şekli (düz `serviceRequirements`):

```json
{ "pair": "BTC", "stopLoss": "70300", "takeProfit": "67930" }
```

Komut:

```bash
npm run degen:perp:modify -- VIRTUAL 0.62 0.75
```

Üç argüman: **pair**, **stopLoss**, **takeProfit** — BTC/ETH için çoğu zaman **tam sayı** kullan; kesirli TP/SL HL’de `Invalid TP/SL price` verebilir. Otomatik yuvarlama: `npm run degen:perp:modify -- ETH 2121 2220.99 --int`

Sadece kaldıraç / marj alanları için Degen dokümantasyonundaki ek anahtarlar gerekirse script’e sonra eklenebilir.
