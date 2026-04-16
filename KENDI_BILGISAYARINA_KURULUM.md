# 🚀 EVRAK TAKİP SİSTEMİ - KEND BİLGİSAYARINA KURULUM REHBERİ

## 📋 İÇİNDEKİLER
1. Projeyi İndirme
2. Gerekli Programları Kurma
3. Projeyi Çalıştırma
4. İlk Testi Yapma
5. Başka PC'den Erişim

---

## ADIM 1: PROJEYİ İNDİR

### Yöntem 1: Emergent'ten İndir (Önerilir)

1. **Emergent arayüzüne git**
2. **Sol menüden "Download Code" butonunu bul**
3. **Tıkla ve ZIP dosyasını indir**
4. **Masaüstüne kaydet**

### Yöntem 2: Manuel Arşiv Oluştur

Eğer "Download Code" butonu yoksa:

```bash
# Emergent terminalinde çalıştır
cd /app
tar -czf evrak-takip.tar.gz backend/ frontend/ *.md --exclude="node_modules" --exclude="__pycache__"
```

---

## ADIM 2: GEREKLİ PROGRAMLARI KUR

### 2.1 MongoDB Community Edition

**İndirme:**
```
https://www.mongodb.com/try/download/community
```

**Kurulum Adımları:**

1. **Windows 10/11 seç**
2. **İndir ve çalıştır**
3. Kurulum ekranında:
   - ✅ "Complete" kurulum seç
   - ✅ "Install MongoDB as a Service" işaretle
   - ✅ "Install MongoDB Compass" işaretle (opsiyonel ama önerilir)
4. **"Next" → "Install"**
5. Kurulum bitene kadar bekle (5-10 dakika)

**Kontrol:**
```cmd
# Komut satırını aç (Win+R → cmd)
mongod --version
```
Versiyon görünüyorsa başarılı!

---

### 2.2 Python 3.10+

**İndirme:**
```
https://www.python.org/downloads/
```

**Kurulum Adımları:**

1. **"Download Python 3.x.x" butonuna tıkla**
2. İndirilen dosyayı çalıştır
3. **ÖNEMLİ:** ⚠️ "Add Python to PATH" kutucuğunu işaretle!
4. **"Install Now" tıkla**
5. Kurulum bitene kadar bekle

**Kontrol:**
```cmd
python --version
pip --version
```
Her ikisi de versiyon gösteriyorsa başarılı!

---

### 2.3 Node.js 16+

**İndirme:**
```
https://nodejs.org/
```

**Kurulum Adımları:**

1. **LTS (Long Term Support) versiyonu indir**
2. İndirilen dosyayı çalıştır
3. **"Next" → "Accept" → "Next"**
4. Tüm bileşenleri işaretli bırak
5. **"Install" tıkla**
6. Kurulum bitene kadar bekle

**Kontrol:**
```cmd
node --version
npm --version
```
Her ikisi de versiyon gösteriyorsa başarılı!

---

### 2.4 Yarn Paket Yöneticisi

**Kurulum:**
```cmd
npm install -g yarn
```

**Kontrol:**
```cmd
yarn --version
```

---

## ADIM 3: PROJEYİ HAZIRLA

### 3.1 ZIP Dosyasını Çıkart

1. **İndirdiğin ZIP'i masaüstüne çıkart**
2. **Klasör adı: "evrak-takip" olsun**
3. İçinde şunlar olmalı:
   ```
   evrak-takip/
   ├── backend/
   ├── frontend/
   └── *.md dosyaları
   ```

---

### 3.2 Backend Ayarları

1. **Klasöre git:**
   ```cmd
   cd C:\Users\KULLANICI_ADIN\Desktop\evrak-takip\backend
   ```

2. **.env dosyasını aç (Not Defteri ile)**

3. **İçeriği kontrol et ve değiştir:**
   ```env
   MONGO_URL="mongodb://localhost:27017"
   DB_NAME="evrak_takip_db"
   CORS_ORIGINS="*"
   JWT_SECRET="a8f5e2c9b3d7f1e4a6c8b2d9f3e7a1c5b4d8e2f6a9c3b7d1e5f8a2c6b9d3e7f1a4"
   ADMIN_EMAIL="ekrem.karabiyik@company.com"
   ADMIN_PASSWORD="Ekrem147258369**2026**"
   EMERGENT_LLM_KEY="sk-emergent-fBcA4C6Ea651113F77"
   RESEND_API_KEY=""
   SENDER_EMAIL="onboarding@resend.dev"
   ```

4. **Kaydet ve kapat**

---

