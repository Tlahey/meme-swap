# 🤖 AI Development Agent Rules

This document contains rules and guidelines for AI development agents working on the **meme-swap** project.

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Technology Stack](#-technology-stack)
- [Monorepo Structure](#-monorepo-structure)
- [Development Rules](#-development-rules)
- [Code Style Guidelines](#-code-style-guidelines)
- [TypeScript Rules](#-typescript-rules)
- [Testing Requirements](#-testing-requirements)
- [Git Workflow](#-git-workflow)
- [Documentation Standards](#-documentation-standards)

---

## 🎯 Project Overview

**meme-swap** is a mono-repo application that allows users to replace faces in animated media (GIFs and videos) using FaceFusion. The project consists of:

1. **Frontend Application** - React/Vue web application
2. **Shared Packages** - Reusable core libraries

### Core Technologies

| Component | Technology |
|-----------|------------|
| Package Manager | pnpm |
| Monorepo Tool | Turborepo |
| Language | TypeScript |
| Frontend | Next.js 14+ (App Router) |
| Styling | TailwindCSS |
| State Management | React Hooks / Zustand |
| Faceswap Engine | FaceFusion (Python) |
| Video Processing | FFmpeg (GIF ↔ MP4) |

---

## 🛠️ Technology Stack

### Mandatory Technologies

- **TypeScript** - All frontend code must be written in TypeScript
- **pnpm** - Package manager for dependency management
- **Turborepo** - Build system and task runner
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Python 3.9+** - For FaceFusion integration

### Frontend Stack

- **Next.js 14+** - React framework with App Router
- **React 18+** - UI library
- **TailwindCSS** - Utility-first CSS
- **Radix UI / shadcn/ui** - Component library
- **Zustand** - State management

### Shared Packages

| Package | Description | Location |
|---------|-------------|----------|
| **@meme-swap/faceswap-core** | TypeScript wrapper for FaceFusion Python execution | `packages/faceswap-core/` |
| **@meme-swap/video-processor** | FFmpeg wrapper for GIF/MP4 conversions | `packages/video-processor/` |
| **api-client** | Giphy API client (placeholder) | `packages/api-client/` |

### Package Exports

#### faceswap-core

```typescript
// Main exports from packages/faceswap-core/src/index.ts
export interface FaceswapOptions {
  sourcePath: string;
  targetPath: string;
  outputPath: string;
  executionProviders?: ('coreml' \| 'cpu' \| 'cuda')[];
  faceSelector?: string;
  threadCount?: number;
  logLevel?: 'debug' \| 'info' \| 'warning' \| 'error';
}

export interface FaceswapResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

export class FaceswapError extends Error {
  constructor(message: string, public cause?: unknown);
}

export async function runFaceSwap(options: FaceswapOptions): Promise<FaceswapResult>;
```

#### video-processor

```typescript
// Main exports from packages/video-processor/src/index.ts
export interface ConversionOptions {
  inputPath: string;
  outputPath: string;
  fps?: number;
  maxWidth?: number;
}

export interface ConversionResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

export class VideoProcessorError extends Error {
  constructor(message: string, public cause?: unknown);
}

export async function gifToMp4(options: ConversionOptions): Promise<ConversionResult>;
export async function mp4ToGif(options: ConversionOptions): Promise<ConversionResult>;
```

### Backend/Processing Stack

| Component | Purpose | Location |
|-----------|---------|----------|
| **FaceFusion** | AI-powered face swapping engine | `vendor/facefusion/` (dev) / `~/.meme-swap/facefusion/` (user global) |
| **FFmpeg** | Media format conversion (GIF ↔ MP4) | System installation |
| **ONNX Runtime** | Neural network inference for FaceFusion | Python package |
| **OpenCV** | Image/video processing | Python package |
| **NumPy** | Numerical computations | Python package |

### Working Directories

| Directory | Purpose | Gitignored |
|-----------|---------|------------|
| `.process/temp/` | Temporary files during media processing | ✅ Yes |
| `.process/results/` | Generated output files | ✅ Yes |
| `apps/frontend/public/test-images/` | Test images for development | ✅ Yes |

---

## 📁 Monorepo Structure

```
meme-swap/
├── apps/                     # Application packages
│   └── frontend/             # React application
├── packages/                 # Shared packages
│   ├── api-client/           # API client
│   ├── faceswap-core/        # FaceFusion wrapper and face processing
│   └── video-processor/      # GIF/MP4 conversion
├── configs/                  # Shared configs
├── turbo.json               # Turborepo config
├── pnpm-workspace.yaml      # Workspace config
└── package.json             # Root package.json
```

### Package Dependencies

```
┌─────────────────────────────────────────────────────┐
│                    Root Package                      │
│                   (turbo.json)                       │
└─────────────────────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
              ▼                       ▼
      ┌──────────────┐        ┌──────────────┐
      │    apps/     │        │  packages/   │
      │              │        │  ┌────────┐  │
      │  - React     │        │  │ api-   │  │
      │  - Vite      │        │  │ client │  │
      │  - Tailwind  │        │  └───┬────┘  │
      │ frontend/    │        │      │       │
      └──────┬───────┘        │  ┌───▼────┐  │
             │                │  │faceswap│  │
             │                │  │ -core  │  │
             │                │  │(Python)│  │
             │                │  └───┬────┘  │
             │                │      │       │
             │                │  ┌───▼────┐  │
             │                │  │video-  │  │
             │                │  │processor│ │
             │                │  └────────┘  │
             │                │              │
             ▼                │              │
     ┌──────────────┐         │              │
     │ Shared Code  │◄────────┴──────────────┘
     │  Packages    │
     └──────────────┘
```

---

## 📝 Development Rules

### Rule 1: TypeScript First

**ALL** frontend code must be written in TypeScript with strict type checking.

```typescript
// ✅ CORRECT
interface MediaInput {
  id: string;
  url: string;
  type: MediaType;
}

function processMedia(input: MediaInput): Promise<ProcessingResult> {
  return { id: input.id, status: 'completed' };
}

// ❌ WRONG
function processMedia(input) {
  return { id: input.id, status: 'completed' };
}
```

### Rule 2: Use pnpm for All Package Operations

```bash
# ✅ CORRECT
pnpm install
pnpm add lodash
pnpm remove lodash

# ❌ WRONG
npm install
yarn add lodash
```

### Rule 3: Named Exports Preferred

```typescript
// ✅ CORRECT - Named exports
export const fetchData = async () => {};
export interface Data { }
export type Result = {};

// ❌ WRONG - Default exports (avoid unless necessary)
export default fetchData;
```

### Rule 4: Async/Await Over Promises

```typescript
// ✅ CORRECT
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error;
  }
}

// ❌ WRONG - .then() chains
function fetchData() {
  return fetch('/api/data')
    .then(response => response.json())
    .catch(error => {
      console.error('Failed to fetch:', error);
      throw error;
    });
}
```

### Rule 5: Error Handling Required

All async operations must have proper error handling.

```typescript
// ✅ CORRECT
async function processMedia(mediaId: string): Promise<ProcessResult> {
  try {
    const media = await fetchMedia(mediaId);
    return await processMediaData(media);
  } catch (error) {
    if (error instanceof MediaNotFoundError) {
      throw error;
    }
    throw new ProcessingError('Failed to process media', { cause: error });
  }
}

// ❌ WRONG - No error handling
async function processMedia(mediaId: string) {
  const media = await fetchMedia(mediaId);
  return processMediaData(media);
}
```

### Rule 6: Interface Over Type Aliases

```typescript
// ✅ CORRECT
interface User {
  id: string;
  name: string;
}

// ❌ WRONG - Use interface when possible
type User = {
  id: string;
  name: string;
};
```

### Rule 7: Component Structure

React components must follow this structure:

```typescript
import React, { useState, useEffect, useMemo } from 'react';

// 1. Type definitions
interface MyComponentProps {
  title: string;
  onClick?: () => void;
}

interface MyComponentState {
  isLoading: boolean;
  data: string | null;
}

// 2. Constants
const MAX_LENGTH = 100;

// 3. Helper functions
function formatTitle(title: string): string {
  return title.toUpperCase();
}

// 4. Component
export const MyComponent: React.FC<MyComponentProps> = ({
  title,
  onClick,
}) => {
  // 5. State
  const [count, setCount] = useState<number>(0);

  // 6. Effects
  useEffect(() => {
    console.log('Component mounted');
    return () => console.log('Component unmounted');
  }, []);

  // 7. Memoized values
  const formattedTitle = useMemo(() => formatTitle(title), [title]);

  // 8. Event handlers
  const handleClick = () => {
    setCount((prev) => prev + 1);
    onClick?.();
  };

  // 9. Render
  return (
    <div onClick={handleClick}>
      {formattedTitle}: {count}
    </div>
  );
};

MyComponent.displayName = 'MyComponent';
```

### Rule 8: API Client Pattern

All API calls must go through the api-client package.

```typescript
// ✅ CORRECT - Using shared api-client
import { giphy } from '@meme-swap/api-client';

const gifs = await giphy.search({ query: 'funny', limit: 10 });

// ❌ WRONG - Direct fetch calls
const response = await fetch('https://api.giphy.com/v1/gifs/search');
```

### Rule 9: Environment Variables

Use environment variables for all configuration.

```typescript
// ✅ CORRECT
const API_KEY = import.meta.env.VITE_GIPHY_API_KEY;
const FACEFUSION_EXECUTABLE = process.env.FACEFUSION_EXECUTABLE || 'python3';

// ❌ WRONG - Hardcoded values
const API_KEY = 'abc123';
```

### Rule 10: Import Order

```typescript
// 1. Node built-ins
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// 2. Third-party
import React from 'react';
import { NextRequest, NextResponse } from 'next/server';

// 3. Internal packages
import { runFaceSwap } from '@meme-swap/faceswap-core';
import { gifToMp4 } from '@meme-swap/video-processor';

// 4. Relative imports
import { Button } from './Button';
import styles from './styles.module.css';

// 5. Assets
import logo from './assets/logo.png';
```

### Rule 11: Next.js API Route Pattern

All server-side processing must use Next.js App Router API routes:

```typescript
// ✅ CORRECT - Next.js API Route (App Router)
import { NextRequest, NextResponse } from 'next/server';
import { runFaceSwap } from '@meme-swap/faceswap-core';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    // Process files...
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}

// ❌ WRONG - Pages router or direct Node.js scripts
// pages/api/faceswap.ts (deprecated)
```

### Rule 12: File Upload Handling

Use FormData for file uploads in API routes:

```typescript
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  
  const sourceFile = formData.get('source') as File | null;
  const targetFile = formData.get('target') as File | null;
  
  if (!sourceFile || !targetFile) {
    return NextResponse.json(
      { error: 'Missing files' },
      { status: 400 }
    );
  }
  
  // Convert to buffer and save
  const buffer = Buffer.from(await sourceFile.arrayBuffer());
  fs.writeFileSync(path, buffer);
}
```

### Rule 13: Working Directory Management

Use `.process/` directory for temporary files:

```typescript
import path from 'node:path';

const PROCESS_DIR = path.join(process.cwd(), '.process');
const TEMP_DIR = path.join(PROCESS_DIR, 'temp');
const RESULTS_DIR = path.join(PROCESS_DIR, 'results');

function ensureDirectories(): void {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}
```

---

## 🎨 Code Style Guidelines

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Interfaces | PascalCase | `MediaInput`, `FaceResult` |
| Types | PascalCase | `MediaType`, `Callback` |
| Variables | camelCase | `mediaList`, `isLoading` |
| Functions | camelCase | `fetchMedia`, `processFrames` |
| Components | PascalCase | `MediaSearch`, `FaceUploader` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_URL` |
| Private members | underscore prefix | `_cache`, `_process()` |

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase.tsx | `MediaCard.tsx` |
| Hooks | camelCase.ts | `useMediaSearch.ts` |
| Utilities | camelCase.ts | `formatDate.ts` |
| Types | PascalCase.ts | `MediaTypes.ts` |
| Tests | *.test.ts | `utils.test.ts` |
| Stories | *.stories.tsx | `Button.stories.tsx` |

### Comment Style

```typescript
// ✅ CORRECT - JSDoc for public APIs
/**
 * Searches for media using the Giphy API.
 * @param query - The search query string
 * @param options - Optional search parameters
 * @param options.limit - Maximum number of results (default: 25)
 * @param options.offset - Pagination offset (default: 0)
 * @returns Promise resolving to search results
 * @throws ApiError if the request fails
 */
export async function searchMedia(
  query: string,
  options: SearchOptions = {}
): Promise<MediaSearchResult> {
  // Implementation
}

// ✅ CORRECT - Inline comments for complex logic
// Use binary search for O(log n) performance
const index = binarySearch(sortedArray, target);

// ❌ WRONG - Obvious comments
// Increment the counter
count++;
```

---

## 🔧 TypeScript Rules

### Strict Mode Required

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### No `any` Type

```typescript
// ✅ CORRECT - Use unknown with type guards
function process(data: unknown) {
  if (typeof data === 'string') {
    return data.toUpperCase();
  }
}

// ✅ CORRECT - Use proper types
interface ApiResponse {
  data: Media[];
  meta: Meta;
}

// ❌ WRONG - Never use any
function process(data: any): any {
  return data;
}
```

### Proper Type Inference

```typescript
// ✅ CORRECT - Let TypeScript infer where possible
const count = 0; // number
const name = 'John'; // string
const items = [1, 2, 3]; // number[]

// ✅ CORRECT - Explicit when needed
const user: User = { id: '1', name: 'John' };

// ❌ WRONG - Unnecessary type annotations
const count: number = 0;
const name: string = 'John';
```

### Utility Types

```typescript
// Use TypeScript utility types
type PartialUser = Partial<User>;
type RequiredUser = Required<User>;
type UserIds = Pick<User, 'id'>;
type UserNames = Omit<User, 'id'>;
type UserArray = Array<User>;
type UserRecord = Record<string, User>;
```

---

## 🧪 Testing Requirements

### Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchMedia, GiphyClient } from './giphy';

describe('GiphyClient', () => {
  let client: GiphyClient;

  beforeEach(() => {
    client = new GiphyClient('test-api-key');
  });

  describe('search', () => {
    it('should return empty array when no results found', async () => {
      // Arrange
      vi.spyOn(client, 'fetch').mockResolvedValue({ data: [] });

      // Act
      const result = await client.search('nonexistent');

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw error on API failure', async () => {
      // Arrange
      vi.spyOn(client, 'fetch').mockRejectedValue(new Error('API Error'));

      // Act & Assert
      await expect(client.search('test')).rejects.toThrow('API Error');
    });
  });
});
```

### Coverage Requirements

- **Unit Tests**: > 80% coverage
- **Integration Tests**: All critical paths
- **E2E Tests**: Main user workflows

### Test Files Location

```
src/
├── components/
│   ├── MediaSearch.tsx
│   └── MediaSearch.test.tsx
├── services/
│   ├── giphy.ts
│   └── giphy.test.ts
└── utils/
    ├── helpers.ts
    └── helpers.test.ts
```

---

## 🐍 FaceFusion Integration Rules

### Python Environment

- FaceFusion requires Python 3.9+
- Always use virtual environments for Python dependencies
- Document all Python dependencies in `requirements.txt`

### FaceFusion Wrapper Pattern

See `packages/faceswap-core/src/index.ts` for the complete implementation.

**Key Points:**
- Use `spawn()` from `child_process` for non-blocking execution
- Path to Python: resolved via `getFaceFusionDir()` + `venv/bin/python3` (macOS)
- Script path: resolved via `getFaceFusionDir()` + `facefusion.py`
- Execution providers: `['coreml', 'cpu']` for Apple Silicon

```typescript
// ✅ CORRECT - FaceFusion wrapper pattern
import { spawn } from 'node:child_process';
import path from 'node:path';

const pythonPath = path.join(process.cwd(), 'vendor', 'facefusion', 'venv', 'bin', 'python3');
const scriptPath = path.join(process.cwd(), 'vendor', 'facefusion', 'facefusion.py');

function runFaceSwap(options: FaceswapOptions): Promise<FaceswapResult> {
  return new Promise((resolve) => {
    const args = [
      scriptPath,
      'run',
      '--headless',
      '--source', options.sourcePath,
      '--target', options.targetPath,
      '--output', options.outputPath,
      '--execution-providers', ...options.executionProviders,
    ];

    const process = spawn(pythonPath, args);
    
    // Handle output and errors...
  });
}
```

### FFmpeg Conversion Pattern

See `packages/video-processor/src/index.ts` for the complete implementation.

**Key Points:**
- GIF → MP4: Single pass with `faststart` optimization
- MP4 → GIF: Two-pass palette approach for quality
- Default FPS: 10, Max width: 320px

```typescript
// ✅ CORRECT - GIF to MP4 conversion
export async function gifToMp4(options: ConversionOptions): Promise<ConversionResult> {
  const args = [
    '-i', options.inputPath,
    '-movflags', 'faststart',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    options.outputPath,
  ];
  
  return new Promise((resolve) => {
    const process = spawn('ffmpeg', args);
    // Handle output and errors...
  });
}

// ✅ CORRECT - MP4 to GIF (two-pass palette)
export async function mp4ToGif(options: ConversionOptions): Promise<ConversionResult> {
  // Pass 1: Generate palette
  const pass1Args = [
    '-i', options.inputPath,
    '-vf', `fps=${options.fps},scale=${options.maxWidth}:-1:flags=lanczos,palettegen`,
    '-y', tempPalette,
  ];
  
  // Pass 2: Apply palette
  const pass2Args = [
    '-i', options.inputPath,
    '-i', tempPalette,
    '-vf', `fps=${options.fps},scale=${options.maxWidth}:-1:flags=lanczos,paletteuse`,
    '-y', options.outputPath,
  ];
  
  // Execute both passes sequentially...
}
```

---

## 📚 Git Workflow

### Branch Naming

```
feature/<description>       # New features
bugfix/<description>        # Bug fixes
hotfix/<description>        # Urgent fixes
chore/<description>         # Maintenance
refactor/<description>      # Code refactoring
docs/<description>          # Documentation
```

### Commit Messages

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Refactoring
- `test`: Tests
- `chore`: Maintenance

**Examples:**

```
feat(giphy): add trending endpoint

Add support for fetching trending GIFs from Giphy API.
Includes pagination and rating filter options.

Closes #123

fix(faceswap): handle missing landmarks

Previously, the swapper would crash if face landmarks
could not be detected. Now it gracefully falls back.

refactor(frontend): extract search logic to hook

Move Giphy search logic from component to custom hook
for better reusability and testability.
```

### Pull Request Template

```markdown
## Description

Brief description of changes.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist

- [ ] Code follows project guidelines
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No console warnings/errors
- [ ] Tests added/passing
- [ ] No new linting issues
```

---

## 📖 Documentation Standards

### README Files

Each package must have a README.md with:

1. Package description
2. Installation instructions
3. Usage examples
4. API reference
5. Contributing guidelines

### Inline Documentation

- JSDoc for all public APIs
- Inline comments for complex logic
- Keep comments up-to-date with code

### Code Examples

```typescript
/**
 * @example
 * ```typescript
 * const gifs = await searchMedia('cat', { limit: 10 });
 * console.log(gifs.data);
 * ```
 */
export function searchMedia(query: string, options?: SearchOptions) {
  // Implementation
}
```

---

## 🚀 Quick Reference

### Common Commands

```bash
# Install dependencies
pnpm install

# Add dependency
pnpm add <package>

# Add dev dependency
pnpm add -D <package>

# Run dev server
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Run linter
pnpm lint

# Format code
pnpm format
```

### Project Commands

```bash
# Frontend specific (Next.js)
pnpm frontend:dev         # Start Next.js dev server on port 3010
pnpm frontend:build       # Build for production

# Package specific
pnpm faceswap-core:build  # Build TypeScript wrapper
pnpm video-processor:build  # Build FFmpeg wrapper

# Full workflow example
pnpm build                # Build all packages
pnpm frontend:dev         # Start frontend with hot reload
```

### Media Processing Workflow

The complete face swap pipeline in the API route:

1. **Upload**: Receive source image and target media via FormData
2. **Convert GIF→MP4** (if needed): Use `video-processor.gifToMp4()`
3. **Face Swap**: Execute FaceFusion via `faceswap-core.runFaceSwap()`
4. **Convert MP4→GIF**: Use `video-processor.mp4ToGif()` for preview
5. **Serve Results**: Static file serving via `/api/results/:filename`

```typescript
// Example workflow in apps/frontend/app/api/faceswap/route.ts
export async function POST(request: NextRequest) {
  // 1. Parse and save uploaded files
  const formData = await request.formData();
  
  // 2. Convert GIF to MP4 if necessary
  let targetForFaceswap = targetPath;
  if (targetFile.name.endsWith('.gif')) {
    await gifToMp4({ inputPath: targetPath, outputPath: tempMp4Path });
    targetForFaceswap = tempMp4Path;
  }
  
  // 3. Run FaceFusion
  const result = await runFaceSwap({
    sourcePath,
    targetPath: targetForFaceswap,
    outputPath: outputMp4Path,
    executionProviders: ['coreml', 'cpu'],
  });
  
  // 4. Convert back to GIF for preview
  await mp4ToGif({ inputPath: outputMp4Path, outputPath: outputGifPath });
  
  // 5. Return result URL
  return NextResponse.json({ outputPath: `/api/results/${filename}` });
}
```

### Python Commands

```bash
# Install Python dependencies
pip install -r requirements.txt

# Create virtual environment
python -m venv venv
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows

# Run FaceFusion
python -m facefusion run --source face.jpg --target video.mp4 --output result.mp4
```

---

## 📞 Support

For questions or clarifications:

1. Check existing documentation
2. Review the [README.md](./README.md)
3. Check the [ROADMAP.md](./ROADMAP.md)
4. Open an issue on GitHub

---

*This document is maintained by the development team and should be updated whenever project guidelines change.*