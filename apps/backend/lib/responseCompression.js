/*
  Gzip API responses, or brotli when the client prefers it.
  Sails' built-in compress middleware is gzip only, and only when
  NODE_ENV is production. The Heroku router does not compress.
*/

const compression = require('compression')
const zlib = require('zlib')

const THRESHOLD = 1024
// Quality 6 matches gzip's compress time and is about 20% smaller on feed-sized JSON.
// Quality 11 spends over 100ms for a few more percent.
const BROTLI_QUALITY = 6

const gzip = compression({
  threshold: THRESHOLD,
  filter: shouldCompress
})

/**
 * Compress JSON and text responses. Prefer brotli, then the compression package's gzip.
 */
function responseCompression (req, res, next) {
  if (preferredEncoding(req.headers['accept-encoding']) === 'br') {
    return brotliCompress(req, res, next)
  }
  return gzip(req, res, next)
}

/**
 * Pick br when the client accepts it at least as strongly as gzip.
 */
function preferredEncoding (header) {
  if (!header) return null
  let brotliQ = -1
  let gzipQ = -1
  for (const part of String(header).split(',')) {
    const [rawName, ...params] = part.trim().split(';')
    const name = rawName.trim().toLowerCase()
    let q = 1
    for (const param of params) {
      const [key, value] = param.split('=').map(piece => piece.trim())
      if (key === 'q') q = Number(value)
    }
    if (!(q > 0)) continue
    if (name === 'br' || (name === '*' && brotliQ < 0)) brotliQ = q
    if (name === 'gzip' || (name === '*' && gzipQ < 0)) gzipQ = q
  }
  if (brotliQ > 0 && brotliQ >= gzipQ) return 'br'
  if (gzipQ > 0) return 'gzip'
  return null
}

function shouldCompress (req, res) {
  const type = String(res.getHeader('Content-Type') || '')
  if (!type) return false
  return /json|text\/|javascript|xml|svg/.test(type)
}

/**
 * Brotli-compress the response body when it is large enough to be worth it.
 */
function brotliCompress (req, res, next) {
  let ended = false
  let length
  let stream
  const write = res.write
  const end = res.end
  const writeHead = res.writeHead

  res.flush = function flush () {
    if (stream) stream.flush()
  }

  res.writeHead = function () {
    maybeCompress(this)
    res.writeHead = writeHead
    return writeHead.apply(this, arguments)
  }

  res.write = function (chunk, encoding) {
    if (ended) return false
    if (!this.headersSent) this._implicitHeader()
    return stream
      ? stream.write(toBuffer(chunk, encoding))
      : write.call(this, chunk, encoding)
  }

  res.end = function (chunk, encoding) {
    if (ended) return false
    if (!this.headersSent) {
      if (!this.getHeader('Content-Length')) length = chunkLength(chunk, encoding)
      this._implicitHeader()
    }
    if (!stream) return end.call(this, chunk, encoding)
    ended = true
    return chunk ? stream.end(toBuffer(chunk, encoding)) : stream.end()
  }

  function maybeCompress (response) {
    if (stream || ended) return
    if (!shouldCompress(req, response)) return
    appendVary(response, 'Accept-Encoding')
    const contentLength = Number(response.getHeader('Content-Length'))
    if (contentLength < THRESHOLD || length < THRESHOLD) return
    const encoding = response.getHeader('Content-Encoding') || 'identity'
    if (encoding !== 'identity') return
    if (req.method === 'HEAD') return

    stream = zlib.createBrotliCompress({
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY
      }
    })
    response.setHeader('Content-Encoding', 'br')
    response.removeHeader('Content-Length')

    stream.on('data', chunk => {
      if (write.call(response, chunk) === false) stream.pause()
    })
    stream.on('end', () => {
      end.call(response)
    })
    response.on('drain', () => {
      stream.resume()
    })
  }

  next()
}

function toBuffer (chunk, encoding) {
  if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) return chunk
  return Buffer.from(chunk, encoding)
}

function chunkLength (chunk, encoding) {
  if (!chunk) return 0
  if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) return chunk.length
  return Buffer.byteLength(chunk, encoding)
}

function appendVary (res, field) {
  const existing = res.getHeader('Vary')
  if (!existing) {
    res.setHeader('Vary', field)
    return
  }
  const values = String(existing).split(',').map(value => value.trim().toLowerCase())
  if (!values.includes(field.toLowerCase())) {
    res.setHeader('Vary', existing + ', ' + field)
  }
}

module.exports = responseCompression
module.exports.preferredEncoding = preferredEncoding
