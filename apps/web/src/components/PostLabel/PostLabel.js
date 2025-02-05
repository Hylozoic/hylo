import PropTypes from 'prop-types'
import React from 'react'
import Icon from 'components/Icon'
import { Tooltip } from 'react-tooltip'
import { cn } from 'util/index'
import classes from './PostLabel.module.scss'

const { string } = PropTypes

export default function PostLabel ({ type, className }) {
  const typeLowercase = type.toLowerCase()
  const typeName = type.charAt(0).toUpperCase() + typeLowercase.slice(1)

  return (
    <div className={cn(classes.label, classes[type], className)}>
      <div
        className={cn(classes.labelInner)}
        data-tooltip-content={typeName}
        data-tooltip-id='typeTip'
      >
        <Icon name={typeName} className={classes.typeIcon} dataTestId={`post-type-${typeName}`} />
      </div>
      {type === 'completed' && (
        <div className={classes.completed}>
          <Icon name='Star' className={classes.starIcon} />
        </div>
      )}

      <Tooltip
        className={classes.typeTip}
        delayShow={0}
        id='typeTip'
      />
    </div>
  )
}

PostLabel.propTypes = {
  type: string.isRequired,
  className: string
}
