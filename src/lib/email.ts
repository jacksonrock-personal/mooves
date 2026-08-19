// Transactional email via Resend (Phase 16 #15). Currently just the sponsor
// "your Moove is live" notification, sent when a placement charge clears. The
// A2P/SMS approach was abandoned; sponsors are reached by email instead.
//
// Sends are best-effort: callers await inside try/catch so a mail failure never
// breaks the approval/charge path. No-ops (returns false) if RESEND_API_KEY is
// unset, so local/dev without a key doesn't throw.

import { Resend } from 'resend'

const FROM = 'Mooves <moves@makemooves.app>'
const DASHBOARD_URL = 'https://makemooves.app/sponsor'
const ADMIN_URL = 'https://makemooves.app/admin'

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY
  return key ? new Resend(key) : null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface MoveLiveEmail {
  to: string
  businessName: string | null
  moveTitle: string
  categoryLabel: string
  whenWhere: string | null
}

export async function sendMoveLiveEmail(input: MoveLiveEmail): Promise<boolean> {
  const resend = client()
  if (!resend) return false

  const name = input.businessName?.trim() || 'there'
  const title = escapeHtml(input.moveTitle)
  const category = escapeHtml(input.categoryLabel)
  const whenWhere = input.whenWhere ? escapeHtml(input.whenWhere) : null

  const html = `<!doctype html>
<html><body style="margin:0;background:#F4F1FB;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border:1px solid #E8E4F5;border-radius:16px;overflow:hidden;">
      <div style="background:#7C5CDB;padding:24px;text-align:center;">
        <span style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-weight:800;font-size:20px;color:#fff;letter-spacing:-0.01em;">Mooves</span>
      </div>
      <div style="padding:28px 30px;">
        <span style="display:inline-block;background:#DCF5E7;color:#167A43;font-size:11px;font-weight:700;padding:5px 11px;border-radius:999px;text-transform:uppercase;letter-spacing:0.04em;">Approved &amp; live</span>
        <h1 style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-weight:800;font-size:23px;color:#1C1730;margin:14px 0 0;">Your Moove is live</h1>
        <p style="font-size:14px;color:#6B628A;line-height:1.6;margin:12px 0 0;">Hi ${escapeHtml(name)}, good news. Mooves approved your move and it's now showing to people nearby who are into ${category}.</p>
        <div style="border:1px solid #E8E4F5;border-radius:14px;padding:16px;margin:20px 0;background:#FCFBFF;">
          <span style="display:inline-block;background:#EDE9FF;color:#5B3FB0;font-size:11px;font-weight:700;border-radius:999px;padding:3px 10px;">${category}</span>
          <div style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-weight:800;font-size:16px;color:#1C1730;margin-top:8px;">${title}</div>
          ${whenWhere ? `<div style="font-size:13px;color:#6B628A;margin-top:5px;">${whenWhere}</div>` : ''}
        </div>
        <p style="font-size:14px;color:#6B628A;line-height:1.6;margin:0;">You'll see how it's doing in your dashboard, feeds reached, interest, and clicks. All aggregate, never tied to a person.</p>
        <div style="margin-top:20px;">
          <a href="${DASHBOARD_URL}" style="display:inline-block;background:#7C5CDB;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:999px;">View your dashboard</a>
        </div>
      </div>
      <div style="text-align:center;font-size:11.5px;color:#BDB5D4;padding:20px 30px;line-height:1.6;border-top:1px solid #E8E4F5;">
        You're getting this because you run a sponsored move on Mooves.<br>
        Mooves · Chicago, IL · <a href="https://makemooves.app" style="color:#5B3FB0;">makemooves.app</a>
      </div>
    </div>
  </div>
</body></html>`

  const text = [
    `Your Moove is live on Mooves.`,
    ``,
    `Hi ${name}, Mooves approved your move and it's now showing to people nearby who are into ${input.categoryLabel}.`,
    ``,
    `${input.moveTitle}${whenWhere ? `\n${input.whenWhere}` : ''}`,
    ``,
    `See how it's doing: ${DASHBOARD_URL}`,
  ].join('\n')

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: input.to,
      subject: 'Your Moove is live on Mooves',
      html,
      text,
    })
    return !error
  } catch {
    return false
  }
}

// ── Ops alerts ───────────────────────────────────────────────────────────────

interface MetroThinEmail {
  metroName: string
  state: string | null
  upcoming: number
  threshold: number
}

/**
 * R27 — the freshness alarm's outbound half. Sent when a metro drops below the
 * threshold of upcoming live community moves.
 *
 * Goes to OPS_ALERT_EMAIL, which is deliberately its own variable rather than a
 * hardcoded address: the one thing this mail must not do is land somewhere
 * nobody reads, which is the exact failure it exists to report on.
 *
 * Plain text, no template. An alert is read on a phone in a hurry and its whole
 * job is to say which city, how many, and what to do.
 */
export async function sendMetroThinEmail(input: MetroThinEmail): Promise<boolean> {
  const resend = client()
  const to = process.env.OPS_ALERT_EMAIL
  if (!resend || !to) return false

  const where = input.state ? `${input.metroName}, ${input.state}` : input.metroName
  const subject =
    input.upcoming === 0
      ? `Mooves: ${where} has NO upcoming community mooves`
      : `Mooves: ${where} is down to ${input.upcoming} upcoming community mooves`

  const text = [
    `${where} has ${input.upcoming} approved community moove${input.upcoming === 1 ? '' : 's'} still in the future (threshold ${input.threshold}).`,
    ``,
    `Seeded moves publish automatically, so this usually means the routine is`,
    `finding little rather than that anything is waiting on you. Worth checking:`,
    ``,
    `  1. Did the seeding routine run? claude.ai → routines → "Mooves — Community Mooves seeding"`,
    `  2. Is it finding events but failing validation? The run log lists every rejection with a reason.`,
    `  3. Admin console: ${ADMIN_URL}`,
    ``,
    `You are getting this at most once a day per metro, and only while it stays thin.`,
  ].join('\n')

  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, text })
    return !error
  } catch {
    return false
  }
}
