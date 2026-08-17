import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'

import GroupAboutView from 'components/GroupAboutView'
import Loading from 'components/Loading'
import { Dialog, DialogContent, DialogTitle } from 'components/ui/dialog'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import useRouteParams from 'hooks/useRouteParams'
import fetchGroupDetails from 'store/actions/fetchGroupDetails'
import getGroupForSlug from 'store/selectors/getGroupForSlug'

/**
 * What a space is for, over whatever you were looking at — the same banner +
 * tab menu design the group About page uses, in an overlay because it answers
 * a question about the space you are already in.
 */
export default function SpaceAboutModal ({ onClose }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const spaceFullSlug = useEffectiveGroupSlug()
  const spaceGroup = useSelector(state => getGroupForSlug(state, spaceFullSlug))
  const detailsLoaded = spaceGroup?.accessibility != null

  const routeParams = useRouteParams()
  const parentSlug = routeParams.groupSlug
  const parentGroup = useSelector(state => getGroupForSlug(state, parentSlug))

  useEffect(() => {
    if (spaceFullSlug && !detailsLoaded) {
      dispatch(fetchGroupDetails({ slug: spaceFullSlug, withContextWidgets: false, withWidgets: false, withPrerequisites: false }))
    }
  }, [dispatch, spaceFullSlug, detailsLoaded])

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose?.() }}>
      {/* p-0 so the banner runs to the edges; the dialog close button sits over
          the banner, which carries its own scrim */}
      <DialogContent className='max-w-[720px] w-[calc(100%-2rem)] p-0 overflow-hidden gap-0 max-h-[85vh] flex flex-col'>
        <DialogTitle className='sr-only'>{t('About')}</DialogTitle>
        {!spaceGroup || !detailsLoaded
          ? <div className='p-10'><Loading /></div>
          : (
            <div className='flex-1 min-h-0 overflow-y-auto'>
              <GroupAboutView
                group={spaceGroup}
                parentGroup={parentGroup}
                isSpace
                onBeforeNavigate={onClose}
              />
            </div>
            )}
      </DialogContent>
    </Dialog>
  )
}
