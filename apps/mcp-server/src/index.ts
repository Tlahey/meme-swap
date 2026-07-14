import { Server } from './server';

const PORT = parseInt(process.env.MCP_PORT || process.env.PORT || '3001', 10);

async function main() {
  const server = new Server();

  try {
    await server.start(PORT);
    console.log(`✅ MCP Server started on http://localhost:${PORT}`);
    console.log(`📍 Ready to accept MCP connections`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main();
