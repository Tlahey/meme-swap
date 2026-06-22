# 📋 Plan d'Action - Améliorations du Code

Ce document détaille les étapes concrètes pour améliorer le projet meme-swap suite à l'analyse de code.

---

## 🎯 Objectifs

1. **Validation stricte des uploads** - Sécuriser les entrées utilisateur
2. **Gestion des fichiers temporaires** - Nettoyage automatique et propre
3. **Système de logs structuré** - Meilleure traçabilité
4. **Tests unitaires** - Couverture des wrappers et API
5. **UX améliorée** - Progression, aperçus, gestion des erreurs

---

## 📦 Phase 1: Validation stricte des uploads

### 1.1 Créer un package de validation

**Fichier:** `packages/validators/src/index.ts`

```typescript
// Types et interfaces
export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  metadata?: FileMetadata;
}

export interface FileMetadata {
  size: number;
  type: string;
  extension: string;
  dimensions?: { width: number; height: number };
  duration?: number;
}

// Fonctions à implémenter
export function validateImage(file: File): FileValidationResult;
export function validateVideo(file: File): FileValidationResult;
export function validateFileSize(file: File, maxSizeMB: number): boolean;
export function getFileType(file: File): string;
```

**Tâches:**
- [ ] Créer le package `validators`
- [ ] Implémenter `validateImage()` (type, taille max 10MB)
- [ ] Implémenter `validateVideo()` (type GIF/MP4, taille max 100MB)
- [ ] Ajouter vérification des dimensions minimales (ex: 200x200px)
- [ ] Ajouter vérification de la durée max pour vidéos (ex: 30s)

### 1.2 Intégrer la validation dans l'API

**Fichier:** `apps/frontend/app/api/faceswap/route.ts`

```typescript
// Ajouter au début de POST()
const sourceValidation = validateImage(sourceFile);
if (!sourceValidation.valid) {
  return NextResponse.json(
    { success: false, error: sourceValidation.errors.join(', ') },
    { status: 400 }
  );
}

const targetValidation = validateVideo(targetFile);
if (!targetValidation.valid) {
  return NextResponse.json(
    { success: false, error: targetValidation.errors.join(', ') },
    { status: 400 }
  );
}
```

**Tâches:**
- [ ] Importer le package validators
- [ ] Ajouter validation source avant traitement
- [ ] Ajouter validation target avant traitement
- [ ] Retourner des erreurs claires à l'utilisateur

---

## 🗑️ Phase 2: Gestion des fichiers temporaires

### 2.1 Créer un service de gestion

**Fichier:** `packages/file-manager/src/index.ts`

```typescript
export interface FileManagerOptions {
  baseDir?: string;
  cleanupInterval?: number; // en heures
  maxAge?: number; // en heures
}

export class FileManager {
  constructor(options?: FileManagerOptions);
  
  createFile(extension: string, buffer: Buffer): Promise<string>;
  createDirectory(): Promise<string>;
  cleanup(): Promise<number>; // retourne le nombre de fichiers supprimés
  getFile(path: string): Buffer;
  deleteFile(path: string): Promise<void>;
  onCleanup(callback: (files: string[]) => void): void;
}

// Singleton exporté
export const fileManager = new FileManager();
```

**Tâches:**
- [ ] Créer le package `file-manager`
- [ ] Implémenter `createFile()` avec nom unique
- [ ] Implémenter `cleanup()` pour supprimer les fichiers > 1h
- [ ] Ajouter un cron job pour cleanup automatique
- [ ] Ajouter méthode `deleteFile()` avec suppression récursive

### 2.2 Intégrer dans l'API

**Fichier:** `apps/frontend/app/api/faceswap/route.ts`

```typescript
// Remplacer ensureDirectories() par:
import { fileManager } from '@meme-swap/file-manager';

// Au début de POST():
const tempDir = await fileManager.createDirectory();

// À la fin (success ou échec):
// Optionnel: supprimer les fichiers temporaires
// await fileManager.cleanup();
```

**Tâches:**
- [ ] Remplacer `PROCESS_DIR` par `fileManager`
- [ ] Ajouter cleanup après chaque traitement
- [ ] Ajouter try/finally pour garantir le nettoyage
- [ ] Tester avec plusieurs requêtes successives

---

## 📊 Phase 3: Système de logs structuré

### 3.1 Créer un logger

**Fichier:** `packages/logger/src/index.ts`

