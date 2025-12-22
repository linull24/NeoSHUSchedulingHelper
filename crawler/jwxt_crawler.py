#!/usr/bin/env python3
"""
LEGACY (server-side fallback)

This Python crawler exists as an occasional, server-side/CI fallback to generate static JWXT
course snapshots under `app/static/crawler/data/` for SSG deployments.

Primary path: browser-first JWXT access via the Userscript backend bridge:
- `app/static/backenduserscript/src/index.ts`
- Output snapshots are consumed by `app/src/lib/data/catalog/cloudSnapshot.ts`

Do NOT treat this crawler as the main runtime backend. Prefer the frontend-first flow and keep
credentials out of logs/sync bundles per `spec://cluster/jwxt#chunk-01`.
"""

import argparse
import base64
import getpass
import concurrent.futures
import hashlib
import json
import os
import re
import sys
import time
import threading
from pathlib import Path
from typing import Callable, Dict, List, Tuple, TypedDict, cast
from urllib.parse import urljoin

import requests
import rsa
from bs4 import BeautifulSoup
from requests.cookies import RequestsCookieJar, create_cookie

JWXT_HOST = "https://jwxt.shu.edu.cn"
SSO_HOST = "https://newsso.shu.edu.cn"
SELECTION_ENDPOINT = (
    f"{JWXT_HOST}/jwglxt/xsxk/zzxkyzb_cxZzxkYzbIndex.html?gnmkdm=N253512"
)
DISPLAY_ENDPOINT = (
    f"{JWXT_HOST}/jwglxt/xsxk/zzxkyzb_cxZzxkYzbDisplay.html?gnmkdm=N253512"
)
COURSE_LIST_ENDPOINT = (
    f"{JWXT_HOST}/jwglxt/xsxk/zzxkyzb_cxZzxkYzbPartDisplay.html?gnmkdm=N253512"
)
COURSE_DETAIL_ENDPOINT = (
    f"{JWXT_HOST}/jwglxt/xsxk/zzxkyzbjk_cxJxbWithKchZzxkYzb.html?gnmkdm=N253512"
)

SCRIPT_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_ROOT.parent
STATIC_OUTPUT_ROOT = PROJECT_ROOT / "app" / "static" / "crawler"
DEFAULT_OUTPUT_DIR = STATIC_OUTPUT_ROOT / "data"
DEFAULT_SECRETS_FILE = SCRIPT_ROOT / ".secrets.json"
DEFAULT_COOKIE_STORE_FILE = SCRIPT_ROOT / ".jwxt_cookie.enc.json"
DEFAULT_COOKIE_KEY_FILE = SCRIPT_ROOT / ".jwxt_cookie_rsa.pem"

RSA_PUBKEY = """-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDl/aCgRl9f/4ON9MewoVnV58OL
OU2ALBi2FKc5yIsfSpivKxe7A6FitJjHva3WpM7gvVOinMehp6if2UNIkbaN+plW
f5IwqEVxsNZpeixc4GsbY9dXEk3WtRjwGSyDLySzEESH/kpJVoxO7ijRYqU+2oSR
wTBNePOk1H+LRQokgQIDAQAB
-----END PUBLIC KEY-----"""

REQUEST_FIELD_KEYS = [
    "rwlx",
    "xklc",
    "xkly",
    "bklx_id",
    "sfkkjyxdxnxq",
    "kzkcgs",
    "xqh_id",
    "jg_id_1",
    "njdm_id_1",
    "zyh_id_1",
    "gnjkxdnj",
    "zyh_id",
    "zyfx_id",
    "njdm_id",
    "bh_id",
    "bjgkczxbbjwcx",
    "xbm",
    "xslbdm",
    "mzm",
    "xz",
    "ccdm",
    "xsbj",
    "sfkknj",
    "sfkkzy",
    "kzybkxy",
    "sfznkx",
    "zdkxms",
    "sfkxq",
    "sfkcfx",
    "kkbk",
    "kkbkdj",
    "bklbkcj",
    "sfkgbcx",
    "sfrxtgkcxd",
    "tykczgxdcs",
    "xkxnm",
    "xkxqm",
    "kklxdm",
    "bbhzxjxb",
    "xkkz_id",
    "rlkz",
    "xkzgbj",
    "xszxzt",
    "txbsfrl",
    "xkxskcgskg",
    "rlzlkz",
    "cdrlkz",
    "jxbzcxskg",
    "sfyxsksjct",
]

DEFAULT_FIELD_VALUES = {
    "rwlx": "1",
    "xklc": "1",
    "xkly": "1",
    "bklx_id": "0",
    "sfkkjyxdxnxq": "0",
    "kzkcgs": "0",
    "sfkknj": "1",
    "sfkkzy": "1",
    "kzybkxy": "0",
    "sfznkx": "0",
    "zdkxms": "0",
    "sfkxq": "1",
    "sfkcfx": "1",
    "kkbk": "0",
    "kkbkdj": "0",
    "bklbkcj": "0",
    "sfkgbcx": "1",
    "sfrxtgkcxd": "1",
    "tykczgxdcs": "0",
    "bbhzxjxb": "0",
    "rlkz": "0",
    "xkzgbj": "0",
    "xszxzt": "1",
    "sfyxsksjct": "0",
}


class ProgressTracker:
    BAR_LENGTH = 30

    def __init__(self, total_steps: int):
        self.total_steps = max(1, total_steps)
        self.completed = 0
        self.last_message = "准备开始"
        self._last_line_len = 0
        self._started = False

    def start(self, initial_message: str | None = None) -> None:
        if initial_message:
            self.last_message = initial_message
        if not self._started:
            self._started = True
            self._render()

    def log_step(self, message: str) -> None:
        self.start()
        self.completed = min(self.total_steps, self.completed + 1)
        self.last_message = message
        self._clear_line()
        print(f"[{self.completed}/{self.total_steps}] {message}")
        self._render()

    def log(self, message: str) -> None:
        self.start()
        self.last_message = message
        self._clear_line()
        print(message)
        self._render()

    def _render(self) -> None:
        ratio = self.completed / self.total_steps
        filled = int(self.BAR_LENGTH * ratio)
        bar = "█" * filled + "░" * (self.BAR_LENGTH - filled)
        line = f"进度 [{bar}] {self.completed}/{self.total_steps} - {self.last_message}"
        padding = max(self._last_line_len - len(line), 0)
        sys.stdout.write("\r" + line + " " * padding)
        sys.stdout.flush()
        self._last_line_len = len(line)
        if self.completed == self.total_steps:
            sys.stdout.write("\n")

    def _clear_line(self) -> None:
        if self._last_line_len:
            sys.stdout.write("\r" + " " * self._last_line_len + "\r")
            sys.stdout.flush()


def encrypt_password(password: str) -> str:
    key = rsa.PublicKey.load_pkcs1_openssl_pem(RSA_PUBKEY.encode())
    encrypted = rsa.encrypt(password.encode(), key)
    return base64.b64encode(encrypted).decode()


def _is_subpath(child: Path, parent: Path) -> bool:
    try:
        child.relative_to(parent)
        return True
    except ValueError:
        return False


def resolve_output_dir(output_dir: str | None) -> Path:
    target = (Path(output_dir) if output_dir else DEFAULT_OUTPUT_DIR).expanduser().resolve()
    allowed_roots = [SCRIPT_ROOT, STATIC_OUTPUT_ROOT]
    if not any(_is_subpath(target, root) for root in allowed_roots):
        raise ValueError(
            f"Output path {target} is outside allowed roots {', '.join(str(root) for root in allowed_roots)}"
        )
    target.mkdir(parents=True, exist_ok=True)
    return target


