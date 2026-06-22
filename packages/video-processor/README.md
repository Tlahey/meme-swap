# @meme-swap/video-processor

FFmpeg wrapper for GIF/MP4 conversions in the meme-swap monorepo.

## Installation

This package is part of the meme-swap monorepo and is automatically linked via pnpm workspaces.

```bash
# No need to install separately - it's included in the monorepo
pnpm install  # from root
```

## Prerequisites

**FFmpeg must be installed on your system:**

- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg` or `sudo yum install ffmpeg`
- **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html)

## Usage

### Basic Example

```typescript
import { gifToMp4, mp4ToGif } from '@meme-swap/video-processor';

// Convert GIF to MP4
const result1 = await gifToMp4({
  inputPath: './input.gif',
  outputPath: './output.mp4',
});

if (result1.success) {
  console.log('Converted:', result1.outputPath);
} else {
  console.error('Error:', result1.error);
}

// Convert MP4 to GIF with custom options
const result2 = await mp4ToGif({
  inputPath: './input.mp4',
  outputPath: './output.gif',
  fps: 10,           // Frames per second (default: 10)
  maxWidth: 320,     // Maximum width (default: 320)
});

if (result2.success) {
  console.log('Converted:', result2.outputPath);
} else {
  console.error('Error:', result2.error);
}
```

### Complete Workflow Example

```typescript
import { gifToMp4, mp4ToGif } from '@meme-swap/video-processor';

async function convertGifToOptimizedGif(inputPath: string, outputPath: string) {
  // Step 1: Convert GIF to MP4 for processing
  const tempMp4 = inputPath.replace('.gif', '.temp.mp4');
  
  const gifResult = await gifToMp4({
    inputPath,
    outputPath: tempMp4,
  });

  if (!gifResult.success) {
    throw new Error(`GIF to MP4 conversion failed: ${gifResult.error}`);
  }

  // Step 2: Process the MP4 (e.g., with FaceFusion)
  // ... your processing logic here ...

  // Step 3: Convert back to GIF
  const result = await mp4ToGif({
    inputPath: tempMp4,
    outputPath,
    fps: 10,
    maxWidth: 320,
  });

  // Clean up temporary file
  if (result.success) {
    fs.unlinkSync(tempMp4);
  }

  return result;
}
```

## Options Reference

### Common Options

| Option | Type | Description |
|--------|------|-------------|
| `inputPath` | `string` | Path to the input file (required) |
| `outputPath` | `string` | Path for the output file (required) |

### GIF Conversion Options (mp4ToGif)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fps` | `number` | `10` | Frames per second for the output GIF |
| `maxWidth` | `number` | `320` | Maximum width of the output GIF (height is auto-calculated) |

## Result Interface

```typescript
interface ConversionResult {
  success: boolean;
  outputPath?: string;  // Present if successful
  error?: string;       // Present if failed
}
```

### Error Handling

Both functions return a `ConversionResult` object with a `success` flag. Check this flag to determine if the conversion succeeded:

```typescript
const result = await gifToMp4({ inputPath, outputPath });

if (!result.success) {
  console.error('Conversion failed:', result.error);
  // Handle error appropriately
}
```

## Technical Details

### GIF to MP4 Conversion

Uses FFmpeg with the following settings:
- **Codec**: H.264 (`libx264`)
- **Pixel Format**: `yuv420p` (maximum compatibility)
- **Optimization**: `faststart` for web streaming

### MP4 to GIF Conversion

Uses a two-pass palette approach for optimal quality:
1. **Pass 1**: Generate an optimized color palette from the video
2. **Pass 2**: Apply the palette to create the final GIF

This produces higher quality GIFs compared to single-pass conversion.

## Project Structure

```
packages/video-processor/
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