# EVRAK TAKİP SİSTEMİ - CLOUDPOINT CLIENT İLE KULLANIM

## CloudPoint Client Nedir?

**CloudPoint Client** bir "thin client" cihazıdır. Yani:
- ❌ Kendi başına sunucu (server) olarak **ÇALIŞTIRILAMAZ**
- ❌ Üzerinde uygulama **ÇALIŞTIRILAMAZ**
- ✅ Uzak sunuculara **BAĞLANIR** (VDI, Terminal Server, vb.)
- ✅ Ekran, klavye, mouse işlevini görür

## Evrak Takip Sistemi İçin 3 Seçenek

### SEÇENEK 1: Mevcut Bir Windows Bilgisayar Kullanma (ÖNERİLEN)

#### Gereksinimler:
- Windows 10/11 çalıştıran herhangi bir bilgisayar
- En az 4GB RAM
- 10GB boş disk alanı
- Ağ bağlantısı

#### Adımlar:

**1. MongoDB Kurulumu:**
```bash
# MongoDB Community Edition indirin:
https://www.mongodb.com/try/download/community

# Kurulum sırasında "Complete" seçeneğini seçin
# "Install MongoDB as a Service" seçeneğini işaretleyin
```

**2. Python Kurulumu:**
```bash
# Python 3.10 veya üstü indirin:
https://www.python.org/downloads/

# Kurulum sırasında "Add Python to PATH" seçeneğini işaretleyin
```

**3. Node.js Kurulumu:**
```bash
# Node.js LTS indirin:
https://nodejs.org/

# Kurulum sonrası cmd'de kontrol edin:
node --version
npm --version
```

**4. Projeyi Çalıştırma:**
```bash
# Backend
cd C:\evrak-takip\backend
pip install -r requirements.txt
python server.py

# Frontend (yeni bir cmd penceresi açın)
cd C:\evrak-takip\frontend
npm install -g yarn
yarn install
yarn start
```

**5. IP Adresinizi Bulun:**
```cmd
ipconfig
```
"IPv4 Address" satırındaki IP'yi not alın (örn: 192.168.1.100)

**6. Diğer Cihazlardan Erişim:**
- Aynı ağdaki herhangi bir cihazdan (PC, tablet, telefon)
- Tarayıcıda: `http://192.168.1.100:3000`
- CloudPoint Client'tan da VNC/RDP ile bu PC'ye bağlanıp tarayıcıyı kullanabilirsiniz

---

### SEÇENEK 2: Mini PC / Raspberry Pi Kullanma

**Uygun Cihazlar:**
- Intel NUC
- Raspberry Pi 4 (4GB+ RAM)
- Herhangi bir mini PC

**Avantajlar:**
- Düşük güç tüketimi
- 7/24 açık kalabilir
- Küçük ve sessiz

**Kurulum:**
- Ubuntu Server 20.04+ kurulumu
- MongoDB, Python, Node.js kurulumu
- Uygulama kurulumu
- Aynı şekilde IP üzerinden erişim

---

### SEÇENEK 3: Mevcut Emergent Cloud Ortamını Kullanma (ŞU AN KULLANDIĞINIZ)

#### Durum:
- ✅ Uygulama **ŞU ANDA** çalışıyor
- ✅ Emergent'in cloud sunucusunda
- ❌ Ama bu **local ağınızda DEĞİL**
- ❌ İnternet gerektirir

#### Bu Seçenekte:
- Projeyi indirip kendi bilgisayarınıza kurmanız gerekir
- Veya Emergent'ten deployment desteği alabilirsiniz

---

## CloudPoint Client İle Kullanım Senaryoları

### Senaryo 1: CloudPoint → Windows PC (RDP)

```
[CloudPoint Client] --RDP--> [Windows PC (Sunucu)]
                                   ↓
                          [Evrak Takip Sistemi]
                                   ↓
                          http://localhost:3000
```

**Nasıl Yapılır:**
1. Windows PC'de Evrak Takip Sistemini çalıştırın
2. Windows PC'de "Uzak Masaüstü Bağlantısı"nı etkinleştirin:
   - Ayarlar → Sistem → Uzak Masaüstü → Aç
3. CloudPoint Client'tan RDP ile bağlanın:
   - Adres: Windows PC'nin IP adresi
   - Kullanıcı adı ve şifre ile giriş yapın
4. RDP oturumunda tarayıcıyı açın: `http://localhost:3000`

### Senaryo 2: CloudPoint → Tarayıcı (Doğrudan)

