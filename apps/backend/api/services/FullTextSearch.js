/* globals bookshelf, Group */
import { compact, omit } from 'lodash'

const tableName = 'search_index'
const columnName = 'document'
const defaultLang = 'english'
const searchStatementTimeoutMs = Number(process.env.SEARCH_STATEMENT_TIMEOUT_MS) || 20000
const recencyHalfLifeSeconds = 1209600 // 14 days

const raw = (str, knex = bookshelf.knex) => knex.raw(str)

const dropView = knex => raw(`drop materialized view if exists ${tableName}`, knex)

const refreshView = () => {
  return raw(`refresh materialized view concurrently ${tableName}`)
    .catch(err => {
      if (err.message && err.message.includes('concurrently')) {
        return raw(`refresh materialized view ${tableName}`)
      }
      throw err
    })
}

const createView = (lang, knex) => {
  if (!lang) lang = defaultLang
  const wv = (column, weight) =>
    `setweight(to_tsvector('${lang}', ${column}), '${weight}')`

  return raw(`create materialized view ${tableName} as (
    select
      ('post-' || p.id::text) as row_key,
      p.id as post_id,
      null::bigint as user_id,
      null::bigint as comment_id,
      p.updated_at as sort_ts,
      ${wv('p.name', 'B')} ||
      ${wv("coalesce(p.description, '')", 'C')} ||
      ${wv('u.name', 'D')} as ${columnName}
    from posts p
    join users u on u.id = p.user_id
    where p.active = true and u.active = true
  ) union (
    select
      ('user-' || u.id::text) as row_key,
      null as post_id,
      u.id as user_id,
      null as comment_id,
      coalesce(
        (
          select max(gm.created_at)
          from group_memberships gm
          where gm.user_id = u.id and gm.active = true
        ),
        u.last_active_at,
        u.updated_at,
        u.created_at
      ) as sort_ts,
      ${wv('u.name', 'A')} ||
      ${wv("coalesce(string_agg(replace(s.name, '-', ' '), ' '), '')", 'C')} ||
      ${wv("coalesce(u.bio, '')", 'C')} as ${columnName}
    from users u
    left join skills_users su on u.id = su.user_id
    left join skills s on su.skill_id = s.id
    where u.active = true
    group by u.id
  ) union (
    select
      ('comment-' || c.id::text) as row_key,
      null as post_id,
      null as user_id,
      c.id as comment_id,
      c.created_at as sort_ts,
      ${wv('c.text', 'C')} ||
      ${wv('u.name', 'D')} as ${columnName}
    from comments c
    join users u on u.id = c.user_id
    where c.active = true and u.active = true
  )`, knex)
    .then(() => raw(`create unique index idx_search_index_unique on ${tableName} (row_key)`, knex))
    .then(() => raw(`create index idx_fts_search on ${tableName}
      using gin(${columnName})`, knex))
    .then(() => raw(`create index idx_search_index_post_id on ${tableName} (post_id) where post_id is not null`, knex))
    .then(() => raw(`create index idx_search_index_user_id on ${tableName} (user_id) where user_id is not null`, knex))
    .then(() => raw(`create index idx_search_index_comment_id on ${tableName} (comment_id) where comment_id is not null`, knex))
}

const applyMemberGroupFilter = (subquery, groupAccess) => {
  const { groupIds, userId } = groupAccess
  if (userId) {
    subquery.whereIn('group_id', Group.selectIdsForMember(userId))
  } else if (groupIds && groupIds.length > 0) {
    subquery.whereIn('group_id', groupIds)
  }
}

