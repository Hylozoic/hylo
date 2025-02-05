import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import MemberReactions from './MemberReactions'
import denormalized from '../MemberProfile.test.json'

describe('MemberReactions', () => {
  const { person } = denormalized.data

  describe('MemberProfile', () => {
    beforeEach(() => {
      mockGraphqlServer.use(
        graphql.query('MemberReactions', () => {
          return HttpResponse.json({
            data: {
              person: {
                id: '1',
                reactions: {
                  items: person.reactions
                }
              }
            }
          })
        })
      )
    })

    it('renders post cards for each reaction', async () => {
      render(
        <MemberReactions fetchMemberReactions={jest.fn()} posts={person.reactions} />
      )

      await waitFor(() => {
        person.reactions.forEach(reaction => {
          expect(screen.getByText(reaction.post.title)).toBeInTheDocument()
        })
      })
    })
  })
})
