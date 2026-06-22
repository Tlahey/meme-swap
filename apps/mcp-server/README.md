# MCP Server

MCP (Model Context Protocol) Server pour les opérations de face swap dans meme-swap.

## 🚀 Fonctionnalités

- Intégration avec FaceFusion pour le face swap
- Support des images et vidéos (GIF, MP4)
- Conversion automatique GIF ↔ MP4
- Nettoyage automatique des fichiers temporaires
- Transport HTTP/SSE pour le mode daemon

## 📦 Installation

```bash
# Installer les dépendances
cd apps/mcp-server
pnpm install

# Build du projet
pnpm build
```

## 🔧 Configuration

### Variables d'environnement

```bash
PORT=3001  # Port du serveur (défaut: 3001)
```

### Mode développement

```bash
pnpm dev
```

### Mode production

```bash
pnpm build
pnpm start
```

### Avec PM2

```bash
# Installer PM2 globalement
npm install -g pm2

# Démarrer le serveur
pm2 start ecosystem.config.js

# Voir les logs
pm2 logs mcp-server

# Arrêter le serveur
pm2 stop mcp-server
```

## 📡 Utilisation

### Transport HTTP (Daemon Mode)

Le serveur écoute sur `http://localhost:3001` et expose les endpoints suivants:

- `GET /mcp` - Endpoint SSE pour les connexions MCP
- `POST /message` - Endpoint pour les messages MCP
- `GET /health` - Health check

### Exemple de configuration MCP

Dans votre fichier de configuration MCP (ex: `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "meme-swap": {
      "command": "node",
      "args": ["/Users/antoine/Workspace/meme-swap/apps/mcp-server/build/index.js"],
      "env": {
        "PORT": "3001"
      }
    }
  }
}
```

### Outil disponible

#### `run_faceswap`

Effectue un face swap sur une image ou vidéo.

**Paramètres:**

```json
{
  "sourceImagePath": "/chemin/vers/image_source.jpg",
  "targetMediaPath": "/chemin/vers/video_target.gif",
  "outputPath": "/chemin/vers/output.mp4",
  "executionProviders": ["coreml", "cpu"],
  "threadCount": 4
}
```

**Exemple:**

```
run_faceswap({
  sourceImagePath: "./public/test-images/face.jpg",
  targetMediaPath: "./public/test-images/target.gif",
  outputPath: "./results/output.mp4"
})
```

## 🧪 Tests

```bash
# Tester le health check
curl http://localhost:3001/health

# Tester l'endpoint MCP
curl http://localhost:3001/mcp
```

## 📝 Logs

Les logs sont stockés dans:

- `./logs/mcp-server-out.log` - Logs standard
- `./logs/mcp-server-error.log` - Logs d'erreurs

## 🔒 Sécurité

Le serveur est configuré pour:

- Écouter uniquement sur `127.0.0.1` (localhost)
- Ne pas exposer d'authentification (sécurisé par la localisation)
- Nettoyer automatiquement les fichiers temporaires

## 🐛 Dépannage

### Le serveur ne démarre pas

```bash
# Vérifier les logs
pm2 logs mcp-server

# Vérifier si le port est utilisé
lsof -i :3001

# Redémarrer avec PM2
pm2 restart mcp-server
```

### FaceFusion ne fonctionne pas

```bash
# Vérifier l'installation de FaceFusion
cd vendor/facefusion
./venv/bin/python3 facefusion.py --version

# Réinstaller les dépendances Python
./venv/bin/pip install -r requirements.txt
```

## 📄 License

Ce projet fait partie de meme-swap. Voir le fichier LICENSE pour les détails.
