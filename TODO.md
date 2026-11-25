# Reconcile MCP — Geliştirme To-do

## 1. Dashboard, marka ve erişilebilir component'ler — Temel UI `main`e alındı; son Alert/MCP polish'i yerel doğrulama aşamasında
- Kaynak A ve Kaynak B için ayrı, klavye ile de kullanılabilen CSV/XLSX sürükle-bırak veya dosya seçme alanları; gerçek dosya adı, boyutu, satır sayısı ve saptanan alanlar; demo/fake veri yok.
- Dashboard; ürün/tema/MCP başlığı, iki kaynak kartı, `Comparison`/`Differences`/`Summary` sekmeleri, gerçek karşılaştırma tablosu ve özeti, görünür eylem alanı. `CONNECT MCP` ve `RUN` iki ana eylem; gerekli kopyalama/eşleme kontrolleri dışında dekoratif buton yok. Mobil görünüm tek sütunda.
- Kullanıcının verdiği ikon dashboard başlığında, favicon'da ve platform logo metadata'sında kullanılıyor; başka dekoratif görsel ekleme.
- Açık tema varsayılan; çalışan bir anahtar açık/koyu tema arasında geçiriyor. Tema bellekte; `localStorage`, cookie veya kalıcı profil yok.
- Vite + Tailwind 3 ile uyumlu shadcn/ui bileşenleri: Button, Card, Badge, Input, Label, Select, Tabs, Switch, Dialog, Alert, Table, Breadcrumb, Base UI Progress, Spinner, Separator ve Tooltip. Dosya/mapping/boyut/API hatalarında erişilebilir Alert kullan. TanStack-powered Data Table sıralama/sayfalama ve mevcut arama/durum filtresini destekler.
- Breadcrumb gerçek bağlamı `Workspace → Reconciliation` olarak verir; bağlantı `#sources` kaynağa gider. Yeni route yokken ek breadcrumb katmanı veya sahte sayfa uydurma.
- Renk/durum etiketlerinde kontrast, klavye kullanımı, görünür focus, semantik tablo başlıkları ve `aria-live` geri bildirimleri korunur; renk tek başına anlam taşımaz.
- Dosya bırakma, bekleme, sonuç paneli ve metrik kartlarında basit ama fark edilir kısa animasyonlar vardır; `prefers-reduced-motion: reduce` desteği sürer ve animasyon içeriği geciktirmez/gizlemez.
- `RUN` kalın çok renkli border kuşağı ve hover/focus glow taşır. `CONNECT MCP` gerçek endpoint'i açıkça gösterip kopyalar; dış istemciyi zaten bağladığını iddia etmez.

## 2. Deterministik mutabakat akışı — İşlevler `main`de; son regresyonlar bu dalda yeniden doğrulanacak
- A/B anahtarını ortak başlıklardan otomatik belirle: `id`, `uuid`, `key`, `record_id`, `invoice_id`, `transaction_id` gibi kimlik adlarını öncele; yoksa ilk ortak başlığı deterministik kullan; ortak başlık yoksa RUN etkin olmasın. Otomatik seçimi arayüzden değiştirebil ve 1–10 alan çiftiyle bileşik anahtar kurabil.
- Başlıklar farklı adlandırıldığında A alanını B alanıyla manuel eşle; anahtar çiftlerini karşılaştırma alanlarında yineleme; en fazla 100 karşılaştırma alanı çifti gönder.
- `Ignore case (text)` ve `Trim whitespace` gerçek karşılaştırma davranışını değiştirir; varsayılanlar geriye dönük davranışı korur.
- Sayısal decimal tolerans güvenle doğrulanmış metin olarak ayarlanabilir; kayan nokta yuvarlama hatası üretmez. Boş bırakıldığında kesin karşılaştırma geçerli olur.
- Sonuçlarda anahtar/alan/değer araması ve `match`, `mismatch`, `only in A`, `only in B`, `duplicate` durum filtresi çalışır; sonuç sayısı, eşleşme sayısı ve boş durumlar gösterilir. Tablo gerçek kayıt önizlemesini sıralayıp sayfalar; ekrandaki örnek sınırı rapor kapsamı farkı açıkça belirtilir.
- Özet motorun gerçek eşleşen, uyuşmayan, yalnız A/B, yinelenen ve şema farkı sayılarını gösterir. İndirilebilir CSV raporu tüm ilgili farkları kapsar.
- Finansal hesaplamalar ve kayıt eşleştirmeleri deterministiktir; AI kullanma.

## 3. MCP entegrasyonu ve istemci çıktısı — Araçlar/format main'de; bu dalda şematik açıklama ve rehber güçlendirilecek
- `/api/mcp` stateless Streamable HTTP ve yerel STDIO desteği sürer; `compare_datasets`, `find_missing_records`, `detect_duplicates`, `detect_value_mismatches`, `generate_report` araç adları ve çağrıları geriye dönük uyumlu kalır.
- MCP istemcileri `reconcile://guide` statik yetenek/kullanım kaynağını ve `reconcile_workflow` prompt'unu keşfedebilir; örnekler sentetik, kullanıcı verisi saklanmaz.
- `CONNECT MCP` erişilebilir Dialog'da gerçek `/api/mcp`, `Streamable HTTP`, araç listesi, istemci yönergesi ve bağlantı durumunun sınırını açıklar; URL panoya kopyalanır; Claude/ChatGPT'ye otomatik bağlandığı söylenmez.
- Bu dalda Dialog, MCP sonucunu şematik olarak `Outcome → Metrics → Differences → Structured data` adımlarıyla açıklasın; MCP resource, `reconcile.result.v1` structuredContent alanlarını ve tool çıktı örneğini anlatmalı.
- Her tool hem başlık/özet/metrik/fark tabloları olan okunabilir, saldırgan Markdown'a karşı güvenli rapor hem makinece okunabilir `structuredContent` sunar; istemci sunumu değişse de iki biçim anlamlıdır. Tam fark CSV'de; MCP yanıtı en çok 2 MB, sessiz kırpma yok.

