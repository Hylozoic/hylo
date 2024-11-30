import React, { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { widgetUrl, widgetTitleResolver, widgetTypeResolver } from 'util/contextWidgets'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { baseUrl } from 'util/navigation'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { RESP_ADMINISTRATION } from 'store/constants'
import getQuerystringParam from 'store/selectors/getQuerystringParam'

export default function AllViews () {
  const location = useLocation()
  const { t } = useTranslation()
  const routeParams = useParams()

  // Access the current group and its contextWidgets
  const group = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const contextWidgets = group?.contextWidgets?.items || []

  // Determine the rootPath
  const rootPath = baseUrl({ ...routeParams, view: null })

  // Check if the user can administer the group
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: group?.id }))

  // Filter widgets based on visibility
  const visibleWidgets = contextWidgets.filter(widget => widget.visibility !== 'admin' || canAdminister)
  
  const isEditting = getQuerystringParam('cme', location) === 'yes'

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
        </div>
      )
      return (
        <div key={widget.id} className='p-4 border border-gray-300 rounded-md shadow-sm'>
          {url && (
            <a href={url} className='block text-center'>
              {cardContent}
            </a>
          )}
          {!url && (
            <div className='block text-center'>
              {cardContent}
            </div>
          )}
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
