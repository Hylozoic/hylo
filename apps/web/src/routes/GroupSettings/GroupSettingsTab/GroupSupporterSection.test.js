import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen, waitFor, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import GroupSupporterSection from './GroupSupporterSection'

const group = { id: '7', name: 'Garden Club' }

describe('GroupSupporterSection', () => {
  it('lets a group admin show the badge when the group is a supporter', async () => {
    const calls = []
    mockGraphqlServer.use(
      graphql.query('GroupSupporterInfo', () => HttpResponse.json({ data: { groupSupporterInfo: { supporterStatus: 'supporter', showSupporterBadge: false } } })),
      graphql.mutation('SetSupporterBadgeVisibility', ({ variables }) => {
        calls.push(variables)
        return HttpResponse.json({ data: { setSupporterBadgeVisibility: true } })
      })
    )
    render(<GroupSupporterSection group={group} />)
    const toggle = await screen.findByTestId('group-show-supporter-badge')
    fireEvent.click(toggle)
    await waitFor(() => expect(calls).toEqual([{ groupId: '7', show: true }]))
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('explains how a group becomes a supporter', async () => {
    mockGraphqlServer.use(
      graphql.query('GroupSupporterInfo', () => HttpResponse.json({ data: { groupSupporterInfo: { supporterStatus: 'none', showSupporterBadge: false } } }))
    )
    render(<GroupSupporterSection group={group} />)
    expect(await screen.findByText(/counts their contribution for the group/)).toBeInTheDocument()
    expect(screen.queryByTestId('group-show-supporter-badge')).not.toBeInTheDocument()
  })

  it('renders nothing for people who are not group admins', async () => {
    mockGraphqlServer.use(
      graphql.query('GroupSupporterInfo', () => HttpResponse.json({ errors: [{ message: 'no', extensions: { code: 'NOT_GROUP_ADMIN' } }] }))
    )
    const { container } = render(<GroupSupporterSection group={group} />)
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(container).toBeEmptyDOMElement()
  })
})
