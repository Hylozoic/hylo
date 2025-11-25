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

  // DataLoader for TrackUser lookups by (trackId, userId) pairs
  // To prevent duplicate lookups of the same TrackUser in one session
  loaders.trackUser = new DataLoader(
    async (keys) => {
      const results = await Promise.map(keys, async ({ trackId, userId }) => {
        return TrackUser.query(q => {
          q.where({
            user_id: userId,
            track_id: trackId
          })
        }).fetch()
      })
      return results
    },
    { cacheKeyFn: ({ trackId, userId }) => `${trackId}:${userId}` }
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

  // DataLoader for FundingRoundUser lookups by (fundingRoundId, userId) pairs
  // To prevent duplicate lookups of the same FundingRoundUser in one session
  loaders.fundingRoundUser = new DataLoader(
    async (keys) => {
      const results = await Promise.map(keys, async ({ fundingRoundId, userId }) => {
        return FundingRoundUser.query(q => {
          q.where({
            user_id: userId,
            funding_round_id: fundingRoundId
          })
        }).fetch()
      })
      return results
    },
    { cacheKeyFn: ({ fundingRoundId, userId }) => `${fundingRoundId}:${userId}` }
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
