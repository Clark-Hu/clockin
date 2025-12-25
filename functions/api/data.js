const END_DATE_ISO = "2026-01-30";
const START_DATE_ISO = "2025-12-26";
const DEFAULT_KEY = "checkin_data_v1";

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method !== "GET" && method !== "PUT") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  const kv = env?.CHECKIN_KV;
  if (!kv) return json({ error: "Missing KV binding: CHECKIN_KV" }, 500);

  const passwordHash = env?.PASSWORD_HASH;
  if (!passwordHash) return json({ error: "Missing secret: PASSWORD_HASH" }, 500);

  const authHash = request.headers.get("X-Auth-Hash") || "";
  if (!timingSafeEqual(authHash, passwordHash)) return json({ error: "Unauthorized" }, 401);

  const dataKey = env?.DATA_KEY || DEFAULT_KEY;

  if (method === "GET") {
    const raw = await kv.get(dataKey);
    if (!raw) return json(defaultData(), 200);

    try {
      const parsed = JSON.parse(raw);
      return json(normalize(parsed), 200);
    } catch {
      return json(defaultData(), 200);
    }
  }

  // PUT
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const normalized = normalize(body);
  normalized.updatedAt = new Date().toISOString();
  if (!normalized.meta) normalized.meta = {};
  if (!normalized.meta.endDate) normalized.meta.endDate = END_DATE_ISO;
  if (!normalized.meta.startDate) normalized.meta.startDate = START_DATE_ISO;
  if (normalized.meta.startDate < START_DATE_ISO) normalized.meta.startDate = START_DATE_ISO;

  await kv.put(dataKey, JSON.stringify(normalized));
  return json({ ok: true, updatedAt: normalized.updatedAt }, 200);
}

function defaultData() {
  const now = new Date().toISOString();
  return {
    version: 1,
    meta: {
      startDate: START_DATE_ISO,
      endDate: END_DATE_ISO,
      createdAt: now,
    },
    updatedAt: now,
    entries: {},
  };
}

function normalize(obj) {
  if (!obj || typeof obj !== "object") return defaultData();
  if (obj.version !== 1) return defaultData();
  if (!obj.meta || typeof obj.meta !== "object") obj.meta = {};
  if (!obj.entries || typeof obj.entries !== "object") obj.entries = {};
  if (!obj.meta.endDate) obj.meta.endDate = END_DATE_ISO;
  if (!obj.meta.startDate) obj.meta.startDate = START_DATE_ISO;
  if (obj.meta.startDate < START_DATE_ISO) obj.meta.startDate = START_DATE_ISO;
  return obj;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
