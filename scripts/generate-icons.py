#!/usr/bin/env python3
"""
Gera os ícones do PWA (PNG 192/512, "any" e "maskable"), o ícone SVG e uma
captura de tela SVG usada no manifest.
Não depende de bibliotecas externas: escreve PNG (zlib + CRC) manualmente.
Uso: python3 scripts/generate-icons.py
"""
import math
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, "frontend", "public", "icons")
os.makedirs(ICON_DIR, exist_ok=True)

# Paleta do app
BG_TOP = (17, 24, 49)        # #111831
BG_BOTTOM = (8, 12, 28)      # #080c1c
GOLD = (212, 175, 55)        # #d4af37
GOLD_SOFT = (240, 214, 130)
PARCHMENT = (245, 240, 230)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_icon(size, maskable=False):
    """Desenha o ícone: livro aberto com chama/estrela e a letra D estilizada."""
    px = [[(0, 0, 0, 0)] * size for _ in range(size)]
    pad = int(size * (0.14 if maskable else 0.06))
    inner = size - 2 * pad
    cx = cy = size / 2
    radius = inner * 0.5

    for y in range(size):
        for x in range(size):
            # fundo com gradiente vertical + cantos arredondados
            t = y / max(1, size - 1)
            color = lerp(BG_TOP, BG_BOTTOM, t)
            alpha = 255
            if not maskable:
                corner = size * 0.22
                dx = max(corner - x, x - (size - corner), 0)
                dy = max(corner - y, y - (size - corner), 0)
                if dx and dy and math.hypot(dx, dy) > corner:
                    alpha = 0
            px[y][x] = (*color, alpha)

    def put(x, y, color, alpha=255):
        if 0 <= x < size and 0 <= y < size and alpha > 0:
            r, g, b, a = px[y][x]
            t = alpha / 255
            px[y][x] = (
                int(r * (1 - t) + color[0] * t),
                int(g * (1 - t) + color[1] * t),
                int(b * (1 - t) + color[2] * t),
                max(a, alpha),
            )

    def circle(ccx, ccy, r, color, alpha=255):
        for y in range(max(0, int(ccy - r - 1)), min(size, int(ccy + r + 2))):
            for x in range(max(0, int(ccx - r - 1)), min(size, int(ccx + r + 2))):
                d = math.hypot(x + 0.5 - ccx, y + 0.5 - ccy)
                if d <= r:
                    edge = max(0.0, min(1.0, r - d + 0.5))
                    put(x, y, color, int(alpha * edge))

    def rect(x0, y0, x1, y1, color, alpha=255):
        for y in range(max(0, int(y0)), min(size, int(y1) + 1)):
            for x in range(max(0, int(x0)), min(size, int(x1) + 1)):
                put(x, y, color, alpha)

    # círculo dourado de fundo (auréola)
    circle(cx, cy, radius, (26, 34, 66), 255)
    for r_step in range(0, max(1, int(size * 0.012))):
        rr = radius - r_step
        for y in range(max(0, int(cy - rr - 1)), min(size, int(cy + rr + 2))):
            for x in range(max(0, int(cx - rr - 1)), min(size, int(cx + rr + 2))):
                d = abs(math.hypot(x + 0.5 - cx, y + 0.5 - cy) - rr)
                if d < 0.9:
                    put(x, y, GOLD, int(200 * (1 - d)))

    # livro aberto: duas páginas em forma de trapézio
    page_h = inner * 0.34
    page_w = inner * 0.36
    top = cy + inner * 0.02
    for i in range(int(page_h)):
        yy = int(top + i)
        spread = page_w * (0.72 + 0.28 * (i / page_h))
        thickness = max(1, int(size * 0.008))
        # página esquerda
        rect(cx - spread, yy, cx - thickness, yy + thickness, PARCHMENT, 235)
        # página direita
        rect(cx + thickness, yy, cx + spread, yy + thickness, PARCHMENT, 210)
    # lombada
    rect(cx - thickness, int(top), cx + thickness, int(top + page_h), GOLD_SOFT, 255)

    # "chama"/estrela acima do livro
    star_cy = cy - inner * 0.20
    star_r = inner * 0.17
    for y in range(int(star_cy - star_r * 1.4), int(star_cy + star_r * 1.4)):
        for x in range(int(cx - star_r), int(cx + star_r)):
            dy = (y - star_cy) / star_r
            dx = (x - cx) / star_r
            if abs(dx) + abs(dy) * 0.85 <= 1:
                put(x, y, GOLD, 255)
            d = math.hypot(dx, dy)
            if d <= 0.34:
                put(x, y, PARCHMENT, 255)

    return px


