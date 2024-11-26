import fetch from 'node-fetch'

export default function (req, res, next, opts = {}) {
  if (req.url !== '/' || !req.cookies[process.env.VITE_HYLO_COOKIE_NAME]) {
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
      Cookie: `${process.env.VITE_HYLO_COOKIE_NAME}=${req.cookies[process.env.VITE_HYLO_COOKIE_NAME]}`
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
