import { attr, fk, Model } from 'redux-orm'

export default class EmailEnabledTester extends Model {
  toString () {
    return `EmailEnabledTester: ${this.userId}`
  }
}

EmailEnabledTester.modelName = 'EmailEnabledTester'

EmailEnabledTester.fields = {
  id: attr(),
  userId: attr(),
  user: fk('Person', 'emailEnabledTesters'),
  createdAt: attr(),
  updatedAt: attr()
}