### 3.3 Frontend Ayarları

1. **Klasöre git:**
   ```cmd
   cd C:\Users\KULLANICI_ADIN\Desktop\evrak-takip\frontend
   ```

2. **.env dosyasını aç**

3. **İlk başta localhost kullan:**
   ```env
   REACT_APP_BACKEND_URL=http://localhost:8001
   WDS_SOCKET_PORT=443
   ENABLE_HEALTH_CHECK=false
   ```

4. **Kaydet ve kapat**

---

## ADIM 4: PROJEYİ ÇALIŞTIR

### 4.1 Backend'i Başlat

1. **Yeni bir Komut İstemi (CMD) aç**

2. **Backend klasörüne git:**
   ```cmd
   cd C:\Users\KULLANICI_ADIN\Desktop\evrak-takip\backend
   ```

3. **Gereksinimleri kur:**
   ```cmd
   pip install -r requirements.txt
   ```
   (5-10 dakika sürebilir)

4. **Backend'i çalıştır:**
   ```cmd
   python server.py
   ```

5. **Başarılı mesajları:**
   ```
   INFO:     Uvicorn running on http://0.0.0.0:8001
   INFO:     Application startup complete.
   Storage initialized
   Admin user created: ekrem.karabiyik@company.com
   ```

6. **Bu CMD penceresini KAPATMA! Açık bırak!**

---

### 4.2 Frontend'i Başlat

1. **YENİ bir Komut İstemi (CMD) aç** (İkinci pencere)

2. **Frontend klasörüne git:**
   ```cmd
   cd C:\Users\KULLANICI_ADIN\Desktop\evrak-takip\frontend
   ```

3. **Gereksinimleri kur:**
   ```cmd
   yarn install
   ```
   (10-15 dakika sürebilir, sabırlı ol!)

4. **Frontend'i çalıştır:**
   ```cmd
   yarn start
   ```

5. **Başarılı olursa:**
   - Otomatik tarayıcı açılacak
   - Veya manuel aç: `http://localhost:3000`

6. **Bu CMD penceresini de KAPATMA! Açık bırak!**

---

## ADIM 5: İLK TEST

### 5.1 Giriş Yap

1. **Tarayıcıda aç:** `http://localhost:3000`

2. **Admin bilgileriyle giriş yap:**
   - E-posta: `ekrem.karabiyik@company.com`
   - Şifre: `Ekrem147258369**2026**`

3. **"Giriş Yap" butonuna tıkla**

4. **Dashboard açılmalı!** 🎉

---

### 5.2 Test Senaryosu

**Dashboard'da:**
- ✅ 4 adet istatistik kartı görünmeli
- ✅ Sol menüde 6 seçenek olmalı

**Kullanıcılar:**
- ✅ Sol menüden "Kullanıcılar" tıkla
- ✅ 5 kullanıcı görünmeli (Admin + 4 test kullanıcısı)

**Birimler:**
- ✅ "Birimler" menüsüne git
- ✅ 4 birim görünmeli (MUHASEBE, İHRACAT, ÜRETİM&OPERASYON, YÖNETİM)

**Belge Yükle:**
- ✅ "Belgeler" → "Belge Yükle"
- ✅ Herhangi bir dosya seç
- ✅ Yükle

**Herşey çalışıyorsa sistem hazır!** ✅

---

## ADIM 6: BAŞKA PC'DEN ERİŞİM (Aynı Ağda)

### 6.1 IP Adresini Bul

1. **Komut istemi aç**

2. **Şunu çalıştır:**
   ```cmd
   ipconfig
   ```

3. **"IPv4 Address" satırını bul:**
   ```
   IPv4 Address: 192.168.1.100
   ```

4. **Bu IP'yi not al!**

---

### 6.2 Frontend .env'i Güncelle

1. **Frontend'i DURDUR** (CMD penceresinde Ctrl+C)

2. **`.env` dosyasını aç**

