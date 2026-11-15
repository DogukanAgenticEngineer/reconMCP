# Reconcile MCP — Güncellenmiş Uygulama Planı

## Amaç ve mimari

Mevcut Vite/React uygulamasını üretimdeki deterministik karşılaştırma motoruna ve resmi MCP sunucusuna bağlı, gerçek dosyalarla çalışan bir mutabakat dashboard'una dönüştür. Vercel'de statik arayüz, `/api/reconcile` serverless işlevi ve Streamable HTTP `/api/mcp` endpoint'i kalır; yerel STDIO desteği korunur. PostgreSQL ve REST bağlantıları web ekranını sade tutmak için MCP üzerinden kullanılabilir.

## Ürün ve etkileşim

- Kullanıcının son eklediği dashboard görseli tasarım referansıdır. Arayüzde üst başlık/bağlantı alanı, iki kaynak kartı, sonuç sekmeleri, özet metrikleri, karşılaştırma/farklar tablosu ve eylem alanı bulunur.
- A ve B için erişilebilir sürükle-bırak veya dosya seçimi: yalnız CSV/XLSX; dosya adı, boyutu, satır sayısı ve sütunlar görünür. Dosya başına 4 MB, istek toplamı ekler dâhil 4,25 MB sınırı kullanıcıya kısa ve doğru biçimde gösterilir.
- Ortak kimlik başlığı otomatik seçilir; `id`/`uuid`/`key`/`record_id`/`invoice_id`/`transaction_id` gibi adlar önce gelir, yoksa ilk ortak başlık deterministik seçilir. Kullanıcıya manuel anahtar girişi gösterilmez; ortak alan yoksa RUN devre dışı kalır.
- Açık tema (varsayılan, ekli referansa yakın) ve koyu tema arasında erişilebilir bir geçiş ekle. Tema durumu yalnız uygulama belleğinde tutulur; `localStorage`, cookie veya kalıcı profil yoktur.
- `Comparison`, `Differences`, `Summary` sekmeleri gerçek API sonucunu gösterir. Özet: eşleşen anahtarlar, eksik kayıtlar, yinelenen anahtarlar, değer farkları ve şema farkları. Tablo, eşleşen/farklı/yalnız A/yalnız B/yinelenen kayıt durumları için sunucudan dönen sınırlandırılmış gerçek karşılaştırma önizlemesini; ayrıntı sekmesi ise fark alanlarını ve A/B değerlerini gösterir. Demo/fake veri kullanılmaz; görünür satır sayısı ve rapor kapsamı ayrımı açıkça belirtilir.
- Ayarlar işlevsel olmalı: metinde büyük/küçük harfi yok sayma; baş/son boşlukları kırpma; karşılaştırma tablosunda yalnız farkları gösterme. Varsa tolerans açıkça belirtilir; varsayılan mevcut deterministik motor davranışını bozmaz.
- `RUN` geçersiz/yüklenmekte olan girdide devre dışıdır; bekleme, hata, boş sonuç ve başarılı sonuç durumları açıkça gösterilir. CSV raporu tam sonuç için indirme bağlantısı sunar. MCP düğmesi `/api/mcp` adresini panoya kopyalar; harici istemcide bağlı olduğu izlenimini vermez.
- `@radix-ui/themes` mevcut bileşenleri kullan; yeni UI kütüphanesi, gereksiz ikon veya veri gönderen dış servis ekleme. Tailwind yalnızca standart layout/styling'de kullanılır. Mobilde kaynak kartları ve sonuç alanı tek sütuna düşer. Klavye erişimi, görünür focus, WCAG uyumlu kontrast, tablo başlıkları, metinle desteklenen durum etiketleri ve `aria-live` geri bildirim uygula.

## Gizlilik, doğruluk ve sınırlar

- Tüm hesaplamalar deterministiktir; finansal eşleştirme/veride AI yok. Yüklenen/verilen veri yalnız isteğin belleğinde işlenir; dosya, sonuç, tema veya kullanıcı verisi saklanmaz. Analitik/telemetri kapalı; gövde, değer, kimlik bilgisi ve sonuç loglanmaz. Vercel/GitHub sağlayıcı kayıtlarının uygulama denetimi dışındaki sınırları belgelerde açıklanır.
- PostgreSQL salt okunur TLS/parametreli sorgu/quoted identifier kullanır. REST yalnız HTTPS GET, açık host/port allow-list, redirect kapalı ve DNS pinleme ile çalışır. Keyfî SQL/shell/yüklenen kod çalıştırılmaz.
- Vercel Free/Hobby payload ile uyumlu kullanıcı onaylı bütçe: dosya başına 4 MB; HTTP isteği bütçesi ekler dâhil 4,25 MB; kaynak başına 10.000 kayıt ve 100 sütun; 15 saniye; API yanıtı 2 MB. Aşım reddedilir, sessiz kırpma yapılmaz. XLSX ZIP açılışı ayrıca boyut/oran/sayıyla sınırlanır.

