# 🚀 EVRAK TAKİP SİSTEMİ - PİLOT TEST REHBERİ

## 📋 Sistem Erişim Bilgileri

### 🌐 Uygulama Adresi (Cloud - Pilot)
```
https://agent-env-08eddc99-88bc-4d42-a63b.preview.emergentagent.com
```

**ÖNEMLİ:** Bu link şu anda **localhost** üzerinde çalışıyor. Preview URL'de routing sorunu var.
**GEÇİCİ ÇÖZÜM:** Localhost'tan test edilebilir veya deployment düzeltmesi yapılabilir.

---

## 👥 TEST KULLANICILARI

### 1️⃣ ADMIN (Tüm Yetkiler)
- **Ad Soyad:** Ekrem Karabıyık
- **E-posta:** `ekrem.karabiyik@company.com`
- **Şifre:** `Ekrem147258369**2026**`
- **Birim:** YÖNETİM
- **Yetkiler:** 
  - ✅ Tüm kullanıcıları görebilir
  - ✅ Kullanıcı ekleyebilir/düzenleyebilir/silebilir
  - ✅ Birim ekleyebilir/düzenleyebilir
  - ✅ Yetki grupları oluşturabilir
  - ✅ Tüm belgeleri görebilir
  - ✅ Sistem loglarını görebilir

### 2️⃣ Ahmet Yılmaz (Muhasebe Kullanıcısı)
- **E-posta:** `ahmet.yilmaz@company.com`
- **Şifre:** `Test123456`
- **Birim:** MUHASEBE
- **Yetkiler:**
  - ✅ Belge görüntüleme
  - ✅ Belge oluşturma
  - ✅ Belge yönlendirme

### 3️⃣ Ayşe Demir (İhracat Onaylayıcı)
- **E-posta:** `ayse.demir@company.com`
- **Şifre:** `Test123456`
- **Birim:** İHRACAT
- **Yetkiler:**
  - ✅ Belge görüntüleme
  - ✅ Belge onaylama

### 4️⃣ Mehmet Kaya (Üretim Kullanıcısı)
- **E-posta:** `mehmet.kaya@company.com`
- **Şifre:** `Test123456`
- **Birim:** ÜRETİM&OPERASYON
- **Yetkiler:**
  - ✅ Belge görüntüleme
  - ✅ Belge oluşturma
  - ✅ Belge düzenleme

### 5️⃣ Fatma Öztürk (Muhasebe Onaylayıcı)
- **E-posta:** `fatma.ozturk@company.com`
- **Şifre:** `Test123456`
- **Birim:** MUHASEBE
- **Yetkiler:**
  - ✅ Belge görüntüleme
  - ✅ Belge onaylama
  - ✅ Belge yönlendirme

---

## 🧪 TEST SENARYOLARI

### Senaryo 1: Belge Yükleme ve Yönlendirme

**1. Ahmet (Muhasebe) olarak giriş yapın:**
```
Email: ahmet.yilmaz@company.com
Şifre: Test123456
```

**2. Yeni belge yükleyin:**
- Sol menüden "Belgeler" tıklayın
- "Belge Yükle" butonuna tıklayın
- Herhangi bir dosya seçin (PDF, Word, txt vb.)
- Başlık: "Fatura Onayı - Ocak 2026"
- Kategori: "Fatura"
- "Yükle" butonuna tıklayın

**3. Belgeyi yönlendirin:**
- Yüklediğiniz belgeye tıklayın
- "Yönlendir" butonuna tıklayın
- Kullanıcı: "Fatma Öztürk" seçin
- Not: "Lütfen onaylayın"
- "Yönlendir" butonuna tıklayın

**Beklenen Sonuç:**
- ✅ Belge başarıyla yüklendi
- ✅ Fatma'ya bildirim gitti
- ✅ Belge durumu "Beklemede" oldu

---

### Senaryo 2: Belge Onaylama

**1. Fatma (Muhasebe Onaylayıcı) olarak giriş yapın:**
```
Email: fatma.ozturk@company.com
Şifre: Test123456
```

**2. Bildirimleri kontrol edin:**
- Sağ üstte zil ikonuna tıklayın
- "Yeni Belge" bildirimini görün
- Bildirime tıklayın

