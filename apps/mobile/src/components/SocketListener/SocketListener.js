import { useLayoutEffect } from 'react'
import { isEqual } from 'lodash'
import { isDev } from 'config'
import { getSocket, socketUrl } from 'services/websockets'

let socket, handler

export default function SocketListener (props) {
  const handlers = {
    newNotification: props.receiveNotification,
    newPost: props.receivePost,
    newThread: props.newThread
  }

  useLayoutEffect(() => {
    (async function () {
      socket = await getSocket()

      handler = () => {
        if (isDev) console.log('connecting SocketListener...')
        setTimeout(() => socket.post(socketUrl('/noo/threads/subscribe'), (body, jwr) => {
          if (!isEqual(body, {})) {
            if (isDev) console.error(`Failed to connect SocketListener: ${body}`)
          }
        }), 500)
      }

      handler()

      Object.keys(handlers).forEach(socketEvent =>
        socket.on(socketEvent, handlers[socketEvent])
      )

      socket.on('reconnect', handler)
    })()

    return () => {
      if (!socket) return

      socket.off('reconnect', handler)
      socket.post(socketUrl('/noo/threads/unsubscribe'))
      Object.keys(handlers).forEach(socketEvent =>
        socket.off(socketEvent, handlers[socketEvent])
      )
    }
  }, [])

  return null
}
