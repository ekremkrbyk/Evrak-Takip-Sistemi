# Evrak Takip Sistemi - PRD

## Original Problem Statement
Kullanıcı eski Emergent hesabındaki Faz 1 sürümünü GitHub'a kaybetti; bu sürümü
yeniden inşa etmemiz gerekti. Belgeler kullanıcıya değil **birime** gidiyor,
belgeler otomatik numaralandırılıyor, yönetici onayında **damga + onay numarası**
veriliyor, cari/vendor modülü var, dashboard 5 renkli kart + aciliyet uyarısı
içeriyor, bildirimler hem in-app hem masaüstüne düşüyor.

## Architecture
- Backend: FastAPI + MongoDB (motor), JWT cookie auth
- Frontend: React + Tailwind, Phosphor icons
- File storage: Emergent Object Storage + local fallback (`backend/uploads/`)
- Email: Resend (opsiyonel)

## Department Prefix Map (14 canonical dept)
| Kod | Prefix |
|-----|--------|
| SATIN_ALMA | SAT |
| IHRACAT | IHR |
| ITHALAT | ITH |
| MUHASEBE | MUH |
| FINANS | FIN |
| IDARI_ISLER | IDA |
| INSAN_KAYNAKLARI | IK |
| URETIM_PLANLAMA | URE |
| ARGE | ARG |
| MAMUL_DEPO | MAM |
| HAMMADDE_DEPO | HAM |
| MUSTERI_HIZMETLERI | MUS |
| GUVENLIK | GUV |
| YONETIM | YON |

Belge No: `{PREFIX}-{YIL}-{SEQ:05d}` → `MUH-2026-00001`
Onay No: `{PREFIX}-{10000+SEQ}` → `YON-10000` (her birim 10k'dan başlar)

## Implemented (Faz 1 — 2026-04-22)

### Backend
- 14 birim seed + prefix (canonical + Türkçe karakter migration)
- Belge modeli: `belge_no`, `fatura_no`, `cari`, `hedef_birim`, `hedef_tarih`,
  `payment_required`, `stamp`, `current_department`
- Fatura No mükerrer kontrol (aynı numara iki kez girilemez)
- Belge yükleme → hedef birim seçimi → birim tüm kullanıcılarına bildirim
- Belge aksiyonları: `accept`, `approve (+damga+onay_no)`, `reject`, `iade`,
  `revize`, `geri_al`, `not_related`
- Yönetici sadece kendi biriminde onaylayabilir (is_manager flag)
- Cari (Vendor) CRUD + CSV bulk-import (`name,tax_no,payment_type,vade_gun,...`)
- Kategoriler endpoint (12 varsayılan: Fatura, Dekont, Sozlesme, ...)
- Dashboard stats: total/pending/approved/rejected/iade_revize
- PDF/image inline preview endpoint
- Startup department/user migration + admin role/department sync

### Frontend
- **Dashboard**: 5 renkli tıklanabilir kart + Son Belgeler tablosu
- **Documents**: Belge No, Başlık + Cari (alt satır), Fatura No, Durum,
  Gönderen, Birim, Tarih+Saat, **Hedef tarih ≤7 gün ise kırmızı satır**
- **Upload Modal**: dosya + başlık + kategori dropdown + fatura_no +
  cari autocomplete + hedef_birim + hedef_tarih + payment_required checkbox
- **Document Detail**: stamp gösterimi, PDF/image preview modal,
  Yönlendir (birime), Onayla+Damga, Reddet, İade, Revize, Geri Al,
  "Bu Birimle Alakalı Değil" butonları — yetkiye göre koşullu render
- **Vendors Page**: CRUD + ödeme tipi (çek/senet/kredi_karti/havale/nakit)
  + vade_gun + CSV import
- **Users**: `is_manager` checkbox + Yönetici rozeti
- **Layout**: Browser Notification API entegrasyonu (izin iste, yeni bildirimde
  masaüstü bildirimi)
- Arama: başlık, fatura no, cari — hepsinde çalışır

## Backlog (Faz 2 & 3)
### Faz 2 — Ödeme & Finans
- [ ] Ödeme gerekli belgeler → Finans biriminin ayrı kuyruğu
- [ ] Finans onayı + dekont yükleme
- [ ] Ödeme takvimi (vade + payment_date) + Excel export
- [ ] Çek/Senet detay ekranı (vade takibi)
- [ ] Fiş/slip hızlı yükleme akışı (fotoğraf + açıklama → damga)

### Faz 3 — Gelişmiş Özellikler
- [ ] Akış içinde ek belge ekleme
- [ ] PDF içerik analizi ile birim önerisi (LLM + cari ismi eşleme)
- [ ] Yönetici → yönetici gönderim kuralı (sadece ilgili birim yöneticisine)
- [ ] Kullanıcı "bilgim dahilinde değildir" yolu (hızlı route)
- [ ] Sıralama (her kolon için asc/desc)
- [ ] E2E regression testing (testing_agent)

## Known Limitations
- Object Storage 400 dönüyor (EMERGENT_KEY env yok); belge yükleme otomatik olarak
  `backend/uploads/` altına düşüyor (local fallback). Kullanıcı tarafında fark yok.
- Browser Notification yalnızca sayfa açıkken çalışır (PWA push şimdilik yok).

---

## 2026-04-22 Iteration — Bug fixes + Features

### Fixed Bugs
- **Belge kaybolma bug**: Finans/Muhasebe'den "revize iste", "yönlendir" vb. yaptıklarında
  belge kendi panellerinden kayboluyordu. Artık `involved_user_ids` ve
  `involved_departments` listelerine otomatik eklenip, belge akışa dahil olan
  herkesin listesinde görünüyor.
- **Local MongoDB index conflict**: Eski `vendors.name` index'i unique değilken yeni
  kod unique yaratmaya çalışıyordu → `safe_create_index` helper eski index'i drop
  edip yeniden kuruyor.
- **CORS + cookie (lokal ağ)**: Login 401 hatası için CORS artık localhost,
  192.168.x.x, 10.x.x.x ve emergentagent origin'lerini regex ile reflect ediyor.
  Cookie samesite/secure bayrakları isteğin protokolüne göre adaptif (HTTPS=none+secure,
  HTTP=lax+insecure). Login response `access_token` dönüyor → frontend
  `Authorization: Bearer` header'ı fallback olarak ekliyor (cross-origin cookie
  çalışmazsa da auth çalışır).
