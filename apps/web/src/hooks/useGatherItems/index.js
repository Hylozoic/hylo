import { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { fetchGroupMembers } from 'routes/Members/Members.store'
import { wrapItemInWidget } from '@hylo/presenters/ContextWidgetPresenter'

// Different widgets have different sorts of children to display. This function ensures that they are always returned via a consistent interface.
export default function useGatherItems ({ widget, groupSlug }) {
  const [listItems, setListItems] = useState([])
  const [loading, setLoading] = useState(true)
  const dispatch = useDispatch()

  // XXX: I had to split this up into two use effects otherwise any time any widget updated it would re-fetch the member data for the members widget
  useEffect(() => {
    if (widget.childWidgets && widget.childWidgets.length > 0) {
      setListItems(widget.childWidgets)
      setLoading(false)
    } else if (widget.type !== 'members') {
      setListItems([])
      setLoading(false)
    }
  }, [widget])

  // XXX: Now this one only happens the first time the members widget is loaded
  useEffect(() => {
    if (widget.type === 'members') {
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
    }
  }, [])

  return { listItems, loading }
}
