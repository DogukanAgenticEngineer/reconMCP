<h1 align="center">
  <img src="public/reconcile-agent-icon.png" width="76" height="76" alt="Reconcile MCP icon" /><br />
  Reconcile MCP
</h1>

<p align="center"><strong>Privacy-first, deterministic data reconciliation</strong></p>

Reconcile MCP, iki CSV/Excel (XLSX), salt okunur PostgreSQL veya REST kaynağını karşılaştıran açık kaynaklı bir MCP sunucusu ve tarayıcı çalışma alanıdır. Deterministik TypeScript çekirdeği eksik kayıtları, yinelenen anahtarları, değer/tutar uyuşmazlıklarını ve şema farklarını raporlar. Veriler için uygulama veritabanı veya kalıcı dosya deposu yoktur.

> “Sıfır saklama” bu kodun uygulama katmanında kalıcı veri tutmaması anlamındadır. Vercel/GitHub gibi altyapı sağlayıcılarının trafik ve işlev loglarını ya da retention sürelerini bu uygulama denetlemez. Hassas veri kullanmadan önce [PRIVACY.md](PRIVACY.md) ve [DATA_RETENTION.md](DATA_RETENTION.md)'yi okuyun.

## Extensible reconciliation workflows

Reconcile MCP is designed as an industry-neutral reconciliation engine. Domain-specific workflows can be added as optional layers when their data semantics, validation rules and evidence requirements are independently specified and tested. Such extensions must not narrow or replace the generic reconciliation core or change the behavior of existing MCP tools.

## Özellikler

- Responsive dashboard Kobalte bileşenleriyle A/B için CSV/XLSX sürükle-bırak veya klavyeyle dosya seçme, dosya adı/biçimi/boyutu/satır ve sütun bilgisi, ortak başlıklardan otomatik kimlik alanı seçimi (`id`/`uuid`/`key` vb. öncelikli; yoksa ilk ortak alan), `Comparison`/`Differences`/`Summary` sekmeleri, canlı özet metrikleri ve tema geçişi sunar. Açık tema varsayılandır; tercih yalnız sayfa belleğinde kalır.
- Otomatik anahtar eşlemesini kullanıcı değiştirebilir, 1–10 çiftli bileşik anahtar belirleyebilir, farklı A/B başlıklarını manuel eşleyebilir (en çok 100 karşılaştırma alanı) ve sayısal tolerans girebilir. `Ignore case (text)`, `Trim whitespace` ve `Show only differences` ayarları karşılaştırma veya görünür tabloyu gerçekten değiştirir.
- `CONNECT MCP` endpoint, taşıma biçimi ve araç listesini erişilebilir bağlantı penceresinde gösterir; o ortama ait `/api/mcp` URL'sini kopyalar, dış istemciye zaten bağlı olduğunu iddia etmez. `RUN` karşılaştırmayı başlatır; CSV indirme bağlantısı tüm fark kategorilerini içerir. Sonuç panelinde anahtar/alan/değer araması ve durum filtresi vardır.
- Dashboard'ın karşılaştırma önizlemesi en fazla 50 anahtar grubunu gösterir; arama, durum filtresi, sütun sıralama ve sayfalama içerir. Fark gruplarını önceleyen `Show only differences` filtresi korunur. Ayrıntı ve önizleme sınırları açıkça yazılır; indirilen CSV tam fark raporudur.
- CSV ve XLSX (ilk çalışma sayfası) bellekten ayrıştırma; PostgreSQL'de quoted identifier ve parametreli LIMIT ile yalnız `SELECT`/read-only transaction; REST'te yalnız HTTPS GET.
- `compare_datasets`, `find_missing_records`, `detect_duplicates`, `detect_value_mismatches` ve `generate_report` araçları; stateless Streamable HTTP (`/api/mcp`) ile yerel STDIO. Her karşılaştırma sonucu, sunucu işlem süresi ve açıklanmış güç/şebeke katsayılarıyla modellenen karbon tahmini taşır; `estimate_operation_carbon` aracı çalıştırma öncesi tahmin verir. Bu değer sayaç ölçümü veya sağlayıcı faturası değildir; harici REST/PostgreSQL, ağ, istemci, veri merkezi ek yükü/PUE ve gömülü donanım emisyonlarını kapsamaz. Statik `reconcile://guide` MCP kaynağı ve `reconcile_workflow` prompt'u istemci keşfine açılır.
- MCP yanıtlarında başlıklı, metrik tablolu ve sınırlandırılmış fark tablolu Markdown ile aynı bulguların makinece okunabilir `structuredContent` sunumu birlikte döner. İstemcinin nihai görünümü değişebilir; yapılandırılmış alanlar kanonik kalır. Karşılaştırma saf TypeScript'tir; AI kullanmaz.
- Bağlantı penceresi MCP sonucunun biçimini `Outcome → Metrics → Differences → Structured data` akışıyla açıklar; Claude/ChatGPT'nin son sunumu yine MCP istemcisinin özelliklerine bağlıdır.
- Kobalte (Radix ve Base UI primitives), TanStack Table, SolidJS 2, Vite, Tailwind 3, TypeScript strict, Zod, Vitest ve ESLint.

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

