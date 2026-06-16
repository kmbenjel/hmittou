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
SERVICE_WORKER = ROOT / "sw.js"
SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
IMAGE_SITEMAP_NS = "http://www.google.com/schemas/sitemap-image/1.1"
PAGE_URL = "https://hmittou.benjelloun.dev/"
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
    ET.register_namespace("image", IMAGE_SITEMAP_NS)
    tree = ET.parse(sitemap)
    root = tree.getroot()
    namespace = {"sm": SITEMAP_NS}
    changed = False
    found = False

    for url in root.findall("sm:url", namespace):
        loc = url.find("sm:loc", namespace)
        lastmod = url.find("sm:lastmod", namespace)
        if loc is None or lastmod is None or loc.text != PAGE_URL:
            continue
        found = True
        if lastmod.text != iso_date:
            lastmod.text = iso_date
            changed = True

    if not found:
        raise RuntimeError(f"Expected sitemap URL: {PAGE_URL}")

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


def bump_service_worker(sw: Path = SERVICE_WORKER) -> bool:
    """Increment the numeric CACHE_NAME (hmittou-cache-vN) so the service worker
    refreshes its precache. Uses the same vN scheme as scripts/build.mjs, so the
    two never disagree on the cache name."""
    text = sw.read_text(encoding="utf-8")
    match = re.search(r"hmittou-cache-v(\d+)", text)
    if match is None:
        raise RuntimeError("CACHE_NAME 'hmittou-cache-vN' not found in sw.js")

    new_text = replace_once(
        r"hmittou-cache-v\d+",
        f"hmittou-cache-v{int(match.group(1)) + 1}",
        text,
    )
    sw.write_text(new_text, encoding="utf-8")
    return True


def stamp(date: dt.date | None = None) -> dict[str, bool]:
    date = date or dt.date.today()
    metadata = stamp_index(date=date)
    sitemap = stamp_sitemap(date=date)
    # Bump the SW cache only when the stamped page/sitemap actually changed.
    service_worker = bump_service_worker() if (metadata or sitemap) else False
    return {
        "metadata": metadata,
        "sitemap": sitemap,
        "service-worker": service_worker,
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
