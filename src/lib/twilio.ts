import twilio from 'twilio'

export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  return twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    url,
    params
  )
}

export function twimlResponse(message: string): Response {
  const safe = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

/** An empty TwiML reply: Twilio sends nothing back (R37 STOP/START). */
export function emptyTwimlResponse(): Response {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
    headers: { 'Content-Type': 'text/xml' },
  })
}

let restClient: ReturnType<typeof twilio> | null = null

/**
 * R37 — send one outbound SMS from the Mooves number. Never throws: returns
 * true when Twilio accepted the message, false on missing config or any error,
 * so callers can mark their outbox rows and move on.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!sid || !token || !from || !to) {
    console.error('sendSms: Twilio is not configured')
    return false
  }
  try {
    if (!restClient) restClient = twilio(sid, token)
    await restClient.messages.create({ to, from, body })
    return true
  } catch (e) {
    console.error('sendSms failed:', e instanceof Error ? e.message : e)
    return false
  }
}
