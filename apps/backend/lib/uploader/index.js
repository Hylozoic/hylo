/* eslint-disable indent, object-curly-spacing */
import getFileType from 'file-type'
import mime from 'mime-types'
import request from 'request'
import sharp from 'sharp'
import { PassThrough } from 'stream'

import { createConverterStream } from './converter'
import { createPostImporter } from './postImporter'
import { createS3StorageStream } from './storage'
import { validate } from './validation'
import * as types from './types'

export function upload (args) {
  let { type, id, userId, url, stream, onProgress, filename } = args
  return validate(args)
    .then(() => {
      let passthrough, converter, storage, didSetup, sourceHasError
      const source = url ? request(url) : stream
      if (!filename) filename = url
      function setupStreams (data, resolve, reject) {
        didSetup = true

        if (type === 'importPosts') {
          passthrough = createPostImporter(userId, id)
          passthrough.on('end', (e) => {
            // This returns to the front-end after the CSV has been read but before posts have been created
            const uploaderResult = {
              type,
              id,
              mimetype: 'text/csv'
            }
            return resolve(uploaderResult)
          })
        } else {
          // this is used so we can get the file type from the first chunk of
          // data and still use `.pipe` -- you can't pipe a stream after getting
          // data from it
          passthrough = new PassThrough()

          const fileType = guessFileType(data, filename)
          const mimetype = fileType && fileType.mime

          converter = createConverterStream(type, id, { fileType })
          converter.on('error', err => reject(err))

          storage = createS3StorageStream(type, id, { userId, fileType, filename })
          storage.on('finish', () => {
            const uploaderResult = {
              type,
              id,
              url: storage.url,
              mimetype
            }

            // For group avatars, also generate a 42x42 rounded variant with a thin black border
            if (type === types.GROUP_AVATAR && mimetype && mimetype.startsWith('image')) {
              try {
                const originalFilename = filename || url
                generateGroupMapVariant({
                  sourceUrl: storage.url,
                  userId,
                  type,
                  id,
                  originalFilename
                })
              } catch (err) {
                // TODO from assistant: non-fatal error creating map avatar variant
                if (process.env.NODE_ENV === 'development') console.error('map avatar variant error', err)
              }
            }
            return resolve(uploaderResult)
          })
          storage.on('error', err => reject(err))
          if (onProgress) storage.on('progress', onProgress)

          passthrough.pipe(converter).pipe(storage)
        }
      }

      return new Promise((resolve, reject) => {
        source.on('data', data => {
          if (sourceHasError) return

          if (!didSetup) {
            try {
              setupStreams(data, resolve, reject)
            } catch (err) {
              reject(err)
            }
          }
          if (passthrough) passthrough.write(data)
        })

        source.on('error', err => {
          sourceHasError = true
          reject(err)
        })

        source.on('end', () => {
          if (passthrough) passthrough.end()
        })
      })
    })
}

export function guessFileType (data, filename) {
  let fileType
  try {
    fileType = getFileType(data)
    // Open Office documents exported from Google Docs are mis-identified by
    // getFileType so in the case of fileType returning a zip file type
    // (OO docs are zip files at the top level) we fallback to a mime-type
    // and extension identification based upon filename.
    if (fileType.ext === 'zip') {
      const mimetype = mime.lookup(filename)
      const extension = mime.extension(mimetype)
      fileType = { mime: mimetype, ext: extension }
    }
    return fileType
  } catch (err) {}
}

// Create and upload a 42x42 PNG variant of a group avatar, clipped to a circle with a thin black border
function generateGroupMapVariant ({ sourceUrl, userId, type, id, originalFilename }) {
  const filenameForMap = (originalFilename || 'avatar')
    .replace(/\?.*$/, '')
    .replace(/(\.[a-zA-Z0-9]{2,4})?$/, '-forMap.png')

  const circleMaskSvg = Buffer.from('<svg width=\'42\' height=\'42\'><circle cx=\'21\' cy=\'21\' r=\'21\' fill=\'#fff\'/></svg>')

  const circleStrokeSvg = Buffer.from('<svg width=\'42\' height=\'42\'><circle cx=\'21\' cy=\'21\' r=\'20.5\' fill=\'none\' stroke=\'#000\' stroke-width=\'1\'/></svg>')

  const pngFileType = { mime: 'image/png', ext: 'png' }

  const pipeline = request.get({ url: sourceUrl, encoding: null })
    .on('error', err => {
      if (process.env.NODE_ENV === 'development') console.error('map avatar fetch error', err)
    })
    .pipe(
      sharp()
        .rotate()
        .resize(42, 42, { fit: 'cover', withoutEnlargement: true })
        .composite([
          { input: circleMaskSvg, blend: 'dest-in' },
          { input: circleStrokeSvg, blend: 'over' }
        ])
        .png()
    )

  const storage = createS3StorageStream(type, id, { userId, fileType: pngFileType, filename: filenameForMap })

  pipeline.pipe(storage)

  storage.on('finish', () => {
    if (process.env.NODE_ENV === 'development') console.log('uploaded group map avatar', storage.url)
  })

  storage.on('error', err => {
    if (process.env.NODE_ENV === 'development') console.error('map avatar upload error', err)
  })
}
