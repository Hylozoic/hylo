import fetch from 'node-fetch'

export default function (req, res, next, opts = {}) {
  // Mobile WebView requests must never see the marketing landing page.
  // If a WebView hits '/' without a valid session, redirect to /login so the
  // React app loads and the RootRouter LOGOUT guard can signal native to handle auth.
  if (req.url === '/' && req.headers['x-hylo-mobile']) {
    if (!req.cookies[process.env.HYLO_COOKIE_NAME]) {
      return res.redirect('/login')
    }
    // Cookie exists — fall through to the normal session-check below
  }

  if (req.url !== '/' || !req.cookies[process.env.HYLO_COOKIE_NAME]) {
    return next()
  }

  const query = `
    query CheckLogin {
      me {
        id
      }
    }
  `

  return fetch((process.env.VITE_API_HOST || 'http://localhost:3001') + '/noo/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${process.env.HYLO_COOKIE_NAME}=${req.cookies[process.env.HYLO_COOKIE_NAME]}`
    },
    body: JSON.stringify({ query })
  })
    .then(response => response.json())
    .then(result => {
      if (result?.data?.me?.id) {
        return res.redirect('/app?rd=1')
      }
      next()
    })
    .catch(() => next())
}
