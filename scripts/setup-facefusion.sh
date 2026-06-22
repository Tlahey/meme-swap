#!/bin/bash

# Dossier cible
TARGET_DIR="vendor/facefusion"
VENV_PATH="$TARGET_DIR/venv"

# 1. Vérification : Si le dossier ET l'environnement virtuel existent déjà
if [ -d "$VENV_PATH" ]; then
    echo "ℹ️ FaceFusion est déjà installé dans $TARGET_DIR. On passe l'étape."
    exit 0
fi

echo "🚀 Première installation de FaceFusion (cela peut prendre quelques minutes)..."

# 2. Création du dossier et Clone
mkdir -p vendor
cd vendor
if [ ! -d "facefusion" ]; then
    git clone https://github.com/facefusion/facefusion.git
fi

cd facefusion

# 3. Setup de l'environnement Python
python3 -m venv venv
source venv/bin/activate

# 4. Installation des dépendances
pip install --upgrade pip
pip install -r requirements.txt
pip install onnxruntime-silicon

echo "✅ Installation terminée avec succès !"
