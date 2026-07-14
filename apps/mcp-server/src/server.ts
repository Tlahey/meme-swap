import type { ServerResponse } from 'node:http';
import express, { Request, Response } from 'express';
import { Server as MCPServer } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type JSONRPCMessage,
} from '@modelcontextprotocol/sdk/types.js';
import { runFaceswapTool } from './tools/faceswap.js';

// SSEServerTransport (sse.d.ts) declares `res`, `_endpoint`, `_sessionId`,
// and `_sseResponse` as TypeScript-private fields (not JS `#private`), so
// they're ordinary properties at runtime but inaccessible to a subclass
// through the compiler. This interface names exactly the fields/callback
// that start()'s override below reads and writes, matching those private
// declarations, so the reach-in below is scoped rather than a blanket `any`.
interface SSEServerTransportInternals {
  res: ServerResponse;
  _sseResponse?: ServerResponse;
  _endpoint: string;
  _sessionId: string;
  onclose?: () => void;
}

class AbsoluteSSEServerTransport extends SSEServerTransport {
  override async start(): Promise<void> {
    const self = this as unknown as SSEServerTransportInternals;
    if (self._sseResponse) {
      throw new Error('SSEServerTransport already started!');
    }
    self.res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });

    const endpointUrl = new URL(self._endpoint);
    endpointUrl.searchParams.set('sessionId', self._sessionId);
    const absoluteUrlWithSession = endpointUrl.toString();

    self.res.write(`event: endpoint\ndata: ${absoluteUrlWithSession}\n\n`);
    self._sseResponse = self.res;
    self.res.on('close', () => {
      self._sseResponse = undefined;
      self.onclose?.();
    });
  }
}

export class Server {
  private app: express.Express;
  private mcpServer: MCPServer;
  private sseTransports: Map<string, SSEServerTransport>;

  constructor() {
    this.app = express();
    this.mcpServer = this.createMCPServer();
    this.sseTransports = new Map();

    this.setupRoutes();
  }

  private createMCPServer(): MCPServer {
    const mcpServer = new MCPServer(
      {
        name: 'meme-swap-mcp-server',
        version: '0.0.1',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Register tool handlers
    mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'run_faceswap',
          description: 'Perform face swap on images and videos. Supports GIFs and MP4 files.',
          inputSchema: {
            type: 'object',
            properties: {
              sourceImagePath: {
                type: 'string',
                description:
                  'Path to the source image containing the face to swap (the source / face / visage)',
              },
              targetMediaPath: {
                type: 'string',
                description:
                  'Path to the target image or video (GIF/MP4) (the target / target media / target GIF)',
              },
              outputPath: {
                type: 'string',
                description: 'Path where the output file should be saved',
              },
              executionProviders: {
                type: 'array',
                items: { type: 'string' },
                description: 'Execution providers for FaceFusion (coreml, cpu, cuda)',
                default: ['coreml', 'cpu'],
              },
              threadCount: {
                type: 'number',
                description: 'Number of threads for processing',
                default: 4,
              },
              faceSelectorMode: {
                type: 'string',
                description: 'Face selector mode: reference, many, one',
              },
              faceMaskBlend: {
                type: 'number',
                description: 'Blend ratio for the face mask (0-100)',
              },
              faceSwapperModel: {
                type: 'string',
                description: 'Face swapper model to use (e.g. inswapper_128_fp16)',
              },
              faceEnhancerModel: {
                type: 'string',
                description: 'Face enhancer model to use (e.g. codeformer)',
              },
              lipSyncerModel: {
                type: 'string',
                description: 'Lip syncer model to use',
              },
              logLevel: {
                type: 'string',
                enum: ['debug', 'info', 'warning', 'error'],
                description: 'Log level (debug, info, warning, error)',
                default: 'info',
              },
            },
            required: ['sourceImagePath', 'targetMediaPath', 'outputPath'],
          },
        },
      ],
    }));

    mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'run_faceswap') {
        return runFaceswapTool(request.params.arguments);
      }
      return {
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${request.params.name}`,
          },
        ],
        isError: true,
      };
    });

    return mcpServer;
  }

  private setupRoutes() {
    this.app.use(express.json());

    // Request logging middleware
    // Only logs method + URL — request headers (which may include Authorization)
    // and bodies are never logged, since stdout is persisted to disk by PM2.
    this.app.use((req, res, next) => {
      console.info(`[MCP Server Request] ${req.method} ${req.url}`);
      next();
    });

    // CORS middleware to support all cross-origin requests from external clients (e.g. Osaurus)
    this.app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });

    // SSE endpoint for MCP
    this.app.get('/mcp', async (req: Request, res: Response) => {
      const host = req.get('host') || '127.0.0.1:3001';
      const protocol = req.protocol || 'http';
      // Dynamically construct absolute URL to ensure clients receive a fully qualified path for POSTing messages
      const absoluteEndpoint = `${protocol}://${host}/message`;

      const transport = new AbsoluteSSEServerTransport(absoluteEndpoint, res);
      const sessionId = transport.sessionId;

      const mcpServer = this.createMCPServer();
      this.sseTransports.set(sessionId, transport);

      // Connect the transport to the MCP server
      await mcpServer.connect(transport);

      // Clean up transport when connection closes
      res.on('close', async () => {
        this.sseTransports.delete(sessionId);
        try {
          await mcpServer.close();
        } catch {
          // ignore or log
        }
      });
    });

    // POST endpoint for stateless HTTP JSON-RPC MCP
    this.app.post('/mcp', async (req: Request, res: Response) => {
      const jsonRpcRequest = req.body;
      if (!jsonRpcRequest || typeof jsonRpcRequest !== 'object') {
        res.status(400).json({ error: 'Invalid JSON-RPC request' });
        return;
      }

      // Check if it is a notification (no ID)
      const isNotification = !('id' in jsonRpcRequest);

      const mcpServer = this.createMCPServer();

      return new Promise<void>((resolve) => {
        let resolved = false;

        const transport: Transport = {
          onclose: undefined,
          onerror: (err: Error) => {
            if (!resolved) {
              resolved = true;
              res.status(500).json({ error: err.message });
              resolve();
            }
          },
          onmessage: undefined,
          start: async () => {},
          send: async (message: JSONRPCMessage) => {
            if (!resolved) {
              resolved = true;
              res.json(message);
              resolve();
            }
          },
          close: async () => {},
        };

        mcpServer
          .connect(transport)
          .then(() => {
            if (transport.onmessage) {
              transport.onmessage(jsonRpcRequest);
              if (isNotification) {
                resolved = true;
                res.status(204).end();
                resolve();
              }
            } else {
              if (!resolved) {
                resolved = true;
                res.status(500).json({ error: 'Transport onmessage handler not registered' });
                resolve();
              }
            }
          })
          .catch((err) => {
            if (!resolved) {
              resolved = true;
              res.status(500).json({ error: err.message });
              resolve();
            }
          });
      });
    });

    // Message endpoint for SSE
    this.app.post('/message', (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string;
      const transport = this.sseTransports.get(sessionId);

      if (!transport) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      transport.handlePostMessage(req, res);
    });

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  }

  async start(port: number): Promise<void> {
    // Start HTTP server for SSE transport
    this.app.listen(port, '127.0.0.1', () => {
      console.info(`HTTP server listening on http://127.0.0.1:${port}`);
    });

    // Also support stdio transport for direct CLI usage
    if (process.argv.includes('--stdio')) {
      const stdioTransport = new StdioServerTransport();
      await this.mcpServer.connect(stdioTransport);
    }
  }

  async stop(): Promise<void> {
    await this.mcpServer.close();
  }
}
