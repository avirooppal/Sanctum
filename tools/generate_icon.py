"""
Generate comprehensive icon suite for Sanctum directly from owner-provided Beta.jpg.
Strictly preserves artwork without redrawing or AI-altering.
"""
from PIL import Image
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_JPG = os.path.join(ROOT, "Beta.jpg")
DEPLOY_DIR = os.path.join(ROOT, "deploy", "installer")
PUBLIC_DIR = os.path.join(ROOT, "public")
ICONS_DIR = os.path.join(ROOT, "assets", "icons")

def generate_all_icons():
    os.makedirs(DEPLOY_DIR, exist_ok=True)
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    os.makedirs(ICONS_DIR, exist_ok=True)

    if not os.path.exists(SRC_JPG):
        raise FileNotFoundError(f"Missing source artwork: {SRC_JPG}")

    src_im = Image.open(SRC_JPG)
    print(f"Loaded {SRC_JPG}: format={src_im.format}, size={src_im.size}, mode={src_im.mode}")

    # Generate multi-resolution PNGs (16, 24, 32, 48, 64, 128, 256, 512, 1024)
    png_sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
    resized_images = {}
    for sz in png_sizes:
        resized = src_im.resize((sz, sz), Image.Resampling.LANCZOS)
        out_png = os.path.join(ICONS_DIR, f"icon-{sz}.png")
        resized.save(out_png, format="PNG", optimize=True)
        resized_images[sz] = resized

    # Master PNG for shell and web
    master_png = os.path.join(DEPLOY_DIR, "app-icon.png")
    resized_images[256].save(master_png, format="PNG", optimize=True)

    # Web public directory assets
    resized_images[256].save(os.path.join(PUBLIC_DIR, "mascot.jpg"), format="JPEG", quality=95)
    resized_images[256].save(os.path.join(PUBLIC_DIR, "beta.jpg"), format="JPEG", quality=95)
    resized_images[256].save(os.path.join(PUBLIC_DIR, "logo.jpg"), format="JPEG", quality=95)
    resized_images[64].save(os.path.join(PUBLIC_DIR, "favicon.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

    # Multi-resolution Windows ICO (16, 24, 32, 48, 64, 128, 256)
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    ico_path = os.path.join(DEPLOY_DIR, "app-icon.ico")
    src_im.save(ico_path, format="ICO", sizes=ico_sizes)
    print(f"Generated Windows ICO: {ico_path} ({os.path.getsize(ico_path)} bytes)")

    # Contact sheet verification image
    cs_width = 800
    cs_height = 200
    contact_sheet = Image.new("RGBA", (cs_width, cs_height), (24, 24, 27, 255))
    x_offset = 20
    for sz in [16, 24, 32, 48, 64, 128]:
        im_sz = resized_images[sz]
        y_offset = (cs_height - sz) // 2
        contact_sheet.paste(im_sz, (x_offset, y_offset))
        x_offset += sz + 25

    cs_path = os.path.join(ICONS_DIR, "contact_sheet.png")
    contact_sheet.save(cs_path, format="PNG")
    print(f"Generated contact sheet: {cs_path}")

if __name__ == "__main__":
    generate_all_icons()
