#!/usr/bin/env python3
import argparse
import base64
import getpass
import concurrent.futures
import hashlib
import json
import os
import time
import threading
from typing import Dict, List, Tuple
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


def encrypt_password(password: str) -> str:
    key = rsa.PublicKey.load_pkcs1_openssl_pem(RSA_PUBKEY.encode())
    encrypted = rsa.encrypt(password.encode(), key)
    return base64.b64encode(encrypted).decode()


class JWXTCrawler:
    def __init__(self, username: str, password: str, workers: int = 8):
        self.username = username
        self.password = password
        self.workers = workers
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

    def login(self) -> None:
        resp = self.session.get(f"{JWXT_HOST}/sso/shulogin", allow_redirects=False)
        if resp.status_code not in (301, 302):
            raise RuntimeError(f"Unexpected SSO entry status {resp.status_code}")
        url = urljoin(resp.url, resp.headers.get("Location", ""))

        resp = self.session.get(url, allow_redirects=False)
        if resp.status_code not in (301, 302):
            raise RuntimeError("Failed to reach SHU SSO login page")
        login_url = urljoin(url, resp.headers.get("Location", ""))

        # Load login page to obtain required cookies
        self.session.get(login_url, timeout=15)

        payload = {
            "username": self.username,
            "password": encrypt_password(self.password),
        }
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
            resp = self.session.get(current, allow_redirects=False, timeout=15)

        if resp.status_code != 200:
            raise RuntimeError(f"Login failed, last status {resp.status_code}")

        # Warm up jwglxt so the server issues valid teaching cookies
        self.session.get(
            f"{JWXT_HOST}/jwglxt/xtgl/index_initMenu.html?"
            f"jsdm=xs&_t={int(time.time()*1000)}",
            timeout=15,
        )

    def fetch_selection_page(self) -> Tuple[str, Dict[str, str]]:
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
        self, params: Dict[str, str], meta: Dict[str, Dict]
    ) -> List[Dict]:
        results: List[Dict] = []
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


def crawl(
    output_dir: str,
    username: str,
    password: str,
    max_courses: int | None = None,
) -> None:
    crawler = JWXTCrawler(username, password)
    crawler.login()
    _, fields = crawler.fetch_selection_page()
    params = crawler.build_query_context(fields)

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

    courses = crawler.fetch_course_details(params, meta)
    courses.sort(key=lambda x: (x["courseId"], x["teachingClassId"]))

    term_code = f"{fields.get('xkxnm', '').strip()}-{fields.get('xkxqm', '').strip()}"
    term_name = (
        f"{fields.get('xkxnmc', fields.get('xkxnm', '')).strip()} "
        f"{fields.get('xkxqmc', fields.get('xkxqm', '')).strip()}".strip()
    ).strip()

    os.makedirs(os.path.join(output_dir, "terms"), exist_ok=True)
    result = {
        "backendOrigin": JWXT_HOST,
        "termName": term_name or term_code,
        "updateTimeMs": int(time.time() * 1000),
        "hash": hashlib.md5(
            json.dumps(courses, sort_keys=True, ensure_ascii=False).encode()
        ).hexdigest(),
        "courses": courses,
    }
    term_path = os.path.join(output_dir, "terms", f"{term_code}.json")
    with open(term_path, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2)

    with open(os.path.join(output_dir, "current.json"), "w", encoding="utf-8") as fh:
        json.dump([term_code], fh, ensure_ascii=False, indent=2)

    print(f"Saved {len(courses)} teaching classes to {term_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="JWXT course crawler")
    parser.add_argument("-u", "--username", required=True, help="学号")
    parser.add_argument("-p", "--password", help="密码")
    parser.add_argument(
        "--password-stdin",
        action="store_true",
        help="从标准输入读取密码",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        default="data",
        help="输出目录（默认 data）",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="仅抓取前 N 门课程（调试用）",
    )
    args = parser.parse_args()

    if args.password_stdin:
        password = input().rstrip("\n")
    elif args.password:
        password = args.password
    else:
        password = getpass.getpass("Password: ")

    requests.packages.urllib3.disable_warnings()  # type: ignore[attr-defined]
    crawl(args.output_dir, args.username, password, max_courses=args.limit)


if __name__ == "__main__":
    main()
