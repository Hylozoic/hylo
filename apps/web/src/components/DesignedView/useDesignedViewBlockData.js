import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import fetchDesignedViewBlockData from 'store/actions/fetchDesignedViewBlockData'

// How long a block's list is reused before asking the server again. Long enough
// that redrawing a page during a design chat does not refetch unchanged blocks.
const CACHE_MS = 60 * 1000
const cache = new Map()

export function clearDesignedViewBlockDataCache () {
  cache.clear()
}

function cacheKey (groupSlug, block) {
  return JSON.stringify([groupSlug, block.type, block.limit, block.postTypes || null])
}

/**
 * The live list for a posts, events or members block of a designed view.
 * Returns { items, loading, error }.
 */
export default function useDesignedViewBlockData (groupSlug, block) {
  const dispatch = useDispatch()
  const key = cacheKey(groupSlug, block)
  const [state, setState] = useState(() => {
    const cached = cache.get(key)
    return cached && Date.now() - cached.at < CACHE_MS
      ? { items: cached.items, loading: false, error: null }
      : { items: [], loading: true, error: null }
  })

  useEffect(() => {
    if (!groupSlug) return
    const cached = cache.get(key)
    if (cached && Date.now() - cached.at < CACHE_MS) {
      setState({ items: cached.items, loading: false, error: null })
      return
    }

    let current = true
    setState(previous => ({ ...previous, loading: true, error: null }))
    Promise.resolve(dispatch(fetchDesignedViewBlockData(groupSlug, block)))
      .then(response => {
        if (response?.error) throw response.payload || new Error('Request failed')
        const group = response?.payload?.data?.group
        const items = (block.type === 'members' ? group?.members?.items : group?.posts?.items) || []
        cache.set(key, { items, at: Date.now() })
        if (current) setState({ items, loading: false, error: null })
      })
      .catch(error => {
        if (current) setState({ items: [], loading: false, error })
      })
    return () => { current = false }
  }, [dispatch, groupSlug, key])

  return state
}
