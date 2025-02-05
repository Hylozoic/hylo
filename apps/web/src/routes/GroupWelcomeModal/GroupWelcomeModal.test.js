import React from 'react'
import { graphql, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import orm from 'store/models'
import extractModelsForTest from 'util/testing/extractModelsForTest'
import GroupWelcomeModal from './GroupWelcomeModal'
import * as reactRouterDom from 'react-router-dom'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

it('selects group, displays agreements and suggested skills, and renders nothing when showJoinForm is false', async () => {
  const testGroup = {
    id: '1',
    name: 'Test Group',
    slug: 'test-group',
    bannerUrl: 'anything',
    settings: {
      showSuggestedSkills: true
    }
  }
  const testMembership = {
    id: '1',
    person: { id: '1' },
    settings: {
      showJoinForm: true
    },
    group: testGroup
  }

  function testProviders () {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    const reduxState = { orm: ormSession.state }

    extractModelsForTest({
      me: {
        id: '1',
        memberships: {
          items: [testMembership]
        }
      }
    }, 'Me', ormSession)

    extractModelsForTest({
      groups: [testGroup]
    }, 'Group', ormSession)

    return AllTheProviders(reduxState)
  }

  mockGraphqlServer.use(
    graphql.query('GroupWelcomeQuery', () => {
      return HttpResponse.json({
        data: {
          group: {
            id: testGroup.id,
            agreements: {
              items: [{ id: 1, description: 'Do good stuff always', title: 'Be cool' }]
            },
            suggestedSkills: {
              items: [
                { id: '1', name: 'a-skill-to-have' }
              ]
            }
          }
        }
      })
    }),
    graphql.mutation('UpdateMembershipSettings', () => {
      return HttpResponse.json({
        data: {
          group: {
            id: testGroup.id
          }
        }
      })
    })
  )

  jest.spyOn(reactRouterDom, 'useParams').mockReturnValue({ groupSlug: testGroup.slug })

  const { container } = render(
    <GroupWelcomeModal />,
    { wrapper: testProviders() }
  )

  const user = userEvent.setup()

  await waitFor(() => {
    // expect(await screen.findByText(`Welcome to ${testGroup.name}!`)).toBeInTheDocument() TODO: Fix this test
    expect(screen.getByText('Do good stuff always')).toBeInTheDocument()
  })

  const cbEl = screen.getByTestId('cbAgreement0')
  expect(cbEl).toBeInTheDocument()
  expect(cbEl).not.toBeChecked()

  await user.click(cbEl)
  await user.click(screen.getByTestId('jump-in'))

  await waitFor(() => {
    expect(screen.getByText('a-skill-to-have')).toBeInTheDocument()
  })

  await user.click(screen.getByTestId('jump-in'))

  expect(container).toBeEmptyDOMElement()
})
