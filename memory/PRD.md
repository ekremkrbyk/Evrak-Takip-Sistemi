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