```typescript
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
  error?: Error;
}

export class Logger {
  constructor(private module: string);
  
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: Error, data?: unknown): void;
  
  static create(module: string): Logger;
}

// Export singleton par module
export const faceswapLogger = Logger.create('faceswap');
export const videoProcessorLogger = Logger.create('video-processor');
export const apiLogger = Logger.create('api');
```

**Tâches:**
- [ ] Créer le package `logger`
- [ ] Implémenter les méthodes de log
- [ ] Ajouter format JSON pour logs serveur
- [ ] Ajouter couleur pour logs console (dev)
- [ ] Export loggers par module

### 3.2 Intégrer dans le code

**Fichier:** `apps/frontend/app/api/faceswap/route.ts`

```typescript
// Remplacer console.log par:
import { apiLogger, faceswapLogger, videoProcessorLogger } from '@meme-swap/logger';

// Exemple:
apiLogger.info('Requête reçue', { method: 'POST', url: request.url });
faceswapLogger.info('Face swap lancé', { sourcePath, targetPath });
videoProcessorLogger.debug('Conversion GIF→MP4', { inputPath, outputPath });
```

**Tâches:**
- [ ] Remplacer tous les `console.log` par les loggers
- [ ] Ajouter context (requestId, userId si auth)
- [ ] Configurer niveau de log par environnement
- [ ] Tester logs en dev et prod

---

## 🧪 Phase 4: Tests unitaires

### 4.1 Configurer Vitest

**Fichier:** `vitest.config.ts` (root)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

**Tâches:**
- [ ] Ajouter `vitest` en dev dependency
- [ ] Configurer `vitest.config.ts`
- [ ] Ajouter script `test` dans `package.json`
- [ ] Configurer coverage

### 4.2 Tests pour `video-processor`

**Fichier:** `packages/video-processor/src/index.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gifToMp4, mp4ToGif } from './index';
import fs from 'node:fs';

describe('gifToMp4', () => {
  beforeEach(() => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
  });

  it('should return error if input file does not exist', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    
    const result = await gifToMp4({
      inputPath: './nonexistent.gif',
      outputPath: './output.mp4',
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('non trouvé');
  });

  it('should create output directory if it does not exist', async () => {
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync');
    
    await gifToMp4({
      inputPath: './test.gif',
      outputPath: './new-dir/output.mp4',
    });
    
    expect(mkdirSpy).toHaveBeenCalledWith('./new-dir', { recursive: true });
  });
});

describe('mp4ToGif', () => {
  it('should use default fps and maxWidth when not provided', async () => {
    // Test avec valeurs par défaut
  });
});
```

**Tâches:**
- [ ] Écrire tests pour `gifToMp4()`
- [ ] Écrire tests pour `mp4ToGif()`
- [ ] Mock `spawn` pour éviter exécution réelle
- [ ] Tester cas d'erreur (fichier non trouvé, FFmpeg absent)

### 4.3 Tests pour API route

**Fichier:** `apps/frontend/app/api/faceswap/route.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock les dépendances
vi.mock('@meme-swap/faceswap-core', () => ({
  runFaceSwap: vi.fn(),
}));

vi.mock('@meme-swap/video-processor', () => ({
  gifToMp4: vi.fn(),
  mp4ToGif: vi.fn(),
}));

describe('POST /api/faceswap', () => {
  it('should return 400 if files are missing', async () => {
    // Créer une requête sans fichiers
    const request = new NextRequest(new URL('http://localhost/api/faceswap'));
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should return 400 if file format is invalid', async () => {
    // Tester avec fichier non supporté
  });

  it('should return 500 if face swap fails', async () => {
    // Mock runFaceSwap pour échouer
  });

  it('should return 200 on success', async () => {
    // Mock tous les services pour réussir
    // Vérifier que le résultat contient outputPath
  });
});
```

**Tâches:**
- [ ] Écrire tests pour validation
- [ ] Écrire tests pour conversion GIF→MP4
- [ ] Écrire tests pour face swap
- [ ] Écrire tests pour conversion MP4→GIF
- [ ] Écrire tests pour succès complet

### 4.4 Exécuter et vérifier coverage

```bash
pnpm test --coverage
```

**Tâches:**
- [ ] Vérifier que coverage > 80%
- [ ] Ajouter tests manquants si nécessaire
- [ ] Configurer CI pour exécuter tests

---

## 🎨 Phase 5: UX améliorée

### 5.1 Ajouter progression

**Fichier:** `apps/frontend/app/page.tsx`

