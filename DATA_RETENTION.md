# Veri Saklama ve Silme

## Uygulama kodu

Bu uygulamada kullanıcı/veri tabanı oluşturma, object storage, upload klasörü, kalıcı cache, analytics, uygulama log sink'i veya geçmiş kayıt özelliği yoktur. İstek gövdesi akış içinde belleğe alınır; parser ve mutabakat sonucu geçici serverless process/browser state içinde kullanılır. Uygulama kodu kullanıcı kaynaklarını dosyaya yazmaz ve yanıtları `Cache-Control: no-store` ile döndürür. İşlem bittiğinde uygulama sonucu persistent hale getirmez. JavaScript/Node belleklerinin garbage collection zamanı garanti edilemez; bu, kriptografik güvenli bellek silme iddiası değildir.

## Platform katmanları

Vercel, GitHub, DNS/ISP ve cihaz sağlayıcılarının güvenlik/operasyon logları uygulama dışında kalır. Vercel Hobby plan dokümantasyonunda function/runtime log retention 1 saat belirtilmiştir (kontrol tarihi: 16 Kasım 2026); plan değişikliği veya farklı planlar farklı saklama süresi uygulayabilir. Bu bilgi, request body'nin hiçbir zaman bir sağlayıcı iç sisteminde tutulmadığının garantisi değildir. Güncel süre, erişim, silme ve bölge koşulları için sağlayıcıların belgeleri/hesap ayarları/işleme şartlarını kontrol edin.

GitHub repo herkese açık kaynak kodu içerir; içine kişisel veri/credential commit etmeyin. Actions testleri sentetik kayıtlarla çalışır, ancak CI log ve artefakt retention sağlayıcının politikasına bağlıdır. Workflow build artefaktını kullanıcı verisi olarak upload etmez.

## İstek sınırları

Vercel Function payload hard limiti 4,5 MB'dır. Bu dağıtımda ham HTTP request 4,25 MB, dosya başına 4 MB, REST response 2 MB, API/MCP response 2 MB, kaynak başına 10.000 satır/100 sütun, işlem 15 saniye ile sınırlıdır. Hücre değeri 64 KiB; REST, PostgreSQL ve satır-dizisi girdilerinde hücre verisinin toplamı 4 MB ile sınırlandırılır. Aşımda işlem reddedilir; veri kırpılmaz/saklanmaz.

## Silme talepleri

Uygulama tarafından kalıcı hale getirilmiş kullanıcı tablosu olmadığı için uygulama içi bir silme endpoint'i yoktur. Tarayıcı sekmesini kapatmak, yerel MCP sürecini durdurmak ve istek verisini tekrar göndermemek istemci tarafındaki geçici çalışma verisini sonlandırır; hosting sağlayıcısı loglarına müdahale etmez. Sağlayıcı kayıtları için ilgili hesabın resmi gizlilik/silme süreçleri kullanılmalıdır.

İlgili belgeler: [PRIVACY.md](PRIVACY.md), [Vercel Hobby plan](https://vercel.com/docs/plans/hobby), [Function limitations](https://vercel.com/docs/functions/limitations).
