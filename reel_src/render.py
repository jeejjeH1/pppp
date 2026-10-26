"""Render the 9:16 Real Madrid Clasico reel, beat-synced to music.wav (140 BPM)."""
import numpy as np, subprocess, sys, math, os
from multiprocessing import Pool
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = "/root/.claude/uploads/87c4379c-2049-51b6-b958-ed8fe16ba005/22912e60-4_5978776234753008096.mp4"
OUT_SILENT = sys.argv[1]
SW, SH, SFPS = 854, 480, 25
W, H, FPS = 1080, 1920, 30
BEAT = 60 / 140
BAR = BEAT * 4
TOTAL = BAR * 18 + 1.5
NF = int(round(TOTAL * FPS))
FONT_B = "/usr/share/fonts/opentype/inter/InterDisplay-BlackItalic.otf"
FONT_M = "/usr/share/fonts/opentype/inter/InterDisplay-ExtraBoldItalic.otf"
GOLD = (254, 190, 16)
WHITE = (255, 255, 255)

# segments: (out_start, out_end, src_start, src_end, style)
# style: dict(box=fg height, cx, cy (source px), zoom, bw, grade)
B = lambda n: n * BAR
SEGS = [
    (0.0,      B(2),       5.0,   7.9,   dict(box=860, cx=427, cy=240, bw=0.0, dark=0.25)),
    (B(2),     B(4),       8.0,   10.15, dict(box=1250, cx=420, cy=250)),
    (B(4),     B(6),       59.2,  62.9,  dict(box=760, cx=300, cy=230)),
    (B(6),     B(8),       63.0,  66.9,  dict(box=1250, cx=440, cy=250)),
    (B(8),     B(10),      146.0, 149.5, dict(box=1250, cx=430, cy=240, bw=1.0, dark=0.15)),
    (B(10),    B(10)+1.83, 170.0, 172.6, dict(box=900, cx=420, cy=260)),
    (B(10)+1.83, B(12),    172.6, 173.8, dict(box=1000, cx=400, cy=300)),
    (B(12),    B(14),      167.0, 170.0, dict(box=1100, cx=400, cy=270)),
    (B(14),    B(16),      176.9, 179.9, dict(box=1250, cx=430, cy=250)),
    (B(16),    TOTAL,      8.3,   10.15,  dict(box=1250, cx=330, cy=230, bw=0.55, dark=0.1)),
]
CUTS = [s[0] for s in SEGS[1:]]
GOAL_HITS = [B(6), B(12)]              # big shake + flash
DROP_BARS = list(range(4, 8)) + list(range(10, 16))
KICKS = [b * BAR + k * BEAT for b in DROP_BARS for k in (0, 2, 2.5)] + [B(2), B(3), B(16)]

# text events: (t0, t1, text, font, size, y, color)
TEXTS = [
    (0.25, B(2) - 0.05, "EL CLÁSICO", FONT_B, 150, 300, WHITE),
    (0.9,  B(2) - 0.05, "CAMP NOU", FONT_M, 70, 450, GOLD),
    (B(2) + 0.1, B(4) - 0.05, "THE SPECIAL ONE", FONT_B, 112, 230, GOLD),
    (B(2) + 0.9, B(4) - 0.05, "JOSÉ MOURINHO", FONT_M, 66, 360, WHITE),
    (B(4) + 0.05, B(6) - 0.05, "40'", FONT_B, 90, 330, WHITE),
    (B(6) + 0.02, B(8) - 0.05, "MBAPPÉ", FONT_B, 170, 200, WHITE),
    (B(6) + 0.45, B(8) - 0.05, "0 - 1", FONT_B, 120, 1650, GOLD),
    (B(8) + 0.05, B(10) - 0.05, "77'   1 - 1", FONT_M, 70, 230, WHITE),
    (B(8) + 0.9, B(10) - 0.05, "THEY THOUGHT...", FONT_B, 105, 1640, WHITE),
    (B(10) + 0.05, B(12) - 0.05, "88'", FONT_B, 110, 300, WHITE),
    (B(12) + 0.02, B(14) - 0.05, "GOLAZO", FONT_B, 175, 190, GOLD),
    (B(12) + 0.45, B(14) - 0.05, "1 - 2", FONT_B, 130, 1660, WHITE),
    (B(14) + 0.05, B(16) - 0.05, "SILENCIO", FONT_B, 165, 190, WHITE),
    (B(14) + 0.6, B(16) - 0.05, "EN EL CAMP NOU", FONT_M, 72, 1680, GOLD),
    (B(16) + 0.05, TOTAL, "BARÇA 1 - 2 REAL MADRID", FONT_M, 66, 220, WHITE),
    (B(16) + 0.85, TOTAL, "¡HALA MADRID!", FONT_B, 122, 1630, GOLD),
]

