# Reconcile MCP — Threat Model

## Güven sınırı ve varlıklar

Tarayıcı veya MCP istemcisi güvenilmez girdi kaynağıdır. Vercel Function girdiyi belleğe alır; REST/PostgreSQL sunucuları ayrı güven sınırıdır; host/port allow-list işletmeci denetimindedir. Korunacak varlıklar: istemcinin aktardığı müşteri kayıtları, dosyalar, API/DB credential'ları, function kapasitesi ve sonuç bütünlüğü. Uygulama kalıcı veri katmanı içermez.

| Tehdit | Önlem | Kalan risk |
|---|---|---|
| Sahte/bozuk CSV veya XLSX, ZIP bombası, çok büyük hücre | UTF-8 parser; byte/record/cell limitleri; ZIP entry/toplam açılım/ratio sınırı; memory-only parse | Parser kütüphaneleri yine zafiyet alabilir; yeni sürüm takibi ve test gerekir. |
| SQL injection / yazma | Kullanıcı SQL metni yok; schema/table/column quoted identifiers; `SELECT` ve parameterized `LIMIT`; read-only transaction/TLS | Bağlantı hesabı aşırı DB iznine sahipse DB tarafı riskini uygulama tamamen ortadan kaldıramaz; ayrı salt-okunur rol zorunlu. |
| SSRF / DNS rebinding / redirect / port scan | Exact hostname allow-list; private/reserved IP reddi; tüm DNS cevaplarını doğrula ve seçili public IP'yi pinle; REST yalnız HTTPS:443, redirect kapalı; PG port env allow-list (default 5432) | İzin verilen public hedefte açık hizmet/operator DNS değişikliği kalabilir; allow-list ve dış firewall doğru yönetilmelidir. |
| Sahte MCP/HTTP payload ve XSS | Zod strict schema; metin React text node olarak gösterilir; CSP; `no-store`, `nosniff`; JSON/form gövdesi ve yanıt limitleri | Kamuya açık endpoint istenerek çağrılabilir; CORS tek başına kimlik doğrulama değildir. |
| Kimlik bilgisi veya içerik log/saklama sızıntısı | Uygulama logları yok; generic hata metni; telemetry/analytics kapalı; file/database writes yok; yalnız synthetic test | Vercel/GitHub/ISP/platform log ve retention uygulamasını uygulama kontrol etmez; açık ağdaki hizmetler kendi kayıtlarını tutabilir. |
| Büyük istek/DoS veya hosting maliyet/kota tüketimi | 4 MB file, 4,25 MB raw request, 10k row, 100 columns, 15s, 2 MB response, 2 MB REST caps | Uygulama düzeyinde kimlik doğrulama veya dağıtık rate limiting yok; Vercel plan kotası/edge abuse koruması değişebilir. |
| Excel formül enjeksiyonu | CSV export'ta formül başlatabilecek metin alanlarına apostrof eklenir | CSV dışa aktarılan dosya başka yazılıma aktarılırken biçim davranışı değişebilir; kullanıcının indirme/yayımlama sorumluluğu sürer. |
| Yanlış mutabakat sonucu | Decimal.js exact base-10 tolerance; deterministic normalization; sentetik doğruluk testleri; orijinal input görünümü | Tarih/bölgesel sayı/iş kuralı semantiği kaynak sistemlere göre farklı olabilir; kullanıcı alan eşlemesini ve toleransı doğrulamalı. |

## Varsayımlar ve kapsam dışı

Kaynak sahibi allow-list'e bilerek eklenmiş hostun ilgili tabloda/REST endpoint'inde izin verilen veriyi döndürmesine yetki vermiştir; veritabanı hesabı read-only ve en az ayrıcalıklıdır. Sunucu tarafından iletilen credentials kullanıcı tarafından sağlanır. Bu araç kimlik/tenant yönetimi, güvenilir referans verisi veya muhasebe işlemlerini onaylamaz; SQL çalıştırmaz ve sonuçları hukuki/finansal sertifika sayılmaz. Vercel ve GitHub altyapısının veri saklama/güvenlik kontrolleri sağlayıcı sözleşmeleri/ayarları dahilindedir, bu threat model tarafından doğrulanamaz.
