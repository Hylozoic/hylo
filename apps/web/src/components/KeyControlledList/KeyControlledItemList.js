import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import PropTypes from 'prop-types'
import { indexOf, omit } from 'lodash/fp'
import Icon from 'components/Icon'
import { accessibilityIcon, visibilityIcon } from 'store/models/Group'
import KeyControlledList from './KeyControlledList'
import classes from './KeyControlledItemList.module.scss'

const { array, func, object, bool, string } = PropTypes

const KeyControlledItemList = forwardRef(({
  onChange,
  items,
  selected,
  tabChooses = true,
  theme = {
    items: null,
    item: null,
    itemActive: null
  },
  className,
  renderListItem,
  tagType,
  ...props
}, ref) => {
  const { t } = useTranslation()
  const kclRef = useRef()

  useImperativeHandle(ref, () => ({
    handleKeys: (event) => {
      return kclRef.current.handleKeys(event)
    }
  }))

  const change = (choice, event) => {
    event.preventDefault()
    onChange(choice, event)
  }

  const onChangeExtractingItem = (element, node, event) => {
    const item = items[node.getAttribute('data-index')]
    change(item, event)
  }

  const defaultRenderListItem = item => (
    <li className={theme.item} key={item.id || 'blank'}>
      <a onClick={event => change(item, event)}>
        <div>
          <span>{item.name || item.title}</span>
        </div>
        {tagType && tagType === 'groups' && (
          <div className={classes.keyListMemberCount}>
            <div>
              <Icon name='Members' className={classes.keyListPrivacyIcon} /> {item.memberCount} {t('Member', { count: item.memberCount })}
            </div>
            <div>
              <Icon name={accessibilityIcon(item.accessibility)} className={classes.keyListPrivacyIcon} />
              <Icon name={visibilityIcon(item.visibility)} className={classes.keyListPrivacyIcon} />
            </div>
          </div>
        )}
      </a>
    </li>
  )

  const renderItem = renderListItem
    ? item => renderListItem({ item, handleChoice: change })
    : defaultRenderListItem

  const listItems = items.map(renderItem)
  const selectedIndex = indexOf(selected, items)

  return (
    <div ref={ref}>
      <KeyControlledList
        theme={theme}
        tagType={tagType}
        ref={kclRef}
        tabChooses={tabChooses}
        selectedIndex={selectedIndex}
        onChange={onChangeExtractingItem}
        {...omit('onChange', props)}
      >
        {listItems}
      </KeyControlledList>
    </div>
  )
})

KeyControlledItemList.propTypes = {
  onChange: func.isRequired,
  items: array,
  selected: object,
  tabChooses: bool,
  theme: object,
  className: string,
  renderListItem: func
}

export default KeyControlledItemList
