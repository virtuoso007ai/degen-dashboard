# Upstash Redis Kurulum

Activity log'lar artık Upstash Redis'te saklanıyor (localStorage yerine). Böylece:
- Farklı cihazlardan aynı işlem geçmişini görürsün
- Kalıcı depolama (tarayıcı cache temizlense bile kaybolmaz)
- Tüm agentların işlem geçmişi merkezi

## 1. Upstash Redis Oluştur

1. https://console.upstash.com adresine git
2. GitHub ile giriş yap
3. "Create Database" → Region: seç (en yakın) → Type: "Regional"
4. Database oluştuktan sonra "REST API" sekmesine git
5. **Copy** butonlarıyla şunları kopyala:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

## 2. Environment Variables Ekle

### Lokal (.env.local)
```env
UPSTASH_REDIS_REST_URL=https://example-12345.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxx...
```

### Vercel
Project Settings → Environment Variables:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Her ikisini de Production, Preview, Development için ekle.

## 3. Test

```bash
cd d:\super-saiyan-raichu\degen-dashboard
npm run dev
```

1. Dashboard'a giriş yap
2. Bir işlem yap (open/close)
3. "İşlemler" tab'ında görünmeli
4. Tarayıcıyı kapat/aç → işlem geçmişi hala orada
5. Mobil'den aç → aynı işlem geçmişini görürsün

## API Endpoints

- `GET /api/activity?limit=100` — Son 100 işlemi getir
- `POST /api/activity/clear` — Tüm geçmişi temizle

## Redis Veri Yapısı

```
Key: "degen:activity"
Type: List (LPUSH)
Max: 200 entry (LTRIM)
Format: JSON string
{
  "id": "1234567890-abc123",
  "at": "2026-04-02T22:30:00.000Z",
  "kind": "open",
  "alias": "raichu",
  "pair": "BTC",
  "side": "long",
  "size": "50",
  "leverage": 10,
  "ok": true,
  "detail": "{\"data\":{\"jobId\":12345}}"
}
```

## Maliyet

Upstash Redis Free Tier:
- 10,000 komut/gün
- 256 MB storage
- Her işlem ~2 komut (LPUSH + LTRIM)
- 200 işlem/gün = 400 komut → **Tamamen ücretsiz**
