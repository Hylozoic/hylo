import PropTypes from 'prop-types'
import { useEffect } from 'react'
import { getSocket, socketUrl } from 'client/websockets'
import { isEqual } from 'lodash'
import errorReporter from 'client/errorReporter'

export default function SocketSubscriber ({ id, type }) {
  useEffect(() => {
    if (!['post', 'group', 'user'].includes(type)) {
      throw new Error(`unrecognized SocketSubscriber type "${type}"`)
    }

    if (!id) {
      return undefined
    }

    const socket = getSocket()

    const subscribe = (oldHandler) => {
      if (oldHandler) {
        socket.off('connect', oldHandler)
        socket.off('reconnect', oldHandler)
      }

      const newHandler = () => {
        const label = `SocketSubscriber(${type})`
        if (process.env.NODE_ENV === 'development') {
          console.log(`connecting ${label} ${id}...`)
        }
        socket.post(socketUrl(`/noo/${type}/${id}/subscribe`), (body, jwr) => {
          if (!isEqual(body, {})) {
            errorReporter.error(`Failed to connect ${label}: ${body}`)
          }
        })
      }

      // 'connect' fires on every successful connection, including reconnections
      // after a server restart — 'reconnect' alone never reached this socket, so
      // rooms silently stayed unjoined until a hard refresh. Subscribing twice is
      // harmless: joins are idempotent server-side.
      socket.on('connect', newHandler)
      socket.on('reconnect', newHandler)
      newHandler()

      return newHandler
    }

    const unsubscribe = (oldHandler) => {
      const s = getSocket()
      s.off('connect', oldHandler)
      s.off('reconnect', oldHandler)
      s.post(socketUrl(`/noo/${type}/${id}/unsubscribe`))
    }

    const reconnectHandler = subscribe()

    // Waking the tab re-posts the (idempotent) subscribe: the server answers
    // with a fresh roster, reconciling any presence events missed while asleep
    const handleVisible = () => {
      if (document.visibilityState === 'visible') reconnectHandler()
    }
    document.addEventListener('visibilitychange', handleVisible)

    return () => {
      document.removeEventListener('visibilitychange', handleVisible)
      unsubscribe(reconnectHandler)
    }
  }, [id, type])

  return null
}

SocketSubscriber.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  type: PropTypes.string.isRequired
}