```typescript
// Ajouter state pour progression
const [progress, setProgress] = useState<{
  step: number;
  message: string;
} | null>(null);

// Dans handleSubmit():
setProgress({ step: 1, message: 'Validation des fichiers...' });
// ... après validation
setProgress({ step: 2, message: 'Conversion GIF → MP4...' });
// ... etc

// Afficher dans UI
{progress && (
  <div className="bg-blue-100 p-4 rounded-lg">
    <div className="flex items-center gap-3">
      <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      <p className="text-blue-800">{progress.message}</p>
    </div>
    <div className="mt-2 bg-blue-200 rounded-full h-2">
      <div 
        className="bg-blue-600 h-2 rounded-full transition-all"
        style={{ width: `${progress.step * 20}%` }}
      ></div>
    </div>
  </div>
)}
```

**Tâches:**
- [ ] Ajouter state `progress`
- [ ] Mettre à jour progression à chaque étape
- [ ] Afficher barre de progression
- [ ] Ajouter messages clairs

### 5.2 Ajouter aperçu vidéo

**Fichier:** `apps/frontend/app/page.tsx`

```typescript
// Dans Result Section
{result?.success && previewUrl && (
  <div className="mt-4">
    <p className="text-sm text-gray-600 mb-2">Résultat :</p>
    
    {/* Si c'est un GIF */}
    {targetGif?.name.endsWith('.gif') && (
      <img 
        src={previewUrl} 
        alt="Résultat" 
        className="mx-auto rounded-lg shadow-md max-h-64"
      />
    )}
    
    {/* Si c'est un MP4 */}
    {targetGif?.name.endsWith('.mp4') && (
      <video 
        src={previewUrl} 
        controls 
        className="mx-auto rounded-lg shadow-md max-h-64"
      />
    )}
  </div>
)}
```

**Tâches:**
- [ ] Détecter type de fichier cible
- [ ] Afficher `<video>` pour MP4
- [ ] Afficher `<img>` pour GIF
- [ ] Ajouter controls pour vidéo

### 5.3 Gestion élégante des erreurs

**Fichier:** `apps/frontend/app/page.tsx`

```typescript
// Remplacer alert() par:
const [error, setError] = useState<{
  message: string;
  details?: string;
} | null>(null);

// Dans handleSubmit():
catch (error) {
  if (error instanceof Error) {
    setError({
      message: 'Une erreur est survenue',
      details: error.message,
    });
  }
}

// Afficher dans UI
{error && (
  <div className="bg-red-100 border border-red-300 rounded-lg p-4">
    <p className="text-red-800 font-semibold mb-2">⚠️ {error.message}</p>
    {error.details && (
      <details>
        <summary className="text-sm text-red-600 cursor-pointer">
          Détails
        </summary>
        <p className="text-sm text-red-700 mt-2">{error.details}</p>
      </details>
    )}
    <button 
      onClick={() => setError(null)}
      className="mt-2 text-sm text-red-600 hover:underline"
    >
      Fermer
    </button>
  </div>
)}
```

**Tâches:**
- [ ] Remplacer `alert()` par composant d'erreur
- [ ] Ajouter détails techniques (expandable)
- [ ] Ajouter bouton pour fermer
- [ ] Tester différents types d'erreurs

---

## 📅 Estimation

| Phase | Complexité | Temps estimé |
|-------|------------|--------------|
| 1. Validation | Moyenne | 2-3h |
| 2. File Manager | Moyenne | 2-3h |
| 3. Logger | Faible | 1-2h |
| 4. Tests | Élevée | 4-6h |
| 5. UX | Moyenne | 2-3h |
| **Total** | | **11-17h** |

---

## 🚀 Recommandations de priorisation

### Option A: Sécurité d'abord (recommandé)
1. **Phase 1** - Validation (sécurise l'entrée)
2. **Phase 2** - File Manager (évite accumulation)
3. **Phase 3** - Logger (aide au debug)

### Option B: Qualité de code
1. **Phase 4** - Tests (garantit la régression)
2. **Phase 3** - Logger (meilleure observabilité)
3. **Phase 1** - Validation

### Option C: UX rapide
1. **Phase 5** - UX (améliore l'expérience immédiate)
2. **Phase 1** - Validation (évite erreurs utilisateur)
3. **Phase 3** - Logger

---

## 📝 Notes

- Commencer par la **Phase 1** car elle impacte directement la sécurité
- Les **tests (Phase 4)** doivent être faits avant de passer en production
- Le **logger (Phase 3)** est utile pour toutes les phases suivantes
- La **UX (Phase 5)** peut être faite en parallèle avec les autres phases

---

*Ce plan est évolutif et peut être ajusté selon les retours et priorités.*
