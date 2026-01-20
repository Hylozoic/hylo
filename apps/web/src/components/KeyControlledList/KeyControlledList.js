import { cn } from 'util/index'
import { isEmpty, omit } from 'lodash/fp'
import PropTypes from 'prop-types'
import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useTranslation } from 'react-i18next'
import { getKeyCode, keyMap } from 'util/textInput'

import classes from './KeyControlledList.module.scss'

const { array, func, object, bool, number, string } = PropTypes

const propsToOmit = ['onChange', 'tabChooses', 'spaceChooses', 'selectedIndex', 'items', 'theme', 'tagType', 'renderListItem', 'backgroundClassName']

const KeyControlledList = forwardRef(({
  onChange,
  children,
  selectedIndex: initialSelectedIndex = 0,
  tabChooses = false,
  spaceChooses = true,
  theme = {
    items: null,
    item: null,
    itemActive: null
  },
  tagType,
  backgroundClassName = 'bg-background border border-foreground/20 rounded-md',
  ...props
}, ref) => {
  const { t } = useTranslation()
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex)

  useEffect(() => {
    const max = children.length - 1
    if (selectedIndex > max) {
      setSelectedIndex(max)
    }
  }, [children, selectedIndex])

  const changeSelection = (delta) => {
    if (isEmpty(children)) return

    let i = selectedIndex
    const length = React.Children.count(children)

    i += delta
    if (i < 0) i += length
    i = i % length

    setSelectedIndex(i)
  }

  const handleKeys = (event) => {
    const chooseCurrentItem = () => {
      if (isEmpty(children)) return false

      const elementChoice = childrenWithRefs[selectedIndex]
      if (elementChoice) {
        const nodeChoice = elementChoice.ref.current
        change(elementChoice, nodeChoice, event)
        return true
      }

      event.preventDefault()
      return false
    }

    switch (getKeyCode(event)) {
      case keyMap.UP:
        event.preventDefault()
        changeSelection(-1)
        return true
      case keyMap.DOWN:
        event.preventDefault()
        changeSelection(1)
        return true
      case keyMap.TAB:
        if (tabChooses) return chooseCurrentItem()
        return true
      case keyMap.SPACE:
        if (spaceChooses !== false) return chooseCurrentItem()
        break
      case keyMap.ENTER:
        return chooseCurrentItem()
    }

    return false
  }

  useImperativeHandle(ref, () => ({
    handleKeys
  }))

  const change = (element, node, event) => {
    event.preventDefault()
    onChange(element, node, event)
  }

  const childrenWithRefs = React.Children.map(children,
    (element, i) => {
      const active = selectedIndex === i
      const className = cn(
        theme.item,
        { [theme.itemActive]: active }
      )
      // const el = element && element.props ? React.cloneElement(element, { ref: React.createRef(), className }) : element

      return element && element.props
        ? React.cloneElement(element, { ref: React.createRef(), 'data-index': i, className })
        : element
    })

  return (
    <div className={cn('KeyControlledList w-full')} ref={ref}>
      {tagType && tagType === 'groups' && <div className={classes.keyListLabel}>{t('Groups')}</div>}
      <ul {...omit(propsToOmit, props)} tabIndex='-1' className={cn('KeyControlledList-list w-full pl-1 max-h-[200px] overflow-scroll', backgroundClassName)}>
        {childrenWithRefs}
      </ul>
    </div>
  )
})

KeyControlledList.propTypes = {
  onChange: func,
  children: array,
  selectedIndex: number,
  tabChooses: bool,
  spaceChooses: bool,
  theme: object,
  backgroundClassName: string
}

export default KeyControlledList
