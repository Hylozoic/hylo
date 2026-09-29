import { GraphQLError } from 'graphql'
import { countTotal } from '../../../lib/util/knex'
import { filterAndSortUsers } from './util'

export default function (opts) {
  const { groups } = opts
  return User.query(function (qb) {
    qb.limit(opts.limit || 1000)
    qb.offset(opts.offset || 0)
    qb.where('users.active', '=', true)

    filterAndSortUsers({
      autocomplete: opts.autocomplete,
      boundingBox: opts.boundingBox,
      search: opts.term,
      sortBy: opts.sort,
      order: opts.order,
      viewerId: opts.currentUserId
    }, qb)

    if (opts.sort === 'join') {
      if (!groups || groups.length !== 1) {
        throw new GraphQLError('When sorting by join date, you must specify exactly one group.')
      }
    }

    countTotal(qb, 'users', opts.totalColumnName)

    // TODO perhaps the group-related code below can be refactored into
    // a more general-purpose form?

    if (groups) {
      qb.join('group_memberships', 'group_memberships.user_id', 'users.id')
      qb.join('groups', 'groups.id', 'group_memberships.group_id')
      qb.whereIn('groups.id', opts.groups)
      qb.where('group_memberships.active', true)
    }

    if (opts.start_time && opts.end_time) {
      qb.whereRaw('users.created_at between ? and ?', [opts.start_time, opts.end_time])
    }

    if (opts.exclude) {
      qb.whereNotIn('id', opts.exclude)
    }

    // For inviting people to a group: leave out its active members and the Axolotl
    if (opts.excludeGroupId) {
      qb.whereNotExists(function () {
        this.select(bookshelf.knex.raw(1)).from('group_memberships as excluded_membership')
          .whereRaw('excluded_membership.user_id = users.id')
          .where('excluded_membership.group_id', opts.excludeGroupId)
          .where('excluded_membership.active', true)
      })
      qb.whereNot('users.id', User.AXOLOTL_ID)
    }

    // Only people who share an active group with this person
    if (opts.sharedWithUserId) {
      qb.whereExists(function () {
        this.select(bookshelf.knex.raw(1)).from('group_memberships as shared_theirs')
          .join('group_memberships as shared_mine', 'shared_mine.group_id', 'shared_theirs.group_id')
          .join('groups as shared_group', 'shared_group.id', 'shared_theirs.group_id')
          .whereRaw('shared_theirs.user_id = users.id')
          .where('shared_theirs.active', true)
          .where('shared_mine.user_id', opts.sharedWithUserId)
          .where('shared_mine.active', true)
          .where('shared_group.active', true)
      })
    }

    if (groups && groups.length > 1) {
      // prevent duplicates due to the joins
      if (opts.sort === 'join') {
        qb.groupBy(['users.id', 'group_memberships.created_at'])
      } else {
        qb.groupBy('users.id')
      }
    }
  })
}
