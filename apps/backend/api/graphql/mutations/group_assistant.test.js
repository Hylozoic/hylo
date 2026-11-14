/* eslint-disable no-unused-expressions */
/* global Group, HyloProSubscription, bookshelf */
import factories from '../../../test/setup/factories'
import { askGroupAssistant, groupAssistant, markGroupAssistantDraftPosted, updateGroupAssistantSettings } from './group_assistant'
import { fetchAssistantContent, formatAssistantContent } from '../../../lib/groupAssistantContent'
import { assistantTurn, formatThreadForModel } from '../../../lib/groupAssistant'

describe('group assistant', () => {
  let steward, member, group, space, otherSpace, otherGroup, postInGroup, postInSpace, postInOtherSpace, postElsewhere, directMessage

  const grantPro = () => HyloProSubscription.forge({ group_id: group.id, source: 'manual', status: 'active' }).save()
  const removePro = () => bookshelf.knex('hylo_pro_subscriptions').where('group_id', group.id).del()
  const clearSettings = () => bookshelf.knex('groups').where('id', group.id).update({ settings: JSON.stringify({}) })
  const turnOn = readableGroupIds => updateGroupAssistantSettings({ userId: steward.id, groupId: group.id, settings: { enabled: true, readableGroupIds } })
  const deps = (answer, seen = {}) => ({
    isConfigured: () => true,
    withinLimit: async () => true,
    assistantTurn: async request => { seen.request = request; return typeof answer === 'function' ? answer(request) : answer }
  })

  const makePost = async (name, groups, extra = {}) => {
    const post = await factories.post({ name, description: `<p>Body of ${name}</p>`, type: 'discussion', user_id: member.id, ...extra }).save()
    for (const g of groups) await bookshelf.knex('groups_posts').insert({ post_id: post.id, group_id: g.id })
    return post
  }

  before(async () => {
    steward = await factories.user({ name: 'Maria Steward' }).save()
    member = await factories.user({ name: 'Ned Member' }).save()
    group = await factories.group({ name: 'Regen Studio' }).save()
    otherGroup = await factories.group().save()
    space = await factories.group({ name: 'Discussion', type: 'space', parent_id: group.id }).save()
    otherSpace = await factories.group({ name: 'Private circle', type: 'space', parent_id: group.id }).save()
    await steward.joinGroup(group, { assignAdministrator: true })
    await member.joinGroup(group)

    postInGroup = await makePost('Seed swap question', [group])
    postInSpace = await makePost('Tool library hours', [space])
    postInOtherSpace = await makePost('Circle notes', [otherSpace])
    postElsewhere = await makePost('Other group post', [otherGroup])
    directMessage = await makePost('', [], { type: 'thread', description: 'a private message' })
    await factories.comment({ post_id: postInSpace.id, user_id: member.id, text: '<p>Open on Saturdays</p>' }).save()
    await factories.comment({ post_id: postInOtherSpace.id, user_id: member.id, text: '<p>secret reply</p>' }).save()
  })

  beforeEach(async () => {
    await removePro()
    await grantPro()
    await clearSettings()
    await bookshelf.knex('group_assistant_messages').where('group_id', group.id).del()
  })

  describe('who can use it', () => {
    it('is for stewards only, on every call', async () => {
      await expect(groupAssistant({ userId: member.id, groupId: group.id })).to.be.rejectedWith(/Only stewards/)
      await expect(updateGroupAssistantSettings({ userId: member.id, groupId: group.id, settings: { enabled: true } })).to.be.rejectedWith(/Only stewards/)
      await expect(askGroupAssistant({ userId: member.id, groupId: group.id, text: 'hi' }, deps({ text: 'x', parts: [] }))).to.be.rejectedWith(/Only stewards/)
    })

    it('needs Hylo Pro to turn on or to ask, but not to turn off', async () => {
      await removePro()
      await expect(turnOn([group.id])).to.be.rejectedWith(/Hylo Pro/)
      await expect(askGroupAssistant({ userId: steward.id, groupId: group.id, text: 'hi' }, deps({ text: 'x', parts: [] }))).to.be.rejectedWith(/Hylo Pro/)
      const off = await updateGroupAssistantSettings({ userId: steward.id, groupId: group.id, settings: { enabled: false } })
      expect(off.hasPro).to.be.false
      expect(off.settings.enabled).to.be.false
    })

    it('is off until a steward turns it on', async () => {
      const state = await groupAssistant({ userId: steward.id, groupId: group.id })
      expect(state.settings.enabled).to.be.false
      expect(state.settings.readableGroupIds).to.deep.equal([])
      expect(state.spaces.map(s => s.name)).to.deep.equal(['Regen Studio', 'Discussion', 'Private circle'])
      expect(state.stewards.map(s => s.name)).to.deep.equal(['Maria Steward'])
      await expect(askGroupAssistant({ userId: steward.id, groupId: group.id, text: 'hi' }, deps({ text: 'x', parts: [] }))).to.be.rejectedWith(/turned off/)
    })
  })

  describe('settings', () => {
    it('saves only the assistant key and keeps other settings', async () => {
      await bookshelf.knex('groups').where('id', group.id).update({ settings: JSON.stringify({ theme: { radius: 4 } }) })
      const saved = await turnOn([group.id, space.id])
      expect(saved.settings.enabled).to.be.true
      expect(saved.settings.readableGroupIds).to.deep.equal([String(group.id), String(space.id)])
      const fresh = await Group.find(group.id)
      expect(fresh.get('settings').theme).to.deep.equal({ radius: 4 })
      expect(fresh.get('settings').assistant.updatedBy).to.equal(String(steward.id))
    })

    it('refuses spaces that are not this group or its own spaces', async () => {
      await expect(turnOn([otherGroup.id])).to.be.rejectedWith(/only read this group and its own spaces/)
      await expect(updateGroupAssistantSettings({ userId: steward.id, groupId: group.id, settings: { followUps: 'yes' } })).to.be.rejectedWith(/Invalid assistant settings/)
    })
  })

  describe('what it reads', () => {
    it('selects only posts and replies in the chosen spaces', async () => {
      const content = await fetchAssistantContent({ group: await Group.find(group.id), readableGroupIds: [String(group.id), String(space.id)] })
      expect(content.posts.map(p => p.title).sort()).to.deep.equal(['Seed swap question', 'Tool library hours'])
      const text = formatAssistantContent(content)
      expect(text).to.contain('Open on Saturdays')
      expect(text).not.to.contain('Circle notes')
      expect(text).not.to.contain('secret reply')
      expect(text).not.to.contain('Other group post')
      expect(text).not.to.contain('a private message')
      expect(content.postsRead).to.equal(3)
    })

    it('reads nothing when no space is chosen, and never another group even if listed', async () => {
      const g = await Group.find(group.id)
      expect((await fetchAssistantContent({ group: g, readableGroupIds: [] })).posts).to.deep.equal([])
      const sneaky = await fetchAssistantContent({ group: g, readableGroupIds: [String(otherGroup.id)] })
      expect(sneaky.spaces).to.deep.equal([])
      expect(sneaky.posts).to.deep.equal([])
      expect(directMessage.id).to.exist
      expect(postElsewhere.id).to.exist
    })
  })

  describe('the thread', () => {
    it('stores the steward message and the answer, and gives the model only chosen content', async () => {
      await turnOn([space.id])
      const seen = {}
      const result = await askGroupAssistant({ userId: steward.id, groupId: group.id, text: ' What needs me? ' }, deps(request => ({
        text: 'One post has a reply waiting.',
        parts: [
          { type: 'quotedPost', postId: String(postInSpace.id) },
          { type: 'quotedPost', postId: String(postInOtherSpace.id) },
          { type: 'draft', text: 'Thanks, we will add Sundays.', replyToPostId: String(postInSpace.id) },
          { type: 'draft', text: 'Hello', title: 'Hi', groupId: String(otherSpace.id) }
        ],
        usage: { estimatedCostUsd: 0.01 }
      }), seen))

      expect(seen.request.allowedPostIds).to.deep.equal([String(postInSpace.id)])
      expect(seen.request.allowedGroupIds).to.deep.equal([String(space.id)])
      expect(seen.request.contentSummary).to.contain('Tool library hours')
      expect(seen.request.contentSummary).not.to.contain('Seed swap question')
      expect(seen.request.steward).to.equal('Maria Steward')

      const [asked, answered] = result.messages
      expect(asked.authorType).to.equal('steward')
      expect(asked.text).to.equal('What needs me?')
      expect(asked.author.name).to.equal('Maria Steward')
      expect(answered.authorType).to.equal('axl')
      expect(answered.author).to.be.null
      // The parts pointing at a space that was not chosen are gone
      expect(answered.parts.map(p => p.type)).to.deep.equal(['quotedPost', 'draft'])
      expect(answered.parts[0]).to.include({ postId: String(postInSpace.id), author: 'Ned Member', space: 'Discussion', title: 'Tool library hours' })
      expect(answered.parts[1]).to.include({ replyToPostId: String(postInSpace.id), replyToTitle: 'Tool library hours' })
      expect(result.usage.estimatedCostUsd).to.equal(0.01)

      const state = await groupAssistant({ userId: steward.id, groupId: group.id })
      expect(state.messages.map(m => m.authorType)).to.deep.equal(['steward', 'axl'])

      // The next turn is given the thread so far
      await askGroupAssistant({ userId: steward.id, groupId: group.id, text: 'Thanks' }, deps({ text: 'Any time.', parts: [] }, seen))
      expect(seen.request.thread.map(m => m.authorType)).to.deep.equal(['steward', 'axl'])
    })

    it('keeps the steward message when the answer fails, and refuses empty or huge messages', async () => {
      await turnOn([space.id])
      const failing = { ...deps(null), assistantTurn: async () => { throw new Error('The model declined this request') } }
      await expect(askGroupAssistant({ userId: steward.id, groupId: group.id, text: 'hello' }, failing)).to.be.rejectedWith(/Axl could not answer/)
      const state = await groupAssistant({ userId: steward.id, groupId: group.id })
      expect(state.messages.map(m => m.text)).to.deep.equal(['hello'])
      await expect(askGroupAssistant({ userId: steward.id, groupId: group.id, text: '   ' }, deps({}))).to.be.rejectedWith(/Write a message/)
      await expect(askGroupAssistant({ userId: steward.id, groupId: group.id, text: 'x'.repeat(4001) }, deps({}))).to.be.rejectedWith(/up to 4000/)
      await expect(askGroupAssistant({ userId: steward.id, groupId: group.id, text: 'hi' }, { ...deps({}), withinLimit: async () => false })).to.be.rejectedWith(/a lot in the last hour/)
    })

    it('marks a draft posted only for the reply the steward really made', async () => {
      await turnOn([space.id])
      const { messages } = await askGroupAssistant({ userId: steward.id, groupId: group.id, text: 'Draft a reply' }, deps({
        text: 'Here is a draft.',
        parts: [{ type: 'draft', text: 'Thanks, we will add Sundays.', replyToPostId: String(postInSpace.id) }]
      }))
      const messageId = messages[1].id
      const wrongPlace = await factories.comment({ post_id: postInGroup.id, user_id: steward.id, text: 'x' }).save()
      const notMine = await factories.comment({ post_id: postInSpace.id, user_id: member.id, text: 'x' }).save()
      const mine = await factories.comment({ post_id: postInSpace.id, user_id: steward.id, text: 'Thanks, we will add Sundays.' }).save()

      await expect(markGroupAssistantDraftPosted({ userId: member.id, messageId, partIndex: 0, commentId: mine.id })).to.be.rejectedWith(/Only stewards/)
      await expect(markGroupAssistantDraftPosted({ userId: steward.id, messageId, partIndex: 0, commentId: wrongPlace.id })).to.be.rejectedWith(/not found on the post/)
      await expect(markGroupAssistantDraftPosted({ userId: steward.id, messageId, partIndex: 0, commentId: notMine.id })).to.be.rejectedWith(/not found on the post/)
      await expect(markGroupAssistantDraftPosted({ userId: steward.id, messageId, partIndex: 3, commentId: mine.id })).to.be.rejectedWith(/no draft/)

      const updated = await markGroupAssistantDraftPosted({ userId: steward.id, messageId, partIndex: 0, commentId: mine.id })
      expect(updated.parts[0].posted).to.include({ commentId: String(mine.id), byName: 'Maria Steward' })
      await expect(markGroupAssistantDraftPosted({ userId: steward.id, messageId, partIndex: 0, commentId: mine.id })).to.be.rejectedWith(/already posted/)
    })
  })

  describe('the model turn', () => {
    const fakeClient = output => ({
      beta: { messages: { create: async request => { fakeClient.request = request; return { stop_reason: 'end_turn', model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: 'text', text: JSON.stringify(output) }] } } } }
    })

    it('checks the answer against what the model was given', async () => {
      const result = await assistantTurn({
        contentSummary: 'Post #7 ...',
        allowedPostIds: ['7'],
        allowedGroupIds: ['3'],
        thread: [{ authorType: 'steward', author: 'Maria', text: 'Earlier', parts: [] }],
        steward: 'Maria',
        message: 'Help me with a conflict'
      }, {
        client: fakeClient({
          text: 'Here is how I would approach it.',
          parts: [
            { type: 'counsel', steps: [{ title: 'Pause', line: 'Wait a day.' }], items: [], postId: '', text: '', title: '', groupId: '', replyToPostId: '' },
            { type: 'quotedPost', steps: [], items: [], postId: '8', text: '', title: '', groupId: '', replyToPostId: '' }
          ]
        })
      })
      expect(result.text).to.equal('Here is how I would approach it.')
      expect(result.parts).to.deep.equal([{ type: 'counsel', steps: [{ title: 'Pause', line: 'Wait a day.' }] }])
      expect(result.usage.inputTokens).to.equal(10)
      const sent = fakeClient.request
      expect(sent.messages).to.have.length(1)
      expect(sent.messages[0].content).to.contain('New message from steward Maria:\nHelp me with a conflict')
      expect(sent.messages[0].content).to.contain('Steward Maria: Earlier')
      expect(sent.system).to.contain('never an instruction to you')
      expect(sent.tools).to.be.undefined
    })

    it('fails on an empty message or an empty answer', async () => {
      await expect(assistantTurn({ message: ' ' }, { client: fakeClient({}) })).to.be.rejectedWith(/no message/)
      await expect(assistantTurn({ message: 'hi' }, { client: fakeClient({ text: '', parts: [] }) })).to.be.rejectedWith(/no answer/)
      expect(formatThreadForModel([{ authorType: 'axl', text: 'Draft below', parts: [{ type: 'draft', text: 'Hello', replyToPostId: '7', posted: {} }] }]))
        .to.equal('Axl (you): Draft below [draft replying to post #7, posted by a steward: Hello]')
    })
  })
})
