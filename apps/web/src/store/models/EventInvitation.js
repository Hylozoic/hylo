import { attr, fk, Model } from 'redux-orm'

class EventInvitation extends Model {
  toString () {
    return `EventInvitation: ${this.id}`
  }
}

EventInvitation.modelName = 'EventInvitation'
EventInvitation.fields = {
  id: attr(),
  response: attr(),
  event: fk('Post', 'eventInvitations'),
  person: fk('Person', 'eventInvitations')
}

export default EventInvitation
