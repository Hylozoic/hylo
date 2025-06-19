import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { wrapItemInWidget } from '@hylo/presenters/ContextWidgetPresenter'
import { fetchGroupMembers } from 'routes/Members/Members.store'
import getMe from 'store/selectors/getMe'
import getGroupForSlug from 'store/selectors/getGroupForSlug'

// Different widgets have different sorts of children to display. This function ensures that they are always returned via a consistent interface.
export default function useGatherItems ({ widget, groupSlug }) {
  const [listItems, setListItems] = useState([])
  const [loading, setLoading] = useState(true)
  const dispatch = useDispatch()

  const me = useSelector(getMe)
  const group = useSelector(state => getGroupForSlug(state, groupSlug))

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
    if (widget.type === 'members' && group?.id) {
      const fetchMembersData = async () => {
        setLoading(true)
        dispatch(fetchGroupMembers({ slug: groupSlug, groupId: group.id, first: 5, sortBy: 'last_active_at', order: 'desc' })).then(
          response => {
            const members = response.payload?.data?.group?.members.items
            if (members.length > 0) {
              setListItems(members.filter(member => member.id !== me.id).map(member => wrapItemInWidget(member, 'viewUser')))
              setLoading(false)
            }
          }
        )
      }
      fetchMembersData()
    }
  }, [widget.type, group?.id])

  return { listItems, loading }
}
