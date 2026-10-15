// Cloudflare Pages Function: POST /api/lead
// Forwards the hero form to a webhook you control (Zapier, Make, Slack, n8n, etc.).
// Set LEAD_WEBHOOK_URL in Cloudflare Pages > Settings > Environment variables.
// If it is not set this returns 503 so the form never pretends a lead was delivered.

interface Env {
  LEAD_WEBHOOK_URL?: string;
}

interface LeadPayload {
  name: string;
  phone: string;
  service: string;
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const isLead = (value: unknown): value is LeadPayload => {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === "string" && typeof v.phone === "string" && typeof v.service === "string";
};

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  if (!env.LEAD_WEBHOOK_URL) return json({ ok: false, error: "not_configured" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  if (!isLead(body) || body.name.length > 120 || body.phone.length > 40 || body.service.length > 120) {
    return json({ ok: false, error: "invalid" }, 400);
  }

  const upstream = await fetch(env.LEAD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, source: "cofulent-hero-form", receivedAt: new Date().toISOString() }),
  });
  return upstream.ok ? json({ ok: true }, 200) : json({ ok: false, error: "upstream" }, 502);
};
