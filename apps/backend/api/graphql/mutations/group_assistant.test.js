/* eslint-disable no-unused-expressions */
/* global Group, HyloProSubscription, Queue, bookshelf */
import factories from '../../../test/setup/factories'
import { askGroupAssistant, askGroupQuestion, assistantForMember, groupAssistant, markGroupAssistantDraftPosted, saveGroupAssistantVoiceNote, setGroupAssistantConsent, summarizeGroupChat, updateGroupAssistantSettings, updateGroupAssistantVoice } from './group_assistant'
import { fetchAssistantContent, fetchAssistantMembers, formatAssistantContent, summarizeAssistantMembers } from '../../../lib/groupAssistantContent'
import { assistantTurn, formatThreadForModel, memberAnswer } from '../../../lib/groupAssistant'
import { addAssistantAgreement, assistantAgreementRowId, assistantConsentFor, groupAssistantAgreementId, setAssistantConsent } from '../../../lib/groupAssistantConsent'

describe('group assistant', () => {
  let steward, member, group, space, otherSpace, otherGroup, postInGroup, postInSpace, postInOtherSpace, postElsewhere, directMessage

  const grantPro = (attrs = {}) => HyloProSubscription.forge({ group_id: group.id, source: 'manual', status: 'active', ...attrs }).save()
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
    // Both have agreed to share with the assistant (the consent tests below change this)
    await addAssistantAgreement(group)
    await setAssistantConsent(member.id, group.id, true)
    await setAssistantConsent(steward.id, group.id, true)
  })

  beforeEach(async () => {
    await removePro()
    await grantPro()
    await clearSettings()
    await bookshelf.knex('group_assistant_messages').where('group_id', group.id).del()
    // Turning the assistant off in a test takes its agreement away; put it back (answers are kept)
    await addAssistantAgreement(group)
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

    it('needs the groupAssistant feature, not just any Hylo Pro (Q-82)', async () => {
      await removePro()
      await grantPro({ features: JSON.stringify({ groupAssistant: false }) })
      await expect(turnOn([group.id])).to.be.rejectedWith(/plan doesn't include the Group Assistant/)
      await expect(askGroupAssistant({ userId: steward.id, groupId: group.id, text: 'hi' }, deps({ text: 'x', parts: [] }))).to.be.rejectedWith(/doesn't include the Group Assistant/)
      const state = await groupAssistant({ userId: steward.id, groupId: group.id })
      expect(state.hasPro).to.be.true
      expect(state.hasFeature).to.be.false
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

    it('is given members only when the stewards allow it', async () => {
      await turnOn([group.id])
      const seen = {}
      await askGroupAssistant({ userId: steward.id, groupId: group.id, text: 'Who is new?' }, deps({ text: 'x', parts: [] }, seen))
      expect(seen.request.contentSummary).to.contain('you are not given the member list')
      expect(seen.request.contentSummary).not.to.contain('Members in total')

      await updateGroupAssistantSettings({ userId: steward.id, groupId: group.id, settings: { readMembers: true } })
      await askGroupAssistant({ userId: steward.id, groupId: group.id, text: 'Who is new?' }, deps({ text: 'x', parts: [] }, seen))
      expect(seen.request.contentSummary).to.contain('Members in total: 2')
      expect(seen.request.contentSummary).to.contain('Ned Member: joined')
    })

    it('counts members by how long they have been here and when they last posted or replied', async () => {
      const now = new Date('2026-06-15T12:00:00Z')
      const day = n => new Date(now.getTime() - n * 86400000)
      const members = summarizeAssistantMembers([
        { name: 'New and silent', joinedAt: day(5), lastActiveAt: null },
        { name: 'New and posting', joinedAt: day(40), lastActiveAt: day(2) },
        { name: 'Just three months', joinedAt: day(100), lastActiveAt: day(20) },
        { name: 'Old and quiet', joinedAt: day(400), lastActiveAt: day(200) },
        { name: 'Old and silent', joinedAt: day(200), lastActiveAt: null },
        { name: 'No join date', joinedAt: null, lastActiveAt: day(1) }
      ], now)
      expect(members.total).to.equal(6)
      expect(members.joinDateUnknown).to.equal(1)
      expect(members.tenure).to.deep.equal({ lastMonth: 1, atLeast3Months: 3, atLeast6Months: 2, atLeast12Months: 1 })
      expect(members.activity).to.include({ last30Days: 3, last90Days: 3, never: 2 })
      expect(members.newest.members.map(m => m.name)).to.deep.equal(['New and silent', 'New and posting'])
      expect(members.reachedThreeMonths.members.map(m => m.name)).to.deep.equal(['Just three months'])
      expect(members.goneQuiet.members.map(m => m.name)).to.deep.equal(['Old and quiet'])
      expect(members.neverPosted.members.map(m => m.name)).to.deep.equal(['Old and silent'])
    })

    it('finds when a member last posted or replied, in the group and its spaces only', async () => {
      const members = await fetchAssistantMembers({ group: await Group.find(group.id) })
      expect(members.total).to.equal(2)
      // Ned posted in the group and its spaces; Maria never has
      expect(members.activity.never).to.equal(1)
      expect(members.newest.members.find(m => m.name === 'Ned Member').lastActiveDaysAgo).to.equal(0)
      expect(members.newest.members.find(m => m.name === 'Maria Steward').lastActiveDaysAgo).to.be.null
    })

    it('names only part of a long list and says how many it is drawn from', async () => {
      const now = new Date()
      const rows = Array.from({ length: 200 }, (_, i) => ({ name: `Member ${i}`, joinedAt: new Date(now.getTime() - (i + 1) * 3600000), lastActiveAt: null }))
      const members = summarizeAssistantMembers(rows, now)
      expect(members.newest.of).to.equal(200)
      expect(members.newest.members).to.have.length(80)
      expect(formatAssistantContent({ about: {}, agreements: [], spaces: [], posts: [], members })).to.contain('200, of whom the first 80 are named here')
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
      expect(answered.postRefs).to.deep.equal([])

      const state = await groupAssistant({ userId: steward.id, groupId: group.id })
      expect(state.messages.map(m => m.authorType)).to.deep.equal(['steward', 'axl'])

      // The next turn is given the thread so far
      await askGroupAssistant({ userId: steward.id, groupId: group.id, text: 'Thanks' }, deps({ text: 'Any time.', parts: [] }, seen))
      expect(seen.request.thread.map(m => m.authorType)).to.deep.equal(['steward', 'axl'])
    })

    it('keeps each steward\'s "How I write" note to them, and gives it to the model only for their own turn', async () => {
      const second = await factories.user({ name: 'Sam Second' }).save()
      await second.joinGroup(group, { assignAdministrator: true })
      await turnOn([space.id])
      await bookshelf.knex('group_memberships').where({ user_id: steward.id, group_id: group.id })
        .update({ settings: JSON.stringify({ sendEmail: true }) })

      await expect(updateGroupAssistantVoice({ userId: member.id, groupId: group.id, text: 'x' })).to.be.rejectedWith(/Only stewards/)
      await expect(updateGroupAssistantVoice({ userId: steward.id, groupId: group.id, text: 'x'.repeat(1001) })).to.be.rejectedWith(/up to 1000/)
      expect(await updateGroupAssistantVoice({ userId: steward.id, groupId: group.id, text: '  Short and warm. No exclamation marks.  ' }))
        .to.deep.equal({ myVoice: 'Short and warm. No exclamation marks.' })

      // Theirs alone, and their other membership settings are untouched
      expect((await groupAssistant({ userId: steward.id, groupId: group.id })).myVoice).to.equal('Short and warm. No exclamation marks.')
      expect((await groupAssistant({ userId: second.id, groupId: group.id })).myVoice).to.equal('')
      const stored = await bookshelf.knex('group_memberships').where({ user_id: steward.id, group_id: group.id }).first('settings')
      expect(stored.settings.sendEmail).to.equal(true)

      const seen = {}
      await askGroupAssistant({ userId: steward.id, groupId: group.id, text: 'Draft a welcome' }, deps({ text: 'Here.', parts: [] }, seen))
      expect(seen.request.voice).to.equal('Short and warm. No exclamation marks.')
      await askGroupAssistant({ userId: second.id, groupId: group.id, text: 'Draft a welcome' }, deps({ text: 'Here.', parts: [] }, seen))
      expect(seen.request.voice).to.equal('')
      // The note never goes into the shared thread
      expect(JSON.stringify(seen.request.thread)).not.to.contain('exclamation')

      expect(await updateGroupAssistantVoice({ userId: steward.id, groupId: group.id, text: '' })).to.deep.equal({ myVoice: '' })
    })

    it('offers a note change only to the steward who asked, and saves it only when they do', async () => {
      const second = await factories.user({ name: 'Sam Second' }).save()
      await second.joinGroup(group, { assignAdministrator: true })
      await turnOn([space.id])
      const seen = {}
      const { messages } = await askGroupAssistant({ userId: steward.id, groupId: group.id, text: 'Write shorter from now on' }, deps({
        text: 'Here is your note with that added. Save it if it looks right.',
        parts: [
          { type: 'voiceNote', text: 'Short. No exclamation marks.' },
          { type: 'bullets', items: ['One thing'] }
        ]
      }, seen))
      const messageId = messages[1].id
      expect(messages[1].parts[0]).to.deep.equal({ type: 'voiceNote', text: 'Short. No exclamation marks.', forUserId: String(steward.id), forName: 'Maria Steward' })
      // Nothing is saved by the offer itself
      expect((await groupAssistant({ userId: steward.id, groupId: group.id })).myVoice).to.equal('')

      // Another steward sees an empty placeholder in its place, and cannot save it
      const others = await groupAssistant({ userId: second.id, groupId: group.id })
      expect(others.messages[1].parts).to.deep.equal([{ type: 'voiceNote', hidden: true }, { type: 'bullets', items: ['One thing'] }])
      await expect(saveGroupAssistantVoiceNote({ userId: second.id, messageId, partIndex: 0 })).to.be.rejectedWith(/another steward/)
      await expect(saveGroupAssistantVoiceNote({ userId: member.id, messageId, partIndex: 0 })).to.be.rejectedWith(/Only stewards/)
      await expect(saveGroupAssistantVoiceNote({ userId: steward.id, messageId, partIndex: 1 })).to.be.rejectedWith(/no note/)
      await expect(saveGroupAssistantVoiceNote({ userId: steward.id, messageId, partIndex: 0, text: 'x'.repeat(1001) })).to.be.rejectedWith(/up to 1000/)

      // Saved as the steward edited it
      const saved = await saveGroupAssistantVoiceNote({ userId: steward.id, messageId, partIndex: 0, text: ' Short. No exclamation marks. First names. ' })
      expect(saved.myVoice).to.equal('Short. No exclamation marks. First names.')
      expect(saved.message.parts[0].text).to.equal('Short. No exclamation marks. First names.')
      expect(saved.message.parts[0].saved.at).to.be.a('string')
      expect((await groupAssistant({ userId: steward.id, groupId: group.id })).myVoice).to.equal('Short. No exclamation marks. First names.')
      expect((await groupAssistant({ userId: second.id, groupId: group.id })).myVoice).to.equal('')
      await expect(saveGroupAssistantVoiceNote({ userId: steward.id, messageId, partIndex: 0 })).to.be.rejectedWith(/already saved/)

      // On the other steward's next turn the model is told an offer was made, not what the note says
      await askGroupAssistant({ userId: second.id, groupId: group.id, text: 'Anything open?' }, deps({ text: 'No.', parts: [] }, seen))
      const history = formatThreadForModel(seen.request.thread)
      expect(history).to.contain('[offered Maria Steward a change to their "How I write" note, which they saved]')
      expect(history).not.to.contain('exclamation')
      await updateGroupAssistantVoice({ userId: steward.id, groupId: group.id, text: '' })
    })

    it('says which post ids Axl named are real posts it may read, so only those are linked', async () => {
      await turnOn([space.id])
      const named = `See #${postInSpace.id} and #${postInOtherSpace.id}, also #${postElsewhere.id} and #999999999.`
      const { messages } = await askGroupAssistant({ userId: steward.id, groupId: group.id, text: 'What is open?' }, deps({
        text: named,
        parts: [{ type: 'bullets', items: [`Tool hours (#${postInSpace.id}) has a reply`, `DM #${directMessage.id}`] }]
      }))
      expect(messages[0].postRefs).to.be.undefined
      expect(messages[1].postRefs).to.deep.equal([String(postInSpace.id)])

      // Reading the thread again follows the current list of spaces
      await turnOn([space.id, otherSpace.id])
      const wider = await groupAssistant({ userId: steward.id, groupId: group.id })
      expect(wider.messages[1].postRefs.sort()).to.deep.equal([String(postInSpace.id), String(postInOtherSpace.id)].sort())
      await turnOn([])
      const none = await groupAssistant({ userId: steward.id, groupId: group.id })
      expect(none.messages[1].postRefs).to.deep.equal([])
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
      // The steward is not in that space yet, so the draft says to join it first; once they are, it does not
      expect(messages[1].parts[0].needsJoin).to.deep.equal({ spaceId: String(space.id), name: 'Discussion' })
      await space.addMembers([steward.id])
      const joined = await groupAssistant({ userId: steward.id, groupId: group.id })
      expect(joined.messages[1].parts[0].needsJoin).to.be.undefined
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

  describe("members' consent (Q-29, Q-31)", () => {
    let other
    const chosen = () => fetchAssistantContent({ group: Group.forge({ id: group.id, name: 'Regen Studio' }), readableGroupIds: [String(group.id)] })

    before(async () => {
      other = await factories.user({ name: 'Olive Other' }).save()
      await other.joinGroup(group)
      const post = await factories.post({ name: 'Olive private thoughts', description: '<p>mine</p>', type: 'discussion', user_id: other.id }).save()
      await bookshelf.knex('groups_posts').insert({ post_id: post.id, group_id: group.id })
      await factories.comment({ post_id: postInGroup.id, user_id: other.id, text: '<p>Olive reply</p>' }).save()
    })

    it('adds the agreement once when turned on, marks the agreements changed and tells the members', async () => {
      await updateGroupAssistantSettings({ userId: steward.id, groupId: group.id, settings: { enabled: false } })
      expect(await groupAssistantAgreementId(group.id)).to.be.null
      const calls = []
      const original = Queue.classMethod
      Queue.classMethod = (...args) => { calls.push(args) }
      try {
        await turnOn([group.id])
        await turnOn([group.id, space.id])
      } finally {
        Queue.classMethod = original
      }
      expect(await groupAssistantAgreementId(group.id)).to.equal(await assistantAgreementRowId())
      expect(calls).to.deep.equal([['Group', 'notifyMembersOfAssistantAgreement', { groupId: group.id, actorId: steward.id }]])
      const fresh = await Group.find(group.id)
      expect(fresh.getSetting('agreements_last_updated_at')).to.be.a('string')
      // Answers given before are kept across off and on
      expect(await assistantConsentFor(member.id, group.id)).to.equal('accepted')
    })

    it('sends nothing of a member who has not answered or said no, and says how many are left out', async () => {
      expect(await assistantConsentFor(other.id, group.id)).to.equal('pending')
      const before = await chosen()
      let text = formatAssistantContent(before)
      expect(text).not.to.contain('Olive')
      expect(text).to.contain('Seed swap question')
      expect(text).to.match(/\d+ members? ha(s|ve) not agreed to share/)

      await setGroupAssistantConsent({ userId: other.id, groupId: group.id, accepted: true })
      const after = await chosen()
      text = formatAssistantContent(after)
      expect(text).to.contain('Olive private thoughts')
      expect(text).to.contain('Olive reply')
      expect(after.notSharing).to.equal(before.notSharing - 1)

      expect(await setGroupAssistantConsent({ userId: other.id, groupId: group.id, accepted: false })).to.deep.equal({ consent: 'declined' })
      const content = await fetchAssistantContent({ group: await Group.find(group.id), readableGroupIds: [String(group.id)], includeMembers: true })
      expect(formatAssistantContent(content)).not.to.contain('Olive')
      expect(content.members.total).to.equal(2)
    })

    it('is never accepted along with the other agreements, and an agreements edit keeps it', async () => {
      const newcomer = await factories.user({ name: 'Nia New' }).save()
      const membership = await newcomer.joinGroup(group)
      await membership.acceptAgreements()
      expect(await assistantConsentFor(newcomer.id, group.id)).to.equal('pending')

      const g = await Group.find(group.id)
      await g.update({ agreements: [{ title: 'Be kind', description: 'To everyone' }] }, steward.id)
      const titles = (await (await Group.find(group.id)).agreements().fetch()).map(a => a.get('title'))
      expect(titles[titles.length - 1]).to.equal('Sharing member content with a third-party AI')
      expect(titles).to.include('Be kind')

      // Leaving forgets the answer, so a member who comes back is asked again
      await setAssistantConsent(newcomer.id, group.id, false)
      await g.removeMembers([newcomer.id])
      expect(await bookshelf.knex('users_groups_agreements').where({ user_id: newcomer.id, agreement_id: await assistantAgreementRowId() }).first()).to.be.undefined
    })

    it('only members can answer, and only while the group has the agreement', async () => {
      const outsider = await factories.user().save()
      await expect(setGroupAssistantConsent({ userId: outsider.id, groupId: group.id, accepted: true })).to.be.rejectedWith(/Only members/)
      await updateGroupAssistantSettings({ userId: steward.id, groupId: group.id, settings: { enabled: false } })
      await expect(setGroupAssistantConsent({ userId: member.id, groupId: group.id, accepted: true })).to.be.rejectedWith(/not sharing/)
    })

    it('tells every member but the steward who turned it on', async () => {
      await Group.notifyMembersOfAssistantAgreement({ groupId: group.id, actorId: steward.id })
      const readers = await bookshelf.knex('activities').where({ group_id: group.id, actor_id: steward.id }).whereRaw("meta->'reasons' @> '[\"groupAssistantAgreement\"]'").pluck('reader_id')
      expect(readers.map(String)).to.include(String(member.id))
      expect(readers.map(String)).not.to.include(String(steward.id))
    })
  })

  describe('what it can do (Q-35)', () => {
    // assistantForMember also needs the server to have a model key
    const savedKey = process.env.CLAUDE_API_KEY
    before(() => { process.env.CLAUDE_API_KEY = savedKey || 'test-key' })
    after(() => {
      if (savedKey === undefined) delete process.env.CLAUDE_API_KEY
      else process.env.CLAUDE_API_KEY = savedKey
    })

    it('gives the model follow-ups and who is replying only when those abilities are on', async () => {
      await turnOn([group.id, space.id])
      const seen = {}
      await askGroupAssistant({ userId: steward.id, groupId: group.id, text: 'Anything?' }, deps({ text: 'x', parts: [] }, seen))
      expect(seen.request.abilities).to.deep.equal({ followUps: true, shareLoad: true })
      expect(seen.request.contentSummary).to.contain('Needs a steward')
      expect(seen.request.contentSummary).to.contain('Who is replying')

      await updateGroupAssistantSettings({ userId: steward.id, groupId: group.id, settings: { followUps: false, shareLoad: false } })
      await askGroupAssistant({ userId: steward.id, groupId: group.id, text: 'Anything?' }, deps({ text: 'x', parts: [] }, seen))
      expect(seen.request.abilities).to.deep.equal({ followUps: false, shareLoad: false })
      expect(seen.request.contentSummary).not.to.contain('Needs a steward')
      expect(seen.request.contentSummary).not.to.contain('Who is replying')
    })

    it('summarises a chat for a member only when summaries are on and the space is readable', async () => {
      const memberDeps = (seen = {}) => ({ isConfigured: () => true, withinLimit: async () => true, memberAnswer: async request => { seen.request = request; return { text: 'People planned a picnic.', postIds: [] } } })
      await space.addMembers([member.id])
      const chat = await factories.post({ name: '', description: '<p>Picnic on Sunday?</p>', type: 'chat', user_id: member.id }).save()
      await bookshelf.knex('groups_posts').insert({ post_id: chat.id, group_id: space.id })

      await turnOn([group.id])
      await expect(summarizeGroupChat({ userId: member.id, groupId: space.id }, memberDeps())).to.be.rejectedWith(/not let the assistant read this chat/)
      expect((await assistantForMember(member.id, space)).summarize).to.be.false
      await turnOn([group.id, space.id])
      expect(await assistantForMember(member.id, space)).to.deep.equal({ consent: 'accepted', summarize: true, answerMembers: false })

      const seen = {}
      const result = await summarizeGroupChat({ userId: member.id, groupId: space.id, sincePostId: chat.id - 1 }, memberDeps(seen))
      expect(result).to.deep.equal({ text: 'People planned a picnic.', messagesRead: 1, notShared: 0 })
      expect(seen.request.kind).to.equal('summary')
      expect(seen.request.contentSummary).to.contain('Picnic on Sunday?')

      await updateGroupAssistantSettings({ userId: steward.id, groupId: group.id, settings: { summarize: false } })
      await expect(summarizeGroupChat({ userId: member.id, groupId: space.id }, memberDeps())).to.be.rejectedWith(/not turned this on/)
      const outsider = await factories.user().save()
      await expect(summarizeGroupChat({ userId: outsider.id, groupId: space.id }, memberDeps())).to.be.rejectedWith(/Only members/)
    })

    it('answers a member\'s question only when that is on, from readable posts, without the member list', async () => {
      const seen = {}
      const memberDeps = { isConfigured: () => true, withinLimit: async () => true, memberAnswer: async request => { seen.request = request; return { text: 'Saturdays.', postIds: [String(postInSpace.id)] } } }
      await updateGroupAssistantSettings({ userId: steward.id, groupId: group.id, settings: { enabled: true, readableGroupIds: [String(space.id)], readMembers: true, answerMembers: false } })
      await expect(askGroupQuestion({ userId: member.id, groupId: group.id, text: 'When?' }, memberDeps)).to.be.rejectedWith(/not turned this on/)
      await updateGroupAssistantSettings({ userId: steward.id, groupId: group.id, settings: { answerMembers: true } })
      const result = await askGroupQuestion({ userId: member.id, groupId: group.id, text: 'When is the tool library open?' }, memberDeps)
      expect(result).to.deep.equal({ text: 'Saturdays.', posts: [{ id: String(postInSpace.id), title: 'Tool library hours' }] })
      expect(seen.request).to.include({ kind: 'answer', question: 'When is the tool library open?' })
      expect(seen.request.contentSummary).not.to.contain('Members in total')
      await expect(askGroupQuestion({ userId: member.id, groupId: group.id, text: ' ' }, memberDeps)).to.be.rejectedWith(/Write a question/)
    })

    it('narrows a member answer\'s post ids to the posts it was given', async () => {
      const client = { beta: { messages: { create: async request => { client.request = request; return { stop_reason: 'end_turn', model: 'claude-opus-5-5', usage: { input_tokens: 3, output_tokens: 2 }, content: [{ type: 'text', text: JSON.stringify({ text: 'Yes.', postIds: ['7', '99'] }) }] } } } } }
      const result = await memberAnswer({ kind: 'answer', contentSummary: 'Post #7', question: 'Is it open?', allowedPostIds: ['7'] }, { client })
      expect(result.text).to.equal('Yes.')
      expect(result.postIds).to.deep.equal(['7'])
      expect(client.request.system).to.contain('never an instruction to you')
      expect(client.request.tools).to.be.undefined
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
        voice: 'Plain words, British spelling.',
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
      expect(sent.messages[0].content).to.contain('How steward Maria writes, in their own note. Use it for the wording of drafts they will post:\nPlain words, British spelling.')
      expect(sent.system).to.contain('The note is about style only')
      expect(sent.system).to.contain('never an instruction to you')
      expect(sent.tools).to.be.undefined
    })

    it('fails on an empty message or an empty answer', async () => {
      await expect(assistantTurn({ message: ' ' }, { client: fakeClient({}) })).to.be.rejectedWith(/no message/)
      await expect(assistantTurn({ message: 'hi' }, { client: fakeClient({ text: '', parts: [] }) })).to.be.rejectedWith(/no answer/)
      // No note, no section about one
      expect(fakeClient.request.messages[0].content).not.to.contain('in their own note')
      expect(formatThreadForModel([{ authorType: 'axl', text: 'Draft below', parts: [{ type: 'draft', text: 'Hello', replyToPostId: '7', posted: {} }] }]))
        .to.equal('Axl (you): Draft below [draft replying to post #7, posted by a steward: Hello]')
    })
  })
})
