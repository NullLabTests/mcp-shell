import { Command } from 'commander';
import { connectAndRun } from './client.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const program = new Command();

program
  .name('mcp-client')
  .description('MCP client for connecting to MCP servers')
  .version('1.0.0');

program
  .command('connect')
  .description('Connect to an MCP server')
  .option('-s, --stdio <command>', 'Connect via stdio (e.g. "npx @modelcontextprotocol/server-filesystem /path")')
  .option('--sse <url>', 'Connect via SSE (e.g. "http://localhost:3001/sse")')
  .option('--streamable-http <url>', 'Connect via Streamable HTTP (e.g. "http://localhost:3001/mcp")')
  .option('--ws <url>', 'Connect via WebSocket (e.g. "ws://localhost:3001")')
  .option('--config <path>', 'Path to MCP config JSON file')
  .option('--list-tools', 'List available tools and exit')
  .option('--call-tool <name>', 'Call a tool')
  .option('--tool-args <json>', 'JSON arguments for the tool call')
  .option('--list-resources', 'List available resources and exit')
  .option('--read-resource <uri>', 'Read a resource by URI')
  .option('-i, --interactive', 'Start interactive REPL mode after connecting')
  .action(async (options) => {
    try {
      let transportConfig;

      if (options.config) {
        const configPath = resolve(options.config);
        if (!existsSync(configPath)) {
          console.error(`Config file not found: ${configPath}`);
          process.exit(1);
        }
        transportConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      } else if (options.stdio) {
        const parts = options.stdio.split(' ');
        transportConfig = { type: 'stdio', command: parts[0], args: parts.slice(1) };
      } else if (options.sse) {
        transportConfig = { type: 'sse', url: options.sse };
      } else if (options.streamableHttp) {
        transportConfig = { type: 'streamable-http', url: options.streamableHttp };
      } else if (options.ws) {
        transportConfig = { type: 'websocket', url: options.ws };
      } else {
        console.error('No connection method specified. Use --stdio, --sse, --streamable-http, --ws, or --config.');
        process.exit(1);
      }

      const action = options.callTool
        ? { type: 'call-tool' as const, name: options.callTool, args: options.toolArgs ? JSON.parse(options.toolArgs) : {} }
        : options.listTools
        ? { type: 'list-tools' as const }
        : options.listResources
        ? { type: 'list-resources' as const }
        : options.readResource
        ? { type: 'read-resource' as const, uri: options.readResource }
        : options.interactive
        ? { type: 'interactive' as const }
        : { type: 'list-tools' as const };

      await connectAndRun(transportConfig, action);
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program.parse(process.argv);
