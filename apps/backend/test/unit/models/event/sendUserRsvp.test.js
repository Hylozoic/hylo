import setup from '../../../setup'
import factories from '../../../setup/factories'
import { mockify, unspyify } from '../../../setup/helpers'

describe('event sendUserRsvp', () => {
  let event, attendee, queued

  before(async () => {
    await setup.clearDb()
    const host = await factories.user().save()
    attendee = await factories.user({ settings: { locale: 'es' } }).save()
    const group = await factories.group({ name: 'Grupo' }).save()
    event = await factories.post({
      user_id: host.id,
      type: Post.Type.EVENT,
      name: 'Asamblea',
      start_time: new Date(Date.now() + 86400000),
      end_time: new Date(Date.now() + 90000000)
    }).save()
    await group.posts().attach(event)
  })

  beforeEach(() => {
    queued = []
    mockify(Queue, 'classMethod', (className, methodName, data) => {
      queued.push({ className, methodName, data })
      return Promise.resolve()
    })
  })

  afterEach(() => unspyify(Queue, 'classMethod'))

  it('sends the RSVP email in the attendee language with a translated response', async () => {
    const invitation = await EventInvitation.create({
      userId: attendee.id,
      inviterId: attendee.id,
      eventId: event.id,
      response: EventInvitation.RESPONSE.INTERESTED
    })

    await event.sendUserRsvp({ eventInvitationId: invitation.id, eventChanges: { new: true } })

    expect(queued).to.have.length(1)
    const { methodName, data } = queued[0]
    expect(methodName).to.equal('sendEventRsvpEmail')
    expect(data.locale).to.equal('es-ES')
    expect(data.data.response).to.equal('interesado/a en')
  })
})

describe('EventInvitation#getHumanResponse', () => {
  it('uses the given locale and falls back to English', () => {
    const going = EventInvitation.forge({ response: EventInvitation.RESPONSE.YES })
    const notGoing = EventInvitation.forge({ response: EventInvitation.RESPONSE.NO })
    expect(going.getHumanResponse('de-DE')).to.equal('dabei bei')
    expect(notGoing.getHumanResponse('fr')).to.equal('absent·e à')
    expect(going.getHumanResponse()).to.equal('Going to')
  })
})
