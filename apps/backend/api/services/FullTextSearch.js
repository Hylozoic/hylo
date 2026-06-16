/* globals bookshelf */
import { compact, omit } from 'lodash'

const tableName = 'search_index'
const columnName = 'document'
const defaultLang = 'english'

const raw = (str, knex = bookshelf.knex) => knex.raw(str)

const dropView = knex => raw(`drop materialized view ${tableName}`, knex)

const refreshView = () => raw(`refresh materialized view ${tableName}`)

const createView = (lang, knex) => {
  if (!lang) lang = defaultLang
  const wv = (column, weight) =>
    `setweight(to_tsvector('${lang}', ${column}), '${weight}')`

  return raw(`create materialized view ${tableName} as (
    select
      p.id as post_id,
      null::bigint as user_id,
      null::bigint as comment_id,
      ${wv('p.name', 'B')} ||
      ${wv("coalesce(p.description, '')", 'C')} ||
      ${wv('u.name', 'D')} as ${columnName}
    from posts p
    join users u on u.id = p.user_id
    where p.active = true and u.active = true
  ) union (
    select
      null as post_id,
      u.id as user_id,
      null as comment_id,
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
      null as post_id,
      null as user_id,
      c.id as comment_id,
      ${wv('c.text', 'C')} ||
      ${wv('u.name', 'D')} as ${columnName}
    from comments c
    join users u on u.id = c.user_id
    where c.active = true and u.active = true
  )`, knex)
    .then(() => raw(`create index idx_fts_search on ${tableName}
      using gin(${columnName})`, knex))
    .then(() => raw(`create index idx_search_index_post_id on ${tableName} (post_id) where post_id is not null`, knex))
    .then(() => raw(`create index idx_search_index_user_id on ${tableName} (user_id) where user_id is not null`, knex))
    .then(() => raw(`create index idx_search_index_comment_id on ${tableName} (comment_id) where comment_id is not null`, knex))
}

// Restrict FTS candidates to content the user can see: their groups plus public posts.
const applyGroupAccessFilter = (qb, groupIds) => {
  qb.andWhere(function () {
    if (groupIds.length > 0) {
      this.whereIn('post_id', function () {
        this.select('post_id').from('groups_posts').whereIn('group_id', groupIds)
      })
        .orWhereIn('user_id', function () {
          this.select('user_id').from('group_memberships').whereIn('group_id', groupIds)
        })
        .orWhereIn('comment_id', function () {
          this.select('c.id')
            .from('comments as c')
            .join('groups_posts as gp', 'gp.post_id', 'c.post_id')
            .whereIn('gp.group_id', groupIds)
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
    columns = raw(`post_id, comment_id, user_id, ${rank} as rank, count(*) over () as total`)
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

  if (opts.groupIds) {
    applyGroupAccessFilter(query, opts.groupIds)
  }

  if (!opts.subquery) {
    query = query.orderBy('rank', 'desc')
  }

  return query
}

const searchInGroups = (groupIds, opts) => {
  const alias = 'search'
  const columns = [`${alias}.post_id`, `${alias}.comment_id`, `${alias}.user_id`, 'rank', 'total']
  return bookshelf.knex
    .select(columns)
    .from(search({ ...omit(opts, 'limit', 'offset'), groupIds }).as(alias))
    .leftJoin('comments', 'comments.id', `${alias}.comment_id`)
    .leftJoin('posts', function () {
      this.on('posts.id', `${alias}.post_id`)
        .orOn('posts.id', 'comments.post_id')
    })
    .leftJoin('group_memberships', function () {
      this.on('group_memberships.user_id', `${alias}.user_id`)
      if (groupIds.length > 0) {
        this.andOnIn('group_memberships.group_id', groupIds)
      }
    })
    .groupBy(columns)
    .orderByRaw('(("rank") * (case when greatest(max(posts.updated_at), max(comments.created_at), max(group_memberships.created_at)) is null then 1 else exp(-extract(epoch from (now() - greatest(max(posts.updated_at), max(comments.created_at), max(group_memberships.created_at)))) / 1209600.0) end)) desc, "rank" desc')
    .limit(opts.limit || 20)
    .offset(opts.offset || 0)
}

module.exports = {
  createView,
  dropView,
  refreshView,
  search,
  searchInGroups
}
