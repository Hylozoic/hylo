import { cn } from 'util/index'
import { DateTimeHelpers } from '@hylo/shared'
import { getLocaleFromLocalStorage } from 'util/locale'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from 'components/Icon'
import { Link } from 'react-router-dom'
import Slider from 'react-slick'
import { postUrl, createPostUrl } from 'util/navigation'

import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'
import classes from './EventsWidget.module.scss'

const settings = {
  dots: true,
  infinite: false,
  speed: 500,
  slidesToShow: 1.1,
  arrows: true,
  slidesToScroll: 1
}

export default ({ items, group, routeParams, isMember }) => {
  const [swiped, setSwiped] = useState(false)

  const handleSwiped = useCallback(() => {
    setSwiped(true)
  }, [setSwiped])

  const handleOnItemClick = useCallback(
    (e) => {
      if (swiped) {
        e.stopPropagation()
        e.preventDefault()
        setSwiped(false)
      }
    },
    [swiped]
  )
  const { t } = useTranslation()

  return (
    <div className={classes.events}>
      <Slider {...settings} onSwipe={handleSwiped}>
        {items.map(e => (
          <div className={cn(classes.event, { [classes.narrow]: items.length > 1 })} key={e.id}>
            <Link to={postUrl(e.id, routeParams)} onClickCapture={handleOnItemClick}>
              <div className={classes.content}>
                <div className={classes.time}>{DateTimeHelpers.toDateTime(e.startTime, { locale: getLocaleFromLocalStorage() }).toFormat('MMM d yyyy')}</div>
                <div className={classes.title}>{e.title}</div>
                <div className={classes.location}>{e.location}</div>
              </div>
            </Link>
            <div className={classes.background} style={{ backgroundImage: `url(${e.primaryImage || '/default-event.png'})` }} />
          </div>
        ))}
        {isMember && (
          <div className={cn(classes.event, classes.createNew)}>
            <div className={classes.eventsCta}>
              <Link to={createPostUrl(routeParams, { newPostType: 'event' })}>
                <Icon name='Calendar' className={classes.eventIcon} />
                <h4>{t('Bring your group together')}</h4>
                <p>{t('What you will do at your next event?')}</p>
                <div className={classes.button}>{t('+ Create an event')}</div>
              </Link>
            </div>
          </div>
        )}
      </Slider>
    </div>
  )
}
