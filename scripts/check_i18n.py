#!/usr/bin/env python3
"""CLI helpers for keeping i18n dictionaries consistent and UI text localized.

Notes on what `scan` checks (and what it intentionally does not):
- `scan` is a *UI-facing* check. By default it scans only `.svelte` files under `app/src`.
- Chinese literals in data/config/parsers are allowed and are NOT scanned by default.
  (Example: campus names, timetable parsing patterns, raw dataset taxonomy strings.)

Allowed vs disallowed "ignore":
- Allowed: ignoring generated/build/vendor directories (e.g. `node_modules`, `.svelte-kit`, `dist`) and locale sources
  (`app/src/lib/i18n/locales`) because they are not UI pages/components.
- Not allowed: ignoring core UI directories (e.g. `app/src/routes`, `app/src/lib/apps`, `app/src/lib/components`,
  `app/src/lib/primitives`, `app/src/lib/layout`) to hide UI strings; UI text must go through i18n keys.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]


def resolve_repo_path(path: Path) -> Path:
    return path if path.is_absolute() else (REPO_ROOT / path)


DEFAULT_LOCALES = [
    Path("app/src/lib/i18n/locales/zh-CN.ts"),
    Path("app/src/lib/i18n/locales/en-US.ts"),
]
DEFAULT_SCAN_ROOT = Path("app/src")
# Scan only UI components by default (Svelte). Override via `--ext` when needed.
DEFAULT_EXTS = {".svelte"}
DEFAULT_IGNORE_DIRS = {
    ".git",
    "node_modules",
    ".svelte-kit",
    "dist",
    "build",
    "openspec",
    "agentTemps",
    "crawler",
    "docs",
    "tests",
    "scripts/__pycache__",
    "app/src/lib/i18n/locales"
}
DEFAULT_IGNORE_FILES = {"check_i18n.py", "README.md", "PLAN.md", "AGENTS.md"}
DEFAULT_KEY_OUTPUT = Path("app/src/lib/i18n/keys.json")
CN_PATTERN = re.compile(r"[\u4e00-\u9fff]")
LINE_COMMENT_RE = re.compile(r"//.*?(?=$|\n)")
BLOCK_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)
EXPORT_DECL_RE = re.compile(r"export\s+const\s+[A-Za-z0-9_]+\s*=")


class LocaleParseError(RuntimeError):
    """Raised when a locale file cannot be parsed."""


# Guardrails: do not let callers "ignore" away UI source directories to silence regressions.
PROTECTED_UI_DIRS: Tuple[Path, ...] = (
    Path("app/src/routes"),
    Path("app/src/lib/apps"),
    Path("app/src/lib/components"),
    Path("app/src/lib/primitives"),
    Path("app/src/lib/layout"),
)


@dataclass
class CompareIssue:
    file: str
    missing: List[str]
    extras: List[str]
    blanks: List[str]


@dataclass
class ScanFinding:
    file: str
    lines: List[Tuple[int, str]]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="i18n consistency checker")
    parser.add_argument(
        "command",
        nargs="?",
        choices=("compare", "scan", "dump", "all"),
        default="all",
        help="Which check to run (default: all)"
    )
    parser.add_argument("--json", action="store_true", help="Emit JSON report instead of text output")
    parser.add_argument(
        "--locales",
        nargs="+",
        type=Path,
        default=DEFAULT_LOCALES,
        help="Locale files to compare/dump (default: zh-CN + en-US)"
    )
    parser.add_argument("--root", type=Path, default=DEFAULT_SCAN_ROOT, help="Root directory for literal scan")
    parser.add_argument("--ext", nargs="+", default=sorted(DEFAULT_EXTS), help="File extensions to scan")
    parser.add_argument(
        "--ignore-dir",
        nargs="*",
        default=sorted(DEFAULT_IGNORE_DIRS),
        help="Directory fragments to ignore while scanning"
    )
    parser.add_argument(
        "--ignore-file",
        nargs="*",
        default=sorted(DEFAULT_IGNORE_FILES),
        help="Exact file names to ignore while scanning"
    )
    parser.add_argument(
        "--allow-pattern",
        nargs="*",
        default=[],
        help="Regex patterns considered allowed literals"
    )
    parser.add_argument(
        "--key-output",
        type=Path,
        default=DEFAULT_KEY_OUTPUT,
        help="Where to store flattened key list for dump/all"
    )
    return parser


def extract_ts_object(raw: str) -> str:
    match = EXPORT_DECL_RE.search(raw)
    if not match:
        raise LocaleParseError("无法找到 export const 声明")
    start = raw.find("{", match.end())
    if start == -1:
        raise LocaleParseError("无法找到对象起始花括号")
    depth = 0
    in_string: str | None = None
    escape = False
    for idx in range(start, len(raw)):
        ch = raw[idx]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == in_string:
                in_string = None
            continue
        if ch in ('"', "'", "`"):
            in_string = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return raw[start: idx + 1]
    raise LocaleParseError("未能找到匹配的结束花括号")


def sanitize_ts_object(text: str) -> str:
    text = BLOCK_COMMENT_RE.sub("", text)
    text = LINE_COMMENT_RE.sub("", text)
    text = text.replace("`", '"')
    text = text.replace("'", '"')
    text = re.sub(r",\s*(?=[}\]])", "", text)
    text = re.sub(r"([{,]\s*)([A-Za-z0-9_]+)(\s*:)", r'\1"\2"\3', text)
    return text


def parse_locale(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise LocaleParseError(f"找不到文件: {path}")
    raw = path.read_text(encoding="utf-8")
    obj = extract_ts_object(raw)
    json_text = sanitize_ts_object(obj)
    try:
        return json.loads(json_text)
    except json.JSONDecodeError as exc:
        raise LocaleParseError(f"JSON 解析失败 ({path}): {exc}") from exc


def flatten_dict(data: Any, prefix: str = "") -> Dict[str, Any]:
    items: Dict[str, Any] = {}
    if isinstance(data, dict):
        for key, value in data.items():
            next_prefix = f"{prefix}.{key}" if prefix else key
            items.update(flatten_dict(value, next_prefix))
    elif isinstance(data, list):
        for idx, value in enumerate(data):
            next_prefix = f"{prefix}[{idx}]" if prefix else f"[{idx}]"
            items.update(flatten_dict(value, next_prefix))
    else:
        items[prefix] = data
    return items


def find_blank_keys(flat: Dict[str, Any]) -> List[str]:
    blanks: List[str] = []
    for key, value in flat.items():
        if isinstance(value, str):
            # Only treat truly empty strings or echo values as blank.
            if value == "" or value == key:
                blanks.append(key)
    return blanks


def compare_locales(paths: Sequence[Path]) -> Tuple[bool, Dict[str, Any]]:
    if len(paths) < 2:
        raise LocaleParseError("compare 模式至少需要两个 locale 文件")
    parsed = {path: flatten_dict(parse_locale(path)) for path in paths}
    canonical_path = paths[0]
    canonical = parsed[canonical_path]
    issues: List[CompareIssue] = []
    ok = True
    for path in paths:
        current = parsed[path]
        missing = sorted(set(canonical.keys()) - set(current.keys())) if path != canonical_path else []
        extras = sorted(set(current.keys()) - set(canonical.keys())) if path != canonical_path else []
        blanks = sorted(find_blank_keys(current))
        if missing or extras or blanks:
            ok = False
        issues.append(CompareIssue(str(path), missing, extras, blanks))
    report = {
        "type": "compare",
        "ok": ok,
        "locales": [str(p) for p in paths],
        "issues": [issue.__dict__ for issue in issues]
    }
    return ok, report


def path_contains_fragment(path: Path, fragment: str) -> bool:
    frag_parts = tuple(part for part in Path(fragment).parts if part and part != ".")
    if not frag_parts:
        return False
    parts = path.parts
    if len(frag_parts) == 1:
        return frag_parts[0] in parts
    for idx in range(len(parts) - len(frag_parts) + 1):
        if list(parts[idx: idx + len(frag_parts)]) == list(frag_parts):
            return True
    return False


def should_scan(path: Path, ignore_dirs: Iterable[str], ignore_files: Iterable[str], extensions: Iterable[str]) -> bool:
    if path.name in ignore_files:
        return False
    if path.suffix not in extensions:
        return False
    for fragment in ignore_dirs:
        if path_contains_fragment(path, fragment):
            return False
    return True


def scan_literals(
    root: Path,
    extensions: Iterable[str],
    ignore_dirs: Iterable[str],
    ignore_files: Iterable[str],
    allow_patterns: Iterable[str]
) -> Tuple[bool, Dict[str, Any]]:
    allow_regexes = [re.compile(pattern) for pattern in allow_patterns]
    findings: List[ScanFinding] = []
    total_files = 0
    for path in root.rglob("*"):
        if not path.is_file() or not should_scan(path, ignore_dirs, ignore_files, extensions):
            continue
        total_files += 1
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError:
            continue
        hits: List[Tuple[int, str]] = []
        for idx, line in enumerate(lines, 1):
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith(("//", "/*", "*", "<!--", "-->")):
                continue
            if stripped.startswith("import "):
                continue
            if any(regex.search(line) for regex in allow_regexes):
                continue
            if CN_PATTERN.search(line):
                snippet = stripped if len(stripped) <= 100 else stripped[:97] + "..."
                hits.append((idx, snippet))
        if hits:
            findings.append(ScanFinding(str(path), hits))
    ok = not findings
    report = {
        "type": "scan",
        "ok": ok,
        "root": str(root),
        "totalFiles": total_files,
        "findings": [
            {
                "file": finding.file,
                "lines": [{"line": line_no, "text": text} for line_no, text in finding.lines]
            }
            for finding in findings
        ]
    }
    return ok, report


def dump_keys(paths: Sequence[Path], output: Path) -> Tuple[bool, Dict[str, Any]]:
    key_set = set()
    for path in paths:
        flat = flatten_dict(parse_locale(path))
        key_set.update(flat.keys())
    keys = sorted(key_set)
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generatedFrom": [str(p) for p in paths],
        "count": len(keys),
        "keys": keys
    }
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = {
        "type": "dump",
        "ok": True,
        "output": str(output),
        "count": len(keys)
    }
    return True, report


def print_compare(report: Dict[str, Any]) -> None:
    if report["ok"]:
        print("✅ Locale keys match across:", ", ".join(report["locales"]))
        return
    print("❌ Locale mismatch detected")
    for issue in report["issues"]:
        file = issue["file"]
        missing = issue["missing"]
        extras = issue["extras"]
        blanks = issue["blanks"]
        if not (missing or extras or blanks):
            continue
        print(f"\n{file}:")
        if missing:
            print("  Missing keys:")
            for key in missing:
                print(f"    - {key}")
        if extras:
            print("  Extra keys:")
            for key in extras:
                print(f"    - {key}")
        if blanks:
            print("  Blank/echo values:")
            for key in blanks:
                print(f"    - {key}")


def print_scan(report: Dict[str, Any]) -> None:
    if report["ok"]:
        print(f"✅ No bare Chinese literals under {report['root']} (checked {report['totalFiles']} files)")
        return
    print(f"❌ Found hard-coded literals under {report['root']}: {len(report['findings'])} files")
    for finding in report["findings"]:
        print(f"\n{finding['file']}")
        for entry in finding["lines"]:
            print(f"  L{entry['line']}: {entry['text']}")


def print_dump(report: Dict[str, Any]) -> None:
    print(f"✅ Wrote {report['count']} keys to {report['output']}")


def run_command(args: argparse.Namespace) -> Tuple[bool, Dict[str, Any]]:
    extensions = {ext if ext.startswith(".") else f".{ext}" for ext in args.ext}
    ignore_dirs = args.ignore_dir or []
    ignore_files = args.ignore_file or []
    allow_patterns = args.allow_pattern or []
    locales = [resolve_repo_path(path) for path in args.locales]
    root = resolve_repo_path(args.root)
    key_output = resolve_repo_path(args.key_output)
    # Prevent "ignore UI" footguns: allow ignoring build/output/data dirs, but not the UI source tree.
    for fragment in ignore_dirs:
        fragment_path = Path(fragment)
        frag_parts = tuple(part for part in fragment_path.parts if part and part != ".")
        if not frag_parts:
            continue
        for protected in PROTECTED_UI_DIRS:
            protected_parts = tuple(part for part in protected.parts if part and part != ".")
            if not protected_parts:
                continue
            # If fragment is a prefix of a protected dir, it would hide UI files; reject.
            if len(frag_parts) <= len(protected_parts) and list(protected_parts[: len(frag_parts)]) == list(frag_parts):
                raise LocaleParseError(
                    f"scan 禁止通过 --ignore-dir 忽略 UI 目录片段: {fragment} (would hide {protected})"
                )
    if args.command == "compare":
        return compare_locales(locales)
    if args.command == "scan":
        return scan_literals(root, extensions, ignore_dirs, ignore_files, allow_patterns)
    if args.command == "dump":
        return dump_keys(locales, key_output)
    combined: Dict[str, Any] = {}
    ok_compare, rep_compare = compare_locales(locales)
    combined["compare"] = rep_compare
    if not ok_compare:
        return False, combined
    ok_scan, rep_scan = scan_literals(root, extensions, ignore_dirs, ignore_files, allow_patterns)
    combined["scan"] = rep_scan
    if not ok_scan:
        return False, combined
    ok_dump, rep_dump = dump_keys(locales, key_output)
    combined["dump"] = rep_dump
    return ok_dump, combined


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    try:
        ok, report = run_command(args)
        if args.json:
            print(json.dumps(report, ensure_ascii=False, indent=2))
        else:
            if args.command == "compare":
                print_compare(report)
            elif args.command == "scan":
                print_scan(report)
            elif args.command == "dump":
                print_dump(report)
            else:
                if "compare" in report:
                    print_compare(report["compare"])
                if "scan" in report:
                    print()
                    print_scan(report["scan"])
                if "dump" in report:
                    print()
                    print_dump(report["dump"])
        sys.exit(0 if ok else 1)
    except LocaleParseError as exc:
        print(f"[i18n-check] {exc}", file=sys.stderr)
        sys.exit(2)
    except FileNotFoundError as exc:
        print(f"[i18n-check] Missing file: {exc}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
