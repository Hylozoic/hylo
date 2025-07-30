import { attr, fk, Model } from 'redux-orm'

class Notification extends Model {
  toString () {
    return `Message: ${this.id}`
  }
}

export default Notification

Notification.modelName = 'Notification'

Notification.fields = {
  id: attr(),
  activity: fk('Activity'),
  createdAt: attr()
}
