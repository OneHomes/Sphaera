const META_GRAPH_BASE = "https://graph.facebook.com/v21.0";

// NOTE: This is Meta's own Graph API (graph.facebook.com) — a
// completely separate system from Microsoft Graph (graph.microsoft.com)
// used in lib/graph.ts for Mail/Calendar. Same naming, unrelated
// companies/APIs.

async function metaFetch(
  token: string,
  path: string,
  init?: RequestInit
) {
  const res = await fetch(`${META_GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      `WhatsApp API request failed (${res.status}): ${JSON.stringify(data)}`
    );
  }

  return data;
}

// ---- Adding & verifying an agent's phone number ----
// This is the OTP-based flow (self-service "Connect WhatsApp" in
// Settings), NOT QR-code device linking — Meta's Cloud API has no public
// QR-link mechanism; that pattern only exists in unofficial/reverse
// -engineered clients, which was deliberately avoided (ToS/ban risk).

export async function addPhoneNumber(
  wabaId: string,
  systemUserToken: string,
  countryCode: string,
  phoneNumber: string,
  verifiedName: string
): Promise<{ phoneNumberId: string }> {
  const data = await metaFetch(systemUserToken, `/${wabaId}/phone_numbers`, {
    method: "POST",
    body: JSON.stringify({
      cc: countryCode,
      phone_number: phoneNumber,
      verified_name: verifiedName,
    }),
  });
  return { phoneNumberId: data.id };
}

export async function requestVerificationCode(
  phoneNumberId: string,
  systemUserToken: string,
  method: "SMS" | "VOICE" = "SMS"
): Promise<void> {
  await metaFetch(systemUserToken, `/${phoneNumberId}/request_code`, {
    method: "POST",
    body: JSON.stringify({ code_method: method, language: "en_US" }),
  });
}

export async function verifyPhoneNumberCode(
  phoneNumberId: string,
  systemUserToken: string,
  code: string
): Promise<void> {
  await metaFetch(systemUserToken, `/${phoneNumberId}/verify_code`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

// ---- Sending & receiving messages ----

export async function sendTextMessage(
  phoneNumberId: string,
  systemUserToken: string,
  toPhoneNumber: string,
  text: string
): Promise<{ messageId: string }> {
  const data = await metaFetch(systemUserToken, `/${phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhoneNumber,
      type: "text",
      text: { body: text },
    }),
  });
  return { messageId: data.messages?.[0]?.id };
}

// ---- Webhook payload shapes (incoming messages / status updates) ----
// Meta POSTs these to our webhook endpoint (app/api/whatsapp/webhook).

export type WhatsAppWebhookPayload = {
  entry: {
    changes: {
      value: {
        metadata: { phone_number_id: string; display_phone_number: string };
        contacts?: { profile: { name: string }; wa_id: string }[];
        messages?: {
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }[];
        statuses?: {
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          recipient_id: string;
        }[];
      };
      field: string;
    }[];
  }[];
};