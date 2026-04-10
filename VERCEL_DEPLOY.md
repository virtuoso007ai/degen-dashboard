# Vercel Deploy Talimatları

## 1. Vercel Hesabı ve Proje Oluşturma

1. https://vercel.com adresine git ve GitHub hesabınla giriş yap
2. "Add New..." → "Project" seç
3. "Import Git Repository" bölümünden `virtuoso007ai/degen-dashboard` repo'sunu seç
4. Framework Preset: Next.js (otomatik algılanır)
5. Root Directory: `./` (varsayılan)
6. **Deploy'a BASMA** — önce environment variables eklemen gerekiyor

## 2. Environment Variables Ekle

"Environment Variables" bölümüne aşağıdaki değişkenleri ekle (hepsi için Environment: **Production**, **Preview**, **Development** seç):

### AGENTS_JSON
**Değer:** `.env.local` dosyandaki tam JSON array'i kopyala (tek satır olmalı):
```
[{"alias":"doctorstrange","apiKey":"acp-966a3c70141eaba78412","label":"Doctor Strange","walletAddress":"0x9375E307DCBD3D85e7a0FA65F4325c2CD8A6756F"},{"alias":"friday","apiKey":"acp-5c1ab63bbaa27c3c7cd9","label":"FRIDAY","walletAddress":"0x..."},...}]
```

### DASHBOARD_PASSWORD
**Değer:** Güçlü bir şifre (min 8 karakter), örn: `MySecurePass2026!`

### DASHBOARD_SESSION_SECRET
**Değer:** Rastgele 32+ karakter string, örn: `generate-this-with-openssl-rand-hex-32-or-similar-method-12345678`
PowerShell ile oluşturmak için:
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

## 3. Deploy

1. "Deploy" butonuna bas
2. İlk deploy 2-3 dakika sürer
3. Deploy tamamlandığında Vercel URL'i alırsın (örn: `https://degen-dashboard-xyz.vercel.app`)

## 4. Test

1. Vercel URL'ine git
2. `/login` sayfasına yönlendirecek
3. `DASHBOARD_PASSWORD` ile giriş yap
4. Dashboard'u test et (pozisyon açma, kapatma, modify, deposit)

## 5. Mobil Erişim

- Vercel URL'i public ve SSL sertifikalı, mobil tarayıcıdan direk erişebilirsin
- Giriş yaptıktan sonra session cookie'si kaydedilir (7 gün)
- Mobil görünüm için responsive tasarım hazır

## 6. Güvenlik (Opsiyonel)

Eğer dashboard'u tamamen private yapmak istersen:
- Vercel Project Settings → Deployment Protection → Enable Password Protection
- Veya Vercel Authentication ile SSO ekle

## Güncelleme

Yerel değişiklik yaptıktan sonra:
```bash
cd d:\super-saiyan-raichu\degen-dashboard
git add .
git commit -m "update: açıklama"
git push
```
Vercel otomatik deploy eder (30-60 saniye).
