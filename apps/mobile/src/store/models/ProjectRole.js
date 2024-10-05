import { attr, fk, Model } from 'redux-orm'

class ProjectRole extends Model {
  toString () {
    return `Attachment (${this.type}): ${this.url}`
  }
}

export default ProjectRole

ProjectRole.modelName = 'ProjectRole'

ProjectRole.fields = {
  id: attr(),
  name: attr(),
  project: fk('Post', 'attachments')
}
