import { graphql, HttpResponse } from 'msw'

export default [
  graphql.query('MeQuery', () => {
    return HttpResponse.json({
      data: {
        user: {
          id: '123',
          name: 'Test User',
          email: 'test@example.com'
        }
      }
    })
  })
]
