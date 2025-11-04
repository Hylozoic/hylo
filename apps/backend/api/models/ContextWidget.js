import { reorderTree, replaceHomeWidget } from './util/contextWidgets'

module.exports = bookshelf.Model.extend({
  tableName: 'context_widgets',
  requireFetch: false,
  hasTimestamps: true,

  initialize () {
    this.on('fetching', (model, columns, options) => {
      if (!options.withRelated) {
        options.withRelated = []
      }
      const relationsToLoad = []

      if (model.get('custom_view_id')) relationsToLoad.push('customView')
      if (model.get('view_chat_id')) relationsToLoad.push('viewChat')
      if (model.get('view_post_id')) relationsToLoad.push('viewPost')
      if (model.get('view_group_id')) relationsToLoad.push('viewGroup')
      if (model.get('view_user_id')) relationsToLoad.push('viewUser')
      if (model.get('view_track_id')) relationsToLoad.push('viewTrack')
      if (model.get('view_funding_round_id')) relationsToLoad.push('viewFundingRound')
      relationsToLoad.push('children')

      options.withRelated = options.withRelated.concat(relationsToLoad)
    })
  },

  // Relationships

  children () {
    return this.hasMany(ContextWidget, 'parent_id')
  },

  customView () {
    return this.belongsTo(CustomView, 'custom_view_id')
  },

  ownerGroup () {
    return this.belongsTo(Group, 'group_id')
  },

  async highlightNumber (userId) {
    if (userId && this.get('view_chat_id')) {
      const tf = await this.topicFollow(userId).fetch()
      return tf ? tf.get('new_post_count') : 0
    }
    return 0
  },

  secondaryNumber () {
    // TODO CONTEXT: these will need to determine a useful number based on the entity the widget is linked to
    return 0
  },

  parentWidget () {
    return this.belongsTo(ContextWidget, 'parent_id')
  },

  peers (trx) {
    const groupId = this.get('group_id')
    const parentId = this.get('parent_id')
    if (parentId) {
      // If it has a parent, get all widgets with same parent (including self)
      return ContextWidget.collection().query(q => {
        if (trx) q.transacting(trx)
        q.where({
          parent_id: parentId
        })
        q.orderBy('order', 'asc')
      })
    } else {
      // If it has no parent, get all root widgets for the same group (including self)
      return ContextWidget.collection().query(q => {
        if (trx) q.transacting(trx)
        q.where({
          group_id: groupId,
          parent_id: null
        })
        q.whereNotNull('order')
        q.orderBy('order', 'asc')
      })
    }
  },

  isLeaf () {
    return this.related('children')?.length === 0
  },

  reorder ({ order, trx }) {
    return ContextWidget.reorder({ id: this.get('id'), order, trx })
  },

  // XXX Tibet: has to be a query, not a relationship, because the view_chat_id is not a foreign key and i couldnt get it to work
  groupTopic () {
    return GroupTag.where({
      group_id: this.get('group_id'),
      tag_id: this.get('view_chat_id')
    })
  },

  topicFollow (userId) {
    return TagFollow.where({
      group_id: this.get('group_id'),
      tag_id: this.get('view_chat_id'),
      user_id: userId
    })
  },

  viewChat () {
    return this.belongsTo(Tag, 'view_chat_id')
  },

  viewFundingRound () {
    return this.belongsTo(FundingRound, 'view_funding_round_id')
  },

  viewGroup () {
    return this.belongsTo(Group, 'view_group_id')
  },

  viewPost () {
    return this.belongsTo(Post, 'view_post_id')
  },

  viewTrack () {
    return this.belongsTo(Track, 'view_track_id')
  },

  viewUser () {
    return this.belongsTo(User, 'view_user_id')
  }

}, {

  ViewFields: {
    POST: 'view_post_id',
    CHAT: 'view_chat_id',
    GROUP: 'view_group_id',
    USER: 'view_user_id',
    CUSTOM: 'custom_view_id',
    TRACK: 'view_track_id',
    FUNDING_ROUND: 'view_funding_round_id',
    VIEW: 'view'
  },

  // Static methods
  create: async function (data) {
    return await bookshelf.transaction(async trx => {
      let customViewId = data.custom_view_id

      // Check if any view fields are being updated
      const viewFields = Object.values(this.ViewFields)
      const hasViewUpdate = viewFields.some(field => data[field] !== undefined) || data.custom_view_input

      if (hasViewUpdate) {
        // If including a view field, set all other view fields to null
        viewFields.forEach(field => {
          if (data[field] === undefined) {
            data[field] = null
          }
        })
      }

      if (data.custom_view_input) {
        const newView = data.custom_view_input
        const topics = newView && newView.topics
        delete newView.topics
        delete newView.id
        const currentView = await CustomView.forge({ ...newView, group_id: data.group_id }).save({}, { transacting: trx })

        await currentView.updateTopics(topics, trx)
        customViewId = currentView.get('id')
      }

      // Create the widget within the transaction
      let widget = await this.forge({
        icon: data.icon,
        title: data.title,
        type: data.type,
        auto_added: true,
        visibility: data.visibility,
        group_id: data.group_id,
        view: data.view,
        view_chat_id: data.view_chat_id,
        view_funding_round_id: data.view_funding_round_id,
        view_group_id: data.view_group_id,
        view_post_id: data.view_post_id,
        view_track_id: data.view_track_id,
        view_user_id: data.view_user_id,
        custom_view_id: customViewId,
        created_at: new Date(),
        updated_at: new Date()
      }).save(null, { transacting: trx })

      widget.refresh()
      // pull out the addToEnd and orderInFrontOfWidgetId
      const addToEnd = data.add_to_end || data.addToEnd
      const orderInFrontOfWidgetId = data.order_in_front_of_widget_id || data.orderInFrontOfWidgetId

      if (addToEnd || data.parent_id !== undefined || orderInFrontOfWidgetId !== undefined) {
        await ContextWidget.reorder({
          id: widget.get('id'),
          addToEnd,
          orderInFrontOfWidgetId,
          parentId: data.parent_id,
          trx
        })
        // widget.refresh() wasn't enough to ensure the reordered widget would actually be refreshed, so needed this
        widget = await this.where({ id: widget.get('id') }).fetch({ transacting: trx })
      }

      return widget
    })
  },

  findForGroup: function (groupId, options = {}) {
    return this.where({ group_id: groupId })
      .orderBy('created_at', 'asc')
      .fetchAll(options)
  },

  removeFromMenu: async function ({ id, trx: existingTrx }) {
    const doWork = async (trx) => {
      // Get the widget being removed
      const removedWidget = await ContextWidget.where({ id }).fetch({ transacting: trx })
      if (!removedWidget) throw new Error('Context widget not found')

      // Get the current order and all peer widgets
      const currentOrder = removedWidget.get('order')
      if (!currentOrder) return // Widget wasn't ordered, nothing to do

      const allWidgets = await ContextWidget.findForGroup(removedWidget.get('group_id'), { transacting: trx })
        .map(widget => ({
          id: widget.get('id'),
          parentId: widget.get('parent_id'),
          order: widget.get('order')
        }))

      // Get widgets that need order updates (all peers with higher order)
      const reorderedWidgets = reorderTree({ widgetToBeMovedId: removedWidget.get('id'), newWidgetPosition: { remove: true }, allWidgets })
      if (reorderedWidgets.length > 0) {
        // Update all affected widgets in a single query
        const query = `
          UPDATE context_widgets
          SET
            "order" = CASE id
              ${reorderedWidgets.map(w => `WHEN ${w.id} THEN ${w.order}`).join('\n')}
            END,
            parent_id = CASE id
              ${reorderedWidgets.map(w => `WHEN ${w.id} THEN ${w.parentId === null ? 'NULL' : w.parentId}`).join('\n')}
            END,
            auto_added = true
          WHERE id IN (${reorderedWidgets.map(w => w.id).join(',')})
        `
        await bookshelf.knex.raw(query).transacting(trx)
      }

      if (removedWidget.get('view_post_id') || removedWidget.get('view_group_id') || removedWidget.get('view_track_id') || removedWidget.get('view_funding_round_id')) {
        await removedWidget.destroy({ transacting: trx })
      } else {
        await removedWidget.refresh()
      }

      return removedWidget
    }

    if (existingTrx) {
      return doWork(existingTrx)
    }

    return await bookshelf.transaction(trx => doWork(trx))
  },

  reorder: async function ({ id, addToEnd, orderInFrontOfWidgetId, parentId, trx: existingTrx }) {
    const doWork = async (trx) => {
      const movedWidget = await ContextWidget.where({ id }).fetch({ transacting: trx })
      if (!movedWidget) throw new Error('Context widget not found')

      // Fetch all widgets for the group
      const allWidgets = await ContextWidget.findForGroup(movedWidget.get('group_id'), { transacting: trx })
        .map(widget => ({
          id: widget.get('id'),
          parentId: widget.get('parent_id'),
          order: widget.get('order')
        }))

      // Define the new widget position
      const newWidgetPosition = { id, addToEnd, orderInFrontOfWidgetId, parentId }

      // Reorder the widgets
      const reorderedWidgets = reorderTree({ widgetToBeMovedId: movedWidget.get('id'), newWidgetPosition, allWidgets })

      // Update all affected widgets in a single query
      const query = `
        UPDATE context_widgets
        SET
          "order" = CASE id
            ${reorderedWidgets.map(w => `WHEN ${w.id} THEN ${w.order}`).join('\n')}
          END,
          parent_id = CASE id
            ${reorderedWidgets.map(w => `WHEN ${w.id} THEN ${w.parentId === null ? 'NULL' : w.parentId}`).join('\n')}
          END,
          auto_added = CASE
            ${reorderedWidgets.map(w => `WHEN id = ${w.id} AND ${w.order} IS NOT NULL THEN true`).join('\n')}
            ELSE auto_added
          END
        WHERE id IN (${reorderedWidgets.map(w => w.id).join(',')})
      `

      await bookshelf.knex.raw(query).transacting(trx)
      movedWidget.refresh()
      return movedWidget
    }

    if (existingTrx) {
      return doWork(existingTrx)
    }

    return await bookshelf.transaction(trx => doWork(trx))
  },

  setHomeWidget: async function ({ id, groupId, trx: existingTrx }) {
    const doWork = async (trx) => {
      const allWidgets = await ContextWidget.findForGroup(groupId, { transacting: trx })
        .map(widget => ({
          id: widget.get('id'),
          parentId: widget.get('parent_id'),
          order: widget.get('order'),
          type: widget.get('type')
        }))
      const reorderedWidgets = replaceHomeWidget({ widgets: allWidgets, newHomeWidgetId: id })

      // Update all affected widgets in a single query
      const query = `
        UPDATE context_widgets
        SET
          "order" = CASE id
            ${reorderedWidgets.map(w => `WHEN ${w.id} THEN ${w.order}`).join('\n')}
          END,
          parent_id = CASE id
            ${reorderedWidgets.map(w => `WHEN ${w.id} THEN ${w.parentId === null ? 'NULL' : w.parentId}`).join('\n')}
          END,
          auto_added = CASE
            ${reorderedWidgets.map(w => `WHEN id = ${w.id} AND ${w.order} IS NOT NULL THEN true`).join('\n')}
            ELSE auto_added
          END
        WHERE id IN (${reorderedWidgets.map(w => w.id).join(',')})
      `

      await bookshelf.knex.raw(query).transacting(trx)
      return { success: true }
    }

    if (existingTrx) {
      return doWork(existingTrx)
    }

    return await bookshelf.transaction(trx => doWork(trx))
  },

  update: async function ({ id, data, trx: existingTrx }) {
    const doWork = async (trx) => {
      const widget = await this.where({ id }).fetch({ transacting: trx })
      if (!widget) throw new Error('Context widget not found')

      // Check if any view fields are being updated
      const viewFields = Object.values(this.ViewFields)
      const hasViewUpdate = viewFields.some(field => data[field] !== undefined)

      if (hasViewUpdate) {
        // If updating a view field, set all other view fields to null
        viewFields.forEach(field => {
          if (data[field] === undefined) {
            data[field] = null
          }
        })
      }

      // pull out the addToEnd and orderInFrontOfWidgetId
      const addToEnd = data.add_to_end || data.addToEnd
      const orderInFrontOfWidgetId = data.order_in_front_of_widget_id || data.orderInFrontOfWidgetId

      // Update the widget with the new data. If a widget is updated, we don't want to auto-add it later.
      await widget.save({
        icon: data.icon,
        title: data.title,
        type: data.type,
        auto_added: true,
        visibility: data.visibility,
        group_id: data.group_id,
        view: data.view,
        view_chat_id: data.view_chat_id,
        view_group_id: data.view_group_id,
        view_funding_round_id: data.view_funding_round_id,
        view_post_id: data.view_post_id,
        view_track_id: data.view_track_id,
        view_user_id: data.view_user_id,
        custom_view_id: data.custom_view_id
      }, {
        patch: true,
        transacting: trx
      })
      await widget.refresh()

      // If the update includes an order or parent_id, reorder the widget
      if (addToEnd || data.parent_id !== undefined || orderInFrontOfWidgetId !== undefined) {
        await ContextWidget.reorder({
          id: widget.get('id'),
          addToEnd,
          orderInFrontOfWidgetId,
          parentId: data.parent_id,
          trx
        })
      }
      await widget.refresh()
      return widget
    }

    if (existingTrx) {
      return doWork(existingTrx)
    }

    return await bookshelf.transaction(trx => doWork(trx))
  }
})
