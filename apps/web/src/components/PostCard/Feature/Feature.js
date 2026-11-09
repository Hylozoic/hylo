import React from 'react'
import { getVideoEmbedUrl } from 'util/isPlayableVideoUrl'
import classes from './Feature.module.scss'

/** Full-width playable embed for a featured YouTube or Vimeo link preview. */
export default function Feature ({ url }) {
  const embedUrl = getVideoEmbedUrl(url)
  if (!embedUrl) return null

  return (
    <div className={classes.videoContainer} data-testid='featured-video'>
      <iframe
        className={classes.video}
        src={embedUrl}
        width='100%'
        height='100%'
        allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
        allowFullScreen
        title='Featured video'
      />
    </div>
  )
}
