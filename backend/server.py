from dotenv import load_dotenv
load_dotenv()

import os
import jwt
import bcrypt
import secrets
import random
import hashlib
import json
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import stripe

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

client = AsyncIOMotorClient(MONGO_URL, tz_aware=True, tzinfo=timezone.utc)
db = client[DB_NAME]

app = FastAPI(title="SENTINEL Device Security API")
api = APIRouter(prefix="/api")

# Tax mode resolved on startup (see seed)
TAX_MODE = "calc_only"
SMP_COUNTRIES = {"AU","AT","BE","BG","CA","HR","CY","CZ","DK","EE","FI","FR","DE","GI","GR",
    "HK","HU","IE","IT","JP","LV","LI","LT","LU","MT","NL","NO","PL","PT","RO",
    "SG","SK","SI","ES","SE","CH","GB","US"}

# ----------------------------------------------------------------------------
# Auth helpers
# ----------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(minutes=15), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=900, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")

def serialize_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "user"),
        "plan": user.get("plan", "free"),
        "created_at": user.get("created_at").isoformat() if isinstance(user.get("created_at"), datetime) else user.get("created_at"),
    }

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
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ----------------------------------------------------------------------------
# Auth models + endpoints
# ----------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

async def check_lockout(identifier: str):
    rec = await db.login_attempts.find_one({"identifier": identifier})
    if rec and rec.get("count", 0) >= 5:
        locked_until = rec.get("locked_until")
        if locked_until and locked_until > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")

async def register_failure(identifier: str):
    await db.login_attempts.update_one(
        {"identifier": identifier},
        {"$inc": {"count": 1},
         "$set": {"locked_until": datetime.now(timezone.utc) + timedelta(minutes=15)}},
        upsert=True)

