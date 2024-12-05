import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import BadgedIcon from 'components/BadgedIcon'
import Badge from 'components/Badge'
import Icon from 'components/Icon'
import cx from 'classnames'
import classes from './NavLink.module.scss'

export default function NavLink ({ to, exact, label, icon, badge, onClick, home = false, externalLink }) {
  const location = useLocation()
  if (externalLink) {
    return (
      <li className={cx(classes.item)}>
        <a href={externalLink} target='_blank' rel='noreferrer' className={cx(classes.link)} onClick={onClick}>
          <BadgedIcon name={icon} showBadge={badge} className={classes.icon} />
          <span className={classes.label}>{label}</span>
          <Badge number={badge} expanded />
          {home ? <Icon name='Home' /> : ''}
        </a>
      </li>
    )
  }

  const active = location.pathname === to

  return (
    <li className={cx(classes.item, { [classes.active]: active })}>
      <Link to={to} className={cx(classes.link)} onClick={onClick}>
        <BadgedIcon name={icon} green={active} showBadge={badge} className={classes.icon} />
        <span className={classes.label}>{label}</span>
        <Badge number={badge} expanded />
        {home ? <Icon name='Home' /> : ''}
      </Link>
    </li>
  )
}
