import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'

import fetchPublicStripeOfferings from 'store/actions/fetchPublicStripeOfferings'

/**
 * Loads published (public) Stripe offerings for a selling group.
 * Used to decide which paywalled spaces appear in the menu.
 */
export default function usePublishedOfferings (groupId) {
  const dispatch = useDispatch()
  const [offerings, setOfferings] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load () {
      if (!groupId) {
        setOfferings([])
        return
      }
      try {
        const result = await dispatch(fetchPublicStripeOfferings({ groupId }))
        if (cancelled) return
        const responseData = result?.payload?.getData
          ? result.payload.getData()
          : result?.payload?.data?.publicStripeOfferings
        setOfferings(responseData?.offerings || [])
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching published offerings:', error)
          setOfferings([])
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [dispatch, groupId])

  return offerings
}
