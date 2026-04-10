# Vercel Environment Variables Kontrol Listesi

## Gerekli Tüm Environment Variables

Vercel Project Settings → Environment Variables'da şunlar **mutlaka** olmalı:

### 1. Authentication
```
DASHBOARD_PASSWORD=tako2026
DASHBOARD_SESSION_SECRET=2um7YkS3c9QwqIW1dKTroJFlaLAGEUzvyhis0Mn6Rf8ObgZD
```

### 2. Upstash Redis (Activity Log için)
```
UPSTASH_REDIS_REST_URL=https://topical-gator-91254.upstash.io
UPSTASH_REDIS_REST_TOKEN=gQAAAAAAAWR2AAIncDE1N2ZhOWRiNzgxNmU0Y2E3YTI5NWNjZDcwYTNkNDNkMXAxOTEyNTQ
```

### 3. Agents JSON
```
AGENTS_JSON=[{"alias":"doctorstrange",...}]
```
(Tam JSON string'i `.env.local`'dan kopyala)

---

## Kontrol Adımları

### 1. Environment Variables Eklenmiş mi?
- Vercel Dashboard → Proje seç → Settings → Environment Variables
- **Her environment (Production, Preview, Development) için** yukarıdaki tüm değişkenler olmalı

### 2. Redeploy Edilmiş mi?
Environment variable ekledikten sonra **mutlaka redeploy** etmelisin:
- Vercel → Deployments → En son deployment → "..." → **Redeploy**
- Veya yeni bir commit push'la

### 3. Deployment Logları
Deployment sırasında hata oldu mu kontrol et:
- Vercel → Deployments → En son deployment → **View Function Logs**
- Redis connection hatası varsa loglarda görünür

### 4. Runtime Logları
Vercel'de dashboard'u açtıktan sonra:
- Vercel → Deployments → En son deployment → **Runtime Logs**
- `/api/activity` endpoint'ine istek atıldığında hata varsa burada görünür

---

## Test

1. Vercel URL'nizi açın (örn: `https://degen-dashboard.vercel.app`)
2. Login olun
3. "İşlemler" tab'ına gidin
4. Eğer boş görünüyorsa → F12 → Console → Hata var mı?
5. F12 → Network → `/api/activity` → Response → Hata mesajı var mı?

---

## Sık Hatalar

### Hata: "UPSTASH_REDIS_REST_URL ve UPSTASH_REDIS_REST_TOKEN environment variables gerekli"
**Çözüm:** Environment variables'ı ekle ve **redeploy** et.

### Hata: Redis connection timeout
**Çözüm:** Upstash Redis'in aktif olduğundan emin ol. Upstash dashboard'undan test et.

### Activity log boş gösteriliyor
**Olası sebepler:**
1. Environment variables **redeploy sonrası** eklenmemiş
2. Redis key yanlış (`degen:activity` olmalı)
3. Henüz hiç işlem yapılmamış (test için local'de bir işlem yap)

---

## Debug: Runtime'da Environment Variable Kontrolü

Vercel'de çalışıp çalışmadığını görmek için `/api/activity/route.ts`'e geçici log ekle:

```typescript
export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  // DEBUG: Environment variables
  console.log("Redis URL exists:", !!process.env.UPSTASH_REDIS_REST_URL);
  console.log("Redis Token exists:", !!process.env.UPSTASH_REDIS_REST_TOKEN);

  try {
    const activities = await getActivity(100);
    console.log("Activities count:", activities.length); // DEBUG
    return NextResponse.json({ activities });
  } catch (e) {
    console.error("Activity fetch error:", e); // DEBUG
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
```

Bu logları **Vercel Runtime Logs**'dan görebilirsin.