FRAMES = {}  # seg index -> np array (n, SH, SW, 3)


def load():
    for i, (o0, o1, s0, s1, st) in enumerate(SEGS):
        dur = s1 - s0 + 0.2
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{s0:.3f}", "-t", f"{dur:.3f}", "-i", SRC,
                              "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
        FRAMES[i] = np.frombuffer(raw, np.uint8).reshape(-1, SH, SW, 3)


_font_cache = {}
def font(path, size):
    k = (path, size)
    if k not in _font_cache:
        _font_cache[k] = ImageFont.truetype(path, size)
    return _font_cache[k]


def src_frame(i, t):
    o0, o1, s0, s1, st = SEGS[i]
    u = (t - o0) / (o1 - o0)
    ts = u * (s1 - s0)
    fr = FRAMES[i]
    x = ts * SFPS
    a = int(math.floor(x)); f = x - a
    a = max(0, min(len(fr) - 1, a)); b = min(len(fr) - 1, a + 1)
    if f < 0.05 or a == b:
        return fr[a]
    return (fr[a] * (1 - f) + fr[b] * f).astype(np.uint8)


def ease_out(x):
    x = max(0.0, min(1.0, x)); return 1 - (1 - x) ** 3


def grade(arr, bw=0.0, dark=0.0):
    a = arr.astype(np.float32) / 255
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    sat = 1.25 * (1 - bw)
    a = lum[..., None] + (a - lum[..., None]) * sat
    a = (a - 0.5) * 1.18 + 0.5          # contrast
    if bw > 0.5:
        a = a * np.array([1.04, 1.0, 0.92], np.float32)  # warm mono
    a = a * (1 - dark)
    return np.clip(a, 0, 1)


