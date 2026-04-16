# EVRAK TAKİP SİSTEMİ - KOD DOKÜMANTASYONU

## Backend (server.py) - Önemli Fonksiyonlar

### 1. Kimlik Doğrulama Fonksiyonları

```python
def hash_password(password: str) -> str:
    """
    Şifreyi bcrypt ile hashler (şifreler).
    - Güvenlik için her şifre hash'lenir
    - Veritabanında asla düz metin şifre saklanmaz
    """
    
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Girilen şifrenin doğru olup olmadığını kontrol eder.
    - Login sırasında kullanılır
    """

def create_access_token(user_id: str, email: str) -> str:
    """
    60 dakika geçerli access token oluşturur.
    - Kullanıcı her istekte bu token'ı gönderir
    """

async def get_current_user(request: Request) -> dict:
    """
    İstekteki token'dan kullanıcı bilgilerini çıkarır.
    - Her korumalı endpoint'te kullanılır
    - Token geçersizse 401 hatası verir
    """
```

### 2. Dosya Yükleme Fonksiyonları

```python
def init_storage():
    """
    Object storage'ı başlatır.
    - Dosyalar cloud'da saklanır
    - Storage key alır
    """

def put_object(path: str, data: bytes, content_type: str) -> dict:
    """
    Dosyayı storage'a yükler.
    - path: Dosyanın cloud'daki yolu
    - data: Dosya içeriği (bytes)
    - content_type: MIME type (pdf, image, vb.)
    """

def get_object(path: str) -> tuple:
    """
    Storage'dan dosyayı indirir.
    - Dosya içeriği ve tipini döndürür
    """
```

### 3. Bildirim Fonksiyonları

```python
async def log_activity(user_id: str, action: str, entity_type: str, entity_id: str, details: dict = None):
    """
    Yapılan her işlemi loglar.
    - Admin panelinde görüntülenir
    - Denetim (audit) için kullanılır
    """

async def send_email_notification(recipient_email: str, subject: str, html_content: str):
    """
    E-posta bildirimi gönderir.
    - Resend API kullanır
    - RESEND_API_KEY gerekli
    """

async def create_notification(user_id: str, title: str, message: str, document_id: str = None):
    """
    Kullanıcıya uygulama içi bildirim oluşturur.
    - Bildirimler zil ikonunda görünür
    """
```

## Frontend - Önemli Bileşenler

### 1. AuthContext.js
```javascript
// Kimlik doğrulama yönetimi
- login(email, password): Giriş yapar
- logout(): Çıkış yapar
- checkAuth(): Mevcut oturumu kontrol eder
- user: Aktif kullanıcı bilgileri
```

### 2. ProtectedRoute.js
```javascript
// Korumalı sayfa wrapper'ı
- Giriş yapmamış kullanıcıları login'e yönlendirir
- adminOnly=true ise sadece admin erişebilir
```

### 3. Layout.js
```javascript
// Ana sayfa düzeni
- Sidebar menüsü
- Bildirim zili
- Header
- Sayfa içeriği
```

## API Endpoints

### Kimlik Doğrulama
- `POST /api/auth/register` - Yeni kullanıcı kaydı
- `POST /api/auth/login` - Giriş yap
- `GET /api/auth/me` - Mevcut kullanıcı bilgisi
- `POST /api/auth/logout` - Çıkış yap

### Belge Yönetimi
- `POST /api/documents/upload` - Belge yükle
- `GET /api/documents` - Belgeleri listele
- `GET /api/documents/{id}` - Belge detayı
- `POST /api/documents/route` - Belge yönlendir
- `POST /api/documents/action` - Belge işlemi (kabul/onayla/reddet)
- `GET /api/documents/{id}/history` - Belge geçmişi
- `GET /api/documents/{id}/download` - Belge indir

### Kullanıcı Yönetimi (Admin)
- `GET /api/users` - Kullanıcı listesi
- `POST /api/users` - Yeni kullanıcı
- `PUT /api/users/{id}` - Kullanıcı güncelle
- `DELETE /api/users/{id}` - Kullanıcı sil

### Birim Yönetimi (Admin)
- `GET /api/departments` - Birim listesi
- `POST /api/departments` - Yeni birim
- `PUT /api/departments/{id}` - Birim güncelle
- `DELETE /api/departments/{id}` - Birim sil

### Yetki Grupları (Admin)
- `GET /api/permission-groups` - Grup listesi
- `POST /api/permission-groups` - Yeni grup
- `PUT /api/permission-groups/{id}` - Grup güncelle
- `DELETE /api/permission-groups/{id}` - Grup sil

