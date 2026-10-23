// Cloudflare Pages Function: POST /api/lead
// Forwards the 8-question hero form to a webhook you control (GoHighLevel, n8n, Zapier, Make, etc.).
// Set LEAD_WEBHOOK_URL in Cloudflare Pages > Settings > Environment variables.
// If it is not set this returns 503 so the form never pretends a lead was delivered.
//
// The form posts more than once per visitor:
//   stage "partial"  – sent after every step once the phone number is in (lastStep 2..7)
//   stage "complete" – sent once on the final submit (lastStep 8)
// Every post carries the same leadId, so the receiving side should UPDATE one contact
// (match on phone or leadId), not create a new one each time.
// isFirstContact is true only on the first post that has a phone number: trigger
// speed-to-lead (instant text/call) on that, not on every post.

interface Env {
  LEAD_WEBHOOK_URL?: string;
}

type Stage = "partial" | "complete";

interface LeadPayload {
  leadId: string;
  stage: Stage;
  lastStep: number;
  totalSteps: number;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  service: string;
  urgency: string;
  ownership: string;
  address: string;
  zip: string;
  details: string;
  page: string;
}

// Max length for each text field. Anything longer is rejected.
const TEXT_LIMITS: Record<Exclude<keyof LeadPayload, "stage" | "lastStep" | "totalSteps">, number> = {
  leadId: 80,
  name: 120,
  firstName: 60,
  lastName: 60,
  phone: 40,
  email: 120,
  service: 120,
  urgency: 60,
  ownership: 60,
  address: 160,
  zip: 10,
  details: 1000,
  page: 500,
};

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const digits = (value: string): string => value.replace(/\D/g, "");

// Accepts the new form's payload. Also accepts the old 3-field form ({ name, phone, service })
// so nothing breaks if an old cached page is still open somewhere.
function parseLead(value: unknown): LeadPayload | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;

  const text = {} as Record<keyof typeof TEXT_LIMITS, string>;
  for (const key of Object.keys(TEXT_LIMITS) as (keyof typeof TEXT_LIMITS)[]) {
    const raw = v[key];
    if (raw === undefined || raw === null) {
      text[key] = "";
    } else if (typeof raw === "string") {
      if (raw.length > TEXT_LIMITS[key]) return null;
      text[key] = raw.trim();
    } else {
      return null;
    }
  }

  const phoneDigits = digits(text.phone);
  if (!(phoneDigits.length === 10 || (phoneDigits.length === 11 && phoneDigits.startsWith("1")))) return null;

  const stage: Stage = v.stage === "partial" ? "partial" : "complete";
  const lastStep = typeof v.lastStep === "number" && Number.isFinite(v.lastStep) ? Math.trunc(v.lastStep) : 0;
  const totalSteps = typeof v.totalSteps === "number" && Number.isFinite(v.totalSteps) ? Math.trunc(v.totalSteps) : 0;

  const name = text.name || `${text.firstName} ${text.lastName}`.trim();
  if (!name) return null;

  return {
    ...text,
    name,
    leadId: text.leadId || crypto.randomUUID(),
    stage,
    lastStep,
    totalSteps,
  };
}

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  if (!env.LEAD_WEBHOOK_URL) return json({ ok: false, error: "not_configured" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  const lead = parseLead(body);
  if (!lead) return json({ ok: false, error: "invalid" }, 400);

  // Phone is question 2, so the first post that reaches us is the first time we can call them.
  const isFirstContact = lead.stage === "partial" ? lead.lastStep <= 2 : lead.totalSteps === 0;

  const upstream = await fetch(env.LEAD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...lead,
      phoneE164: `+1${digits(lead.phone).slice(-10)}`,
      isFirstContact,
      isComplete: lead.stage === "complete",
      source: "cofulent-hero-form",
      receivedAt: new Date().toISOString(),
    }),
  });
  return upstream.ok ? json({ ok: true }, 200) : json({ ok: false, error: "upstream" }, 502);
};
