#!/usr/bin/env python3
"""Import templates from migration bundle into VPS SQLite DB."""
import sqlite3
import json
import shutil
from pathlib import Path

DB_PATH = Path("data/nexo-lp.db")
BUNDLE_DIR = Path("template-migration")
MANIFEST_PATH = BUNDLE_DIR / "templates.json"
PREVIEWS_SRC = BUNDLE_DIR / "previews"
THUMBS_SRC = BUNDLE_DIR / "thumbnails"
PREVIEWS_DST = Path("data/previews/public")
THUMBS_DST = Path("data/previews/thumbnails")


def main():
    PREVIEWS_DST.mkdir(parents=True, exist_ok=True)
    THUMBS_DST.mkdir(parents=True, exist_ok=True)

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    templates = manifest["templates"]
    print(f"Templates in bundle: {len(templates)}")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("SELECT id, public_preview_token FROM templates")
    existing = {r[0]: r[1] for r in cur.fetchall()}
    existing_tokens = {t for t in existing.values() if t}

    columns = [r[1] for r in cur.execute("PRAGMA table_info(templates)").fetchall()]
    col_set = set(columns)

    inserted = 0
    skipped_dup = 0
    failed = []

    for t in templates:
        tid = t["id"]
        token = t.get("public_preview_token")
        if tid in existing or (token and token in existing_tokens):
            skipped_dup += 1
            continue

        data = {k: v for k, v in t.items() if k in col_set}
        for col in columns:
            if col not in data:
                data[col] = None

        cols = ",".join(data.keys())
        placeholders = ",".join(["?"] * len(data))
        try:
            cur.execute(
                f"INSERT INTO templates ({cols}) VALUES ({placeholders})",
                list(data.values()),
            )
            inserted += 1
        except Exception as e:
            failed.append((tid, str(e)))

    conn.commit()

    copied_previews = 0
    copied_thumbs = 0
    for t in templates:
        token = t.get("public_preview_token")
        if token:
            src = PREVIEWS_SRC / f"{token}.html"
            dst = PREVIEWS_DST / f"{token}.html"
            if src.exists():
                shutil.copy2(src, dst)
                copied_previews += 1

        tid = t["id"]
        src = THUMBS_SRC / f"{tid}.png"
        dst = THUMBS_DST / f"{tid}.png"
        if src.exists():
            shutil.copy2(src, dst)
            copied_thumbs += 1

    cur.execute("SELECT COUNT(*) FROM templates")
    final_count = cur.fetchone()[0]

    print(f"Inserted: {inserted}")
    print(f"Skipped (duplicate): {skipped_dup}")
    print(f"Failed: {len(failed)}")
    print(f"Copied previews: {copied_previews}")
    print(f"Copied thumbnails: {copied_thumbs}")
    print(f"Total templates in DB now: {final_count}")
    if failed:
        for tid, err in failed:
            print(f"  FAIL {tid}: {err}")


if __name__ == "__main__":
    main()
