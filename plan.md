# Reconcile MCP — Uygulama Planı

## Amaç ve mimari

Mevcut Vite/React uygulamasını üretimdeki deterministik karşılaştırma motoruna ve resmi MCP sunucusuna bağlı, gerçek dosyalarla çalışan bir mutabakat dashboard'una dönüştür. Vercel'de statik arayüz, `/api/reconcile` serverless işlevi ve Streamable HTTP `/api/mcp` endpoint'i kalır; yerel STDIO desteği korunur. PostgreSQL ve REST bağlantıları web ekranını sade tutmak için MCP üzerinden kullanılabilir.

## Ürün ve etkileşim

- Kullanıcının sağladığı dashboard görseli tasarım referansıdır. Arayüzde ürün/bağlantı başlığı, iki kaynak kartı, sonuç sekmeleri, özet metrikleri, karşılaştırma/farklar tablosu ve eylem alanı bulunur.
- A ve B için erişilebilir sürükle-bırak veya klavyeyle dosya seçimi: yalnız CSV/XLSX; dosya adı, boyutu, satır sayısı ve sütunlar görünür. Dosya başına 4 MB, istek toplamı ekler dâhil 4,25 MB sınırı kullanıcıya kısa ve doğru biçimde gösterilir.
- Ortak kimlik alanı otomatik seçilir; `id`/`uuid`/`key`/`record_id`/`invoice_id`/`transaction_id` gibi adlar önce gelir, yoksa ilk ortak başlık deterministik seçilir. Kullanıcı otomatik seçimi değiştirebilir ve 1–10 alan çiftli bileşik anahtar kurabilir; ortak başlık yoksa manuel eşleme yapılabilir.
- Kullanıcının sağladığı uygulama ikonu dashboard marka başlığında, site favicon'unda ve platform proje logosu metadata'sında kullanılır; başka dekoratif görsel eklenmez.
- Açık tema varsayılandır; erişilebilir anahtar açık/koyu temayı değiştirir. Tema durumu yalnız uygulama belleğinde tutulur; `localStorage`, cookie veya kalıcı profil yoktur.
- `Comparison`, `Differences`, `Summary` sekmeleri gerçek API sonucunu gösterir. Özet; eşleşen anahtar/satırları, eksik kayıtları, yinelenen anahtarları, değer farklarını ve şema farklarını gösterir. Tablo, eşleşen/farklı/yalnız A/yalnız B/yinelenen durumları için sunucudan dönen sınırlandırılmış gerçek karşılaştırma önizlemesini; ayrıntı sekmesi fark alanlarını ve A/B değerlerini gösterir. Demo/fake veri kullanılmaz; görünür satır sayısı ve rapor kapsamı ayrımı açıkça belirtilir.
- Mutabakat ayarları işlevseldir: bir veya daha çok anahtar alan çiftini (en çok 10) seçme; farklı A↔B başlıklarını karşılaştırma alanı olarak eşleme (en çok 100); büyük/küçük harf ve whitespace seçenekleri; sayısal alanlar için açık decimal tolerans. Varsayılanlar mevcut deterministik motor davranışını bozmaz.
- Sonuç tablosunda anahtar, alan ve değer araması ile fark durumu filtresi bulunur; geçerli sonucu gerçek sunucu verisi üzerinden süzer, sayıları ve boş durumunu açıkça gösterir.
- `RUN` geçersiz/yüklenmekte olan girdide devre dışıdır; bekleme, hata, boş sonuç ve başarılı sonuç durumları açıkça gösterilir. CSV raporu tam sonuç için indirme bağlantısı sunar. `CONNECT MCP` düğmesi endpoint, taşıma türü, araç listesi ve bağlantı bilgisini erişilebilir Dialog'da gösterir, doğru `/api/mcp` URL'sini kopyalar; harici istemciye bağlı olduğu izlenimini vermez.
- Görsel dil için shadcn/ui bileşenleri (Button, Card, Badge, Input, Label, Select, Tabs, Switch, Dialog, Alert, Table, Base UI Progress, Spinner, Separator, Tooltip) ve mevcut Vite + Tailwind 3 düzeni kullanılır. Sonuç tablosunda TanStack Table ile sıralama/sayfalama bulunur; arama ve durum filtresi mevcut gerçek sonuçları süzer. Breadcrumb gerçek üst bağlamı `Workspace → Reconciliation` olarak gösterir; ek rotalar yokken daha derin bir sayfa hiyerarşisi uydurulmaz. Gereksiz ikon, animasyon kütüphanesi veya harici veri servisi eklenmez. Mobilde alanlar tek sütuna düşer. Klavye erişimi, görünür focus, kontrast, semantik tablo başlıkları, metinle desteklenen durum etiketleri ve `aria-live` geri bildirimi korunur.
- Kısa ama fark edilir CSS animasyonları dosya bırakma, bekleme, sekme/sonuç gösterimi ve özet metrik geçişlerinde kullanılır. `prefers-reduced-motion: reduce` altında kapatılır; veri geciktirilmez veya gizlenmez.

