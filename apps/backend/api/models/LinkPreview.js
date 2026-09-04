import { get } from 'lodash/fp'
import { getLinkPreview } from 'link-preview-js'
import { TextHelpers } from '@hylo/shared'

const HYLO_POST_PATH = /\/post\/(\d+)(?:\/|$)/
const KNOWN_HYLO_HOSTS = [
  'hylo.com',
  'www.hylo.com',
  'staging.hylo.com',
  'localhost',
  '127.0.0.1'
]
const MAX_DESCRIPTION_LENGTH = 144

/** Hostname (minus www) so a scrape with no og:title still produces a usable preview. */
function fallbackTitle (url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch (e) {
    return url
  }
}

const LinkPreview = bookshelf.Model.extend({
  tableName: 'link_previews',
  requireFetch: false,
  hasTimestamps: true
}, {
  queue: async url => {
    try {
      const { id } = await LinkPreview.forge({ url, created_at: new Date() }).save()

      return Queue.classMethod('LinkPreview', 'populate', { id }, 0)
    } catch (err) {
      if (err.message && !err.message.includes('duplicate key value')) {
        throw err
      }
    }
  },

  /** True when the URL host is this Hylo environment or a known Hylo host. */
  isHyloHost: url => {
    let parsed
    try {
      parsed = new URL(url)
    } catch {
      return false
    }

    const host = parsed.host.toLowerCase()
    const hostname = parsed.hostname.toLowerCase()
    const configured = (process.env.DOMAIN || '').toLowerCase()

    return host === configured ||
      hostname === configured ||
      KNOWN_HYLO_HOSTS.includes(hostname)
  },

  /** Returns the post id from a Hylo post URL, or null. */
  parseHyloPostId: url => {
    if (!LinkPreview.isHyloHost(url)) return null
    let pathname
    try {
      pathname = new URL(url).pathname
    } catch {
      return null
    }
    const match = pathname.match(HYLO_POST_PATH)
    return match ? match[1] : null
  },

  /**
   * Preview fields for a public Hylo post (title, body text, first image).
   * Private posts and non-Hylo URLs return null so scrapers never leak private content.
   */
  attrsForPublicHyloPost: async url => {
    const postId = LinkPreview.parseHyloPostId(url)
    if (!postId) return null

    const post = await Post.find(postId)
    if (!post || !post.isPublic()) return null

    const description = TextHelpers.presentHTMLToText(post.details(), { truncate: MAX_DESCRIPTION_LENGTH })
    const title = post.summary() || description || 'Hylo'
    const media = await post.media('image').fetch()
    const firstImage = media
      ? media.models.slice().sort((a, b) => (a.get('position') || 0) - (b.get('position') || 0))[0]
      : null

    const attrs = { title, description }
    if (firstImage?.get('url')) {
      attrs.image_url = firstImage.get('url')
    }
    return attrs
  },

  populate: async ({ id }) => {
    const preview = await LinkPreview.find(id)
    const doneAttrs = () => ({ updated_at: new Date(), done: true })

    try {
      const hyloAttrs = await LinkPreview.attrsForPublicHyloPost(preview.get('url'))
      if (hyloAttrs) {
        return preview.save({ ...doneAttrs(), ...hyloAttrs })
      }

      const linkPreviewData = await getLinkPreview(preview.get('url'), {
        followRedirects: 'follow',
        headers: {
          'user-agent': 'Twitterbot/1.0',
          'Accept-Language': 'en-US'
        }
      })
      const attrs = doneAttrs()

      attrs.title = linkPreviewData?.title || fallbackTitle(preview.get('url'))
      attrs.description = linkPreviewData?.description

      const imageURL = get('images[0]', linkPreviewData) || get('favicons[0]', linkPreviewData)

      if (imageURL) {
        attrs.image_url = imageURL
      }

      return preview.save(attrs)
    } catch (err) {
      sails.log.warn('LinkPreview.populate failed:', preview.get('url'), err.message)
      return preview.save({ ...doneAttrs(), title: fallbackTitle(preview.get('url')) })
    }
  },

  find: (idOrUrl, opts) => {
    const attr = isNaN(Number(idOrUrl)) ? 'url' : 'id'
    return LinkPreview.where(attr, idOrUrl).fetch(opts)
  },

  /**
   * Finds an existing preview for the URL, or creates one and fetches OG metadata.
   * Safe to call concurrently for the same URL (duplicate key is retried as a find).
   */
  findOrCreateAndPopulate: async url => {
    let preview = await LinkPreview.find(url)

    if (!preview) {
      try {
        preview = await LinkPreview.forge({ url, created_at: new Date() }).save()
      } catch (err) {
        if (err.message && err.message.includes('duplicate key value')) {
          preview = await LinkPreview.find(url)
        } else {
          throw err
        }
      }
    }

    if (!preview) return null
    // Re-fetch when a prior scrape finished without a title (blocked UA, timeout).
    if (!preview.get('done') || !preview.get('title')) {
      await LinkPreview.populate({ id: preview.id })
      preview = await LinkPreview.find(preview.id)
    }

    return preview
  }
})

module.exports = LinkPreview
