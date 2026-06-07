#!/usr/bin/env python3
"""Stamp build-time metadata dates into index.html and sitemap.xml."""

from __future__ import annotations

import datetime as dt
import re
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SITEMAP = ROOT / "sitemap.xml"
SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
PAGE_URL = "https://benjelloun.dev/hmittou/"
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


def stamp_index(index: Path = INDEX, date: dt.date | None = None) -> bool:
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


def stamp_sitemap(sitemap: Path = SITEMAP, date: dt.date | None = None) -> bool:
    date = date or dt.date.today()
    iso_date = date.isoformat()

    ET.register_namespace("", SITEMAP_NS)
    tree = ET.parse(sitemap)
    root = tree.getroot()
    namespace = {"sm": SITEMAP_NS}
    changed = False

    for url in root.findall("sm:url", namespace):
        loc = url.find("sm:loc", namespace)
        lastmod = url.find("sm:lastmod", namespace)
        if loc is None or lastmod is None or loc.text != PAGE_URL:
            continue
        if lastmod.text != iso_date:
            lastmod.text = iso_date
            changed = True

    if not changed:
        return False

    ET.indent(tree, space="  ")
    tree.write(sitemap, encoding="utf-8", xml_declaration=True)
    text = sitemap.read_text(encoding="utf-8")
    text = text.replace(
        "<?xml version='1.0' encoding='utf-8'?>",
        '<?xml version="1.0" encoding="UTF-8"?>',
    )
    if not text.endswith("\n"):
        text += "\n"
    sitemap.write_text(text, encoding="utf-8")
    return True


def stamp(date: dt.date | None = None) -> dict[str, bool]:
    date = date or dt.date.today()
    return {
        "metadata": stamp_index(date=date),
        "sitemap": stamp_sitemap(date=date),
    }


def main() -> int:
    today = dt.date.today()
    changed = stamp(today)
    for name, did_change in changed.items():
        status = "updated" if did_change else "already current"
        print(f"{name} dates {status}: {today.isoformat()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
