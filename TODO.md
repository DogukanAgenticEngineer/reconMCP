# Reconcile MCP — Revize To-do

## 1. Referans dashboard ve erişilebilir tema — Uygulandı; preview ve production doğrulandı
- Kaynak A ve Kaynak B için ayrı, klavye ile de kullanılabilen CSV/XLSX sürükle-bırak veya dosya seçme alanları göster; seçilen dosyanın adı, boyutu, satır sayısı ve ortak alanları gerçek upload/inspect sonucundan gelsin, demo/fake veri gösterme.
- Ekli dashboard düzenini kullan: ürün/tema/MCP başlığı, iki dosya kartı, `Comparison`/`Differences`/`Summary` sekmeleri, gerçek karşılaştırma tablosu ve özet, görünür eylem alanı. Mobil görünüm tek sütunda çalışsın.
- Açık tema varsayılan olsun; çalışan bir anahtar açık ve koyu tema arasında geçiş yapsın. Tema yalnız bellekte tutulsun; `localStorage`, cookie veya profil verisi ekleme.
- A/B anahtarını ortak başlıklardan otomatik belirle: `id`, `uuid`, `key`, `record_id`, `invoice_id`, `transaction_id` gibi kimlik başlıklarını öncele; yoksa ilk ortak başlığı deterministik kullan; ortak başlık yoksa `RUN` etkin olmasın. Ekranda manuel key girişi gerektirme.
- `Ignore case (text)`, `Trim whitespace`, `Show only differences` kontrolleri gerçek karşılaştırma/render davranışını değiştirsin; çalışma ve hata durumu görünür olsun; yalnız-fark filtresi tablo satırlarını gerçekten süzsün.
- Sonuçta eşleşen, uyuşmayan, yalnız A/B'de olan, yinelenen ve şema farkı durumları erişilebilir etiket/sayıyla ayrılsın. Özet metrikleri gerçek motor sonucundan gelsin. CSV raporu tüm ilgili farkları kapsasın; ekranda gösterilen satır limiti varsa bu açıkça yazsın.
- MCP bağlantı düğmesi gerçek `/api/mcp` URL'sini panoya kopyalasın ve kopyalama başarısını bildirsin; harici istemciye gerçekten bağlandığı izlenimini vermesin. Başarı, hata, boş ve yükleniyor durumları açıkça ele alınsın.
- Radix Themes mevcut bileşenleriyle sade, responsive, erişilebilir UI kur; kontrastı, focus görünürlüğünü, klavye kullanımını, semantik tablo başlıklarını ve `aria-live` geri bildirimlerini koru. Gereksiz ikon/animasyon/dependency ekleme; Tailwind'i standart layout/styling için kullan.

## 2. Gerçek mutabakat sonucu ve MCP davranışı — Uygulandı; 29/29 yerel test ve production MCP round-trip geçti
- CSV, XLSX, salt okunur PostgreSQL ve REST API kaynaklarını destekle. Eksik kayıtları, yinelenen kayıtları, değer/tutar uyuşmazlıklarını ve şema tutarsızlıklarını belirle; doğru özet ve indirilebilir mutabakat raporu oluştur.
- TypeScript strict, resmi `@modelcontextprotocol/sdk`, Zod, Streamable HTTP ve yerel STDIO desteğini koru.
- `compare_datasets`, `find_missing_records`, `detect_duplicates`, `detect_value_mismatches`, `generate_report` araçlarını ve yapılandırılmış JSON/Markdown/structured MCP içeriğini koru; ChatGPT ve diğer MCP istemcileri ile uyumlu kal.
- Yeni dashboard için güvenilir `matchedKeys` özeti ve sınırlı gerçek kayıt/durum önizlemesi ekle; büyük key/value yüklerini yanıt sınırlarını aşacak şekilde çoğaltma. Metin case-sensitivity seçeneğini açıkça şemalaştır; mevcut MCP istemcilerinin varsayılan davranışını koru.
- Finansal hesaplamalar ve kayıt eşleştirmeleri deterministik olsun; AI kullanma.

## 3. Gizlilik, doğruluk ve kaynak sınırları — Korundu; sentetik yerel/CI güvenlik testleri geçti
- Yüklenen dosyaları, kaynak verileri veya sonuçları asla saklama; uygulamada veritabanı, kalıcı cache, kullanıcı/file storage, analytics, izleme, profilleme veya telemetri kullanma; veriyi bellekte işle ve bırak; harici AI sağlayıcılarına gönderme.
- İstek gövdesini, dosya içeriğini, kimlik bilgilerini veya hassas sonucu loglama; hatalarda/MCP yanıtlarında sırları gösterme; geçici dosya tutma; yalnız sentetik test verisi kullan.
- Altyapı sağlayıcı retention/logging sınırlarını şeffaf açıkla; doğrulanamayan mutlak sıfır retention veya GDPR/KVKK sertifikalı/garantili hukuki uyumluluk iddiası yapma.
- Parametreli salt okunur SQL, SSRF/DNS rebinding/ağ allow-list koruması, Zod doğrulaması, dış bağlantıda HTTPS, zararlı/çok büyük dosya ve XLSX ZIP bombası koruması, keyfî SQL/shell/yüklenen kod çalıştırmama ve en az ayrıcalığı koru.
- Kullanıcı onaylı bütçe: dosya başına 4 MB; tüm HTTP isteği ekler dâhil 4,25 MB; kaynak başına 10.000 satır ve 100 sütun; en çok 15 saniye; API yanıtı 2 MB. Aşımı reddet, sessizce kırpma.

## 4. CI/CD kalite kapısı — PR #5 kalite kapısı ve Vercel preview geçti; merge tamamlandı
- Her GitHub push ve PR'da strict TypeScript, ESLint, sentetik unit/integration, CSV/XLSX parser, karşılaştırma doğruluğu, güvenlik/girdi doğrulama, zero-retention/hassas log, HTTP ve MCP protocol testleri; production dependency audit ve Vite production build çalışsın.
- `main-ci-gate` PR ve required `Reconcile MCP CI / quality` koşulunu koru; testler başarısız veya beklemedeyken PR merge edilemesin. Vercel production yalnız kalite kontrolü geçmiş `main` merge'iyle otomatik deploy olsun; preview SSO koruması korunurken production MCP endpoint'i halka açık kalsın.
- Yeni UI/tema/filtre değişikliklerini GitHub PR kalite kapısından geçir, Vercel preview sonucunu kontrol et ve yalnız başarılı PR merge'iyle production'ı güncelle.

## 5. Yayın ve canlı doğrulama — Production READY; HTTPS ve MCP sentetik smoke check geçti
- Public repo `DogukanAgenticEngineer/reconMCP` ile mevcut `recon-mcp` Vercel Hobby projesini kullan; yeni paralel repo/proje oluşturma.
- CI/CD merge'i sonrasında `https://recon-mcp-dgn15.vercel.app` ve `/api/mcp` için yeni production deployment'ının `READY` olduğunu ve ana domainin doğru sürümü sunduğunu doğrula.
- Üretimde ana sayfa, `/manus-routes.json`, MCP `initialize`, `tools/list`, tüm beş araç adı ve sentetik `compare_datasets` round-trip kontrol edilsin; Vercel/Actions üretim logs, dosya veya gerçek müşteri verisiyle smoke test yapma.
- Öncelik sırası gizlilik, güvenlik, doğruluk, erişilebilirlik ve sadelik; ek özellik için güvenlik/gizlilikten ödün verme.
