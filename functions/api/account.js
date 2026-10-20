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
    concurrency: 4,
    aiCheck: true,
    checkPerRequest: 10,
    autoConfirm: true
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
function ageOn(dob, when = /* @__PURE__ */ new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dob || ""));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  let age = when.getFullYear() - y;
  if (when.getMonth() + 1 < mo || when.getMonth() + 1 === mo && when.getDate() < d) age--;
  return age;
}

// app/accounts/rules.js
var minimumAgeFor = (provider2) => provider2 === "gemini" ? CONFIG.limits.age.minimumWhileGemini : CONFIG.limits.age.minimum;
function checkSignupAge(dob, provider2, now = /* @__PURE__ */ new Date()) {
  const minimum = minimumAgeFor(provider2);
  const age = ageOn(dob, now instanceof Date ? now : new Date(now));
  if (age == null || age < 0 || age > 120) return { ok: false, age: null, minimum, reason: "no-dob" };
  if (age < minimum) return { ok: false, age, minimum, reason: "too-young" };
  return { ok: true, age, minimum };
}
var findPlan = (id) => CONFIG.plans.plans.find((p) => p.id === id) || null;
var priceIdFor = (plan, env = {}) => plan && (plan.stripePriceId || env["STRIPE_PRICE_" + plan.id.toUpperCase()]) || null;
function pauseUntil(months, now = Date.now()) {
  const max = CONFIG.plans.pause.maxMonths;
  const n = Number(months);
  if (!Number.isInteger(n) || n < 1) return { ok: false, reason: "Choose how many months to pause for." };
  if (n > max) return { ok: false, reason: `You can pause for up to ${max} months.` };
  const d = new Date(now);
  d.setMonth(d.getMonth() + n);
  return { ok: true, until: d.getTime(), months: n };
}

