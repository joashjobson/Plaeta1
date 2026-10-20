# Plaeta, ready to put online

This folder is the whole site, already built from the stage 2 key-fix source. Cloudflare has nothing to compile, so
the build can't fail on missing folders.

- `dist/` is the app (the screens).
- `functions/api/` is the server (`/api/account`, `/api/ai-proxy`, `/api/report`, `/api/billing-webhook`).
- `wrangler.toml` tells Cloudflare to publish `dist/` and run the server.

The GitHub main page should show exactly: `dist`, `functions`, `README.md`, `package-lock.json`, `package.json`,
`wrangler.toml`. No other folders.

Cloudflare Pages settings: framework preset **None**, build command **npm run build**, build output directory
**dist**, root directory left empty.

To change the app, edit the source (plaeta-v5-stage2-keyfix-source.zip) and make a new copy of this folder from it.
