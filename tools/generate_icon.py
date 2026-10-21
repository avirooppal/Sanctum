from PIL import Image, ImageDraw
import os

def generate_sanctum_icon(output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    sizes = [16, 32, 48, 64, 128, 256]
    images = []

    for size in sizes:
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Draw rounded dark shield / rounded rect base
        margin = max(1, size // 16)
        r = max(2, size // 6)
        draw.rounded_rectangle(
            [(margin, margin), (size - margin, size - margin)],
            radius=r,
            fill=(18, 18, 20, 255),
            outline=(45, 45, 50, 255),
            width=max(1, size // 32)
        )

        # Draw geometric inner sanctuary / diamond portal
        cx, cy = size // 2, size // 2
        d = max(3, size // 3)
        diamond_points = [
            (cx, cy - d),
            (cx + d, cy),
            (cx, cy + d),
            (cx - d, cy)
        ]
        # Terracotta primary color: #C2613C (194, 97, 60)
        draw.polygon(diamond_points, fill=(194, 97, 60, 255))

        # Inner core point
        inner_d = max(1, d // 3)
        draw.ellipse(
            [(cx - inner_d, cy - inner_d), (cx + inner_d, cy + inner_d)],
            fill=(244, 244, 245, 255)
        )

        images.append(img)

    # Save highest resolution PNG
    png_path = os.path.join(output_dir, "app-icon.png")
    images[-1].save(png_path, format="PNG")

    # Save multi-resolution ICO
    ico_path = os.path.join(output_dir, "app-icon.ico")
    images[-1].save(ico_path, format="ICO", sizes=[(s, s) for s in sizes])
    print(f"Generated {png_path} and {ico_path}")

if __name__ == "__main__":
    generate_sanctum_icon("deploy/installer")
