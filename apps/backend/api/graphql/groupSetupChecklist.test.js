/* eslint-disable no-unused-expressions */
import { createRequestHandler } from './index'
import { updateMembership } from './mutations/membership'
import '../../test/setup'
import factories from '../../test/setup/factories'

const CHECKLIST_FIELDS = `
  isCreator
  hasOtherMembers
  hasPostByOthers
  hasCreatorPost
  hasEvent
  hasInvitation
`

describe('Group setupChecklist', () => {
  let handler

  async function inject (user, document) {
    const req = factories.mock.request()
    req.url = '/noo/graphql'
    req.method = 'POST'
    req.headers = { 'Content-Type': 'application/json' }
    req.session = { userId: user.id, destroy: () => {} }
    req.user = user
    const res = factories.mock.response()
    const { executionResult } = await handler.inject({ document, serverContext: { req, res } })
    expect(executionResult.errors).to.be.undefined
    return executionResult.data
  }

  function checklistAs (user, group) {
    return inject(user, `{ group(id: "${group.id}") { id setupChecklist { ${CHECKLIST_FIELDS} } } }`)
      .then(data => data.group.setupChecklist)
  }

  async function postIn (group, user, type) {
    const post = await factories.post({ user_id: user.id, type }).save()
    await group.posts().attach(post.id)
    return post
  }

  before(() => {
    handler = createRequestHandler()
  })

  it('starts with nothing done for the founder of a new group', async () => {
    const founder = await factories.user().save()
    const group = await Group.create(founder.id, { name: 'Checklist Fresh', slug: `checklist-fresh-${founder.id}` })

    expect(await checklistAs(founder, group)).to.deep.equal({
      isCreator: true,
      hasOtherMembers: false,
      hasPostByOthers: false,
      hasCreatorPost: false,
      hasEvent: false,
      hasInvitation: false
    })
  })

  it('ticks the items as the founder does them', async () => {
    const founder = await factories.user().save()
    const group = await Group.create(founder.id, { name: 'Checklist Progress', slug: `checklist-progress-${founder.id}` })

    await postIn(group, founder, 'chat')
    let checklist = await checklistAs(founder, group)
    expect(checklist.hasCreatorPost).to.be.false

    await postIn(group, founder, 'discussion')
    await postIn(group, founder, 'event')
    await bookshelf.knex('group_invites').insert({
      created_at: new Date(),
      invited_by_id: founder.id,
      token: `checklist-${founder.id}`,
      email: 'invitee@example.com',
      group_id: group.id
    })

    checklist = await checklistAs(founder, group)
    expect(checklist).to.include({ hasCreatorPost: true, hasEvent: true, hasInvitation: true })
    expect(checklist).to.include({ hasOtherMembers: false, hasPostByOthers: false })
  })

  it('reports when someone else joins and posts', async () => {
    const founder = await factories.user().save()
    const member = await factories.user().save()
    const group = await Group.create(founder.id, { name: 'Checklist Joined', slug: `checklist-joined-${founder.id}` })
    await group.addMembers([member.id])

    let checklist = await checklistAs(founder, group)
    expect(checklist.hasOtherMembers).to.be.true
    expect(checklist.hasPostByOthers).to.be.false

    await postIn(group, member, 'discussion')
    checklist = await checklistAs(founder, group)
    expect(checklist.hasPostByOthers).to.be.true
  })

  it('is only visible to Administrators', async () => {
    const founder = await factories.user().save()
    const member = await factories.user().save()
    const group = await Group.create(founder.id, { name: 'Checklist Private', slug: `checklist-private-${founder.id}` })
    await group.addMembers([member.id])

    expect(await checklistAs(member, group)).to.be.null
  })

  it('remembers dismissal in the founder\'s membership settings', async () => {
    const founder = await factories.user().save()
    const group = await Group.create(founder.id, { name: 'Checklist Dismissed', slug: `checklist-dismissed-${founder.id}` })

    await updateMembership(founder.id, {
      groupId: group.id,
      data: { settings: { setupChecklistDismissedAt: '2026-09-28T12:00:00.000Z' } }
    })

    const data = await inject(founder, '{ me { memberships { group { id } settings { setupChecklistDismissedAt } } } }')
    const membership = data.me.memberships.find(m => String(m.group.id) === String(group.id))
    expect(membership.settings.setupChecklistDismissedAt).to.exist
    expect(new Date(membership.settings.setupChecklistDismissedAt).toISOString()).to.equal('2026-09-28T12:00:00.000Z')
  })
})
