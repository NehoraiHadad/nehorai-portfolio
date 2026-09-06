# Nehorai Hadad — AI Engineer Portfolio

Source for **[ai.nehoraihadad.com](https://ai.nehoraihadad.com)** and the front door at
**[nehoraihadad.com](https://nehoraihadad.com)** — grounded AI agents, orchestration systems,
production full-stack work, and open-source contributions.

## Repository layout

| Path       | What it is                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `app/`     | Next.js App Router — the AI portfolio, localized routes, admin area, PDF and public-quote rendering |
| `landing/` | Astro site for the root domain, deployed to Cloudflare Workers                                       |
| `lib/`     | Shared domain logic and data access                                                                  |
| `scripts/` | Operational scripts (token creation, maintenance)                                                    |

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Drizzle ORM on Neon Postgres ·
NextAuth · Vercel AI SDK · MCP server endpoint (`mcp-handler`) · Resend for transactional mail ·
Puppeteer for PDF generation · Astro + Cloudflare Workers for the landing site.

## Development

```bash
pnpm install
pnpm dev            # Next.js app
pnpm db:push        # apply schema to the database
pnpm db:studio      # Drizzle Studio
pnpm lint
```

The landing site is a separate workspace:

```bash
cd landing && pnpm install && pnpm dev
```

## Environment

Database, auth and mail credentials are read from the environment. See `drizzle.config.ts`,
`auth.ts` and the `app/api` routes for the variables each area expects.

## License

Personal project — not licensed for reuse.
