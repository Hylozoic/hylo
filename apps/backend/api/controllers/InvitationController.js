import { getLocaleStrings } from '../../lib/i18n/locales'

// For text in elements and double-quoted attributes
const escapeHtml = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

// The language of the email the link came from, else the browser's
function localeStrings (req) {
  const fromLink = typeof req.query?.locale === 'string' ? req.query.locale : null
  const fromBrowser = String(req.headers?.['accept-language'] || '').split(',')[0].split(';')[0].trim()
  return getLocaleStrings(fromLink || fromBrowser || 'en')
}

function page (strings, { heading, text, button }) {
  const form = button
    ? `<form method="post"><button type="submit">${escapeHtml(button)}</button></form>`
    : ''
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(strings.invitationOptOutTitle())}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f6f7; color: #2a2a2a; margin: 0; padding: 48px 16px; }
main { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 24px; }
h1 { font-size: 20px; margin: 0 0 12px; overflow-wrap: anywhere; }
p { line-height: 1.5; margin: 0 0 16px; }
button { background: #2a2a2a; color: #fff; border: 0; border-radius: 8px; padding: 10px 16px; font-size: 16px; cursor: pointer; }
</style>
</head>
<body>
<main>
<h1>${escapeHtml(heading)}</h1>
${text ? `<p>${escapeHtml(text)}</p>` : ''}
${form}
</main>
</body>
</html>`
}

function send (res, status, html) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Robots-Tag', 'noindex')
  return res.status(status).send(html)
}

async function invitationForToken (req) {
  const token = req.param('token')
  if (!token || typeof token !== 'string') return null
  return Invitation.where({ token }).fetch()
}

// Runs a page handler, answering with the not-found page for a link that
// matches no invitation and a plain error page if something fails
const optOutPage = handler => async function (req, res) {
  const strings = localeStrings(req)
  try {
    const invitation = await invitationForToken(req)
    if (!invitation) {
      return send(res, 404, page(strings, { heading: strings.invitationOptOutNotFound() }))
    }
    return await handler({ req, res, strings, invitation, email: invitation.get('email') })
  } catch (err) {
    sails.log.error('Invitation opt-out page failed', err)
    return send(res, 500, page(strings, { heading: strings.invitationOptOutError() }))
  }
}

module.exports = {
  /**
   * The page an invitation email's "stop invitations" link opens. It only asks
   * to confirm: nothing is recorded until the person presses the button, so
   * following the link (as mail scanners do) changes nothing. It shows the
   * address and nothing else about the invitation.
   */
  showOptOut: optOutPage(async ({ res, strings, email }) => {
    if (await InvitationOptOut.isOptedOut(email)) {
      return send(res, 200, page(strings, { heading: strings.invitationOptOutDone(email) }))
    }
    return send(res, 200, page(strings, {
      heading: strings.invitationOptOutQuestion(email),
      text: strings.invitationOptOutExplanation(),
      button: strings.invitationOptOutButton()
    }))
  }),

  /** Record the opt-out confirmed on that page. */
  optOut: optOutPage(async ({ res, strings, invitation, email }) => {
    await InvitationOptOut.record({ email, invitationId: invitation.id })
    return send(res, 200, page(strings, { heading: strings.invitationOptOutDone(email) }))
  })
}
