import React, { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import ClickCatcher from 'components/ClickCatcher'
import HyloHTML from 'components/HyloHTML'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import useGroupViews from 'hooks/useGroupViews'

/** True when page HTML has visible text or embedded media. */
function pageHtmlHasContent (html) {
  if (!html) return false
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  if (text.length > 0) return true
  return /<(img|video|iframe|audio)\b/i.test(html)
}

/** Renders a custom HTML page GroupView (type = page). */
function GroupPageView () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const { viewId } = useParams()
  const groupSlug = useEffectiveGroupSlug()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const groupViews = useGroupViews(group)
  const groupId = group?.id
  const groupViewsLoaded = group?.groupViews != null

  const pageView = useMemo(() => {
    return groupViews.find(view => view.type === 'page' && String(view.id) === String(viewId))
  }, [groupViews, viewId])
  const presented = useMemo(
    () => pageView ? GroupViewPresenter(pageView) : null,
    [pageView]
  )
  const pageHtml = pageView?.pageContent || ''
  const hasPageContent = pageHtmlHasContent(pageHtml)
  const title = presented ? displayNameForView(presented, t) : t('Page')
  const headerIcon = presented?.lucideIcon || presented?.iconName || 'FileText'

  const { setHeaderDetails } = useViewHeader()

  useEffect(() => {
    if (groupId && !groupViewsLoaded) {
      dispatch(fetchGroupViews(groupId))
    }
  }, [dispatch, groupId, groupViewsLoaded])

  useEffect(() => {
    setHeaderDetails({
      title,
      icon: headerIcon,
      search: true
    })
  }, [setHeaderDetails, title, headerIcon])

  if (!group) return <Loading />
  if (!groupViewsLoaded) return <Loading />

  return (
    <div className='p-4 global-postContent hylo-page-html max-w-[750px] mx-auto'>
      {!hasPageContent && (
        <p className='text-foreground/60'>
          {t('This page has no content yet')}
        </p>
      )}
      {hasPageContent && (
        <ClickCatcher groupSlug={groupSlug}>
          <HyloHTML html={pageHtml} />
        </ClickCatcher>
      )}
    </div>
  )
}

export default GroupPageView
