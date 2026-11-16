# Reconcile MCP — Geliştirme To-do

## 1. Sektör standardı dashboard, erişilebilirlik ve animasyonlar — Yerel uygulama tamamlandı; PR/production doğrulaması bekliyor
- Kaynak A ve Kaynak B için ayrı, klavye ile de kullanılabilen CSV/XLSX sürükle-bırak veya dosya seçme alanları göster; seçilen dosyanın adı, boyutu, satır sayısı ve ortak alanları gerçek upload/inspect sonucundan gelsin, demo/fake veri gösterme.
- Dashboard'da ürün/tema/MCP başlığı, iki kaynak kartı, `Comparison`/`Differences`/`Summary` sekmeleri, gerçek karşılaştırma tablosu ve özeti, görünür eylem alanı bulunsun. `CONNECT MCP` ve `RUN` iki ana eylem olarak açıkça ayrışsın; gerekli kopyalama/eşleme kontrolleri dışında dekoratif buton ekleme. Mobil görünüm tek sütunda çalışsın.
- Açık tema varsayılan olsun; çalışan bir anahtar açık ve koyu tema arasında geçiş yapsın. Tema yalnız bellekte tutulsun; `localStorage`, cookie veya kalıcı profil verisi ekleme.
- Erişilebilir `shadcn/ui` bileşen düzeni kullan; Button, Card, Badge, Input, Label, Select, Tabs, Switch, Dialog ve Table gibi sektör-standardı bileşenler olsun. Mevcut Vite + Tailwind 3 ile uyumlu tut; yalnız gerekli paketleri ekle, gereksiz ikon/animasyon kütüphanesi veya harici veri servisi ekleme.
- Renk/durum etiketlerinde kontrastı, klavye kullanımını, görünür focus'u, semantik tablo başlıklarını ve `aria-live` geri bildirimlerini koru. Renk tek başına anlam taşımasın.
- Dosya bırakma, çalışma göstergesi, sonuç paneli ve metrik kartları için basit ama fark edilir, kısa animasyonlar kullan; `prefers-reduced-motion: reduce` tercihini destekle ve animasyonun içeriği geciktirmesine/gizlemesine izin verme.
- `RUN` düğmesinde kalın çok renkli border kuşağı ve hover/focus glow efekti olsun. `CONNECT MCP` endpoint URL'sini açıkça gösterip kopyalayabilsin; uygulamanın harici istemciyi zaten bağladığını iddia etme.

## 2. Güçlü ve deterministik mutabakat akışı — Yerel uygulama tamamlandı; CI/production doğrulaması bekliyor
- A/B anahtarını ortak başlıklardan otomatik belirle: `id`, `uuid`, `key`, `record_id`, `invoice_id`, `transaction_id` gibi kimlik başlıklarını öncele; yoksa ilk ortak başlığı deterministik kullan; ortak başlık yoksa RUN etkin olmasın. Kullanıcı otomatik seçimi arayüzden değiştirebilsin ve 1–10 alan çiftiyle bileşik anahtar kurabilsin.
- Başlıklar farklı adlandırıldığında A alanını B alanıyla manuel eşleyebilsin; seçilen anahtar çiftleri karşılaştırma alanı olarak yinelenmesin; en fazla 100 karşılaştırma alan çifti gönderilsin.
- `Ignore case (text)` ve `Trim whitespace` ayarları gerçek karşılaştırma davranışını değiştirsin; varsayılanlar geriye dönük davranışı korusun.
- Sayısal değerler için kullanıcı decimal toleransı ayarlayabilsin; değer sıfırdan büyük/ona eşit, güvenli biçimde doğrulanmış metin olsun ve kayan nokta yuvarlama hatasına yol açmasın. Boş bırakıldığında mevcut kesin karşılaştırma kuralı geçerli olsun.
- Sonuç tablosunda anahtar/değer araması ve durum filtresi olsun; `match`, `mismatch`, `only in A`, `only in B` ve `duplicate` sonuçlarını gerçek karşılaştırma verisinden süzsün. Karşılaştırma önizlemesi anahtar yanında eşleşen alan/değerlerde de arama yapabilsin. Sonuç sayısı, arama eşleşme sayısı ve boş durumlar açıkça gösterilsin.
- Sonuçta eşleşen, uyuşmayan, yalnız A/B'de olan, yinelenen ve şema farkı durumları erişilebilir etiket/sayıyla ayrılsın. Özet metrikleri gerçek motor sonucundan gelsin. CSV raporu tüm ilgili farkları kapsasın; ekranda gösterilen satır limiti varsa açıkça yazsın.
- Finansal hesaplamalar ve kayıt eşleştirmeleri deterministik olsun; AI kullanma.

