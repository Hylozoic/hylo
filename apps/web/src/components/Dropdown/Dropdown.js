import PropTypes from 'prop-types'
import React, { useState, useEffect, useRef } from 'react'
import { cn } from 'util/index'
import { isEmpty } from 'lodash'
import { position } from 'util/scrolling'
import Icon from 'components/Icon'
import classes from './Dropdown.module.scss'

const Dropdown = ({ children, className, triangle, items, toggleChildren, alignRight, menuAbove, noOverflow }) => {
  const [active, setActive] = useState(false)
  const parentRef = useRef(null)

  const toggle = (event) => {
    if (event) {
      event.stopPropagation()
      event.preventDefault()
    }
    setActive(!active)
  }

  const hide = () => {
    if (active) setActive(false)
    return true
  }

  useEffect(() => {
    window.addEventListener('click', hide)
    return () => {
      window.removeEventListener('click', hide)
    }
  }, [active])

  const renderMenuItems = () => {
    if (!active || (isEmpty(items) && isEmpty(children))) {
      return null
    }

    let menuItems = children || items.map(item =>
      <li
        className={cn(classes.linkItem, { [classes.redItem]: item.red })}
        onClick={item.onClick}
        key={item.key || item.label}
      >
        {item.icon && <Icon className={classes.icon} name={item.icon} />}
        {item.label}
      </li>)

    if (triangle) {
      const triangleLi = (
        <li
          className={classes.triangle} key='triangle'
          style={{ left: findTriangleLeftPos(parentRef.current) }}
        />
      )
      menuItems = [triangleLi].concat(menuItems)
    }

    return menuItems
  }

  return (
    <div className={cn(className, classes.dropdown, { [classes.hasTriangle]: triangle })} ref={parentRef}>
      <span className={cn(classes.dropdownToggle, { [classes.toggled]: active })} onClick={toggle} data-testid='dropdown-toggle'>
        {toggleChildren}
      </span>
      <span className={cn(classes.closeDropdown, { [classes.toggled]: active })} onClick={toggle}><Icon name='Ex' /></span>
      <div className={cn(classes.wrapper, { [classes.alignRight]: alignRight, [classes.menuAbove]: menuAbove })}>
        <ul
          className={cn(classes.dropdownMenu, { [classes.active]: active, [classes.alignRight]: alignRight, [classes.noOverflow]: noOverflow })}
          onClick={toggle}
        >
          {renderMenuItems()}
        </ul>
      </div>
    </div>
  )
}

Dropdown.propTypes = {
  className: PropTypes.string,
  triangle: PropTypes.bool,
  items: PropTypes.array,
  toggleChildren: PropTypes.object.isRequired,
  alignRight: PropTypes.bool,
  menuAbove: PropTypes.bool,
  noOverflow: PropTypes.bool
}

const margin = 10

const findTriangleLeftPos = parent => {
  if (!parent) return
  return position(parent).x + parent.offsetWidth - margin - 1
}

export default Dropdown