def resolve_local_file(path_value: str | None, default: Path) -> Path:
    target = (Path(path_value) if path_value else default).expanduser().resolve()
    if not _is_subpath(target, SCRIPT_ROOT):
        raise ValueError(f"Local file path {target} is outside allowed root {SCRIPT_ROOT}")
    target.parent.mkdir(parents=True, exist_ok=True)
    return target


def safe_unlink(path: Path) -> None:
    try:
        path.unlink()
    except FileNotFoundError:
        return


def _best_effort_chmod(path: Path, mode: int) -> None:
    try:
        os.chmod(path, mode)
    except Exception:
        return


class CookieRecord(TypedDict, total=False):
    name: str
    value: str
    domain: str
    path: str
    expires: int | None
    secure: bool
    rest: Dict[str, str]


class EncryptedCookieBundle(TypedDict, total=False):
    version: int
    algo: str
    createdAtMs: int
    updatedAtMs: int
    username: str
    cookies: List[CookieRecord]
    ciphertextChunks: List[str]


COOKIE_BUNDLE_VERSION = 1
COOKIE_BUNDLE_ALGO = "rsa-chunked-pkcs1v15"


def serialize_cookie_jar(jar: RequestsCookieJar) -> List[CookieRecord]:
    cookies: List[CookieRecord] = []
    for cookie in jar:
        record: CookieRecord = {
            "name": cookie.name,
            "value": cookie.value,
            "domain": cookie.domain,
            "path": cookie.path,
            "expires": cast(int | None, cookie.expires),
            "secure": bool(cookie.secure),
            "rest": cast(Dict[str, str], getattr(cookie, "_rest", {}) or {}),
        }
        cookies.append(record)
    return cookies


def apply_cookie_records(jar: RequestsCookieJar, cookies: List[CookieRecord]) -> None:
    jar.clear()
    for record in cookies:
        name = record.get("name") or ""
        value = record.get("value") or ""
        domain = record.get("domain") or ""
        path = record.get("path") or "/"
        if not name or not domain:
            continue
        jar.set_cookie(
            create_cookie(
                name=name,
                value=value,
                domain=domain,
                path=path,
                secure=bool(record.get("secure", False)),
                expires=record.get("expires"),
                rest=record.get("rest") or {},
            )
        )


def apply_cookie_header(jar: RequestsCookieJar, cookie_header: str, domain: str) -> None:
    jar.clear()
    raw = (cookie_header or "").strip()
    if not raw:
        return
    parts = [part.strip() for part in raw.split(";") if part.strip()]
    for part in parts:
        if "=" not in part:
            continue
        name, value = part.split("=", 1)
        name = name.strip()
        value = value.strip()
        if not name:
            continue
        jar.set_cookie(
            create_cookie(
                name=name,
                value=value,
                domain=domain,
                path="/",
                secure=True,
            )
        )


def load_or_create_cookie_key(private_key_path: Path) -> rsa.PrivateKey:
    if private_key_path.exists():
        raw = private_key_path.read_bytes()
        return rsa.PrivateKey.load_pkcs1(raw)
    pub, priv = rsa.newkeys(2048)
    private_key_path.write_bytes(priv.save_pkcs1())
    _best_effort_chmod(private_key_path, 0o600)
    return priv


def encrypt_chunks_with_rsa(pubkey: rsa.PublicKey, plaintext: bytes) -> List[str]:
    max_len = rsa.common.byte_size(pubkey.n) - 11
    chunks: List[str] = []
    for i in range(0, len(plaintext), max_len):
        block = plaintext[i : i + max_len]
        encrypted = rsa.encrypt(block, pubkey)
        chunks.append(base64.b64encode(encrypted).decode("utf-8"))
    return chunks


def decrypt_chunks_with_rsa(privkey: rsa.PrivateKey, chunks: List[str]) -> bytes:
    out = bytearray()
    for entry in chunks:
        encrypted = base64.b64decode(entry.encode("utf-8"))
        out.extend(rsa.decrypt(encrypted, privkey))
    return bytes(out)


def load_cookie_bundle(cookie_store_path: Path, cookie_key_path: Path) -> EncryptedCookieBundle | None:
    if not cookie_store_path.exists():
        return None
    if not cookie_key_path.exists():
        return None
    try:
        raw = cookie_store_path.read_text(encoding="utf-8")
        bundle = cast(EncryptedCookieBundle, json.loads(raw))
        if bundle.get("version") != COOKIE_BUNDLE_VERSION:
            return None
        if bundle.get("algo") != COOKIE_BUNDLE_ALGO:
            return None
        chunks = bundle.get("ciphertextChunks") or []
        if not isinstance(chunks, list) or not chunks:
            return None
        priv = load_or_create_cookie_key(cookie_key_path)
        decrypted = decrypt_chunks_with_rsa(priv, [str(x) for x in chunks])
        payload = json.loads(decrypted.decode("utf-8"))
        cookies = payload.get("cookies")
        if not isinstance(cookies, list):
            return None
        bundle["cookies"] = cast(List[CookieRecord], cookies)
        return bundle
    except Exception:
        return None


def save_cookie_bundle(
    cookie_store_path: Path, cookie_key_path: Path, username: str | None, jar: RequestsCookieJar
) -> None:
    priv = load_or_create_cookie_key(cookie_key_path)
    pub = rsa.PublicKey(priv.n, priv.e)
    now_ms = int(time.time() * 1000)
    payload = {
        "cookies": serialize_cookie_jar(jar),
        "savedAtMs": now_ms,
    }
    ciphertext_chunks = encrypt_chunks_with_rsa(pub, json.dumps(payload, ensure_ascii=False).encode("utf-8"))
    bundle: EncryptedCookieBundle = {
        "version": COOKIE_BUNDLE_VERSION,
        "algo": COOKIE_BUNDLE_ALGO,
        "createdAtMs": now_ms,
        "updatedAtMs": now_ms,
        "username": (username or "").strip(),
        "ciphertextChunks": ciphertext_chunks,
    }
    cookie_store_path.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    _best_effort_chmod(cookie_store_path, 0o600)


def load_local_secrets(path: Path) -> Tuple[str | None, str | None]:
    if not path.exists():
        return None, None
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
            return data.get("username"), data.get("password")
    except Exception:
        return None, None


def resolve_credentials(
    args: argparse.Namespace, secrets_path: Path = DEFAULT_SECRETS_FILE
) -> Tuple[str, str]:
    # CLI flags take precedence
    if args.username and (args.password or args.password_stdin):
        password = (
            input().rstrip("\n") if args.password_stdin else args.password or ""
        )
        if not password:
            raise RuntimeError("Password not provided")
        return args.username, password

    # Env fallback
    env_username = os.environ.get("JWXT_USERNAME")
    env_password = os.environ.get("JWXT_PASSWORD")
    if env_username and env_password:
        return env_username, env_password

    # Local secrets file fallback
    file_user, file_pass = load_local_secrets(secrets_path)
    if file_user and file_pass:
        return file_user, file_pass

    # Prompt as last resort
    username = args.username or getpass.getuser()
    password = getpass.getpass("Password: ")
    if not username or not password:
        raise RuntimeError("Missing username or password")
    return username, password


