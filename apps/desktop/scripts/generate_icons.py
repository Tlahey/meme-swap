#!/usr/bin/env python3
import os
import sys
import subprocess
import shutil
from PIL import Image, ImageDraw

def process_icons(source_path):
    desktop_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assets_dir = os.path.join(desktop_dir, "assets")
    src_assets_dir = os.path.join(desktop_dir, "src", "assets")
    
    # Ensure directories exist
    os.makedirs(assets_dir, exist_ok=True)
    os.makedirs(src_assets_dir, exist_ok=True)
    
    print(f"Loading source image from {source_path}")
    img = Image.open(source_path)
    width, height = img.size
    
    # 1. Dynamically locate the squircle and the logo inside it
    cy = height // 2
    left_edge = 186
    right_edge = 848
    for x in range(width):
        r, g, b = img.getpixel((x, cy))[:3]
        if r < 32 and g < 35 and b < 40:
            left_edge = x
            break
    for x in range(width - 1, -1, -1):
        r, g, b = img.getpixel((x, cy))[:3]
        if r < 32 and g < 35 and b < 40:
            right_edge = x
            break
            
    sq_size = right_edge - left_edge
    top_edge = height // 2 - sq_size // 2
    bottom_edge = top_edge + sq_size
    
    print(f"Detected squircle: left={left_edge}, right={right_edge}, top={top_edge}, bottom={bottom_edge} (size {sq_size}x{sq_size})")
    
    # Find bounding box of white logo (brightness > 150)
    logo_left = width
    logo_right = 0
    logo_top = height
    logo_bottom = 0
    for y in range(height):
        for x in range(width):
            r, g, b = img.getpixel((x, y))[:3]
            val = max(r, g, b)
            if val > 150:
                if x < logo_left: logo_left = x
                if x > logo_right: logo_right = x
                if y < logo_top: logo_top = y
                if y > logo_bottom: logo_bottom = y
                
    print(f"Detected white logo: left={logo_left}, right={logo_right}, top={logo_top}, bottom={logo_bottom} (size {logo_right-logo_left}x{logo_bottom-logo_top})")
    
    # 2. Extract the white logo with transparent background
    logo_crop = img.crop((logo_left, logo_top, logo_right, logo_bottom)).convert("RGBA")
    w_logo, h_logo = logo_crop.size
    
    transparent_logo = Image.new("RGBA", (w_logo, h_logo), (0, 0, 0, 0))
    logo_pixels = logo_crop.load()
    trans_pixels = transparent_logo.load()
    
    for y in range(h_logo):
        for x in range(w_logo):
            r, g, b, a = logo_pixels[x, y]
            val = max(r, g, b)
            if val <= 80:
                alpha = 0
            elif val >= 180:
                alpha = 255
            else:
                alpha = int((val - 80) * 255 / (180 - 80))
            trans_pixels[x, y] = (255, 255, 255, alpha)
            
    # 3. Create a perfect gradient squircle of size 824x824 from scratch
    # (Leaving 100px padding on all sides in a 1024x1024 canvas according to macOS design guidelines)
    squircle_size = 824
    clean_squircle = Image.new("RGBA", (squircle_size, squircle_size))
    clean_pixels = clean_squircle.load()
    
    for y in range(squircle_size):
        t = y / (squircle_size - 1)
        bg_r = int(27 * (1 - t) + 18 * t)
        bg_g = int(30 * (1 - t) + 19 * t)
        bg_b = int(37 * (1 - t) + 23 * t)
        
        for x in range(squircle_size):
            clean_pixels[x, y] = (bg_r, bg_g, bg_b, 255)
            
    # Apply a beautiful smooth rounded corner mask to the squircle
    mask = Image.new("L", (squircle_size, squircle_size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, squircle_size, squircle_size), radius=176, fill=255)
    clean_squircle.putalpha(mask)
    
    # 4. Resize logo to be larger (occupying 78% of squircle width)
    new_w_logo = int(squircle_size * 0.78)
    new_h_logo = int(new_w_logo * h_logo / w_logo)
    logo_resized = transparent_logo.resize((new_w_logo, new_h_logo), Image.Resampling.LANCZOS)
    
    # Paste the logo centered onto the squircle
    x_offset = (squircle_size - new_w_logo) // 2
    y_offset = (squircle_size - new_h_logo) // 2
    clean_squircle.paste(logo_resized, (x_offset, y_offset), logo_resized)
    
    # 5. Create final 1024x1024 canvas and center the squircle
    final_canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    sq_offset = (1024 - squircle_size) // 2
    final_canvas.paste(clean_squircle, (sq_offset, sq_offset), clean_squircle)
    
    # Save standard icon.png in assets
    icon_png_path = os.path.join(assets_dir, "icon.png")
    final_canvas.save(icon_png_path, "PNG")
    print(f"Saved zoomed & cleaned app icon at {icon_png_path}")
    
    # 6. Generate macOS .icns using iconutil
    iconset_dir = os.path.join(assets_dir, "icon.iconset")
    os.makedirs(iconset_dir, exist_ok=True)
    
    sizes = [
        (16, "icon_16x16.png"),
        (32, "icon_16x16@2x.png"),
        (32, "icon_32x32.png"),
        (64, "icon_32x32@2x.png"),
        (128, "icon_128x128.png"),
        (256, "icon_128x128@2x.png"),
        (256, "icon_256x256.png"),
        (512, "icon_256x256@2x.png"),
        (512, "icon_512x512.png"),
        (1024, "icon_512x512@2x.png"),
    ]
    
    print("Generating resolutions for iconset...")
    for size, name in sizes:
        resized = final_canvas.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(os.path.join(iconset_dir, name), "PNG")
        
    print("Converting iconset to icon.icns...")
    try:
        subprocess.run(["iconutil", "-c", "icns", iconset_dir], check=True)
        print("Successfully generated icon.icns")
    except Exception as e:
        print(f"Error calling iconutil: {e}")
        
    # Clean up iconset directory
    shutil.rmtree(iconset_dir)
    
    # 7. Create transparent tray icons
    print("Generating transparent tray icons...")
    # Crop to active bounding box
    bbox = transparent_logo.getbbox()
    if bbox:
        cropped_img = transparent_logo.crop(bbox)
        w_c, h_c = cropped_img.size
        
        # Determine the square container size with about 8% padding
        side = max(w_c, h_c)
        padding = int(side * 0.08)
        new_size = side + 2 * padding
        
        square_img = Image.new("RGBA", (new_size, new_size), (0, 0, 0, 0))
        # Paste centered
        x_offset = padding + (side - w_c) // 2
        y_offset = padding + (side - h_c) // 2
        square_img.paste(cropped_img, (x_offset, y_offset))
        transparent_img = square_img
    else:
        transparent_img = transparent_logo

    # Save tray icons in src/assets
    # Standard menu bar sizes: 16x16 and 32x32 (@2x retina)
    transparent_img.resize((16, 16), Image.Resampling.LANCZOS).save(
        os.path.join(src_assets_dir, "tray_icon.png"), "PNG"
    )
    transparent_img.resize((32, 32), Image.Resampling.LANCZOS).save(
        os.path.join(src_assets_dir, "tray_icon@2x.png"), "PNG"
    )
    
    # Template versions
    transparent_img.resize((16, 16), Image.Resampling.LANCZOS).save(
        os.path.join(src_assets_dir, "tray_iconTemplate.png"), "PNG"
    )
    transparent_img.resize((32, 32), Image.Resampling.LANCZOS).save(
        os.path.join(src_assets_dir, "tray_iconTemplate@2x.png"), "PNG"
    )
    
    # Also save as icon_placeholder.png to overwrite the placeholder in the main src directory
    transparent_img.resize((16, 16), Image.Resampling.LANCZOS).save(
        os.path.join(desktop_dir, "src", "icon_placeholder.png"), "PNG"
    )
    
    print("Tray icons generated successfully in src/assets/ and src/icon_placeholder.png")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 generate_icons.py <path_to_source_png>")
        sys.exit(1)
    process_icons(sys.argv[1])
