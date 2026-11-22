import { merge } from 'lodash'
import { pick } from 'lodash/fp'

export const VALID_MEDIA_TYPES = [
  'file',
  'image',
  'gdoc',
  'video'
]

export const DEFAULT_MEDIA_TYPE = 'file'


export const createAndAddSize = function (attrs) {
  const url = attrs.type === 'image'
    ? attrs.url
    : attrs.type === 'video'
      ? attrs.thumbnail_url
      : null

  if (url) {
    return GetImageSize(url).then(dimensions =>
      Media.create(merge({}, attrs, pick(['width', 'height'], dimensions))))
  }

  return Media.create(attrs)
}

// MIME roots that are also media types. `video` and `gdoc` are legacy embed
// types (YouTube/Vimeo, Google Docs), not uploads. video/mp4 must stay a file
// or the post UI, which only renders image and file attachments, drops it.
const MEDIA_TYPE_FROM_MIME_ROOT = {
  image: 'image'
}

/** Maps an upload mimetype to image or file. Uploaded video and audio are files. */
export function getMediaTypeFromMimetype (mimetype) {
  const baseMimetype = mimetype && mimetype.split('/')[0]
  return MEDIA_TYPE_FROM_MIME_ROOT[baseMimetype] || DEFAULT_MEDIA_TYPE
}
