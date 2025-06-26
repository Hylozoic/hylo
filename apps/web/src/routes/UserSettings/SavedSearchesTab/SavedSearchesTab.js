import isMobile from 'ismobilejs'
import React, { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Tooltip } from 'react-tooltip'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import getMe from 'store/selectors/getMe'
import { fetchSavedSearches, deleteSearch as deleteSearchAction } from '../UserSettings.store'
import { FETCH_SAVED_SEARCHES } from 'store/constants'
import { formatParams, generateViewParams } from 'util/savedSearch'
import { TriangleAlert, Info } from 'lucide-react'

export default function SavedSearchesTab () {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const loading = useSelector(state => state.pending[FETCH_SAVED_SEARCHES])
  const searches = useSelector(state => state.SavedSearches.searches)

  const viewSavedSearch = useCallback(search => {
    const { mapPath } = generateViewParams(search)
    navigate(mapPath)
  }, [navigate])

  const deleteSearch = useCallback(searchId => dispatch(deleteSearchAction(searchId)))
  const { t } = useTranslation()

  useEffect(() => { dispatch(fetchSavedSearches(currentUser.id)) }, [])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Saved Searches'),
      icon: '',
      info: '',
      search: true
    })
  }, [])

  if (!searches || loading) return <Loading />

  return (
    <div className='p-4 space-y-4'>
      {searches.length === 0 && (
        <div className='text-foreground/70 text-center py-8'>
          {t('No saved searches. You can set them up in the map')}
        </div>
      )}
      {searches.map(s =>
        <SearchControl
          key={s.id}
          search={s}
          viewSavedSearch={viewSavedSearch}
          deleteSearch={deleteSearch}
        />
      )}
    </div>
  )
}

export function SearchControl ({ search, deleteSearch, viewSavedSearch }) {
  const { t } = useTranslation()
  return (
    <div className='bg-card rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <button
            onClick={() => viewSavedSearch(search)}
            className='text-foreground hover:text-accent transition-colors font-medium'
          >
            {search.name}
          </button>
          <div
            data-tooltip-content={formatParams(search)}
            data-tooltip-id='params'
            className='text-foreground/50 hover:text-foreground/70 transition-colors cursor-help'
          >
            <Info className='w-4 h-4' />
          </div>
        </div>
        <button
          onClick={() => deleteSearch(search.id)}
          className='text-accent hover:text-accent/80 transition-colors flex items-center gap-2'
        >
          <TriangleAlert className='w-4 h-4' /> {t('Delete')}
        </button>
      </div>
      {!isMobile.any && (
        <Tooltip
          place='right'
          type='dark'
          id='params'
          effect='solid'
          multiline
          delayShow={200}
          className='params'
        />
      )}
    </div>
  )
}
