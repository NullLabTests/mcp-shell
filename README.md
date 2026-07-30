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
- **No API keys required** for many servers (filesystem, SQLite, memory, etc.)

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