def resolve_credentials_no_prompt(
    args: argparse.Namespace, secrets_path: Path = DEFAULT_SECRETS_FILE
) -> Tuple[str | None, str | None]:
    if args.username and (args.password or args.password_stdin):
        password = (
            input().rstrip("\n") if args.password_stdin else args.password or ""
        )
        if not password:
            return args.username, None
        return args.username, password

    env_username = os.environ.get("JWXT_USERNAME")
    env_password = os.environ.get("JWXT_PASSWORD")
    if env_username and env_password:
        return env_username, env_password

    file_user, file_pass = load_local_secrets(secrets_path)
    if file_user and file_pass:
        return file_user, file_pass

    return None, None


def prompt_request_interval(default: float = 0.0) -> float:
    if not sys.stdin.isatty():
        return default
    try:
        raw = input("每次请求之间的等待时间（秒，默认 0，直接回车跳过）：").strip()
    except EOFError:
        return default
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        print("输入无效，将使用 0 秒间隔", file=sys.stderr)
        return default
    if value < 0:
        print("输入为负数，将使用 0 秒间隔", file=sys.stderr)
        return default
    return value


def download_cloud_snapshot(
    output_dir: Path,
    cloud_base_url: str,
    download_all_terms: bool = True,
    request_interval: float = 0.0,
) -> None:
    base = cloud_base_url.rstrip("/")
    progress = ProgressTracker(total_steps=3)
    progress.start("未登录：使用云端课程快照作为兜底数据源")

    session = requests.Session()
    session.verify = False
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        }
    )

    def sleep_if_needed() -> None:
        if request_interval > 0:
            time.sleep(request_interval)

    sleep_if_needed()
    current_url = f"{base}/current.json"
    res = session.get(current_url, timeout=30)
    if res.status_code != 200:
        raise RuntimeError(f"Failed to download cloud current.json ({res.status_code})")
    raw_current = res.json()
    term_ids: List[str] = []
    current_rows: List[Dict[str, object]] = []
    if isinstance(raw_current, list):
        for item in raw_current:
            if isinstance(item, str):
                value = item.strip()
                if value:
                    term_ids.append(value)
                    current_rows.append({"termId": value})
                continue
            if isinstance(item, dict):
                term_id = str(item.get("termId") or "").strip()
                if term_id:
                    term_ids.append(term_id)
                    current_rows.append(item)
                continue
    if not term_ids:
        raise RuntimeError("Cloud current.json is empty or has unsupported schema")
    progress.log_step(f"云端 current.json 获取成功：{len(term_ids)} 个学期")

    target_terms = term_ids if download_all_terms else [term_ids[-1]]
    os.makedirs(output_dir / "terms", exist_ok=True)
    for term_id in target_terms:
        sleep_if_needed()
        term_url = f"{base}/terms/{term_id}.json"
        term_res = session.get(term_url, timeout=60)
        if term_res.status_code != 200:
            raise RuntimeError(f"Failed to download cloud term {term_id} ({term_res.status_code})")
        (output_dir / "terms" / f"{term_id}.json").write_bytes(term_res.content)
    with open(output_dir / "current.json", "w", encoding="utf-8") as fh:
        json.dump(current_rows, fh, ensure_ascii=False, indent=2)
    progress.log_step(f"云端课程快照下载完成：{len(target_terms)} 个学期")

    progress.log_step("提示：登录抓取一次可自动保存加密 cookie，后续免密刷新")


