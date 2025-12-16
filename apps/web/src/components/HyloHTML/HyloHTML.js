import React from 'react'

/**
 * Transform embedded video tags to iframe embeds for proper video playback
 * Only transforms <video data-type="embed"> tags (YouTube/Vimeo embeds)
 * Regular <video> tags (HTML5 video files) are left unchanged
 */
function transformVideoTags (html) {
  if (!html || typeof html !== 'string') return html

  // Match <video data-type="embed"> tags with src attribute (handles both self-closing and with closing tag)
  return html.replace(/<video[^>]*data-type=["']embed["'][^>]*src=["']([^"']+)["'][^>]*(\/>|><\/video>)/gi, (match, src) => {
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
  const transformedHtml = transformVideoTags(html)

  return (
    React.createElement(
      element,
      {
        ...props,
        className: `global-postContent ${className || ''}`.trim(),
        dangerouslySetInnerHTML: { __html: transformedHtml }
      }
    )
  )
}
