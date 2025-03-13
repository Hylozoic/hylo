import { useState, useEffect } from 'react'
import { take } from 'lodash/fp'
import ContextWidgetPresenter, { wrapItemInWidget } from '@hylo/presenters/ContextWidgetPresenter'
import useGroup from './useGroup'

// Different widgets have different sorts of children to display. This function ensures that
// they are always returned via a consistent interface. This will eventually replace the
// useGatherItems hook on web.
export default function useContextWidgetChildren ({ widget, groupSlug }) {
  const [{ group }] = useGroup({ groupSlug })
  const [contextWidgetChildren, setContextWidgetChildren] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (widget.childWidgets && widget.childWidgets.length > 0) {
      setContextWidgetChildren(widget.childWidgets)
      setLoading(false)
    } else if (widget.type === 'members' && group?.members?.items) {
      setContextWidgetChildren(
        take(4, group.members.items).map(
          member => ContextWidgetPresenter(wrapItemInWidget(member, 'viewUser'))
        )
      )
      setLoading(false)
    } else {
      setContextWidgetChildren([])
      setLoading(false)
    }
  }, [widget, group?.members])

  return { contextWidgetChildren, loading }
}
