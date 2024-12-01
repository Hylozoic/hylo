import React, { useMemo, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Icon from 'components/Icon'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { widgetUrl, widgetTitleResolver, widgetTypeResolver, isValidHomeWidget } from 'util/contextWidgets'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { baseUrl } from 'util/navigation'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { RESP_ADMINISTRATION } from 'store/constants'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { setHomeWidget, updateContextWidget } from 'store/actions/contextWidgets'

export default function AllViews () {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useParams()

  // Access the current group and its contextWidgets
  const group = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const contextWidgets = group?.contextWidgets?.items || []

  // Determine the rootPath
  const rootPath = baseUrl({ ...routeParams, view: null })

  // Check if the user can administer the group
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: group?.id }))

  // Filter widgets based on visibility
  const visibleWidgets = contextWidgets.filter(widget => {
    if (widget.visibility === 'admin' && !canAdminister) return false
    if (widget.type === 'home') return false
    return true
  })

  const isEditting = getQuerystringParam('cme', location) === 'yes'

  const handleWidgetHomePromotion = useCallback((widget) => {
    if (window.confirm(t('Are you sure you want to set this widget as the home/default widget for this group?'))) {
      dispatch(setHomeWidget({ contextWidgetId: widget.id, groupId: group.id }))
    }
  }, [t, setHomeWidget])

  const handleWidgetUpdate = useCallback((widget) => {
    dispatch(updateContextWidget(
      dispatch(updateContextWidget({
        contextWidgetId: widget.id,
        groupId: group.id,
        data: { parentId: null, addToEnd: true }
      }))
    ))
  }, [t, updateContextWidget])

  // Create widget cards
  const widgetCards = useMemo(() => {
    return visibleWidgets.map(widget => {
      const title = widgetTitleResolver({ widget, t })
      const url = widgetUrl({ widget, rootPath, groupSlug: routeParams.groupSlug, context: 'group' })
      const type = widgetTypeResolver({ widget })
      const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1)
      const capitalizedView = widget.view ? widget.view.charAt(0).toUpperCase() + widget.view.slice(1) : ''
      const cardContent = (
        <div>
          <h3 className='text-lg font-semibold'>{title}</h3>
          {widgetTypeResolver({ widget }) && (
            <span className='text-sm text-gray-600'>
              {t('Type')}: {t(capitalizedType)}
            </span>
          )}
          {widget.view && (
            <span className='text-sm text-gray-600 block'>
              {t('View')}: {t(capitalizedView)}
            </span>
          )}
          {isEditting && isValidHomeWidget(widget) && (
            <span className='text-sm text-gray-600 block'>
              <Icon
                name='Home'
                onClick={(evt) => {
                  evt.stopPropagation()
                  handleWidgetHomePromotion(widget)
                }}
              />
            </span>
          )}
          {isEditting && !widget.order && (
            <span className='text-sm text-gray-600 block'>
              <Icon
                name='Plus'
                onClick={(evt) => {
                  evt.stopPropagation()
                  handleWidgetUpdate(widget)
                }}
              />
            </span>
          )}
        </div>
      )
      return (
        <div key={widget.id} onClick={() => url ? navigate(url) : null} className={`p-4 border border-gray-300 rounded-md shadow-sm ${url ? 'cursor-pointer' : ''}`}>
          <div className='block text-center'>
            {cardContent}
          </div>
        </div>
      )
    })
  }, [visibleWidgets, rootPath, routeParams.groupSlug])

  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4'>
      {widgetCards}
    </div>
  )
}
