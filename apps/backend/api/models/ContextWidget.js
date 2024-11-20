module.exports = bookshelf.Model.extend({
  tableName: 'context_widgets',
  requireFetch: false,
  hasTimestamps: true,

  initialize() {
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
        relationsToLoad.push('children')

        options.withRelated = options.withRelated.concat(relationsToLoad)
    })
  },

  // Relationships


  children() {
    return this.hasMany(ContextWidget, 'parent_id')
  },

  customView() {
    return this.belongsTo(CustomView, 'custom_view_id')
  },
  group() {
    return this.belongsTo(Group, 'group_id')
  },

  highlightNumber() {
    // TODO CONTEXT: these will need to determine a useful number based on the entity the widget is linked to
    return 3
  },

  secondaryNumber() {
    // TODO CONTEXT: these will need to determine a useful number based on the entity the widget is linked to
    return 8
  },

  parent() {
    return this.belongsTo(ContextWidget, 'parent_id')
  },

  peers(trx) {
    const groupId = this.get('group_id')
    const parentId = this.get('parent_id')
    const id = this.get('id')
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

  isLeaf() {
    return this.related('children')?.length === 0
  },

  reorder({ order, trx }) {
    console.log('well we certainly get here, ', this.get('id'), 'aaaaaa')
    return ContextWidget.reorder({ id: this.get('id'), order, trx })
  },

  viewChat() {
    return this.belongsTo(Tag, 'view_chat_id')
  },

  viewGroup() {
    return this.belongsTo(Group, 'view_group_id')
  },

  viewPost() {
    return this.belongsTo(Post, 'view_post_id') 
  },

  viewUser() {
    return this.belongsTo(User, 'view_user_id')
  },

}, {

  ViewFields: {
    POST: 'view_post_id',
    CHAT: 'view_chat_id',
    GROUP: 'view_group_id',
    USER: 'view_user_id',
    CUSTOM: 'custom_view_id',
    VIEW: 'view'
  },

  // Static methods
  create: async function(attributes) {
    return await bookshelf.transaction(async trx => {
      // Create the widget within the transaction
      const widget = await this.forge({
        ...attributes,
        order: null,
        created_at: new Date(),
        updated_at: new Date()
      }).save(null, { transacting: trx });

      // If a widget has a parent, it must be ordered
      // If a widget has an order, it must be reordered
      // If a widget has neither, it is created but won't be part of a context menu
      if (attributes.parent_id || attributes.order) {
        await ContextWidget.reorder({
          id: widget.get('id'),
          order: attributes.order,
          trx
        })
      }

      return widget;
    });
  },

  findForGroup: function(groupId, options = {}) {
    return this.where({group_id: groupId})
      .orderBy('created_at', 'asc')
      .fetchAll(options)
  },
  removeFromMenu: async function({id, trx: existingTrx}) {
    const doWork = async (trx) => {
      // Get the widget being removed
      const removedWidget = await ContextWidget.where({ id }).fetch({ transacting: trx })
      if (!removedWidget) throw new Error('Context widget not found')

      // Get the current order and all peer widgets
      const currentOrder = removedWidget.get('order')
      if (!currentOrder) return // Widget wasn't ordered, nothing to do

      const peerWidgets = await removedWidget.peers(trx).fetch({ transacting: trx })

      // Get widgets that need order updates (all peers with higher order)
      const reorderedWidgets = peerWidgets.reduce((acc, widget) => {
        const widgetOrder = widget.get('order')
        if (widgetOrder > currentOrder) {
          acc.push({ 
            id: widget.get('id'), 
            order: widgetOrder - 1 
          })
        }
        return acc
      }, [])
      
      if (reorderedWidgets.length > 0) {
        // Update all affected widgets in a single query
        const query = `
          UPDATE context_widgets 
          SET "order" = CASE id 
            ${reorderedWidgets.map(w => `WHEN ${w.id} THEN ${w.order}`).join('\n')}
          END
          WHERE id IN (${reorderedWidgets.map(w => w.id).join(',')})
        `
        await bookshelf.knex.raw(query).transacting(trx)
      }

      // Set the removed widget's order and parent_id to null
      await removedWidget.save({ order: null, parent_id: null, }, { 
        patch: true,
       
        transacting: trx 
      })

      return removedWidget
    }

    if (existingTrx) {
      return doWork(existingTrx)
    }

    return await bookshelf.transaction(trx => doWork(trx))
  },
  reorder: async function({ id, addToEnd, orderInFrontOfWidgetId, parentWidgetId, trx: existingTrx }) {
    const doWork = async (trx) => {
      const movedContextWidget = await ContextWidget.where({ id }).fetch({ transacting: trx })
      if (!movedContextWidget) throw new Error('Context widget not found')
      console.log('inside the reorder', order)

      const priorWidgetState = {
        id: movedWidget.get('id'),
        parentId: movedWidget.get('parent_id'),
        order: movedWidget.get('order')
      }
  
      // Fetch all widgets for the group
      const allWidgets = await ContextWidget.findForGroup(movedWidget.get('group_id'), { transacting: trx })
        .map(widget => ({
          id: widget.get('id'),
          parentId: widget.get('parent_id'),
          order: widget.get('order')
        }))
  
      // Define the new widget position
      const newWidgetPosition = { id, addToEnd, orderInFrontOfWidgetId, parentWidgetId }
  
      // Reorder the widgets
      const reorderedWidgets = reorderTree({priorWidgetState, newWidgetPosition, allWidgets})

      console.log('this is what the reorderedWidgets are', reorderedWidgets)
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
    
      return movedContextWidget
    }

    if (existingTrx) {
      return doWork(existingTrx)
    }

    return await bookshelf.transaction(trx => doWork(trx))
  },
  update: async function({ id, data, trx: existingTrx }) {
    const doWork = async (trx) => {
      const widget = await this.where({ id }).fetch({ transacting: trx })
      if (!widget) throw new Error('Context widget not found')

      // Check if any view fields are being updated
      const viewFields = Object.values(this.ViewFields)
      const hasViewUpdate = viewFields.some(field => data[field] !== undefined)
      console.log('inside the update', widget.toJSON(), 'and this is the input' , data)
      if (hasViewUpdate) {
        // If updating a view field, set all other view fields to null
        viewFields.forEach(field => {
          if (data[field] === undefined) {
            data[field] = null
          }
        })
      }

      // pull out the addToEnd and orderInFrontOfWidgetId
      const addToEnd = data.add_to_end
      const orderInFrontOfWidgetId = data.order_in_front_of_widget_id

      // Update the widget with the new data. If a widget is updated, we don't want to auto-add it later.
      await widget.save({ ...data, auto_added: true, order: widget.get('order') || null, parent_id: widget.get('parent_id') || null }, { 
        patch: true, 
        transacting: trx 
      })
      widget.refresh()
      // If the update includes an order or parent_id, reorder the widget
      if (addToEnd || data.parent_id !== undefined || orderInFrontOfWidgetId !== undefined) {

        await ContextWidget.reorder({
          id: widget.get('id'),
          addToEnd,
          orderInFrontOfWidgetId,
          parentWidgetId: data.parent_id,
          trx
        })
      }
      widget.refresh()

      return widget
    }

    if (existingTrx) {
      return doWork(existingTrx)
    }

    return await bookshelf.transaction(trx => doWork(trx))
  }
})
