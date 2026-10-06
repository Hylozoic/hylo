import { parse } from 'graphql'
import acceptInvitation from './acceptInvitation'
import checkInvitation from './checkInvitation'
import { createJoinRequest } from 'routes/GroupDetail/GroupDetail.store'

function selectedFields (query, rootField) {
  const operation = parse(query).definitions[0]
  const root = operation.selectionSet.selections.find(s => s.name.value === rootField)
  return root.selectionSet.selections.map(s => s.name.value)
}

describe('invitation actions', () => {
  it('checkInvitation asks whether approval is needed and who sent a member invitation', () => {
    const { graphql } = checkInvitation({ invitationToken: 'member-token' })

    expect(selectedFields(graphql.query, 'checkInvitation')).toEqual(expect.arrayContaining(['requiresApproval', 'invitedBy']))
    expect(graphql.variables).toEqual({ invitationToken: 'member-token', accessCode: undefined })
  })

  it('acceptInvitation asks whether the person has to request to join instead', () => {
    const { graphql } = acceptInvitation({ invitationToken: 'member-token' })

    expect(selectedFields(graphql.query, 'useInvitation')).toEqual(expect.arrayContaining(['membership', 'requiresApproval', 'groupSlug']))
  })

  it('acceptInvitation leaves analytics to the caller, which knows whether anyone joined', () => {
    expect(acceptInvitation({ invitationToken: 'member-token' }).meta.analytics).toBeUndefined()
  })

  it('createJoinRequest sends the invitation token only when given one', () => {
    const withToken = createJoinRequest('1', [], 'member-token')
    const withoutToken = createJoinRequest('1', [])

    expect(parse(withToken.graphql.query).definitions[0].name.value).toBe('CreateJoinRequest')
    expect(withToken.graphql.variables).toEqual({ groupId: '1', questionAnswers: [], invitationToken: 'member-token' })
    expect(JSON.parse(JSON.stringify(withoutToken.graphql.variables))).toEqual({ groupId: '1', questionAnswers: [] })
  })
})
