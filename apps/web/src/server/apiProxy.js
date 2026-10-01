import request from 'request'
import { URL } from 'url'
import dotenv from 'dotenv'

dotenv.config()

const { VITE_API_HOST } = process.env

const apiHostname = new URL(VITE_API_HOST).hostname

export default function apiProxy (req, res, next) {
  if (!req.originalUrl.startsWith('/noo')) return next()

  const url = VITE_API_HOST + req.originalUrl

  request.delete = request.delete || request.del
  const method = request[req.method.toLowerCase()]
  const headers = { ...req.headers, host: apiHostname }
  const upstreamReq = method(url, { headers, followRedirect: false })

  upstreamReq.on('response', upstreamRes => {
    res.writeHead(upstreamRes.statusCode, upstreamRes.headers)
    upstreamRes.pipe(res)
  })

  upstreamReq.on('error', err => {
    console.error('✗ ' + err.message)
    if (!res.headersSent) res.status(502).end()
  })

  req.pipe(upstreamReq)
}