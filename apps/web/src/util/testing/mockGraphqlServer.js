import { graphql, http, HttpResponse, ws } from 'msw'
import { setupServer } from 'msw/node'
import { toSocketIo } from '@mswjs/socket.io-binding'

// TODO: figure out better way to mock websocket stuff, without warnings.
const chat = ws.link('ws://localhost:3001')

const emptyGraphqlResponse = () => HttpResponse.json({ data: {} })

// Unit tests use window.location.origin (http://localhost) as the API host
const hyloGraphql = graphql.link('http://localhost/noo/graphql')

const handlers = [
  // Catch-all so unmocked GraphQL calls don't hit the network and flake tests.
  // Tests can still override with mockGraphqlServer.use(...).
  hyloGraphql.operation(emptyGraphqlResponse),
  graphql.operation(emptyGraphqlResponse),
  http.post('http://localhost/noo/graphql', emptyGraphqlResponse),
  http.post('http://localhost:3001/noo/graphql', emptyGraphqlResponse),
  http.post('*/noo/graphql', emptyGraphqlResponse),
  chat.addEventListener('connection', (connection) => {
    console.log('socket connection')
    const io = toSocketIo(connection)

    io.on('hello', (event, name) => {
      console.log('client sent hello:', name)
    })

    event.onopen = () => console.log('WebSocket connection established')
    event.onerror = (error) => console.error('WebSocket error:', error)
    event.onclose = () => console.log('WebSocket connection closed')
  })
]

const mockGraphqlServer = setupServer(...handlers)

export default mockGraphqlServer

// AuthLayoutRouter empty handlers for reference; to reduce boilerplace
// possibly pre-polulate these on each test load
//
// graphql.query('MeQuery', ({ query, variables }) => {
//   return HttpResponse.json({
//     data: {
//       me: null
//     }
//   })
// }),
// graphql.query('FetchForGroup', () => {
//   return HttpResponse.json({
//     data: {
//       group: null
//     }
//   })
// }),
// graphql.query('GroupDetailsQuery', () => {
//   return HttpResponse.json({
//     data: {
//       group: null
//     }
//   })
// }),
// graphql.query('MessageThreadsQuery', () => {
//   return HttpResponse.json({
//     data: {
//       me: null
//     }
//   })
// }),
// graphql.query('MyPendingJoinRequestsQuery', () => {
//   return HttpResponse.json({
//     data: {
//       joinRequests: null
//     }
//   })
// }),
// graphql.query('NotificationsQuery', () => {
//   return HttpResponse.json({
//     data: {
//       notifications: null
//     }
//   })
// })
