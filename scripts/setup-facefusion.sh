#!/bin/bash

# Target directory
TARGET_DIR="$HOME/.meme-swap/facefusion"
VENV_PATH="$TARGET_DIR/venv"

# 0. Homebrew is required: it installs ffmpeg and keeps its binary and shared
# libraries in sync on every `brew upgrade`, so ffmpeg is resolved from
# Homebrew's own bin dirs at runtime instead of a copy that would go stale.
if ! command -v brew &> /dev/null; then
    echo "❌ Homebrew is required but was not found. Install it from https://brew.sh, then re-run this script."
    exit 1
fi

if brew list ffmpeg &> /dev/null; then
    echo "ℹ️  ffmpeg is already installed via Homebrew."
else
    echo "🚀 Installing ffmpeg via Homebrew..."
    brew install ffmpeg
fi

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

echo "✅ Setup complete!"