def write_png(path, pixels):
    size = len(pixels)
    raw = bytearray()
    for row in pixels:
        raw.append(0)  # filtro "none"
        for r, g, b, a in row:
            raw.extend((r & 255, g & 255, b & 255, a & 255))

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as handle:
        handle.write(png)
    print(f"  ✓ {os.path.relpath(path, ROOT)}")


SVG_ICON = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#111831"/>
      <stop offset="100%" stop-color="#080c1c"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f0d682"/>
      <stop offset="100%" stop-color="#d4af37"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="188" fill="#1a2242" stroke="url(#gold)" stroke-width="8"/>
  <path d="M256 96l26 62 66 8-48 46 12 66-56-32-56 32 12-66-48-46 66-8z" fill="url(#gold)"/>
  <path d="M120 300c46-22 92-22 136 0v96c-44-22-90-22-136 0z" fill="#f5f0e6" opacity="0.95"/>
  <path d="M392 300c-46-22-92-22-136 0v96c44-22 90-22 136 0z" fill="#e6ddc8" opacity="0.9"/>
  <rect x="250" y="296" width="12" height="104" rx="6" fill="url(#gold)"/>
</svg>
"""

SCREENSHOT = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
  <defs>
    <linearGradient id="bgg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#111831"/><stop offset="100%" stop-color="#070b18"/>
    </linearGradient>
    <linearGradient id="gd" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#d4af37"/><stop offset="100%" stop-color="#f0d682"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bgg)"/>
  <text x="540" y="430" font-family="Georgia, serif" font-size="120" fill="url(#gd)" text-anchor="middle">QUIZ BÍBLICO</text>
  <text x="540" y="600" font-family="Georgia, serif" font-size="180" fill="#f5f0e6" text-anchor="middle">PROFETAS MENORES</text>
  <text x="540" y="700" font-family="Arial, sans-serif" font-size="42" fill="#c9d2f0" text-anchor="middle">Teste seus conhecimentos sobre os 12 Profetas Menores</text>
  <g font-family="Arial, sans-serif" font-size="38" fill="#f5f0e6" text-anchor="middle">
    <rect x="90" y="800" width="420" height="180" rx="28" fill="#151c36" stroke="#26304f"/>
    <text x="300" y="880">👥 Jogadores</text><text x="300" y="940" font-size="52" fill="#f0d682">128</text>
    <rect x="570" y="800" width="420" height="180" rx="28" fill="#151c36" stroke="#26304f"/>
    <text x="780" y="880">🎮 Partidas</text><text x="780" y="940" font-size="52" fill="#f0d682">412</text>
    <rect x="90" y="1010" width="420" height="180" rx="28" fill="#151c36" stroke="#26304f"/>
    <text x="300" y="1090">🏆 Maior pontuação</text><text x="300" y="1150" font-size="52" fill="#f0d682">4.500</text>
    <rect x="570" y="1010" width="420" height="180" rx="28" fill="#151c36" stroke="#26304f"/>
    <text x="780" y="1090">📊 Melhor %</text><text x="780" y="1150" font-size="52" fill="#f0d682">100%</text>
  </g>
  <rect x="90" y="1290" width="900" height="150" rx="32" fill="url(#gd)"/>
  <text x="540" y="1385" font-family="Arial, sans-serif" font-size="52" font-weight="bold" fill="#141a30" text-anchor="middle">ENTRAR NO QUIZ</text>
  <g font-family="Arial, sans-serif" font-size="40" fill="#f5f0e6" text-anchor="middle">
    <rect x="90" y="1480" width="280" height="120" rx="26" fill="#151c36" stroke="#26304f"/><text x="230" y="1555">RANKING</text>
    <rect x="400" y="1480" width="280" height="120" rx="26" fill="#151c36" stroke="#26304f"/><text x="540" y="1555">HISTÓRICO</text>
    <rect x="710" y="1480" width="280" height="120" rx="26" fill="#151c36" stroke="#26304f"/><text x="850" y="1555">STATUS</text>
  </g>
</svg>
"""


def main():
    print("Gerando ícones do PWA…")
    with open(os.path.join(ICON_DIR, "icon.svg"), "w", encoding="utf-8") as fh:
        fh.write(SVG_ICON)
    print(f"  ✓ frontend/public/icons/icon.svg")
    with open(os.path.join(ICON_DIR, "screenshot.svg"), "w", encoding="utf-8") as fh:
        fh.write(SCREENSHOT)
    print(f"  ✓ frontend/public/icons/screenshot.svg")

    for size in (192, 512):
        write_png(os.path.join(ICON_DIR, f"icon-{size}.png"), draw_icon(size, maskable=False))
        write_png(os.path.join(ICON_DIR, f"maskable-{size}.png"), draw_icon(size, maskable=True))
    print("Concluído.")


if __name__ == "__main__":
    main()
