import React, { useEffect, useState } from 'react'
import ReactPlayer from 'react-player'
import { useTranslation } from 'react-i18next'
import { Expand, Shrink } from 'lucide-react'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import { cn, bgImageStyle } from 'util/index'

import classes from './LinkPreview.module.scss'

export default function LinkPreview ({ loading, featured: providedFeatured, ...props }) {
  const [isVideo, setIsVideo] = useState()
  const [featured, setFeatured] = useState()
  const { linkPreview, onClose, onFeatured, className } = props
  const url = linkPreview?.url
  const { t } = useTranslation()

  const toggleFeatured = () => {
    setFeatured(!featured)
    onFeatured(!featured)
  }

  useEffect(() => {
    if (url) {
      const isVideo = ReactPlayer.canPlay(url)

      setIsVideo(isVideo)

      if (typeof providedFeatured !== 'undefined') {
        setFeatured(providedFeatured)
      } else {
        setFeatured(isVideo)
        onFeatured(isVideo)
      }
    }
  }, [url, providedFeatured])

  if (loading) return <Loading />

  const { title, description, imageUrl } = linkPreview
  const imageStyle = bgImageStyle(imageUrl)
  const domain = url && new URL(url).hostname.replace('www.', '')

  return (
    <>
      <div className={cn(classes.container, className)}>
        {featured && (
          <span className={classes.featured}>
            <span><strong>{t('Featured:')}</strong> {t('This video will be full-width, displayed above the description, and playable.')}</span>
          </span>
        )}
        <div className={classes.linkPreview}>
          {imageUrl && (
            <div style={imageStyle} className={classes.image}>
              {isVideo && !featured && (
                <Expand className={cn(classes.featureButton, { [classes.featured]: featured })} onClick={toggleFeatured} />
              )}
              {isVideo && featured && (
                <Shrink className={cn(classes.featureButton, { [classes.featured]: featured })} onClick={toggleFeatured} />
              )}
            </div>
          )}
          <div className={classes.text}>
            <div className={classes.header}>
              <span className={classes.title}>{title}</span>
              <span onClick={onClose} className={classes.close}>
                <Icon name='Ex' className={classes.icon} />
              </span>
            </div>
            <div className={classes.description}>{description}</div>
            <div className={classes.domain}>{domain}</div>
          </div>
        </div>
      </div>
    </>
  )
}
