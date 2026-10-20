# Plaeta, ready to put online (website + app)

This folder is the whole site, already built. Cloudflare has nothing to compile.

- `dist/` holds the website (`index.html`, `start.html`, `privacy.html`, `terms.html`) and the app in `dist/app/`.
  The website is at the main address, and the app is at `/app/`.
- `dist/config.js` holds the website's prices, plan limits and contact email. Edit that file to change them.
- `functions/api/` is the server (`/api/ai-proxy`, `/api/ai-config`, `/api/gemini/...`, `/api/account`,
  `/api/report`, `/api/billing-webhook`).
- `wrangler.toml` tells Cloudflare to publish `dist/` and run the server.

The GitHub main page should show exactly: `dist`, `functions`, `README.md`, `package-lock.json`, `package.json`,
`wrangler.toml`.

Cloudflare Pages settings: framework preset **None**, build command **npm run build**, build output directory
**dist**, root directory left empty.

Which AI the app uses is set by `AI_PROVIDER` in `wrangler.toml` (`gemini` for the free trial, `anthropic` for
Claude). The keys are Secrets in Cloudflare, under Settings, then Variables and Secrets, and never go in these files:

| Secret | What it does |
|---|---|
| `GEMINI_API_KEY` | One shared Gemini key for all testers |
| `ANTHROPIC_API_KEY` | Claude's key, for when you switch to `anthropic` |

To change the app itself, edit the source (`plaeta-v5-upload-source.zip`) and make a new copy of this folder from it.
