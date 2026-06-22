#!/usr/bin/env python3
import os
import sys
import subprocess
import shutil
from PIL import Image

def process_icons(source_path):
    desktop_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assets_dir = os.path.join(desktop_dir, "assets")
    src_assets_dir = os.path.join(desktop_dir, "src", "assets")
    
    # Ensure directories exist
    os.makedirs(assets_dir, exist_ok=True)
    os.makedirs(src_assets_dir, exist_ok=True)
    
    print(f"Loading source image from {source_path}")
    img = Image.open(source_path)
    
    # 1. Save standard icon.png in assets
    icon_png_path = os.path.join(assets_dir, "icon.png")
    img.resize((1024, 1024), Image.Resampling.LANCZOS).save(icon_png_path, "PNG")
    print(f"Saved {icon_png_path}")
    
    # 2. Generate macOS .icns using iconutil
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
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(os.path.join(iconset_dir, name), "PNG")
        
    print("Converting iconset to icon.icns...")
    try:
        subprocess.run(["iconutil", "-c", "icns", iconset_dir], check=True)
        print("Successfully generated icon.icns")
    except Exception as e:
        print(f"Error calling iconutil: {e}")
        
    # Clean up iconset directory
    shutil.rmtree(iconset_dir)
    
    # 3. Create transparent tray icons
    # To make a clean transparent tray icon, we look for pixels that are bright (our glowing elements)
    # and map their brightness to the alpha channel.
    print("Generating transparent tray icons...")
    rgba_img = img.convert("RGBA")
    pixels = rgba_img.load()
    width, height = rgba_img.size
    
    # Create transparent image
    transparent_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    trans_pixels = transparent_img.load()
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            brightness = max(r, g, b)
            
            # The background is dark gray/black (brightness < 60)
            if brightness < 60:
                # Fully transparent
                trans_pixels[x, y] = (0, 0, 0, 0)
            else:
                # Keep pixel and apply smooth transparency gradient for the glow
                alpha = int(min(255, (brightness - 60) * 255 / (255 - 60)))
                # Set as green/emerald colored pixels
                # Since we want it to look beautiful in color, we keep the original green glowing colors
                trans_pixels[x, y] = (r, g, b, alpha)
                
    # Save tray icons in src/assets
    # Standard menu bar sizes: 16x16 and 32x32 (@2x retina)
    transparent_img.resize((16, 16), Image.Resampling.LANCZOS).save(
        os.path.join(src_assets_dir, "tray_icon.png"), "PNG"
    )
    transparent_img.resize((32, 32), Image.Resampling.LANCZOS).save(
        os.path.join(src_assets_dir, "tray_icon@2x.png"), "PNG"
    )
    
    # Also save template version (monochrome white icon with transparency) for native system menu bar look
    template_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    temp_pixels = template_img.load()
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = trans_pixels[x, y]
            if a > 0:
                # Standard template image uses white color (or black, macOS will color it dynamically based on menu bar style)
                # We use white (255, 255, 255) with the extracted alpha channel.
                temp_pixels[x, y] = (255, 255, 255, a)
                
    template_img.resize((16, 16), Image.Resampling.LANCZOS).save(
        os.path.join(src_assets_dir, "tray_iconTemplate.png"), "PNG"
    )
    template_img.resize((32, 32), Image.Resampling.LANCZOS).save(
        os.path.join(src_assets_dir, "tray_iconTemplate@2x.png"), "PNG"
    )
    
    # Also save as icon_placeholder.png to overwrite the placeholder in the main src directory (so fallback works seamlessly)
    transparent_img.resize((16, 16), Image.Resampling.LANCZOS).save(
        os.path.join(desktop_dir, "src", "icon_placeholder.png"), "PNG"
    )
    
    print("Tray icons generated successfully in src/assets/ and src/icon_placeholder.png")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 generate_icons.py <path_to_source_png>")
        sys.exit(1)
    process_icons(sys.argv[1])