Browser tabanlı MCP istemcileri için `.env` içindeki `MCP_ALLOWED_ORIGINS` alanına virgülle ayrılmış tam `https://origin.example` değerleri ekleyin; wildcard desteklenmez ve boş ayar browser Origin başlıklarını varsayılan olarak reddeder. Native istemciler Origin göndermiyorsa çalışmaya devam eder. Karbon modeli varsayılan olarak 50 W açıklayıcı sunucu güç varsayımı ve IEA'nın 2024 dünya elektrik üretim yoğunluğu olan 445 g CO₂/kWh değerini kullanır. Uygun yerel/sağlayıcı verileriniz varsa `RECONCILE_CARBON_ESTIMATED_POWER_W` ve `RECONCILE_CARBON_GRID_INTENSITY_G_CO2_KWH` değerlerini ayarlayın; tahmin yine metered telemetry değildir. Katsayılar [IEA Electricity 2025](https://www.iea.org/reports/electricity-2025/emissions) içindeki 2024 küresel üretim yoğunluğuna dayanır.

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

Canlı Streamable HTTP MCP endpoint'i [`https://recon-mcp-dgn15.vercel.app/api/mcp`](https://recon-mcp-dgn15.vercel.app/api/mcp); web uygulaması [`https://recon-mcp-dgn15.vercel.app`](https://recon-mcp-dgn15.vercel.app) adresindedir. MCP uyumlu istemciye endpoint URL'sini ekleyin. Server discovery ile `reconcile://guide` kaynağı ve `reconcile_workflow` prompt'u sunar. Production herkese açıktır; Vercel SSO yalnız preview deployment'larında etkin. Kaynak bağlantısı sunucu tarafındaki `RECONCILE_ALLOWED_HOSTS` allow-list'inde tam eşleşme gerektirir. `generate_report` çıktısındaki CSV `structuredContent.reportCsv` alanındadır.

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

Vercel Hobby projesi `recon-mcp`, bu GitHub repository'sine bağlıdır; install `pnpm install --frozen-lockfile`, build `pnpm build`, output `dist` kullanır. Production branch `main`'e yalnız zorunlu `quality` kontrolü başarılı PR merge'iyle güncelleme yapılır ve GitHub bağlantısı Vercel production deployment'ını otomatik tetikler; PR preview'ları SSO korumalıdır. Ağ kaynakları kullanacaksanız Vercel ortamına yalnız gerekli hostları `RECONCILE_ALLOWED_HOSTS` ve izinli DB portlarını `RECONCILE_ALLOWED_POSTGRES_PORTS` olarak girin; bağlantı gizli anahtarlarını repository'ye commit etmeyin. Boş allow-list ağ kaynaklarını reddeder. Uygulama analytics/telemetry kullanmaz; veritabanı/storage kurulumu yoktur.

## Policies and support

- [Privacy Policy](https://recon-mcp-dgn15.vercel.app/privacy.html)
- [Terms of Service](https://recon-mcp-dgn15.vercel.app/terms.html)
- [Support and bug reports](https://github.com/DogukanAgenticEngineer/reconMCP/issues)
- [Demo recording checklist](docs/demo-recording-checklist.md) — the public demo video still needs to be recorded and published by the maintainer.

## Güvenlik ve gizlilik

Ayrıntılar: [SECURITY.md](SECURITY.md), [THREAT_MODEL.md](THREAT_MODEL.md), [PRIVACY.md](PRIVACY.md), [DATA_RETENTION.md](DATA_RETENTION.md). Mutabakat hukuki/finansal uyum sertifikası değildir. Verinin yasal işleme dayanağı ve altyapı/hesap planı sorumluluğu dağıtımı yapan kişidedir.

## Lisans

MIT. Ayrıntılar için [LICENSE](LICENSE).
