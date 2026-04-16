# 🚨 ACİL: SİSTEME ERİŞİM REHBERİ

## PROBLEM: Preview URL Çalışmıyor!

**DURUM:** Preview URL yanlış yönlendirme yapıyor. Emergent'in ana sayfası açılıyor.

## ✅ GEÇİCİ ÇÖZÜM: Localhost Üzerinden Test

### ADIM 1: Tarayıcıda Localhost'u Açın

Aşağıdaki adresi tarayıcınıza yazın:
```
http://localhost:3000
```

**NOT:** Bu sadece kodu çalıştırdığınız bilgisayarda çalışır!

### ADIM 2: Giriş Yapın

**Admin Olarak:**
- E-posta: `ekrem.karabiyik@company.com`
- Şifre: `Ekrem147258369**2026**`

**Normal Kullanıcı Olarak (Test için):**
- E-posta: `ahmet.yilmaz@company.com`
- Şifre: `Test123456`

### ADIM 3: Farklı Kullanıcılarla Test

Aynı bilgisayarda farklı tarayıcı sekmelerinde farklı kullanıcılarla giriş yapabilirsiniz:

**Sekme 1 (Chrome Normal):** Admin
**Sekme 2 (Chrome Gizli):** Ahmet
**Sekme 3 (Edge):** Ayşe
**Sekme 4 (Firefox):** Mehmet

---

## 🔧 KALICI ÇÖZÜM SEÇENEKLERİ

### SEÇENEK 1: Deployment Agent ile Düzeltme (Önerilir)

Emergent ekibine deployment sorununu bildirin. Preview URL routing'i düzeltilmeli.

### SEÇENEK 2: Fiziksel PC'ye Taşıma

Sistemi kendi Windows PC'nize kurun:

1. **Gerekli Programları Kurun:**
   - MongoDB Community Edition
   - Python 3.10+
   - Node.js 16+
   - Yarn (npm install -g yarn)

2. **Kodu İndirin:**
   - Emergent'ten "Download Code" ile projeyi indirin
   - Veya SSH/FTP ile dosyaları kopyalayın

3. **Çalıştırın:**
```bash
# Terminal 1 - Backend
cd backend
pip install -r requirements.txt
python server.py

# Terminal 2 - Frontend
cd frontend
yarn install
yarn start
```

4. **IP Adresinizi Bulun:**
```cmd
ipconfig
```
IPv4 Address'inizi not alın (örn: 192.168.1.100)

5. **Frontend .env Düzenleyin:**
```env
REACT_APP_BACKEND_URL=http://192.168.1.100:8001
```

6. **Diğer PC'lerden Erişim:**
```
http://192.168.1.100:3000
```

---

## 🧪 ŞU ANLIK TEST NASIL YAPILIR?

### Tek PC'de Çoklu Kullanıcı Testi

1. **Chrome Normal Pencere:** 
   - `http://localhost:3000` aç
   - Admin olarak giriş yap
   - Belge yükle, kullanıcı ekle

2. **Chrome Gizli Pencere (Ctrl+Shift+N):**
   - `http://localhost:3000` aç
   - Ahmet olarak giriş yap
   - Belge yükle, Fatma'ya yönlendir

3. **Edge Tarayıcısı:**
   - `http://localhost:3000` aç
   - Fatma olarak giriş yap
   - Bildirimi gör, belgeyi onayla

4. **Firefox Tarayıcısı:**
   - `http://localhost:3000` aç
   - Ayşe olarak giriş yap
   - Belgeleri görüntüle

**NOT:** Her tarayıcı/gizli pencere ayrı bir kullanıcı gibi davranır!

---

## 🎯 TEST SENARYOSU (Localhost İçin)

### 1. Admin İşlemleri (Chrome Normal)

**Giriş:**
```
http://localhost:3000
Email: ekrem.karabiyik@company.com
Şifre: Ekrem147258369**2026**
```

**Test Et:**
- ✅ Dashboard'ı gör
- ✅ Kullanıcılar → Tüm kullanıcıları listele
- ✅ Birimler → Yeni birim ekle (örn: "IT Departmanı")
- ✅ Yetki Grupları → Yeni grup oluştur
- ✅ Sistem Logları → Aktiviteleri gör

### 2. Belge Oluşturma (Chrome Gizli)

**Giriş:**
```
http://localhost:3000
Email: ahmet.yilmaz@company.com
Şifre: Test123456
```

**Test Et:**
- ✅ Belgeler → Belge Yükle
- ✅ Herhangi bir dosya seç (PDF, DOC, TXT)
- ✅ Başlık: "Test Fatura"
- ✅ Yükle
- ✅ Belgeyi aç → Yönlendir → Fatma'yı seç

### 3. Belge Onaylama (Edge)

**Giriş:**
```
http://localhost:3000
Email: fatma.ozturk@company.com
Şifre: Test123456
```

**Test Et:**
- ✅ Sağ üstte zil ikonu → Bildirim var mı?
- ✅ Bildirimdeki belgeye git
- ✅ Kabul Et
- ✅ Onayla

### 4. Kontrol (Chrome Normal - Admin)

**Geri dön Admin hesabına:**
- ✅ Sistem Logları → Tüm işlemleri gör
- ✅ Belgeler → Test faturasını bul
- ✅ Belge detayı → Geçmişi gör

---

## ❓ SORU-CEVAP

**S: Preview URL neden çalışmıyor?**
C: Emergent'in routing yapılandırması hatalı. Backend API'ye /api prefix'i ile ulaşılamıyor.

**S: Localhost dışında başka yerden erişebilir miyim?**
C: Hayır, şu anda sadece kodu çalıştırdığınız bilgisayardan. Diğer PC'lerden erişim için fiziksel sunucuya taşımanız gerekiyor.

**S: Farklı PC'lerden nasıl test ederim?**
C: Şimdilik aynı PC'de farklı tarayıcılar/gizli pencereler kullanın. Her biri farklı kullanıcı gibi davranır.

**S: Sistemi beğendiysem ne yapmalıyım?**
C: İki seçenek:
1. Emergent'e deployment düzeltmesi isteyin
2. Kodu indirip kendi sunucunuza kurun (daha hızlı)

**S: Kendi sunucuma nasıl kurarım?**
C: `CLOUDPOINT_CLIENT_KURULUM.md` dosyasındaki adımları takip edin.

---

## 🎁 BONUS: Hızlı Test Script'i

Tarayıcı konsolunda (F12) çalıştırın:

```javascript
// Test kullanıcılarını kopyala
const users = [
  {email: 'ekrem.karabiyik@company.com', password: 'Ekrem147258369**2026**', name: 'Admin'},
  {email: 'ahmet.yilmaz@company.com', password: 'Test123456', name: 'Ahmet'},
  {email: 'ayse.demir@company.com', password: 'Test123456', name: 'Ayşe'},
  {email: 'mehmet.kaya@company.com', password: 'Test123456', name: 'Mehmet'},
  {email: 'fatma.ozturk@company.com', password: 'Test123456', name: 'Fatma'}
];

console.table(users);
```

---

## 📞 YARDIM

Hala sorun mu yaşıyorsunuz?

1. Tarayıcı konsolu (F12) → Console tab'inde hata var mı?
2. Network tab'inde API istekleri görünüyor mu?
3. Screenshot alıp gösterin

**ÖNEMLİ:** Şu an için `http://localhost:3000` kullanın. Preview URL çalışmıyor!
