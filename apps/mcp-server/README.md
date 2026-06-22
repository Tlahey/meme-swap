# MCP Server

MCP (Model Context Protocol) server for face-swap operations in meme-swap.

---

## Features

- Face swap via FaceFusion (source image + target GIF/MP4)
- Automatic GIF ↔ MP4 conversion
- Temporary file cleanup after each operation
- HTTP/SSE transport for daemon mode

---

## Installation

```bash
cd apps/mcp-server
pnpm install
pnpm build
```

---

## Configuration

### Environment Variables

```bash
PORT=3001  # Server port (default: 3001)
```

### Development

```bash
pnpm dev
```

### Production

```bash
pnpm build
pnpm start
```

### With PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start the server
pm2 start ecosystem.config.js

# View logs
pm2 logs mcp-server

# Stop the server
pm2 stop mcp-server
```

---

## Usage

### HTTP Transport (Daemon Mode)

The server listens on `http://localhost:3001` and exposes:

- `GET  /mcp` — SSE endpoint for MCP connections
- `POST /message` — MCP message endpoint
- `GET  /health` — health check

### MCP Client Configuration

Add to your MCP config file (e.g. `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "meme-swap": {
      "command": "node",
      "args": ["/absolute/path/to/meme-swap/apps/mcp-server/build/index.js"],
      "env": {
        "PORT": "3001"
      }
    }
  }
}
```

### Available Tool: `run_faceswap`

Performs a face swap on an image or video.

**Parameters:**

```json
{
  "sourceImagePath": "/path/to/source_face.jpg",
  "targetMediaPath": "/path/to/target.gif",
  "outputPath": "/path/to/output.mp4",
  "executionProviders": ["coreml", "cpu"],
  "threadCount": 4
}
```

**Example:**

```
run_faceswap({
  sourceImagePath: "/Users/me/photos/face.jpg",
  targetMediaPath: "/Users/me/videos/target.gif",
  outputPath: "/Users/me/results/output.gif"
})
```

---

## Testing

```bash
# Health check
curl http://localhost:3001/health

# MCP endpoint (SSE stream)
curl http://localhost:3001/mcp
```

---

## Logs

Log files are stored in:

- `./logs/mcp-server-out.log` — standard output
- `./logs/mcp-server-error.log` — errors

---

## Security

The server is configured to:

- Listen only on `127.0.0.1` (localhost only)
- Require no authentication (secured by network locality)
- Clean up temporary files after each operation

---

## Troubleshooting

### Server won't start

```bash
# Check logs
pm2 logs mcp-server

# Check if the port is already in use
lsof -i :3001

# Restart via PM2
pm2 restart mcp-server
```

### FaceFusion errors

```bash
# Verify FaceFusion is installed
ls ~/.meme-swap/facefusion/venv/bin/python3

# Test it directly
~/.meme-swap/facefusion/venv/bin/python3 ~/.meme-swap/facefusion/facefusion.py --version

# Reinstall Python dependencies
cd ~/.meme-swap/facefusion
./venv/bin/pip install -r requirements.txt
```
