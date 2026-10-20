// server/lib/ai-mode.js
function aiMode(env = {}) {
  const want = String(env.AI_PROVIDER || "").trim().toLowerCase();
  const gemini = !!String(env.GEMINI_API_KEY || "").trim(), anthropic = !!String(env.ANTHROPIC_API_KEY || "").trim();
  const provider = ["gemini", "anthropic"].includes(want) ? want : anthropic ? "anthropic" : gemini ? "gemini" : null;
  return { provider, sharedGemini: provider === "gemini" && gemini };
}

// server/functions/ai-config.js
async function handler(req, ctx = {}) {
  const env = ctx && ctx.env || globalThis.process && process.env || {};
  if (req.method !== "GET") return new Response(JSON.stringify({ error: { code: "blocked", message: "Use GET." } }), { status: 405, headers: { "content-type": "application/json" } });
  return new Response(JSON.stringify(aiMode(env)), { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

// functions/api/_serve.js
function serve(handler2) {
  return async (context) => {
    const env = context.env || {};
    const pe = globalThis.process && globalThis.process.env;
    if (pe) {
      for (const [k, v] of Object.entries(env)) if (typeof v === "string" && pe[k] === void 0) pe[k] = v;
    }
    return handler2(context.request, { env, waitUntil: context.waitUntil });
  };
}

// functions/api/ai-config.js
var onRequest = serve(handler);
export {
  onRequest
};
