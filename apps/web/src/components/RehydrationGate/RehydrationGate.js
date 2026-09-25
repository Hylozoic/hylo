import React, { useEffect, useState } from 'react'
import { useStore } from 'react-redux'
import Loading from 'components/Loading'
import { isTest } from 'config/index'
import { getBootstrapRehydrated } from 'store/selectors/getBootstrap'

export default function RehydrationGate ({ children }) {
  const store = useStore()
  const [ready, setReady] = useState(() => isTest || getBootstrapRehydrated(store.getState()))

  useEffect(() => {
    if (isTest) return

    if (getBootstrapRehydrated(store.getState())) {
      setReady(true)
      return
    }

    return store.subscribe(() => {
      if (getBootstrapRehydrated(store.getState())) {
        setReady(true)
      }
    })
  }, [store])

  if (!ready) return <Loading type='fullscreen' />

  return children
}
