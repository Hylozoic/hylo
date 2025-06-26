import React from 'react'
import { useTranslation } from 'react-i18next'
import { find } from 'lodash/fp'
import TextInput from 'components/TextInput'
import Dropdown from 'components/Dropdown/Dropdown'
import Icon from 'components/Icon/Icon'
import classes from './AllTopics.module.scss'

export default function SearchBar ({ search, setSearch, selectedSort, setSort, fetchIsPending }) {
  const { t } = useTranslation()
  const sortOptions = [
    { id: 'name', label: t('Name') },
    { id: 'num_followers', label: t('Popular') },
    { id: 'updated_at', label: t('Recent') }
  ]
  let selected = find(o => o.id === selectedSort, sortOptions)

  if (!selected) selected = sortOptions[0]

  return (
    <div className={classes.searchBar}>
      <TextInput
        className={classes.searchInput}
        value={search}
        placeholder={t('Search topics')}
        loading={fetchIsPending}
        noClearButton
        onChange={event => setSearch(event.target.value)}
      />
      <Dropdown
        id='all-topics-search-order-dropdown'
        className={classes.searchOrder}
        toggleChildren={(
          <span className={classes.searchSorterLabel}>
            {selected.label}
            <Icon name='ArrowDown' />
          </span>
        )}
        items={sortOptions.map(({ id, label }) => ({
          label,
          onClick: () => setSort(id)
        }))}
        alignRight
      />
    </div>
  )
}
