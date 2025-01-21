import React, { useLayoutEffect } from 'react'
import { getSocket, socketUrl } from 'services/websockets'

let socket, handler

export default function SocketSubscriber ({ id, type }) {
  useLayoutEffect(() => {
    (async function () {
      if (!id) return Promise.resolve()

      if (!['post', 'group'].includes(type)) {
        throw new Error(`unrecognized SocketSubscriber type "${type}"`)
      }

      socket = await getSocket()
      handler = () => socket.post(socketUrl(`/noo/${type}/${id}/subscribe`))

      socket.on('reconnect', handler)

      handler()
    })()

    return async () => {
      if (!id) return {}

      socket.off('reconnect', handler)
      socket.post(socketUrl(`/noo/${type}/${id}/unsubscribe`))
    }
  }, [type, id])

  return null
}