def render(fi):
    t = fi / FPS
    i = max(k for k, s in enumerate(SEGS) if s[0] <= t + 1e-6)
    i = min(i, len(SEGS) - 1)
    o0, o1, s0, s1, st = SEGS[i]
    fr = src_frame(i, min(t, o1 - 1e-3))

    # punch-zoom on kicks, slow push within segment
    punch = sum(0.07 * math.exp(-(t - k) * 11) for k in KICKS if 0 <= t - k < 0.5)
    push = 1 + 0.06 * (t - o0) / (o1 - o0)
    zoom = push + punch
    # shake on goals
    shake = sum(math.exp(-(t - g) * 4) for g in GOAL_HITS if 0 <= t - g < 1.2)
    rng = np.random.default_rng(fi)
    dx, dy = (rng.uniform(-1, 1, 2) * 28 * shake) if shake > 0.02 else (0, 0)

    # background: blurred cover
    bg = Image.fromarray(fr).resize((120, 68)).filter(ImageFilter.GaussianBlur(3))
    bh = H; bw_ = int(bh * SW / SH)
    bg = bg.resize((bw_, bh), Image.BILINEAR).crop(((bw_ - W) // 2, 0, (bw_ - W) // 2 + W, H))
    canvas = grade(np.asarray(bg), st.get("bw", 0), 0.55)

    # foreground crop
    boxh = st["box"]
    asp = W / boxh
    ch = SH / zoom
    cw = ch * asp
    if cw > SW:
        cw = SW; ch = cw / asp
    cx = min(max(st["cx"], cw / 2), SW - cw / 2)
    cy = min(max(st["cy"], ch / 2), SH - ch / 2)
    box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
    fg = Image.fromarray(fr).resize((W, boxh), Image.BICUBIC, box=box)
    fga = grade(np.asarray(fg), st.get("bw", 0), st.get("dark", 0))
    y0 = (H - boxh) // 2 + int(dy); x0 = int(dx)
    ys, ye = max(0, y0), min(H, y0 + boxh)
    xs, xe = max(0, x0), min(W, x0 + W)
    canvas[ys:ye, xs:xe] = fga[ys - y0:ye - y0, xs - x0:xe - x0]
    # soft edge shadow lines
    for yy in (ys, ye - 1):
        canvas[max(0, yy - 2):yy + 2] *= 0.3

    # RGB split when shaking / on punches
    split = int(10 * shake + 60 * punch)
    if split > 1:
        canvas[..., 0] = np.roll(canvas[..., 0], split, axis=1)
        canvas[..., 2] = np.roll(canvas[..., 2], -split, axis=1)

    # vignette
    canvas *= VIG

    # flashes on cuts and goals
    fl = 0.0
    for c in CUTS:
        if 0 <= t - c < 0.25:
            fl = max(fl, 0.55 * math.exp(-(t - c) * 14))
    for g in GOAL_HITS:
        if 0 <= t - g < 0.6:
            fl = max(fl, 1.0 * math.exp(-(t - g) * 7))
    if fl > 0.01:
        canvas = canvas + (1 - canvas) * fl
    # fade out at end, fade in at start
    if t > TOTAL - 1.2:
        canvas *= max(0.0, (TOTAL - t) / 1.2)
    if t < 0.35:
        canvas *= t / 0.35

    img = Image.fromarray((np.clip(canvas, 0, 1) * 255).astype(np.uint8))
    draw_texts(img, t)
    return img.tobytes()


def draw_texts(img, t):
    if os.environ.get("NOTEXT"):
        return
    for (t0, t1, txt, fp, size, y, col) in TEXTS:
        if not (t0 <= t < t1):
            continue
        p = ease_out((t - t0) / 0.22)
        scale = 1.35 - 0.35 * p
        alpha = p
        if t > t1 - 0.12:
            alpha *= max(0, (t1 - t) / 0.12)
        if t > TOTAL - 1.2:
            alpha *= max(0.0, (TOTAL - t) / 1.2)
        f = font(fp, max(10, int(size * scale)))
        bbox = f.getbbox(txt)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        pad = 40
        layer = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        d.text((pad - bbox[0], pad - bbox[1]), txt, font=f, fill=col + (255,),
               stroke_width=max(3, size // 22), stroke_fill=(0, 0, 0, 255))
        glow = layer.filter(ImageFilter.GaussianBlur(14))
        ga = np.asarray(glow).copy()
        ga[..., :3] = col
        ga[..., 3] = (ga[..., 3] * 0.55).astype(np.uint8)
        glow = Image.fromarray(ga)
        comp = Image.alpha_composite(glow, layer)
        if alpha < 1:
            a = np.asarray(comp).copy(); a[..., 3] = (a[..., 3] * alpha).astype(np.uint8)
            comp = Image.fromarray(a)
        x = (W - comp.width) // 2
        yy = y - comp.height // 2 + int(th * 0)
        img.paste(comp, (x, yy), comp)


yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
r = np.sqrt(((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H / 2) / (H * 0.75)) ** 2)
VIG = np.clip(1.15 - r * 0.55, 0.45, 1.0)[..., None].astype(np.float32)

if __name__ == "__main__":
    load()
    only = os.environ.get("ONLY")
    if only:  # preview stills
        for fi in map(int, only.split(",")):
            Image.frombytes("RGB", (W, H), render(fi)).save(f"prev_{fi}.jpg", quality=85)
        sys.exit()
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                           "-pix_fmt", "yuv420p", OUT_SILENT], stdin=subprocess.PIPE)
    with Pool(4) as pool:
        for k, b in enumerate(pool.imap(render, range(NF), chunksize=4)):
            ff.stdin.write(b)
            if k % 100 == 0:
                print(k, "/", NF, flush=True)
    ff.stdin.close(); ff.wait()
    print("done")
