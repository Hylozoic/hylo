import Busboy from 'busboy'
import { MAX_UPLOAD_LIMIT_BYTES } from '@hylo/shared'
import { upload } from '../../lib/uploader'
import { uploadLimitForRequest } from '../../lib/uploader/limits'
import { getMediaTypeFromMimetype } from '../models/media/util'

module.exports = {
  create: function (req, res) {
    const args = {
      userId: req.session.userId,

      // if the request is application/x-www-form-urlencoded or
      // application/json, these will have values, thanks to express's body
      // parser (see config/customMiddleware). but if the request is
      // multipart/form-data, then they will be blank, and populated later by
      // busboy's 'field' event handler.
      type: req.param('type'),
      id: req.param('id'),
      url: req.param('url'),
      filename: req.param('filename'),
      // the groups a new post or comment is for, so the upload gets their Hylo Pro limit (#1761)
      groupIds: req.param('groupIds')
    }

    // this promise is used for tests
    return new Promise(resolve => {
      if (req.headers['content-type'] === 'application/json') {
        doUpload(res, args, resolve)
      } else {
        setupBusboy(req, res, args, resolve)
      }
    })
  }
}

// Resolves the per-file size limit for this upload before storing it (lib/uploader/limits.js)
const doUpload = (res, args, resolve) =>
  uploadLimitForRequest(args)
    .then(maxBytes => upload({ ...args, maxBytes }))
    .then(({ type, id, url, mimetype }) => {
      const uploadResponse = {
        type,
        id,
        url,
        // Roughly, the frontend and graphql implemenations use
        // 'attachment' and 'attachmentType' for what we call
        // Media and Media.type here on in the backend.
        attachmentType: getMediaTypeFromMimetype(mimetype)
      }
      return resolve(res.ok(uploadResponse))
    })
    .catch(err => {
      if (err.message.startsWith('Validation error')) {
        return resolve(res.status(422).send({ error: err.message }))
      }

      if (err.message.includes('unsupported image format')) {
        return resolve(res.status(422).send({ error: 'Unsupported image format' }))
      }

      resolve(res.serverError(err))
    })

function setupBusboy (req, res, args, resolve) {
  let busboy, gotFile

  try {
    // this can throw errors due to invalid Content-Type
    busboy = new Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        // A ceiling: the limit that applies to this upload (free, or Hylo Pro / Pro Plus for the
        // group it's for) is enforced on the stream by lib/uploader, which rejects instead of truncating
        fileSize: MAX_UPLOAD_LIMIT_BYTES + 1
      }
    })
  } catch (err) {
    return resolve(res.status(422).send({error: err.message}))
  }

  busboy.on('field', (name, value) => {
    if (['id', 'type', 'url', 'groupIds'].includes(name)) {
      args[name] = value
    }
  })

  busboy.on('file', (name, stream, filename) => {
    // we assume that all 'field' events have already been handled by now
    Object.assign(args, {stream, filename})
    gotFile = true
    doUpload(res, args, resolve)
  })

  busboy.on('error', err => resolve(res.serverError(err)))
  busboy.on('finish', () => gotFile || doUpload(res, args, resolve))

  req.pipe(busboy)
}
