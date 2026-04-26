<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Environment Boundary

- `discord-bot/` is not part of the MacBook dashboard build boundary.
- The Discord bot runs on the Mac mini, not on this machine by default.
- Validate `discord-bot/` on the Mac mini with Bun. Do not treat missing `bun-types` or other Bun-only dependencies on the MacBook as a repo-wide runtime failure.

# Obsidian Write Governance

Before any agent writes Markdown into the Obsidian vault, it must read and
follow the shared vault contracts:

- `/Users/cyclone/Library/CloudStorage/GoogleDrive-cyclonetw@gmail.com/我的雲端硬碟/Obsidian-Cyclone/000_Agent/PROJECT_ROUTING.md`
- `/Users/cyclone/Library/CloudStorage/GoogleDrive-cyclonetw@gmail.com/我的雲端硬碟/Obsidian-Cyclone/000_Agent/OBSIDIAN_METADATA_SCHEMA.md`

CycloneOS engineering changes happen in this repo. Obsidian is for project
memory, plans, logs, handoffs, and references. Do not create new top-level vault
folders or invent frontmatter fields. If the destination is unclear, write to
`_Agent-Inbox/` with `status: needs-review`.
