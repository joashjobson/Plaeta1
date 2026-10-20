// config/plans.json
var plans_default = {
  _about: "Plans, prices and allowances. Prices are AUD per month. Nothing in the code hardcodes a price or a number of papers.",
  currency: "AUD",
  trialPlan: "standard",
  plans: [
    { id: "basic", name: "Basic", priceMonthly: 12, papersPerMonth: 10, examBoost: false, popular: false, stripePriceId: null },
    { id: "standard", name: "Standard", priceMonthly: 22, papersPerMonth: 20, examBoost: true, popular: true, stripePriceId: null },
    { id: "full", name: "Full", priceMonthly: 33, papersPerMonth: 30, examBoost: true, popular: false, stripePriceId: null }
  ],
  examBoost: { multiplier: 2, daysBeforeExam: 14 },
  pause: { maxMonths: 2, keepData: true },
  cancel: { steps: 1, offerExportFirst: true },
  refund: { paperOnOurError: true },
  launchEstimates: {
    _about: "Worked out on 16 Oct 2026 at the prices in models.json. The real-paper test on Anthropic should replace these with logged numbers.",
    audPerUsd: 1.4434,
    usdPerAud: 0.6928,
    aiCostPerPaperAud: { mathsScience: 0.29, essay: 0.33 },
    otherAiPerStudentMonthAud: 0.3,
    stripe: { percent: 1.65, fixedAud: 0.3, billingPercent: 0.7 },
    supabaseProMonthlyAud: 36,
    targetMargin: 0.6
  }
};

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
var hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function hmacHex(secret, text) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
}
function sameText(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function verifyWebhook(rawBody, header, secret, { now = Date.now(), toleranceSec = 300 } = {}) {
  if (!secret) throw new StripeError("STRIPE_WEBHOOK_SECRET is not set", 500);
  if (!header) throw new StripeError("Missing Stripe-Signature header", 400);
  const parts = String(header).split(",").map((s) => s.trim().split("="));
  const t = (parts.find((p) => p[0] === "t") || [])[1];
  const sigs = parts.filter((p) => p[0] === "v1").map((p) => p[1] || "");
  if (!t || !/^\d+$/.test(t) || !sigs.length) throw new StripeError("Bad Stripe-Signature header", 400);
  if (Math.abs(now / 1e3 - Number(t)) > toleranceSec) throw new StripeError("Webhook timestamp is too old", 400);
  const expected = await hmacHex(secret, `${t}.${rawBody}`);
  if (!sigs.some((s) => sameText(s, expected))) throw new StripeError("Webhook signature does not match", 400);
  try {
    return JSON.parse(rawBody);
  } catch (e) {
    throw new StripeError("Webhook body is not JSON", 400);
  }
}
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
var fromUnix = (s) => s ? new Date(s * 1e3).toISOString() : null;

// config/limits.json
var limits_default = {
  _about: "Limits the app enforces. Change these, not the code.",
  paperExpiryDays: 60,
  upload: {
    acceptedTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
    maxFileMB: 60,
    maxPages: 120,
    maxImagesPerPaper: 120,
    renderWidthPx: 1400,
    printedLongEdgePx: 1600,
    figureLongEdgePx: 2200,
    pagesPerBatch: 8,
    pagesPerBatchMixed: 6,
    maxTokensPerHaikuRequest: 8e4,
    maxImagesPerRequest: 20,
    concurrency: 3
  },
  syllabus: { maxFileMB: 40, maxPages: 200, maxCharsPerCall: 6e4 },
  library: { maxFileMB: 40, maxPages: 300, maxTextMB: 5, maxFilesPerSubject: 200 },
  age: { minimum: 13, minimumWhileGemini: 18 },
  timetableDefaults: {
    schoolNightCapMin: 90,
    weekendCapMin: 180,
    blockMin: 45,
    breakMin: 10,
    warmupCards: 15,
    strictLock: true,
    aiTailorPerDay: 1
  },
  review: { leitnerDays: [1, 3, 7, 14, 30] },
  cards: { frontMaxWords: 10, backMaxWords: 25, quoteMaxWords: 30 },
  server: {
    perUserRequestsPerMinute: 30,
    perUserDailyTokenCeiling: 2e6,
    monthlySpendAlertUsd: 400
  }
};

// config/models.json
var models_default = {
  _about: "Which AI does which task. Switch provider here (or in the app's AI settings). Model IDs and prices were checked on 17 Oct 2026; re-check and update this file, not the code. defaultProvider is the mainstream app's AI (Claude through the app's server). noServerProvider is used when the app is opened from a file with no server (the one-file trial build), because the server is the only way to reach Claude.",
  defaultProvider: "anthropic",
  noServerProvider: "gemini",
  providers: ["gemini", "anthropic"],
  tasks: {
    READ_PAGES: "deep",
    READ_SOLUTIONS: "deep",
    MATCH_ANSWERS: "deep",
    CHECK_ITEMS: "deep",
    GRADE_ANSWER: "deep",
    GRADE_BATCH: "deep",
    GRADE_ESSAY: "deep",
    TAG_TOPICS: "quick",
    MAKE_CARD: "quick",
    DAY_PLAN: "quick",
    TOPICS_FROM_SYLLABUS: "quick",
    CLASSIFY_SUBJECT: "quick",
    TUTOR: "quick",
    MAKE_QUESTIONS: "quick",
    READ_NOTE: "quick",
    TOPICS_FROM_QUESTIONS: "quick",
    FOCUS_TOPICS: "quick",
    EXAM_FEEDBACK: "deep"
  },
  gemini: {
    _about: "Model IDs are not hardcoded: the app lists the models your key can use at start-up (and on 'Load models') and picks the newest stable Flash models for deep tasks and the newest Flash-Lite for quick ones. The lists below are only the fallback when that has not run yet.",
    keyUrl: "https://aistudio.google.com/apikey",
    chosen: { deep: [], quick: [] },
    fallback: { deep: ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"], quick: ["gemini-3.5-flash-lite"] },
    freeTierSeen: { date: "2026-10-09", flash: { rpm: 5, rpd: 20 }, flashLite: { rpm: 15, rpd: 500 } },
    thinking: { READ_PAGES: "minimal", READ_SOLUTIONS: "minimal", TAG_TOPICS: "minimal" },
    maxOutputTokens: { default: 8192, READ_PAGES: 16384, READ_SOLUTIONS: 16384, GRADE_BATCH: 12288 },
    gradeBatchSize: 10,
    neverDowngradeToQuick: ["READ_PAGES", "READ_SOLUTIONS", "MATCH_ANSWERS", "CHECK_ITEMS", "GRADE_ANSWER", "GRADE_BATCH", "GRADE_ESSAY"],
    busy: { retrySeconds: 5, allBusySeconds: 20, totalSeconds: 150, totalUploadSeconds: 360, benchSeconds: 600, benchSlowSeconds: 300, benchRateSeconds: 60, waitRateSeconds: 10 }
  },
  anthropic: {
    proxyPath: "/api/ai-proxy",
    _cache: "Prompt caching: the system prompt and the task's unchanging context are marked for a 5-minute cache, so the next request of the same paper, marking run or tutor chat reads them at a tenth of the price. A cache write costs 1.25 times the normal price, so tasks that run once on their own (cache: false) are not cached. The Batch API (half price, answers within hours) is not used: the student waits for every AI job in this app.",
    models: { haiku: "claude-haiku-5-5", sonnet: "claude-sonnet-5-5" },
    routing: {
      READ_PAGES: { model: "haiku", effort: "low", maxTokens: 16e3 },
      READ_SOLUTIONS: { model: "haiku", effort: "low", maxTokens: 16e3 },
      TAG_TOPICS: { model: "haiku", effort: "low", maxTokens: 4e3 },
      MATCH_ANSWERS: { model: "haiku", effort: "low", maxTokens: 4e3, cache: false },
      CHECK_ITEMS: { model: "sonnet", effort: "medium", maxTokens: 8e3, cache: false },
      GRADE_ANSWER: { model: "haiku", effort: "medium", maxTokens: 4e3, escalate: { below: 0.6, to: "sonnet" } },
      GRADE_BATCH: { model: "haiku", effort: "medium", maxTokens: 12e3, escalate: { below: 0.6, to: "sonnet" } },
      GRADE_ESSAY: { model: "sonnet", effort: "medium", maxTokens: 6e3, cache: false },
      MAKE_CARD: { model: "haiku", effort: "low", maxTokens: 2e3, cache: false },
      DAY_PLAN: { model: "haiku", effort: "low", maxTokens: 3e3, cache: false },
      TOPICS_FROM_SYLLABUS: { model: "haiku", effort: "low", maxTokens: 8e3 },
      CLASSIFY_SUBJECT: { model: "haiku", effort: "low", maxTokens: 500, cache: false },
      TUTOR: { model: "haiku", effort: "low", maxTokens: 2e3 },
      MAKE_QUESTIONS: { model: "haiku", effort: "low", maxTokens: 3e3 },
      READ_NOTE: { model: "haiku", effort: "low", maxTokens: 4e3 },
      TOPICS_FROM_QUESTIONS: { model: "haiku", effort: "low", maxTokens: 4e3, cache: false },
      FOCUS_TOPICS: { model: "haiku", effort: "low", maxTokens: 500, cache: false },
      EXAM_FEEDBACK: { model: "haiku", effort: "medium", maxTokens: 6e3, cache: false }
    },
    pricesUsdPerMTok: {
      "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheWrite5m: 0.125, cacheRead: 0.01, batchInput: 0.05, batchOutput: 0.25, longPromptOver: 1e5, long: { input: 0.5, output: 2.5, cacheWrite5m: 0.625, cacheRead: 0.05 } },
      "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite5m: 2.5, cacheRead: 0.2, batchInput: 1, batchOutput: 5 }
    },
    haikuPromptTokenCeiling: 1e5,
    batchTokenTarget: 8e4,
    imagePatchPx: 28,
    maxLongEdgePx: 2576,
    maxImagesPerRequest: 20,
    maxRequestMB: 32,
    startTier: { rpm: 1e3, inputTpm: 2e6, outputTpm: 4e5, monthlySpendCapUsd: 500 },
    audPerUsd: 1.4434
  }
};

// app/core/config.js
var CONFIG = { app: app_default, plans: plans_default, limits: limits_default, models: models_default };

// app/core/storage.js
var KINDS = [
  "profile",
  "subject",
  "syllabus",
  "paper",
  "question",
  "attempt",
  "session",
  "logbook",
  "card",
  "srs",
  "plan",
  "homework",
  "assessment",
  "subjectlog",
  "bank",
  "note",
  "planner",
  "usage",
  "costlog",
  "uploadlog",
  "report",
  "moderation",
  "queue",
  "doc",
  "mytext",
  "chat"
];
var cache = /* @__PURE__ */ new Map();
for (const k of KINDS) cache.set(k, /* @__PURE__ */ new Map());

// app/core/state.js
var T = CONFIG.limits.timetableDefaults;

// app/accounts/rules.js
function planForPrice(priceId, env = {}) {
  if (!priceId) return null;
  return CONFIG.plans.plans.find((p) => p.stripePriceId === priceId || env["STRIPE_PRICE_" + p.id.toUpperCase()] === priceId) || null;
}

// server/functions/billing-webhook.js
var ACTIVE = ["active", "trialing", "past_due"];
async function ownerFor(db, { owner, subscriptionId, customerId }) {
  if (owner) return owner;
  if (subscriptionId) {
    const [r] = await db.select("subscriptions", { stripe_subscription_id: subscriptionId }, { limit: 1 });
    if (r) return r.owner;
  }
  if (customerId) {
    const [r] = await db.select("subscriptions", { stripe_customer_id: customerId }, { limit: 1 });
    if (r) return r.owner;
  }
  return null;
}
async function startUsagePeriod(db, owner, start, end) {
  if (!owner || !start) return null;
  const [row] = await db.insert(
    "usage",
    { owner, period_start: start, period_end: end, papers: 0, refunds: 0, requests_deep: 0, requests_quick: 0, in_tok: 0, out_tok: 0, cost_aud: 0 },
    { upsert: true, onConflict: "owner,period_start", ignoreDuplicates: true }
  );
  return row || null;
}
async function applySubscription(d, sub, ownerHint) {
  const { db, env } = d;
  const owner = sub.metadata && sub.metadata.owner || ownerHint || await ownerFor(db, { subscriptionId: sub.id, customerId: sub.customer });
  if (!owner) return { ignored: "no student for this subscription" };
  const item = sub.items && sub.items.data && sub.items.data[0] || {};
  const plan = planForPrice(item.price && item.price.id, env);
  if (!plan) console.warn("[billing] subscription price is not in config/plans.json:", item.price && item.price.id);
  const live = ACTIVE.includes(sub.status) && !!plan;
  const start = fromUnix(sub.current_period_start ?? item.current_period_start);
  const end = fromUnix(sub.current_period_end ?? item.current_period_end);
  const pausedUntil = sub.pause_collection && sub.pause_collection.resumes_at ? fromUnix(sub.pause_collection.resumes_at) : null;
  const boost = plans_default.examBoost;
  await db.insert("subscriptions", {
    owner,
    stripe_customer_id: sub.customer || null,
    stripe_subscription_id: sub.id,
    status: sub.status,
    plan: plan ? plan.id : null,
    papers_per_month: plan ? plan.papersPerMonth : 0,
    exam_boost: !!(plan && plan.examBoost),
    boost_multiplier: boost.multiplier,
    boost_days: boost.daysBeforeExam,
    current_period_start: start,
    current_period_end: end,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    paused_until: pausedUntil,
    updated: new Date(d.now()).toISOString()
  }, { upsert: true, onConflict: "owner" });
  await db.update("profiles", { owner }, { plan: live ? plan.id : null, plan_status: sub.status, plan_paused_until: pausedUntil });
  if (live && start) await startUsagePeriod(db, owner, start, end);
  return { owner, plan: live ? plan.id : null, status: sub.status };
}
async function handleEvent(d, event) {
  const o = event.data && event.data.object || {};
  switch (event.type) {
    case "checkout.session.completed": {
      if (o.mode !== "subscription" || !o.subscription) return { ignored: "not a subscription" };
      const owner = o.client_reference_id || o.metadata && o.metadata.owner;
      const sub = typeof o.subscription === "object" ? o.subscription : await d.stripe.getSubscription(o.subscription);
      return applySubscription(d, sub, owner);
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
      return applySubscription(d, o);
    case "customer.subscription.deleted":
      return applySubscription(d, Object.assign({}, o, { status: "canceled" }));
    case "invoice.paid": {
      const subId = typeof o.subscription === "string" ? o.subscription : o.parent && o.parent.subscription_details && o.parent.subscription_details.subscription || null;
      const meta = o.subscription_details && o.subscription_details.metadata || o.parent && o.parent.subscription_details && o.parent.subscription_details.metadata || {};
      const owner = await ownerFor(d.db, { owner: meta.owner, subscriptionId: subId, customerId: o.customer });
      if (!owner) return { ignored: "no student for this invoice" };
      const line = o.lines && o.lines.data && o.lines.data[0] || {};
      const period = line.period || { start: o.period_start, end: o.period_end };
      const start = fromUnix(period.start), end = fromUnix(period.end);
      await d.db.update("subscriptions", { owner }, { current_period_start: start, current_period_end: end, updated: new Date(d.now()).toISOString() });
      await startUsagePeriod(d.db, owner, start, end);
      return { owner, period: start };
    }
    default:
      return { ignored: event.type };
  }
}
var makeHandler = endpoint(async (request, d) => {
  const raw = await request.text();
  let event;
  try {
    event = await verifyWebhook(raw, request.headers.get("stripe-signature"), d.env.STRIPE_WEBHOOK_SECRET, { now: d.now() });
  } catch (e) {
    if (e instanceof StripeError) throw new HttpError(e.status === 500 ? 500 : 400, e.status === 500 ? "Webhook is not set up." : "Invalid signature.");
    throw e;
  }
  const result = await handleEvent(d, event);
  return json(200, { received: true, type: event.type, result });
});
var billing_webhook_default = makeHandler();

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

// functions/api/billing-webhook.js
var onRequest = serve(billing_webhook_default);
export {
  onRequest
};
