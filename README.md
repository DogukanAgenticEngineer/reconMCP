# Reconcile MCP

Reconcile MCP, iki CSV/Excel (XLSX), salt okunur PostgreSQL veya REST kaynağını karşılaştıran açık kaynaklı bir MCP sunucusu ve tarayıcı çalışma alanıdır. Deterministik TypeScript çekirdeği eksik kayıtları, yinelenen anahtarları, değer/tutar uyuşmazlıklarını ve şema farklarını raporlar. Veriler için uygulama veritabanı veya kalıcı dosya deposu yoktur.

> “Sıfır saklama” bu kodun uygulama katmanında kalıcı veri tutmaması anlamındadır. Vercel/GitHub gibi altyapı sağlayıcılarının trafik ve işlev loglarını ya da retention sürelerini bu uygulama denetlemez. Hassas veri kullanmadan önce [PRIVACY.md](PRIVACY.md) ve [DATA_RETENTION.md](DATA_RETENTION.md)'yi okuyun.

## Özellikler

- Arayüzde yalnız A/B CSV/XLSX dropzone'ları, MCP endpoint URL'sini kopyalayan `CONNECT MCP` düğmesi ve `RUN` düğmesi bulunur. Ortak başlıklardan kimlik alanı deterministik seçilir (`id`/`uuid`/`key` vb. önce; yoksa ilk ortak başlık); diğer ortak alanlar sıfır toleransla karşılaştırılır. CSV raporu bağlantı olarak indirilebilir.
- CSV ve XLSX (ilk çalışma sayfası) bellekten ayrıştırma; PostgreSQL'de quoted identifier ve parametreli LIMIT ile yalnız `SELECT`/read-only transaction; REST'te yalnız HTTPS GET.
- `compare_datasets`, `find_missing_records`, `detect_duplicates`, `detect_value_mismatches` ve `generate_report` araçları; stateless Streamable HTTP (`/api/mcp`) ile yerel STDIO.
- JSON structured content ve okunabilir Markdown özeti. Karşılaştırma saf TypeScript'tir; AI kullanmaz.
- Radix Themes, React, Vite, TypeScript strict, Zod, Vitest ve ESLint.

## Sınırlar

| Koruma | Sınır |
|---|---:|
| Tek CSV/XLSX dosyası | 4 MB |
| HTTP isteği (form alanları/ek yük dahil) | 4,25 MB |
| Dosya dışı satır/DB/JSON kaynağı | kaynak başına 10.000 satır, 100 sütun, toplam 4 MB hücre verisi |
| Tek hücre değeri | 64 KiB |
| REST yanıt gövdesi | 2 MB |
| HTTP/MCP yanıtı | 2 MB; aşımda reddedilir, veri sessizce kesilmez |
| İşlem | en çok 15 saniye |
| XLSX ZIP arşivi | en çok 250 entry, toplam açılmış 25 MB, entry başına 10 MB ve sıkıştırma oranı 100:1 |

Vercel Functions'ın belgelenmiş hard request/response payload sınırı 4,5 MB olduğundan uygulama tarafında istek 4,25 MB'a ayarlanmıştır. MCP'ye XLSX gönderilirken base64 ek yükü olduğundan HTTP üzerinden tek XLSX'in pratik ham boyutu yaklaşık 3 MB'ı aşmamalıdır. Vercel Hobby/Free planın güncel kotaları değişebilir; yayın öncesinde [function limitations](https://vercel.com/docs/functions/limitations), [duration](https://vercel.com/docs/functions/configuring-functions/duration) ve [Hobby plan](https://vercel.com/docs/plans/hobby) belgelerini kontrol edin.

## Yerel geliştirme

Node.js 22 ve pnpm 11.25.0 kullanın. Repo kökünde:

```sh
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
# REST/PG kullanılacaksa yalnız izinli tam hostları ve gerekiyorsa PostgreSQL portlarını ayarlayın.
pnpm dev
```

Arayüz `http://localhost:3000`'de, mutabakat API'si `/api/reconcile`, MCP `/api/mcp`'de açılır. Network kaynakları `.env` içinde `RECONCILE_ALLOWED_HOSTS` listesi boşsa kapalıdır. Wildcard kullanmayın. PostgreSQL port varsayılanı yalnız `5432`'dir; gerekiyorsa `RECONCILE_ALLOWED_POSTGRES_PORTS`'a açıkça ekleyin.

