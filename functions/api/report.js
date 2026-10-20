// config/app.json
var app_default = {
  _about: "App-wide switches. Change these, not the code.",
  version: "4.0.0-trial",
  accounts: { enabled: false },
  paperTestButton: "localhost-only",
  simulatedProvider: "localhost-only",
  defaultSpelling: "en-AU",
  referral: { enabled: false }
};

// server/lib/supabase-client.js
var SupabaseError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
};
var OPS = ["eq", "neq", "lt", "lte", "gt", "gte", "is", "in"];
var lit = (v) => v === null ? "null" : v === true ? "true" : v === false ? "false" : String(v);
function filterQuery(filters = {}) {
  const q = new URLSearchParams();
  for (const [col, cond] of Object.entries(filters)) {
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      for (const [op, v] of Object.entries(cond)) {
        if (!OPS.includes(op)) throw new Error("Unknown filter " + op);
        q.append(col, op === "in" ? `in.(${v.map((x) => `"${String(x).replace(/"/g, "")}"`).join(",")})` : `${op}.${lit(v)}`);
      }
    } else q.append(col, cond === null ? "is.null" : `eq.${lit(cond)}`);
  }
  return q;
}
function createSupabase({ url, serviceKey, fetch: f = globalThis.fetch } = {}) {
  if (!url || !serviceKey) throw new SupabaseError("Supabase is not set up (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).", 503);
  const base = url.replace(/\/+$/, "");
  const headers = (extra = {}) => Object.assign({ apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" }, extra);
  async function call(path, { method = "GET", body, extra } = {}) {
    const res = await f(base + path, { method, headers: headers(extra), body: body === void 0 ? void 0 : JSON.stringify(body) });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = text;
    }
    if (!res.ok) throw new SupabaseError(data && (data.message || data.msg || data.error_description || data.error) || `Supabase request failed (${res.status})`, res.status);
    return data;
  }
  const rest = (table, q) => `/rest/v1/${encodeURIComponent(table)}${q && String(q) ? "?" + q : ""}`;
  return {
    async select(table, filters, { columns = "*", limit, order } = {}) {
      const q = filterQuery(filters);
      q.set("select", columns);
      if (limit) q.set("limit", String(limit));
      if (order) q.set("order", order);
      return call(rest(table, q));
    },
    async insert(table, rows, { upsert = false, onConflict, ignoreDuplicates = false } = {}) {
      const q = new URLSearchParams();
      if (onConflict) q.set("on_conflict", onConflict);
      const prefer = ["return=representation"];
      if (upsert) prefer.push(ignoreDuplicates ? "resolution=ignore-duplicates" : "resolution=merge-duplicates");
      return call(rest(table, q), { method: "POST", body: Array.isArray(rows) ? rows : [rows], extra: { prefer: prefer.join(",") } });
    },
    async update(table, filters, patch) {
      if (!filters || !Object.keys(filters).length) throw new Error("update needs a filter");
      return call(rest(table, filterQuery(filters)), { method: "PATCH", body: patch, extra: { prefer: "return=representation" } });
    },
    async remove(table, filters) {
      if (!filters || !Object.keys(filters).length) throw new Error("remove needs a filter");
      return call(rest(table, filterQuery(filters)), { method: "DELETE", extra: { prefer: "return=representation" } });
    },
    storage: {
      async remove(bucket, paths) {
        if (!paths.length) return [];
        return call(`/storage/v1/object/${encodeURIComponent(bucket)}`, { method: "DELETE", body: { prefixes: paths } });
      },
      // every file under prefix, folders included (Storage lists one folder at a time; folders have no id)
      async list(bucket, prefix) {
        const out = [];
        const walk = async (dir, depth) => {
          const rows = await call(`/storage/v1/object/list/${encodeURIComponent(bucket)}`, { method: "POST", body: { prefix: dir, limit: 1e3 } });
          for (const r of rows || []) {
            const path = `${dir}/${r.name}`;
            if (r.id == null && depth < 6) await walk(path, depth + 1);
            else out.push(path);
          }
        };
        await walk(prefix.replace(/\/+$/, ""), 0);
        return out;
      }
    },
    auth: {
      async getUser(jwt) {
        const res = await f(base + "/auth/v1/user", { headers: { apikey: serviceKey, authorization: `Bearer ${jwt}` } });
        if (!res.ok) return null;
        const u = await res.json();
        return u && u.id ? u : null;
      },
      createUser: ({ email, password }) => call("/auth/v1/admin/users", { method: "POST", body: { email, password, email_confirm: false } }),
      signIn: (email, password) => call("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } }),
      deleteUser: (id) => call(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" })
    }
  };
}

// server/lib/stripe-client.js
var StripeError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
};
var enc = new TextEncoder();
function formEncode(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === void 0 || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") formEncode(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}
function createStripe({ secretKey, fetch: f = globalThis.fetch } = {}) {
  if (!secretKey) throw new StripeError("Stripe is not set up (STRIPE_SECRET_KEY).", 503);
  async function call(method, path, params) {
    const res = await f("https://api.stripe.com/v1" + path, {
      method,
      headers: { authorization: `Bearer ${secretKey}`, "content-type": "application/x-www-form-urlencoded" },
      body: params ? formEncode(params).toString() : void 0
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new StripeError(data && data.error && data.error.message || `Stripe request failed (${res.status})`, res.status);
    return data;
  }
  return {
    getSubscription: (id) => call("GET", `/subscriptions/${encodeURIComponent(id)}`),
    createCheckoutSession: ({ price, owner, successUrl, cancelUrl, planId }) => call("POST", "/checkout/sessions", {
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: owner,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { owner, plan: planId },
      subscription_data: { metadata: { owner, plan: planId } }
    }),
    // pause: payments stop until resumesAt (seconds); the subscription and the student's data stay
    pauseSubscription: (id, resumesAt) => call("POST", `/subscriptions/${encodeURIComponent(id)}`, { pause_collection: { behavior: "void", resumes_at: resumesAt } }),
    resumeSubscription: (id) => call("POST", `/subscriptions/${encodeURIComponent(id)}`, { pause_collection: "" }),
    // cancel at the end of the period already paid for (one step; no more payments)
    cancelSubscription: (id) => call("POST", `/subscriptions/${encodeURIComponent(id)}`, { cancel_at_period_end: true }),
    // straight away, used when the account is deleted
    cancelNow: (id) => call("DELETE", `/subscriptions/${encodeURIComponent(id)}`)
  };
}

// server/lib/accounts.js
var HttpError = class extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
};
var json = (status, body, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, headers)
});
var OFF_MESSAGE = "Accounts are switched off in this version.";
var accountsOff = () => json(503, { error: OFF_MESSAGE });
var envOf = (deps) => deps && deps.env || (typeof process !== "undefined" ? process.env : {});
var accountsOn = (deps) => deps && "enabled" in deps ? !!deps.enabled : !!app_default.accounts.enabled;
function resolveDeps(deps = {}) {
  const env = envOf(deps);
  const out = Object.assign({ env, now: () => Date.now() }, deps);
  if (!out.db) Object.defineProperty(out, "db", { get() {
    return this._db ||= createSupabase({ url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY });
  } });
  if (!out.stripe) Object.defineProperty(out, "stripe", { get() {
    return this._stripe ||= createStripe({ secretKey: env.STRIPE_SECRET_KEY });
  } });
  return out;
}
async function readJSON(request, maxBytes = 65536) {
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "That request is too big.");
  if (!text) return {};
  try {
    const v = JSON.parse(text);
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
  } catch (e) {
  }
  throw new HttpError(400, "That request could not be read.");
}
async function requireUser(request, db) {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") || "");
  if (!m) throw new HttpError(401, "Please sign in.");
  const user = await db.auth.getUser(m[1].trim());
  if (!user || !user.id) throw new HttpError(401, "Please sign in again.");
  return user;
}
var hits = /* @__PURE__ */ new Map();
function rateLimit(key, perMinute, now = Date.now()) {
  const list = (hits.get(key) || []).filter((t) => now - t < 6e4);
  if (list.length >= perMinute) throw new HttpError(429, "Too many requests. Please wait a minute and try again.");
  list.push(now);
  hits.set(key, list);
}
function endpoint(fn, { methods = ["POST"], alwaysOn = false } = {}) {
  return (deps) => async (request, context) => {
    const d = resolveDeps(deps);
    if (!alwaysOn && !accountsOn(d)) return accountsOff();
    if (!methods.includes(request.method)) return json(405, { error: "Method not allowed" }, { allow: methods.join(", ") });
    try {
      return await fn(request, d, context);
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, Object.assign({ error: e.message }, e.extra || {}));
      const status = e && e.status >= 400 && e.status < 600 ? e.status : 500;
      console.error("[account server]", e && e.message);
      return json(status >= 500 ? 500 : status, { error: status === 503 ? e.message : "Something went wrong on our side. Please try again later." });
    }
  };
}
var iso = (ms) => new Date(ms).toISOString();

