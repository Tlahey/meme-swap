import express, { Request, Response } from 'express';
import { Server as MCPServer } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { runFaceswapTool } from './tools/faceswap.js';

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
          description:
            'Perform face swap on images and videos. Supports GIFs and MP4 files.',
          inputSchema: {
            type: 'object',
            properties: {
              sourceImagePath: {
                type: 'string',
                description:
                  'Path to the source image containing the face to swap',
              },
              targetMediaPath: {
                type: 'string',
                description: 'Path to the target image or video (GIF/MP4)',
              },
              outputPath: {
                type: 'string',
                description: 'Path where the output file should be saved',
              },
              executionProviders: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'Execution providers for FaceFusion (coreml, cpu, cuda)',
                default: ['coreml', 'cpu'],
              },
              threadCount: {
                type: 'number',
                description: 'Number of threads for processing',
                default: 4,
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

    // SSE endpoint for MCP
    this.app.get('/mcp', async (req: Request, res: Response) => {
      const transport = new SSEServerTransport('/message', res);
      const sessionId = transport.sessionId;

      this.sseTransports.set(sessionId, transport);

      // Connect the transport to the MCP server
      await this.mcpServer.connect(transport);

      // Clean up transport when connection closes
      res.on('close', () => {
        this.sseTransports.delete(sessionId);
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
      console.log(`HTTP server listening on http://127.0.0.1:${port}`);
    });

    // Also support stdio transport for direct CLI usage
    if (process.argv.includes('--stdio')) {
      const stdioTransport = new SSEServerTransport('/message', {} as Response);
      await this.mcpServer.connect(stdioTransport);
    }
  }

  async stop(): Promise<void> {
    await this.mcpServer.close();
  }
}
