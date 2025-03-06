import React from 'react'
import ReactPlayer from 'react-player'
import classes from './Feature.module.scss'

export default function Feature ({ url }) {
  if (!url) {
    // For the mobile app. If the url is not provided, get it from the querystring.
    const querystringParams = new URLSearchParams(window.location.search)
    url = querystringParams.get('url')
  }

  return (
    <ReactPlayer
      url={url}
      controls
      width='100%'
      className={classes.video}
    />
  )
}
