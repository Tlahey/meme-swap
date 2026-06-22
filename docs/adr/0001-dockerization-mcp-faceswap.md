# ADR 0001: Choix d'architecture pour la portabilité de FaceFusion et du serveur MCP sur macOS

* **Statut** : Proposé
* **Auteur** : Antigravity (AI Agent)
* **Date** : 2026-06-22
* **Décision demandée par** : USER (Antoine)

---

## 1. Contexte et Problématique

L'application **meme-swap** utilise le moteur Python **FaceFusion** (dossier utilisateur `~/.meme-swap/facefusion`) pour effectuer du faceswap haute performance. Pour fonctionner sur macOS, elle nécessite :
1. **Python 3.11** avec les dépendances spécifiées dans `requirements.txt`.
2. Le binaire d'exécution ONNX adapté à l'architecture Apple Silicon (`onnxruntime-silicon`).
3. **FFmpeg** installé sur le système hôte pour les conversions GIF ↔ MP4.
4. Le serveur MCP (`apps/mcp-server`) exécuté via Node.js pour exposer les outils de faceswap.

### Nouveaux pré-requis de l'utilisateur :
* **Visibilité en temps réel** : Pouvoir suivre l'état d'exécution de l'application (serveur MCP et frontend) à tout moment.
* **Non-pollution active** : Lancer l'application facilement, mais s'assurer que lorsqu'on la quitte, tous les processus d'arrière-plan (Node.js, Express, FaceFusion) s'éteignent proprement sans laisser de processus fantômes ou orphelins.
* **Packaging unifié et léger** : Distribuer l'ensemble sous la forme d'un bundle d'application macOS unique (`.app`) léger pour simplifier le déploiement sur d'autres Macs.

---

## 2. Options de Solution Envisagées

### Option 1 : Service macOS Natif (Launch Agent) + Installateur Automatisé
* **Description** : Un script shell automatise l'installation système. Le serveur MCP tourne via un Launch Agent (`plist`) en tâche de fond au démarrage du système.
* **Limites par rapport aux nouveaux besoins** :
  * Difficile de suivre l'état en temps réel sans ouvrir un terminal pour lire les logs.
  * Pas de notion d'arrêt propre en "quittant" une application graphique (il faut lancer des commandes en terminal comme `pnpm run service:stop`).
  * Les composants ne sont pas packagés dans un bundle `.app` unique.

### Option 2 : Docker-Compose avec Démarrage Automatique (CPU Uniquement)
* **Description** : Exécution via Docker avec redémarrage automatique.
* **Limites par rapport aux nouveaux besoins** :
  * Pas d'accélération CoreML (CPU uniquement, 10x à 20x plus lent).
  * L'utilisateur doit lancer et gérer Docker Desktop.
  * Pas d'interface de contrôle intégrée dans la barre des menus macOS.

### Option 3 : Application Menu Bar native macOS (via Electron ou Tauri) - RECOMMANDÉE
* **Description** : Créer une application de bureau légère qui s'installe dans la **Barre des Menus (Tray Icon)** de macOS et supervise en tâche de fond le serveur MCP et le frontend Next.js sur un port unique (port 3010, avec le protocole MCP accessible sur `/mcp`).
* **Avantages généraux** :
  * Parfaite visibilité du statut en temps réel (icône dans la barre des menus).
  * Zéro pollution : quand on ferme l'appli, tous les serveurs s'arrêtent.
  * Utilise l'accélération matérielle macOS native (CoreML).
  * Package final sous forme de fichier `.app`.

---

## 3. Comparatif Technique : Electron vs Tauri pour le Superviseur

| Critère | Electron | Tauri |
| :--- | :--- | :--- |
| **Taille du bundle (.app)** | 🐌 **Lourd** (~120 - 150 Mo)<br>Embarque Chromium et Node.js. | ⚡ **Très léger** (~10 - 20 Mo)<br>Utilise le moteur WebKit (Safari) de macOS. |
| **Complexité de développement**| 🟢 **Simple**<br>Backend en JavaScript/Node.js.<br>Intégration directe des processus Node (MCP & Next.js). | 🟡 **Moyenne/Élevée**<br>Backend en **Rust**.<br>Nécessite d'écrire l'orchestration en Rust. |
| **Dépendances de build** | 🟢 **Node.js uniquement**<br>Rien à installer de plus sur le Mac de build. | 🔴 **Rust & Cargo requis**<br>Nécessite d'avoir la toolchain Rust installée pour compiler. |
| **Gestion de Node.js** | 🟢 **Natif**<br>Electron intègre Node.js, ce qui permet de lancer le serveur MCP sans pré-requis système Node. | 🟡 **Externe**<br>Tauri a besoin de Node.js sur le système hôte pour lancer le serveur MCP / Next.js. |
| **Impact si Python est inclus** | ⚪ **Négligeable**<br>Si le dossier Python de 4 Go est inclus dans l'app, le total fait ~4.15 Go. | ⚪ **Négligeable**<br>Si le dossier Python de 4 Go est inclus dans l'app, le total fait ~4.02 Go. |

### Analyse
* Si l'objectif principal est d'obtenir le **bundle le plus léger possible** (sans embarquer Chromium et Node.js), **Tauri** est le meilleur choix (gain de ~130 Mo). Cependant, cela oblige à installer la toolchain Rust pour compiler et complexifie l'orchestration des scripts de démarrage qui devront être gérés en Rust.
* Si l'objectif est la **simplicité d'intégration** (100% JS/TS dans le monorepo, sans dépendance à Rust), **Electron** est le choix naturel et robuste pour orchestrer des sous-processus Node (Next.js, serveur MCP).

---

## 4. Décision Proposée

Nous recommandons **l'Option 3 (Application Menu Bar via Electron)** pour sa simplicité et sa robustesse d'intégration avec le serveur MCP et Next.js, tous deux écrits en JavaScript/TypeScript.

*Cependant, si l'utilisateur insiste sur l'importance cruciale de la taille du bundle (~15 Mo vs ~150 Mo), nous pouvons partir sur **Tauri** en écrivant le code d'orchestration en Rust.*