class JWXTCrawler:
    def __init__(
        self,
        username: str,
        password: str,
        workers: int = 8,
        request_interval: float = 0.0,
    ):
        self.username = username
        self.password = password
        self.workers = workers
        self.request_interval = max(0.0, request_interval)
        self.session = requests.Session()
        self.session.verify = False
        self.session.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            }
        )
        self._thread_local = threading.local()
        self._rate_lock = threading.Lock()
        self._last_request_at = 0.0

    def _sleep_if_needed(self) -> None:
        if self.request_interval <= 0:
            return
        with self._rate_lock:
            now = time.time()
            wait = self._last_request_at + self.request_interval - now
            if wait > 0:
                time.sleep(wait)
            self._last_request_at = time.time()

    def login(self) -> None:
        self._sleep_if_needed()
        resp = self.session.get(f"{JWXT_HOST}/sso/shulogin", allow_redirects=False)
        if resp.status_code not in (301, 302):
            raise RuntimeError(f"Unexpected SSO entry status {resp.status_code}")
        url = urljoin(resp.url, resp.headers.get("Location", ""))

        self._sleep_if_needed()
        resp = self.session.get(url, allow_redirects=False)
        if resp.status_code not in (301, 302):
            raise RuntimeError("Failed to reach SHU SSO login page")
        login_url = urljoin(url, resp.headers.get("Location", ""))

        # Load login page to obtain required cookies
        self._sleep_if_needed()
        login_page = self.session.get(login_url, timeout=15)
        post_url = login_url
        try:
            soup = BeautifulSoup(login_page.text, "html.parser")
            form = soup.find("form")
            if form is not None and form.get("action"):
                post_url = urljoin(login_url, str(form.get("action")))
        except Exception:
            post_url = login_url

        payload = {
            "username": self.username,
            "password": encrypt_password(self.password),
        }
        self._sleep_if_needed()
        resp = self.session.post(
            post_url,
            data=payload,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": "https://newsso.shu.edu.cn",
                "Referer": login_url,
            },
            allow_redirects=True,
            timeout=15,
        )

        # Some SSO flows may end on a POST-only endpoint (GET => 405) while the session
        # is already established. Avoid failing early and let the downstream JWXT page
        # load be the source of truth.
        if resp.status_code >= 500:
            raise RuntimeError(f"Login failed, last status {resp.status_code}")

        self.warmup()

    def warmup(self) -> None:
        self._sleep_if_needed()
        self.session.get(
            f"{JWXT_HOST}/jwglxt/xtgl/index_initMenu.html?"
            f"jsdm=xs&_t={int(time.time()*1000)}",
            timeout=15,
        )

    def fetch_selection_page(self) -> Tuple[str, Dict[str, str]]:
        self._sleep_if_needed()
        resp = self.session.get(SELECTION_ENDPOINT, timeout=15)
        if resp.status_code != 200:
            raise RuntimeError(
                f"Failed to load selection page ({resp.status_code})"
            )
        soup = BeautifulSoup(resp.text, "html.parser")
        fields: Dict[str, str] = {}
        for tag in soup.find_all("input"):
            tag_id = tag.get("id")
            if tag_id:
                fields[tag_id] = tag.get("value") or ""
        if not fields.get("firstXkkzId"):
            raise RuntimeError("Cannot find xkkz information on selection page")
        return resp.text, fields

    def parse_round_tabs(self, html: str) -> List[Dict[str, str]]:
        tabs: List[Dict[str, str]] = []
        re_tab = re.compile(
            r"<li\b([^>]*)>\s*<a\b[^>]*onclick=\"queryCourse\(this,'([^']+)','([^']+)','([^']+)','([^']+)'\)\"[^>]*>([^<]*)</a>",
            flags=re.IGNORECASE,
        )
        for match in re_tab.finditer(html):
            li_attrs = match.group(1) or ""
            kklxdm = match.group(2) or ""
            xkkz_id = match.group(3) or ""
            njdm_id = match.group(4) or ""
            zyh_id = match.group(5) or ""
            label = (match.group(6) or "").strip()
            if not kklxdm or not xkkz_id:
                continue
            tabs.append(
                {
                    "kklxdm": kklxdm,
                    "xkkz_id": xkkz_id,
                    "njdm_id": njdm_id,
                    "zyh_id": zyh_id,
                    "label": label,
                    "active": "1" if re.search(r"\bactive\b", li_attrs, flags=re.IGNORECASE) else "0",
                }
            )
        if tabs:
            return tabs

        soup = BeautifulSoup(html, "html.parser")
        for anchor in soup.select("#nav_tab a[onclick]"):
            onclick = (anchor.get("onclick") or "").strip()
            match = re.search(
                r"queryCourse\(this,'([^']+)','([^']+)','([^']+)','([^']+)'\)",
                onclick,
            )
            if not match:
                continue
            parent = anchor.parent
            is_active = False
            if parent is not None:
                classes = parent.get("class") or []
                is_active = any(str(c).lower() == "active" for c in classes)
            tabs.append(
                {
                    "kklxdm": match.group(1),
                    "xkkz_id": match.group(2),
                    "njdm_id": match.group(3),
                    "zyh_id": match.group(4),
                    "label": (anchor.get_text() or "").strip(),
                    "active": "1" if is_active else "0",
                }
            )
        return tabs

    def fetch_display_fields(
        self,
        *,
        xkkz_id: str,
        kklxdm: str,
        njdm_id: str,
        zyh_id: str,
        xszxzt: str,
    ) -> Dict[str, str]:
        payload = {
            "xkkz_id": xkkz_id,
            "xszxzt": xszxzt or "1",
            "kklxdm": kklxdm,
            "njdm_id": njdm_id,
            "zyh_id": zyh_id,
            "kspage": "0",
            "jspage": "0",
        }
        self._sleep_if_needed()
        resp = self.session.post(
            DISPLAY_ENDPOINT,
            data=payload,
            headers={
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Referer": SELECTION_ENDPOINT,
            },
            timeout=30,
        )
        if resp.status_code != 200:
            raise RuntimeError(
                f"Display page request failed ({resp.status_code}): "
                f"{resp.text[:200]}"
            )
        soup = BeautifulSoup(resp.text, "html.parser")
        fields: Dict[str, str] = {}
        for tag in soup.find_all("input"):
            tag_id = tag.get("id")
            if tag_id:
                fields[tag_id] = tag.get("value") or ""
        return fields

    def build_query_context(self, fields: Dict[str, str]) -> Dict[str, str]:
        params = dict(DEFAULT_FIELD_VALUES)
        for key in REQUEST_FIELD_KEYS:
            if key in fields and fields[key] != "":
                params[key] = fields[key]

        params["xkkz_id"] = (
            fields.get("firstXkkzId") or params.get("xkkz_id") or ""
        )
        params["kklxdm"] = (
            fields.get("firstKklxdm") or params.get("kklxdm") or ""
        )
        params["njdm_id"] = (
            fields.get("firstNjdmId") or params.get("njdm_id") or ""
        )
        params["zyh_id"] = (
            fields.get("firstZyhId") or params.get("zyh_id") or ""
        )
        if not params["xkkz_id"]:
            raise RuntimeError("Missing xkkz_id, cannot query courses")
        return params

    def fetch_course_rows(self, params: Dict[str, str]) -> List[Dict]:
        payload = dict(params)
        payload.update({"kspage": "1", "jspage": "9999"})
        self._sleep_if_needed()
        resp = self.session.post(
            COURSE_LIST_ENDPOINT,
            data=payload,
            headers={
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Referer": SELECTION_ENDPOINT,
            },
            timeout=30,
        )
        if resp.status_code != 200:
            raise RuntimeError(
                f"Course list request failed ({resp.status_code}): "
                f"{resp.text[:200]}"
            )
        data = resp.json()
        rows = data.get("tmpList") or data.get("rows") or []
        return rows

    def fetch_course_details(
        self,
        params: Dict[str, str],
        meta: Dict[str, Dict],
        progress_callback: Callable[[int, int], None] | None = None,
    ) -> List[Dict]:
        results: List[Dict] = []
        failures: List[str] = []
        total_items = len(meta)
        completed = 0
        detail_base = dict(params)
        detail_base.pop("kspage", None)
        detail_base.pop("jspage", None)

        def worker(item: Tuple[str, Dict]) -> List[Dict]:
            kch_id, info = item
            payload = dict(detail_base)
            payload.update(
                {
                    "kch_id": kch_id,
                    "cxbj": info.get("cxbj", "0"),
                    "fxbj": info.get("fxbj", "0"),
                }
            )
            max_attempts = 4
            last_error: Exception | None = None
            detail_rows: object | None = None
            for attempt in range(1, max_attempts + 1):
                session = self._thread_session()
                self._sleep_if_needed()
                try:
                    resp = session.post(
                        COURSE_DETAIL_ENDPOINT,
                        data=payload,
                        headers={
                            "X-Requested-With": "XMLHttpRequest",
                            "Content-Type": (
                                "application/x-www-form-urlencoded; charset=UTF-8"
                            ),
                            "Referer": SELECTION_ENDPOINT,
                        },
                        timeout=30,
                    )
                    if resp.status_code == 200:
                        detail_rows = resp.json()
                        break

                    # JWXT occasionally returns non-standard status codes (e.g. 901) when
                    # throttled or the session is unstable. Retry with backoff.
                    if resp.status_code in (429, 500, 502, 503, 504, 901):
                        last_error = RuntimeError(
                            f"Detail request for {kch_id} failed ({resp.status_code})"
                        )
                    else:
                        raise RuntimeError(
                            f"Detail request for {kch_id} failed "
                            f"({resp.status_code}): {resp.text[:200]}"
                        )
                except Exception as exc:
                    last_error = exc

                # Refresh thread session cookies from the main session before retrying.
                try:
                    with self._rate_lock:
                        fresh = self.session.cookies.get_dict()
                    session.cookies.clear()
                    session.cookies.update(fresh)
                except Exception:
                    pass

                time.sleep(0.6 * attempt)
            else:
                assert last_error is not None
                raise last_error

            if detail_rows is None:
                raise RuntimeError(f"Detail request for {kch_id} failed (empty response)")
            if isinstance(detail_rows, dict):
                detail_rows = (
                    detail_rows.get("tmpList")
                    or detail_rows.get("rows")
                    or []
                )
            return [self._merge_course(row, info, params) for row in detail_rows]

        with concurrent.futures.ThreadPoolExecutor(
            max_workers=self.workers
        ) as executor:
            futures = [
                executor.submit(worker, item) for item in meta.items()
            ]
            for fut in concurrent.futures.as_completed(futures):
                try:
                    results.extend(fut.result())
                except Exception as exc:
                    failures.append(str(exc))
                completed += 1
                if progress_callback:
                    progress_callback(completed, total_items)
        if failures:
            unique = list(dict.fromkeys(failures))
            print(
                f"Warning: {len(failures)} detail requests failed "
                f"({min(5, len(unique))} unique shown):",
                file=sys.stderr,
            )
            for msg in unique[:5]:
                print(f"  - {msg}", file=sys.stderr)
        return results

    def _thread_session(self) -> requests.Session:
        sess = getattr(self._thread_local, "session", None)
        if sess is None:
            sess = requests.Session()
            sess.verify = False
            sess.headers.update(self.session.headers)
            sess.cookies.update(self.session.cookies.get_dict())
            self._thread_local.session = sess
        return sess

    def _merge_course(
        self, detail: Dict, base_info: Dict, params: Dict[str, str]
    ) -> Dict[str, str]:
        teacher_id, teacher_name, teacher_title = self._parse_teacher(
            detail.get("jsxx", "")
        )
        limitations = self._build_limitations(detail, base_info)
        academy = self._extract_academy(detail, base_info)
        major = self._extract_major(detail, base_info)
        teaching_mode = self._extract_teaching_mode(detail, base_info)
        language_mode = self._extract_language_mode(detail, base_info)
        selection_note = self._extract_selection_note(detail, base_info)
        class_status = self._extract_class_status(detail, base_info)

        return {
            "courseId": base_info.get("courseId", ""),
            "courseName": base_info.get("courseName", ""),
            "credit": str(base_info.get("credit", "")),
            "teacherId": teacher_id,
            "teacherName": teacher_name,
            "teacherTitle": teacher_title,
            "classTime": self._normalize_text(detail.get("sksj", "")),
            "campus": detail.get("xqumc") or detail.get("yqmc") or "",
            "position": self._normalize_text(detail.get("jxdd", "")),
            "capacity": str(detail.get("jxbrl", "")),
            "number": str(detail.get("yxzrs", "")),
            "limitations": limitations,
            "teachingClassId": detail.get("jxb_id", ""),
            "batchId": params.get("xkkz_id", ""),
            "academy": academy,
            "major": major,
            "teachingMode": teaching_mode,
            "languageMode": language_mode,
            "selectionNote": selection_note,
            "classStatus": class_status,
        }

    @staticmethod
    def _parse_teacher(text: str) -> Tuple[str, str, str]:
        segments = [seg.strip() for seg in text.split("/") if seg.strip()]
        teacher_id = segments[0] if segments else ""
        teacher_name = segments[1] if len(segments) > 1 else ""
        teacher_title = segments[2] if len(segments) > 2 else ""
        return teacher_id, teacher_name, teacher_title

    @staticmethod
    def _normalize_text(raw: str) -> str:
        return (raw or "").replace("<br/>", "; ").replace("<br>", "; ").strip()

    @staticmethod
    def _build_limitations(detail: Dict, base_info: Dict) -> List[str]:
        notes: List[str] = []
        if base_info.get("cxbj") == "1":
            notes.append("仅限重修")
        if base_info.get("fxbj") == "1":
            notes.append("辅修班")
        if detail.get("dsfrl") == "1":
            notes.append("容量锁定")
        try:
            cap = int(detail.get("jxbrl", 0))
            num = int(detail.get("yxzrs", 0))
            if cap and num >= cap:
                notes.append("人数已满")
        except (TypeError, ValueError):
            pass
        return notes

    @staticmethod
    def _extract_academy(detail: Dict, base_info: Dict) -> str:
        candidates = [
            detail.get("kkxy"),
            detail.get("kkxy_name"),
            detail.get("kkxy_mc"),
            detail.get("kkxymc"),
            detail.get("kkxyid"),
            detail.get("kkxyId"),
            detail.get("dwmc"),
            detail.get("kkdwmc"),
            base_info.get("kkxy"),
            base_info.get("kkxy_name"),
            base_info.get("kkxymc"),
            base_info.get("dwmc"),
        ]
        for value in candidates:
            if value is None:
                continue
            text = str(value).strip()
            if text:
                return text
        return ""

    @staticmethod
    def _extract_major(detail: Dict, base_info: Dict) -> str:
        candidates = [
            detail.get("zyfxmc"),
            detail.get("zymc"),
            detail.get("zyhmc"),
            detail.get("zyfxname"),
            base_info.get("zyfxmc"),
            base_info.get("zymc"),
            base_info.get("zyhmc"),
            base_info.get("zyfxname"),
        ]
        for value in candidates:
            if value is None:
                continue
            text = str(value).strip()
            if text:
                return text
        return ""

    @staticmethod
    def _extract_teaching_mode(detail: Dict, base_info: Dict) -> str:
        candidates = [
            detail.get("jxms"),
            detail.get("jxmsmc"),
            detail.get("skfs"),
            detail.get("skfsmc"),
            detail.get("jxms_name"),
            base_info.get("jxms"),
            base_info.get("jxmsmc"),
            base_info.get("skfs"),
            base_info.get("skfsmc"),
        ]
        for value in candidates:
            if value is None:
                continue
            text = str(value).strip()
            if text:
                return text
        return ""

    @staticmethod
    def _extract_language_mode(detail: Dict, base_info: Dict) -> str:
        candidates = [
            detail.get("yylx"),
            detail.get("yylxmc"),
            detail.get("yyxz"),
            detail.get("yyxzmc"),
            detail.get("yyms"),
            detail.get("yymsmc"),
            base_info.get("yylx"),
            base_info.get("yylxmc"),
            base_info.get("yyxz"),
            base_info.get("yyxzmc"),
            base_info.get("yyms"),
            base_info.get("yymsmc"),
        ]
        for value in candidates:
            if value is None:
                continue
            text = str(value).strip()
            if text:
                return text
        return ""

    @staticmethod
    def _extract_selection_note(detail: Dict, base_info: Dict) -> str:
        candidates = [
            detail.get("xkbz"),
            detail.get("xklybz"),
            detail.get("bz"),
            detail.get("kcbz"),
            detail.get("bzxx"),
            base_info.get("xkbz"),
            base_info.get("xklybz"),
            base_info.get("bz"),
            base_info.get("kcbz"),
            base_info.get("bzxx"),
        ]
        for value in candidates:
            if value is None:
                continue
            text = str(value).strip()
            if text and text != "--":
                return text
        return ""

    @staticmethod
    def _extract_class_status(detail: Dict, base_info: Dict) -> str:
        candidates = [
            detail.get("jxbzt"),
            detail.get("krlx"),
            detail.get("zt"),
            detail.get("status"),
            base_info.get("jxbzt"),
            base_info.get("krlx"),
            base_info.get("zt"),
            base_info.get("status"),
        ]
        for value in candidates:
            if value is None:
                continue
            text = str(value).strip()
            if text and "停" in text:
                return text
        return ""

    @staticmethod
    def _parse_select_options(
        soup: BeautifulSoup, select_id: str
    ) -> List[Dict[str, str]]:
        select = soup.find("select", attrs={"id": select_id}) or soup.find(
            "select", attrs={"name": select_id}
        )
        if select is None:
            return []
        options: List[Dict[str, str]] = []
        for opt in select.find_all("option"):
            value = (opt.get("value") or "").strip()
            label = (opt.get_text() or "").strip()
            if not value and not label:
                continue
            options.append(
                {
                    "value": value,
                    "label": label,
                    "selected": "1" if opt.has_attr("selected") else "0",
                }
            )
        return options

    @classmethod
    def _get_select_value(cls, soup: BeautifulSoup, select_id: str) -> str:
        options = cls._parse_select_options(soup, select_id)
        selected = next((opt for opt in options if opt.get("selected") == "1"), None)
        if selected is not None:
            return (selected.get("value") or "").strip()
        return (options[0].get("value") or "").strip() if options else ""