3. **IP adresini yaz:**
   ```env
   REACT_APP_BACKEND_URL=http://192.168.1.100:8001
   ```
   (192.168.1.100 yerine kendi IP'ni yaz!)

4. **Kaydet ve kapat**

5. **Frontend'i tekrar başlat:**
   ```cmd
   yarn start
   ```

---

### 6.3 Güvenlik Duvarını Aç

1. **Başlat → "Windows Defender Güvenlik Duvarı" yaz**

2. **"Gelişmiş ayarlar" tıkla**

3. **Sol taraftan "Gelen Kuralları" seç**

4. **Sağ taraftan "Yeni Kural" tıkla**

5. **Kural Türü:** "Bağlantı Noktası" seç → İleri

6. **Protokol:** TCP seç

7. **Belirli bağlantı noktaları:** `3000, 8001` yaz → İleri

8. **Eylem:** "Bağlantıya izin ver" seç → İleri

9. **Profil:** Hepsini işaretle → İleri

10. **Ad:** "Evrak Takip Sistemi" yaz → Son

---

### 6.4 Diğer PC'lerden Eriş

**Aynı ağdaki herhangi bir PC/telefon/tablet'ten:**

```
http://192.168.1.100:3000
```
(192.168.1.100 yerine kendi IP'ni yaz!)

**Giriş yap ve kullan!** 🎉

---

## 🔧 SORUN GİDERME

### "ModuleNotFoundError" hatası (Backend)

**Çözüm:**
```cmd
cd backend
pip install -r requirements.txt --force-reinstall
```

### "command not found: yarn" hatası (Frontend)

**Çözüm:**
```cmd
npm install -g yarn
```

### MongoDB başlamıyor

**Çözüm:**
```cmd
# Servis olarak başlat
net start MongoDB
```

### Port zaten kullanımda

**Çözüm:**
```cmd
# 8001 portunu kullanan programı bul ve kapat
netstat -ano | findstr :8001
```

### Frontend açılmıyor

**Çözüm:**
```cmd
cd frontend
rm -rf node_modules
yarn install
yarn start
```

### Firewall kuralı eklenemedi

**Çözüm (Komut satırı ile):**
```cmd
# Yönetici olarak CMD aç
netsh advfirewall firewall add rule name="Evrak Takip Frontend" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="Evrak Takip Backend" dir=in action=allow protocol=TCP localport=8001
```

---

## 📊 BAŞKA PC'Yİ SERVER YAPMA

### Senaryo: Eski/Boş Bir PC'yi Server Yap

**Gereksinimler:**
- Windows 10/11
- 4GB+ RAM
- 10GB+ boş disk
- Ağ bağlantısı

**Adımlar:**

1. **Server PC'ye yukarıdaki tüm programları kur**
   - MongoDB
   - Python
   - Node.js
   - Yarn

2. **Projeyi Server PC'ye kopyala**
   - USB ile
   - Veya ağ paylaşımı ile

3. **Server PC'de çalıştır**
   ```cmd
   # Terminal 1
   cd evrak-takip\backend
   python server.py

   # Terminal 2
   cd evrak-takip\frontend
   yarn start
   ```

4. **Server PC'nin IP'sini bul**
   ```cmd
   ipconfig
   ```

5. **Tüm ağdan erişim**
   ```
   http://SERVER_IP:3000
   ```

6. **Server PC'yi 7/24 açık tut**

---

## 💡 İPUÇLARI

### Otomatik Başlatma (Windows)

**Backend için .bat dosyası oluştur:**

1. Not Defteri aç
2. Şunu yaz:
   ```batch
   @echo off
   cd C:\evrak-takip\backend
   python server.py
   pause
   ```
3. Farklı kaydet: `backend-baslat.bat`
4. Çift tıkla ve çalıştır

**Frontend için .bat dosyası:**

```batch
@echo off
cd C:\evrak-takip\frontend
yarn start
pause
```

### Windows Başlangıcına Ekle

1. `Win+R` → `shell:startup`
2. .bat dosyalarının kısayolunu buraya at
3. PC açılınca otomatik başlar

---

## ✅ KONTROL LİSTESİ

Kurulum tamamlandıysa:

- [ ] MongoDB kurulu ve çalışıyor
- [ ] Python kurulu (python --version çalışıyor)
- [ ] Node.js kurulu (node --version çalışıyor)
- [ ] Yarn kurulu (yarn --version çalışıyor)
- [ ] Proje masaüstüne çıkartıldı
- [ ] Backend .env dosyası düzenlendi
- [ ] Frontend .env dosyası düzenlendi
- [ ] Backend çalışıyor (CMD açık)
- [ ] Frontend çalışıyor (CMD açık)
- [ ] http://localhost:3000 açılıyor
- [ ] Admin girişi yapıldı
- [ ] Dashboard görünüyor
- [ ] Firewall kuralları eklendi
- [ ] IP adresi bulundu
- [ ] Diğer PC'den test edildi

**Hepsi ✅ ise kurulum başarılı!** 🎉

---

## 📞 YARDIM

Sorun yaşarsan:

1. **Hata mesajını kopyala**
2. **Hangi adımda olduğunu söyle**
3. **Screenshot at**
4. **Birlikte çözeriz!**

**Başarılar! 🚀**