## MCP istemci deneyimi

- `CONNECT MCP` erişilebilir Dialog'da gerçek `/api/mcp` endpoint'ini, `Streamable HTTP` taşımasını, beş aracı ve `Outcome → Metrics → Differences → Structured data` sıralı çıktı şemasını gösterir; URL kopyalanabilir, bağlantı kurulduğu iddia edilmez.
- MCP sunucusu `reconcile://guide` statik yetenek/kullanım kaynağını ve `reconcile_workflow` keşfedilebilir prompt'unu sunar. Kaynak/prompt yalnız sentetik örnek içerir ve kullanıcı verisini saklamaz.
- MCP yanıtları Markdown destekleyen istemcilerde başlık, kısa özet, metrik tablosu ve sınırlandırılmış fark tabloları sunar; aynı bulgular durum/metrik kartları ve kayıt önizlemesi içeren makinece işlenebilir `structuredContent` ile döner. Tam farklar `generate_report` CSV çıktısında kalır. İstemciye göre render değişebilir; iki biçim de bağımsız olarak anlamlıdır ve yanıt 2 MB sınırını aşmaz.
- `compare_datasets`, `find_missing_records`, `detect_duplicates`, `detect_value_mismatches` ve `generate_report` araç adları/işlevleri geriye dönük korunur; çağrılar stateless kalır.

## Gizlilik, doğruluk ve sınırlar

- Hesaplamalar deterministiktir; finansal eşleştirmede AI yoktur. Veriler yalnız istek süresince bellekte işlenir; dosya, sonuç, tema veya kullanıcı verisi saklanmaz. Analitik/telemetri kapalı; gövde, değer, kimlik bilgisi ve sonuç loglanmaz. Vercel/GitHub sağlayıcı kayıtlarının uygulama denetimi dışındaki sınırları belgelerde açıklanır.
- PostgreSQL salt okunur TLS/parametreli sorgu/quoted identifier kullanır. REST yalnız HTTPS GET, açık host/port allow-list, redirect kapalı ve DNS pinleme ile çalışır. Keyfî SQL/shell/yüklenen kod çalıştırılmaz.
- Vercel payload ile uyumlu bütçe: dosya başına 4 MB; HTTP isteği bütçesi ekler dâhil 4,25 MB; kaynak başına 10.000 kayıt ve 100 sütun; 15 saniye; API yanıtı 2 MB. Aşım reddedilir, sessiz kırpma yapılmaz. XLSX ZIP açılışı ayrıca boyut/oran/sayıyla sınırlıdır.

## Tasarım kararı

