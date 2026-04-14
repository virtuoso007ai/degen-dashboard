# Degen Panel (Vercel)

Kişisel kullanım: açık pozisyonlar, leaderboard özeti, ACP ile pozisyon aç/kapa. **API anahtarları yalnızca Vercel ortam değişkenlerinde** tutulur; tarayıcıya gitmez.

**Arayüz:** Sekmeler — **Özet** (istatistik + form), **Pozisyonlar** (kartlar, long/short renk çubuğu, modify, deposit/withdraw), **İşlemler** (bu tarayıcıda saklanan aç/kapa logu), **Sıralama** (leaderboard). **İşlemler** zincir geçmişi değildir; yalnızca panelden attığın job kayıtları (`localStorage`).

**Özellikler:**
- **Pozisyon yönetimi**: Market ve limit emir ile açma, kapatma, modify (TP/SL/kaldıraç)
- **Bakiye operasyonları**: Deposit ve withdraw
- **Detaylı görünüm**: Liquidation price, margin, unrealized PnL
- **Onay dialog'ları**: Her işlem için onay + timed toast notifications
- **Mobil uyumlu**: Responsive grid layout (mobil, tablet, desktop)

## Ortam değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `AGENTS_JSON` | Telegram bot’taki ile **aynı** tek satır JSON |
| `DASHBOARD_PASSWORD` | Giriş şifresi |
| `DASHBOARD_SESSION_SECRET` | Rastgele uzun string (oturum çerezi imzası) |

`.env.local` ile lokal deneme:

```bash
cp .env.example .env.local
# değerleri doldur (AGENTS_JSON = Telegram bot ile aynı JSON)
npm run dev
```

Şablon: repoda `degen-dashboard/.env.example`. Agent listesi ve panel şifreleri için ayrıca `telegram-degen-bot/ORTAM_VE_DASHBOARD.md`.

**Hata: `Cannot find module './627.js'` / `./638.js` vb.** — bozuk `.next` (ve bazen `node_modules/.cache`). Önce **çalışan `npm run dev` sürecini tamamen kapat**, sonra:

```bash
npm run clean
npm run dev
```

Tek komut: `npm run dev:clean` (temizler + dev başlatır).

Hâlâ olursa: `node_modules` sil → `npm install` (Next sürümü karışmış olabilir).

## Vercel deploy

1. Repo’yu GitHub’a it veya `vercel` CLI ile klasörü bağla.
2. Project → Settings → Environment Variables: yukarıdaki üç değişkeni ekle (Production).
3. Deploy. URL’yi sadece sen kullan.

İsteğe bağlı ek güvenlik: Vercel **Deployment Protection** (şifre / SSO).

## API

- `POST /api/auth/login` — `{ "password": "..." }`
- `POST /api/auth/logout`
- `GET /api/snapshot` — tüm agentlar pozisyon + bakiye
- `GET /api/leaderboard` — sezon sıralaması + senin agent sıraların
- `POST /api/trade/open` — `{ alias, pair, side, size, leverage, stopLoss?, takeProfit?, orderType?, limitPrice? }`
- `POST /api/trade/close` — `{ alias, pair }`
- `POST /api/trade/modify` — `{ alias, pair, stopLoss?, takeProfit?, leverage? }`
- `POST /api/trade/deposit` — `{ alias, amount }`
- `POST /api/trade/withdraw` — `{ alias, amount, recipient? }`
