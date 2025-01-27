import { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { fetchGroupMembers } from 'routes/Members/Members.store'
import { wrapItemInWidget } from '@hylo/shared/src/ContextWidgetPresenter'

// Different widgets have different sorts of children to display. This function ensures that they are always returned via a consistent interface.
export default function useGatherItems ({ widget, groupSlug }) {
  const [listItems, setListItems] = useState([])
  const [loading, setLoading] = useState(true)
  const dispatch = useDispatch()

  useEffect(() => {
    if (widget.childWidgets && widget.childWidgets.length > 0) {
      setListItems(widget.childWidgets)
      setLoading(false)
    } else if (widget.type === 'members') {
      const fetchMembersData = async () => {
        setLoading(true)
        dispatch(fetchGroupMembers({ slug: groupSlug, first: 4 })).then(
          response => {
            const members = response.payload?.data?.group?.members.items
            if (members.length > 0) {
              setListItems(members.map(member => wrapItemInWidget(member, 'viewUser')))
              setLoading(false)
            }
          }
        )
      }
      fetchMembersData()
    } else {
      setListItems([])
      setLoading(false)
    }
  }, [widget, dispatch])

  return { listItems, loading }
}
