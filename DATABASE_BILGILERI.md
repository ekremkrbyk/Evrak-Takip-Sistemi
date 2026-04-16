# EVRAK TAKİP SİSTEMİ - VERİTABANI BİLGİLERİ

## MongoDB Veritabanı Bilgileri

### Bağlantı Bilgileri
- **Veritabanı Türü:** MongoDB
- **Bağlantı URL'si:** `mongodb://localhost:27017`
- **Veritabanı Adı:** `evrak_takip_db`
- **Port:** 27017 (MongoDB varsayılan portu)

### Koleksiyonlar (Collections)

#### 1. users (Kullanıcılar)
Tüm kullanıcı bilgilerini saklar.
```javascript
{
  "_id": ObjectId,              // MongoDB otomatik ID
  "id": "string",               // Uygulama ID (UUID)
  "email": "string",            // Kullanıcı e-postası (unique)
  "password_hash": "string",    // Şifrelenmiş şifre (bcrypt)
  "full_name": "string",        // Ad soyad
  "department": "string",       // Bağlı olduğu birim
  "role": "admin/user",         // Rol (admin veya user)
  "permissions": ["string"],    // Yetki listesi
  "permission_group_id": "string", // Bağlı yetki grubu (opsiyonel)
  "created_at": "ISODate"       // Oluşturulma tarihi
}
```

#### 2. documents (Belgeler)
Tüm yüklenen belge bilgilerini saklar.
```javascript
{
  "_id": ObjectId,
  "id": "string",               // Belge ID (UUID)
  "title": "string",            // Belge başlığı
  "description": "string",      // Belge açıklaması
  "category": "string",         // Belge kategorisi
  "file_path": "string",        // Dosyanın storage'daki yolu
  "file_name": "string",        // Orijinal dosya adı
  "file_size": number,          // Dosya boyutu (byte)
  "file_type": "string",        // Dosya tipi (MIME type)
  "status": "string",           // draft/pending/in_progress/approved/rejected
  "created_by": "string",       // Oluşturan kullanıcı ID
  "created_by_name": "string",  // Oluşturan kullanıcı adı
  "current_holder": "string",   // Şu anki sorumlu kullanıcı ID
  "current_holder_name": "string", // Şu anki sorumlu adı
  "created_at": "ISODate",
  "updated_at": "ISODate",
  "is_deleted": boolean         // Soft delete flag
}
```

#### 3. document_history (Belge Geçmişi)
Belge üzerinde yapılan tüm işlemleri kaydeder.
```javascript
{
  "_id": ObjectId,
  "id": "string",
  "document_id": "string",      // İlgili belge ID
  "from_user_id": "string",     // Gönderen kullanıcı (routing için)
  "from_user_name": "string",
  "to_user_id": "string",       // Alan kullanıcı (routing için)
  "to_user_name": "string",
  "user_id": "string",          // İşlem yapan kullanıcı (action için)
  "user_name": "string",
  "action": "string",           // routed/accept/approve/reject
  "note": "string",             // İşlem notu
  "timestamp": "ISODate"
}
```

#### 4. notifications (Bildirimler)
Kullanıcılara gönderilen bildirimler.
```javascript
{
  "_id": ObjectId,
  "id": "string",
  "user_id": "string",          // Bildirimin gönderildiği kullanıcı
  "title": "string",            // Bildirim başlığı
  "message": "string",          // Bildirim içeriği
  "document_id": "string",      // İlgili belge (opsiyonel)
  "is_read": boolean,           // Okundu mu?
  "created_at": "ISODate"
}
```

#### 5. activity_logs (Aktivite Logları)
Sistemdeki tüm aktiviteleri kaydeder.
```javascript
{
  "_id": ObjectId,
  "id": "string",
  "user_id": "string",          // İşlem yapan kullanıcı
  "action": "string",           // İşlem tipi (login, upload_document, vb.)
  "entity_type": "string",      // İşlem yapılan nesne tipi (user, document, vb.)
  "entity_id": "string",        // İşlem yapılan nesne ID
  "details": {},                // Ek detaylar (JSON)
  "timestamp": "ISODate"
}
```

#### 6. departments (Birimler)
Şirketteki birim/departman listesi.
```javascript
{
  "_id": ObjectId,
  "id": "string",
  "name": "string",             // Birim adı (unique)
  "description": "string",      // Birim açıklaması
  "created_at": "ISODate"
}
```

#### 7. permission_groups (Yetki Grupları)
Önceden tanımlanmış yetki grupları.
```javascript
{
  "_id": ObjectId,
  "id": "string",
  "name": "string",             // Grup adı (unique)
  "description": "string",      // Grup açıklaması
  "permissions": ["string"],    // Yetki listesi
  "created_at": "ISODate"
}
```

## Veritabanına Bağlanma

### MongoDB Shell ile Bağlantı
```bash
mongosh mongodb://localhost:27017/evrak_takip_db
```

### Veritabanı Yedekleme
```bash
# Yedek alma
mongodump --db evrak_takip_db --out /path/to/backup

# Yedek geri yükleme
mongorestore --db evrak_takip_db /path/to/backup/evrak_takip_db
```

### Veritabanı Temizleme (DİKKATLİ KULLANIN!)
```javascript
// MongoDB shell'de çalıştırın
use evrak_takip_db
db.dropDatabase()
```

## Varsayılan Veriler

### Admin Kullanıcı
- **E-posta:** ekrem.karabiyik@company.com
- **Şifre:** Ekrem147258369**2026**
- **Rol:** admin

### Varsayılan Birimler
1. MUHASEBE
2. İHRACAT
3. ÜRETİM&OPERASYON
4. YÖNETİM

### Varsayılan Yetki Grupları
1. **Tam Yetki:** Tüm yetkiler
2. **Sadece Görüntüleme:** Sadece belgeleri görüntüleme
3. **Onaylayıcı:** Görüntüleme + onaylama yetkisi

## Güvenlik Notları

1. **Şifre Güvenliği:** Tüm şifreler bcrypt ile hashlenmiş olarak saklanır
2. **JWT Token:** Oturum yönetimi için JWT token kullanılır
3. **Soft Delete:** Belgeler fiziksel olarak silinmez, `is_deleted` flag'i kullanılır
4. **Activity Logging:** Tüm önemli işlemler loglanır

## Local Network Yapılandırması

Bu sistem local ağda çalışmak üzere tasarlanmıştır:
- **Backend:** `http://[SUNUCU-IP]:8001`
- **Frontend:** `http://[SUNUCU-IP]:3000`
- **MongoDB:** `mongodb://localhost:27017` (sadece sunucu üzerinden erişilebilir)

Aynı ağdaki diğer bilgisayarlar frontend'e tarayıcı üzerinden erişebilir.