## 3. MCP entegrasyonu ve istemci çıktısı — Yerel uygulama ve protokol testleri tamamlandı; CI/production doğrulaması bekliyor
- `/api/mcp` stateless Streamable HTTP endpoint'i ve yerel STDIO desteği korunsun. `compare_datasets`, `find_missing_records`, `detect_duplicates`, `detect_value_mismatches`, `generate_report` araçlarının adları ve mevcut çağrıları geriye dönük uyumlu kalsın.
- MCP sunucusu istemcilerin keşfedebileceği statik bir yetenek/kullanım kaynağı ve karşılaştırma/rapor oluşturma için MCP prompt şablonu sunsun; bu kaynak/prompt örnekleri sentetik olsun, kullanıcı verisini saklamasın.
- `CONNECT MCP` arayüzü gerçek ortam `/api/mcp` endpoint'ini, `Streamable HTTP` taşıma türünü, mevcut araç adlarını ve istemci bağlantı/yapılandırma bilgisini erişilebilir Dialog'da göstersin; gerçek URL panoya kopyalansın, kullanıcıya harici MCP istemcisine zaten bağlandığı izlenimi verilmesin.
- Claude/ChatGPT ve benzeri MCP istemcilerine verilecek tool sonuçları yalnız düz paragraf olmasın: başlıklar, kısa özet, temel metrik tablosu, durum etiketleri ve sınırlandırılmış fark tabloları olan okunabilir Markdown metni ile aynı sonucun makinece okunabilir `structuredContent` değerlerini birlikte sun. İstemcinin Markdown'ı nasıl göstereceği değişebilir; her iki biçim de tek başına anlamlı kalsın. Geniş veri yanıtını 2 MB sınırında tut; tam farkları CSV raporunda koru.
- JSON structured output, okunabilir Markdown özeti ve yapılandırılmış MCP içeriğini koru; ChatGPT ve diğer MCP istemcileri ile uyumluluk testlerini sürdür.

## 4. Gizlilik, doğruluk ve kaynak sınırları — Mevcut korumalar sürüyor; yerel test/audit geçti, CI yeniden doğrulayacak
- Yüklenen dosyaları, kaynak verileri veya sonuçları asla saklama; uygulamada veritabanı, kalıcı cache, kullanıcı/file storage, analytics, izleme, profilleme veya telemetri kullanma; veriyi bellekte işle ve bırak; harici AI sağlayıcılarına gönderme.
- İstek gövdesini, dosya içeriğini, kimlik bilgilerini veya hassas sonucu loglama; hatalarda/MCP yanıtlarında sırları gösterme; geçici dosya tutma; yalnız sentetik test verisi kullan.
- Altyapı sağlayıcı retention/logging sınırlarını şeffaf açıkla; doğrulanamayan mutlak sıfır retention veya GDPR/KVKK sertifikalı/garantili hukuki uyumluluk iddiası yapma.
- Parametreli salt okunur SQL, SSRF/DNS rebinding/ağ allow-list koruması, Zod doğrulaması, dış bağlantıda HTTPS, zararlı/çok büyük dosya ve XLSX ZIP bombası koruması, keyfî SQL/shell/yüklenen kod çalıştırmama ve en az ayrıcalığı koru.
- Kullanıcı onaylı bütçe: dosya başına 4 MB; tüm HTTP isteği ekler dâhil 4,25 MB; kaynak başına 10.000 satır ve 100 sütun; en çok 15 saniye; API yanıtı 2 MB. Aşımı reddet, sessizce kırpma.

## 5. CI/CD kalite kapısı — Repo koruması mevcut; yeni özellikler PR'da doğrulanacak
- Her GitHub push ve PR'da strict TypeScript, ESLint, sentetik unit/integration, CSV/XLSX parser, karşılaştırma doğruluğu, güvenlik/girdi doğrulama, zero-retention/hassas log, HTTP ve MCP protocol testleri; production dependency audit ve production build çalışsın.
- `main-ci-gate` PR ve required `Reconcile MCP CI / quality` koşulunu koru; testler başarısız veya beklemedeyken PR merge edilemesin. Vercel production yalnız kalite kontrolü geçmiş `main` merge'iyle otomatik deploy olsun; preview SSO koruması korunurken production MCP endpoint'i halka açık kalsın.
- Yeni MCP/kullanıcı eşleştirme/arama/filtre/shadcn/animasyon değişikliklerini GitHub PR kalite kapısından geçir, Vercel preview sonucunu kontrol et ve yalnız başarılı PR merge'iyle production'ı güncelle.

## 6. Yayın ve canlı doğrulama — Yeni PR/production yayını açık
- Public repo `DogukanAgenticEngineer/reconMCP` ile mevcut `recon-mcp` Vercel Hobby projesini kullan; yeni paralel repo/proje oluşturma.
- CI/CD merge'i sonrasında `https://recon-mcp-dgn15.vercel.app` ve `/api/mcp` için yeni production deployment'ının `READY` olduğunu ve ana domainin doğru sürümü sunduğunu doğrula.
- Üretimde ana sayfa, `/manus-routes.json`, MCP `initialize`, `tools/list`, `prompts/list`, `resources/list`, tüm beş araç adı ve sentetik `compare_datasets` round-trip kontrol edilsin; Vercel/Actions production logs, dosya veya gerçek müşteri verisiyle smoke test yapma.
- Öncelik sırası gizlilik, güvenlik, doğruluk, erişilebilirlik ve sadelik; ek özellik için güvenlik/gizlilikten ödün verme.

## Yerel doğrulama kanıtı
- Son çalıştırmada strict typecheck, ESLint, production dependency audit ve production build geçti; audit yüksek riskli bilinen zafiyet bildirmedi.
- 34/34 test geçti; testler sentetik içerik ve resmi MCP Streamable HTTP istemcisiyle tool/resource/prompt keşfi, güvenli Markdown/structuredContent çıktısı, saldırgan Markdown içeriklerinin etkisizleştirilmesi ve geniş field mapping'leri içeren muhafazakâr multipart boyut hesabını kapsıyor.
- Geliştirme sunucusu ana sayfayı, `/manus-routes.json` ve değişen UI modüllerini HTTP 200 ile sundu; production/CI doğrulaması henüz yapılmadı.
