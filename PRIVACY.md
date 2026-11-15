# Gizlilik Bildirimi

## Veri akışı

Tarayıcıda seçilen CSV/XLSX, REST kaynağı tanımı, PostgreSQL bağlantı alanları, eşleme seçenekleri ve karşılaştırma çıktısı yalnızca kullanıcının açıkça başlattığı `POST` isteğiyle bu uygulamaya gelir. Sunucu girdiyi doğrular, kaynakları bellekte okur, deterministik olarak karşılaştırır ve JSON/MCP yanıtını döndürür. Tarayıcı sonuçları açık sekmenin React belleğinde gösterir; sayfa kapatıldığında uygulama katmanındaki bu çalışma verisi sonlanır.

Uygulama kodu kullanıcı hesabı veya veritabanı oluşturmaz; dosya yüklemesi, analiz sonucu, kaynak içeriği, kimlik bilgisi, kullanıcı profili veya geçmişini disk/object storage/database'e yazmaz. Kalıcı cache ve harici yapay zekâ yoktur. Uygulama analitiği/izleme/telemetri kapalıdır. HTTP ve MCP yanıtları `no-store` başlığı taşır. Hata yanıtları bağlantı/parola ayrıntılarını maskeleyip gövdeyi veya kaynak satırlarını loglamaz.

PostgreSQL parolası veya REST token'ı yalnız ilgili isteğin belleğinde kullanılır. REST URL query string'ine kimlik bilgisi koymayın; UI bearer token alanını `Authorization` başlığına çevirir. Kaynak bağlantı ayarlarını UI sekmesinde siz düzenleyene kadar tarayıcı belleğinde tutar; tarayıcı eklentileri, cihaz zararlı yazılımı, ekran görüntüsü/indirilen rapor ve istemci işletim sistemi bu uygulamanın kontrolünde değildir.

## Altyapı sağlayıcıları ve retention

Bu proje uygulama katmanında veri tutmamak üzere tasarlanmıştır; bu, altyapı sağlayıcılarının hiçbir teknik metadata kaydetmediği anlamına gelmez. Vercel, GitHub ve internet/bağlantı sağlayıcıları kendi platform loglarını, güvenlik kayıtlarını, IP/istek metadata'sını veya CI çıktısını kendi güncel şartlarına göre işleyebilir. Uygulama kodu bu platform loglarını kapatamaz veya doğrulayamaz. Vercel'in Hobby planı için resmi belgelerinde function/runtime log retention 1 saat olarak belirtilmiştir; kapsam/plan ve süre değişebileceğinden [Hobby plan](https://vercel.com/docs/plans/hobby), [Function limitations](https://vercel.com/docs/functions/limitations) ve sözleşme/hesap ayarlarını kullanım anında doğrulayın. Function request body'lerinin platform içi özel loglama/erişimini bu proje bağımsız şekilde denetleyemez.

GitHub Actions testleri yalnızca sentetik fixture kullanır. Loglarda veri kaynaklarını, bağlantı sırlarını veya gerçek müşteri verisini kullanmayın. GitHub Actions/Vercel hesap logları, sağlayıcı saklama süreleri ile kullanıcı/hesap erişim politikalarına tabidir.

## Güvenli kullanım ve hukuki not

Özellikle kişisel, finansal, sağlık veya düzenlemeye tabi veri yüklemeden önce Vercel planı, veri işleme sözleşmesi, bölge/transfer, platform retention, erişim ve kurum politikalarını bağımsız değerlendirin. KVKK/GDPR veri minimizasyonu ve gizlilik tasarımı ilkeleri gözetilmiştir; bu repo hukuki inceleme, sertifika, garantili mevzuat uyumu veya sağlayıcılar adına güvence değildir. Veri denetleyicisi/veri işleyeni yükümlülüklerini ve gerekli hukuki dayanağı dağıtımı yapan kurum belirler.

Güvenlik sorunları için [SECURITY.md](SECURITY.md) yolunu kullanın. Bu bildirim kod ve hizmet altyapısı değiştikçe güncellenmelidir.
