import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

type TransportConfig =
  | { type: 'stdio'; command: string; args?: string[]; env?: Record<string, string> }
  | { type: 'sse'; url: string }
  | { type: 'streamable-http'; url: string }
  | { type: 'websocket'; url: string };

type Action =
  | { type: 'list-tools' }
  | { type: 'call-tool'; name: string; args: Record<string, unknown> }
  | { type: 'list-resources' }
  | { type: 'read-resource'; uri: string }
  | { type: 'interactive' };

function createTransport(config: TransportConfig) {
  switch (config.type) {
    case 'stdio':
      return new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env,
      });
    case 'sse':
      return new SSEClientTransport(new URL(config.url));
    case 'streamable-http':
      return new StreamableHTTPClientTransport(new URL(config.url));
    case 'websocket':
      return new WebSocketClientTransport(new URL(config.url));
  }
}

export async function connectAndRun(transportConfig: TransportConfig, action: Action) {
  const client = new Client(
    { name: 'mcp-client', version: '1.0.0' },
    { capabilities: {} },
  );

  const transport = createTransport(transportConfig);
  await client.connect(transport);

  const serverInfo = client.getServerVersion();
  const serverCaps = client.getServerCapabilities();
  console.log(`Connected to: ${serverInfo?.name ?? 'unknown'} v${serverInfo?.version ?? '?'}`);

  try {
    switch (action.type) {
      case 'list-tools':
        await listTools(client);
        break;
      case 'call-tool':
        await callTool(client, action.name, action.args);
        break;
      case 'list-resources':
        await listResources(client);
        break;
      case 'read-resource':
        await readResource(client, action.uri);
        break;
      case 'interactive':
        await interactiveMode(client, serverCaps);
        break;
    }
  } finally {
    await client.close();
  }
}

async function listTools(client: Client) {
  const result = await client.listTools();
  if (result.tools.length === 0) {
    console.log('No tools available.');
    return;
  }
  console.log('\nAvailable tools:');
  for (const tool of result.tools) {
    console.log(`\n  ${tool.name}${tool.description ? `: ${tool.description}` : ''}`);
    if (tool.inputSchema?.properties) {
      const props = tool.inputSchema.properties as Record<string, { type?: string; description?: string }>;
      const required = (tool.inputSchema.required as string[]) ?? [];
      for (const [key, prop] of Object.entries(props)) {
        const req = required.includes(key) ? ' (required)' : '';
        console.log(`    ${key}: ${prop.type ?? 'any'}${req}${prop.description ? ` - ${prop.description}` : ''}`);
      }
    }
  }
}

async function callTool(client: Client, name: string, args: Record<string, unknown>) {
  console.log(`Calling tool: ${name}`);
  console.log(`Arguments: ${JSON.stringify(args, null, 2)}`);
  const result = await client.callTool({ name, arguments: args });
  const content = Array.isArray((result as any).content) ? (result as any).content : [];
  for (const item of content) {
    if (item.type === 'text') {
      console.log(item.text);
    } else if (item.type === 'resource') {
      console.log(`[Resource: ${item.resource.uri}]`);
      if (item.resource.text) console.log(item.resource.text);
    } else {
      console.log(`[${item.type} content]`);
    }
  }
  if ((result as any).isError) {
    console.error('Tool returned an error');
  }
}

async function listResources(client: Client) {
  const result = await client.listResources();
  if (result.resources.length === 0) {
    console.log('No resources available.');
    return;
  }
  console.log('\nAvailable resources:');
  for (const res of result.resources) {
    console.log(`  ${res.uri}${res.name ? ` (${res.name})` : ''}${res.description ? ` - ${res.description}` : ''}`);
  }
}

async function readResource(client: Client, uri: string) {
  const result = await client.readResource({ uri });
  for (const content of result.contents) {
    if ('text' in content) {
      console.log(content.text);
    } else if ('blob' in content) {
      console.log(`[Binary content: ${content.mimeType ?? 'application/octet-stream'}]`);
    }
  }
}

async function interactiveMode(client: Client, _serverCaps: unknown) {
  const rl = readline.createInterface({ input, output, terminal: true });

  console.log('\nInteractive mode. Available commands:');
  console.log('  /tools            - List available tools');
  console.log('  /call <name>      - Call a tool (prompts for args)');
  console.log('  /resources        - List available resources');
  console.log('  /read <uri>       - Read a resource');
  console.log('  /help             - Show this help');
  console.log('  /quit             - Exit');

  while (true) {
    const line = await rl.question('> ');
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed === '/quit' || trimmed === '/exit' || trimmed === 'exit') break;

    if (trimmed === '/help') {
      console.log('Commands: /tools, /call <name>, /resources, /read <uri>, /help, /quit');
      continue;
    }

    if (trimmed === '/tools') {
      await listTools(client);
      continue;
    }

    if (trimmed.startsWith('/call ')) {
      const name = trimmed.slice(6).trim();
      if (!name) {
        console.log('Usage: /call <tool-name>');
        continue;
      }
      const argsLine = await rl.question(`Arguments (JSON) for "${name}": `);
      let args: Record<string, unknown> = {};
      if (argsLine.trim()) {
        try {
          args = JSON.parse(argsLine.trim());
        } catch {
          console.log('Invalid JSON. Sending empty arguments.');
        }
      }
      await callTool(client, name, args);
      continue;
    }

    if (trimmed === '/resources') {
      await listResources(client);
      continue;
    }

    if (trimmed.startsWith('/read ')) {
      const uri = trimmed.slice(6).trim();
      if (!uri) {
        console.log('Usage: /read <resource-uri>');
        continue;
      }
      await readResource(client, uri);
      continue;
    }

    console.log('Unknown command. Type /help for available commands.');
  }

  rl.close();
}