**3. Belgeyi kabul edin:**
- "Kabul Et" butonuna tıklayın
- Not: "İnceliyorum"
- "Onayla" butonuna tıklayın

**4. Belgeyi onaylayın:**
- "Onayla" butonuna tıklayın
- Not: "Fatura onaylandı"
- "Onayla" butonuna tıklayın

**Beklenen Sonuç:**
- ✅ Belge durumu "İşlemde" → "Onaylandı"
- ✅ Ahmet'e geri bildirim gitti
- ✅ Belge geçmişinde tüm adımlar görünüyor

---

### Senaryo 3: Belge Geçmişi İnceleme

**1. Ahmet olarak tekrar giriş yapın**

**2. Gönderdiğiniz belgeyi açın:**
- "Belgeler" menüsünden belgeyi bulun
- Belgeye tıklayın
- Aşağıya scroll yapın

**3. Belge geçmişini görün:**
- Timeline şeklinde tüm işlemleri görün:
  - ✅ Ahmet belgeyi yükledi
  - ✅ Ahmet → Fatma'ya yönlendirdi
  - ✅ Fatma kabul etti
  - ✅ Fatma onayladı

**Beklenen Sonuç:**
- ✅ Tüm işlem adımları görünüyor
- ✅ Kim ne zaman ne yaptı açık
- ✅ Notlar görünüyor

---

### Senaryo 4: Admin Paneli (Birim & Yetki Yönetimi)

**1. Admin olarak giriş yapın:**
```
Email: ekrem.karabiyik@company.com
Şifre: Ekrem147258369**2026**
```

**2. Yeni birim ekleyin:**
- Sol menüden "Birimler" tıklayın
- "Birim Ekle" butonuna tıklayın
- Ad: "IT"
- Açıklama: "Bilgi Teknolojileri"
- "Oluştur" butonuna tıklayın

**3. Yeni yetki grubu oluşturun:**
- "Yetki Grupları" menüsüne gidin
- "Grup Ekle" butonuna tıklayın
- Ad: "Fatura Yöneticisi"
- Yetkiler: Tüm yetkileri seçin
- "Oluştur" butonuna tıklayın

**4. Yeni kullanıcı ekleyin:**
- "Kullanıcılar" menüsüne gidin
- "Kullanıcı Ekle" butonuna tıklayın
- E-posta: test@company.com
- Şifre: Test789
- Ad Soyad: Test Kullanıcı
- Birim: IT (yeni oluşturduğunuz)
- Yetki Grubu: Fatura Yöneticisi
- "Oluştur" butonuna tıklayın

**Beklenen Sonuç:**
- ✅ Yeni birim oluşturuldu
- ✅ Yeni yetki grubu oluşturuldu
- ✅ Yeni kullanıcı o yetki grubuyla eklendi

---

### Senaryo 5: Çoklu Kullanıcı - Aynı Anda Test

**Farklı PC'lerden/Tarayıcılardan:**

**PC 1:** Ahmet olarak giriş yapın → Belge yükleyin
**PC 2:** Ayşe olarak giriş yapın → Bildirimleri izleyin
**PC 3:** Mehmet olarak giriş yapın → Belgeler listesini görün
**PC 4:** Admin olarak giriş yapın → Sistem loglarını izleyin

**Beklenen Sonuç:**
- ✅ Her kullanıcı sadece kendi yetkili olduğu belgeleri görür
- ✅ Bildirimler anlık gelir
- ✅ Loglar admin'de görünür
- ✅ Sistem yavaşlamaz

---

## 🔍 KONTROL LİSTESİ

Pilot test sırasında kontrol edilecekler:

### Temel Özellikler
- [ ] ✅ Giriş/Çıkış çalışıyor mu?
- [ ] ✅ Farklı kullanıcılar giriş yapabiliyor mu?
- [ ] ✅ Şifreler doğru çalışıyor mu?

### Belge İşlemleri
- [ ] ✅ Belge yükleme çalışıyor mu?
- [ ] ✅ PDF, Word, Excel, txt dosyaları yükleniyor mu?
- [ ] ✅ Belge indirme çalışıyor mu?
- [ ] ✅ Belge yönlendirme çalışıyor mu?
- [ ] ✅ Belge onaylama/reddetme çalışıyor mu?

