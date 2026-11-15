# Reconcile MCP — Uygulama Planı

## Amaç ve mimari

CSV/XLSX karşılaştırması için web çalışma alanı ve CSV/XLSX/PostgreSQL/REST kaynakları için aynı deterministik TypeScript motorunu kullanan MCP hizmeti. Vercel production yüzeyi statik Vite arayüzü, file-backed `/api/reconcile` işlemi ve resmi SDK Streamable HTTP `/api/mcp` fonksiyonudur; yerel çalışma için STDIO da vardır. Web UI'da yalnız iki dosya bırakma alanı bulunur; PostgreSQL ve REST, temel ekranı ağırlaştırmadan MCP arayüzünden kullanılabilir. Veri tabanı, kalıcı file/object storage, persistent cache, kullanıcı hesabı ve dış AI yoktur. İstek başına veri yalnız bellekte kullanılır; sağlayıcı log/retention uygulaması ayrıca sınırlandırılarak belgelenir.

## Ürün yaklaşımı

- Kaynak A ve B için yalnız CSV/XLSX seçebilen iki sürükle-bırak/dropzone alanı göster. Anahtarı kullanıcıya seçtirtme: ortak başlıklarda `id`/`uuid`/`key`/`record_id`/`invoice_id`/`transaction_id` gibi kimlik başlıklarını öncele, yoksa ilk ortak başlığı deterministik seç; ortak başlık yoksa çalıştırmayı engelle. Diğer ortak başlıkları değer alanı olarak karşılaştır.
- `RUN` düğmesi karşılaştırmayı başlatır; sonuç özeti ve uyuşmazlık tablosu gösterilir. CSV raporu eylem düğmesi değil, bağlantı/indirme anchor'ı olur.
- `MCP` düğmesi çalışan sunucuya bağlanma URL'sini (`window.location.origin + '/api/mcp'`) panoya kopyalar. Kullanıcıya görünür eylem düğmeleri yalnız bunlar ve `RUN`'dır.
- Uygulama kökten siyah, metinler beyaz; kontrast/erişilebilirlik korunur. `RUN` düğmesinde kalın renk kuşağı border ve yalnız hover/focus durumunda glow kullanılır; hareket azaltma tercihi glow geçişini bastırır.
- Radix Themes'in mevcut `Button`, `Card`, `Table`, `Text`, `Heading` bileşenleri kullanılır; yeni component kütüphanesi veya gereksiz ikon yoktur. Görünür eylem düğmesi yalnız iki tanedir. Tailwind yalnız yaygın layout/styling için kullanılır; özel tasarım sistemi oluşturulmaz.
- Tüm karşılaştırmalar deterministiktir. İstemciye yükleme sınırları, çalışma süresi ve gizlilik hakkında yalnız gerekli kısa microcopy gösterilir.

## Uygulama ve güvenlik kararları

- Strict TypeScript, Zod, resmi `@modelcontextprotocol/sdk`, CSV/XLSX parser, `pg` ve `pg-query-stream` kullanılır. MCP araçları `compare_datasets`, `find_missing_records`, `detect_duplicates`, `detect_value_mismatches`, `generate_report` olup JSON/structuredContent ve Markdown döndürür.
- PostgreSQL için yalnız TLS, salt okunur transaction, quoted identifiers, seçili sütunlar, parametreli limit ve bağlantı/query timeout; keyfî SQL çalıştırma yok. REST yalnız HTTPS GET, redirect kapalı, exact host allow-list, DNS public-IP doğrulama ve resolve-IP pinleme.
- Zod doğrulaması ve dosya/gövde/kayıt/column/response/time limitleri. Kullanıcı onayıyla dosya başına en çok 4 MB, ek yük dahil HTTP request başına 4,25 MB; kaynak başına 10.000 kayıt ve 100 sütun; en çok 15 saniye; response 2 MB. XLSX ZIP açılışı da giriş sayısı, toplam boyut, entry boyutu ve compression ratio ile sınırlanır. Aşımda request reddedilir, sessiz kırpma olmaz.
- Uygulama loglarında gövde/credential/sonuç yok; veri yazımı yok; browser local storage yok; analytics/telemetry kapalı. Testler yalnız sentetik veri kullanır ve log/storage kısıtlarını statik olarak kontrol eder. Uygulama verisini üçüncü taraf AI'ye iletme yok.

