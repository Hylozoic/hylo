import '../../setup'
import factories from '../../setup/factories'
import { mockify, unspyify } from '../../setup/helpers'

describe('ModerationAction.sendEmailsForModerationAction', () => {
  let reporter, reportee, post, group
  let previousEmailNotificationsEnabled
  let previousTesterIds

  before(async function () {
    reporter = await factories.user().save()
    reportee = await factories.user().save()
    group = await factories.group().save()
    post = await factories.post({ user_id: reportee.id }).save()
    await post.groups().attach(group.id)
  })

  beforeEach(() => {
    previousEmailNotificationsEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED
    previousTesterIds = process.env.HYLO_TESTER_IDS
    mockify(Queue, 'classMethod', () => Promise.resolve())
  })

  afterEach(() => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = previousEmailNotificationsEnabled
    process.env.HYLO_TESTER_IDS = previousTesterIds
    unspyify(Queue, 'classMethod')
  })

  function queuedModerationEmails () {
    return Queue.classMethod.__spy.calls
      .filter(([cls, method]) => cls === 'Email' && method === 'sendModerationAction')
      .map(([, , opts]) => opts.email)
  }

  it('does not email a non-tester post creator when email notifications are disabled', async () => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = 'false'
    process.env.HYLO_TESTER_IDS = String(reporter.id)

    await ModerationAction.sendEmailsForModerationAction({
      reporterId: reporter.id,
      postId: post.id,
      groupId: group.id,
      type: 'created'
    })

    expect(queuedModerationEmails()).to.deep.equal([reporter.get('email')])
  })

  it('emails both reporter and post creator when email notifications are enabled', async () => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true'
    process.env.HYLO_TESTER_IDS = ''

    await ModerationAction.sendEmailsForModerationAction({
      reporterId: reporter.id,
      postId: post.id,
      groupId: group.id,
      type: 'created'
    })

    expect(queuedModerationEmails()).to.have.members([
      reporter.get('email'),
      reportee.get('email')
    ])
  })
})
