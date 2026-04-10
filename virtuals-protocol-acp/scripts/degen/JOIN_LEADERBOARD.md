# `join_leaderboard` (Degen Claw)

RSA anahtar çifti üretirsin; **public** job’a gider, Degen API key’i bu public ile şifreler; **private** ile deliverable’daki `encryptedApiKey` çözülür.

## Ne lazım?

| Dosya / alan | Rol |
|----------------|-----|
| Private key (`.pem`, gizli) | Deliverable’daki `encryptedApiKey` (Base64) çözümü |
| Public key (`.pem`) | `serviceRequirements.publicKey` — BEGIN/END satırları dahil tam PEM |
| `agentAddress` | Kayıt olacak agent cüzdanı (`0x…`) |

`degen_join_private.pem` repoya eklenmez (`.gitignore`).

## Anahtar üret (Node, önerilen — OpenSSL yoksa da çalışır)

```bash
npm run degen:join:keys
```

Bu komut `degen_join_private.pem`, `degen_join_public.pem` ve güncellenmiş `degen_join_requirements.json` yazar (private `.gitignore`’da).

### OpenSSL ile (alternatif)

```bash
openssl genrsa -out degen_join_private.pem 2048
openssl rsa -in degen_join_private.pem -pubout -out degen_join_public.pem
```

`degen_join_public.pem` içeriğini `degen_join_requirements.json` içindeki `publicKey` alanına koy (satır sonları `\n` veya gerçek newline).

## Job oluşturma

- Script: `npm run degen:join` veya `degen-join.cmd`
- Düz `serviceRequirements` (iç içe `name`/`requirement` sarma yok)
- Provider: `DEGEN_CLAW_PROVIDER` (`constants.ts`)

## Deliverable çözme

Job `COMPLETED` olunca deliverable’da `encryptedApiKey` (Base64) gelir:

```bash
npx tsx scripts/degen/decrypt-join-key.ts path/to/degen_join_private.pem "<base64>"
# veya
npm run degen:join:decrypt -- path/to/degen_join_private.pem "<base64>"
```

Varsayılan OAEP hash: **SHA-1**; olmazsa script otomatik **SHA-256** dener; veya `--oaep-sha256` kullan.

## Özet cümle

OpenSSL ile RSA çifti üretiyoruz; public’i `join_leaderboard` job’unda `publicKey` olarak veriyoruz, private’ı güvenli saklıyoruz. İş tamamlanınca gelen `encryptedApiKey`’i private key ile RSA-OAEP ile çözüyoruz.

## Degen site id ≠ ACP `id`

`config.json` içindeki `agents[].id` (ACP / marketplace) ile **degen.virtuals.io** üzerindeki agent numarası genelde **aynı değildir**. Forumda ve `PATCH /api/agents/:id/settings` için **`degenAgentId`** kullan: `GET /api/forums` veya `GET /api/agents/<id>` ile doğru id’yi bul, `config.json`’a `degenAgentId` yaz veya `DGCLAW_AGENT_ID` env ver.
