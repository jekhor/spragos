#!/usr/bin/env python3
"""Сборка статического сайта для GitHub Pages (или любого статического хостинга).

Копирует web/ и data/ в одну папку и кладёт data/index.json со списком файлов базы —
он заменяет /api/files, который на статическом хостинге недоступен.

Запуск:  python3 build.py [папка]   (по умолчанию _site)
"""

import json
import shutil
import sys
from pathlib import Path

from serve import DATA_DIR, WEB_DIR, list_data_files


def build(out):
    out = Path(out).resolve()
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(WEB_DIR, out)
    files = list_data_files()
    for rel in files:
        target = out / "data" / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(DATA_DIR / rel, target)
    (out / "data" / "index.json").write_text(json.dumps(files, ensure_ascii=False), encoding="utf-8")
    print(f"Сайт собран в {out}: файлов базы {len(files)}")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "_site")
