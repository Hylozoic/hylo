import PropTypes from 'prop-types'
import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from 'util/index'
import { isEmpty } from 'lodash'
import { position } from 'util/scrolling'
import { useDropdown } from 'contexts/DropdownContext'
import Tooltip from 'components/Tooltip'
import classes from './Dropdown.module.scss'

/**
 * Dropdown component that renders a toggleable menu with optional icons
 * Supports both Lucide React icons (as JSX elements) and legacy string icon names
 */
const Dropdown = ({ children, className, triangle, items, toggleChildren, alignRight, menuAbove, noOverflow, portal, id }) => {
  const [active, setActive] = useState(false)
  const [openSubmenuKey, setOpenSubmenuKey] = useState(null)
  const parentRef = useRef(null)
  const { activeDropdownId, openDropdown, closeAllDropdowns } = useDropdown()

  useEffect(() => {
    if (activeDropdownId !== id) {
      setActive(false)
      setOpenSubmenuKey(null)
    }
  }, [activeDropdownId, id])

  // Portal mode: the menu escapes overflow-clipping ancestors (post dialog on
  // phones); anchored via fixed coordinates measured at open
  const [anchorRect, setAnchorRect] = useState(null)

  const handleToggle = (event) => {
    if (event) {
      event.stopPropagation()
      event.preventDefault()
    }
    if (portal && parentRef.current) {
      setAnchorRect(parentRef.current.getBoundingClientRect())
    }
    if (!active) {
      closeAllDropdowns()
      openDropdown(id)
      setActive(true)
    } else {
      closeAllDropdowns()
      setActive(false)
      setOpenSubmenuKey(null)
    }
  }

  const handleHide = (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (active) {
      closeAllDropdowns()
      setActive(false)
      setOpenSubmenuKey(null)
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

    let menuItems = children || items.map(item => {
      if (item.items?.length) {
        const submenuKey = item.key || item.label
        const submenuOpen = openSubmenuKey === submenuKey
        return (
          <li
            className={cn(
              'relative group/submenu flex items-center px-4 py-2 cursor-pointer select-none',
              'text-foreground hover:bg-accent/10 transition-colors',
              'border-b border-foreground/10 last:border-b-0'
            )}
            key={submenuKey}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              item.onOpen?.()
              setOpenSubmenuKey(prev => prev === submenuKey ? null : submenuKey)
            }}
          >
            {renderIcon(item.icon)}
            <span className='whitespace-nowrap flex-1'>{item.label}</span>
            <span className='ml-2 text-foreground/40'>›</span>
            <ul
              className={cn(
                'absolute top-0 list-none p-0 m-0 rounded-lg overflow-hidden',
                'bg-card border border-foreground/10 shadow-lg z-40 min-w-[160px]',
                'opacity-0 invisible group-hover/submenu:opacity-100 group-hover/submenu:visible',
                { 'opacity-100 visible': submenuOpen },
                alignRight ? 'right-full mr-1' : 'left-full ml-1'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {item.items.map(subItem => (
                <li
                  key={subItem.key || subItem.label}
                  className={cn(
                    'flex items-center px-4 py-2 cursor-pointer select-none',
                    'text-foreground hover:bg-accent/10 transition-colors',
                    'border-b border-foreground/10 last:border-b-0',
                    { 'text-foreground/40 cursor-default hover:bg-transparent': subItem.disabled }
                  )}
                  onClick={(e) => {
                    if (subItem.disabled) {
                      e.stopPropagation()
                      e.preventDefault()
                      return
                    }
                    subItem.onClick?.(e)
                    handleHide(e)
                  }}
                >
                  {renderIcon(subItem.icon)}
                  <span className='whitespace-nowrap'>{subItem.label}</span>
                </li>
              ))}
            </ul>
          </li>
        )
      }

      return (
        <li
          className={cn(
            'flex items-center px-4 py-2 cursor-pointer select-none',
            'text-foreground hover:bg-accent/10 transition-colors',
            'border-b border-foreground/10 last:border-b-0',
            { 'text-destructive': item.red },
            { 'text-foreground/40 cursor-default hover:bg-transparent': item.disabled }
          )}
          onClick={(e) => {
            if (item.disabled) {
              e.stopPropagation()
              e.preventDefault()
              return
            }
            item.onClick?.(e)
          }}
          data-tooltip-id={item.tooltip ? `dropdown-tt-${id}` : undefined}
          data-tooltip-content={item.tooltip}
          title={item.tooltip}
          key={item.key || item.label}
        >
          {renderIcon(item.icon)}
          <span className='whitespace-nowrap'>{item.label}</span>
        </li>
      )
    })

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
      {items?.some(item => item.tooltip) && (
        <Tooltip delay={200} id={`dropdown-tt-${id}`} position='left' />
      )}
      {portal && active && anchorRect
        ? createPortal(
          <div
            className='fixed z-[300] shadow-lg rounded-lg'
            style={{
              top: anchorRect.bottom + 4,
              ...(alignRight
                ? { right: Math.max(8, window.innerWidth - anchorRect.right) }
                : { left: anchorRect.left }),
              maxHeight: `calc(100vh - ${anchorRect.bottom + 16}px)`,
              overflowY: 'auto'
            }}
          >
            <ul
              className='list-none p-0 m-0 rounded-lg bg-card border border-foreground/10 overflow-hidden'
              onClick={handleToggle}
            >
              {renderMenuItems()}
            </ul>
          </div>,
          document.body
        )
        : (
          <div
            className={cn(
              'absolute z-30 shadow-lg rounded-lg',
              alignRight ? 'right-0' : 'left-0',
              { 'bottom-4': menuAbove }
            )}
          >
            <ul
              className={cn(
                'list-none p-0 m-0 rounded-lg',
                'bg-card border border-foreground/10',
                { hidden: !active },
                { 'overflow-hidden': !noOverflow },
                { 'overflow-visible': noOverflow || items?.some(item => item.items?.length) }
              )}
              onClick={handleToggle}
            >
              {renderMenuItems()}
            </ul>
          </div>
          )}
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
  portal: PropTypes.bool,
  id: PropTypes.string
}

const margin = 10

const findTriangleLeftPos = parent => {
  if (!parent) return
  return position(parent).x + parent.offsetWidth - margin - 1
}

export default Dropdown
