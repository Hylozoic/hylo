import PropTypes from 'prop-types'
import React, { useState, useEffect, useRef } from 'react'
import { cn } from 'util/index'
import { isEmpty } from 'lodash'
import { position } from 'util/scrolling'
import { useDropdown } from 'contexts/DropdownContext'
import classes from './Dropdown.module.scss'

/**
 * Dropdown component that renders a toggleable menu with optional icons
 * Supports both Lucide React icons (as JSX elements) and legacy string icon names
 */
const Dropdown = ({ children, className, triangle, items, toggleChildren, alignRight, menuAbove, noOverflow, id }) => {
  const [active, setActive] = useState(false)
  const parentRef = useRef(null)
  const { activeDropdownId, openDropdown, closeAllDropdowns } = useDropdown()

  useEffect(() => {
    if (activeDropdownId !== id) {
      setActive(false)
    }
  }, [activeDropdownId, id])

  const handleToggle = (event) => {
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

  const handleHide = (e) => {
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
      window.addEventListener('click', handleHide)
      return () => {
        window.removeEventListener('click', handleHide)
      }
    } else {
      window.removeEventListener('click', handleHide)
    }
  }, [active])

  /**
   * Renders the icon for a menu item
   * Supports Lucide React components (JSX elements) passed directly
   */
  const renderIcon = (icon) => {
    if (!icon) return null

    // If it's a React element (Lucide icon), clone it with appropriate classes
    if (React.isValidElement(icon)) {
      return React.cloneElement(icon, {
        className: cn('w-4 h-4 mr-3 shrink-0', icon.props?.className)
      })
    }

    // If it's a function component, render it
    if (typeof icon === 'function') {
      const IconComponent = icon
      return <IconComponent className='w-4 h-4 mr-3 shrink-0' />
    }

    return null
  }

  const renderMenuItems = () => {
    if (!active || (isEmpty(items) && isEmpty(children))) {
      return null
    }

    let menuItems = children || items.map(item =>
      <li
        className={cn(
          'flex items-center px-4 py-2 cursor-pointer select-none',
          'text-foreground hover:bg-accent/10 transition-colors',
          'border-b border-foreground/10 last:border-b-0',
          { 'text-destructive': item.red }
        )}
        onClick={item.onClick}
        key={item.key || item.label}
      >
        {renderIcon(item.icon)}
        <span className='whitespace-nowrap'>{item.label}</span>
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
      <span className={cn('flex items-center cursor-pointer gap-2', { [classes.toggled]: active })} onClick={handleToggle} data-testid='dropdown-toggle'>
        {toggleChildren}
      </span>
      <div
        className={cn(
          'absolute z-30 shadow-lg rounded-lg',
          alignRight ? 'right-0' : 'left-0',
          { 'bottom-4': menuAbove }
        )}
      >
        <ul
          className={cn(
            'list-none p-0 m-0 rounded-lg overflow-hidden',
            'bg-card border border-foreground/10',
            { hidden: !active },
            { 'overflow-visible': noOverflow }
          )}
          onClick={handleToggle}
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
