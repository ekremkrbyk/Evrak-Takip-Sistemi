# Evrak Takip Sistemi - PRD

## Original Problem Statement
Kullanıcı başka bir Emergent hesabında oluşturduğu Evrak Takip projesinde kaldığı yerden
devam etmek istiyor. Yaşanan sorunlar:
- Belgeler listelenirken "Belgeler yüklenirken hata oluştu"
- Cari eklerken "Not authenticated" (kod tabanında cari/vendor özelliği henüz yok,
  GitHub repo'sunda commit'lenmemiş)
- Eski DB'de kullanıcıların `department` alanı eski formatta (Yönetim, İHRACAT, vb.),
  yeni kodda ise Türkçe karaktersiz BÜYÜK HARF (YONETIM, IHRACAT, vb.). Bu uyuşmazlık
  yetki/department kontrollerini kırıyor.
- Departments endpoint herkese açık olmalı, vendors admin-only.

GitHub: https://github.com/ekremkrbyk/Evrak-Takip-Sistemi

## Architecture
- Backend: FastAPI + MongoDB (motor), JWT cookie auth
- Frontend: React + Tailwind, Phosphor icons
- File storage: Emergent Object Storage
- Email: Resend

## What's Implemented (2026-01)
- `normalize_department()` helper: Türkçe karakterleri ASCII'ye çevirir, uppercase yapar,
  `&`/boşluk/tire karakterlerini `_` ile değiştirir.
- Canonical departments: `MUHASEBE`, `IHRACAT`, `URETIM_OPERASYON`, `YONETIM`.
- **Startup migration**:
  - `db.departments` içindeki tüm kayıtları canonical formata çevirir (duplicate varsa merge eder).
  - `db.users` içindeki tüm kullanıcıların `department` alanını canonical formata günceller.
- `register`, `POST /users`, `PUT /users`, `POST /departments`, `PUT /departments`
  artık `normalize_department()` kullanıyor.
- `GET /api/departments` artık tüm authenticated kullanıcılara açık (admin-only değil).
  Yazma işlemleri (POST/PUT/DELETE) hâlâ admin-only.
- Default admin email artık geçerli bir email formatında:
  `ekrem.karabiyik@evraktakip.com` (ENV ile override edilebilir).
- Admin seed artık yalnızca parolayı değil, department ve role'ü de canonical
  formata senkronlar.
- Frontend Login.js department seçenekleri canonical isimlere güncellendi.

## Known Notes
- Object Storage init logları 400 döndürüyor (EMERGENT_LLM_KEY/storage config
  yoksa). Belge yüklemeye kalkılana kadar diğer özellikleri etkilemez.
- Cari/Vendor özelliği GitHub repo'sunda yok. Eski Emergent oturumundaki
  cari ekranı commit'lenmeden kalmış. Eklenmesi gerekiyorsa ayrı bir görev.

## Backlog (P1/P2)
- [P1] Cari/Vendor CRUD + belge ilişkisi (kullanıcı "cari eklerken hata" dedi,
  bu özellik koda eklenmeli).
- [P2] Object Storage init hatasının giderilmesi / belge yükleme doğrulaması.
- [P2] E2E testing (testing_agent) ile tüm akışların doğrulanması.
