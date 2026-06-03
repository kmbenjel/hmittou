#!/usr/bin/env python3
"""Stamp build-time metadata dates into index.html."""

from __future__ import annotations

import datetime as dt
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
MONTHS_AR_MA = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "ماي",
    "يونيو",
    "يوليوز",
    "غشت",
    "شتنبر",
    "أكتوبر",
    "نونبر",
    "دجنبر",
]


def arabic_gregorian_date(date: dt.date) -> str:
    return f"{date.day} {MONTHS_AR_MA[date.month - 1]} {date.year}"


def replace_once(pattern: str, replacement: str, text: str) -> str:
    next_text, count = re.subn(pattern, replacement, text, count=1)
    if count != 1:
        raise RuntimeError(f"Expected exactly one match for pattern: {pattern}")
    return next_text


def stamp(index: Path = INDEX, date: dt.date | None = None) -> bool:
    date = date or dt.date.today()
    iso_date = date.isoformat()
    display_date = arabic_gregorian_date(date)
    html = index.read_text(encoding="utf-8")

    html = replace_once(
        r'<meta name="last-modified" content="[^"]+">',
        f'<meta name="last-modified" content="{iso_date}">',
        html,
    )
    html = replace_once(
        r'"dateModified": "[^"]+"',
        f'"dateModified": "{iso_date}"',
        html,
    )
    html = replace_once(
        r'<p id="last-updated" data-fallback-date="[^"]+"([^>]*)>آخر تحديث: [^<]+</p>',
        f'<p id="last-updated" data-fallback-date="{iso_date}"\\1>آخر تحديث: {display_date}</p>',
        html,
    )

    current = index.read_text(encoding="utf-8")
    if html == current:
        return False

    index.write_text(html, encoding="utf-8")
    return True


def main() -> int:
    changed = stamp()
    status = "updated" if changed else "already current"
    print(f"metadata dates {status}: {dt.date.today().isoformat()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