Doğrulama komutları:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm audit --prod --audit-level high
pnpm build
```

Yerel MCP STDIO için `pnpm start:stdio` çalıştırın. MCP istemcisinin çalışma dizini repo kökü olmalı; örnek:

```json
{
  "mcpServers": {
    "reconcile": {
      "command": "pnpm",
      "args": ["--dir", "/path/to/reconcile", "start:stdio"]
    }
  }
}
```

## MCP ile bağlanma

Production Streamable HTTP endpoint'i `https://<deployment-domain>/api/mcp` biçimindedir. ChatGPT veya başka MCP istemcisine bu URL'yi ekleyin. Sunucu açık bir endpoint'tir; kullanıcı/veritabanı API kimlik bilgilerini yalnız kendi tool çağrısında göndermelidir. Kaynak bağlantısı, sunucu tarafı `RECONCILE_ALLOWED_HOSTS` allow-list'inde tam eşleşme gerektirir. `generate_report` çıktısındaki CSV `structuredContent.reportCsv` alanındadır.

Basit tool çağrısı girdisi:

```json
{
  "left": { "type": "rows", "rows": [{ "id": "A-1", "amount": "19.95" }] },
  "right": { "type": "rows", "rows": [{ "id": "A-1", "amount": "20.00" }] },
  "keyPairs": [{ "left": "id", "right": "id" }],
  "fieldPairs": [{ "left": "amount", "right": "amount" }],
  "tolerance": "0.01"
}
```

CSV kaynağı MCP argümanında `{"type":"csv","content":"..."}`; XLSX `{"type":"xlsx","contentBase64":"..."}` biçimindedir. Excel dosyaları base64 olarak taşındığı için MCP girişi toplam 4,25 MB sınırına tabidir. REST kaynak yanıtı JSON nesne dizisi, `{ "data": [...] }`, `{ "records": [...] }` veya CSV olmalıdır.

## Vercel ve GitHub dağıtımı

GitHub Actions `.github/workflows/quality.yml` her push ve PR'da strict typecheck, lint, sentetik unit/integration ve MCP protocol testleri, production dependency audit ve production build çalıştırır. GitHub'da etkin `main-ci-gate` ruleset'i `main` güncellemelerini PR'larla sınırlar; `Reconcile MCP CI` workflow'unun `quality` kontrolü güncel `main` üzerine başarılı olmalı ve ruleset'te bypass aktörü yoktur. Tek bakımcı akışını durdurmamak için insan onay sayısı sıfırdır; CI kontrolü zorunludur.

Vercel production projesi henüz oluşturulmadı; public HTTPS endpoint/production URL henüz yok. Dağıtım için bu repository'yi `main` production branch'i ile Vercel Hobby projesine bağlayın; install `pnpm install --frozen-lockfile`, build `pnpm build`, output `dist` olarak ayarlayın. Proje oluşturma izni olan Vercel ekip üyeliği gerekir. Bağlandıktan sonra korumalı `main`'e yalnız başarılı CI ardından merge edilmesi production dağıtımını tetikler; PR'lar preview alabilir. Proje ortamına yalnız gerekli hostları `RECONCILE_ALLOWED_HOSTS` ve izinli DB portlarını `RECONCILE_ALLOWED_POSTGRES_PORTS` olarak girin; bağlantı gizli anahtarlarını repository'ye commit etmeyin. Boş allow-list ağ kaynaklarını reddeder. Uygulama analytics/telemetry kullanmaz; veritabanı/storage kurulumu yoktur.

## Güvenlik ve gizlilik

Ayrıntılar: [SECURITY.md](SECURITY.md), [THREAT_MODEL.md](THREAT_MODEL.md), [PRIVACY.md](PRIVACY.md), [DATA_RETENTION.md](DATA_RETENTION.md). Mutabakat hukuki/finansal uyum sertifikası değildir. Verinin yasal işleme dayanağı ve altyapı/hesap planı sorumluluğu dağıtımı yapan kişidedir.

## Lisans

MIT. Ayrıntılar için [LICENSE](LICENSE).
