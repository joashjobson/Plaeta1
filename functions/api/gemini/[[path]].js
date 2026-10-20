// server/lib/ai-mode.js
function aiMode(env = {}) {
  const want = String(env.AI_PROVIDER || "").trim().toLowerCase();
  const gemini = !!String(env.GEMINI_API_KEY || "").trim(), anthropic = !!String(env.ANTHROPIC_API_KEY || "").trim();
  const provider = ["gemini", "anthropic"].includes(want) ? want : anthropic ? "anthropic" : gemini ? "gemini" : null;
  return { provider, sharedGemini: provider === "gemini" && gemini };
}

// server/functions/gemini.js
var GOOGLE = "https://generativelanguage.googleapis.com/v1beta";
var MAX_BODY = 20 * 1048576;
var MODEL = /^models\/(gemini-[a-z0-9.-]{1,60}):generateContent$/;
var json = (status, name, message) => new Response(JSON.stringify({ error: { code: status, status: name, message } }), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
async function handler(req, ctx = {}) {
  const env = ctx && ctx.env || globalThis.process && process.env || {};
  const mode = aiMode(env);
  if (!mode.sharedGemini) return json(404, "NOT_FOUND", "This site has no shared Gemini key. Add your own key in Settings.");
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  if (origin && origin !== url.origin) return json(403, "PERMISSION_DENIED", "Not allowed.");
  const path = url.pathname.replace(/^\/api\/gemini\/?/, "");
  const key = String(env.GEMINI_API_KEY).trim();
  let target, init;
  if (req.method === "GET" && path === "models") {
    target = `${GOOGLE}/models?pageSize=200`;
    init = { method: "GET", headers: { "x-goog-api-key": key } };
  } else if (req.method === "POST" && MODEL.test(path)) {
    const len = +(req.headers.get("content-length") || 0);
    if (len > MAX_BODY) return json(413, "INVALID_ARGUMENT", "This request is too big.");
    const body = await req.text();
    if (body.length > MAX_BODY) return json(413, "INVALID_ARGUMENT", "This request is too big.");
    target = `${GOOGLE}/models/${encodeURIComponent(MODEL.exec(path)[1])}:generateContent`;
    init = { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body };
  } else return json(404, "NOT_FOUND", "Not found.");
  let res;
  try {
    res = await globalThis.fetch(target, init);
  } catch (e) {
    return json(502, "UNAVAILABLE", "Could not reach Google Gemini.");
  }
  const text = (await res.text()).split(key).join("[key]");
  const headers = { "content-type": res.headers.get("content-type") || "application/json", "cache-control": "no-store" };
  const ra = res.headers.get("retry-after");
  if (ra) headers["retry-after"] = ra;
  return new Response(text, { status: res.status, headers });
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

// functions/api/gemini/[[path]].js
var onRequest = serve(handler);
export {
  onRequest
};