// Restrict FTS candidates to content the user can see: their groups plus public posts.
const applyGroupAccessFilter = (qb, groupAccess) => {
  qb.andWhere(function () {
    const hasMemberGroups = groupAccess.userId ||
      (groupAccess.groupIds && groupAccess.groupIds.length > 0)

    if (hasMemberGroups) {
      this.whereIn('post_id', function () {
        this.select('post_id').from('groups_posts')
        applyMemberGroupFilter(this, groupAccess)
      })
        .orWhereIn('user_id', function () {
          this.select('user_id').from('group_memberships')
          applyMemberGroupFilter(this, groupAccess)
        })
        .orWhereIn('comment_id', function () {
          this.select('c.id')
            .from('comments as c')
            .join('groups_posts as gp', 'gp.post_id', 'c.post_id')
          applyMemberGroupFilter(this, groupAccess)
        })
    }
    this.orWhereIn('post_id', function () {
      this.select('id').from('posts').where({ is_public: true, active: true })
    })
      .orWhereIn('comment_id', function () {
        this.select('c.id')
          .from('comments as c')
          .join('posts as p', 'p.id', 'c.post_id')
          .where({ 'p.is_public': true, 'c.active': true })
      })
  })
}

const recencyRankSql = `(rank * case when sort_ts is null then 1 else exp(-extract(epoch from (now() - sort_ts)) / ${recencyHalfLifeSeconds}.0) end)`

const search = (opts) => {
  const term = compact(opts.term.replace(/'/, '').split(' '))
    .map(w => w + ':*')
    .join(' & ')

  const lang = opts.lang || defaultLang
  const tsquery = `to_tsquery('${lang}', '${term}')`
  const rank = `ts_rank_cd(${columnName}, ${tsquery})`
  let columns

  // set opts.subquery if you are using this search method within one of the
  // services/Search methods, e.g. forUsers, and want to use the full-text
  // search index
  if (opts.subquery) {
    columns = {
      person: 'user_id',
      post: 'post_id',
      comment: 'comment_id'
    }[opts.type]
  } else {
    columns = raw(`post_id, comment_id, user_id, sort_ts, ${rank} as rank`)
  }

  let query = bookshelf.knex
    .select(columns)
    .from(tableName)
    .where(raw(`${columnName} @@ ${tsquery}`))
    .where(raw({
      person: 'user_id is not null',
      post: 'post_id is not null',
      comment: 'comment_id is not null'
    }[opts.type] || true))

  if (opts.groupAccess) {
    applyGroupAccessFilter(query, opts.groupAccess)
  }

  if (!opts.subquery && !opts.skipOrder) {
    query = query.orderByRaw(`${recencyRankSql} desc, rank desc`)
  }

  return query
}

const runWithStatementTimeout = (queryBuilder) => {
  return bookshelf.knex.transaction(trx => {
    return trx.raw(`set local statement_timeout = ${searchStatementTimeoutMs}`)
      .then(() => queryBuilder.transacting(trx))
  })
}

const recencyRankForAlias = (alias) =>
  `(${alias}.rank * case when ${alias}.sort_ts is null then 1 else exp(-extract(epoch from (now() - ${alias}.sort_ts)) / ${recencyHalfLifeSeconds}.0) end)`

const buildSearchInGroupsQuery = (groupAccess, opts) => {
  const limit = opts.limit || 20
  const offset = opts.offset || 0
  const alias = 'search'
  return bookshelf.knex
    .select(
      `${alias}.post_id`,
      `${alias}.comment_id`,
      `${alias}.user_id`,
      `${alias}.rank`
    )
    .from(search({ ...omit(opts, 'limit', 'offset'), groupAccess, skipOrder: true }).as(alias))
    .orderByRaw(`${recencyRankForAlias(alias)} desc, ${alias}.rank desc`)
    .limit(limit + 1)
    .offset(offset)
}

const searchInGroups = (groupAccess, opts) => {
  const limit = opts.limit || 20
  return runWithStatementTimeout(buildSearchInGroupsQuery(groupAccess, opts))
    .then(rows => {
      const hasMore = rows.length > limit
      return {
        items: rows.slice(0, limit),
        hasMore
      }
    })
}

module.exports = {
  createView,
  dropView,
  refreshView,
  search,
  buildSearchInGroupsQuery,
  searchInGroups
}
