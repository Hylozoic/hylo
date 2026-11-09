import { GraphQLError } from 'graphql'
import { pick } from 'lodash'
import { RecurrenceHelpers } from '@hylo/shared'

/*
 * A recurring-event series. Each occurrence is a real event Post referencing
 * this series via posts.event_series_id, so RSVPs, comments, ICS calendars and
 * digests keep working per-occurrence with no special cases.
 *
 * Occurrences are materialized up front (no scheduled job): creation fills the
 * series to RecurrenceHelpers.MAX_FUTURE_OCCURRENCES upcoming occurrences, and
 * generateOccurrences() can be called again later (e.g. on edit) to top the
 * series back up once earlier occurrences have moved into the past.
 */
module.exports = bookshelf.Model.extend({
  tableName: 'event_series',
  requireFetch: false,
  hasTimestamps: true,

  creator: function () {
    return this.belongsTo(User, 'user_id')
  },

  posts: function () {
    return this.hasMany(Post, 'event_series_id')
  },

  activeOccurrences: function () {
    return this.posts().query(q => {
      q.where('posts.active', true)
    })
  },

  recurrenceRule: function () {
    return this.get('recurrence_rule')
  },

  /**
   * Creates event posts for not-yet-materialized occurrences, up to
   * MAX_FUTURE_OCCURRENCES upcoming ones. Past occurrences don't count toward
   * the cap. Attributes are copied from the latest existing occurrence, and
   * generation is anchored on original_start_time so individually rescheduled
   * or deleted occurrences never shift the pattern or get recreated.
   * Generated posts skip the notification side effects of a normal createPost.
   */
  generateOccurrences: async function ({ transacting } = {}) {
    const trxOpts = { transacting }

    const template = await this.activeOccurrences()
      .query(q => q.orderBy('posts.start_time', 'desc'))
      .fetchOne(trxOpts)
    if (!template) return []

    const futureCount = Number(await Post.query(q => {
      q.where({ event_series_id: this.id, 'posts.active': true })
      q.where('posts.start_time', '>=', new Date())
    }).count('id', trxOpts))
    const remaining = RecurrenceHelpers.MAX_FUTURE_OCCURRENCES - futureCount
    if (remaining <= 0) return []

    // Anchor on the latest slot ever generated, across deleted occurrences too
    const anchorRow = await bookshelf.knex('posts')
      .where({ event_series_id: this.id })
      .max('original_start_time as anchor')
      .modify(q => { if (transacting) q.transacting(transacting) })
      .first()
    const anchor = anchorRow?.anchor || template.get('start_time')

    const starts = RecurrenceHelpers.expandRecurrenceRule({
      rule: this.get('recurrence_rule'),
      dtstart: this.get('start_time'),
      timezone: this.get('timezone') || undefined,
      after: anchor,
      limit: remaining
    })
    if (starts.length === 0) return []

    const templateAttrs = pick(template.attributes, [
      'name', 'description', 'type', 'user_id', 'location', 'location_id', 'timezone', 'is_public'
    ])
    const templateStart = template.get('start_time')
    const templateEnd = template.get('end_time')
    const duration = templateStart && templateEnd ? templateEnd.getTime() - templateStart.getTime() : null
    const groupIds = (await template.groups().fetch(trxOpts)).pluck('id')
    const tagIds = (await template.tags().fetch(trxOpts)).pluck('id')
    const userId = this.get('user_id')

    const created = []
    for (const start of starts) {
      const post = await Post.create({
        ...templateAttrs,
        start_time: start,
        end_time: duration === null ? null : new Date(start.getTime() + duration),
        event_series_id: this.id,
        original_start_time: start
      }, trxOpts)
      if (groupIds.length > 0) await post.groups().attach(groupIds, trxOpts)
      await Promise.all(tagIds.map(tagId =>
        new PostTag({ post_id: post.id, tag_id: tagId, created_at: new Date(), updated_at: new Date() })
          .save(null, trxOpts)))
      await post.addFollowers([userId], {}, trxOpts)
      // The creator auto-RSVPs to each occurrence, as in processEventCreated,
      // but without the per-occurrence RSVP email
      await EventInvitation.create({ userId, inviterId: userId, eventId: post.id, response: EventInvitation.RESPONSE.YES }, trxOpts)
      created.push(post)
    }
    return created
  }
}, {
  find: function (id, opts = {}) {
    if (!id) return Promise.resolve(null)
    return EventSeries.where({ id }).fetch(opts)
  },

  create: function (attrs, { transacting } = {}) {
    const now = new Date()
    return this.forge(Object.assign({ created_at: now, updated_at: now }, attrs))
      .save(null, { transacting, method: 'insert' })
  },

  /**
   * Turns a just-created event post into the first occurrence of a new series
   * and materializes the remaining occurrences.
   */
  createForPost: async function (post, recurrenceRule, { transacting } = {}) {
    if (!post.isEvent()) throw new GraphQLError('Recurrence is only supported for events')
    if (!post.get('start_time')) throw new GraphQLError('Recurring events require a start time')
    if (!RecurrenceHelpers.validateRecurrenceRule(recurrenceRule)) throw new GraphQLError('Invalid recurrence rule')

    const series = await EventSeries.create({
      user_id: post.get('user_id'),
      recurrence_rule: RecurrenceHelpers.normalizeRecurrenceRule(recurrenceRule),
      timezone: post.get('timezone'),
      start_time: post.get('start_time')
    }, { transacting })

    await post.save(
      { event_series_id: series.id, original_start_time: post.get('start_time') },
      { patch: true, transacting }
    )
    await series.generateOccurrences({ transacting })
    return series
  }
})
