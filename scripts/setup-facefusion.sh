#!/bin/bash

# Target directory
TARGET_DIR="$HOME/.meme-swap/facefusion"
VENV_PATH="$TARGET_DIR/venv"

# 1. Check: if the directory and virtual environment already exist, skip setup
if [ -d "$VENV_PATH" ]; then
    echo "ℹ️  FaceFusion is already installed at $TARGET_DIR. Skipping setup."
else
    echo "🚀 First-time FaceFusion setup at $TARGET_DIR (this may take a few minutes)..."

    # 2. Create directory and clone the repository
    mkdir -p "$HOME/.meme-swap"
    cd "$HOME/.meme-swap"
    if [ ! -d "facefusion" ]; then
        git clone https://github.com/facefusion/facefusion.git
    fi

    cd facefusion

    # 3. Set up the Python virtual environment
    python3 -m venv venv
    source venv/bin/activate

    # 4. Install dependencies
    pip install --upgrade pip
    pip install -r requirements.txt
    pip install onnxruntime-silicon
fi

# 5. Copy ffmpeg and ffprobe into ~/.meme-swap/bin if available on the system
echo "Checking and copying ffmpeg/ffprobe to ~/.meme-swap/bin..."
BIN_DIR="$HOME/.meme-swap/bin"
mkdir -p "$BIN_DIR"

FFMPEG_PATH=$(which ffmpeg)
FFPROBE_PATH=$(which ffprobe)

if [ ! -z "$FFMPEG_PATH" ] && [ -f "$FFMPEG_PATH" ]; then
    echo "Copying ffmpeg from $FFMPEG_PATH to $BIN_DIR"
    cp "$FFMPEG_PATH" "$BIN_DIR/"
    chmod +x "$BIN_DIR/ffmpeg"
fi

if [ ! -z "$FFPROBE_PATH" ] && [ -f "$FFPROBE_PATH" ]; then
    echo "Copying ffprobe from $FFPROBE_PATH to $BIN_DIR"
    cp "$FFPROBE_PATH" "$BIN_DIR/"
    chmod +x "$BIN_DIR/ffprobe"
fi

echo "✅ Setup complete!"