// server/functions/account.js
var OWNED_TABLES = [
  "profiles",
  "subjects",
  "syllabuses",
  "papers",
  "questions",
  "attempts",
  "sessions",
  "logbook_rules",
  "cards",
  "srs",
  "plans",
  "homework",
  "assessments",
  "subject_logs",
  "banks",
  "notes",
  "planners",
  "usage",
  "cost_log",
  "upload_log",
  "reports",
  "moderation_log",
  "subscriptions"
];
var BUCKETS = ["papers", "syllabuses"];
var EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
var provider = (env) => env.AI_PROVIDER || models_default.defaultProvider;
async function subscriptionOf(db, owner) {
  const [s] = await db.select("subscriptions", { owner }, { limit: 1 });
  return s || null;
}
var actions = {
  async signup(body, d) {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!EMAIL.test(email)) throw new HttpError(400, "Please enter a valid email address.");
    if (password.length < 10 || password.length > 200) throw new HttpError(400, "Please choose a password of at least 10 characters.");
    const age = checkSignupAge(body.dob, provider(d.env), new Date(d.now()));
    if (!age.ok) {
      if (age.reason === "no-dob") throw new HttpError(400, "Please enter your date of birth.");
      throw new HttpError(403, `Plaeta is for people aged ${age.minimum} and over.`, { reason: "too-young", minimum: age.minimum });
    }
    let user;
    try {
      user = await d.db.auth.createUser({ email, password });
    } catch (e) {
      if (e.status === 422 || e.status === 409) throw new HttpError(409, "There is already an account with that email. Try signing in.");
      throw e;
    }
    const id = user.id || user.user && user.user.id;
    await d.db.insert("profiles", { owner: id, dob: body.dob, referral_code: null, plan: null, plan_status: null, plan_paused_until: null, spelling: "en-AU" });
    return { ok: true, userId: id };
  },
  async signin(body, d) {
    try {
      const s = await d.db.auth.signIn(String(body.email || "").trim().toLowerCase(), String(body.password || ""));
      return { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in };
    } catch (e) {
      throw new HttpError(401, "That email and password do not match.");
    }
  },
  async checkout(body, d, user) {
    const plan = findPlan(body.plan);
    if (!plan) throw new HttpError(400, "That plan does not exist.");
    const price = priceIdFor(plan, d.env);
    if (!price) throw new HttpError(501, "Payments for this plan are not set up yet.");
    const site = (d.env.SITE_URL || "").replace(/\/+$/, "");
    if (!site) throw new HttpError(501, "Payments are not set up yet.");
    const s = await d.stripe.createCheckoutSession({ price, owner: user.id, planId: plan.id, successUrl: `${site}/app/#/settings`, cancelUrl: `${site}/app/#/plans` });
    return { url: s.url };
  },
  async pause(body, d, user) {
    const r = pauseUntil(body.months, d.now());
    if (!r.ok) throw new HttpError(400, r.reason);
    const sub = await subscriptionOf(d.db, user.id);
    if (sub && sub.stripe_subscription_id) await d.stripe.pauseSubscription(sub.stripe_subscription_id, Math.floor(r.until / 1e3));
    await d.db.update("profiles", { owner: user.id }, { plan_paused_until: iso(r.until) });
    if (sub) await d.db.update("subscriptions", { owner: user.id }, { paused_until: iso(r.until) });
    return { ok: true, pausedUntil: iso(r.until), dataKept: true };
  },
  async resume(body, d, user) {
    const sub = await subscriptionOf(d.db, user.id);
    if (sub && sub.stripe_subscription_id) await d.stripe.resumeSubscription(sub.stripe_subscription_id);
    await d.db.update("profiles", { owner: user.id }, { plan_paused_until: null });
    if (sub) await d.db.update("subscriptions", { owner: user.id }, { paused_until: null });
    return { ok: true };
  },
  async cancel(body, d, user) {
    const sub = await subscriptionOf(d.db, user.id);
    if (sub && sub.stripe_subscription_id) await d.stripe.cancelSubscription(sub.stripe_subscription_id);
    await d.db.update("profiles", { owner: user.id }, { cancelled_at: iso(d.now()) });
    if (sub) await d.db.update("subscriptions", { owner: user.id }, { cancel_at_period_end: true });
    return { ok: true, endsAt: sub ? sub.current_period_end : null, dataKept: true };
  },
  async export(body, d, user) {
    const records = {};
    for (const t of OWNED_TABLES) records[t] = await d.db.select(t, { owner: user.id });
    return { app: "plaeta", format: 1, source: "account", exported: d.now(), records };
  },
  async delete(body, d, user) {
    if (body.confirm !== "DELETE") throw new HttpError(400, "Type DELETE to confirm.");
    const sub = await subscriptionOf(d.db, user.id);
    if (sub && sub.stripe_subscription_id && sub.status !== "canceled") await d.stripe.cancelNow(sub.stripe_subscription_id);
    for (const b of BUCKETS) {
      const paths = await d.db.storage.list(b, user.id);
      if (paths.length) await d.db.storage.remove(b, paths);
    }
    await d.db.auth.deleteUser(user.id);
    return { ok: true };
  }
};
var OPEN = ["signup", "signin"];
var makeHandler = endpoint(async (request, d) => {
  const body = await readJSON(request);
  const name = String(body.action || "");
  const fn = Object.prototype.hasOwnProperty.call(actions, name) && actions[name];
  if (!fn) throw new HttpError(400, "Unknown action.");
  const ip = request.headers.get("x-nf-client-connection-ip") || request.headers.get("x-forwarded-for") || "local";
  let user = null;
  if (OPEN.includes(name)) rateLimit(`acct:${name}:${ip}`, 10, d.now());
  else {
    user = await requireUser(request, d.db);
    rateLimit(`acct:${user.id}`, 30, d.now());
  }
  return json(200, await fn(body, d, user));
});
var account_default = makeHandler();

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

// functions/api/account.js
var onRequest = serve(account_default);
export {
  onRequest
};
