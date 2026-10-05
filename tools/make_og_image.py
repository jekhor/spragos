#!/usr/bin/env python3
"""Генерирует картинку предпросмотра для соцсетей и мессенджеров: web/og-image.png (1200×630).

Запуск: python3 tools/make_og_image.py   (нужны Pillow и шрифт Noto Sans)
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "og-image.png"
FONTS = Path("/usr/share/fonts/truetype/noto")

W, H = 1200, 630
BG = "#f6f4ef"
TEXT = "#1f2328"
MUTED = "#6b6f76"
ACCENT = "#b8860b"
ACCENT_STRONG = "#946c00"
SURFACE = "#ffffff"
BORDER = "#e0ddd5"
CHIP_BG = "#fff8e6"
CHIP_BORDER = "#e4c46a"
GAP_BG = "#f1efe9"


def font(name, size):
    return ImageFont.truetype(str(FONTS / f"NotoSans-{name}.ttf"), size)


def main():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    x0 = 80

    # Подзаголовок, название и пояснение
    d.text((x0, 70), "МИНИ-ТРЕНАЖЁР ЛИТОВСКОЙ ГРАММАТИКИ", font=font("SemiBold", 26), fill=MUTED)
    title = font("Bold", 120)
    d.text((x0, 105), "Spra", font=title, fill=TEXT)
    d.text((x0 + d.textlength("Spra", font=title), 105), "gos", font=title, fill=ACCENT_STRONG)
    d.text((x0, 265), "Вставьте слово в правильной форме", font=font("Regular", 36), fill=TEXT)

    # Карточка с примером: предложение с пропуском и плашки
    card = (x0, 340, W - x0, 560)
    d.rounded_rectangle(card, radius=22, fill=SURFACE, outline=BORDER, width=2)
    sent = font("Regular", 40)
    y = 368
    x = x0 + 40
    d.text((x, y), "Tai mano brolis. Aš", font=sent, fill=TEXT)
    x += d.textlength("Tai mano brolis. Aš", font=sent) + 16
    gap_w = 120
    d.rounded_rectangle((x, y - 2, x + gap_w, y + 54), radius=12, fill=GAP_BG, outline=ACCENT, width=3)
    d.text((x + gap_w / 2, y + 60), "jis", font=font("Regular", 22), fill=MUTED, anchor="mt")
    x += gap_w + 16
    d.text((x, y), "matau.", font=sent, fill=TEXT)

    chip = font("SemiBold", 34)
    cx = x0 + 40
    for word in ("jį", "jam", "jo", "juo"):
        w = d.textlength(word, font=chip) + 48
        d.rounded_rectangle((cx, 482, cx + w, 536), radius=12, fill=CHIP_BG, outline=CHIP_BORDER, width=2)
        d.text((cx + w / 2, 509), word, font=chip, fill=TEXT, anchor="mm")
        cx += w + 18

    d.text((x0, 578), "местоимения · числительные · прилагательные", font=font("Regular", 28), fill=MUTED)
    img.save(OUT, optimize=True)
    print(f"{OUT} ({OUT.stat().st_size // 1024} КБ)")


if __name__ == "__main__":
    main()
