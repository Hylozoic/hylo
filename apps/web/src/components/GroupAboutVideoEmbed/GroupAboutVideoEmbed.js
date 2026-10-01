import { cn } from 'util/index'
import React from 'react'
import { trim } from 'lodash/fp'
import ReactPlayer from 'react-player'
import { getVideoEmbedUrl } from 'util/isPlayableVideoUrl'
import classes from './GroupAboutVideoEmbed.module.scss'

export default function GroupAboutVideoEmbed ({ uri, className }) {
  if (!uri || trim(uri).length === 0) return null

  const embedUrl = getVideoEmbedUrl(uri)

  return (
    <div className={cn(classes.videoContainer, className)}>
      {embedUrl
        ? (
          <iframe
            className={classes.video}
            src={embedUrl}
            width='100%'
            height='100%'
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
            allowFullScreen
            title='About video'
          />)
        : (
          <ReactPlayer
            url={uri}
            controls
            width='100%'
            height='100%'
            className={classes.video}
          />)}
    </div>
  )
}
