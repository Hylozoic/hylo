import setup from '../../setup'
import factories from '../../setup/factories'
import { mockify, unspyify } from '../../setup/helpers'

describe('ExportService', () => {
  let queued

  beforeEach(async () => {
    await setup.clearDb()
  })

  afterEach(() => unspyify(Queue, 'classMethod'))

  const captureQueuedEmail = () => new Promise(resolve => {
    mockify(Queue, 'classMethod', (className, methodName, data) => {
      resolve({ className, methodName, data })
      return Promise.resolve()
    })
  })

  it('sends the members export in the requester language', async () => {
    const requester = await factories.user({ settings: { locale: 'de' } }).save()
    const group = await factories.group().save()
    await group.addMembers([requester.id])
    queued = captureQueuedEmail()

    await ExportService.exportMembers({ groupId: group.id, userId: requester.id, email: requester.get('email') })

    const { methodName, data } = await queued
    expect(methodName).to.equal('sendExportMembersList')
    expect(data.email).to.equal(requester.get('email'))
    expect(data.locale).to.equal('de-DE')
  })

  it('sends the account export in the member language', async () => {
    const member = await factories.user({ settings: { locale: 'pt' } }).save()
    queued = captureQueuedEmail()

    await ExportService.exportUserAccount({ userId: member.id })

    const { methodName, data } = await queued
    expect(methodName).to.equal('sendExportUserAccount')
    expect(data.locale).to.equal('pt-BR')
  })
})