## 4. Gizlilik, doğruluk ve kaynak sınırları — Mevcut korumalar korunacak; yeni dalda test/audit tekrar çalıştırılacak
- Dosya/kaynak/sonuç saklama yok; veritabanı, kalıcı cache, kullanıcı/file storage, analytics, izleme, profilleme/telemetri veya harici AI gönderimi yok. Veriler yalnız bellekte işlenir.
- İstek gövdesini, dosya içeriğini, kimlik bilgisini veya hassas sonucu loglama; hata/MCP yanıtında sır gösterme; geçici dosya tutma; yalnız sentetik test verisi kullan.
- Altyapı sağlayıcı retention/logging sınırlarını doğru açıkla; doğrulanmayan mutlak sıfır retention veya GDPR/KVKK sertifikalı/garantili hukuk iddiası yapma.
- Parametreli salt okunur SQL, SSRF/DNS rebinding/ağ allow-list koruması, Zod doğrulaması, dış bağlantıda HTTPS, zararlı/çok büyük dosya ve XLSX ZIP bombası koruması, keyfî SQL/shell/yüklenen kod çalıştırmama ve en az ayrıcalığı koru.
- Kullanıcı onaylı bütçe: dosya başına 4 MB; tüm HTTP isteği ekler dâhil 4,25 MB; kaynak başına 10.000 satır ve 100 sütun; en çok 15 saniye; API yanıtı 2 MB. Aşımı reddet, sessizce kırpma.

## 5. CI/CD kalite kapısı — Repo koruması main'de; bu dalın PR kontrolü açık
- Her push/PR'da strict TypeScript, ESLint, sentetik unit/integration, CSV/XLSX parser, karşılaştırma doğruluğu, security/girdi doğrulama, zero-retention/hassas log, HTTP ve MCP protocol testleri; production dependency audit ve production build çalışsın.
- `main-ci-gate` PR ve required `Reconcile MCP CI / quality` koşulu korunsun; başarısız veya bekleyen kalite kontrolüyle merge etme. Vercel production yalnız başarılı kalite kapılı `main` merge'iyle yayınlansın; preview SSO, production MCP erişimi mevcut ayarıyla sürsün.
- Bu dalın Alert, MCP kaynak/referans/README ve UI sözleşmesi değişikliklerini GitHub PR kalite kapısından ve Vercel preview'dan geçir; üretimde yalnız sentetik smoke test yap.

## 6. Yayın ve canlı doğrulama — Mevcut yayın baseline; bu dalın Vercel production güncellemesi bekliyor
- Public repo `DogukanAgenticEngineer/reconMCP` ve mevcut `recon-mcp` Vercel Hobby projesini kullan; paralel repo/proje açma.
- Başarılı PR merge'i sonrasında `https://recon-mcp-dgn15.vercel.app` ve `/api/mcp` deployment'ının `READY` durumunu ve doğru `main` SHA'sını doğrula.
- Canlı ana sayfa, `/manus-routes.json`, MCP `initialize`, `tools/list`, `prompts/list`, `resources/list`, beş araç ve sentetik `compare_datasets` round-trip kontrol edilsin. Production logları, gerçek dosya/müşteri datası veya gerçek dış kaynak smoke testinde kullanılmasın.
- Öncelik: gizlilik, güvenlik, doğruluk, erişilebilirlik, sadelik.

## Doğrulama kaydı
- PR #8'e alınan dashboard/Data Table/Base Progress/Spinner/Breadcrumb ve ikon kodunu, yeni Alert ile MCP guide/Dialog değişiklikleriyle aynı feature branch üzerinde yeniden doğrula.
- Strict typecheck, lint, sentetik testler, production dependency audit, production build, `git diff --check`, GitHub required checks, Vercel preview ve production MCP smoke test sonuçlarını tamamlandıkça bu bölüme kaydet.
- Yerel doğrulama (2026-11-17): `pnpm typecheck`, `pnpm lint`, `pnpm build` ve `git diff --check` başarılı; `pnpm test` 34/34 geçti; `pnpm audit --prod --audit-level high` bilinen zafiyet bulmadı. Geliştirme preview'ında ana sayfa, `/manus-routes.json`, App, MCP Dialog ve Alert modülleri HTTP 200 döndü. Bu dalın GitHub required checks ve Vercel preview/production kontrolleri henüz bekliyor.
\n\n## 7. Kriptografik asal doğrulama — feature branch üzerinde ilk uygulama\n- `verify_prime`: 64 bit altı kanıtlanmış Miller–Rabin taban kümesi; daha büyük sayılarda CSPRNG tabanlı olasılıksal tarama.\n- `generate_probable_prime`: 128–4096 bit CSPRNG aday üretimi ve Miller–Rabin taraması.\n- RH/GRH koşullu sonuç, Lean biçimsel sertifika ve standartlara uygun RSA anahtar üretimi henüz uygulanmadı; araçlar bu garantileri iddia etmez.\n- Birim testleri eklendi; CI kalite kapısı geçmeden merge/production deploy yapma.\n