# Güvenlik Politikası

## Bildirim

Gerçek müşteri verisi veya credential içermeyen, mümkün olan en küçük yeniden üretim adımlarıyla güvenlik açığını GitHub deposundaki **Security → Report a vulnerability** üzerinden özel advisory olarak bildirin. Güvenlik açığını herkese açık issue, commit, ekran görüntüsü veya veri içeren log ile yayımlamayın. Lütfen etkilenen sürüm, etki, yeniden üretim adımları ve varsa çözüm önerisini paylaşın. Acil durumlarda uygulamanın internete açık `/api/mcp` endpoint'ini geçici kapatın.

## Güvenlik tasarımı

- Strict TypeScript ve Zod doğrulaması; CSV/XLSX ayrıştırma, satır/sütun/byte/time/request/response sınırları.
- XLSX ZIP entry adedi, toplam açılmış boyut, entry başına boyut ve sıkıştırma oranı denetimi; dosyalar disk'e açılmaz.
- PostgreSQL sadece TLS ve `BEGIN READ ONLY`; kullanıcı SQL'i çalıştırılamaz. Tablo/şema/sütun adı çift tırnakla kaçışlanır; satır limiti parametrelidir. Yetkisi salt okunur olan DB hesabı kullanın.
- REST yalnız HTTPS/443 GET; yönlendirme kapalı; credential içermeyen URL; `RECONCILE_ALLOWED_HOSTS` exact hostname allow-list; DNS cevapları public IP ile doğrulanıp outbound bağlantı tek IP'ye pinlenir. Local/private/reserved IP engellenir.
- Veriler loglanmaz veya persistent depolanmaz; API/MCP yanıtı `no-store`; hata metinleri credential/source details sızdırmayacak biçimde filtrelenir.
- `pnpm audit --prod --audit-level high` ve statik hassas-log/saklama testleri GitHub Actions kalite kapısında çalışır.

## Açık kalan operasyon riskleri

MCP endpoint'i Vercel'de herkese açık ve uygulama düzeyinde hesap/kimlik doğrulaması veya dağıtık rate limiter içermez. Her çağrı kullanıcı tarafından iletilen kaynak tanımı ve kimlik bilgileriyle çalışır; saldırganlar payload/CPU/fonksiyon kotalarını tüketmeye çalışabilir. Ağ kaynaklarına sadece işletmecinin allow-list ettiği host/port üzerinden erişilir. Vercel'in edge/DDoS kontrolleri ve hesap kotaları uygulama rate-limiter'ı yerine garanti sayılmaz. Kaynak verisi hassassa endpoint erişimi, kaynak hesap izinleri, Vercel proje koruması ve fonksiyon loglarını ayrıca değerlendirin.

Tedarikçi kütüphaneleri zamanla zafiyet alabilir. Üretimde kullanılan commit, pnpm lockfile, Node 22.x ve platform hesap yapılandırmasını düzenli olarak gözden geçirin. Bu politika yasal/sertifikalı güvenlik taahhüdü değildir.
