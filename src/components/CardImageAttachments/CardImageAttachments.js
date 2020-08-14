import React from 'react'
import PropTypes from 'prop-types'
import { filter, isEmpty } from 'lodash/fp'
import { bgImageStyle } from 'util/index'
import './CardImageAttachments.scss'

export default function CardImageAttachments ({
  attachments,
  linked,
  className
}) {
  const imageAttachments = filter({ type: 'image' }, attachments)

  if (isEmpty(imageAttachments)) return null

  const firstImageUrl = imageAttachments[0].url
  const otherImageUrls = imageAttachments.slice(1).map(ia => ia.url)

  if (!firstImageUrl) return null

  return <div style={bgImageStyle(firstImageUrl)} className={className} styleName='image'>
    <div>
      {linked && <a href={firstImageUrl} target='_blank' styleName='link'>&nbsp;</a>}
      <div styleName='others'>
        <div styleName='others-inner'>
          {!isEmpty(otherImageUrls) && otherImageUrls.map(url =>
            <a href={url} key={url} target='_blank' styleName='other'>
              <div style={bgImageStyle(url)} />
            </a>)}
        </div>
      </div>
    </div>
  </div>
}

CardImageAttachments.propTypes = {
  attachments: PropTypes.array.isRequired,
  linked: PropTypes.bool,
  className: PropTypes.string
}