## Tasarım kararı

- **Tasarım hareketi:** Kullanıcının açıkça istediği yüksek kontrastlı, tek işli veri çalışma yüzeyi; saf siyah zemin ve beyaz metin.
- **Temel ilkeler:** A/B anında anlaşılır; iki eylemle tamamlanır; sonuç görünür ve indirilebilir; görsel gürültü yok.
- **Renk yaklaşımı:** Siyah ve beyaz temel kontrasttır; doygun renkler yalnızca RUN düğmesinin kalın kuşaklı kenarında vurgu oluşturur.
- **Yerleşim:** Tek ana panelde A ve B dosya alanı, otomatik ortak başlık/anahtar bilgisi ve tek RUN eylemi; mobilde düşey sıralama.
- **İmza öğeleri:** İki eşit A/B dropzone; tek renk-kuşağı RUN düğmesi; sade sonuç sayıları/tablosu.
- **Etkileşim:** Dosyayı bırak/seç; kimlik başlığı deterministik otomatik bulunur; RUN; sonuç/CSV raporu. MCP düğmesi endpoint'i kopyalar. Anahtar girişi/seçimi, gereksiz modal/tabs yok.
- **Animasyon:** Yalnız RUN hover/focus glow; `prefers-reduced-motion` durumunda geçiş kapalı.
- **Tipografi:** Radix Themes sistem yazı tipi; başlık ve kısa etiketler, paragraf metnini minimumda tut.
- **Marka özü:** “İki dosya. Net mutabakat.” — titiz, sade, güven veren.
- **Ses ve örnek mikrocopy:** Kısa ve işlevsel: “A dosyasını bırak”, “B dosyasını bırak”.
- **Wordmark/işaret:** Özel ikon ve logo sistemi yok; yalnız metinsel ad kullanılır.
- **Vurgu rengi:** Marka paleti icat edilmez; renk yalnızca istenen RUN kenarında gradient olarak görünür.

## Proje yapısı

- `api/`: Vercel function'ları (`mcp.ts`, `reconcile.ts`).
- `src/core/`: karşılaştırma algoritması, ortak tipler ve rapor.
- `src/sources/`: Zod şemaları; CSV/XLSX, PostgreSQL/REST parser/loader; ağ/limit korumaları.
- `src/mcp/`: ortak MCP tool tanımları ve yerel STDIO giriş noktası.
- `src/server/`: HTTP body parse, `/api/reconcile`, `/api/mcp` handlers ve Vite yerel sunucusu.
- `src/ui/`: tek-screen dosya drop, otomatik ortak anahtar, RUN, sonuç/CSV linki.
- `tests/`: sentetik compare, parser, security/privacy, HTTP ve MCP protocol tests.
- `.github/workflows/quality.yml`: typecheck, lint, test, production audit, build kalite kapısı.
- `public/manus-routes.json`: tek sayfa `/` rotası.

## DevOps ve dağıtım

Node 22 ve pnpm 11.25.0 sabitlenir; lifecycle/build izinleri workspace yapılandırmasında tutulur. GitHub deposu public/MIT kaynak kodu için kullanılır, her push/PR CI çalıştırır. `main` için gerekli check/PR koruması Vercel production deployment'ını yalnız başarılı CI commit'lerinde başlatacak şekilde ayarlanır. Vercel Git bağlantısı Vite build'i (`pnpm install --frozen-lockfile`, `pnpm build`, `dist`) ve `/api/*` functions'ı deploy eder. Analytics kapalı kalır. Production ana sayfa, public HTTPS `/api/mcp` initialize/tools-list ve en az bir sentetik tool round-trip doğrulandıktan sonra teslim tamamlanır. Vercel'in ücretsiz katman payload ve log/retention sınırları dokümantasyonda belirtilir.
