// In-memory PLC directory for tests: validates op signatures the way plc.directory does.
// Intercepts HTTP to `plcUrl` with nock; returns { logs, posts, scope }.
import nock from 'nock'
import * as plc from '@did-plc/lib'

export default function fakePlc (plcUrl) {
  const logs = {}
  const posts = []
  const data = did => {
    const { type, prev, sig, ...rest } = plc.normalizeOp(logs[did][logs[did].length - 1])
    return { did, ...rest }
  }

  const scope = nock(plcUrl).persist()
    .post(/^\/did(:|%3A)plc(:|%3A)[a-z0-9]+$/i).reply(async (path, op) => {
      const did = decodeURIComponent(path).slice(1)
      posts.push({ did, op })
      try {
        if (!logs[did]) {
          await plc.assureValidCreationOp(did, op)
          logs[did] = [op]
        } else {
          const last = logs[did][logs[did].length - 1]
          if (last.type === 'plc_tombstone') return [400, { message: 'DID is tombstoned' }]
          if (op.type !== 'plc_tombstone' && !op.prev) return [400, { message: 'DID already exists' }]
          await plc.assureValidSig(plc.normalizeOp(last).rotationKeys, op)
          logs[did].push(op)
        }
        return [200, '']
      } catch (err) {
        return [400, { message: err.message }]
      }
    })
    .get(/^\/did(:|%3A)plc(:|%3A)[a-z0-9]+\/(data|log\/last)$/i).reply(path => {
      const [, did, kind] = decodeURIComponent(path).match(/^\/([^/]+)\/(.*)$/)
      if (!logs[did]) return [404, { message: 'DID not registered' }]
      const last = logs[did][logs[did].length - 1]
      if (last.type === 'plc_tombstone') return [410, { message: 'DID not available' }]
      return [200, kind === 'data' ? data(did) : last]
    })

  return { logs, posts, scope }
}
