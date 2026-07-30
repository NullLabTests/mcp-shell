# mcp-shell

A universal **MCP (Model Context Protocol) client** for the terminal. Connect to any MCP server via **stdio**, **SSE**, **Streamable HTTP**, or **WebSocket** — list tools, call them, browse resources, or drop into interactive mode.

```bash
npx mcp-shell connect --stdio "npx @modelcontextprotocol/server-filesystem /tmp"
```

## Features

- **4 transport types** — stdio (subprocess), SSE, Streamable HTTP, WebSocket
- **Tool introspection** — list available tools with their input schemas
- **Tool calling** — invoke tools with JSON arguments
- **Resource access** — list and read resources
- **Interactive REPL** — explore servers in real time
- **Config files** — save server definitions as JSON
- **No API keys required** for many servers (filesystem, SQLite, memory, Open Library books, etc.)
- **Build your own** MCP server and use it immediately — example in `examples/books-mcp/`

## Quick Start

```bash
# List tools from a filesystem server
npx mcp-shell connect --stdio "npx @modelcontextprotocol/server-filesystem /tmp"

# Call a tool
npx mcp-shell connect \
  --stdio "npx @modelcontextprotocol/server-filesystem /tmp" \
  --call-tool list_directory \
  --tool-args '{"path":"/tmp"}'

# Interactive mode — explore any server
npx mcp-shell connect \
  --stdio "npx @modelcontextprotocol/server-sequential-thinking" \
  --interactive
```

## Transport Types

### stdio — local subprocess

Spawns a server process and communicates over stdin/stdout.

```bash
npx mcp-shell connect --stdio "npx @modelcontextprotocol/server-filesystem /tmp"
npx mcp-shell connect --stdio "npx @modelcontextprotocol/server-sqlite ./data.db"
npx mcp-shell connect --stdio "npx @modelcontextprotocol/server-everything"
npx mcp-shell connect --stdio "npx @modelcontextprotocol/server-sequential-thinking"
npx mcp-shell connect --stdio "npx @modelcontextprotocol/server-memory"
```

Pass environment variables inline:

```bash
GITHUB_TOKEN=ghp_xxx npx mcp-shell connect \
  --stdio "npx @modelcontextprotocol/server-github"
```

### SSE — remote server via Server-Sent Events

```bash
npx mcp-shell connect --sse https://example.com/mcp/sse
```

### Streamable HTTP — newer MCP HTTP transport

```bash
npx mcp-shell connect --streamable-http https://example.com/mcp
```

### WebSocket

```bash
npx mcp-shell connect --ws wss://example.com/mcp
```

## Interactive Mode

Start with `-i` or `--interactive` to get a REPL:

```
> /tools              List all available tools
> /call list_directory  Call a tool (you'll be prompted for JSON args)
> /resources          List all resources
> /read file:///foo   Read a resource by URI
> /help               Show help
> /quit               Exit
```

## Config Files

Save server definitions and reuse them:

```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["@modelcontextprotocol/server-filesystem", "/tmp"]
}
```

```bash
npx mcp-shell connect --config ./servers/filesystem.json --list-tools
```

## Example: GitHub

List issues from a repo using the [GitHub MCP server](https://github.com/github/github-mcp-server):

```bash
GITHUB_TOKEN=$(gh auth token) npx mcp-shell connect \
  --stdio "npx @modelcontextprotocol/server-github" \
  --call-tool list_issues \
  --tool-args '{"owner":"github","repo":"github-mcp-server","per_page":5}'
```

> Never hardcode tokens. Use environment variables or `gh auth token`.

## Example: Open Library Books

Search books, get author bios, browse by subject, and see what's trending — no login or API key needed, powered by the [Open Library API](https://openlibrary.org/developers/api):

> First build the server: `cd examples/books-mcp && npm install && npm run build`

```bash
# Trending books this week
npx mcp-shell connect \
  --stdio "node examples/books-mcp/dist/index.js" \
  --call-tool get_trending \
  --tool-args '{"timeframe":"weekly","limit":5}'

# Search for books on any topic
npx mcp-shell connect \
  --stdio "node examples/books-mcp/dist/index.js" \
  --call-tool search_books \
  --tool-args '{"query":"neuroscience","limit":5}'

# Dive into a specific book by its Open Library work ID
npx mcp-shell connect \
  --stdio "node examples/books-mcp/dist/index.js" \
  --call-tool get_book \
  --tool-args '{"id":"OL27448W"}'

# Browse by subject
npx mcp-shell connect \
  --stdio "node examples/books-mcp/dist/index.js" \
  --call-tool search_subjects \
  --tool-args '{"subject":"space","limit":5}'

# Get author biography and notable works
npx mcp-shell connect \
  --stdio "node examples/books-mcp/dist/index.js" \
  --call-tool get_author \
  --tool-args '{"id":"OL34221A"}'
```

## Build Your Own MCP Server

An MCP server is just a program that speaks JSON-RPC over stdin/stdout (or HTTP). The repo includes a working example at [`examples/books-mcp/`](examples/books-mcp/) — a complete MCP server that wraps the free Open Library API.

```bash
cd examples/books-mcp
npm install && npm run build

# Run it standalone (prints "books-mcp running on stdio")
node dist/index.js

# Or connect through mcp-shell
npx mcp-shell connect --stdio "node examples/books-mcp/dist/index.js" --list-tools
```

To create your own, use the [`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk):

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer(
  { name: 'my-server', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.registerTool('hello', {
  description: 'A friendly greeting',
  inputSchema: { name: z.string().describe('Your name') },
}, async ({ name }) => ({
  content: [{ type: 'text', text: `Hello, ${name}!` }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Available Commands

```
Usage: mcp-shell connect [options]

Options:
  -s, --stdio <command>      Connect via stdio
  --sse <url>                Connect via SSE
  --streamable-http <url>    Connect via Streamable HTTP
  --ws <url>                 Connect via WebSocket
  --config <path>            Path to MCP config JSON file
  --list-tools               List available tools and exit
  --call-tool <name>         Call a tool
  --tool-args <json>         JSON arguments for the tool call
  --list-resources           List available resources and exit
  --read-resource <uri>      Read a resource by URI
  -i, --interactive          Start interactive REPL mode
  -h, --help                 Display help
```

## Local Development

```bash
git clone https://github.com/NullLabTests/mcp-shell.git
cd mcp-shell
npm install
npm run build

# Run from source
npm start -- connect --stdio "npx @modelcontextprotocol/server-everything"
# or
npx tsx src/index.ts connect --stdio "npx @modelcontextprotocol/server-everything"
```

## Why mcp-shell?

MCP is the emerging standard for connecting LLMs to tools and data. `mcp-shell` gives you a universal, terminal-native client to explore and interact with any MCP server — whether you're debugging a server you're building, testing a remote endpoint, or wiring up tools for an AI workflow.

## License

MIT
