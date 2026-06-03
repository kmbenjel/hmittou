#!/usr/bin/env python3
"""Generate the mobile and desktop PDF exports from index.html."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAMP_SCRIPT = ROOT / "scripts" / "stamp_metadata_dates.py"
PUPPETEER_SCRIPT = ROOT / "scripts" / "generate_pdfs_puppeteer.js"


def main() -> int:
    subprocess.run([sys.executable, str(STAMP_SCRIPT)], cwd=ROOT, check=True)
    subprocess.run(["node", str(PUPPETEER_SCRIPT)], cwd=ROOT, check=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
