<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Environment Boundary

- `discord-bot/` is not part of the MacBook dashboard build boundary.
- The Discord bot runs on the Mac mini, not on this machine by default.
- Validate `discord-bot/` on the Mac mini with Bun. Do not treat missing `bun-types` or other Bun-only dependencies on the MacBook as a repo-wide runtime failure.
