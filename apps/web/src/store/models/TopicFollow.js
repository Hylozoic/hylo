import { attr, Model, fk } from 'redux-orm'

class TopicFollow extends Model {
  toString () {
    return `TopicFollow: ${this.topic}`
  }
}

export default TopicFollow

TopicFollow.modelName = 'TopicFollow'

TopicFollow.fields = {
  id: attr(),
  lastReadPostId: attr(),
  group: fk('Group', 'topicFollows'),
  topic: fk('Topic', 'topicFollows'),
  user: fk('Person', 'topicFollows')
}