### Bildirimler
- [ ] ✅ Yeni belge bildirimleri geliyor mu?
- [ ] ✅ Bildirim sayısı doğru gösteriliyor mu?
- [ ] ✅ Bildirime tıklayınca belgeye gidiyor mu?

### Yetkilendirme
- [ ] ✅ Normal kullanıcı admin panelini görebiliyor mu? (Görmemeli!)
- [ ] ✅ Kullanıcı sadece kendi belgelerini görüyor mu?
- [ ] ✅ Onaylama yetkisi olmayan onaylayabiliyor mu? (Onaylamamalı!)

### Admin Paneli
- [ ] ✅ Kullanıcı ekleme/düzenleme/silme çalışıyor mu?
- [ ] ✅ Birim ekleme/düzenleme/silme çalışıyor mu?
- [ ] ✅ Yetki grubu oluşturma çalışıyor mu?
- [ ] ✅ Sistem logları görünüyor mu?

### Performans
- [ ] ✅ Sayfa yükleme hızlı mı?
- [ ] ✅ Belge yükleme hızlı mı?
- [ ] ✅ 5+ kullanıcı aynı anda kullanabiliyor mu?

---

## 🐛 SORUN YAŞARSAN

### "Bir hata oluştu" mesajı
1. Sayfayı yenileyin (F5)
2. Tarayıcı cache'ini temizleyin (Ctrl+Shift+Delete)
3. Gizli pencerede deneyin (Ctrl+Shift+N)
4. Farklı tarayıcıda deneyin (Chrome, Edge, Firefox)

### Giriş yapamıyorum
1. E-posta adresini tam yazın
2. Şifreyi kopyala-yapıştır yapmayın, manuel yazın
3. Caps Lock kapalı mı kontrol edin

### Belge yüklenmiyor
1. Dosya boyutu 100MB'den küçük mü?
2. Dosya formatı destekleniyor mu? (PDF, DOC, TXT, IMG, XML)

### Bildirim gelmiyor
1. Sayfayı yenileyin
2. Zil ikonuna tıklayın
3. 30 saniye bekleyin (otomatik yenilenme)

---

## 📊 GERİ BİLDİRİM FORMU

Test sonrası lütfen şunları değerlendirin:

### Kullanım Kolaylığı
- ⭐⭐⭐⭐⭐ Menüler anlaşılır mı?
- ⭐⭐⭐⭐⭐ Butonlar açık mı?
- ⭐⭐⭐⭐⭐ Bildirimler faydalı mı?

### Hız & Performans
- ⭐⭐⭐⭐⭐ Sayfa yükleme hızı
- ⭐⭐⭐⭐⭐ Belge yükleme hızı
- ⭐⭐⭐⭐⭐ Genel akıcılık

### Özellikler
- ⭐⭐⭐⭐⭐ Belge yönlendirme sistemi
- ⭐⭐⭐⭐⭐ Onay süreci
- ⭐⭐⭐⭐⭐ Belge geçmişi görünümü

### Eksikler / İstekler
- Hangi özellikler eksik?
- Hangi özellikler geliştirilmeli?
- Hangi özellikler gereksiz?

---

## 🚀 SONRAKI ADIMLAR

Pilot test başarılıysa:

### 1. Fiziksel Sunucuya Taşıma
- Windows Server veya Linux sunucu
- MongoDB + Python + Node.js kurulumu
- Local ağda çalıştırma
- Domain yapılandırması

### 2. Cloud Sunucuya Taşıma
- AWS / Azure / DigitalOcean
- Domain bağlama
- SSL sertifikası (HTTPS)
- Yedekleme sistemi

### 3. Ek Özellikler
- E-posta bildirimleri (Resend API key ile)
- Toplu belge işlemleri
- Belge kategorileri özelleştirme
- Raporlama modülü
- Mobil uygulama

---

## 📞 DESTEK

Sorularınız için:
1. Tüm dökümanlara bakın: `/app/*.md`
2. Hata loglarını kontrol edin
3. Screenshot alıp paylaşın

**Not:** Şu anda sistem **LOCALHOST** üzerinde çalışıyor. Preview URL'de routing sorunu var. 
Gerçek kullanım için fiziksel sunucu veya düzeltilmiş cloud deployment gerekiyor.