// app/accounts/moderation.js
var SAFETY_MESSAGE = "It sounds like things might be hard right now. You do not have to deal with it alone: talk to someone you trust, such as a parent, carer, teacher or school counsellor. If you are in danger now, call your local emergency number (000 in Australia). In Australia you can call Kids Helpline on 1800 55 1800 or Lifeline on 13 11 14, any time. Plaeta is a study app and its AI is not a counsellor.";
var BLOCKED_MESSAGE = "This was not sent because it looks like content Plaeta does not allow. Plaeta is for study only.";
var PERSONAL = [
  { kind: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, sub: "[email removed]" },
  // +61 4xx xxx xxx, (02) 9xxx xxxx, 04xx xxx xxx, 1800 xxx xxx, 13 xx xx; needs a leading + or 0 or 1300/1800 so
  // ordinary numbers in maths and science answers are left alone
  { kind: "phone", re: /(?<![\w.^/])(?:\+\d{1,3}[ -]?(?:\(\d{1,4}\)[ -]?)?\d{1,4}(?:[ -]?\d{2,4}){2,4}|\(0\d\)[ -]?\d{4}[ -]?\d{4}|0[2-478][ -]?\d{4}[ -]?\d{4}|04\d{2}[ -]?\d{3}[ -]?\d{3}|1[38]00[ -]?\d{3}[ -]?\d{3})(?![\w.])/g, sub: "[phone removed]" },
  { kind: "address", re: /\b\d{1,5}[A-Za-z]?\s+(?:[A-Z][a-z]+\s){1,3}(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Crescent|Cres|Place|Pl|Lane|Ln|Parade|Pde|Terrace|Tce|Close|Way|Boulevard|Blvd|Highway|Hwy)\b\.?/g, sub: "[address removed]" },
  { kind: "dob", re: /\b(?:born on|date of birth|d\.?o\.?b\.?|my birthday is)\s*(?:is\s*)?:?\s*\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4}/gi, sub: "[date of birth removed]" }
];
function stripPersonal(text) {
  let out = String(text ?? "");
  const removed = [];
  for (const p of PERSONAL) {
    p.re.lastIndex = 0;
    if (p.re.test(out)) {
      removed.push(p.kind);
      p.re.lastIndex = 0;
      out = out.replace(p.re, p.sub);
    }
  }
  return { text: out, removed };
}
var SELF_HARM = [
  /\b(?:kill|hurt|harm|cut|cutting|starve|starving)\s+(?:myself|my\s?self)\b/i,
  /\b(?:i|i'm|im|i am)\s+(?:want|wanna|going|gonna|plan|planning|thinking about|thinking of)\s+(?:to\s+)?(?:die|end it|end my life|kill myself|suicide|commit suicide)\b/i,
  /\b(?:end|ending|take|taking)\s+my\s+(?:own\s+)?life\b/i,
  /\bi(?:'m| am)?\s*(?:feeling\s+)?suicidal\b/i,
  /\b(?:don'?t|do not|dont)\s+want\s+to\s+(?:live|be alive|be here|exist)(?:\s+any\s?more)?\b/i,
  /\bno\s+(?:reason|point)\s+(?:to|in)\s+(?:live|living|being alive)\b/i,
  /\bbetter\s+off\s+(?:dead|without me)\b/i,
  /\bself[-\s]?harm(?:ing)?\b(?=.*\b(?:i|me|my)\b)/i
];
var ABUSE = [
  /\b(?:he|she|they|my\s+\w+|someone|somebody)\s+(?:hits|hit|beats|beat|hurts|touches|touched|abuses|abused|threatens|threatened)\s+me\b/i,
  /\b(?:i'm|i am|im|i've been|i have been|being)\s+(?:abused|molested|assaulted|groomed|bullied|threatened|blackmailed)\b/i,
  /\b(?:i|i'm|im|i am)\s+(?:do\s+not|don'?t|not|never)\s+(?:feel\s+)?safe\s+at\s+home\b/i,
  /\bafraid\s+to\s+go\s+home\b/i
];
var SEXUAL = [
  /\bporn(?:o|ography|ographic)?\b/i,
  /\b(?:send|sending|share|sharing)\s+(?:me\s+)?nudes?\b/i,
  /\bnudes\b/i,
  /\bsext(?:ing|s)?\b/i,
  /\b(?:blow|hand)\s?jobs?\b/i,
  /\b(?:erotic|sexual)\s+(?:role[-\s]?play|story|stories|fantasy|fantasies)\b/i,
  /\b(?:have|having)\s+sex\s+with\s+(?:me|you)\b/i,
  /\bhorny\b/i
];
var test = (list, text) => list.some((re) => re.test(text));
function checkText(text) {
  const t = String(text ?? "");
  if (!t.trim()) return { category: null, reason: "" };
  if (test(SEXUAL, t)) return { category: "sexual", reason: "sexual content" };
  if (test(SELF_HARM, t)) return { category: "self-harm", reason: "self-harm words" };
  if (test(ABUSE, t)) return { category: "abuse", reason: "words about being hurt or unsafe" };
  return { category: null, reason: "" };
}
function moderateInput(text, { where = "input" } = {}) {
  const s = stripPersonal(text);
  const c = checkText(text);
  let action = "allow", message = "";
  if (c.category === "sexual" && where !== "report") {
    action = "block";
    message = BLOCKED_MESSAGE;
  } else if (c.category === "self-harm" || c.category === "abuse") {
    action = "safety";
    message = SAFETY_MESSAGE;
  }
  const proceed = action === "allow" || action === "safety" && where !== "tutor";
  return { text: s.text, removed: s.removed, category: c.category, reason: c.reason, action, proceed, message };
}
function moderationRecord({ where, action, category, reason, removed, task }, now = Date.now()) {
  const bits = [];
  if (category) bits.push(category);
  if (removed && removed.length) bits.push("removed " + removed.join(", "));
  if (reason && !category) bits.push(reason);
  return { at: now, where: String(where || task || "input").slice(0, 40), action: action === "allow" && removed && removed.length ? "strip" : action, reason: bits.join("; ").slice(0, 120) };
}
var worthLogging = (m) => !!(m && (m.action !== "allow" || m.removed && m.removed.length));

// server/lib/moderation.js
async function logModeration(db, owner, m, where) {
  if (!db || !owner || !worthLogging(m)) return null;
  const r = moderationRecord(Object.assign({}, m, { where }));
  try {
    const [row] = await db.insert("moderation_log", { owner, at: new Date(r.at).toISOString(), where_used: r.where, action: r.action, reason: r.reason });
    return row;
  } catch (e) {
    console.error("[moderation] could not write the log", e && e.message);
    return null;
  }
}

// server/functions/report.js
var KINDS = ["problem", "unsafe", "wrong-mark"];
var MAX = 2e3;
var clip = (v, n) => v == null ? null : String(v).slice(0, n);
var makeHandler = endpoint(async (request, d) => {
  const user = await requireUser(request, d.db);
  rateLimit(`report:${user.id}`, 5, d.now());
  const body = await readJSON(request, 16384);
  const text = String(body.text || "").trim().slice(0, MAX);
  if (!text) throw new HttpError(400, "Please say what happened.");
  const kind = KINDS.includes(body.kind) ? body.kind : "problem";
  const m = moderateInput(text, { where: "report" });
  await logModeration(d.db, user.id, m, "report");
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  const urgent = m.category === "self-harm" || m.category === "abuse";
  const [row] = await d.db.insert("reports", {
    owner: user.id,
    at: iso(d.now()),
    kind,
    text: m.text,
    urgent,
    status: "new",
    context: { view: clip(ctx.view, 40), sub: clip(ctx.sub, 80), ref: clip(ctx.ref, 80) }
  });
  return json(200, { ok: true, id: row && row.id, safety: urgent ? SAFETY_MESSAGE : null });
});
var report_default = makeHandler();

// functions/api/_serve.js
function serve(handler) {
  return async (context) => {
    const env = context.env || {};
    const pe = globalThis.process && globalThis.process.env;
    if (pe) {
      for (const [k, v] of Object.entries(env)) if (typeof v === "string" && pe[k] === void 0) pe[k] = v;
    }
    return handler(context.request, { env, waitUntil: context.waitUntil });
  };
}

// functions/api/report.js
var onRequest = serve(report_default);
export {
  onRequest
};
