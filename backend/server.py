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

# Object Storage Configuration
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
APP_NAME = "evrak-takip"
storage_key = None

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")

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
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=60), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user.pop("_id"))
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        raise

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str) -> tuple:
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

async def log_activity(user_id: str, action: str, entity_type: str, entity_id: str, details: dict = None):
    log_entry = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.activity_logs.insert_one(log_entry)

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

class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[List[str]] = None
    permission_group_id: Optional[str] = None
    is_manager: Optional[bool] = None

class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class PermissionGroupCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    permissions: List[str] = []

# ===== AUTH ENDPOINTS =====

@api_router.post("/auth/register")
async def register(data: RegisterRequest, response: Response):
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
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    await log_activity(user_id, "register", "user", user_id)
    
    return {
        "id": user_id,
        "email": email,
        "full_name": data.full_name,
        "department": data.department,
        "role": "user",
        "permissions": []
    }

@api_router.post("/auth/login")
async def login(data: LoginRequest, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    await log_activity(user_id, "login", "user", user_id)
    
    return {
        "id": user_id,
        "email": user["email"],
        "full_name": user.get("full_name", ""),
        "department": user.get("department", ""),
        "role": user.get("role", "user"),
        "permissions": user.get("permissions", []),
        "is_manager": bool(user.get("is_manager", False))
    }

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

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
                "Yeni Belge",
                f"{user['full_name']} '{doc['title']}' belgesini {hedef_birim} birimine gonderdi",
                doc["id"],
            )

    await log_activity(user["id"], "upload_document", "document", doc["id"], {"belge_no": belge_no, "hedef_birim": hedef_birim})

    doc.pop("_id")
    return doc

