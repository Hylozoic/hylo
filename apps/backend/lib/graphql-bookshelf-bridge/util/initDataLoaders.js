import DataLoader from 'dataloader'
import { forIn } from 'lodash'

// Given a mapping of table names to Bookshelf model classes, prepare a
// DataLoader for each model and a general-purpose DataLoader for other queries.
export default function initDataLoaders (spec) {
  const loaders = {}

  forIn(spec, ({ model }, typename) => {
    loaders[typename] = makeModelLoader(model)
  })

  if (loaders.relations) {
    throw new Error("Can't have a model DataLoader named 'relations'")
  }

  // general-purpose query cache, for relational SQL queries that aren't just
  // fetching objects by ID.
  loaders.relations = new DataLoader(
    queries => Promise.map(queries, async ({ relation, method }) => {
      return method ? relation[method]() : relation.fetch()
    }),
    { cacheKeyFn: _ => Math.random().toString() }
  )

  // DataLoader for Tag lookups by name (Post.topics from tag_names)
  loaders.tagByName = new DataLoader(
    async (names) => {
      const tags = await Tag.query(q => q.whereIn('name', names)).fetchAll()
      const byName = {}
      tags.models.forEach(tag => { byName[tag.get('name')] = tag })
      return names.map(name => byName[name] || null)
    }
  )

  // DataLoader for TagFollow lookups by (groupId, tagId, userId) tuples
  // To prevent duplicate lookups of the same TagFollow in one session
  loaders.tagFollow = new DataLoader(
    async (keys) => {
      const results = await Promise.map(keys, async ({ groupId, tagId, userId }) => {
        return TagFollow.query(q => {
          q.where({
            user_id: userId,
            group_id: groupId,
            tag_id: tagId
          })
        }).fetch()
      })
      return results
    },
    { cacheKeyFn: ({ groupId, tagId, userId }) => `${groupId}:${tagId}:${userId}` }
  )

  return loaders
}

export function makeModelLoader (model) {
  const tableName = model.collection().tableName()
  const idColumn = `${tableName}.id`
  return new DataLoader(ids =>
    model.where(idColumn, 'in', ids).fetchAll().then(preserveOrdering(ids)))
}

const preserveOrdering = ids => objects =>
  ids.map(id => objects.find(x => String(x.id) === String(id)))
