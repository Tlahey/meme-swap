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
| `faceSelector` | `string` | `'many'` | Face selector mode: 'many', 'reference', 'one', 'first' |
| `faceSwapperModel` | `string` | - | Specific face swapper model to use |
| `threadCount` | `number` | - | Number of execution threads |
| `logLevel` | `'debug' \| 'info' \| 'warning' \| 'error'` | `'info'` | Logging verbosity level |
| `keepTemp` | `boolean` | `false` | Keep temporary files after processing |

### Result Interface

```typescript
interface FaceswapResult {
  success: boolean;
  outputPath?: string;  // Present if successful
  error?: string;       // Present if failed
}
```

### Error Handling

The package exports a custom `FaceswapError` class for programmatic error handling:

```typescript
import { runFaceSwap, FaceswapError } from '@meme-swap/faceswap-core';

try {
  const result = await runFaceSwap(options);
  
  if (!result.success) {
    throw new FaceswapError('Face swap failed', null, options);
  }
} catch (error) {
  if (error instanceof FaceswapError) {
    console.error('Faceswap error:', error.message);
    console.error('Options used:', error.details);
  } else {
    console.error('Unexpected error:', error);
  }
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