# @meme-swap/faceswap-core

TypeScript wrapper for FaceFusion Python execution.

## Installation

This package is part of the meme-swap monorepo and is automatically linked via pnpm workspaces.

```bash
# No need to install separately - it's included in the monorepo
pnpm install  # from root
```

## Usage

### Basic Example

```typescript
import { runFaceSwap, FaceswapOptions } from '@meme-swap/faceswap-core';

// Define options
const options: FaceswapOptions = {
  sourcePath: './source.jpg',      // Path to source face image
  targetPath: './target.mp4',      // Path to target video (MP4)
  outputPath: './output.mp4',      // Output file path
  executionProviders: ['coreml', 'cpu'],  // Apple Silicon optimization
};

// Execute face swap
const result = await runFaceSwap(options);

if (result.success) {
  console.log('Success! Output:', result.outputPath);
} else {
  console.error('Error:', result.error);
}
```

### Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sourcePath` | `string` | - | Path to source face image (JPEG/PNG) |
| `targetPath` | `string` | - | Path to target video (MP4 format required) |
| `outputPath` | `string` | - | Output file path for the result |
| `executionProviders` | `('coreml' \| 'cpu' \| 'cuda')[]` | `['coreml', 'cpu']` | Execution providers for acceleration |
| `faceSelectorMode` | `string` | none (no default applied) | Face selector mode, e.g. `'many'`, `'one'`, `'reference'` — passed through to FaceFusion's `--face-selector-mode` |
| `threadCount` | `number` | - | Number of execution threads |
| `logLevel` | `'debug' \| 'info' \| 'warning' \| 'error'` | - | Logging verbosity level |
| `keepTemp` | `boolean` | `false` | Keep temporary files after processing |
| `faceMaskBlend` | `number` | - | Blend ratio for the face mask, 0-100 (maps to FaceFusion's `--face-mask-blur`) |
| `faceSwapperModel` | `string` | - | Face swapper model to use; adding it enables the `face_swapper` processor |
| `faceEnhancerModel` | `string` | - | Face enhancer model to use; adding it enables the `face_enhancer` processor |
| `faceEnhancerBlend` | `number` | - | Blend ratio for the face enhancer, 0-100 (maps to `--face-enhancer-blend`) |
| `frameEnhancerModel` | `string` | - | Frame enhancer model to use; adding it enables the `frame_enhancer` processor |
| `lipSyncerModel` | `string` | - | Lip syncer model to use; adding it enables the `lip_syncer` processor |
| `expressionRestorerModel` | `string` | - | Expression restorer model to use; adding it enables the `expression_restorer` processor |
| `onProgress` | `(progress: { step: string; percent: number }) => void` | - | Callback invoked with parsed progress updates (analysing/extracting/processing/merging) from stdout/stderr |
| `onProcessStart` | `(process: ChildProcess) => void` | - | Callback invoked with the spawned child process, so the caller can track/kill it (e.g. on app quit) |

### Result Interface

```typescript
interface FaceswapResult {
  success: boolean;
  outputPath?: string;         // Present if successful
  error?: string;               // Present if failed
  errorCode?: 'missing-install' | 'broken-install'; // Present for classified environment/install failures
}
```

### Error Handling

`runFaceSwap()` never throws — it always resolves a `FaceswapResult`. Check `result.success`, and inspect `result.errorCode` to distinguish an environment/install problem (FaceFusion or its Python venv missing) from an ordinary swap failure (bad media, FaceFusion crashing on a specific frame, etc.):

```typescript
import { runFaceSwap } from '@meme-swap/faceswap-core';

const result = await runFaceSwap(options);

if (!result.success) {
  if (result.errorCode === 'missing-install') {
    console.error('FaceFusion is not installed — re-run the setup wizard:', result.error);
  } else {
    console.error('Face swap failed:', result.error);
  }
} else {
  console.log('Success! Output:', result.outputPath);
}
```

## Execution Providers

FaceFusion supports multiple execution providers for hardware acceleration:

| Provider | Platform | Description |
|----------|----------|-------------|
| `coreml` | macOS (Apple Silicon) | Core ML acceleration for M1/M2/M3 chips |
| `cuda` | NVIDIA GPU | CUDA acceleration for NVIDIA graphics cards |
| `cpu` | All platforms | CPU-only fallback (slower) |

**Recommendation for Apple Silicon:** Use `['coreml', 'cpu']` as shown in the examples.

## Requirements

- **Node.js** >= 18.x
- **Python** >= 3.9 with FaceFusion installed
- FaceFusion is resolved in the user's home folder at `~/.meme-swap/facefusion` (global environment) for all executions.

## Project Structure

```
packages/faceswap-core/
├── src/
│   └── index.ts          # Main exports
├── dist/                 # Compiled output (after build)
│   ├── index.js
│   └── index.d.ts
├── package.json
└── tsconfig.json
```

## Development

```bash
# Build the package
pnpm build

# Watch mode for development
pnpm dev

# Clean build artifacts
pnpm clean
```

## License

MIT