- **Tasarım hareketi:** Finans operasyon araçlarının sakin, veri odaklı B2B dashboard estetiği; kullanıcının görsel referansı ana yönü belirler.
- **Temel ilkeler:** A/B kaynaklarının açık hiyerarşisi; sonuçta önce durum/özet, sonra ayrıntı; erişilebilir kontrast; her kontrol görünür ve işlevsel.
- **Renk yaklaşımı:** Açık temada beyaz/kırık beyaz yüzeyler ve mavi eylem; koyu temada derin gri yüzeyler ve aynı mavi vurgu. Başarı/uyuşmazlık/uyarı renkleri metin etiketi ve sayıyla birlikte kullanılır.
- **Yerleşim:** Üstte ürün/tema/MCP bağlantısı; altında yan yana iki kaynak kartı; altta responsive sonuç workspace'i, tablo/özet ve eylem alanı. Küçük ekranda tek sütun.
- **İmza öğeleri:** A/B kaynak kartları; kompakt metrik özeti; RUN üzerindeki kalın renk kuşağı; sekmeli sonuç tablosu.
- **Etkileşim:** Dosya seç/bırak → otomatik ortak anahtar ve ayarları doğrula → RUN → ilerleme/hata → sonuçlar/CSV. Sekmeler, arama ve yalnız-fark filtresi aynı gerçek sonucu kullanır. Tema geçişi yeniden yüklemede sıfırlanır.
- **Hareket:** Dosya bırakmada belirgin hafif ölçek/parıltı; açılır MCP penceresinde kısa opaklık/yükselme; RUN beklemesinde dönen işaret; sonuç sekmelerinde giriş; özet kartlarında kısa kademeli hareket. Hareket kısa olur, veri görünürlüğünü geciktirmez ve `prefers-reduced-motion` altında kapanır.
- **Tipografi:** UI ve başlıklarda Geist Variable; kod/ID alanlarında sistem monospace. Tablo ve yardımcı metinler kompakt ama okunaklıdır.
- **Marka özü:** “İki dosya. Net mutabakat.” — titiz, anlaşılır, güven veren.
- **Ses ve mikrocopy:** Kısa ve yönlendirici: “A dosyasını bırak”, “Farkları gör”.
- **Wordmark/işaret:** Geist ağırlık kontrastıyla Reconcile yazı işareti; `MCP` küçük ikincil etiket, harici illüstrasyon yok.
- **Vurgu rengi:** Kobalt mavi (`#2563EB`); RUN kenarında kalın mavi-mor-pembe-kehribar renk kuşağı ve üzerine gelince sınırlı glow.

## Proje yapısı

- `api/`: Vercel MCP ve reconcile functions.
- `src/core/`: karşılaştırma algoritması, ortak tipler, sınırlı sonuç önizlemesi ve Markdown/CSV raporu.
- `src/sources/`: Zod şemaları; CSV/XLSX, PostgreSQL/REST ve ağ/limit korumaları.
- `src/mcp/`: beş MCP aracı, yetenek kaynağı, workflow prompt'u ve yerel STDIO başlangıcı.
- `src/server/`: HTTP body parser, Streamable HTTP transport ve API handler'ları.
- `src/ui/`: dashboard akışı, A/B dropzone, sonuç tablosu, eşleme/tolerans ayarları, MCP Dialog ve tema/animasyon stilleri.
- `src/components/ui/`: Vite/Tailwind 3 uyumlu erişilebilir shadcn bileşenleri.
- `src/lib/`: shadcn bileşen yardımcıları.
- `tests/`: algoritma, parser, güvenlik/gizlilik, HTTP/MCP entegrasyon ve UI yardımcı testleri.
- `.github/workflows/quality.yml`: strict TypeScript, lint, test, production dependency audit ve build kalite kapısı.
- `public/manus-routes.json`: tek sayfa `/` rotası.

## DevOps ve yayın

Mevcut GitHub/Vercel bağlantısı korunur. Her push ve PR'da zorunlu kalite workflow'u; `main` yalnız başarılı `quality` kontrolü bulunan PR ile değişir. Vercel Git entegrasyonu production'u yalnız `main` commit'lerinde otomatik yayınlar, PR preview'larını SSO ile korur. Production deployment'ı sonrası ana sayfa/manifest, Streamable HTTP `initialize`, `tools/list`, `prompts/list`, `resources/list`, araç adları ve sentetik `compare_datasets` round-trip doğrulanır. Üretim anahtarı, kullanıcı datası veya gerçek dış kaynak bağlantısı testlerde kullanılmaz.
