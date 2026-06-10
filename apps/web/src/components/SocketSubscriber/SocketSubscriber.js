import PropTypes from 'prop-types'
import React, { useEffect } from 'react'
import { getSocket, socketUrl } from 'client/websockets'
import { isEqual } from 'lodash'
import rollbar from 'client/rollbar'

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
      if (oldHandler) socket.off('reconnect', oldHandler)

      const newHandler = () => {
        const label = `SocketSubscriber(${type})`
        if (process.env.NODE_ENV === 'development') {
          console.log(`connecting ${label} ${id}...`)
        }
        socket.post(socketUrl(`/noo/${type}/${id}/subscribe`), (body, jwr) => {
          if (!isEqual(body, {})) {
            rollbar.error(`Failed to connect ${label}: ${body}`)
          }
        })
      }

      socket.on('reconnect', newHandler)
      newHandler()

      return newHandler
    }

    const unsubscribe = (oldHandler) => {
      const s = getSocket()
      s.off('reconnect', oldHandler)
      s.post(socketUrl(`/noo/${type}/${id}/unsubscribe`))
    }

    const reconnectHandler = subscribe()

    return () => unsubscribe(reconnectHandler)
  }, [id, type])

  return null
}

SocketSubscriber.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  type: PropTypes.string.isRequired
}
