import request from 'request'
import { parse } from 'url'
const { API_HOST } = process.env

const apiHostname = parse(API_HOST).hostname

export default function apiProxy (req, res, next) {
  if (!req.originalUrl.startsWith('/noo') &&
    !req.originalUrl.startsWith('/admin/kue')) return next()

  const url = API_HOST + req.originalUrl

  request.delete = request.delete || request.del
  const method = request[req.method.toLowerCase()]
  const headers = { ...req.headers, host: apiHostname }
  const upstreamReq = method(url, { headers, followRedirect: false })

  req.pipe(upstreamReq)
    .on('error', err => console.error('✗ ' + err.message))
    .pipe(res)
}
