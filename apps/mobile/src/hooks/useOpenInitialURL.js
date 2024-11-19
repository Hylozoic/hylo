import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import useOpenURL from './useOpenURL'
import { SET_INITIAL_URL } from 'store/constants'

export default function useOpenInitialURL (loading, wait = 0) {
  const dispatch = useDispatch()
  const openURL = useOpenURL()
  const initialURL = useSelector(state => state.initialURL)

  const openInitialURL = async () => {
    if (!loading && initialURL) {
      setTimeout(() => {
        dispatch({ type: SET_INITIAL_URL, payload: null })
        openURL(initialURL)
      }, wait)
    } else {
      dispatch({ type: SET_INITIAL_URL, payload: null })
    }
  }

  useEffect(() => {
    openInitialURL()
  }, [loading, initialURL])
}
