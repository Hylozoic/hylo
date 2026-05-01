import { attr, fk, Model } from 'redux-orm'

class Draft extends Model {
  toString () {
    return `Draft: ${this.id}`
  }
}

export default Draft

Draft.modelName = 'Draft'

Draft.fields = {
  id: attr(),
  type: attr(),
  data: attr(),
  navigateTo: attr(),
  updatedAt: attr(),
  groupId: attr(),
  topicId: attr(),
  postId: attr(),
  messageThreadId: attr(),
  isEdit: attr(),
  group: fk('Group'),
  post: fk('Post'),
  messageThread: fk('MessageThread')
}