```
[CloudPoint Client] --Tarayıcı--> http://192.168.1.100:3000
                                         ↓
                              [Windows PC (Sunucu)]
```

**Nasıl Yapılır:**
1. Windows PC'de Evrak Takip Sistemini çalıştırın
2. CloudPoint Client'taki tarayıcıyı açın
3. Adres: `http://[Windows-PC-IP]:3000`
4. Doğrudan erişin (RDP'ye gerek yok)

---

## Önerilen Çözüm (CloudPoint Client İçin)

### En Basit ve Verimli Yöntem:

```
┌─────────────────────┐
│  Windows PC/Laptop  │  ← Sunucu olarak çalışır
│  (Evrak Takip)      │  ← 7/24 açık kalabilir
│  IP: 192.168.1.100  │  ← Ofiste bir köşede
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │  Ağ Router  │
    └──────┬──────┘
           │
    ┌──────┴──────────────────┐
    │                          │
┌───┴────┐              ┌─────┴──────┐
│CloudPnt│              │ Diğer PC'ler│
│Client 1│              │ & Telefonlar │
└────────┘              └─────────────┘
```

**Tüm cihazlar tarayıcıda:** `http://192.168.1.100:3000`

---

## Güvenlik Duvarı Ayarları (Windows PC'de)

### Windows Firewall'da Port Açma:

1. **Windows Defender Güvenlik Duvarı** açın
2. **Gelişmiş ayarlar** tıklayın
3. **Gelen Kuralları** seçin
4. **Yeni Kural** oluşturun:
   - Kural türü: **Bağlantı Noktası**
   - Protokol: **TCP**
   - Belirli bağlantı noktaları: **3000, 8001**
   - Eylem: **Bağlantıya izin ver**
   - Profil: **Tümünü seçin** (Etki Alanı, Özel, Genel)
   - Ad: "Evrak Takip Sistemi"

### Komut satırı ile (Administrator cmd):
```cmd
netsh advfirewall firewall add rule name="Evrak Takip Frontend" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="Evrak Takip Backend" dir=in action=allow protocol=TCP localport=8001
```

---

## Kod İndirme ve Kurulum

### Adım 1: Projeyi İndirin

Bu kodu çalıştırdığınız Emergent ortamından projeyi indirebilirsiniz:

```bash
# Tüm projeyi zip'leyin
cd /app
tar -czf evrak-takip-sistem.tar.gz backend/ frontend/ *.md

# Veya Emergent'in "Download Code" özelliğini kullanın
```

### Adım 2: Windows PC'de Çıkartın

```bash
# Arşivi çıkartın
# backend/ ve frontend/ klasörlerini görmelisiniz
```

### Adım 3: .env Dosyalarını Düzenleyin

**backend/.env:**
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

**frontend/.env:**
```env
REACT_APP_BACKEND_URL=http://192.168.1.100:8001
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
```
*Not: 192.168.1.100 yerine kendi IP adresinizi yazın*

### Adım 4: Çalıştırın

```bash
# Terminal 1 - Backend
cd backend
python server.py

# Terminal 2 - Frontend
cd frontend
yarn start
```

---

## Sık Sorulan Sorular

**S: CloudPoint Client direkt sunucu olarak kullanabilir miyim?**
C: Hayır. CloudPoint thin client'tır, sunucu olarak çalışamaz. Başka bir PC'ye bağlanır.

**S: Minimum bilgisayar gereksinimleri nedir?**
C: Windows 10, 4GB RAM, 10GB disk yeterli. Eski bir laptop bile olabilir.

**S: İnternet bağlantısı gerekir mi?**
C: Hayır. Sadece local ağda çalışır. İnternet olmadan da kullanabilirsiniz.

**S: Kaç kullanıcı aynı anda kullanabilir?**
C: Local ağınızın kapasitesine bağlı. Normal bir ev/ofis ağında 50+ kullanıcı sorunsuz.

**S: Veritabanı nasıl yedeklenir?**
C: MongoDB backup komutları ile. Detaylar DATABASE_BILGILERI.md dosyasında.

**S: Sistem 7/24 çalışmalı mı?**
C: Evet, sunucu PC'nin açık kalması gerekir. Mini PC kullanırsanız çok az güç harcar.

---

## Destek

Sorunlarla karşılaşırsanız:
1. `/app/KOD_DOKUMANTASYONU.md` - Hata ayıklama rehberi
2. `/app/DATABASE_BILGILERI.md` - Veritabanı bilgileri
3. `/app/LOCAL_AG_KURULUM.md` - Detaylı kurulum adımları