def crawl(
    output_dir: Path,
    username: str | None,
    password: str | None,
    cookie_header: str | None = None,
    cookie_store_path: Path | None = None,
    cookie_key_path: Path | None = None,
    cookie_username_hint: str | None = None,
    max_courses: int | None = None,
    request_interval: float = 0.0,
    xkkz_id: str | None = None,
    xklc: str | None = None,
    campus_scope: str = "all",
    no_prompt: bool = False,
) -> None:
    has_cookie_store = bool(cookie_store_path and cookie_key_path)
    progress = ProgressTracker(total_steps=9 if has_cookie_store else 8)
    progress.start("准备连接教务系统")
    progress.log(f"本次请求间隔：{request_interval:.2f} 秒")

    crawler = JWXTCrawler(
        (username or ""),
        (password or ""),
        request_interval=request_interval,
    )
    fields: Dict[str, str] | None = None
    selection_html: str | None = None

    if cookie_header:
        apply_cookie_header(
            crawler.session.cookies, cookie_header, domain="jwxt.shu.edu.cn"
        )
        try:
            crawler.warmup()
            selection_html, fields = crawler.fetch_selection_page()
            progress.log_step("已使用 Cookie header（无需重新登录）")
        except Exception:
            fields = None

    if cookie_store_path and cookie_key_path:
        bundle = load_cookie_bundle(cookie_store_path, cookie_key_path)
        if bundle and bundle.get("cookies"):
            apply_cookie_records(crawler.session.cookies, cast(List[CookieRecord], bundle["cookies"]))
            try:
                crawler.warmup()
                selection_html, fields = crawler.fetch_selection_page()
                progress.log_step("已复用本地 cookie（无需重新登录）")
            except Exception:
                fields = None

    if fields is None:
        if not username or not password:
            raise RuntimeError("无法使用 Cookie 登录且未提供账号密码（请重新登录或提供账号密码）")
        crawler.login()
        progress.log_step("登录成功")
        selection_html, fields = crawler.fetch_selection_page()

    if selection_html is None:
        raise RuntimeError("Selection page HTML missing")

    tabs = crawler.parse_round_tabs(selection_html)
    selected_tab: Dict[str, str] | None = None
    desired_xkkz = (xkkz_id or "").strip()
    desired_xklc = (xklc or "").strip()

    if desired_xkkz:
        selected_tab = next((tab for tab in tabs if tab.get("xkkz_id") == desired_xkkz), None)
        if selected_tab is None:
            if tabs:
                raise RuntimeError("指定的 xkkz_id 未在选课页面 Tab 中找到")
            selected_tab = {
                "kklxdm": fields.get("firstKklxdm", "") or fields.get("kklxdm", ""),
                "xkkz_id": desired_xkkz,
                "njdm_id": fields.get("njdm_id", "") or fields.get("firstNjdmId", ""),
                "zyh_id": fields.get("zyh_id", "") or fields.get("firstZyhId", ""),
                "label": "",
                "active": "0",
            }

    def enrich_tab(tab: Dict[str, str]) -> Dict[str, str]:
        display_fields = crawler.fetch_display_fields(
            xkkz_id=tab.get("xkkz_id", ""),
            kklxdm=tab.get("kklxdm", ""),
            njdm_id=tab.get("njdm_id", ""),
            zyh_id=tab.get("zyh_id", ""),
            xszxzt=fields.get("xszxzt", "1") if fields else "1",
        )
        out = dict(tab)
        if display_fields.get("xklc") is not None:
            out["xklc"] = display_fields.get("xklc", "")
        if display_fields.get("xklcmc") is not None:
            out["xklcmc"] = display_fields.get("xklcmc", "")
        return out

    if not desired_xkkz and not desired_xklc:
        first_xkkz = (fields.get("firstXkkzId") or "").strip()
        if first_xkkz:
            try:
                first_display = crawler.fetch_display_fields(
                    xkkz_id=first_xkkz,
                    kklxdm=fields.get("firstKklxdm", "") or fields.get("kklxdm", ""),
                    njdm_id=fields.get("firstNjdmId", "") or fields.get("njdm_id", ""),
                    zyh_id=fields.get("firstZyhId", "") or fields.get("zyh_id", ""),
                    xszxzt=fields.get("xszxzt", "1"),
                )
                fields.update(first_display)
                if fields.get("xklcmc"):
                    progress.log_step(f"选课轮次：{fields.get('xklcmc')}")
            except Exception:
                pass

    if selected_tab is None and desired_xklc:
        enriched_tabs: List[Dict[str, str]] = []
        match_by_xklc: Dict[str, str] | None = None
        for tab in tabs:
            enriched = enrich_tab(tab)
            enriched_tabs.append(enriched)
            if enriched.get("xklc") == desired_xklc:
                match_by_xklc = enriched
        if match_by_xklc is None:
            raise RuntimeError("指定的 xklc 未在选课轮次列表中找到")
        tabs = enriched_tabs
        selected_tab = match_by_xklc

    if selected_tab is None and tabs:
        active_id = (fields.get("firstXkkzId") or "").strip() if fields else ""
        selected_tab = next((tab for tab in tabs if tab.get("xkkz_id") == active_id), None)
        if selected_tab is None:
            selected_tab = next((tab for tab in tabs if tab.get("active") == "1"), None) or tabs[0]

    if selected_tab is not None:
        if (
            not desired_xkkz
            and not desired_xklc
            and len(tabs) > 1
            and sys.stdin.isatty()
            and not no_prompt
        ):
            progress.log("检测到多个选课轮次 Tab，准备读取轮次信息...")
            enriched_tabs = [enrich_tab(tab) for tab in tabs]
            tabs = enriched_tabs
            print("请选择选课轮次：")
            for idx, tab in enumerate(tabs, start=1):
                xklcmc = (tab.get("xklcmc") or tab.get("xklc") or "").strip()
                label = (tab.get("label") or "").strip()
                suffix = (tab.get("xkkz_id") or "")[-6:]
                active_mark = "（当前）" if tab.get("active") == "1" else ""
                print(f"  {idx}. {xklcmc} {label}  xkkz_id=…{suffix}{active_mark}".strip())
            try:
                raw = input("输入序号（直接回车默认当前）：").strip()
            except EOFError:
                raw = ""
            if raw:
                try:
                    pick = int(raw)
                    if 1 <= pick <= len(tabs):
                        selected_tab = tabs[pick - 1]
                except ValueError:
                    pass

        campus_options: List[Dict[str, str]] = []
        try:
            crawler._sleep_if_needed()
            resp = crawler.session.post(
                DISPLAY_ENDPOINT,
                data={
                    "xkkz_id": selected_tab.get("xkkz_id", ""),
                    "xszxzt": fields.get("xszxzt", "1") or "1",
                    "kklxdm": selected_tab.get("kklxdm", ""),
                    "njdm_id": selected_tab.get("njdm_id", ""),
                    "zyh_id": selected_tab.get("zyh_id", ""),
                    "kspage": "0",
                    "jspage": "0",
                },
                headers={
                    "X-Requested-With": "XMLHttpRequest",
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "Referer": SELECTION_ENDPOINT,
                },
                timeout=30,
            )
            if resp.status_code != 200:
                raise RuntimeError(
                    f"Display page request failed ({resp.status_code}): "
                    f"{resp.text[:200]}"
                )
            soup = BeautifulSoup(resp.text, "html.parser")
            display_fields: Dict[str, str] = {}
            for tag in soup.find_all("input"):
                tag_id = tag.get("id")
                if tag_id:
                    display_fields[tag_id] = tag.get("value") or ""
            # Campus selection is usually a <select id="xqh_id">. Store the selected value
            # so build_query_context picks it up, and also expose all options for multi-campus crawl.
            selected_campus_id = crawler._get_select_value(soup, "xqh_id")
            if selected_campus_id:
                display_fields["xqh_id"] = selected_campus_id
            campus_options = crawler._parse_select_options(soup, "xqh_id")
            fields.update(display_fields)
        except Exception:
            if desired_xkkz or desired_xklc:
                raise
        fields["firstXkkzId"] = selected_tab.get("xkkz_id", fields.get("firstXkkzId", ""))
        fields["firstKklxdm"] = selected_tab.get("kklxdm", fields.get("firstKklxdm", ""))
        fields["firstNjdmId"] = selected_tab.get("njdm_id", fields.get("firstNjdmId", ""))
        fields["firstZyhId"] = selected_tab.get("zyh_id", fields.get("firstZyhId", ""))
        if selected_tab.get("label"):
            fields["firstKklxmc"] = selected_tab.get("label", fields.get("firstKklxmc", ""))
        if fields.get("xklcmc"):
            progress.log_step(f"选课轮次：{fields.get('xklcmc')}")

    params = crawler.build_query_context(fields)
    progress.log_step("选课页面加载完毕")

    requested_scope = (campus_scope or "all").strip() or "all"
    resolved_campuses: List[Dict[str, str]] = []
    if not campus_options:
        resolved_campuses = [{"value": params.get("xqh_id", ""), "label": "", "selected": "1"}]
    elif requested_scope.lower() == "current":
        current_id = params.get("xqh_id", "")
        match = next((opt for opt in campus_options if opt.get("value") == current_id), None)
        resolved_campuses = [match] if match else [{"value": current_id, "label": "", "selected": "1"}]
    elif requested_scope.lower() == "all":
        resolved_campuses = [opt for opt in campus_options if (opt.get("value") or "").strip()]
    else:
        needle = requested_scope
        resolved_campuses = [
            opt
            for opt in campus_options
            if needle in (opt.get("label") or "") or needle == (opt.get("value") or "")
        ]
        if not resolved_campuses:
            available = ", ".join(
                f"{opt.get('label') or opt.get('value')}" for opt in campus_options if opt.get("label") or opt.get("value")
            )
            raise RuntimeError(f"未找到匹配校区：{needle}（可选：{available}）")

    if resolved_campuses and resolved_campuses[0].get("label"):
        labels = " / ".join(opt.get("label") or opt.get("value") or "" for opt in resolved_campuses)
        progress.log(f"校区抓取范围：{requested_scope}（{labels}）")

    merged_courses: List[Dict[str, str]] = []
    merged_keys: set[tuple[str, str, str]] = set()

    def detail_progress(current: int, total: int) -> None:
        if total <= 0:
            return
        if current % 300 == 0 or current == total:
            progress.log(f"课程详情抓取成功：({current}/{total})")

    campus_count = len(resolved_campuses) if resolved_campuses else 0
    for idx, campus in enumerate(resolved_campuses or [{"value": "", "label": "", "selected": "1"}], start=1):
        campus_id = (campus.get("value") or "").strip()
        campus_label = (campus.get("label") or campus_id or "").strip()
        if campus_label:
            progress.log(f"开始抓取校区 {idx}/{campus_count}：{campus_label}")

        campus_params = dict(params)
        if campus_id:
            campus_params["xqh_id"] = campus_id

        course_rows = crawler.fetch_course_rows(campus_params)
        if not course_rows:
            if campus_label:
                progress.log(f"校区 {campus_label} 课程列表为空，跳过")
            continue

        meta: Dict[str, Dict] = {}
        for row in course_rows:
            kch = row.get("kch_id") or row.get("kch")
            if not kch:
                continue
            meta.setdefault(
                kch,
                {
                    "courseId": row.get("kch", kch),
                    "courseName": row.get("kcmc", ""),
                    "credit": row.get("xf", ""),
                    "cxbj": row.get("cxbj", "0"),
                    "fxbj": row.get("fxbj", "0"),
                },
            )

        if max_courses is not None:
            limited_keys = list(meta.keys())[:max_courses]
            meta = {key: meta[key] for key in limited_keys}

        if campus_label:
            progress.log_step(f"校区 {campus_label} 课程列表获取完成，共 {len(meta)} 门课程")
        else:
            progress.log_step(f"课程列表获取完成，共 {len(meta)} 门课程")

        courses = crawler.fetch_course_details(
            campus_params,
            meta,
            progress_callback=detail_progress,
        )
        for row in courses:
            key = (
                str(row.get("courseId") or ""),
                str(row.get("teachingClassId") or ""),
                str(row.get("batchId") or ""),
            )
            if key in merged_keys:
                continue
            merged_keys.add(key)
            merged_courses.append(row)

    if not merged_courses:
        raise RuntimeError("课程列表为空，可能尚未到选课时间")

    merged_courses.sort(key=lambda x: (x["courseId"], x["teachingClassId"]))
    progress.log_step(f"课程详情抓取完成，共 {len(merged_courses)} 个教学班")

    term_code = f"{fields.get('xkxnm', '').strip()}-{fields.get('xkxqm', '').strip()}"
    term_name = (
        f"{fields.get('xkxnmc', fields.get('xkxnm', '')).strip()} "
        f"{fields.get('xkxqmc', fields.get('xkxqm', '')).strip()}".strip()
    ).strip()

    round_id = (params.get("xkkz_id") or "").strip()
    round_term_code = term_code
    if round_id:
        round_term_code = f"{term_code}--xkkz-{round_id}"

    os.makedirs(output_dir / "terms", exist_ok=True)
    result = {
        "backendOrigin": JWXT_HOST,
        "termName": term_name or term_code,
        "termId": round_term_code,
        "jwxtRound": {
            "xkkzId": params.get("xkkz_id", ""),
            "xklc": fields.get("xklc", ""),
            "xklcmc": fields.get("xklcmc", ""),
        },
        "campusOptions": campus_options,
        "updateTimeMs": int(time.time() * 1000),
        "hash": hashlib.md5(
            json.dumps(merged_courses, sort_keys=True, ensure_ascii=False).encode()
        ).hexdigest(),
        "courses": merged_courses,
    }
    term_path = output_dir / "terms" / f"{round_term_code}.json"
    with open(term_path, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2)
    progress.log_step(f"学期 {round_term_code} 数据写入完成")

    current_path = output_dir / "current.json"
    generated_at = int(time.time() * 1000)
    current_entry = {
        "termId": round_term_code,
        "termCode": term_code,
        "jwxtRound": {
            "xkkzId": round_id,
            "xklc": (fields.get("xklc") or "").strip(),
            "xklcmc": (fields.get("xklcmc") or "").strip(),
        },
        "generatedAt": generated_at,
    }

    existing_entries: list[dict] = []
    if current_path.exists():
        try:
            raw = json.loads(current_path.read_text(encoding="utf-8"))
            if isinstance(raw, list):
                if raw and isinstance(raw[0], str):
                    # Legacy schema: string[] of termId
                    existing_entries = [{"termId": str(x).strip()} for x in raw if str(x).strip()]
                else:
                    existing_entries = [x for x in raw if isinstance(x, dict)]
        except Exception:
            existing_entries = []

    def entry_key(obj: dict) -> tuple[str, str]:
        term_id = str(obj.get("termId") or "").strip()
        xklc = str((obj.get("jwxtRound") or {}).get("xklc") or "").strip()
        return (term_id, xklc)

    merged_entries: list[dict] = []
    seen = set()
    for item in existing_entries:
        key = entry_key(item)
        if key in seen:
            continue
        if key[0] == round_term_code and key[1] == str(current_entry["jwxtRound"]["xklc"]):
            continue
        seen.add(key)
        merged_entries.append(item)
    merged_entries.append(current_entry)

    def sort_key(obj: dict) -> tuple[int, int]:
        try:
            xklc_num = int(str((obj.get("jwxtRound") or {}).get("xklc") or "0").strip() or "0")
        except Exception:
            xklc_num = 0
        gen = obj.get("generatedAt")
        gen_num = int(gen) if isinstance(gen, (int, float)) else 0
        return (xklc_num, gen_num)

    merged_entries.sort(key=sort_key)

    with open(current_path, "w", encoding="utf-8") as fh:
        json.dump(merged_entries, fh, ensure_ascii=False, indent=2)
    progress.log_step(
        f"current.json 已更新：{len(merged_entries)} 条轮次记录；当前轮次教学班 {len(merged_courses)} 个"
    )

    if has_cookie_store and cookie_store_path and cookie_key_path:
        save_cookie_bundle(
            cookie_store_path,
            cookie_key_path,
            cookie_username_hint or username or "",
            crawler.session.cookies,
        )
        progress.log_step("本地 cookie 已加密保存（下次可免密刷新）")


