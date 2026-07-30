import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const OPEN_LIBRARY = 'https://openlibrary.org';

async function fetchJSON(url: string) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'books-mcp/1.0' },
  });
  if (!res.ok) {
    throw new Error(`Open Library API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

const server = new McpServer(
  { name: 'books-mcp', version: '1.0.0' },
  {
    capabilities: { tools: {} },
    instructions: 'Search books, get author info, browse subjects — powered by the free Open Library API. No API keys required.',
  },
);

server.registerTool('search_books', {
  description: 'Search for books by title, author, or subject',
  inputSchema: {
    query: z.string().describe('Search query (e.g. "Dune", "Asimov", "physics")'),
    limit: z.number().min(1).max(100).default(10).describe('Number of results (max 100)'),
  },
}, async ({ query, limit }) => {
  const data = await fetchJSON(`${OPEN_LIBRARY}/search.json?q=${encodeURIComponent(query)}&limit=${limit}`);
  const docs = data.docs ?? [];
  if (docs.length === 0) {
    return { content: [{ type: 'text' as const, text: 'No books found.' }] };
  }
  const lines = docs.map((d: Record<string, unknown>, i: number) => {
    const title = (d.title as string) ?? 'Unknown';
    const author = Array.isArray(d.author_name) ? (d.author_name as string[]).join(', ') : 'Unknown author';
    const year = d.first_publish_year ?? '';
    const key = d.key as string;
    return `${i + 1}. **${title}** — ${author}${year ? ` (${year})` : ''}\n   https://openlibrary.org${key}`;
  });
  return {
    content: [{ type: 'text' as const, text: lines.join('\n') }],
  };
});

server.registerTool('get_book', {
  description: 'Get detailed information about a specific book by Open Library work ID (e.g. "OL27448W" or "/works/OL27448W")',
  inputSchema: {
    id: z.string().describe('Open Library work ID (e.g. "OL27448W" or "/works/OL27448W")'),
  },
}, async ({ id }) => {
  const clean = id.replace(/^\/works\//, '');
  const data = await fetchJSON(`${OPEN_LIBRARY}/works/${clean}.json`);
  const parts: string[] = [];
  parts.push(`# ${data.title ?? 'Unknown'}`);
  if (data.description) {
    const desc = typeof data.description === 'object' ? data.description.value : data.description;
    parts.push(`\n${truncate(desc, 2000)}`);
  }
  if (data.subjects?.length) {
    parts.push(`\n**Subjects:** ${(data.subjects as string[]).slice(0, 10).join(', ')}`);
  }
  if (data.subject_places?.length) {
    parts.push(`\n**Places:** ${(data.subject_places as string[]).slice(0, 5).join(', ')}`);
  }
  if (data.subject_people?.length) {
    parts.push(`\n**People:** ${(data.subject_people as string[]).slice(0, 5).join(', ')}`);
  }
  if (data.excerpts?.length) {
    const ex = data.excerpts[0] as Record<string, unknown>;
    if (ex.excerpt) parts.push(`\n> ${truncate(ex.excerpt as string, 500)}`);
  }
  if (data.links?.length) {
    parts.push('\n**Links:**');
    for (const link of data.links as Array<{ url: string; title?: string }>) {
      parts.push(`- ${link.title ?? link.url}: ${link.url}`);
    }
  }
  parts.push(`\n📖 https://openlibrary.org/works/${clean}`);
  return { content: [{ type: 'text' as const, text: parts.join('\n') }] };
});

server.registerTool('get_author', {
  description: 'Get information about an author by Open Library author ID (e.g. "OL34221A" or "/authors/OL34221A")',
  inputSchema: {
    id: z.string().describe('Open Library author ID (e.g. "OL34221A" or "/authors/OL34221A")'),
  },
}, async ({ id }) => {
  const clean = id.replace(/^\/authors\//, '');
  const data = await fetchJSON(`${OPEN_LIBRARY}/authors/${clean}.json`);
  const parts: string[] = [];
  parts.push(`# ${data.name ?? 'Unknown'}`);
  if (data.birth_date || data.death_date) {
    parts.push(`\n**Lived:** ${data.birth_date ?? '?'} — ${data.death_date ?? 'present'}`);
  }
  if (data.bio) {
    const bio = typeof data.bio === 'object' ? data.bio.value : data.bio;
    parts.push(`\n${truncate(bio, 2000)}`);
  }
  if (data.wikipedia) {
    parts.push(`\n📝 Wikipedia: ${data.wikipedia}`);
  }
  if (data.remote_ids?.viaf) {
    parts.push(`\n🔗 VIAF: https://viaf.org/viaf/${data.remote_ids.viaf}`);
  }
  parts.push(`\n📖 https://openlibrary.org/authors/${clean}`);
  const works = await fetchJSON(`${OPEN_LIBRARY}/authors/${clean}/works.json?limit=10`);
  if (works.entries?.length) {
    parts.push('\n\n**Notable works:**');
    for (const w of works.entries as Array<{ title: string; first_publish_year?: number }>) {
      parts.push(`- ${w.title}${w.first_publish_year ? ` (${w.first_publish_year})` : ''}`);
    }
  }
  return { content: [{ type: 'text' as const, text: parts.join('\n') }] };
});

server.registerTool('search_subjects', {
  description: 'Browse books by subject (e.g. "science_fiction", "fantasy", "history", "philosophy")',
  inputSchema: {
    subject: z.string().describe('Subject name (e.g. "science_fiction", "fantasy", "history", "love", "space")'),
    limit: z.number().min(1).max(50).default(10).describe('Number of results (max 50)'),
  },
}, async ({ subject, limit }) => {
  const data = await fetchJSON(`${OPEN_LIBRARY}/subjects/${encodeURIComponent(subject.toLowerCase())}.json?limit=${limit}`);
  if (!data.works?.length) {
    return { content: [{ type: 'text' as const, text: `No books found for subject "${subject}".` }] };
  }
  const lines = [
    `# ${data.name ?? subject}`,
    `${data.work_count ?? data.works.length} books\n`,
  ];
  for (const w of data.works as Array<{ title: string; authors?: Array<{ name: string }>; first_publish_year?: number }>) {
    const author = w.authors?.map(a => a.name).join(', ') ?? 'Unknown';
    lines.push(`- **${w.title}** — ${author}${w.first_publish_year ? ` (${w.first_publish_year})` : ''}`);
  }
  return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
});

server.registerTool('get_trending', {
  description: 'Get currently trending books on Open Library',
  inputSchema: {
    timeframe: z.enum(['daily', 'weekly', 'monthly']).default('weekly').describe('Trending timeframe'),
    limit: z.number().min(1).max(20).default(5).describe('Number of results (max 20)'),
  },
}, async ({ timeframe, limit }) => {
  const data = await fetchJSON(`${OPEN_LIBRARY}/trending/${timeframe}.json?limit=${limit}`);
  const works = data.works ?? [];
  if (works.length === 0) {
    return { content: [{ type: 'text' as const, text: 'No trending books found.' }] };
  }
  const lines = [`# 🔥 Trending ${timeframe} on Open Library\n`];
  for (const w of works as Array<{ title: string; author_name?: string[]; first_publish_year?: number; key: string }>) {
    const author = w.author_name?.join(', ') ?? 'Unknown';
    lines.push(`- **${w.title}** — ${author}${w.first_publish_year ? ` (${w.first_publish_year})` : ''}`);
  }
  return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
