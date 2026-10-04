#!/usr/bin/env python3
"""Локальный сервер тренажёра: раздаёт web/, data/ и список файлов базы.

Запуск:  python3 serve.py [--host 127.0.0.1] [--port 8000]
"""

import argparse
import json
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
WEB_DIR = ROOT / "web"
DATA_DIR = ROOT / "data"


def list_data_files():
    files = []
    for path in DATA_DIR.rglob("*.txt"):
        if any(part.startswith(".") for part in path.relative_to(DATA_DIR).parts):
            continue
        files.append(path.relative_to(DATA_DIR).as_posix())
    return sorted(files)


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".txt": "text/plain; charset=utf-8",
        ".json": "application/json; charset=utf-8",
    }

    def do_GET(self):
        if urlsplit(self.path).path == "/api/files":
            body = json.dumps(list_data_files(), ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def translate_path(self, path):
        # /data/... берётся из каталога data/, всё остальное — из web/
        clean = unquote(urlsplit(path).path)
        if clean == "/data" or clean.startswith("/data/"):
            rel = clean[len("/data"):].lstrip("/")
            target = (DATA_DIR / rel).resolve()
            if target != DATA_DIR and DATA_DIR not in target.parents:
                return str(DATA_DIR / "__forbidden__")
            return str(target)
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, format, *args):
        if os.environ.get("TRAINER_VERBOSE"):
            super().log_message(format, *args)


def main():
    parser = argparse.ArgumentParser(description="Тренажёр литовской грамматики")
    parser.add_argument("--host", default="127.0.0.1",
                        help="адрес (0.0.0.0 — доступ из локальной сети, например с телефона)")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    handler = partial(Handler, directory=str(WEB_DIR))
    server = ThreadingHTTPServer((args.host, args.port), handler)
    shown_host = "localhost" if args.host in ("127.0.0.1", "0.0.0.0") else args.host
    print(f"Тренажёр запущен: http://{shown_host}:{args.port}/   (Ctrl+C — остановить)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
