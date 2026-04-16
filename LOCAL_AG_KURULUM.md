# EVRAK TAKİP SİSTEMİ - LOCAL AĞ KURULUM REHBERİ

## 1. Gereksinimler
- MongoDB (kurulu ve çalışır durumda)
- Python 3.8+ 
- Node.js 16+
- Yarn paket yöneticisi

## 2. Sunucu IP Adresi Bulma

### Windows'ta:
```cmd
ipconfig
```
"IPv4 Address" satırındaki IP adresinizi not alın (örnek: 192.168.1.100)

### Linux/Mac'te:
```bash
ifconfig
# veya
ip addr show
```

## 3. Backend Yapılandırması

### `/app/backend/.env` dosyasını düzenleyin:
```env
# MongoDB bağlantısı (local)
MONGO_URL="mongodb://localhost:27017"
DB_NAME="evrak_takip_db"

# CORS ayarları - local ağdaki tüm cihazlara izin ver
CORS_ORIGINS="*"

# JWT güvenlik anahtarı (değiştirmeyin)
JWT_SECRET="a8f5e2c9b3d7f1e4a6c8b2d9f3e7a1c5b4d8e2f6a9c3b7d1e5f8a2c6b9d3e7f1a4"

# Admin kullanıcı bilgileri
ADMIN_EMAIL="ekrem.karabiyik@company.com"
ADMIN_PASSWORD="Ekrem147258369**2026**"

# Dosya yükleme için gerekli (değiştirmeyin)
EMERGENT_LLM_KEY="sk-emergent-fBcA4C6Ea651113F77"

# E-posta bildirimleri (opsiyonel - şimdilik boş bırakabilirsiniz)
RESEND_API_KEY=""
SENDER_EMAIL="onboarding@resend.dev"
```

### Backend'i çalıştırma:
```bash
cd /app/backend
python server.py
```
Backend `http://0.0.0.0:8001` adresinde çalışacaktır.

## 4. Frontend Yapılandırması

### `/app/frontend/.env` dosyasını düzenleyin:
**SUNUCU_IP yerine kendi IP adresinizi yazın!**

```env
# Backend API adresi - SUNUCU IP adresini buraya yazın
REACT_APP_BACKEND_URL=http://192.168.1.100:8001

WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
```

### Frontend'i çalıştırma:
```bash
cd /app/frontend
yarn start
```
Frontend `http://0.0.0.0:3000` adresinde çalışacaktır.

## 5. Local Ağdan Erişim

### Aynı ağdaki diğer bilgisayarlardan erişim:
Tarayıcıda şu adresi açın:
```
http://[SUNUCU-IP]:3000
```

Örnek:
```
http://192.168.1.100:3000
```

### Giriş Bilgileri:
- **E-posta:** ekrem.karabiyik@company.com
- **Şifre:** Ekrem147258369**2026**

## 6. Güvenlik Duvarı Ayarları

### Windows Güvenlik Duvarı:
1. "Windows Defender Güvenlik Duvarı" açın
2. "Gelişmiş ayarlar"a tıklayın
3. "Gelen Kuralları" seçin
4. "Yeni Kural" oluşturun
5. "Bağlantı Noktası" seçin
6. TCP portları: `3000,8001` ekleyin
7. "Bağlantıya izin ver" seçin
8. Tüm profiller için uygulayın

### Linux (Ubuntu/Debian):
```bash
sudo ufw allow 3000/tcp
sudo ufw allow 8001/tcp
sudo ufw reload
```

## 7. Sorun Giderme

### Problem: "Network Error" / "Failed to fetch"
**Çözüm:**
1. Backend'in çalıştığından emin olun: `http://localhost:8001/api/`
2. Frontend .env dosyasındaki IP adresini kontrol edin
3. Güvenlik duvarı ayarlarını kontrol edin

### Problem: "CORS Error"
**Çözüm:**
1. Backend `.env` dosyasında `CORS_ORIGINS="*"` olduğundan emin olun
2. Backend'i restart edin: `sudo supervisorctl restart backend`

### Problem: "MongoDB Connection Error"
**Çözüm:**
1. MongoDB'nin çalıştığından emin olun: `sudo systemctl status mongod`
2. MongoDB'yi başlatın: `sudo systemctl start mongod`

### Problem: Admin kullanıcı ile giriş yapılamıyor
**Çözüm:**
1. Backend loglarını kontrol edin
2. MongoDB'de admin kullanıcısının oluşturulduğunu kontrol edin:
```bash
mongosh
use evrak_takip_db
db.users.find({email: "ekrem.karabiyik@company.com"})
```

## 8. Production Deployment (Opsiyonel)

Sistemi production ortamında çalıştırmak için:

1. **Nginx veya Apache** ile reverse proxy kurun
2. **SSL sertifikası** ekleyin (Let's Encrypt)
3. **PM2** ile process yönetimi yapın
4. **MongoDB backup** stratejisi oluşturun

## 9. Yedekleme

### MongoDB Yedekleme:
```bash
# Yedek alma
mongodump --db evrak_takip_db --out /yedekler/$(date +%Y%m%d)

# Yedek geri yükleme
mongorestore --db evrak_takip_db /yedekler/20260410/evrak_takip_db
```

### Uygulama Dosyaları Yedekleme:
```bash
tar -czf evrak-takip-backup-$(date +%Y%m%d).tar.gz /app
```

## 10. Performans İpuçları

1. **MongoDB İndexleme:** Büyük veri setleri için otomatik oluşturuldu
2. **File Upload Limitleri:** Varsayılan 100MB (server.py'de değiştirilebilir)
3. **JWT Token Süresi:** Access token 60 dakika, Refresh token 7 gün

## Destek ve İletişim

Sorun yaşarsanız:
1. `/var/log/supervisor/backend.err.log` dosyasını kontrol edin
2. `/var/log/supervisor/frontend.err.log` dosyasını kontrol edin
3. MongoDB loglarını kontrol edin: `/var/log/mongodb/mongod.log`
