import React from 'react'
import DOMPurify from 'dompurify'

/**
 * Allowed HTML tags for sanitization
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'span', 'div', 'hr', 'img', 'video', 'iframe'
]

/**
 * Allowed HTML attributes
 */
const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'class', 'title', 'src', 'alt',
  'width', 'height', 'frameborder', 'allowfullscreen', 'data-type'
]

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} html - Raw HTML content
 * @returns {string} Sanitized HTML
 */
function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return ''
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_ATTR: ['target'], // Allow target for links
    // Prevent javascript: URLs
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout']
  })
}

/**
 * Transform embedded video tags to iframe embeds for proper video playback
 * Only transforms <video data-type="embed"> tags (YouTube/Vimeo embeds)
 * Regular <video> tags (HTML5 video files) are left unchanged
 */
function transformVideoTags(html) {
  if (!html || typeof html !== 'string') return html

  // Match <video data-type="embed"> tags with src attribute (handles both self-closing and with closing tag)
  return html.replace(/<video[^>]*data-type=["']embed["'][^>]*src=["']([^"']+)["'][^>]*(\/>|><\/video>)/gi, (match, src) => {
    // Validate src to prevent javascript: URLs
    if (!src || src.match(/^javascript:/i)) {
      return '' // Remove invalid embeds
    }
    
    // Only allow known video platforms
    const allowedDomains = ['youtube.com', 'www.youtube.com', 'youtu.be', 'vimeo.com', 'www.vimeo.com']
    try {
      const url = new URL(src)
      if (!allowedDomains.includes(url.hostname)) {
        return '' // Remove embeds from unknown domains
      }
    } catch (e) {
      return '' // Remove invalid URLs
    }
    
    // Create responsive iframe wrapper
    // Note: src is already extracted from HTML attribute, so it's safe to use in attribute context
    return `<div class="relative w-full aspect-video overflow-hidden my-4">
      <iframe
        class="absolute top-0 left-0 w-full h-full"
        width="640"
        height="360"
        frameborder="0"
        allowfullscreen
        src="${src}"
      ></iframe>
    </div>`
  })
}

export default function HyloHTML ({
  html,
  element = 'div',
  className,
  ...props
}) {
  // First transform video tags, then sanitize to prevent XSS
  const transformedHtml = transformVideoTags(html)
  const sanitizedHtml = sanitizeHtml(transformedHtml)

  return (
    React.createElement(
      element,
      {
        ...props,
        className: `global-postContent ${className || ''}`.trim(),
        dangerouslySetInnerHTML: { __html: sanitizedHtml }
      }
    )
  )
}