def main() -> None:
    parser = argparse.ArgumentParser(description="JWXT course crawler")
    parser.add_argument("-u", "--username", help="学号（默认读取本地密钥或环境变量）")
    parser.add_argument("-p", "--password", help="密码")
    parser.add_argument(
        "--password-stdin",
        action="store_true",
        help="从标准输入读取密码",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="输出目录（默认 crawler/data）",
    )
    parser.add_argument(
        "--cookie-header",
        help="从已登录环境导出的 Cookie header（用于免密抓取，优先级高于本地 cookie 存储）",
    )
    parser.add_argument(
        "--secrets-file",
        default=str(DEFAULT_SECRETS_FILE),
        help="本地密钥文件（默认 crawler/.secrets.json）",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="仅抓取前 N 门课程（调试用）",
    )
    parser.add_argument(
        "--xkkz-id",
        help="指定 JWXT 选课批次 xkkz_id（用于选择选课轮次 Tab）",
    )
    parser.add_argument(
        "--xklc",
        help="指定 JWXT 选课轮次（例如 2）。若未指定且存在多个轮次，将在交互模式下提示选择。",
    )
    parser.add_argument(
        "--campus-scope",
        default="all",
        help=(
            "校区抓取范围：all(默认，抓取全部校区并合并) / current(仅当前校区) / "
            "<value|substring>(按 xqh_id 或 label 子串匹配)"
        ),
    )
    parser.add_argument(
        "--request-interval",
        type=float,
        help="相邻请求之间的等待秒数（默认 0）",
    )
    parser.add_argument(
        "--cloud-base-url",
        default=os.environ.get("JWXT_CLOUD_BASE_URL"),
        help="云端数据根路径（包含 current.json 与 terms/<termId>.json）",
    )
    parser.add_argument(
        "--cloud-download",
        choices=["auto", "always", "never"],
        default="auto",
        help="云端数据下载策略：auto(缺省兜底)/always(仅云端)/never(仅本地登录)",
    )
    parser.add_argument(
        "--cloud-all-terms",
        action="store_true",
        help="下载 current.json 中的全部学期（默认只下载最后一个）",
    )
    parser.add_argument(
        "--no-prompt",
        action="store_true",
        help="禁用交互式输入（凭据只从参数/环境变量/本地密钥文件读取）",
    )
    parser.add_argument(
        "--cookie-store",
        default=str(DEFAULT_COOKIE_STORE_FILE),
        help="本地加密 cookie 存储文件（默认 crawler/.jwxt_cookie.enc.json）",
    )
    parser.add_argument(
        "--cookie-key",
        default=str(DEFAULT_COOKIE_KEY_FILE),
        help="本地 cookie RSA 私钥（默认 crawler/.jwxt_cookie_rsa.pem）",
    )
    parser.add_argument(
        "--no-cookie-store",
        action="store_true",
        help="禁用本地 cookie 存储（每次都走登录）",
    )
    parser.add_argument(
        "--clear-cookie-store",
        action="store_true",
        help="清除本地 cookie 存储与密钥后退出",
    )
    args = parser.parse_args()

    output_dir = resolve_output_dir(args.output_dir)
    secrets_path = Path(args.secrets_file).expanduser().resolve()
    request_interval = args.request_interval
    if request_interval is None:
        request_interval = prompt_request_interval()
    request_interval = max(0.0, request_interval)

    cookie_store_path = None if args.no_cookie_store else resolve_local_file(args.cookie_store, DEFAULT_COOKIE_STORE_FILE)
    cookie_key_path = None if args.no_cookie_store else resolve_local_file(args.cookie_key, DEFAULT_COOKIE_KEY_FILE)
    if args.clear_cookie_store:
        if cookie_store_path:
            safe_unlink(cookie_store_path)
        if cookie_key_path:
            safe_unlink(cookie_key_path)
        print("已清除本地 cookie 存储与密钥")
        return

    requests.packages.urllib3.disable_warnings()  # type: ignore[attr-defined]
    if args.cloud_download == "always":
        if not args.cloud_base_url:
            raise RuntimeError("--cloud-download=always 需要提供 --cloud-base-url 或设置 JWXT_CLOUD_BASE_URL")
        download_cloud_snapshot(
            output_dir,
            args.cloud_base_url,
            download_all_terms=bool(args.cloud_all_terms),
            request_interval=request_interval,
        )
        return

    has_cookie_bundle = bool(
        cookie_store_path
        and cookie_key_path
        and cookie_store_path.exists()
        and cookie_key_path.exists()
    )

    username_np, password_np = resolve_credentials_no_prompt(args, secrets_path)
    has_noninteractive_creds = bool(username_np and password_np)

    if (
        args.cloud_download == "auto"
        and not has_cookie_bundle
        and not has_noninteractive_creds
        and args.cloud_base_url
    ):
        download_cloud_snapshot(
            output_dir,
            args.cloud_base_url,
            download_all_terms=bool(args.cloud_all_terms),
            request_interval=request_interval,
        )
        return

    if cookie_store_path and cookie_key_path:
        try:
            crawl(
                output_dir,
                None,
                None,
                cookie_header=args.cookie_header,
                cookie_store_path=cookie_store_path,
                cookie_key_path=cookie_key_path,
                cookie_username_hint=None,
                max_courses=args.limit,
                request_interval=request_interval,
                xkkz_id=args.xkkz_id,
                xklc=args.xklc,
                campus_scope=args.campus_scope,
                no_prompt=bool(args.no_prompt),
            )
            return
        except RuntimeError as error:
            if "未提供账号密码" not in str(error):
                raise

    if args.no_prompt:
        if not has_noninteractive_creds:
            if args.cloud_download == "auto" and args.cloud_base_url:
                download_cloud_snapshot(
                    output_dir,
                    args.cloud_base_url,
                    download_all_terms=bool(args.cloud_all_terms),
                    request_interval=request_interval,
                )
                return
            raise RuntimeError("缺少登录凭据且 --no-prompt 已启用")
        username, password = cast(str, username_np), cast(str, password_np)
    else:
        username, password = resolve_credentials(args, secrets_path)
    crawl(
        output_dir,
        username,
        password,
        cookie_header=args.cookie_header,
        cookie_store_path=cookie_store_path,
        cookie_key_path=cookie_key_path,
        cookie_username_hint=username,
        max_courses=args.limit,
        request_interval=request_interval,
        xkkz_id=args.xkkz_id,
        xklc=args.xklc,
        campus_scope=args.campus_scope,
        no_prompt=bool(args.no_prompt),
    )


if __name__ == "__main__":
    main()
