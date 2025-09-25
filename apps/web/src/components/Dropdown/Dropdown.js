import PropTypes from 'prop-types'
import React, { useState, useEffect, useRef } from 'react'
import { cn } from 'util/index'
import { isEmpty } from 'lodash'
import { position } from 'util/scrolling'
import Icon from 'components/Icon'
import { useDropdown } from 'contexts/DropdownContext'
import classes from './Dropdown.module.scss'

const Dropdown = ({ children, className, triangle, items, toggleChildren, alignRight, menuAbove, noOverflow, id }) => {
  const [active, setActive] = useState(false)
  const parentRef = useRef(null)
  const { activeDropdownId, openDropdown, closeAllDropdowns } = useDropdown()

  useEffect(() => {
    if (activeDropdownId !== id) {
      setActive(false)
    }
  }, [activeDropdownId, id])

  const toggle = (event) => {
    if (event) {
      event.stopPropagation()
      event.preventDefault()
    }
    if (!active) {
      closeAllDropdowns()
      openDropdown(id)
    } else {
      closeAllDropdowns()
    }
    setActive(!active)
  }

  const hide = (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (active) {
      closeAllDropdowns()
      setActive(false)
    }
    return true
  }

  useEffect(() => {
    if (active) {
      window.addEventListener('click', hide)
      return () => {
        window.removeEventListener('click', hide)
      }
    } else {
      window.removeEventListener('click', hide)
    }
  }, [active])

  const renderMenuItems = () => {
    if (!active || (isEmpty(items) && isEmpty(children))) {
      return null
    }

    let menuItems = children || items.map(item =>
      <li
        className={cn('flex items-center gap-1 p-2 m-0 cursor-pointer transition-all scale-100 hover:scale-105', { [classes.redItem]: item.red })}
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
    <div className={cn(className, 'relative inline-block transition-all', { [classes.hasTriangle]: triangle })} ref={parentRef}>
      <span className={cn('flex items-center cursor-pointer gap-2', { [classes.toggled]: active })} onClick={toggle} data-testid='dropdown-toggle'>
        {toggleChildren}
      </span>
      <div className={cn(classes.wrapper, { [classes.alignRight]: alignRight, [classes.menuAbove]: menuAbove })}>
        <ul
          className={cn('bg-background m-0 p-0 rounded', { [classes.active]: active, [classes.alignRight]: alignRight, [classes.noOverflow]: noOverflow })}
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
  noOverflow: PropTypes.bool,
  id: PropTypes.string
}

const margin = 10

const findTriangleLeftPos = parent => {
  if (!parent) return
  return position(parent).x + parent.offsetWidth - margin - 1
}

export default Dropdown
