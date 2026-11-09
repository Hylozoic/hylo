import { countTotal } from '../../../lib/util/knex'

/**
 * Fetch moderation actions for a group or space.
 * Spaces return only their own actions. Groups also include child-space actions
 * the viewer is a member of, or all child spaces if they have Manage Content.
 */
export default function forModerationActions (opts) {
  return ModerationAction.query(qb => {
    qb.distinct()
    qb.limit(opts.limit || 20)
    qb.offset(opts.offset)
    qb.orderBy('id', 'desc')

    // this counts total rows matching the criteria, disregarding limit,
    // which is useful for pagination
    countTotal(qb, 'moderation_actions', opts.totalColumnName)

    if (opts.slug) {
      qb.join('groups', 'moderation_actions.group_id', '=', 'groups.id')
      qb.where(q => {
        q.where('groups.slug', opts.slug)

        if (opts.currentUserId) {
          q.orWhere(q2 => {
            q2.where('groups.type', 'space')
            q2.where('groups.active', true)
            // Only when the viewed slug is a non-space group: include its child spaces
            q2.whereIn('groups.parent_id', function () {
              this.select('viewed_group.id')
                .from('groups as viewed_group')
                .where('viewed_group.slug', opts.slug)
                .where(function () {
                  this.whereNull('viewed_group.type')
                    .orWhere('viewed_group.type', '<>', 'space')
                })
            })
            q2.where(q3 => {
              q3.whereIn('groups.id', Group.selectIdsForMember(opts.currentUserId))
              q3.orWhereIn(
                'groups.parent_id',
                Group.selectIdsByResponsibilities(opts.currentUserId, [Responsibility.constants.RESP_MANAGE_CONTENT])
              )
            })
          })
        }
      })
    }
  })
}