- **Auth log detayı**: `AUTH FAIL (no token / token expired / user not found / invalid token)`
  şeklinde açıklayıcı log çıktısı.

### New Features
- **Fiziksel Damga (PDF/Image overlay)**: Yönetici onay bastığında:
  - PDF: reportlab ile her sayfaya sağ alt köşede yeşil çerçeveli "ONAYLANDI" kutusu
    (isim, birim, onay no, tarih) basılıyor. `_stamped.pdf` olarak saklanıyor.
  - Image: Pillow ile JPG/PNG üzerine aynı kutu basılıyor.
  - Doğrulandı: Manager onayından sonra PDF ve image içinde fiziksel damga görünüyor.
- **Ek Belgeler (Attachments - Klasör Mantığı)**: Belge akışındaki her yetkili
  kullanıcı destekleyici dosyalar ekleyebiliyor. Endpoint'ler:
  - `POST /api/documents/{id}/attachments` (multipart: file, note)
  - `GET /api/documents/{id}/attachments/{aid}/download`
  - `GET /api/documents/{id}/attachments/{aid}/preview`
  - `DELETE /api/documents/{id}/attachments/{aid}` (sadece yukleyen / admin)
  - UI: Belge Detay sayfasında "Ek Belgeler" bölümü, her ek için preview/download/delete
    butonları. Ek ekleme belge_history'e de yazılıyor, gönderen kişiye bildirim gidiyor.

### Backend New Dependencies
- `pypdf==6.10.2` (PDF stamp overlay)
- `reportlab==4.4.10` (stamp rendering)