## Tasarım kararı

- **Tasarım hareketi:** Finans operasyon araçlarının sakin, veri odaklı B2B dashboard estetiği; yeni eklenen kullanıcı referansı ana yönü belirler.
- **Temel ilkeler:** A/B açık hiyerarşisi; sonuçta önce durum/özet, sonra ayrıntı; erişilebilir kontrast; her kontrol görünür ve gerçekten işlevsel.
- **Renk yaklaşımı:** Açık temada beyaz/kırık beyaz yüzeyler ve mavi eylem; koyu temada derin gri yüzeyler ve aynı mavi vurgu. Başarı/uyuşmazlık/uyarı renkleri etiket ve sayı ile birlikte kullanılır; renk tek başına anlam taşımaz.
- **Yerleşim:** Üstte ürün/tema/MCP bağlantısı; hemen altında yan yana iki kaynak kartı; altta responsive sonuç workspace'i, tablo/özet ve eylem paneli. Küçük ekranda tek sütun.
- **İmza öğeleri:** A/B kaynak kartları; kompakt dört-beş metrik özeti ve durum dağılımı; sekmeli sonuç tablosu.
- **Etkileşim:** Dosya seç/bırak → otomatik ortak anahtar ve ayarları doğrula → RUN → ilerleme/hata → sonuçlar/CSV. Sekmeler ve yalnız-fark filtresi aynı gerçek sonuç kümesini kullanır. Tema switch'i sayfa yeniden yüklemesinde sıfırlanır (kalıcı saklama yok).
- **Hareket:** Yalnız kısa hover/focus geçişleri ve upload durum geri bildirimi; `prefers-reduced-motion` etkin olduğunda geçiş kapalı.
- **Tipografi:** Radix Themes sistem yazı tipi; başlık ve tablo etiketleri belirgin, yardımcı metin kısa.
- **Marka özü:** “İki dosya. Net mutabakat.” — titiz, anlaşılır, güven veren.
- **Ses ve mikrocopy:** Kısa ve yönlendirici: “A dosyasını bırak”, “Farkları gör”.
- **Wordmark/işaret:** Mevcut metinsel Reconcile MCP adı; harici ikon/illustrasyon gereksiz.
- **Vurgu rengi:** Mavi eylem rengi, statü renkleri yalnız semantik anlamda.

## Proje yapısı

- `api/`: Vercel MCP ve reconcile functions.
- `src/core/`: karşılaştırma algoritması, ortak tipler, sınırlı sonuç önizlemesi ve CSV raporu.
- `src/sources/`: Zod şemaları; CSV/XLSX, PostgreSQL/REST ve ağ/limit korumaları.
- `src/mcp/`: ortak MCP araçları ve yerel STDIO başlangıcı.
- `src/server/`: HTTP body parser ve `/api/reconcile`/`/api/mcp` handler'ları.
- `src/ui/`: A/B dropzone, light/dark dashboard, gerçek sonuç sekmeleri/filtreleri ve report indirme.
- `tests/`: deterministik algoritma, parser, güvenlik/gizlilik, HTTP/MCP entegrasyon testleri.
- `.github/workflows/quality.yml`: strict TypeScript, lint, test, production dependency audit ve build kalite kapısı.
- `public/manus-routes.json`: tek sayfa `/` rotası.

## DevOps ve yayın

Mevcut GitHub/Vercel bağlantısını koru. Her push ve PR'da zorunlu kalite workflow'u; `main` yalnız başarılı `quality` kontrolü bulunan PR ile değişsin. Vercel Git entegrasyonu production'u yalnız `main` commit'lerinde otomatik yayınlasın, PR preview'larını SSO ile korusun. Production deploy sonrası ana sayfa/manifest, Streamable HTTP `initialize`, `tools/list` ve sentetik `compare_datasets` round-trip HTTP ile doğrulansın. Üretim anahtarı, kullanıcı datası veya gerçek dış kaynak bağlantısı testlerde kullanılmasın.
