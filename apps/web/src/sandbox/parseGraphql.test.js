import { parseGraphql } from './parseGraphql'

describe('parseGraphql', () => {
  it('extracts query operation name and root field', () => {
    const query = `
      query CheckLogin {
        me {
          id
        }
      }
    `
    expect(parseGraphql(query)).toEqual({
      kind: 'query',
      operationName: 'CheckLogin',
      rootField: 'me'
    })
  })

  it('extracts mutation root field even when operation name differs', () => {
    const query = `
      mutation CreatePost ($title: String) {
        createPost(data: { title: $title }) {
          id
        }
      }
    `
    expect(parseGraphql(query)).toEqual({
      kind: 'mutation',
      operationName: 'CreatePost',
      rootField: 'createPost'
    })
  })
})
