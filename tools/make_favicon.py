#!/usr/bin/env python3
"""Генерирует иконки сайта: web/favicon.ico (16, 32, 48), web/favicon-32.png, web/apple-touch-icon.png (180).

Тёмный скруглённый квадрат с жёлтой буквой «S» — цвета логотипа и акцента сайта.
Запуск: python3 tools/make_favicon.py   (нужны Pillow и шрифт Noto Sans)
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
FONT = Path("/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf")

BG = "#1f2328"  # --text светлой темы
FG = "#e0b23c"  # --accent тёмной темы: на тёмном фоне контрастнее

SIZE = 512  # рисуем крупно и уменьшаем — так буква сглажена на любых размерах


def master():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=112, fill=BG)
    font = ImageFont.truetype(str(FONT), 470)
    # anchor "mm" центрирует по описывающему прямоугольнику с учётом выносных элементов шрифта;
    # «S» без них визуально чуть ниже центра, поэтому центрируем по реальной рамке буквы
    l, t, r, b = d.textbbox((0, 0), "S", font=font)
    d.text(((SIZE - (r - l)) / 2 - l, (SIZE - (b - t)) / 2 - t), "S", font=font, fill=FG)
    return img


def main():
    img = master()
    img.resize((32, 32), Image.LANCZOS).save(WEB / "favicon-32.png", optimize=True)
    # у иконки для iOS фона-подложки нет, поэтому квадрат без прозрачных углов (iOS скругляет сам)
    touch = Image.new("RGBA", (SIZE, SIZE), BG)
    touch.alpha_composite(img)
    touch.convert("RGB").resize((180, 180), Image.LANCZOS).save(WEB / "apple-touch-icon.png", optimize=True)
    img.save(WEB / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    for name in ("favicon.ico", "favicon-32.png", "apple-touch-icon.png"):
        print(f"{WEB / name} ({(WEB / name).stat().st_size} байт)")


if __name__ == "__main__":
    main()