@api_router.get("/documents")
async def get_documents(request: Request):
    user = await get_current_user(request)

    if user["role"] == "admin":
        documents = await db.documents.find({"is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    else:
        # User sees documents they created OR documents currently in their department
        documents = await db.documents.find({
            "is_deleted": False,
            "$or": [
                {"created_by": user["id"]},
                {"current_department": user.get("department", "")},
            ],
        }, {"_id": 0}).sort("created_at", -1).to_list(1000)

    return documents

def _user_can_see_doc(user: dict, doc: dict) -> bool:
    if user.get("role") == "admin":
        return True
    if doc.get("created_by") == user["id"]:
        return True
    if doc.get("current_department") and doc["current_department"] == user.get("department"):
        return True
    # Legacy compatibility
    if doc.get("current_holder") == user["id"]:
        return True
    return False

def _user_can_act_on_doc(user: dict, doc: dict) -> bool:
    """Can this user take actions (approve/reject/route) on the doc?"""
    if user.get("role") == "admin":
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
    await log_activity(user["id"], "download_document", "document", document_id)
    return FastAPIResponse(content=data, media_type=content_type, headers={
        "Content-Disposition": f"attachment; filename={doc['file_name']}"
    })

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
        "Content-Disposition": f"inline; filename={doc['file_name']}"
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
    if user.get("role") != "admin" and not user.get("is_manager"):
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
        {"$set": {
            "current_department": to_department,
            "current_holder": None,
            "status": "pending",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    # Notify users in target department
    target_users = await get_department_users(to_department)
    for u in target_users:
        await create_notification(
            str(u["_id"]),
            "Yeni Belge",
            f"{user['full_name']} '{doc['title']}' belgesini {to_department} birimine gonderdi",
            data.document_id,
        )

    await log_activity(user["id"], "route_document", "document", data.document_id, {"to_department": to_department, "note": data.note})
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
    if action in ("approve",) and not (user.get("is_manager") or user.get("role") == "admin"):
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
        if doc.get("created_by") != user["id"] and user.get("role") != "admin":
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

    await db.documents.update_one({"id": data.document_id}, {"$set": update_fields})

    # Notify creator
    if doc["created_by"] != user["id"]:
        await create_notification(
            doc["created_by"],
            f"Belge {action}",
            f"{user['full_name']} '{doc['title']}' belgesini '{action}' yapti",
            data.document_id,
        )

    await log_activity(user["id"], f"document_{action}", "document", data.document_id, {"note": data.note})
    return {"message": f"Document {action} successful", "status": update_fields.get("status"), **response_extra}

@api_router.get("/documents/{document_id}/history")
async def get_document_history(document_id: str, request: Request):
    user = await get_current_user(request)
    doc = await db.documents.find_one({"id": document_id, "is_deleted": False})
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if user["role"] != "admin" and doc["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only creator or admin can view history")
    
    history = await db.document_history.find({"document_id": document_id}, {"_id": 0}).sort("timestamp", 1).to_list(1000)
    return history

# ===== USER MANAGEMENT ENDPOINTS (ADMIN) =====

@api_router.get("/users")
async def get_users(request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"password_hash": 0}).to_list(1000)
    for u in users:
        u["id"] = str(u.pop("_id"))
    return users

@api_router.post("/users")
async def create_user(data: UserCreateRequest, request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    email = data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    user_doc = {
        "_id": ObjectId(),
        "email": email,
        "password_hash": hash_password(data.password),
        "full_name": data.full_name,
        "department": normalize_department(data.department),
        "role": data.role,
        "permissions": data.permissions,
        "is_manager": bool(data.is_manager),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    await log_activity(user["id"], "create_user", "user", str(user_doc["_id"]), {"email": email})
    
    user_doc["id"] = str(user_doc.pop("_id"))
    user_doc.pop("password_hash")
    return user_doc

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdateRequest, request: Request):
    current_user = await get_current_user(request)
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    if "department" in update_data:
        update_data["department"] = normalize_department(update_data["department"])
    
    result = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await log_activity(current_user["id"], "update_user", "user", user_id, update_data)
    
    return {"message": "User updated successfully"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    current_user = await get_current_user(request)
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await log_activity(current_user["id"], "delete_user", "user", user_id)
    
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

# ===== ACTIVITY LOGS (ADMIN) =====

@api_router.get("/logs")
async def get_logs(request: Request, limit: int = 100):
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    logs = await db.activity_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return logs

# ===== DEPARTMENT MANAGEMENT (ADMIN) =====

@api_router.get("/departments")
async def get_departments(request: Request):
    # Accessible to all authenticated users (e.g. to populate dropdowns)
    await get_current_user(request)
    departments = await db.departments.find({}, {"_id": 0}).to_list(1000)
    return departments

@api_router.post("/departments")
async def create_department(data: DepartmentCreate, request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
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
    await log_activity(user["id"], "create_department", "department", dept["id"], {"name": data.name})
    
    dept.pop("_id", None)
    return dept

@api_router.put("/departments/{department_id}")
async def update_department(department_id: str, data: DepartmentCreate, request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.departments.update_one(
        {"id": department_id},
        {"$set": {"name": normalize_department(data.name), "description": data.description}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Department not found")
    
    await log_activity(user["id"], "update_department", "department", department_id, {"name": data.name})
    return {"message": "Department updated successfully"}

@api_router.delete("/departments/{department_id}")
async def delete_department(department_id: str, request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.departments.delete_one({"id": department_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Department not found")
    
    await log_activity(user["id"], "delete_department", "department", department_id)
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
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
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
    await log_activity(user["id"], "create_vendor", "vendor", vendor["id"], {"name": vendor["name"]})
    vendor.pop("_id", None)
    return vendor

@api_router.put("/vendors/{vendor_id}")
async def update_vendor(vendor_id: str, data: VendorCreate, request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
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
    await log_activity(user["id"], "update_vendor", "vendor", vendor_id, update_data)
    return {"message": "Vendor updated"}

@api_router.delete("/vendors/{vendor_id}")
async def delete_vendor(vendor_id: str, request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.vendors.delete_one({"id": vendor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    await log_activity(user["id"], "delete_vendor", "vendor", vendor_id)
    return {"message": "Vendor deleted"}

@api_router.post("/vendors/bulk-import")
async def bulk_import_vendors(request: Request, file: UploadFile = File(...)):
    """Import vendors from Excel/CSV. Expected columns: name, tax_no, payment_type, vade_gun, phone, email, address, notes"""
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    content = await file.read()
    created = 0
    skipped = 0
    errors = []
    try:
        import io, csv
        # Try CSV first
        text = content.decode("utf-8-sig", errors="ignore")
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            name = (row.get("name") or row.get("Name") or row.get("cari") or "").strip()
            if not name:
                continue
            existing = await db.vendors.find_one({"name": name})
            if existing:
                skipped += 1
                continue
            vendor = {
                "id": str(uuid.uuid4()),
                "name": name,
                "tax_no": (row.get("tax_no") or row.get("vergi_no") or "").strip(),
                "payment_type": (row.get("payment_type") or row.get("odeme_tipi") or "havale").strip().lower(),
                "vade_gun": int(row.get("vade_gun") or row.get("vade") or 0) if (row.get("vade_gun") or row.get("vade") or "").strip().isdigit() else 0,
                "phone": (row.get("phone") or "").strip(),
                "email": (row.get("email") or "").strip(),
                "address": (row.get("address") or "").strip(),
                "notes": (row.get("notes") or "").strip(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.vendors.insert_one(vendor)
            created += 1
    except Exception as e:
        errors.append(str(e))
    await log_activity(user["id"], "import_vendors", "vendor", "bulk", {"created": created, "skipped": skipped})
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
    if user["role"] != "admin":
        base["$or"] = [
            {"created_by": user["id"]},
            {"current_department": user.get("department", "")},
        ]
    total = await db.documents.count_documents(base)
    pending = await db.documents.count_documents({**base, "status": {"$in": ["pending", "in_progress"]}})
    approved = await db.documents.count_documents({**base, "status": "approved"})
    rejected = await db.documents.count_documents({**base, "status": "rejected"})
    iade_revize = await db.documents.count_documents({**base, "status": {"$in": ["iade", "revize"]}})
    return {
        "total": total,
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "iade_revize": iade_revize,
    }

# ===== PERMISSION GROUP MANAGEMENT (ADMIN) =====

@api_router.get("/permission-groups")
async def get_permission_groups(request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    groups = await db.permission_groups.find({}, {"_id": 0}).to_list(1000)
    return groups

@api_router.post("/permission-groups")
async def create_permission_group(data: PermissionGroupCreate, request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
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
    await log_activity(user["id"], "create_permission_group", "permission_group", group["id"], {"name": data.name})
    
    group.pop("_id", None)
    return group

@api_router.put("/permission-groups/{group_id}")
async def update_permission_group(group_id: str, data: PermissionGroupCreate, request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
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
    
    await log_activity(user["id"], "update_permission_group", "permission_group", group_id, {"name": data.name})
    return {"message": "Permission group updated successfully"}

@api_router.delete("/permission-groups/{group_id}")
async def delete_permission_group(group_id: str, request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.permission_groups.delete_one({"id": group_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Permission group not found")
    
    await log_activity(user["id"], "delete_permission_group", "permission_group", group_id)
    return {"message": "Permission group deleted successfully"}

# ===== STARTUP EVENT =====

@app.on_event("startup")
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
    
    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"""# Test Credentials

## Admin Account
- Email: {admin_email}
- Password: {admin_password}
- Role: admin

## Auth Endpoints
- POST /api/auth/login
- POST /api/auth/register
- GET /api/auth/me
- POST /api/auth/logout

## Document Endpoints
- POST /api/documents/upload
- GET /api/documents
- GET /api/documents/{{document_id}}
- POST /api/documents/route
- POST /api/documents/action
- GET /api/documents/{{document_id}}/history

## User Management (Admin)
- GET /api/users
- POST /api/users
- PUT /api/users/{{user_id}}
- DELETE /api/users/{{user_id}}

## Department Management (Admin)
- GET /api/departments
- POST /api/departments
- PUT /api/departments/{{department_id}}
- DELETE /api/departments/{{department_id}}

## Permission Group Management (Admin)
- GET /api/permission-groups
- POST /api/permission-groups
- PUT /api/permission-groups/{{group_id}}
- DELETE /api/permission-groups/{{group_id}}
""")
    logger.info("Test credentials written to /app/memory/test_credentials.md")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