@api.post("/auth/register")
async def register(body: RegisterRequest, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {"email": email, "password_hash": hash_password(body.password),
           "name": body.name, "role": "user", "plan": "free",
           "created_at": datetime.now(timezone.utc)}
    result = await db.users.insert_one(doc)
    uid = str(result.inserted_id)
    set_auth_cookies(response, create_access_token(uid, email), create_refresh_token(uid))
    doc["_id"] = result.inserted_id
    return serialize_user(doc)

@api.post("/auth/login")
async def login(body: LoginRequest, request: Request, response: Response):
    email = body.email.lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    await check_lockout(identifier)
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        await register_failure(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.login_attempts.delete_one({"identifier": identifier})
    uid = str(user["_id"])
    set_auth_cookies(response, create_access_token(uid, email), create_refresh_token(uid))
    return serialize_user(user)

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"status": "ok"}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return serialize_user(user)

@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        response.set_cookie("access_token", create_access_token(str(user["_id"]), user["email"]),
                            httponly=True, secure=True, samesite="none", max_age=900, path="/")
        return {"status": "ok"}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ----------------------------------------------------------------------------
# Device security domain
# ----------------------------------------------------------------------------
THREAT_POOL = [
    ("Trojan.Win32.Emotet", "Trojan", "critical"),
    ("Adware.MacOS.Pirrit", "Adware", "medium"),
    ("Spyware.Android.FluBot", "Spyware", "high"),
    ("Worm.Win32.Conficker", "Worm", "high"),
    ("Ransom.Win32.WannaCry", "Ransomware", "critical"),
    ("PUA.Win32.CoinMiner", "Miner", "medium"),
    ("Trojan.JS.Redirector", "Trojan", "high"),
    ("Adware.Win32.DealPly", "Adware", "low"),
    ("Backdoor.Linux.Mirai", "Backdoor", "critical"),
    ("Spyware.Win32.Keylogger", "Spyware", "high"),
]
PATHS = ["/Users/system/Library/Caches/", "C:\\Windows\\System32\\", "/var/tmp/",
         "C:\\Users\\AppData\\Local\\Temp\\", "/private/var/folders/", "/opt/data/downloads/"]

def rand_hash():
    return hashlib.sha256(secrets.token_bytes(16)).hexdigest()[:40]

async def compute_security_score(uid: str) -> int:
    active = await db.threats.count_documents({"user_id": uid, "status": "active"})
    state = await db.protection.find_one({"user_id": uid}) or {}
    score = 100
    score -= active * 12
    if not state.get("realtime", True): score -= 15
    if not state.get("firewall", True): score -= 10
    last = await db.scans.find_one({"user_id": uid, "status": "completed"}, sort=[("completed_at", -1)])
    if not last:
        score -= 10
    elif isinstance(last.get("completed_at"), datetime):
        days = (datetime.now(timezone.utc) - last["completed_at"]).days
        if days > 7: score -= 8
    return max(5, min(100, score))

async def ensure_protection(uid: str) -> dict:
    state = await db.protection.find_one({"user_id": uid})
    if not state:
        state = {"user_id": uid, "realtime": True, "firewall": True, "webshield": True}
        await db.protection.insert_one(state)
    return state

@api.get("/dashboard/overview")
async def dashboard_overview(user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    await ensure_protection(uid)
    state = await db.protection.find_one({"user_id": uid})
    score = await compute_security_score(uid)
    active_threats = await db.threats.find({"user_id": uid, "status": "active"}).sort("detected_at", -1).to_list(50)
    quarantined = await db.threats.count_documents({"user_id": uid, "status": "quarantined"})
    last_scan = await db.scans.find_one({"user_id": uid, "status": "completed"}, sort=[("completed_at", -1)])
    vpn = await db.vpn_state.find_one({"user_id": uid}) or {"connected": False}
    seed = int(hashlib.md5(uid.encode()).hexdigest(), 16)
    rnd = random.Random(seed + datetime.now(timezone.utc).hour)
    return {
        "security_score": score,
        "status": "protected" if score >= 80 else ("at_risk" if score >= 50 else "critical"),
        "protection": {"realtime": state.get("realtime", True),
                       "firewall": state.get("firewall", True),
                       "webshield": state.get("webshield", True),
                       "vpn": vpn.get("connected", False)},
        "device_health": {
            "cpu": rnd.randint(8, 42),
            "memory": rnd.randint(35, 78),
            "disk": rnd.randint(40, 85),
            "battery": rnd.randint(45, 100),
            "os": "Sentinel OS 14.2",
            "uptime_hours": rnd.randint(2, 340),
        },
        "threats": {
            "active": len(active_threats),
            "quarantined": quarantined,
            "list": [serialize_threat(t) for t in active_threats[:6]],
        },
        "last_scan": last_scan["completed_at"].isoformat() if last_scan and isinstance(last_scan.get("completed_at"), datetime) else None,
    }

def serialize_threat(t: dict) -> dict:
    return {"id": str(t["_id"]), "name": t["name"], "type": t["type"],
            "severity": t["severity"], "path": t["path"], "hash": t["hash"],
            "status": t["status"],
            "detected_at": t["detected_at"].isoformat() if isinstance(t.get("detected_at"), datetime) else t.get("detected_at")}

@api.post("/scan/start")
async def scan_start(user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    running = await db.scans.find_one({"user_id": uid, "status": "running"})
    if running:
        return {"scan_id": str(running["_id"]), "status": "running"}
    rnd = random.Random(secrets.randbits(32))
    n_threats = rnd.choices([0, 1, 2, 3, 4], weights=[30, 25, 20, 15, 10])[0]
    pending = []
    for _ in range(n_threats):
        name, ttype, sev = rnd.choice(THREAT_POOL)
        pending.append({"name": name, "type": ttype, "severity": sev,
                        "path": rnd.choice(PATHS) + rand_hash()[:8],
                        "hash": rand_hash()})
    doc = {"user_id": uid, "status": "running",
           "started_at": datetime.now(timezone.utc),
           "duration_seconds": 12,
           "total_files": rnd.randint(48000, 142000),
           "pending_threats": pending,
           "threats_found": n_threats}
    result = await db.scans.insert_one(doc)
    return {"scan_id": str(result.inserted_id), "status": "running"}

SCAN_STAGES = ["Initializing scan engine", "Scanning system files", "Analyzing memory",
               "Inspecting startup items", "Checking network connections",
               "Deep scanning user files", "Verifying signatures", "Finalizing report"]

@api.get("/scan/{scan_id}")
async def scan_status(scan_id: str, user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    scan = await db.scans.find_one({"_id": ObjectId(scan_id), "user_id": uid})
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    if scan["status"] == "completed":
        threats = await db.threats.find({"user_id": uid, "scan_id": scan_id}).to_list(50)
        return {"scan_id": scan_id, "status": "completed", "progress": 100,
                "files_scanned": scan["total_files"], "total_files": scan["total_files"],
                "current_stage": "Scan complete", "threats_found": scan["threats_found"],
                "threats": [serialize_threat(t) for t in threats]}
    elapsed = (datetime.now(timezone.utc) - scan["started_at"]).total_seconds()
    progress = min(100.0, elapsed / scan["duration_seconds"] * 100)
    if progress >= 100:
        inserted = []
        for p in scan.get("pending_threats", []):
            td = {**p, "user_id": uid, "scan_id": scan_id, "status": "active",
                  "detected_at": datetime.now(timezone.utc)}
            r = await db.threats.insert_one(td)
            td["_id"] = r.inserted_id
            inserted.append(td)
        await db.scans.update_one({"_id": scan["_id"]},
            {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}})
        return {"scan_id": scan_id, "status": "completed", "progress": 100,
                "files_scanned": scan["total_files"], "total_files": scan["total_files"],
                "current_stage": "Scan complete", "threats_found": scan["threats_found"],
                "threats": [serialize_threat(t) for t in inserted]}
    stage = SCAN_STAGES[min(len(SCAN_STAGES) - 1, int(progress / 100 * len(SCAN_STAGES)))]
    files_scanned = int(scan["total_files"] * progress / 100)
    return {"scan_id": scan_id, "status": "running", "progress": round(progress, 1),
            "files_scanned": files_scanned, "total_files": scan["total_files"],
            "current_stage": stage,
            "current_file": random.choice(PATHS) + rand_hash()[:10],
            "threats_found": scan["threats_found"] if progress > 70 else 0}

@api.get("/scan/history/list")
async def scan_history(user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    scans = await db.scans.find({"user_id": uid, "status": "completed"}).sort("completed_at", -1).to_list(20)
    return [{"id": str(s["_id"]),
             "completed_at": s["completed_at"].isoformat() if isinstance(s.get("completed_at"), datetime) else None,
             "total_files": s["total_files"], "threats_found": s["threats_found"]} for s in scans]

@api.get("/threats")
async def list_threats(user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    threats = await db.threats.find({"user_id": uid}).sort("detected_at", -1).to_list(200)
    return [serialize_threat(t) for t in threats]

@api.post("/threats/{threat_id}/quarantine")
async def quarantine_threat(threat_id: str, user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    res = await db.threats.update_one({"_id": ObjectId(threat_id), "user_id": uid},
                                      {"$set": {"status": "quarantined"}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Threat not found")
    return {"status": "quarantined"}

@api.post("/threats/{threat_id}/remove")
async def remove_threat(threat_id: str, user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    res = await db.threats.update_one({"_id": ObjectId(threat_id), "user_id": uid},
                                      {"$set": {"status": "removed"}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Threat not found")
    return {"status": "removed"}

class ProtectionToggle(BaseModel):
    key: str
    value: bool

@api.post("/protection/toggle")
async def toggle_protection(body: ProtectionToggle, user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    if body.key not in ("realtime", "firewall", "webshield"):
        raise HTTPException(status_code=400, detail="Invalid protection key")
    await ensure_protection(uid)
    await db.protection.update_one({"user_id": uid}, {"$set": {body.key: body.value}})
    return {"status": "ok", "key": body.key, "value": body.value}

# ----------------------------------------------------------------------------
# VPN
# ----------------------------------------------------------------------------
VPN_SERVERS = [
    {"id": "us-nyc", "country": "United States", "code": "US", "city": "New York", "ping": 24, "load": 42},
    {"id": "us-sfo", "country": "United States", "code": "US", "city": "San Francisco", "ping": 38, "load": 55},
    {"id": "uk-lon", "country": "United Kingdom", "code": "GB", "city": "London", "ping": 88, "load": 31},
    {"id": "de-fra", "country": "Germany", "code": "DE", "city": "Frankfurt", "ping": 96, "load": 48},
    {"id": "jp-tyo", "country": "Japan", "code": "JP", "city": "Tokyo", "ping": 142, "load": 27},
    {"id": "sg-sin", "country": "Singapore", "code": "SG", "city": "Singapore", "ping": 158, "load": 36},
    {"id": "au-syd", "country": "Australia", "code": "AU", "city": "Sydney", "ping": 210, "load": 22},
    {"id": "ca-tor", "country": "Canada", "code": "CA", "city": "Toronto", "ping": 45, "load": 39},
]

@api.get("/vpn/servers")
async def vpn_servers(user: dict = Depends(get_current_user)):
    return VPN_SERVERS

@api.get("/vpn/status")
async def vpn_status(user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    state = await db.vpn_state.find_one({"user_id": uid})
    if not state or not state.get("connected"):
        return {"connected": False}
    dur = (datetime.now(timezone.utc) - state["connected_at"]).total_seconds()
    server = next((s for s in VPN_SERVERS if s["id"] == state["server_id"]), None)
    return {"connected": True, "server": server, "ip": state["ip"],
            "connected_seconds": int(dur),
            "data_down_mb": round(dur * 0.42, 1), "data_up_mb": round(dur * 0.11, 1)}

class VpnConnect(BaseModel):
    server_id: str

@api.post("/vpn/connect")
async def vpn_connect(body: VpnConnect, user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    server = next((s for s in VPN_SERVERS if s["id"] == body.server_id), None)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    fake_ip = f"{random.randint(23,199)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"
    await db.vpn_state.update_one({"user_id": uid},
        {"$set": {"connected": True, "server_id": body.server_id,
                  "connected_at": datetime.now(timezone.utc), "ip": fake_ip}}, upsert=True)
    return {"connected": True, "server": server, "ip": fake_ip}

@api.post("/vpn/disconnect")
async def vpn_disconnect(user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    await db.vpn_state.update_one({"user_id": uid}, {"$set": {"connected": False}})
    return {"connected": False}

# ----------------------------------------------------------------------------
# AI Security Assistant (Claude Sonnet 4.6, streaming)
# ----------------------------------------------------------------------------
SYSTEM_PROMPT = (
    "You are SENTINEL, an elite AI cybersecurity assistant embedded in a device "
    "security app. You help users understand threats, malware, VPNs, phishing, "
    "passwords, and device hygiene. Be precise, tactical, and concise. Use short "
    "paragraphs and bullet points. Never invent that you scanned their device; "
    "refer them to the Scan and Dashboard features when relevant."
)

class ChatMessage(BaseModel):
    message: str

@api.get("/assistant/history")
async def assistant_history(user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    msgs = await db.chat_messages.find({"user_id": uid}).sort("created_at", 1).to_list(200)
    return [{"role": m["role"], "content": m["content"],
             "created_at": m["created_at"].isoformat() if isinstance(m.get("created_at"), datetime) else None}
            for m in msgs]

@api.post("/assistant/clear")
async def assistant_clear(user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    await db.chat_messages.delete_many({"user_id": uid})
    return {"status": "cleared"}

@api.post("/assistant/chat")
async def assistant_chat(body: ChatMessage, user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    now = datetime.now(timezone.utc)
    await db.chat_messages.insert_one({"user_id": uid, "role": "user",
                                       "content": body.message, "created_at": now})
    history = await db.chat_messages.find({"user_id": uid}).sort("created_at", 1).to_list(30)

    context = SYSTEM_PROMPT
    prior = history[:-1][-10:]
    if prior:
        convo = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in prior)
        context += "\n\nRecent conversation:\n" + convo

    from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"sentinel-{uid}",
                   system_message=context).with_model("anthropic", "claude-sonnet-4-6")

    async def gen():
        full = ""
        try:
            async for event in chat.stream_message(UserMessage(text=body.message)):
                if isinstance(event, TextDelta):
                    full += event.content
                    yield f"data: {json.dumps({'delta': event.content})}\n\n"
                elif isinstance(event, StreamDone):
                    break
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        await db.chat_messages.insert_one({"user_id": uid, "role": "assistant",
                                           "content": full, "created_at": datetime.now(timezone.utc)})
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

# ----------------------------------------------------------------------------
# Payments (Stripe Flow A)
# ----------------------------------------------------------------------------
class CheckoutRequest(BaseModel):
    lookup_key: str
    origin_url: str

@api.get("/payments/plans")
async def payments_plans():
    plans = []
    for lk, meta in [
        ("basic_monthly", {"name": "Basic", "price": 9.99, "tagline": "Essential protection"}),
        ("pro_monthly", {"name": "Pro", "price": 19.99, "tagline": "Advanced defense + VPN"}),
        ("enterprise_monthly", {"name": "Enterprise", "price": 49.99, "tagline": "Total command center"}),
    ]:
        plans.append({"lookup_key": lk, **meta})
    return plans

@api.post("/payments/checkout")
async def create_checkout(body: CheckoutRequest, user: dict = Depends(get_current_user)):
    prices = stripe.Price.list(lookup_keys=[body.lookup_key], active=True, limit=1).data
    if not prices:
        raise HTTPException(status_code=500, detail=f"Price not found: {body.lookup_key}")
    price = prices[0]
    kwargs = dict(
        line_items=[{"price": price.id, "quantity": 1}],
        mode="subscription" if price.recurring else "payment",
        success_url=f"{body.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{body.origin_url}/payment/cancel",
        metadata={"user_id": str(user["_id"]), "lookup_key": body.lookup_key},
    )
    if TAX_MODE == "full":
        try:
            session = stripe.checkout.Session.create(**kwargs, managed_payments={"enabled": True})
        except stripe.error.InvalidRequestError as e:
            msg = (e.user_message or "").lower()
            if "managed payments" in msg or "ineligible" in msg:
                session = stripe.checkout.Session.create(**kwargs, automatic_tax={"enabled": True},
                                                         billing_address_collection="required")
            else:
                raise
    elif TAX_MODE == "calc_only":
        session = stripe.checkout.Session.create(**kwargs, automatic_tax={"enabled": True},
                                                 billing_address_collection="required")
    else:
        session = stripe.checkout.Session.create(**kwargs)
    await db.payment_transactions.insert_one({
        "session_id": session.id, "user_id": str(user["_id"]), "lookup_key": body.lookup_key,
        "amount": (price.unit_amount or 0) / 100, "currency": price.currency,
        "status": "initiated", "payment_status": "pending",
        "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)})
    return {"checkout_url": session.url, "session_id": session.id}

@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id})
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid",
                              "updated_at": datetime.now(timezone.utc)}})
                if record.get("user_id") and record.get("lookup_key"):
                    plan = record["lookup_key"].split("_")[0]
                    await db.users.update_one({"_id": ObjectId(record["user_id"])},
                                              {"$set": {"plan": plan}})
                record = await db.payment_transactions.find_one({"session_id": session_id})
        except stripe.error.StripeError:
            pass
    return {"session_id": record["session_id"], "status": record["status"],
            "payment_status": record["payment_status"]}

@app.post("/api/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": obj.get("payment_status", "paid"),
                      "updated_at": datetime.now(timezone.utc)}})
        meta = obj.get("metadata", {})
        if meta.get("user_id") and meta.get("lookup_key"):
            plan = meta["lookup_key"].split("_")[0]
            await db.users.update_one({"_id": ObjectId(meta["user_id"])}, {"$set": {"plan": plan}})
    return {"status": "ok"}

# ----------------------------------------------------------------------------
# Health + startup
# ----------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"service": "SENTINEL Device Security API", "status": "online"}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    global TAX_MODE
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.threats.create_index([("user_id", 1), ("status", 1)])
    # seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@sentinel.io")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({"email": admin_email, "password_hash": hash_password(admin_password),
                                   "name": "Admin", "role": "admin", "plan": "enterprise",
                                   "created_at": datetime.now(timezone.utc)})
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})
    # resolve tax mode from stripe account
    try:
        country = stripe.Account.retrieve().get("country", "US")
        TAX_MODE = "full" if country in SMP_COUNTRIES else "calc_only"
    except Exception:
        TAX_MODE = "calc_only"
