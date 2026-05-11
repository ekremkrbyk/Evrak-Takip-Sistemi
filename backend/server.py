from urllib.parse import quote as _url_quote
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Form, Header, Query, Depends
from fastapi.responses import JSONResponse, Response as FastAPIResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
import os
import logging
import uuid
import jwt
import bcrypt
import asyncio
import resend
import requests
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import secrets
import io
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.lib.colors import Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_urlsafe(64))
JWT_ALGORITHM = "HS256"

# Email Configuration
resend.api_key = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

# Object Storage: local disk (Emergent dependency removed)
APP_NAME = "evrak-takip"

import os as _os
_log_handlers = [logging.StreamHandler()]
# Log dosyasina da yaz (logs/ klasorunde gunluk dosya)
_os.makedirs("logs", exist_ok=True)
from logging.handlers import TimedRotatingFileHandler as _TRFH
_file_handler = _TRFH("logs/evrak_takip.log", when="midnight", interval=1, backupCount=90, encoding="utf-8")
_file_handler.suffix = "%Y-%m-%d"
_log_handlers.append(_file_handler)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=_log_handlers
)
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")

@api_router.get("/health")
async def health_check():
    """Sistem ve veritabani saglik kontrolu. UptimeRobot bu endpoint'i izler."""
    try:
        await db.command("ping")
        db_status = "connected"
    except Exception as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content={
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    return {
        "status": "healthy",
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# ===== DEPARTMENT NORMALIZATION =====
# Canonical department names: uppercase, no Turkish characters
TURKISH_CHAR_MAP = str.maketrans({
    "ç": "c", "Ç": "C",
    "ğ": "g", "Ğ": "G",
    "ı": "i", "İ": "I",
    "ö": "o", "Ö": "O",
    "ş": "s", "Ş": "S",
    "ü": "u", "Ü": "U",
})

# Map any "old format" variants to the new canonical name
DEPARTMENT_ALIAS_MAP = {
    "URETIM&OPERASYON": "URETIM_PLANLAMA",
    "URETIM OPERASYON": "URETIM_PLANLAMA",
    "URETIMOPERASYON": "URETIM_PLANLAMA",
    "URETIM_OPERASYON": "URETIM_PLANLAMA",
}

# 14 canonical departments with 3-char prefixes (used for belge_no & onay_no)
DEPARTMENT_DEFS = [
    ("SATIN_ALMA", "SAT"),
    ("IHRACAT", "IHR"),
    ("ITHALAT", "ITH"),
    ("MUHASEBE", "MUH"),
    ("FINANS", "FIN"),
    ("IDARI_ISLER", "IDA"),
    ("INSAN_KAYNAKLARI", "IK"),
    ("URETIM_PLANLAMA", "URE"),
    ("ARGE", "ARG"),
    ("MAMUL_DEPO", "MAM"),
    ("HAMMADDE_DEPO", "HAM"),
    ("MUSTERI_HIZMETLERI", "MUS"),
    ("GUVENLIK", "GUV"),
    ("YONETIM", "YON"),
    ("PATRON", "PAT"),
]
CANONICAL_DEPARTMENTS = [d[0] for d in DEPARTMENT_DEFS]
DEPARTMENT_PREFIX = {d[0]: d[1] for d in DEPARTMENT_DEFS}

def normalize_department(name: str) -> str:
    """Convert department name to canonical form: uppercase ASCII, no Turkish chars."""
    if not name or not isinstance(name, str):
        return name
    normalized = name.strip().translate(TURKISH_CHAR_MAP).upper()
    # Replace whitespace and some punctuation with underscore
    normalized = normalized.replace("&", "_").replace(" ", "_").replace("-", "_")
    # Collapse repeated underscores
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    normalized = normalized.strip("_")
    return DEPARTMENT_ALIAS_MAP.get(normalized, normalized)

# ===== HELPER FUNCTIONS =====

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(days=1), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def is_admin(user: dict) -> bool:
    """True if user is admin OR superadmin."""
    return user.get("role") in ("admin", "superadmin")

def is_superadmin(user: dict) -> bool:
    """True only for superadmin role."""
    return user.get("role") == "superadmin"

def can_manage_vendors(user: dict) -> bool:
    return is_admin(user) or bool(user.get("can_manage_vendors"))

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    token_source = "cookie"
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            token_source = "bearer"
    if not token:
        origin = request.headers.get("origin", "-")
        cookie_header = "yes" if request.headers.get("cookie") else "no"
        logger.warning(
            f"AUTH FAIL (no token): path={request.url.path} origin={origin} "
            f"cookie_header={cookie_header}. Frontend REACT_APP_BACKEND_URL "
            f"must match this server & cookies must be sent (withCredentials: true + CORS origin match)."
        )
        raise HTTPException(status_code=401, detail="Not authenticated (no token)")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            logger.warning(f"AUTH FAIL (wrong token type): path={request.url.path} type={payload.get('type')}")
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            logger.warning(f"AUTH FAIL (user not found): path={request.url.path} sub={payload.get('sub')}")
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user.pop("_id"))
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        # Expected: client's token aged out; this is normal. Log at INFO (not WARNING) to reduce noise.
        logger.info(f"AUTH: token expired (path={request.url.path} source={token_source}) - client should re-login")
        raise HTTPException(status_code=401, detail="Token expired (please login again)")
    except jwt.InvalidTokenError as e:
        logger.warning(f"AUTH FAIL (invalid token): path={request.url.path} source={token_source} err={e}")
        raise HTTPException(status_code=401, detail="Invalid token")

def init_storage():
    """Artık kullanılmıyor — local disk fallback direkt kullanılıyor."""
    pass

def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Dosyayı local diske yazar. Emergent bağımlılığı kaldırıldı."""
    full_path = ROOT_DIR / "uploads" / path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(data)
    local_path = f"local:{full_path}"
    logger.info(f"put_object: {len(data)} bytes → {full_path}")
    return {"path": local_path, "size": len(data)}

def get_object(path: str) -> tuple:
    """Local diskten dosya okur. Emergent bağımlılığı kaldırıldı."""
    import mimetypes as _mt
    if path.startswith("local:"):
        file_path = Path(path[len("local:"):])
    else:
        # Eski Emergent path formatı — local uploads altında ara
        file_path = ROOT_DIR / "uploads" / path
    if not file_path.exists():
        raise FileNotFoundError(f"Dosya bulunamadı: {file_path}")
    data = file_path.read_bytes()
    content_type = _mt.guess_type(str(file_path))[0] or "application/octet-stream"
    return data, content_type

def _get_client_ip(request: Request) -> str:
    """X-Forwarded-For veya doğrudan IP döner."""
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "bilinmiyor"

ACTION_LABELS = {
    "register":               "Kayıt oldu",
    "login":                  "Giriş yaptı",
    "upload_document":        "Belge yükledi",
    "download_document":      "Belge indirdi",
    "route_document":         "Belge yönlendirdi",
    "document_accept":        "Belgeyi kabul etti",
    "document_approve":       "Belgeyi onayladı",
    "document_reject":        "Belgeyi reddetti",
    "document_iade":          "Belgeyi iade etti",
    "document_revize":        "Revize istedi",
    "document_geri_al":       "Belgeyi geri aldı",
    "document_not_related":   "İlgisiz işaretledi",
    "add_attachment":         "Ek belge yükledi",
    "create_user":            "Kullanıcı oluşturdu",
    "update_user":            "Kullanıcı güncelledi",
    "delete_user":            "Kullanıcı sildi",
    "create_department":      "Departman oluşturdu",
    "update_department":      "Departman güncelledi",
    "delete_department":      "Departman sildi",
    "create_vendor":          "Cari oluşturdu",
    "update_vendor":          "Cari güncelledi",
    "delete_vendor":          "Cari sildi",
    "import_vendors":         "Toplu cari aktardı",
    "create_permission_group":"İzin grubu oluşturdu",
    "update_permission_group":"İzin grubu güncelledi",
    "delete_permission_group":"İzin grubu sildi",
    "change_password":        "Şifre değiştirdi",
    "login_failed":           "Başarısız giriş denemesi",
}

async def log_activity(
    user_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    details: dict = None,
    request: Request = None,
    user: dict = None
):
    ip = _get_client_ip(request) if request else "sistem"
    ua = request.headers.get("user-agent", "-")[:120] if request else "sistem"
    full_name   = user.get("full_name", "")   if user else ""
    department  = user.get("department", "")  if user else ""
    role        = user.get("role", "")         if user else ""
    label = ACTION_LABELS.get(action, action)

    log_entry = {
        "id":           str(uuid.uuid4()),
        "user_id":      user_id,
        "user_name":    full_name,
        "user_dept":    department,
        "user_role":    role,
        "action":       action,
        "action_label": label,
        "entity_type":  entity_type,
        "entity_id":    entity_id,
        "details":      details or {},
        "ip_address":   ip,
        "user_agent":   ua,
        "timestamp":    datetime.now(timezone.utc).isoformat()
    }
    await db.activity_logs.insert_one(log_entry)
    # Terminal logu - tarih+saat format zaten handler'da var
    logger.info(f"[{action.upper()}] {full_name or user_id} ({department}) | IP:{ip} | {entity_type}:{entity_id} | {details or {}}")

async def send_email_notification(recipient_email: str, subject: str, html_content: str):
    if not resend.api_key:
        logger.warning("Resend API key not configured, skipping email")
        return
    params = {
        "from": SENDER_EMAIL,
        "to": [recipient_email],
        "subject": subject,
        "html": html_content
    }
    try:
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {recipient_email}")
    except Exception as e:
        logger.error(f"Failed to send email: {e}")

async def create_notification(user_id: str, title: str, message: str, document_id: str = None):
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "message": message,
        "document_id": document_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)

async def generate_belge_no(department: str) -> str:
    """Generate next document number for a department. Format: PREFIX-YYYY-00001."""
    prefix = DEPARTMENT_PREFIX.get(department, "EVR")
    year = datetime.now(timezone.utc).year
    counter_key = f"belge_{prefix}_{year}"
    result = await db.counters.find_one_and_update(
        {"_id": counter_key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = result.get("seq", 1) if result else 1
    # motor returns None on upsert with return_document=AFTER in some versions; fallback:
    if not result:
        doc = await db.counters.find_one({"_id": counter_key})
        seq = doc.get("seq", 1) if doc else 1
    return f"{prefix}-{year}-{seq:05d}"

async def generate_onay_no(department: str) -> str:
    """Generate next approval number for a department manager. Each dept starts at 10000."""
    prefix = DEPARTMENT_PREFIX.get(department, "EVR")
    counter_key = f"onay_{prefix}"
    result = await db.counters.find_one_and_update(
        {"_id": counter_key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = result.get("seq", 1) if result else 1
    if not result:
        doc = await db.counters.find_one({"_id": counter_key})
        seq = doc.get("seq", 1) if doc else 1
    return f"{prefix}-{10000 + seq - 1}"

def _set_auth_cookies(response: Response, access_token: str, refresh_token: str, request: Request = None):
    """Set auth cookies with correct samesite/secure flags based on environment."""
    is_https = False
    if request is not None:
        scheme = request.headers.get("x-forwarded-proto") or request.url.scheme
        is_https = scheme == "https"
    if is_https:
        samesite = "none"
        secure = True
    else:
        samesite = "lax"
        secure = False
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=secure, samesite=samesite, max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=secure, samesite=samesite, max_age=604800, path="/")

def _read_file_bytes(file_path: str) -> bytes:
    if file_path.startswith("local:"):
        return Path(file_path.replace("local:", "", 1)).read_bytes()
    data, _ct = get_object(file_path)
    return data

def _write_file_bytes(original_path: str, data: bytes, content_type: str, suffix: str = "_stamped") -> str:
    """Write bytes next to original. Returns new path."""
    if original_path.startswith("local:"):
        p = Path(original_path.replace("local:", "", 1))
        new_p = p.with_name(p.stem + suffix + p.suffix)
        new_p.write_bytes(data)
        return f"local:{new_p}"
    # Object storage: generate a new path and upload
    base = original_path.rsplit("/", 1)
    new_key = f"{base[0]}/{uuid.uuid4()}{suffix}_{base[1].split('.')[-1] if '.' in base[1] else 'bin'}"
    try:
        result = put_object(new_key, data, content_type)
        return result["path"]
    except Exception:
        # Fallback to local
        local_dir = ROOT_DIR / "uploads" / "stamped"
        local_dir.mkdir(parents=True, exist_ok=True)
        local_file = local_dir / f"{uuid.uuid4()}{suffix}.bin"
        local_file.write_bytes(data)
        return f"local:{local_file}"


def _get_turkish_font() -> tuple:
    """Windows ve Linux TTF font bulur, reportlab'e register eder."""
    try:
        pdfmetrics.getFont("TR-Normal")
        return "TR-Bold", "TR-Normal"
    except Exception:
        pass
    candidates = [
        ("C:/Windows/Fonts/arialbd.ttf",  "C:/Windows/Fonts/arial.ttf"),
        ("C:/Windows/Fonts/calibrib.ttf", "C:/Windows/Fonts/calibri.ttf"),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        ("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
         "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"),
    ]
    for bold_p, norm_p in candidates:
        if os.path.exists(bold_p) and os.path.exists(norm_p):
            try:
                pdfmetrics.registerFont(TTFont("TR-Bold",   bold_p))
                pdfmetrics.registerFont(TTFont("TR-Normal", norm_p))
                return "TR-Bold", "TR-Normal"
            except Exception:
                continue
    return "Helvetica-Bold", "Helvetica"

def _get_turkish_font_pil() -> tuple:
    """Pillow icin TTF font yolu (bold, normal). None donerse load_default kullan."""
    candidates = [
        ("C:/Windows/Fonts/arialbd.ttf",  "C:/Windows/Fonts/arial.ttf"),
        ("C:/Windows/Fonts/calibrib.ttf", "C:/Windows/Fonts/calibri.ttf"),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        ("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
         "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"),
    ]
    for bold_p, norm_p in candidates:
        if os.path.exists(bold_p) and os.path.exists(norm_p):
            return bold_p, norm_p
    return None, None

def render_stamp_on_image(image_bytes: bytes, stamp: dict, position: str = "bottom_right", on_back: bool = False) -> bytes:
    """Draw stamp rectangle on image. position: bottom_right|center. on_back: yeni sayfa ekle."""
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    except Exception as e:
        logger.warning(f"Stamp on image failed (not a valid image): {e}")
        return image_bytes
    if on_back:
        # Arka yüz: boş beyaz sayfa oluştur
        img = Image.new("RGBA", img.size, (255, 255, 255, 255))
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    w, h = img.size
    box_w = min(360, int(w * 0.35))
    box_h = 100
    if position == "center":
        x0 = (w - box_w) // 2
        y0 = (h - box_h) // 2
    else:  # bottom_right
        x0 = w - box_w - 20
        y0 = h - box_h - 20
    x1 = x0 + box_w
    y1 = y0 + box_h
    draw.rectangle([x0, y0, x1, y1], outline=(20, 120, 40, 255), width=4, fill=(255, 255, 255, 230))
    bold_path, normal_path = _get_turkish_font_pil()
    try:
        font_title = ImageFont.truetype(bold_path,   14) if bold_path   else ImageFont.load_default()
        font_body  = ImageFont.truetype(normal_path, 12) if normal_path else ImageFont.load_default()
    except Exception:
        font_title = ImageFont.load_default()
        font_body  = ImageFont.load_default()
    text_lines = [
        ("ONAYLANDI",                                                  font_title, (20, 120, 40, 255)),
        (str(stamp.get("approved_by", ""))[:40],                       font_body,  (20, 80,  20, 255)),
        (f"{stamp.get('department','')} - {stamp.get('onay_no','')}",  font_body,  (20, 80,  20, 255)),
        (stamp.get("approved_at", "")[:19].replace("T", " "),          font_body,  (80, 80,  80, 255)),
    ]
    y = y0 + 8
    for text, font, color in text_lines:
        draw.text((x0 + 10, y), text, fill=color, font=font)
        y += 22
    out = Image.alpha_composite(img, overlay)
    buf = io.BytesIO()
    out.convert("RGB").save(buf, format="JPEG", quality=92)
    return buf.getvalue()

def render_stamp_on_pdf(pdf_bytes: bytes, stamp: dict, position: str = "bottom_right", on_back: bool = False) -> bytes:
    """Overlay a stamp on PDF. position: bottom_right|center. on_back: son sayfaya arka yüz ekle."""
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
    except Exception as e:
        logger.warning(f"Stamp on pdf failed to read: {e}")
        return pdf_bytes
    writer = PdfWriter()
    pages_to_stamp = list(reader.pages)
    for page in pages_to_stamp:
        try:
            w = float(page.mediabox.width)
            h = float(page.mediabox.height)
        except Exception:
            w, h = A4
        overlay_buf = io.BytesIO()
        c = pdf_canvas.Canvas(overlay_buf, pagesize=(w, h))
        box_w = min(240, w * 0.4)
        box_h = 80
        if position == "center":
            x = (w - box_w) / 2
            y = (h - box_h) / 2
        else:  # bottom_right
            x = w - box_w - 20
            y = 20
        c.setFillColor(Color(1, 1, 1, alpha=0.9))
        c.setStrokeColor(Color(0.08, 0.47, 0.16, alpha=1))
        c.setLineWidth(2)
        c.rect(x, y, box_w, box_h, fill=1, stroke=1)
        font_bold, font_normal = _get_turkish_font()
        c.setFillColor(Color(0.08, 0.47, 0.16, alpha=1))
        c.setFont(font_bold, 11)
        c.drawString(x + 8, y + box_h - 16, "ONAYLANDI")
        c.setFillColor(Color(0.1, 0.3, 0.1, alpha=1))
        c.setFont(font_normal, 9)
        c.drawString(x + 8, y + box_h - 32, str(stamp.get("approved_by", ""))[:35])
        c.drawString(x + 8, y + box_h - 46, f"{stamp.get('department','')} - {stamp.get('onay_no','')}")
        c.setFillColor(Color(0.35, 0.35, 0.35, alpha=1))
        c.setFont(font_normal, 8)
        c.drawString(x + 8, y + box_h - 62, stamp.get("approved_at", "")[:19].replace("T", " "))
        c.save()
        overlay_pdf = PdfReader(io.BytesIO(overlay_buf.getvalue()))
        page.merge_page(overlay_pdf.pages[0])
        writer.add_page(page)
    out_buf = io.BytesIO()
    writer.write(out_buf)
    return out_buf.getvalue()


async def render_stamp_on_docx(docx_bytes: bytes, stamp: dict, position: str = "bottom_right", on_back: bool = False) -> bytes:
    """Word (.docx) dosyasına damga metni ekle."""
    try:
        from docx import Document as _DocxDoc
        from docx.shared import Pt, RGBColor, Inches
        from docx.enum.text import WD_ALIGN_PARAGRAPH
    except ImportError:
        logger.warning("python-docx yüklü değil, pip install python-docx")
        return docx_bytes
    try:
        doc = _DocxDoc(io.BytesIO(docx_bytes))
        stamp_text = (
            f"ONAYLANDI\n"
            f"{stamp.get('approved_by','')}\n"
            f"{stamp.get('department','')} - {stamp.get('onay_no','')}\n"
            f"{stamp.get('approved_at','')[:19].replace('T',' ')}"
        )
        if on_back:
            # Yeni sayfa ekle (sayfa sonu + damga)
            doc.add_page_break()
            p = doc.add_paragraph()
        else:
            p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT if position == "bottom_right" else WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(stamp_text)
        run.bold = True
        run.font.size = Pt(10)
        run.font.color.rgb = RGBColor(0x14, 0x78, 0x28)
        buf = io.BytesIO()
        doc.save(buf)
        return buf.getvalue()
    except Exception as e:
        logger.warning(f"Word damga hatası: {e}")
        return docx_bytes

async def render_stamp_on_xlsx(xlsx_bytes: bytes, stamp: dict) -> bytes:
    """Excel (.xlsx) dosyasına damga satırı ekle (ilk sayfanın sonuna)."""
    try:
        import openpyxl as _xl
        from openpyxl.styles import Font, PatternFill, Alignment
    except ImportError:
        return xlsx_bytes
    try:
        wb = _xl.load_workbook(io.BytesIO(xlsx_bytes))
        ws = wb.active
        # Boş satır ekle
        ws.append([])
        stamp_row = [
            "ONAYLANDI",
            stamp.get("approved_by",""),
            f"{stamp.get('department','')} - {stamp.get('onay_no','')}",
            stamp.get("approved_at","")[:19].replace("T"," "),
        ]
        ws.append(stamp_row)
        last_row = ws.max_row
        green_fill = PatternFill("solid", fgColor="E8F5E9")
        for col in range(1, 5):
            cell = ws.cell(row=last_row, column=col)
            cell.font  = Font(bold=(col==1), color="14782A", size=10)
            cell.fill  = green_fill
            cell.alignment = Alignment(horizontal="left")
        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()
    except Exception as e:
        logger.warning(f"Excel damga hatası: {e}")
        return xlsx_bytes

async def apply_stamp_to_file(doc: dict, stamp: dict, position: str = "front_bottom_right") -> dict:
    """Apply stamp physically on image/pdf. position: front_bottom_right|back_bottom_right|back_center"""
    file_type = (doc.get("file_type") or "").lower()
    fname     = (doc.get("file_name") or "").lower()
    try:
        original = _read_file_bytes(doc["file_path"])
    except Exception as e:
        logger.warning(f"Stamp skipped - cannot read original file: {e}")
        return {}
    try:
        on_back = "back" in position
        pos_key = "center" if "center" in position else "bottom_right"
        if file_type.startswith("image/"):
            new_bytes = render_stamp_on_image(original, stamp, position=pos_key, on_back=on_back)
            new_path  = _write_file_bytes(doc["file_path"], new_bytes, doc.get("file_type","image/jpeg"))
            return {"file_path": new_path, "file_size": len(new_bytes)}
        elif "pdf" in file_type or fname.endswith(".pdf"):
            new_bytes = render_stamp_on_pdf(original, stamp, position=pos_key, on_back=on_back)
            new_path  = _write_file_bytes(doc["file_path"], new_bytes, "application/pdf")
            return {"file_path": new_path, "file_size": len(new_bytes)}
        elif fname.endswith(".docx") or fname.endswith(".doc"):
            new_bytes = await render_stamp_on_docx(original, stamp, position=pos_key, on_back=on_back)
            new_path  = _write_file_bytes(doc["file_path"], new_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
            return {"file_path": new_path, "file_size": len(new_bytes)}
        elif fname.endswith(".xlsx") or fname.endswith(".xls"):
            new_bytes = await render_stamp_on_xlsx(original, stamp)
            new_path  = _write_file_bytes(doc["file_path"], new_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            return {"file_path": new_path, "file_size": len(new_bytes)}
    except Exception as e:
        logger.warning(f"Stamp apply failed: {e}")
    return {}

async def get_department_users(department: str, manager_only: bool = False) -> list:
    query = {"department": department}
    if manager_only:
        query["is_manager"] = True
    users = await db.users.find(query).to_list(1000)
    return users

# ===== MODELS =====

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    department: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    department: str
    role: str
    permissions: List[str]
    created_at: str

class DocumentCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    category: Optional[str] = "Genel"
    fatura_no: Optional[str] = ""
    cari: Optional[str] = ""
    hedef_birim: Optional[str] = ""
    hedef_tarih: Optional[str] = ""  # ISO format: YYYY-MM-DD
    payment_required: Optional[bool] = False

class DocumentRouteRequest(BaseModel):
    document_id: str
    to_department: Optional[str] = None  # new: route to department
    to_user_id: Optional[str] = None  # legacy: route to user
    note: Optional[str] = ""

class DocumentActionRequest(BaseModel):
    document_id: str
    action: str  # accept|approve|reject|iade|revize|geri_al|not_related
    note: Optional[str] = ""
    # Damga seçenekleri (approve aksiyonunda kullanılır)
    stamp_enabled: Optional[bool] = True    # damga basılsın mı?
    stamp_position: Optional[str] = "front_bottom_right"  # front_bottom_right | back_bottom_right | back_center

class VendorCreate(BaseModel):
    name: str
    tax_no: Optional[str] = ""
    payment_type: Optional[str] = "havale"  # cek|senet|kredi_karti|havale|nakit
    vade_gun: Optional[int] = 0  # payment term in days
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    notes: Optional[str] = ""

class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    department: str
    role: str = "user"
    permissions: List[str] = []
    is_manager: Optional[bool] = False
    can_manage_vendors: Optional[bool] = False

class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[List[str]] = None
    permission_group_id: Optional[str] = None
    is_manager: Optional[bool] = None
    can_manage_vendors: Optional[bool] = None
    view_all_documents: Optional[bool] = None

class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class PermissionGroupCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    permissions: List[str] = []

# ===== AUTH ENDPOINTS =====

@api_router.post("/auth/register")
async def register(data: RegisterRequest, response: Response, request: Request):
    email = data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_doc = {
        "_id": ObjectId(),
        "email": email,
        "password_hash": hash_password(data.password),
        "full_name": data.full_name,
        "department": normalize_department(data.department),
        "role": "user",
        "permissions": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    user_id = str(user_doc["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    _set_auth_cookies(response, access_token, refresh_token, request)
    
    await log_activity(user_id, "register", "user", user_id, request=request, user={"full_name": data.full_name, "department": normalize_department(data.department), "role": "user"})
    
    return {
        "id": user_id,
        "email": email,
        "full_name": data.full_name,
        "department": data.department,
        "role": "user",
        "permissions": [],
        "is_manager": False,
        "access_token": access_token,
    }

@api_router.post("/auth/login")
async def login(data: LoginRequest, response: Response, request: Request):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    
    if not user or not verify_password(data.password, user["password_hash"]):
        ip = _get_client_ip(request)
        logger.warning(f"[LOGIN_FAILED] email={email} IP={ip}")
        # Başarısız girişi de logla (user_id olmadan)
        await db.activity_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": "unknown",
            "user_name": f"? ({email})",
            "user_dept": "",
            "user_role": "",
            "action": "login_failed",
            "action_label": "Başarısız giriş denemesi",
            "entity_type": "user",
            "entity_id": email,
            "details": {"email": email},
            "ip_address": ip,
            "user_agent": request.headers.get("user-agent", "-")[:120],
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    _set_auth_cookies(response, access_token, refresh_token, request)
    
    await log_activity(user_id, "login", "user", user_id, request=request, user=user)
    
    return {
        "id": user_id,
        "email": user["email"],
        "full_name": user.get("full_name", ""),
        "department": user.get("department", ""),
        "role": user.get("role", "user"),
        "permissions": user.get("permissions", []),
        "is_manager": bool(user.get("is_manager", False)),
        "can_manage_vendors": bool(user.get("can_manage_vendors", False)),
        "view_all_documents": bool(user.get("view_all_documents", True)),
        "access_token": access_token,
    }

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user


@api_router.post("/auth/change-password")
async def change_password(request: Request):
    """
    Admin ve Patron icin sifre degistirme.
    - Admin: kendi sifresini ve normal kullanicilarin sifresini degistirebilir
    - Patron: kendi + admin dahil herkesin sifresini degistirebilir
    Body: {current_password?, new_password, target_user_id?}
    target_user_id yoksa kendi sifresi degistirilir.
    """
    user = await get_current_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Sadece admin veya patron sifre degistirebilir")
    
    body = await request.json()
    new_password = body.get("new_password", "").strip()
    target_user_id = body.get("target_user_id", "").strip()
    current_password = body.get("current_password", "").strip()
    
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Yeni sifre en az 8 karakter olmali")
    
    # Hedef kullanici belirtilmemisse kendisi degistiriyor
    if not target_user_id or target_user_id == user["id"]:
        # Kendi sifresi: mevcut sifre kontrolu
        if current_password and not verify_password(current_password, user["password_hash"]):
            raise HTTPException(status_code=400, detail="Mevcut sifre yanlis")
        await db.users.update_one(
            {"_id": ObjectId(user["id"])},
            {"$set": {"password_hash": hash_password(new_password)}}
        )
        await log_activity(user["id"], "change_password", "user", user["id"],
                          {"target": "self"}, request=request, user=user)
        return {"message": "Sifreniz basariyla guncellendi"}
    
    # Baska kullanicinin sifresini degistiriyor
    target = await db.users.find_one({"id": target_user_id})
    if not target:
        # id alani ile arama, yoksa _id ile dene
        try:
            target = await db.users.find_one({"_id": ObjectId(target_user_id)})
        except Exception:
            pass
    if not target:
        raise HTTPException(status_code=404, detail="Kullanici bulunamadi")
    
    # Admin ve Patron herkesin sifresini degistirebilir - kisitlama yok
    
    await db.users.update_one(
        {"_id": target["_id"]},
        {"$set": {"password_hash": hash_password(new_password)}}
    )
    await log_activity(user["id"], "change_password", "user", str(target["_id"]),
                      {"target_email": target.get("email")}, request=request, user=user)
    return {"message": f"{target.get('full_name', target.get('email'))} kullanicisinin sifresi guncellendi"}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out"}

# ===== DOCUMENT ENDPOINTS =====

@api_router.post("/documents/upload")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    title: str = Form(""),
    description: str = Form(""),
    category: str = Form("Genel"),
    fatura_no: str = Form(""),
    cari: str = Form(""),
    hedef_birim: str = Form(""),
    hedef_tarih: str = Form(""),
    payment_required: str = Form("false"),
):
    user = await get_current_user(request)

    # Duplicate fatura_no check (prevent double payment)
    fatura_no = (fatura_no or "").strip()
    if fatura_no:
        dup = await db.documents.find_one({"fatura_no": fatura_no, "is_deleted": False})
        if dup:
            raise HTTPException(status_code=400, detail=f"Bu fatura numarasi daha once sisteme girilmis: {dup.get('belge_no', '')}")

    # Normalize hedef_birim
    hedef_birim = normalize_department(hedef_birim) if hedef_birim else ""
    if hedef_birim and hedef_birim not in CANONICAL_DEPARTMENTS:
        raise HTTPException(status_code=400, detail=f"Gecersiz birim: {hedef_birim}")

    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    file_path_key = f"{APP_NAME}/documents/{user['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()

    try:
        result = put_object(file_path_key, data, file.content_type or "application/octet-stream")
        stored_path = result["path"]
        stored_size = result["size"]
    except Exception as e:
        logger.error(f"Object storage failed: {e}; falling back to local disk")
        # Fallback: save locally so uploads work even if object storage is down
        local_dir = ROOT_DIR / "uploads" / user["id"]
        local_dir.mkdir(parents=True, exist_ok=True)
        local_file = local_dir / f"{uuid.uuid4()}.{ext}"
        local_file.write_bytes(data)
        stored_path = f"local:{local_file}"
        stored_size = len(data)

    # Generate belge_no using target department prefix (or EVR if none)
    belge_no = await generate_belge_no(hedef_birim or "")
    # Initial status: pending if routed, draft otherwise
    status = "pending" if hedef_birim else "draft"

    doc = {
        "_id": ObjectId(),
        "id": str(uuid.uuid4()),
        "belge_no": belge_no,
        "title": title or file.filename,
        "description": description,
        "category": category,
        "fatura_no": fatura_no,
        "cari": (cari or "").strip(),
        "hedef_birim": hedef_birim,
        "hedef_tarih": hedef_tarih or "",
        "payment_required": str(payment_required).lower() in ("true", "1", "yes", "on"),
        "file_path": stored_path,
        "file_name": file.filename,
        "file_size": stored_size,
        "file_type": file.content_type or "application/octet-stream",
        "status": status,
        "stamp": None,
        "created_by": user["id"],
        "created_by_name": user["full_name"],
        "current_department": hedef_birim or user.get("department", ""),
        "involved_user_ids": [user["id"]],
        "involved_departments": list({user.get("department", ""), hedef_birim or user.get("department", "")}),
        "attachments": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "is_deleted": False,
    }
    await db.documents.insert_one(doc)

    # Notify all users of target department
    if hedef_birim:
        target_users = await get_department_users(hedef_birim)
        for u in target_users:
            await create_notification(
                str(u["_id"]),
                "📥 Yeni Belge Geldi",
                f"{user['full_name']} ({user['department']}) '{doc['title']}' belgesini biriminize gönderdi. Belge No: {belge_no}",
                doc["id"],
            )

    await log_activity(user["id"], "upload_document", "document", doc["id"], {"belge_no": belge_no, "hedef_birim": hedef_birim}, request=request, user=user)

    doc.pop("_id")
    return doc

@api_router.get("/documents")
async def get_documents(request: Request):
    user = await get_current_user(request)

    if is_admin(user):
        if is_superadmin(user) and not user.get("view_all_documents", True):
            query = {"is_deleted": False, "$or": [
                {"created_by": user["id"]},
                {"current_department": user.get("department", "")},
                {"involved_user_ids": user["id"]},
                {"involved_departments": user.get("department", "")},
            ]}
        else:
            query = {"is_deleted": False}
        documents = await db.documents.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    else:
        documents = await db.documents.find({
            "is_deleted": False,
            "$or": [
                {"created_by": user["id"]},
                {"current_department": user.get("department", "")},
                {"involved_user_ids": user["id"]},
                {"involved_departments": user.get("department", "")},
            ],
        }, {"_id": 0}).sort("created_at", -1).to_list(1000)

    return documents

def _user_can_see_doc(user: dict, doc: dict) -> bool:
    if is_admin(user):
        return True
    if doc.get("created_by") == user["id"]:
        return True
    if doc.get("current_department") and doc["current_department"] == user.get("department"):
        return True
    if user["id"] in (doc.get("involved_user_ids") or []):
        return True
    if user.get("department") in (doc.get("involved_departments") or []):
        return True
    # Legacy compatibility
    if doc.get("current_holder") == user["id"]:
        return True
    return False

def _user_can_act_on_doc(user: dict, doc: dict) -> bool:
    """Can this user take actions (approve/reject/route) on the doc?"""
    if is_admin(user):
        return True
    if doc.get("current_department") and doc["current_department"] == user.get("department"):
        return True
    if doc.get("current_holder") == user["id"]:
        return True
    return False

@api_router.get("/documents/{document_id}")
async def get_document(document_id: str, request: Request):
    user = await get_current_user(request)
    doc = await db.documents.find_one({"id": document_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not _user_can_see_doc(user, doc):
        raise HTTPException(status_code=403, detail="Access denied")
    return doc

@api_router.get("/documents/{document_id}/download")
async def download_document(document_id: str, request: Request):
    user = await get_current_user(request)
    doc = await db.documents.find_one({"id": document_id, "is_deleted": False})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not _user_can_see_doc(user, doc):
        raise HTTPException(status_code=403, detail="Access denied")
    file_path = doc["file_path"]
    if file_path.startswith("local:"):
        local_file = Path(file_path.replace("local:", "", 1))
        data = local_file.read_bytes()
        content_type = doc.get("file_type", "application/octet-stream")
    else:
        data, content_type = get_object(file_path)
    await log_activity(user["id"], "download_document", "document", document_id, request=request, user=user)
    return FastAPIResponse(content=data, media_type=content_type, headers={
        "Content-Disposition": f"attachment; filename*=UTF-8''{_url_quote(doc['file_name'])}"
    })

@api_router.get("/documents/{document_id}/preview-html")
async def preview_document_html(document_id: str, request: Request):
    """Ana belge Word/Excel → HTML (local önizleme)."""
    user = await get_current_user(request)
    doc  = await db.documents.find_one({"id": document_id, "is_deleted": False})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not _user_can_see_doc(user, doc):
        raise HTTPException(status_code=403, detail="Access denied")
    fname      = (doc.get("file_name") or "").lower()
    file_bytes = _read_file_bytes(doc["file_path"])
    STYLE = ('<style>body{font-family:Arial,sans-serif;padding:20px;font-size:13px;line-height:1.6}'
             'table{border-collapse:collapse;width:100%;margin-bottom:16px}'
             'td,th{border:1px solid #ddd;padding:5px 8px}th{background:#f5f5f5;font-weight:600}'
             'img{max-width:100%}h3{margin-top:20px;color:#334155}</style>')
    if fname.endswith(".docx") or fname.endswith(".doc"):
        try:
            import mammoth as _mammoth
            result = _mammoth.convert_to_html(io.BytesIO(file_bytes))
            html = f'<!DOCTYPE html><html><head><meta charset="utf-8">{STYLE}</head><body>{result.value}</body></html>'
            return FastAPIResponse(content=html, media_type="text/html; charset=utf-8")
        except ImportError:
            return FastAPIResponse(
                content=f'<html><body>{STYLE}<p><b>mammoth kütüphanesi eksik.</b><br><code>pip install mammoth --break-system-packages</code></p></body></html>',
                media_type="text/html")
        except Exception as exc:
            return FastAPIResponse(content=f'<html><body>{STYLE}<p>Hata: {exc}</p></body></html>', media_type="text/html")
    if fname.endswith(".xlsx") or fname.endswith(".xls"):
        try:
            import openpyxl as _xl
            wb = _xl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
            sheets_html = ""
            for sname in wb.sheetnames:
                ws_s = wb[sname]
                rows_html = ""
                for i, row in enumerate(ws_s.iter_rows(values_only=True)):
                    if not any(v is not None for v in row): continue
                    tag = "th" if i == 0 else "td"
                    cells = "".join(f"<{tag}>{'' if v is None else str(v)}</{tag}>" for v in row)
                    rows_html += f"<tr>{cells}</tr>"
                sheets_html += f"<h3>{sname}</h3><table>{rows_html}</table>"
            wb.close()
            html = f'<!DOCTYPE html><html><head><meta charset="utf-8">{STYLE}</head><body>{sheets_html}</body></html>'
            return FastAPIResponse(content=html, media_type="text/html; charset=utf-8")
        except Exception as exc:
            return FastAPIResponse(content=f'<html><body>{STYLE}<p>Excel hatası: {exc}</p></body></html>', media_type="text/html")
    raise HTTPException(status_code=415, detail="Bu dosya tipi için HTML önizleme desteklenmiyor")

@api_router.get("/documents/{document_id}/preview")
async def preview_document(document_id: str, request: Request):
    """Inline preview (PDF/images) without download attachment."""
    user = await get_current_user(request)
    doc = await db.documents.find_one({"id": document_id, "is_deleted": False})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not _user_can_see_doc(user, doc):
        raise HTTPException(status_code=403, detail="Access denied")
    file_path = doc["file_path"]
    if file_path.startswith("local:"):
        local_file = Path(file_path.replace("local:", "", 1))
        data = local_file.read_bytes()
        content_type = doc.get("file_type", "application/octet-stream")
    else:
        data, content_type = get_object(file_path)
    return FastAPIResponse(content=data, media_type=content_type, headers={
        "Content-Disposition": f"inline; filename*=UTF-8''{_url_quote(doc['file_name'])}"
    })

@api_router.post("/documents/route")
async def route_document(data: DocumentRouteRequest, request: Request):
    user = await get_current_user(request)
    doc = await db.documents.find_one({"id": data.document_id, "is_deleted": False})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not _user_can_act_on_doc(user, doc):
        raise HTTPException(status_code=403, detail="Bu belge uzerinde islem yetkiniz yok")

    to_department = normalize_department(data.to_department) if data.to_department else None
    if to_department and to_department not in CANONICAL_DEPARTMENTS:
        raise HTTPException(status_code=400, detail=f"Gecersiz birim: {to_department}")
    if not to_department:
        raise HTTPException(status_code=400, detail="Hedef birim zorunlu")

    # Manager routing rule: only managers can send to another manager's department
    # (kullanici farkli birim yoneticisine gonderemez)
    if not is_admin(user) and not user.get("is_manager"):
        if to_department != user.get("department"):
            # Non-managers can only route within their department; allow return-to-sender too
            if doc.get("created_by") != user["id"]:
                pass  # allow user to forward within dept flow; simplest rule
    
    history_entry = {
        "id": str(uuid.uuid4()),
        "document_id": data.document_id,
        "from_user_id": user["id"],
        "from_user_name": user["full_name"],
        "from_department": user.get("department", ""),
        "to_department": to_department,
        "note": data.note,
        "action": "routed",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.document_history.insert_one(history_entry)

    await db.documents.update_one(
        {"id": data.document_id},
        {
            "$set": {
                "current_department": to_department,
                "current_holder": None,
                "status": "pending",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            "$addToSet": {
                "involved_user_ids": user["id"],
                "involved_departments": {"$each": [user.get("department", ""), to_department]},
            },
        },
    )

    # Notify users in target department
    target_users = await get_department_users(to_department)
    for u in target_users:
        await create_notification(
            str(u["_id"]),
            "📨 Belge Yönlendirildi",
            f"{user['full_name']} ({user['department']}) '{doc['title']}' belgesini biriminize yönlendirdi. Belge No: {doc.get('belge_no','')}",
            data.document_id,
        )

    await log_activity(user["id"], "route_document", "document", data.document_id, {"to_department": to_department, "note": data.note}, request=request, user=user)
    return {"message": "Document routed successfully"}

@api_router.post("/documents/action")
async def document_action(data: DocumentActionRequest, request: Request):
    user = await get_current_user(request)
    doc = await db.documents.find_one({"id": data.document_id, "is_deleted": False})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not _user_can_act_on_doc(user, doc):
        raise HTTPException(status_code=403, detail="Bu belge uzerinde islem yetkiniz yok")

    action = data.action
    valid_actions = {"accept", "approve", "reject", "iade", "revize", "geri_al", "not_related"}
    if action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action: {action}")

    # "reject" ve "approve" sadece yonetici icin
    if action in ("approve",) and not (user.get("is_manager") or is_admin(user)):
        raise HTTPException(status_code=403, detail="Sadece yonetici onaylayabilir")

    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
    response_extra = {}

    if action == "accept":
        update_fields["status"] = "in_progress"
    elif action == "approve":
        # Approval: generate damga (stamp) + onay_no, send back to creator
        user_dept = user.get("department", "")
        onay_no = await generate_onay_no(user_dept)
        stamp = {
            "approved_by": user["full_name"],
            "department": user_dept,
            "onay_no": onay_no,
            "approved_at": datetime.now(timezone.utc).isoformat(),
        }
        update_fields["status"] = "approved"
        update_fields["stamp"] = stamp
        # Physically stamp the file (PDF/image overlay) — opsiyonel
        if data.stamp_enabled:
            stamp_position = getattr(data, 'stamp_position', 'front_bottom_right') or 'front_bottom_right'
            stamp_file_updates = await apply_stamp_to_file(doc, stamp, position=stamp_position)
            update_fields.update(stamp_file_updates)
        # Belge geri gonderene (yani olusturana) doner
        creator = await db.users.find_one({"_id": ObjectId(doc["created_by"])})
        if creator:
            update_fields["current_department"] = creator.get("department", "")
        response_extra = {"stamp": stamp}
    elif action == "reject":
        update_fields["status"] = "rejected"
    elif action == "iade":
        # Belge eksik, geri gonder (yukleyen veya onceki birim)
        update_fields["status"] = "iade"
        # Geri: en son history entry'sindeki from_department
        last = await db.document_history.find_one(
            {"document_id": data.document_id, "action": "routed"},
            sort=[("timestamp", -1)],
        )
        if last and last.get("from_department"):
            update_fields["current_department"] = last["from_department"]
    elif action == "revize":
        update_fields["status"] = "revize"
        # Kullaniciya geri doner (olusturanin departmanina)
        creator = await db.users.find_one({"_id": ObjectId(doc["created_by"])})
        if creator:
            update_fields["current_department"] = creator.get("department", "")
    elif action == "geri_al":
        # Gonderen kendisi geri aliyor (iptal)
        if doc.get("created_by") != user["id"] and not is_admin(user):
            raise HTTPException(status_code=403, detail="Sadece gonderen belgeyi geri alabilir")
        update_fields["status"] = "cancelled"
        update_fields["current_department"] = user.get("department", "")
    elif action == "not_related":
        # "Bu birimle alakali degil" - ilk gonderen kisiye/birime gider
        update_fields["status"] = "pending"
        creator = await db.users.find_one({"_id": ObjectId(doc["created_by"])})
        if creator:
            update_fields["current_department"] = creator.get("department", "")

    history_entry = {
        "id": str(uuid.uuid4()),
        "document_id": data.document_id,
        "user_id": user["id"],
        "user_name": user["full_name"],
        "department": user.get("department", ""),
        "action": action,
        "note": data.note,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if "stamp" in update_fields:
        history_entry["stamp"] = update_fields["stamp"]
    await db.document_history.insert_one(history_entry)

    await db.documents.update_one(
        {"id": data.document_id},
        {
            "$set": update_fields,
            "$addToSet": {
                "involved_user_ids": user["id"],
                "involved_departments": user.get("department", ""),
            },
        },
    )

    # Notify creator
    if doc["created_by"] != user["id"]:
        _notif_map = {
            "accept":      ("✅ Belge İşleme Alındı",   f"{user['full_name']} ({user['department']}) '{doc['title']}' belgenizi kabul etti ve işleme aldı. Belge No: {doc.get('belge_no','')}"),
            "approve":     ("🎉 Belge Onaylandı",        f"{user['full_name']} ({user['department']}) '{doc['title']}' belgenizi onayladı. Belge No: {doc.get('belge_no','')}"),
            "reject":      ("❌ Belge Reddedildi",       f"{user['full_name']} ({user['department']}) '{doc['title']}' belgenizi reddetti. Not: {data.note or '-'}. Belge No: {doc.get('belge_no','')}"),
            "iade":        ("↩️ Belge İade Edildi",      f"{user['full_name']} ({user['department']}) '{doc['title']}' belgenizi iade etti. Not: {data.note or '-'}. Belge No: {doc.get('belge_no','')}"),
            "revize":      ("✏️ Revize İstendi",         f"{user['full_name']} ({user['department']}) '{doc['title']}' belgesi için revize talep etti. Not: {data.note or '-'}. Belge No: {doc.get('belge_no','')}"),
            "geri_al":     ("🚫 Belge Geri Alındı",     f"{user['full_name']} '{doc['title']}' belgesini geri çekti. Belge No: {doc.get('belge_no','')}"),
            "not_related": ("➡️ Birimle İlgili Değil",  f"{user['full_name']} ({user['department']}) '{doc['title']}' belgesini birimlerini ilgilendirmediğini bildirdi. Belge No: {doc.get('belge_no','')}"),
        }
        _ntitle, _nmsg = _notif_map.get(action, ("📋 Belge Güncellendi", f"{user['full_name']} '{doc['title']}' belgenizi güncelledi. Belge No: {doc.get('belge_no','')}"))
        await create_notification(doc["created_by"], _ntitle, _nmsg, data.document_id)

    await log_activity(user["id"], f"document_{action}", "document", data.document_id, {"note": data.note}, request=request, user=user)
    return {"message": f"Document {action} successful", "status": update_fields.get("status"), **response_extra}

@api_router.get("/documents/{document_id}/history")
async def get_document_history(document_id: str, request: Request):
    user = await get_current_user(request)
    doc = await db.documents.find_one({"id": document_id, "is_deleted": False})
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not is_admin(user) and doc["created_by"] != user["id"]:
        # Also allow users who are involved
        if user["id"] not in (doc.get("involved_user_ids") or []) and user.get("department") not in (doc.get("involved_departments") or []):
            raise HTTPException(status_code=403, detail="Only creator or admin can view history")
    
    history = await db.document_history.find({"document_id": document_id}, {"_id": 0}).sort("timestamp", 1).to_list(1000)
    return history

# ===== DOCUMENT ATTACHMENTS =====

@api_router.post("/documents/{document_id}/attachments")
async def add_attachment(document_id: str, request: Request, file: UploadFile = File(...), note: str = Form("")):
    """Add an extra file to the document's flow (folder-like behavior)."""
    user = await get_current_user(request)
    doc = await db.documents.find_one({"id": document_id, "is_deleted": False})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not _user_can_see_doc(user, doc):
        raise HTTPException(status_code=403, detail="Bu belgeye ek yukleme yetkiniz yok")
    # Do not allow after final statuses
    if doc.get("status") in ("rejected", "cancelled"):
        raise HTTPException(status_code=400, detail="Kapatilmis bir belgeye ek eklenemez")

    data = await file.read()
    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    storage_path = f"{APP_NAME}/documents/{user['id']}/{uuid.uuid4()}.{ext}"
    try:
        result = put_object(storage_path, data, file.content_type or "application/octet-stream")
        stored_path = result["path"]
        stored_size = result["size"]
    except Exception as e:
        logger.warning(f"Attachment storage fallback to local: {e}")
        local_dir = ROOT_DIR / "uploads" / user["id"]
        local_dir.mkdir(parents=True, exist_ok=True)
        local_file = local_dir / f"{uuid.uuid4()}.{ext}"
        local_file.write_bytes(data)
        stored_path = f"local:{local_file}"
        stored_size = len(data)

    attachment = {
        "id": str(uuid.uuid4()),
        "file_path": stored_path,
        "file_name": file.filename,
        "file_size": stored_size,
        "file_type": file.content_type or "application/octet-stream",
        "note": note or "",
        "uploaded_by": user["id"],
        "uploaded_by_name": user["full_name"],
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.documents.update_one(
        {"id": document_id},
        {
            "$push": {"attachments": attachment},
            "$addToSet": {"involved_user_ids": user["id"], "involved_departments": user.get("department", "")},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
        },
    )
    await db.document_history.insert_one({
        "id": str(uuid.uuid4()),
        "document_id": document_id,
        "user_id": user["id"],
        "user_name": user["full_name"],
        "department": user.get("department", ""),
        "action": "attachment_added",
        "note": f"Ek belge eklendi: {file.filename}" + (f" - {note}" if note else ""),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    # Notify creator if different
    if doc.get("created_by") != user["id"]:
        await create_notification(doc["created_by"], "📎 Ek Belge Yüklendi", f"{user['full_name']} ({user['department']}) '{doc['title']}' belgesine yeni bir ek dosya yükledi: {file.filename}. Belge No: {doc.get('belge_no','')}", document_id)
    await log_activity(user["id"], "add_attachment", "document", document_id, {"file_name": file.filename}, request=request, user=user)
    return attachment

@api_router.get("/documents/{document_id}/attachments/{attachment_id}/download")
async def download_attachment(document_id: str, attachment_id: str, request: Request):
    user = await get_current_user(request)
    doc = await db.documents.find_one({"id": document_id, "is_deleted": False})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not _user_can_see_doc(user, doc):
        raise HTTPException(status_code=403, detail="Access denied")
    att = next((a for a in (doc.get("attachments") or []) if a.get("id") == attachment_id), None)
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    data = _read_file_bytes(att["file_path"])
    return FastAPIResponse(
        content=data,
        media_type=att.get("file_type", "application/octet-stream"),
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{_url_quote(att['file_name'])}"},
    )

@api_router.get("/documents/{document_id}/attachments/{attachment_id}/preview")
async def preview_attachment(document_id: str, attachment_id: str, request: Request):
    user = await get_current_user(request)
    doc = await db.documents.find_one({"id": document_id, "is_deleted": False})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not _user_can_see_doc(user, doc):
        raise HTTPException(status_code=403, detail="Access denied")
    att = next((a for a in (doc.get("attachments") or []) if a.get("id") == attachment_id), None)
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    data = _read_file_bytes(att["file_path"])
    return FastAPIResponse(
        content=data,
        media_type=att.get("file_type", "application/octet-stream"),
        headers={"Content-Disposition": f"inline; filename*=UTF-8''{_url_quote(att['file_name'])}"},
    )

@api_router.delete("/documents/{document_id}/attachments/{attachment_id}")
async def delete_attachment(document_id: str, attachment_id: str, request: Request):
    user = await get_current_user(request)
    doc = await db.documents.find_one({"id": document_id, "is_deleted": False})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    att = next((a for a in (doc.get("attachments") or []) if a.get("id") == attachment_id), None)
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    # Only uploader or admin can delete
    if att.get("uploaded_by") != user["id"] and not is_admin(user):
        raise HTTPException(status_code=403, detail="Sadece yukleyen silebilir")
    await db.documents.update_one({"id": document_id}, {"$pull": {"attachments": {"id": attachment_id}}})
    return {"message": "Attachment deleted"}

# ===== USER MANAGEMENT ENDPOINTS (ADMIN) =====

@api_router.get("/users")
async def get_users(request: Request):
    user = await get_current_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"password_hash": 0}).to_list(1000)
    result = []
    for u in users:
        oid = u.pop("_id", None)
        if not u.get("id"): u["id"] = str(oid) if oid else ""
        result.append(u)
    return result

@api_router.post("/users")
async def create_user(data: UserCreateRequest, request: Request):
    user = await get_current_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    email = data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    _oid = ObjectId()
    user_doc = {
        "_id": _oid, "id": str(_oid),
        "email": email,
        "password_hash": hash_password(data.password),
        "full_name": data.full_name,
        "department": normalize_department(data.department),
        "role": data.role, "permissions": data.permissions,
        "is_manager": bool(data.is_manager),
        "can_manage_vendors": bool(getattr(data, "can_manage_vendors", False)),
        "view_all_documents": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    await log_activity(user["id"], "create_user", "user", str(user_doc["_id"]), {"email": email}, request=request, user=user)
    
    user_doc["id"] = str(user_doc.pop("_id"))
    user_doc.pop("password_hash")
    return user_doc

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdateRequest, request: Request):
    current_user = await get_current_user(request)
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Hedef kullaniciyi bul
    try:
        target = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Patron rolune yukseltme sadece patron yapabilir
    if data.role == "superadmin" and not is_superadmin(current_user):
        raise HTTPException(status_code=403, detail="Superadmin rolü sadece patron tarafından atanabilir")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    if "role" in update_data and update_data["role"] == "superadmin" and not is_superadmin(current_user):
        raise HTTPException(status_code=403, detail="Superadmin rolü sadece patron tarafından atanabilir")
    if target.get("role") == "superadmin" and not is_superadmin(current_user):
        raise HTTPException(status_code=403, detail="Patron hesabı sadece patron tarafından değiştirilebilir")
    if "department" in update_data:
        update_data["department"] = normalize_department(update_data["department"])
    
    result = await db.users.update_one({"_id": target["_id"]}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await log_activity(current_user["id"], "update_user", "user", user_id, update_data, request=request, user=current_user)
    
    return {"message": "User updated successfully"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    current_user = await get_current_user(request)
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await log_activity(current_user["id"], "delete_user", "user", user_id, request=request, user=current_user)
    
    return {"message": "User deleted successfully"}

# ===== NOTIFICATION ENDPOINTS =====

@api_router.get("/notifications")
async def get_notifications(request: Request):
    user = await get_current_user(request)
    notifications = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"is_read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(request: Request):
    user = await get_current_user(request)
    result = await db.notifications.update_many(
        {"user_id": user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"modified": result.modified_count}

# ===== ACTIVITY LOGS (ADMIN) =====


# ─────────────────────────────────────────────────────────────────
# FİNANS MODÜLü — Faz 2
# ─────────────────────────────────────────────────────────────────

@api_router.get("/finance/queue")
async def finance_queue(request: Request):
    """Ödeme bekleyen belgeler — payment_required=True olanlar."""
    user = await get_current_user(request)
    # Finans departmanı veya admin/superadmin görebilir
    if not is_admin(user) and user.get("department") not in ("FINANS", "FIN"):
        raise HTTPException(status_code=403, detail="Finans modülüne erişim yetkiniz yok")

    docs = await db.documents.find({
        "is_deleted": False,
        "payment_required": True,
        "status": {"$nin": ["cancelled"]},
    }, {"_id": 0}).sort("hedef_tarih", 1).to_list(500)

    today = datetime.now(timezone.utc).date().isoformat()
    from datetime import timedelta as _td
    result = []
    for d in docs:
        # Ödendiyse DB'deki değeri koru, ezme
        if d.get("payment_status") == "odendi":
            result.append(d)
            continue
        hedef = d.get("hedef_tarih", "")
        if hedef:
            week_later = (datetime.now(timezone.utc).date() + _td(days=7)).isoformat()
            if hedef < today:
                d["payment_status"] = "gecikmiş"
            elif hedef <= week_later:
                d["payment_status"] = "bu_hafta"
            else:
                d["payment_status"] = "ileriki"
        else:
            d["payment_status"] = "tarihi_yok"
        result.append(d)
    return result

@api_router.get("/finance/calendar")
async def finance_calendar(request: Request, month: int = None, year: int = None, filter: str = "all"):
    """Takvim görünümü — filter: all | pending | paid"""
    user = await get_current_user(request)
    if not is_admin(user) and user.get("department") not in ("FINANS", "FIN"):
        raise HTTPException(status_code=403, detail="Finans modülüne erişim yetkiniz yok")

    now = datetime.now(timezone.utc)
    y = year or now.year
    m = month or now.month
    month_start = f"{y:04d}-{m:02d}-01"
    month_end   = f"{y+1:04d}-01-01" if m == 12 else f"{y:04d}-{m+1:02d}-01"

    query: dict = {
        "is_deleted": False,
        "payment_required": True,
        "hedef_tarih": {"$gte": month_start, "$lt": month_end},
        "status": {"$nin": ["cancelled"]},
    }
    if filter == "paid":
        query["payment_status"] = "odendi"
    elif filter == "pending":
        query["payment_status"] = {"$ne": "odendi"}

    docs = await db.documents.find(query, {"_id": 0}).sort("hedef_tarih", 1).to_list(500)

    # payment_status hesapla (ödenmemişler için)
    today = datetime.now(timezone.utc).date().isoformat()
    from datetime import timedelta as _td
    for d in docs:
        if d.get("payment_status") == "odendi":
            continue
        hedef = d.get("hedef_tarih", "")
        if hedef:
            week_later = (datetime.now(timezone.utc).date() + _td(days=7)).isoformat()
            if hedef < today:
                d["payment_status"] = "gecikmiş"
            elif hedef <= week_later:
                d["payment_status"] = "bu_hafta"
            else:
                d["payment_status"] = "ileriki"
        else:
            d["payment_status"] = "tarihi_yok"

    return {"year": y, "month": m, "documents": docs}

@api_router.post("/finance/mark-paid")
async def finance_mark_paid(
    request: Request,
    document_id: str = Form(...),
    note: str = Form(""),
    route_to_muhasebe: str = Form("false"),
    dekont: UploadFile = File(None),
):
    """Ödendi olarak işaretle + opsiyonel dekont yükle."""
    user = await get_current_user(request)
    if not is_admin(user) and user.get("department") not in ("FINANS", "FIN"):
        raise HTTPException(status_code=403, detail="Finans modülüne erişim yetkiniz yok")

    route_muh = route_to_muhasebe.lower() in ("true", "1", "yes")
    doc = await db.documents.find_one({"id": document_id, "is_deleted": False})
    if not doc:
        raise HTTPException(status_code=404, detail="Belge bulunamadı")

    update: dict = {
        "payment_status": "odendi",
        "payment_date": datetime.now(timezone.utc).isoformat(),
        "payment_by": user["full_name"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Dekont varsa ek belge olarak kaydet
    dekont_info = None
    if dekont and dekont.filename:
        dekont_bytes = await dekont.read()
        ext = os.path.splitext(dekont.filename)[1] if '.' in dekont.filename else ''
        att_path = f"attachments/{document_id}/{uuid.uuid4()}{ext}"
        stored = put_object(att_path, dekont_bytes, dekont.content_type or "application/octet-stream")
        dekont_info = {
            "id": str(uuid.uuid4()),
            "file_path": stored.get("path", f"local:{att_path}"),
            "file_name": dekont.filename,
            "file_size": len(dekont_bytes),
            "file_type": dekont.content_type or "application/octet-stream",
            "note": f"Ödeme Dekontu — {note or ''}",
            "uploaded_by": user["id"],
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.documents.update_one({"id": document_id}, {"$push": {"attachments": dekont_info}})
        await db.document_history.insert_one({
            "id": str(uuid.uuid4()),
            "document_id": document_id,
            "from_user_id": user["id"],
            "from_user_name": user["full_name"],
            "from_department": user.get("department", ""),
            "to_department": doc.get("current_department", ""),
            "action": "dekont_yuklendi",
            "note": f"Dekont yüklendi: {dekont.filename}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    if route_muh:
        update["current_department"] = "MUHASEBE"
        update["status"] = "pending"
        muh_users = await get_department_users("MUHASEBE")
        for u in muh_users:
            await create_notification(
                str(u["_id"]),
                "💳 Ödeme Yapıldı — Muhasebe",
                f"{user['full_name']} '{doc['title']}' belgesinin ödemesini yaptı. Muhasebe işlemi için yönlendirildi. Belge No: {doc.get('belge_no','')}",
                document_id,
            )

    await db.documents.update_one({"id": document_id}, {"$set": update})
    await db.document_history.insert_one({
        "id": str(uuid.uuid4()),
        "document_id": document_id,
        "from_user_id": user["id"],
        "from_user_name": user["full_name"],
        "from_department": user.get("department", ""),
        "to_department": "MUHASEBE" if route_muh else doc.get("current_department", ""),
        "action": "odendi",
        "note": note or "Ödeme yapıldı",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    await log_activity(user["id"], "finance_mark_paid", "document", document_id,
                       {"note": note, "route_muhasebe": route_muh, "dekont": dekont.filename if dekont and dekont.filename else None},
                       request=request, user=user)

    if doc.get("created_by") != user["id"]:
        await create_notification(
            doc["created_by"],
            "💳 Ödeme Gerçekleşti",
            f"{user['full_name']} (Finans) '{doc['title']}' belgenizin ödemesini gerçekleştirdi. Belge No: {doc.get('belge_no','')}",
            document_id,
        )
    return {"message": "Ödeme işaretlendi", "routed_to_muhasebe": route_muh, "dekont_eklendi": dekont_info is not None}

@api_router.get("/finance/export-excel")
async def finance_export_excel(request: Request, start_date: str = None, end_date: str = None, status: str = None):
    """Ödeme listesini Excel olarak dışa aktar."""
    user = await get_current_user(request)
    if not is_admin(user) and user.get("department") not in ("FINANS", "FIN"):
        raise HTTPException(status_code=403, detail="Finans modülüne erişim yetkiniz yok")

    query: dict = {"is_deleted": False, "payment_required": True}
    if start_date:
        query.setdefault("hedef_tarih", {})["$gte"] = start_date
    if end_date:
        query.setdefault("hedef_tarih", {})["$lte"] = end_date
    if status == "odendi":
        query["payment_status"] = "odendi"
    elif status == "bekleyen":
        query["payment_status"] = {"$nin": ["odendi"]}
        query["status"] = {"$nin": ["cancelled"]}
    elif status == "gecikmiş":
        query["payment_status"] = "gecikmiş"

    docs = await db.documents.find(query, {"_id": 0}).sort("hedef_tarih", 1).to_list(5000)

    import openpyxl as _xl
    from openpyxl.styles import Font as _Font, PatternFill as _Fill, Alignment as _Align, Border as _Bdr, Side as _Side
    from openpyxl.utils import get_column_letter as _gcl

    wb = _xl.Workbook()
    ws = wb.active
    ws.title = "Ödeme Listesi"

    headers = ["Belge No", "Başlık", "Kategori", "Cari", "Ödeme Tipi", "Vade Tarihi", "Ödeme Durumu", "Ödeme Tarihi", "Ödeyen", "Fatura No", "Birim", "Belge Durumu"]
    _hfill = _Fill("solid", fgColor="1e3a5f")
    _hfont = _Font(bold=True, color="FFFFFF", size=10)
    _bdr = _Bdr(left=_Side(style="thin"), right=_Side(style="thin"), top=_Side(style="thin"), bottom=_Side(style="thin"))
    for ci, h in enumerate(headers, 1):
        c = ws.cell(row=1, column=ci, value=h)
        c.fill = _hfill; c.font = _hfont; c.alignment = _Align(horizontal="center"); c.border = _bdr

    _status_tr = {"odendi": "Ödendi", "gecikmiş": "Gecikmiş", "bekliyor": "Bekliyor", "tarihi_yok": "Tarih Yok", "bu_hafta": "Bu Hafta", "ileriki": "İleriki"}
    _doc_status_tr = {"pending": "Beklemede", "in_progress": "İşlemde", "approved": "Onaylandı", "rejected": "Reddedildi", "iade": "İade", "revize": "Revize", "cancelled": "İptal", "draft": "Taslak"}
    _row_colors = ["FFFFFF", "F0F4F8"]

    for ri, d in enumerate(docs, 2):
        fill = _Fill("solid", fgColor=_row_colors[ri % 2])
        vals = [
            d.get("belge_no", ""),
            d.get("title", ""),
            d.get("category", ""),
            d.get("cari", ""),
            d.get("payment_type", ""),
            d.get("hedef_tarih", ""),
            _status_tr.get(d.get("payment_status", ""), d.get("payment_status", "Bekliyor")),
            d.get("payment_date", "")[:10] if d.get("payment_date") else "",
            d.get("payment_by", ""),
            d.get("fatura_no", ""),
            d.get("current_department", ""),
            _doc_status_tr.get(d.get("status", ""), d.get("status", "")),
        ]
        for ci, v in enumerate(vals, 1):
            c = ws.cell(row=ri, column=ci, value=v)
            c.fill = fill; c.border = _bdr; c.alignment = _Align(vertical="center")

    ws.column_dimensions["A"].width = 18
    ws.column_dimensions["B"].width = 30
    ws.column_dimensions["C"].width = 14
    ws.column_dimensions["D"].width = 24
    ws.column_dimensions["E"].width = 14
    ws.column_dimensions["F"].width = 14
    ws.column_dimensions["G"].width = 14
    ws.column_dimensions["H"].width = 14
    ws.column_dimensions["I"].width = 18
    ws.column_dimensions["J"].width = 16
    ws.column_dimensions["K"].width = 16
    ws.column_dimensions["L"].width = 14
    ws.freeze_panes = "A2"
    ws.row_dimensions[1].height = 28

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fname = f"odeme_listesi_{datetime.now().strftime('%Y-%m-%d')}.xlsx"
    return Response(
        content=buf.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{_url_quote(fname)}"}
    )

@api_router.get("/logs")
async def get_logs(request: Request, limit: int = 100):
    user = await get_current_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    logs = await db.activity_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return logs

@api_router.get("/logs/export")
async def export_logs(request: Request, format: str = "csv", limit: int = 5000):
    """Logları CSV veya JSON olarak indir."""
    user = await get_current_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    logs = await db.activity_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)

    if format == "json":
        import json as _json
        content = _json.dumps(logs, ensure_ascii=False, indent=2)
        filename = f"sistem_loglari_{datetime.now().strftime('%Y-%m-%d')}.json"
        return Response(
            content=content.encode("utf-8"),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    # CSV export
    import csv as _csv
    buf = io.StringIO()
    fieldnames = ["timestamp", "action_label", "user_name", "user_dept", "user_role",
                  "ip_address", "entity_type", "entity_id", "details", "user_id", "user_agent"]
    writer = _csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for log in logs:
        row = dict(log)
        row["details"] = str(row.get("details", {}))
        writer.writerow(row)

    filename = f"sistem_loglari_{datetime.now().strftime('%Y-%m-%d')}.csv"
    return Response(
        content=buf.getvalue().encode("utf-8-sig"),  # utf-8-sig: Excel Türkçe uyumlu
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

# ===== DEPARTMENT MANAGEMENT (ADMIN) =====

@api_router.get("/departments")
async def get_departments(request: Request):
    # Accessible to all authenticated users (e.g. to populate dropdowns)
    await get_current_user(request)
    departments = await db.departments.find({}).to_list(1000)
    result = []
    for d in departments:
        oid = d.pop("_id", None)
        if not d.get("id"):
            d["id"] = str(oid) if oid else str(uuid.uuid4())
            await db.departments.update_one({"name": d["name"]}, {"$set": {"id": d["id"]}})
        result.append(d)
    return result

@api_router.post("/departments")
async def create_department(data: DepartmentCreate, request: Request):
    user = await get_current_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    dept_name = normalize_department(data.name)
    existing = await db.departments.find_one({"name": dept_name})
    if existing:
        raise HTTPException(status_code=400, detail="Department already exists")
    
    dept = {
        "id": str(uuid.uuid4()),
        "name": dept_name,
        "description": data.description,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.departments.insert_one(dept)
    await log_activity(user["id"], "create_department", "department", dept["id"], {"name": data.name}, request=request, user=user)
    
    dept.pop("_id", None)
    return dept

@api_router.put("/departments/{department_id}")
async def update_department(department_id: str, data: DepartmentCreate, request: Request):
    user = await get_current_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.departments.update_one(
        {"id": department_id},
        {"$set": {"name": normalize_department(data.name), "description": data.description}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Department not found")
    
    await log_activity(user["id"], "update_department", "department", department_id, {"name": data.name}, request=request, user=user)
    return {"message": "Department updated successfully"}

@api_router.delete("/departments/{department_id}")
async def delete_department(department_id: str, request: Request):
    user = await get_current_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.departments.delete_one({"id": department_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Department not found")
    
    await log_activity(user["id"], "delete_department", "department", department_id, request=request, user=user)
    return {"message": "Department deleted successfully"}

# ===== CARI (VENDOR) MANAGEMENT =====

@api_router.get("/vendors")
async def get_vendors(request: Request, q: str = ""):
    # Accessible to all authenticated users (autocomplete in upload modal)
    await get_current_user(request)
    query = {}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    vendors = await db.vendors.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    return vendors

@api_router.post("/vendors")
async def create_vendor(data: VendorCreate, request: Request):
    user = await get_current_user(request)
    if not can_manage_vendors(user):
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
    existing = await db.vendors.find_one({"name": data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Bu cari zaten mevcut")
    vendor = {
        "id": str(uuid.uuid4()),
        "name": data.name.strip(),
        "tax_no": data.tax_no or "",
        "payment_type": data.payment_type or "havale",
        "vade_gun": int(data.vade_gun or 0),
        "phone": data.phone or "",
        "email": data.email or "",
        "address": data.address or "",
        "notes": data.notes or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.vendors.insert_one(vendor)
    await log_activity(user["id"], "create_vendor", "vendor", vendor["id"], {"name": vendor["name"]}, request=request, user=user)
    vendor.pop("_id", None)
    return vendor

@api_router.put("/vendors/{vendor_id}")
async def update_vendor(vendor_id: str, data: VendorCreate, request: Request):
    user = await get_current_user(request)
    if not can_manage_vendors(user):
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
    update_data = {
        "name": data.name.strip(),
        "tax_no": data.tax_no or "",
        "payment_type": data.payment_type or "havale",
        "vade_gun": int(data.vade_gun or 0),
        "phone": data.phone or "",
        "email": data.email or "",
        "address": data.address or "",
        "notes": data.notes or "",
    }
    result = await db.vendors.update_one({"id": vendor_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    await log_activity(user["id"], "update_vendor", "vendor", vendor_id, update_data, request=request, user=user)
    return {"message": "Vendor updated"}

@api_router.delete("/vendors/{vendor_id}")
async def delete_vendor(vendor_id: str, request: Request):
    user = await get_current_user(request)
    if not can_manage_vendors(user):
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
    result = await db.vendors.delete_one({"id": vendor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    await log_activity(user["id"], "delete_vendor", "vendor", vendor_id, request=request, user=user)
    return {"message": "Vendor deleted"}

@api_router.post("/vendors/bulk-import")
async def bulk_import_vendors(request: Request, file: UploadFile = File(...)):
    """Import vendors from Excel/CSV. Expected columns: name, tax_no, payment_type, vade_gun, phone, email, address, notes"""
    user = await get_current_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    content = await file.read()
    created = 0
    skipped = 0
    errors = []
    rows = []
    try:
        import openpyxl as _openpyxl
        wb = _openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.active
        headers = []
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i == 0:
                headers = [str(c).strip().lower() if c else "" for c in row]
            else:
                if not any(row):
                    continue
                rows.append({headers[j]: (str(v).strip() if v is not None else "") for j, v in enumerate(row) if j < len(headers)})
        wb.close()
    except Exception as e:
        errors.append(f"XLSX okuma hatasi: {e}")

    if not rows:
        errors.append("Dosya bos veya okunamadi")

    for row in rows:
        try:
            name = (row.get("name") or row.get("cari") or "").strip()
            if not name:
                continue
            existing = await db.vendors.find_one({"name": name})
            if existing:
                skipped += 1
                continue
            vade_raw = str(row.get("vade_gun") or row.get("vade") or "0").strip()
            try:
                vade = int(float(vade_raw)) if vade_raw else 0
            except Exception:
                vade = 0
            vendor = {
                "id": str(uuid.uuid4()),
                "name": name,
                "tax_no": (row.get("tax_no") or row.get("vergi_no") or "").strip(),
                "payment_type": (row.get("payment_type") or row.get("odeme_tipi") or "havale").strip().lower(),
                "vade_gun": vade,
                "phone": (row.get("phone") or "").strip(),
                "email": (row.get("email") or "").strip(),
                "address": (row.get("address") or "").strip(),
                "notes": (row.get("notes") or "").strip(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.vendors.insert_one(vendor)
            created += 1
        except Exception as e:
            errors.append(f"Satir hatasi: {e}")
    await log_activity(user["id"], "import_vendors", "vendor", "bulk", {"created": created, "skipped": skipped}, request=request, user=user)
    return {"created": created, "skipped": skipped, "errors": errors}

# ===== CATEGORIES =====

DEFAULT_CATEGORIES = ["Fatura", "Dekont", "Sozlesme", "Teklif", "Siparis", "Irsaliye", "Fis", "Cek", "Senet", "Rapor", "Izin Belgesi", "Genel"]

@api_router.get("/categories")
async def get_categories(request: Request):
    await get_current_user(request)
    categories = await db.categories.find({}, {"_id": 0}).to_list(1000)
    if not categories:
        return [{"id": c, "name": c} for c in DEFAULT_CATEGORIES]
    return categories

# ===== DASHBOARD STATS =====

@api_router.get("/dashboard/stats")
async def dashboard_stats(request: Request):
    user = await get_current_user(request)
    base = {"is_deleted": False}
    if is_admin(user):
        # Patron "sadece ilgili belgeler" modundaysa filtrele
        if is_superadmin(user) and not user.get("view_all_documents", True):
            base["$or"] = [
                {"created_by": user["id"]},
                {"current_department": user.get("department", "")},
                {"involved_user_ids": user["id"]},
                {"involved_departments": user.get("department", "")},
            ]
    else:
        base["$or"] = [
            {"created_by": user["id"]},
            {"current_department": user.get("department", "")},
            {"involved_user_ids": user["id"]},
            {"involved_departments": user.get("department", "")},
        ]
    total      = await db.documents.count_documents(base)
    pending    = await db.documents.count_documents({**base, "status": {"$in": ["pending", "in_progress"]}})
    approved   = await db.documents.count_documents({**base, "status": "approved"})
    rejected   = await db.documents.count_documents({**base, "status": "rejected"})
    iade_revize= await db.documents.count_documents({**base, "status": {"$in": ["iade", "revize"]}})
    return {
        "total": total, "pending": pending, "approved": approved,
        "rejected": rejected, "iade_revize": iade_revize,
    }

# ===== PERMISSION GROUP MANAGEMENT (ADMIN) =====

@api_router.get("/permission-groups")
async def get_permission_groups(request: Request):
    user = await get_current_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    groups = await db.permission_groups.find({}, {"_id": 0}).to_list(1000)
    return groups

@api_router.post("/permission-groups")
async def create_permission_group(data: PermissionGroupCreate, request: Request):
    user = await get_current_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = await db.permission_groups.find_one({"name": data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Permission group already exists")
    
    group = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "description": data.description,
        "permissions": data.permissions,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.permission_groups.insert_one(group)
    await log_activity(user["id"], "create_permission_group", "permission_group", group["id"], {"name": data.name}, request=request, user=user)
    
    group.pop("_id", None)
    return group

@api_router.put("/permission-groups/{group_id}")
async def update_permission_group(group_id: str, data: PermissionGroupCreate, request: Request):
    user = await get_current_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.permission_groups.update_one(
        {"id": group_id},
        {"$set": {
            "name": data.name,
            "description": data.description,
            "permissions": data.permissions
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Permission group not found")
    
    await log_activity(user["id"], "update_permission_group", "permission_group", group_id, {"name": data.name}, request=request, user=user)
    return {"message": "Permission group updated successfully"}

@api_router.delete("/permission-groups/{group_id}")
async def delete_permission_group(group_id: str, request: Request):
    user = await get_current_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.permission_groups.delete_one({"id": group_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Permission group not found")
    
    await log_activity(user["id"], "delete_permission_group", "permission_group", group_id, request=request, user=user)
    return {"message": "Permission group deleted successfully"}

# ===== STARTUP EVENT =====

@app.on_event("startup")  # noqa: deprecated - lifespan migration planned
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    
    async def safe_create_index(collection, keys, **kwargs):
        """Create index, gracefully handle conflicts with existing indexes from older schemas."""
        try:
            await collection.create_index(keys, **kwargs)
        except Exception as e:
            msg = str(e)
            # Index name conflict -> drop old one and recreate
            if "IndexKeySpecsConflict" in msg or "already exists with different options" in msg or "code': 86" in msg:
                try:
                    idx_name = keys + "_1" if isinstance(keys, str) else None
                    if idx_name:
                        await collection.drop_index(idx_name)
                        await collection.create_index(keys, **kwargs)
                        logger.info(f"Rebuilt index {idx_name} on {collection.name}")
                        return
                except Exception as e2:
                    logger.warning(f"Index rebuild failed on {collection.name}/{keys}: {e2}")
            logger.warning(f"Index create skipped on {collection.name}/{keys}: {e}")

    await safe_create_index(db.users, "email", unique=True)
    await safe_create_index(db.documents, "id")
    await safe_create_index(db.documents, "belge_no")
    await safe_create_index(db.documents, "fatura_no")
    await safe_create_index(db.documents, "current_department")
    await safe_create_index(db.document_history, "document_id")
    await safe_create_index(db.notifications, "user_id")
    await safe_create_index(db.activity_logs, "user_id")
    await safe_create_index(db.departments, "id")
    await safe_create_index(db.departments, "name", unique=True)
    await safe_create_index(db.permission_groups, "id")
    await safe_create_index(db.permission_groups, "name", unique=True)
    await safe_create_index(db.vendors, "name", unique=True)
    await safe_create_index(db.counters, "_id")
    
    # Seed default departments (canonical format + prefix)
    for dept_name, prefix in DEPARTMENT_DEFS:
        existing = await db.departments.find_one({"name": dept_name})
        if not existing:
            await db.departments.insert_one({
                "id": str(uuid.uuid4()),
                "name": dept_name,
                "prefix": prefix,
                "description": f"{dept_name} departmani",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        elif not existing.get("prefix"):
            await db.departments.update_one(
                {"_id": existing["_id"]}, {"$set": {"prefix": prefix}}
            )
    
    # ===== MIGRATION: normalize department names on existing documents =====
    # 1) Normalize all department documents (old Turkish names -> canonical)
    dept_cursor = db.departments.find({})
    async for dept in dept_cursor:
        canonical = normalize_department(dept.get("name", ""))
        if canonical and canonical != dept.get("name"):
            # If a department with the canonical name already exists, remove this duplicate
            other = await db.departments.find_one({"name": canonical, "_id": {"$ne": dept["_id"]}})
            if other:
                await db.departments.delete_one({"_id": dept["_id"]})
                logger.info(f"Removed duplicate department '{dept.get('name')}' (merged into '{canonical}')")
            else:
                await db.departments.update_one(
                    {"_id": dept["_id"]},
                    {"$set": {"name": canonical}}
                )
                logger.info(f"Migrated department '{dept.get('name')}' -> '{canonical}'")
    
    # 2) Normalize department field on all users
    users_cursor = db.users.find({})
    migrated_users = 0
    async for u in users_cursor:
        current = u.get("department")
        if not current:
            continue
        canonical = normalize_department(current)
        if canonical != current:
            await db.users.update_one(
                {"_id": u["_id"]},
                {"$set": {"department": canonical}}
            )
            migrated_users += 1
    if migrated_users:
        logger.info(f"Migrated department field on {migrated_users} users to canonical format")
    # ===== END MIGRATION =====
    
    # Seed default permission groups
    default_groups = [
        {
            "name": "Tam Yetki",
            "description": "Tüm yetkiler",
            "permissions": ["view_documents", "create_documents", "edit_documents", "delete_documents", "approve_documents", "route_documents"]
        },
        {
            "name": "Sadece Görüntüleme",
            "description": "Sadece belge görüntüleme yetkisi",
            "permissions": ["view_documents"]
        },
        {
            "name": "Onaylayıcı",
            "description": "Belge görüntüleme ve onaylama yetkisi",
            "permissions": ["view_documents", "approve_documents"]
        }
    ]
    for group_data in default_groups:
        existing = await db.permission_groups.find_one({"name": group_data["name"]})
        if not existing:
            await db.permission_groups.insert_one({
                "id": str(uuid.uuid4()),
                **group_data,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    admin_email = os.environ.get("ADMIN_EMAIL", "ekrem.karabiyik@evraktakip.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Ekrem147258369**2026**")
    
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "_id": ObjectId(),
            "email": admin_email,
            "password_hash": hashed,
            "full_name": "Ekrem Karabiyik",
            "department": "YONETIM",
            "role": "admin",
            "permissions": ["all"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user created: {admin_email}")
    else:
        # Ensure admin stays in canonical department and always has admin role
        update_fields = {}
        canonical_dept = normalize_department(existing.get("department", "YONETIM")) or "YONETIM"
        if canonical_dept != existing.get("department"):
            update_fields["department"] = canonical_dept
        if existing.get("role") != "admin":
            update_fields["role"] = "admin"
        if not verify_password(admin_password, existing["password_hash"]):
            update_fields["password_hash"] = hash_password(admin_password)
        if update_fields:
            await db.users.update_one({"email": admin_email}, {"$set": update_fields})
            logger.info(f"Admin user synchronized: {list(update_fields.keys())}")
    
    # ===== SUPERADMIN (PATRON) SEED =====
    superadmin_email    = os.environ.get("SUPERADMIN_EMAIL",    "patron@evraktakip.com").lower()
    superadmin_password = os.environ.get("SUPERADMIN_PASSWORD", "Patron147258369**2026**")
    existing_super = await db.users.find_one({"email": superadmin_email})
    if existing_super is None:
        sa_oid = ObjectId()
        await db.users.insert_one({
            "_id": sa_oid, "id": str(sa_oid),
            "email": superadmin_email,
            "password_hash": hash_password(superadmin_password),
            "full_name": "Patron", "department": "PATRON",
            "role": "superadmin", "permissions": ["all"],
            "is_manager": True, "can_manage_vendors": True,
            "view_all_documents": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Superadmin created: {superadmin_email}")
    else:
        upd = {}
        if existing_super.get("role") != "superadmin": upd["role"] = "superadmin"
        if not existing_super.get("can_manage_vendors"): upd["can_manage_vendors"] = True
        if "view_all_documents" not in existing_super: upd["view_all_documents"] = True
        if not existing_super.get("id"): upd["id"] = str(existing_super["_id"])
        if upd:
            await db.users.update_one({"email": superadmin_email}, {"$set": upd})
            logger.info(f"Superadmin güncellendi: {list(upd.keys())}")
    # ===== END SUPERADMIN SEED =====

    logger.info("Startup complete.")


# ── Patron belge modu toggle ─────────────────────
@api_router.post("/auth/patron/toggle-view-mode")
async def patron_toggle_view_mode(request: Request):
    user = await get_current_user(request)
    if not is_superadmin(user):
        raise HTTPException(status_code=403, detail="Sadece patron kullanabilir")
    new_val = not user.get("view_all_documents", True)
    await db.users.update_one({"id": user["id"]}, {"$set": {"view_all_documents": new_val}})
    return {"view_all_documents": new_val}

# ── Departments members ───────────────────────────
@api_router.get("/departments/{department_id}/members")
async def get_department_members(department_id: str, request: Request):
    user = await get_current_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    dept = await db.departments.find_one({"id": department_id})
    if not dept:
        try:
            dept = await db.departments.find_one({"_id": ObjectId(department_id)})
        except Exception:
            dept = None
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    import re as _re
    members = await db.users.find(
        {"department": {"$regex": f"^{_re.escape(dept['name'])}$", "$options": "i"}},
        {"password_hash": 0}
    ).to_list(1000)
    result = []
    for m in members:
        oid = m.pop("_id", None)
        if not m.get("id"): m["id"] = str(oid) if oid else ""
        result.append(m)
    return result

# ── Vendor bulk delete ────────────────────────────
@api_router.post("/vendors/bulk-delete")
async def bulk_delete_vendors(request: Request):
    user = await get_current_user(request)
    if not can_manage_vendors(user):
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
    body = await request.json()
    ids = body.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="Silinecek cari seçilmedi")
    result = await db.vendors.delete_many({"id": {"$in": ids}})
    await log_activity(user["id"], "bulk_delete_vendors", "vendor", "bulk",
                      {"deleted": result.deleted_count}, request=request, user=user)
    return {"deleted": result.deleted_count}

# ── Preview HTML (Word/Excel local) ──────────────
@api_router.get("/documents/{document_id}/attachments/{attachment_id}/preview-html")
async def preview_attachment_html(document_id: str, attachment_id: str, request: Request):
    user = await get_current_user(request)
    doc = await db.documents.find_one({"id": document_id, "is_deleted": False})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not _user_can_see_doc(user, doc):
        raise HTTPException(status_code=403, detail="Access denied")
    att = next((a for a in (doc.get("attachments") or []) if a.get("id") == attachment_id), None)
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    fname = att["file_name"].lower()
    file_bytes = _read_file_bytes(att["file_path"])
    STYLE = '<style>body{font-family:Arial,sans-serif;padding:20px;font-size:13px;line-height:1.5}table{border-collapse:collapse;width:100%;margin-bottom:16px}td,th{border:1px solid #ddd;padding:5px 8px}th{background:#f5f5f5;font-weight:600}img{max-width:100%}h3{margin-top:20px;color:#333}</style>'
    if fname.endswith(".docx") or fname.endswith(".doc"):
        try:
            import mammoth as _mammoth
            result = _mammoth.convert_to_html(io.BytesIO(file_bytes))
            html = f'<!DOCTYPE html><html><head><meta charset="utf-8">{STYLE}</head><body>{result.value}</body></html>'
            return FastAPIResponse(content=html, media_type="text/html; charset=utf-8")
        except ImportError:
            return FastAPIResponse(
                content=f'<html><body>{STYLE}<p><b>mammoth kütüphanesi eksik.</b><br>Backend terminalde: <code>pip install mammoth --break-system-packages</code> çalıştırın.</p></body></html>',
                media_type="text/html"
            )
        except Exception as e:
            return FastAPIResponse(content=f'<html><body>{STYLE}<p>Word dönüşüm hatası: {e}</p></body></html>', media_type="text/html")
    if fname.endswith(".xlsx") or fname.endswith(".xls"):
        try:
            import openpyxl as _xl
            wb = _xl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
            sheets_html = ""
            for sname in wb.sheetnames:
                ws = wb[sname]
                rows_html = ""
                for i, row in enumerate(ws.iter_rows(values_only=True)):
                    tag = "th" if i == 0 else "td"
                    cells = "".join(f"<{tag}>{'' if v is None else str(v)}</{tag}>" for v in row)
                    rows_html += f"<tr>{cells}</tr>"
                sheets_html += f"<h3>{sname}</h3><table>{rows_html}</table>"
            wb.close()
            html = f'<!DOCTYPE html><html><head><meta charset="utf-8">{STYLE}</head><body>{sheets_html}</body></html>'
            return FastAPIResponse(content=html, media_type="text/html; charset=utf-8")
        except Exception as e:
            return FastAPIResponse(content=f'<html><body>{STYLE}<p>Excel okuma hatası: {e}</p></body></html>', media_type="text/html")
    raise HTTPException(status_code=415, detail="Bu dosya tipi için önizleme desteklenmiyor")

# ── Backup sistemi ────────────────────────────────
import zipfile as _zipfile
BACKUP_DIR = Path(os.environ.get("BACKUP_DIR", str(ROOT_DIR / "backups")))

@api_router.post("/admin/backup")
async def manual_backup(request: Request):
    user = await get_current_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    import json as _json
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_path = BACKUP_DIR / f"evrak_backup_{ts}.zip"
    # Tarih filtresi parametresi (opsiyonel - body'den gelirse)
    try:
        body = await request.json()
        since_days = int(body.get("since_days", 0))  # 0 = tümü
    except Exception:
        since_days = 0

    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=since_days)).isoformat() if since_days > 0 else None

    cols = ["users","documents","document_history","notifications","activity_logs",
            "departments","vendors","permission_groups","counters","categories"]

    with _zipfile.ZipFile(zip_path, "w", _zipfile.ZIP_DEFLATED) as zf:
        # DB koleksiyonları
        for col_name in cols:
            try:
                query = {}
                if cutoff and col_name in ("documents","activity_logs","notifications"):
                    query = {"created_at": {"$gte": cutoff}}
                col_docs = await db[col_name].find(query).to_list(None)
                for d in col_docs: d["_id"] = str(d["_id"])
                zf.writestr(f"db/{col_name}.json",
                    _json.dumps(col_docs, ensure_ascii=False, default=str, indent=2))
            except Exception as e:
                logger.warning(f"Backup: {col_name} atlandı: {e}")

        # Yüklenen belgeler (sadece backend/uploads — JS/frontend yok)
        uploads_dir = ROOT_DIR / "uploads"
        if uploads_dir.exists():
            for fpath in uploads_dir.rglob("*"):
                if not fpath.is_file():
                    continue
                # Tarih filtresi
                if cutoff:
                    mtime = datetime.fromtimestamp(fpath.stat().st_mtime, tz=timezone.utc)
                    if mtime.isoformat() < cutoff:
                        continue
                # Boyut sınırı (100MB)
                if fpath.stat().st_size > 100 * 1024 * 1024:
                    continue
                try:
                    zf.write(fpath, "uploads/" + str(fpath.relative_to(uploads_dir)))
                except Exception:
                    pass

        # Sistem logları
        logs_dir = ROOT_DIR / "logs"
        if logs_dir.exists():
            for fpath in logs_dir.glob("*.log*"):
                if fpath.is_file():
                    try:
                        zf.write(fpath, "logs/" + fpath.name)
                    except Exception:
                        pass

    size_mb = round(zip_path.stat().st_size / 1024 / 1024, 2)
    await log_activity(user["id"], "manual_backup", "system", "backup",
                      {"file": zip_path.name, "size_mb": size_mb}, request=request, user=user)
    return {"success": True, "file": zip_path.name, "size_mb": size_mb, "path": str(zip_path)}

@api_router.get("/admin/backups")
async def list_backups(request: Request):
    user = await get_current_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(BACKUP_DIR.glob("evrak_backup_*.zip"), reverse=True)
    return [{"name": f.name, "size_mb": round(f.stat().st_size/1024/1024, 2),
             "created_at": datetime.fromtimestamp(f.stat().st_mtime).isoformat()} for f in files[:20]]

@api_router.get("/admin/backups/{filename}/download")
async def download_backup(filename: str, request: Request):
    user = await get_current_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    zip_path = BACKUP_DIR / filename
    if not zip_path.exists() or not zip_path.name.startswith("evrak_backup_"):
        raise HTTPException(status_code=404, detail="Dosya bulunamadı")
    return FastAPIResponse(content=zip_path.read_bytes(), media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"})

# ── İhracat Raporu ────────────────────────────────
def _is_ihracat_user(user: dict) -> bool:
    dept = (user.get("department") or "").upper().replace("İ", "I")
    return is_admin(user) or any(d in dept for d in ["IHRACAT","EXPORT","DIS TICARET"])

def _ihracat_date_range(period, start=None, end=None):
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    if period == "bugun":
        return now.replace(hour=0,minute=0,second=0,microsecond=0).isoformat(), now.isoformat()
    if period == "hafta":
        ws = (now - timedelta(days=now.weekday())).replace(hour=0,minute=0,second=0,microsecond=0)
        return ws.isoformat(), now.isoformat()
    if period == "ozel" and start and end:
        return start + "T00:00:00+00:00", end + "T23:59:59+00:00"
    ms = now.replace(day=1,hour=0,minute=0,second=0,microsecond=0)
    return ms.isoformat(), now.isoformat()

async def _get_dept_docs(dept, period, status, start=None, end=None):
    import re as _re2
    dt_start, dt_end = _ihracat_date_range(period, start, end)
    safe = _re2.escape(dept)
    query = {"is_deleted": False, "created_at": {"$gte": dt_start, "$lte": dt_end},
             "$or": [
                 {"current_department": {"$regex": safe, "$options": "i"}},
                 {"involved_departments": {"$elemMatch": {"$regex": safe, "$options": "i"}}},
                 {"created_by_dept": {"$regex": safe, "$options": "i"}},
             ]}
    if status: query["status"] = status
    docs = await db.documents.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    user_cache = {}
    for doc in docs:
        uid = doc.get("created_by", "")
        if uid and uid not in user_cache:
            u = await db.users.find_one({"id": uid}, {"full_name": 1})
            if not u:
                try: u = await db.users.find_one({"_id": ObjectId(uid)}, {"full_name": 1})
                except Exception: u = None
            user_cache[uid] = (u.get("full_name") or uid) if u else uid
        doc["created_by_name"] = user_cache.get(uid, "")
        # Onaylayan kişi — stamp alanından al
        stamp = doc.get("stamp") or {}
        doc["approved_by_name"] = stamp.get("approved_by", "")
        doc["onay_no"]          = stamp.get("onay_no", "")
        doc["approved_at"]      = stamp.get("approved_at", "")
    return docs

@api_router.get("/rapor/preview")
async def rapor_preview(request: Request, period: str = "ay", status: str = "", start: str = None, end: str = None, dept: str = None):
    user = await get_current_user(request)
    # Admin tüm birimler, normal kullanıcı sadece kendi birimi
    target_dept = dept if (is_admin(user) and dept) else user.get("department", "")
    docs = await _get_dept_docs(target_dept, period, status, start, end)
    summary = {"total": len(docs),
               "approved": sum(1 for d in docs if d.get("status") == "approved"),
               "rejected": sum(1 for d in docs if d.get("status") == "rejected"),
               "iade": sum(1 for d in docs if d.get("status") == "iade"),
               "revize": sum(1 for d in docs if d.get("status") == "revize"),
               "pending": sum(1 for d in docs if d.get("status") in ("pending","in_progress"))}
    return {"summary": summary, "documents": docs}

@api_router.get("/rapor/excel")
async def rapor_excel(request: Request, period: str = "ay", status: str = "", start: str = None, end: str = None, dept: str = None):
    user = await get_current_user(request)
    target_dept = dept if (is_admin(user) and dept) else user.get("department", "")
    docs = await _get_dept_docs(target_dept, period, status, start, end)
    import openpyxl as _xl
    from openpyxl.styles import Font, PatternFill, Alignment
    STATUS_TR = {"approved":"Onaylandı","rejected":"Reddedildi","iade":"İade","revize":"Revize",
                 "in_progress":"İşlemde","pending":"Beklemede","draft":"Taslak","cancelled":"İptal"}
    wb = _xl.Workbook()
    ws = wb.active
    ws.title = "İhracat Raporu"
    headers = ["Belge No","Başlık","Açıklama","Kategori","Cari","Durum","Oluşturan","Birim","Oluşturma","Hedef Tarih","Onaylayan","Onay No","Onay Tarihi"]
    hf = PatternFill("solid", fgColor="1E293B")
    for c, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=c, value=h)
        cell.fill = hf; cell.font = Font(color="FFFFFF", bold=True)
        cell.alignment = Alignment(horizontal="center")
    for ri, doc in enumerate(docs, 2):
        def fd(v): return v[:10] if v else ""
        row = [doc.get("belge_no",""), doc.get("title",""), doc.get("description",""),
               doc.get("category",""), doc.get("cari",""),
               STATUS_TR.get(doc.get("status",""), doc.get("status","")),
               doc.get("created_by_name",""), doc.get("current_department",""),
               fd(doc.get("created_at")), fd(doc.get("hedef_tarih")),
               doc.get("approved_by_name",""), doc.get("onay_no",""), fd(doc.get("approved_at",""))]
        for c, v in enumerate(row, 1):
            cell = ws.cell(row=ri, column=c, value=v)
            if ri % 2 == 0: cell.fill = PatternFill("solid", fgColor="F8FAFC")
    for c, w in enumerate([14,30,35,18,25,15,20,18,14,14,22,14,14], 1):
        ws.column_dimensions[_xl.utils.get_column_letter(c)].width = w
    ws2 = wb.create_sheet("Özet")
    for r, (k, v) in enumerate([("Dönem", period), ("Toplam", len(docs)),
                                  ("Onaylanan", sum(1 for d in docs if d.get("status")=="approved")),
                                  ("Reddedilen", sum(1 for d in docs if d.get("status")=="rejected"))], 1):
        ws2.cell(row=r, column=1, value=k).font = Font(bold=True)
        ws2.cell(row=r, column=2, value=v)
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    fname_dl = f"ihracat_rapor_{period}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    await log_activity(user["id"], "rapor_excel", "report", target_dept,
                      {"period": period, "count": len(docs)}, request=request, user=user)
    return FastAPIResponse(content=buf.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={fname_dl}"})

app.include_router(api_router)

# Global exception handler
import traceback as _tb
from fastapi.responses import JSONResponse as _JSONResponse

@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    tb = _tb.format_exc()
    logger.error(
        f"UNHANDLED EXCEPTION on {request.method} {request.url.path}\n"
        f"User-Agent: {request.headers.get('user-agent','-')}\n"
        f"{tb}"
    )
    return _JSONResponse(status_code=500, content={"detail": f"Server error: {type(exc).__name__}: {exc}"})

# CORS — local agdan erisim icin, Emergent bagimliligi kaldirildi
_cors_origins_env = os.environ.get('CORS_ORIGINS', '').strip()
if _cors_origins_env and _cors_origins_env != '*':
    _origins = [o.strip() for o in _cors_origins_env.split(',') if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    logger.info(f"CORS: explicit origins: {_origins}")
else:
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.[0-9]+\.[0-9]+|10\.[0-9]+\.[0-9]+\.[0-9]+|172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9]+\.[0-9]+)(:[0-9]+)?",
        allow_methods=["*"],
        allow_headers=["*"],
    )
    logger.info("CORS: local network mode")

@app.on_event("shutdown")  # noqa: deprecated
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)
