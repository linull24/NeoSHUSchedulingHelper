#!/usr/bin/env python3
import argparse
import base64
import getpass
import concurrent.futures
import hashlib
import json
import os
import sys
import time
import threading
from pathlib import Path
from typing import Callable, Dict, List, Tuple
from urllib.parse import urljoin

import requests
import rsa
from bs4 import BeautifulSoup

JWXT_HOST = "https://jwxt.shu.edu.cn"
SSO_HOST = "https://newsso.shu.edu.cn"
SELECTION_ENDPOINT = (
    f"{JWXT_HOST}/jwglxt/xsxk/zzxkyzb_cxZzxkYzbIndex.html?gnmkdm=N253512"
)
COURSE_LIST_ENDPOINT = (
    f"{JWXT_HOST}/jwglxt/xsxk/zzxkyzb_cxZzxkYzbPartDisplay.html?gnmkdm=N253512"
)
COURSE_DETAIL_ENDPOINT = (
    f"{JWXT_HOST}/jwglxt/xsxk/zzxkyzbjk_cxJxbWithKchZzxkYzb.html?gnmkdm=N253512"
)

SCRIPT_ROOT = Path(__file__).resolve().parent
DEFAULT_OUTPUT_DIR = SCRIPT_ROOT / "data"
DEFAULT_SECRETS_FILE = SCRIPT_ROOT / ".secrets.json"

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
    allowed_root = SCRIPT_ROOT
    if not _is_subpath(target, allowed_root):
        raise ValueError(f"Output path {target} is outside allowed root {allowed_root}")
    target.mkdir(parents=True, exist_ok=True)
    return target


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

    def _sleep_if_needed(self) -> None:
        if self.request_interval > 0:
            time.sleep(self.request_interval)

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
        self.session.get(login_url, timeout=15)

        payload = {
            "username": self.username,
            "password": encrypt_password(self.password),
        }
        self._sleep_if_needed()
        resp = self.session.post(
            login_url,
            data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            allow_redirects=False,
            timeout=15,
        )
        current = login_url
        for _ in range(10):
            if resp.status_code not in (301, 302, 303):
                break
            location = resp.headers.get("Location")
            if not location:
                break
            current = urljoin(current, location)
            self._sleep_if_needed()
            resp = self.session.get(current, allow_redirects=False, timeout=15)

        if resp.status_code != 200:
            raise RuntimeError(f"Login failed, last status {resp.status_code}")

        # Warm up jwglxt so the server issues valid teaching cookies
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
            session = self._thread_session()
            self._sleep_if_needed()
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
            if resp.status_code != 200:
                raise RuntimeError(
                    f"Detail request for {kch_id} failed "
                    f"({resp.status_code}): {resp.text[:200]}"
                )
            detail_rows = resp.json()
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
                results.extend(fut.result())
                completed += 1
                if progress_callback:
                    progress_callback(completed, total_items)
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


def crawl(
    output_dir: Path,
    username: str,
    password: str,
    max_courses: int | None = None,
    request_interval: float = 0.0,
) -> None:
    progress = ProgressTracker(total_steps=6)
    progress.start("准备登录教务系统")
    progress.log(f"本次请求间隔：{request_interval:.2f} 秒")

    crawler = JWXTCrawler(
        username,
        password,
        request_interval=request_interval,
    )
    crawler.login()
    progress.log_step("登录成功")

    _, fields = crawler.fetch_selection_page()
    params = crawler.build_query_context(fields)
    progress.log_step("选课页面加载完毕")

    course_rows = crawler.fetch_course_rows(params)
    if not course_rows:
        raise RuntimeError("课程列表为空，可能尚未到选课时间")

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

    progress.log_step(f"课程列表获取完成，共 {len(meta)} 门课程")

    def detail_progress(current: int, total: int) -> None:
        if total <= 0:
            return
        if current % 300 == 0 or current == total:
            progress.log(
                f"课程详情抓取成功：({current}/{total})"
            )

    courses = crawler.fetch_course_details(
        params,
        meta,
        progress_callback=detail_progress,
    )
    courses.sort(key=lambda x: (x["courseId"], x["teachingClassId"]))
    progress.log_step(f"课程详情抓取完成，共 {len(courses)} 个教学班")

    term_code = f"{fields.get('xkxnm', '').strip()}-{fields.get('xkxqm', '').strip()}"
    term_name = (
        f"{fields.get('xkxnmc', fields.get('xkxnm', '')).strip()} "
        f"{fields.get('xkxqmc', fields.get('xkxqm', '')).strip()}".strip()
    ).strip()

    os.makedirs(output_dir / "terms", exist_ok=True)
    result = {
        "backendOrigin": JWXT_HOST,
        "termName": term_name or term_code,
        "updateTimeMs": int(time.time() * 1000),
        "hash": hashlib.md5(
            json.dumps(courses, sort_keys=True, ensure_ascii=False).encode()
        ).hexdigest(),
        "courses": courses,
    }
    term_path = output_dir / "terms" / f"{term_code}.json"
    with open(term_path, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2)
    progress.log_step(f"学期 {term_code} 数据写入完成")

    with open(output_dir / "current.json", "w", encoding="utf-8") as fh:
        json.dump([term_code], fh, ensure_ascii=False, indent=2)
    progress.log_step(
        f"current.json 已更新，共保存 {len(courses)} 个教学班"
    )


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
        "--request-interval",
        type=float,
        help="相邻请求之间的等待秒数（默认 0）",
    )
    args = parser.parse_args()

    output_dir = resolve_output_dir(args.output_dir)
    secrets_path = Path(args.secrets_file).expanduser().resolve()
    username, password = resolve_credentials(args, secrets_path)
    request_interval = args.request_interval
    if request_interval is None:
        request_interval = prompt_request_interval()
    request_interval = max(0.0, request_interval)

    requests.packages.urllib3.disable_warnings()  # type: ignore[attr-defined]
    crawl(
        output_dir,
        username,
        password,
        max_courses=args.limit,
        request_interval=request_interval,
    )


if __name__ == "__main__":
    main()
