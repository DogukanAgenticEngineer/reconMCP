# Reconcile MCP — Güncel To-do ve Teslim Durumu

## 1. Arayüzü istenen en sade biçime getir — Uygulandı ve doğrulandı
- Kaynak A ve Kaynak B için anahtar/metin kutusu yerine sürükle-bırak veya dosya seçimi kabul eden iki basit alan sun; yalnız CSV ve XLSX dosyalarını kabul et.
- Arayüz tamamen siyah tema ve beyaz yazı kullansın. A/B dosya alanları, ortak başlıklardan deterministik olarak otomatik seçilen eşleşme anahtarı, kısa sonuç özeti ve indirilebilir rapor dışında metin ve kontrol sayısını azalt; kullanıcıya anahtar alanı girişi/seçimi gösterme.
- Görünür eylem düğmesi tam olarak iki tane olsun: MCP endpoint'ini kopyalayan/bağlantı bilgisi sağlayan tek MCP düğmesi ve `RUN` adında tek karşılaştırma düğmesi. RUN düğmesinin kalın renk kuşağı biçimli border'ı, üzerine gelince glow efekti olsun.
- Gereksiz ikon, metin, animasyon, grafik ve dekoratif öğe kullanma. Arayüz erişilebilir, responsive ve kullanımı açık olsun. Yeni UI bileşeni/tasarım sistemi tasarlama; Radix Themes gibi mevcut kütüphane bileşenlerini kullan ve Tailwind'i yalnızca standart yerleşim/stil için uygula.
- Akış: iki dosyayı bırak/seç → ortak başlıklardan kimlik alanı olarak bilinen `id`/`uuid`/`key`/`record_id` vb. başlığa öncelik ver, yoksa ilk ortak başlığı deterministik anahtar seç → `RUN` → sonuç ve rapor. Ortak başlık yoksa çalıştırmayı güvenli biçimde engelle.

## 2. Deterministik mutabakat motoru ve MCP işlevleri — Uygulandı ve doğrulandı
- CSV, Excel (XLSX), salt okunur PostgreSQL ve REST API kaynaklarını destekle. Eksik kayıtları, yinelenen kayıtları, değer/tutar uyuşmazlıklarını ve şema tutarsızlıklarını belirle; anlaşılır özet ve indirilebilir mutabakat raporu oluştur.
- TypeScript strict, resmi `@modelcontextprotocol/sdk`, Zod, Streamable HTTP ve yerel STDIO kullan.
- `compare_datasets`, `find_missing_records`, `detect_duplicates`, `detect_value_mismatches`, `generate_report` MCP araçlarını sun; yapılandırılmış JSON, okunabilir Markdown özeti ve structured MCP content döndür; ChatGPT ve diğer MCP uyumlu istemcileri destekle.
- Hesaplamalar deterministik olsun; finansal hesaplama veya kayıt eşleştirmede AI kullanma.

## 3. Gizlilik, güvenlik ve kaynak sınırları — Uygulandı ve test edildi
- Yüklenen dosya, kaynak verisi ve sonuçları asla saklama; veritabanı, kalıcı önbellek, kullanıcı verisi/file storage, analitik, izleme, profilleme veya telemetri kullanma; veriyi bellekte işle ve hemen bırak; harici AI sağlayıcısına veri gönderme.
- İstek gövdelerini, dosya içeriklerini, kimlik bilgilerini veya hassas sonuçları loglama; hatalarda/MCP yanıtlarında sırları açığa çıkarma; geçici dosya tutma; yalnız sentetik test verisi kullan.
- Altyapı sağlayıcısı loglama ve retention sınırlarını açıkça belgele; doğrulanamayan mutlak sıfır saklama, GDPR/KVKK sertifikası veya garantili hukuki uyumluluk iddia etme. Gizlilik tasarımı ve veri minimizasyonunu uygula.
- Parametreli salt okunur SQL; SSRF/DNS rebinding/ağ allow-list koruması; Zod doğrulaması; dış bağlantıda HTTPS; kötü amaçlı ve aşırı büyük dosya/ZIP bombası koruması; keyfî SQL, shell komutu veya yüklenen kod çalıştırmama; en az ayrıcalık.
- Kullanıcı onaylı Vercel sınırı: tek dosya 4 MB, HTTP isteğinin tamamı ek yük dâhil 4,25 MB; kaynak başına 10.000 satır ve 100 sütun; azami 15 saniye; API yanıtı 2 MB. Aşımı reddet, sessizce kırpma.

## 4. Test/CI/CD kalite kapısı — GitHub'da etkin ve PR ile doğrulandı
- Vitest unit ve integration, MCP protokol, CSV/XLSX parser, mutabakat doğruluğu, güvenlik/girdi doğrulama, sıfır-saklama/hassas log kontrolleri; TypeScript strict, ESLint, üretim dependency audit ve production build.
- GitHub Actions her push ve pull request'te çalışır. GitHub'daki etkin `main-ci-gate` ruleset `main` değişikliğini PR ile sınırlar, `Reconcile MCP CI` workflow'unun `quality` kontrolünü şart koşar ve bypass aktörü tanımlamaz. PR değişiklikleri zorunlu kontroller başarılı olduktan sonra squash-merge edildi.
- MIT `LICENSE`, `README.md`, `PRIVACY.md`, `SECURITY.md`, `DATA_RETENTION.md`, `THREAT_MODEL.md`, `.env.example` dosyalarını teslim et; kurulum/deployment/MCP bağlantısı/gizlilik sınırlarını belgele.

## 5. GitHub ve Vercel — Production yayında ve doğrulandı
- Açık kaynak uygulama `DogukanAgenticEngineer/reconMCP` public GitHub deposunda; GitHub Actions ve korumalı `main` kuralları etkin.
- Vercel Hobby'de `recon-mcp` projesi GitHub `main` branch'ine bağlı; production deployment `READY`. Production web uygulaması: https://recon-mcp-dgn15.vercel.app; herkese açık MCP endpoint'i: https://recon-mcp-dgn15.vercel.app/api/mcp. Vercel SSO yalnız preview deployment'larında korunur.
- Production smoke testleri: ana sayfa ve `/manus-routes.json` HTTP 200; MCP `initialize`, `tools/list` ve `compare_datasets` çağrısı HTTP 200. Sentetik 1 satır karşılaştırmasında beklenen tek tutar uyuşmazlığı raporlandı.
- İskelet/maketle yetinme. Son öncelik sırası: gizlilik, güvenlik, doğruluk, sadelik; ek özellik uğruna gizlilik/güvenlikten ödün verme.
