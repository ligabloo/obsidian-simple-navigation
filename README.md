# Simple Navigation

A simple left sidebar panel for Obsidian (desktop and mobile), opened on demand from the ribbon or the "Open panel" command.

- **Daily notes**: recognized notes from the core Daily Notes plugin (folder + date format), newest first, 30 at a time. The button opens or creates today's note (using the configured template). Periodic Notes is not used.
- **Notes**: all markdown and canvas files (excluding daily notes), most recently edited first, grouped Today / This week (Monday start) / Earlier. A breadcrumb filters by folder and its descendants. Buttons create a note or canvas ("Sem título", with a numeric suffix on collision).
- **Bases**: `.base` files alphabetically. New Base is created in the filtered folder, else the active file's folder, else the vault root.

Tabs for disabled core plugins (Daily Notes, Bases) are hidden. If Daily Notes is enabled but its settings can't be read, the tab is hidden and a notice appears when the panel opens.

## Development

```bash
npm install
npm run dev     # watch
npm run build   # typecheck + bundle
npm run lint
npm test
```