### Bildirimler
- `GET /api/notifications` - Bildirim listesi
- `PUT /api/notifications/{id}/read` - Bildirimi okundu işaretle

### Sistem Logları (Admin)
- `GET /api/logs` - Aktivite logları

## Hata Kodları

- **401 Unauthorized**: Token geçersiz veya eksik
- **403 Forbidden**: Yetki yok (admin gerekli)
- **404 Not Found**: Kayıt bulunamadı
- **400 Bad Request**: Geçersiz veri
- **500 Internal Server Error**: Sunucu hatası

## Güvenlik

### CORS (Cross-Origin Resource Sharing)
```python
# backend/.env
CORS_ORIGINS="*"  # Local ağda tüm cihazlara izin ver
```

### JWT Token
```python
# Access Token: 60 dakika
# Refresh Token: 7 gün
# Secret key .env dosyasında
```

### Şifre Hashleme
```python
# bcrypt kullanılır
# Salt otomatik oluşturulur
# Şifreler asla düz metin saklanmaz
```

## Performans İpuçları

### MongoDB İndexler
```python
# Otomatik oluşturulur:
- users.email (unique)
- documents.id
- document_history.document_id
- notifications.user_id
- activity_logs.user_id
- departments.name (unique)
- permission_groups.name (unique)
```

### Dosya Yükleme Limitleri
- Varsayılan: 100MB (FastAPI default)
- Değiştirmek için: `app.add_middleware(MultiPartMiddleware, max_size=...)`

### Frontend Optimizasyon
- React lazy loading kullanılabilir
- Sayfa başına veri limiti (örn: belgeler 1000 adet)
- Bildirimler 50 adet ile sınırlı

## Hata Ayıklama

### Backend Logları
```bash
tail -f /var/log/supervisor/backend.err.log
```

### Frontend Logları
```bash
tail -f /var/log/supervisor/frontend.err.log
```

### MongoDB Logları
```bash
tail -f /var/log/mongodb/mongod.log
```

### Browser Console
- F12 tuşu ile açılır
- Network tab'inde API istekleri görülür
- Console tab'inde JavaScript hataları görülür

## Yaygın Sorunlar ve Çözümleri

### 1. "Network Error" hatası
**Sebep:** Backend'e erişilemiyor
**Çözüm:**
```bash
# Backend çalışıyor mu kontrol et
sudo supervisorctl status backend

# Restart et
sudo supervisorctl restart backend

# Logları kontrol et
tail -n 50 /var/log/supervisor/backend.err.log
```

### 2. "CORS Error"
**Sebep:** CORS ayarları yanlış
**Çözüm:**
```bash
# backend/.env dosyasında
CORS_ORIGINS="*"

# Backend restart
sudo supervisorctl restart backend
```

### 3. "Token expired"
**Sebep:** Oturum süresi dolmuş
**Çözüm:** Kullanıcı tekrar giriş yapmalı

### 4. MongoDB bağlantı hatası
**Sebep:** MongoDB çalışmıyor
**Çözüm:**
```bash
# MongoDB durumu
sudo systemctl status mongod

# Başlat
sudo systemctl start mongod
```

### 5. Dosya yüklenemiyor
**Sebep:** Storage key geçersiz veya eksik
**Çözüm:**
```bash
# backend/.env kontrol et
EMERGENT_LLM_KEY="sk-emergent-..."

# Backend restart
sudo supervisorctl restart backend
```

## Geliştirme Notları

### Yeni Endpoint Ekleme
1. server.py'de yeni fonksiyon oluştur
2. @api_router decorator ekle
3. Pydantic model tanımla (varsa)
4. get_current_user() ile yetki kontrolü yap
5. log_activity() ile işlemi logla

### Yeni Sayfa Ekleme
1. /app/frontend/src/pages/ altında yeni dosya
2. App.js'de Route ekle
3. Layout.js'de menüye ekle (gerekirse)
4. ProtectedRoute kullan

### Yeni Collection Ekleme
1. MongoDB'de otomatik oluşur
2. Index tanımla (startup fonksiyonunda)
3. Pydantic model oluştur

## Test Etme

### Backend Test
```bash
# Login testi
curl -X POST "http://localhost:8001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"ekrem.karabiyik@company.com","password":"Ekrem147258369**2026**"}'

# Belge listesi (token gerekli)
curl -X GET "http://localhost:8001/api/documents" \
  -H "Cookie: access_token=YOUR_TOKEN"
```

### Frontend Test
1. http://localhost:3000 açın
2. Browser console'u açın (F12)
3. Network tab'inde API isteklerini izleyin
