import { reorderTree, replaceHomeWidget } from "./contextWidgets"


describe('ContextWidget', () => {
  describe('reorderTree', () => {
    let testTreeOne, testTreeTwo, testTreeThree, testTreeFour, testTreeFive;

    beforeEach(() => {
      testTreeOne = [
        { id: 1, order: 1, parentId: null },
        { id: 2, order: 2, parentId: null },
        { id: 3, order: 3, parentId: null },
        { id: 12, order: null }
      ]
      
      testTreeTwo = [
        { id: 1, order: 1, parentId: null },
        { id: 2, order: 2, parentId: null },
        { id: 3, order: 3, parentId: null },
        { id: 4, order: 1, parentId: 1 },
        { id: 5, order: 2, parentId: 1 },
        { id: 6, order: 3, parentId: 1 },
        { id: 10, order: null, parentId: null }
      ]
      
      testTreeThree = [
        { id: 1, order: 1, parentId: null },
        { id: 2, order: 3, parentId: null },
        { id: 3, order: 2, parentId: null },
        { id: 4, order: 1, parentId: 1 },
        { id: 5, order: 2, parentId: 1 },
        { id: 6, order: 3, parentId: 1 },
        { id: 7, order: 1, parentId: 3 },
        { id: 8, order: 2, parentId: 3 },
        { id: 9, order: 3, parentId: 3 }
      ]

      testTreeFour = [
        { id: 1, order: 1, parentId: null, type: 'home' },
        { id: 2, order: 2, parentId: null, type: 'chats' },
        { id: 3, order: 1, parentId: 1, type: 'chat' },
        { id: 4, order: 3, parentId: null, type: null },
        { id: 5, order: 1, parentId: 4, type: null },
        { id: 6, order: 2, parentId: 4, type: null },
        { id: 7, order: 3, parentId: 4, type: null },
        { id: 8, order: 1, parentId: 2, type: 'chat' },
        { id: 9, order: 2, parentId: 2, type: 'chat' },
        { id: 10, order: null, parentId: null, type: 'chat' },
      ]

      testTreeFive = [
        { id: 1, order: 1, parentId: null, type: 'home' },
        { id: 2, order: 2, parentId: null, type: 'chats' },
        { id: 3, order: 1, parentId: 1, type: 'test' },
        { id: 4, order: 3, parentId: null, type: null },
        { id: 5, order: 1, parentId: 4, type: null },
        { id: 6, order: 2, parentId: 4, type: null },
        { id: 7, order: 3, parentId: 4, type: null },
        { id: 8, order: 1, parentId: 2, type: 'chat' },
        { id: 9, order: 2, parentId: 2, type: 'chat' },
        { id: 10, order: null, parentId: null, type: 'chat' },
      ]
    });

    it('should move a widget to the end of the list', () => {
      const newWidgetPosition = { id: 12, addToEnd: true }
      const reorderedWidgets = reorderTree({ widgetToBeMovedId: 12, newWidgetPosition, allWidgets: testTreeOne })

      expect(reorderedWidgets).to.deep.equal([
        { id: 1, order: 1, parentId: null },
        { id: 2, order: 2, parentId: null },
        { id: 3, order: 3, parentId: null },
        { id: 12, order: 4, parentId: null }
      ])
    })

    it('should move a widget in front of another widget', () => {
      const widgetToBeMovedId = 3
      const newWidgetPosition = { id: 3, orderInFrontOfWidgetId: 1 }
      const reorderedWidgets = reorderTree({ widgetToBeMovedId, newWidgetPosition, allWidgets: testTreeTwo })

      const expectedWidgets = [
        { id: 3, order: 1, parentId: null },
        { id: 1, order: 2, parentId: null },
        { id: 2, order: 3, parentId: null },
        { id: 4, order: 1, parentId: 1 },
        { id: 5, order: 2, parentId: 1 },
        { id: 6, order: 3, parentId: 1 }
      ]

      expectedWidgets.forEach((expectedWidget, index) => {
        const reorderedWidget = reorderedWidgets.find(widget => widget.id === expectedWidget.id)
        expect(reorderedWidget).to.deep.equal(expectedWidget)
      })
    })

    it('should handle reordering within nested structures', () => {
      const widgetToBeMovedId = 9
      const newWidgetPosition = { id: 9, orderInFrontOfWidgetId: 7 }
      const reorderedWidgets = reorderTree({ widgetToBeMovedId, newWidgetPosition, allWidgets: testTreeThree })

      const expectedWidgets = [
        { id: 1, order: 1, parentId: null },
        { id: 2, order: 3, parentId: null },
        { id: 3, order: 2, parentId: null },
        { id: 4, order: 1, parentId: 1 },
        { id: 5, order: 2, parentId: 1 },
        { id: 6, order: 3, parentId: 1 },
        { id: 9, order: 1, parentId: 3 },
        { id: 7, order: 2, parentId: 3 },
        { id: 8, order: 3, parentId: 3 }
      ]

      expectedWidgets.forEach((expectedWidget, index) => {
        const reorderedWidget = reorderedWidgets.find(widget => widget.id === expectedWidget.id)
        expect(reorderedWidget).to.deep.equal(expectedWidget)
      })
    })

    it('should add a new widget to the end of a parent widget\'s children', () => {
      const widgetToBeMovedId = 10
      const newWidgetPosition = { id: 10, parentId: 1, addToEnd: true }
      const reorderedWidgets = reorderTree({ widgetToBeMovedId, newWidgetPosition, allWidgets: testTreeTwo })

      const expectedWidgets = [
        { id: 1, order: 1, parentId: null },
        { id: 2, order: 2, parentId: null },
        { id: 3, order: 3, parentId: null },
        { id: 4, order: 1, parentId: 1 },
        { id: 5, order: 2, parentId: 1 },
        { id: 6, order: 3, parentId: 1 },
        { id: 10, order: 4, parentId: 1 }
      ]

      expectedWidgets.forEach((expectedWidget, index) => {
        const reorderedWidget = reorderedWidgets.find(widget => widget.id === expectedWidget.id)
        expect(reorderedWidget).to.deep.equal(expectedWidget)
      })
    })

    it('should move a child widget from one parent to another', () => {
      const widgetToBeMovedId = 7
      const newWidgetPosition = { id: 7, parentId: 1, orderInFrontOfWidgetId: 4 }
      const reorderedWidgets = reorderTree({ widgetToBeMovedId, newWidgetPosition, allWidgets: testTreeThree })

      const expectedWidgets = [
        { id: 1, order: 1, parentId: null },
        { id: 2, order: 3, parentId: null },
        { id: 3, order: 2, parentId: null },
        { id: 4, order: 2, parentId: 1 },
        { id: 5, order: 3, parentId: 1 },
        { id: 6, order: 4, parentId: 1 },
        { id: 7, order: 1, parentId: 1 },
        { id: 8, order: 1, parentId: 3 },
        { id: 9, order: 2, parentId: 3 }
      ]

      expectedWidgets.forEach((expectedWidget, index) => {
        const reorderedWidget = reorderedWidgets.find(widget => widget.id === expectedWidget.id)
        expect(reorderedWidget).to.deep.equal(expectedWidget)
      })
    })

    it('should move a child widget to the parent level', () => {
      const widgetToBeMovedId = 4
      const newWidgetPosition = { id: 4, orderInFrontOfWidgetId: 2 }
      const reorderedWidgets = reorderTree({ widgetToBeMovedId, newWidgetPosition, allWidgets: testTreeTwo })

      const expectedWidgets = [
        { id: 1, order: 1, parentId: null },
        { id: 2, order: 3, parentId: null },
        { id: 3, order: 4, parentId: null  },
        { id: 4, order: 2, parentId: null },
        { id: 5, order: 1, parentId: 1 },
        { id: 6, order: 2, parentId: 1 }
      ]

      expectedWidgets.forEach((expectedWidget, index) => {
        const reorderedWidget = reorderedWidgets.find(widget => widget.id === expectedWidget.id)
        expect(reorderedWidget).to.deep.equal(expectedWidget)
      })
    })

    it('should move a child widget from one parent to another when using addToEnd', () => {
      const widgetToBeMovedId = 7
      const newWidgetPosition = { id: 7, parentId: 1, addToEnd: true }
      const reorderedWidgets = reorderTree({ widgetToBeMovedId, newWidgetPosition, allWidgets: testTreeThree })

      const expectedWidgets = [
        { id: 1, order: 1, parentId: null },
        { id: 2, order: 3, parentId: null }, 
        { id: 3, order: 2, parentId: null },
        { id: 4, order: 1, parentId: 1 },
        { id: 5, order: 2, parentId: 1 },
        { id: 6, order: 3, parentId: 1 },
        { id: 7, order: 4, parentId: 1 },
        { id: 8, order: 1, parentId: 3 },
        { id: 9, order: 2, parentId: 3 }
      ]

      expectedWidgets.forEach((expectedWidget, index) => {
        const reorderedWidget = reorderedWidgets.find(widget => widget.id === expectedWidget.id)
        expect(reorderedWidget).to.deep.equal(expectedWidget)
      })
    })

    it('should add a child to a parent widget that has no children', () => {
      const widgetToBeMovedId = 3
      const newWidgetPosition = { id: 3, parentId: 2, addToEnd: true }
      const reorderedWidgets = reorderTree({ widgetToBeMovedId, newWidgetPosition, allWidgets: testTreeOne })

      const expectedWidgets = [
        { id: 1, order: 1, parentId: null },
        { id: 2, order: 2, parentId: null },
        { id: 3, order: 1, parentId: 2 },
        { id: 12, order: null }
      ]

      expectedWidgets.forEach((expectedWidget, index) => {
        const reorderedWidget = reorderedWidgets.find(widget => widget.id === expectedWidget.id)
        expect(reorderedWidget).to.deep.equal(expectedWidget)
      })
    })

    it('if the home child is a chat, move it to the front of the chats widget', () => {
      const newHomeWidgetId = 5
      const reorderedWidgets = replaceHomeWidget({ newHomeWidgetId, widgets: testTreeFour })

      const expectedWidgets = [
        { id: 1, order: 1, parentId: null, type: 'home' },
        { id: 2, order: 2, parentId: null, type: 'chats' },
        { id: 3, order: 1, parentId: 2, type: 'chat' },
        { id: 4, order: 3, parentId: null, type: null },
        { id: 5, order: 1, parentId: 1, type: null },
        { id: 6, order: 1, parentId: 4, type: null },
        { id: 7, order: 2, parentId: 4, type: null },
        { id: 8, order: 2, parentId: 2, type: 'chat' },
        { id: 9, order: 3, parentId: 2, type: 'chat' },
        { id: 10, order: null, parentId: null, type: 'chat' },
      ]

      expectedWidgets.forEach((expectedWidget, index) => {
        const reorderedWidget = reorderedWidgets.find(widget => widget.id === expectedWidget.id)
        expect(reorderedWidget).to.deep.equal(expectedWidget)
      })
    })
  
    it('if the old home child and new child are chats, make sure the order is correct', () => {
      const newHomeWidgetId = 9
      const reorderedWidgets = replaceHomeWidget({ newHomeWidgetId, widgets: testTreeFour })

      const expectedWidgets = [
        { id: 1, order: 1, parentId: null, type: 'home' },
        { id: 2, order: 2, parentId: null, type: 'chats' },
        { id: 3, order: 1, parentId: 2, type: 'chat' },
        { id: 4, order: 3, parentId: null, type: null },
        { id: 5, order: 1, parentId: 4, type: null },
        { id: 6, order: 2, parentId: 4, type: null },
        { id: 7, order: 3, parentId: 4, type: null },
        { id: 8, order: 2, parentId: 2, type: 'chat' },
        { id: 9, order: 1, parentId: 1, type: 'chat' },
        { id: 10, order: null, parentId: null, type: 'chat' },
      ]
      expectedWidgets.forEach((expectedWidget, index) => {
        const reorderedWidget = reorderedWidgets.find(widget => widget.id === expectedWidget.id)
        expect(reorderedWidget).to.deep.equal(expectedWidget)
      })
    })

    it('if the old home child is not a chat, remove it from the ordering', () => {
      const newHomeWidgetId = 5
      const reorderedWidgets = replaceHomeWidget({ newHomeWidgetId, widgets: testTreeFive })

      const expectedWidgets = [
        { id: 1, order: 1, parentId: null, type: 'home' },
        { id: 2, order: 2, parentId: null, type: 'chats' },
        { id: 3, order: null, parentId: null, type: 'test' },
        { id: 4, order: 3, parentId: null, type: null },
        { id: 5, order: 1, parentId: 1, type: null },
        { id: 6, order: 1, parentId: 4, type: null },
        { id: 7, order: 2, parentId: 4, type: null },
        { id: 8, order: 1, parentId: 2, type: 'chat' },
        { id: 9, order: 2, parentId: 2, type: 'chat' },
        { id: 10, order: null, parentId: null, type: 'chat' },
      ]

      expectedWidgets.forEach((expectedWidget, index) => {
        const reorderedWidget = reorderedWidgets.find(widget => widget.id === expectedWidget.id)
        expect(reorderedWidget).to.deep.equal(expectedWidget)
      })
    })

    it('should make the widgets order and parentId null if newWidgetPosition.remove === true', () => {
      const widgetToBeMovedId = 3
      const newWidgetPosition = { id: 3, remove: true }
      const reorderedWidgets = reorderTree({ widgetToBeMovedId, newWidgetPosition, allWidgets: testTreeFour })

      const expectedWidgets = [
        { id: 1, order: 1, parentId: null, type: 'home' },
        { id: 2, order: 2, parentId: null, type: 'chats' },
        { id: 3, order: null, parentId: null, type: 'chat' },
        { id: 4, order: 3, parentId: null, type: null },
        { id: 5, order: 1, parentId: 4, type: null },
        { id: 6, order: 2, parentId: 4, type: null },
        { id: 7, order: 3, parentId: 4, type: null },
        { id: 8, order: 1, parentId: 2, type: 'chat' },
        { id: 9, order: 2, parentId: 2, type: 'chat' },
        { id: 10, order: null, parentId: null, type: 'chat' },
      ]

      expectedWidgets.forEach((expectedWidget, index) => {
        const reorderedWidget = reorderedWidgets.find(widget => widget.id === expectedWidget.id)
        expect(reorderedWidget).to.deep.equal(expectedWidget)
      })
    })

    it('should make the widget and all its children order and parentId null if newWidgetPosition.remove === true', () => {
      const widgetToBeMovedId = 4
      const newWidgetPosition = { id: 4, remove: true }
      const reorderedWidgets = reorderTree({ widgetToBeMovedId, newWidgetPosition, allWidgets: testTreeFour })

      const expectedWidgets = [
        { id: 1, order: 1, parentId: null, type: 'home' },
        { id: 2, order: 2, parentId: null, type: 'chats' },
        { id: 3, order: 1, parentId: 1, type: 'chat' },
        { id: 4, order: null, parentId: null, type: null },
        { id: 5, order: null, parentId: null, type: null },
        { id: 6, order: null, parentId: null, type: null },
        { id: 7, order: null, parentId: null, type: null },
        { id: 8, order: 1, parentId: 2, type: 'chat' },
        { id: 9, order: 2, parentId: 2, type: 'chat' },
        { id: 10, order: null, parentId: null, type: 'chat' },
      ]

      expectedWidgets.forEach((expectedWidget, index) => {
        const reorderedWidget = reorderedWidgets.find(widget => widget.id === expectedWidget.id)
        expect(reorderedWidget).to.deep.equal(expectedWidget)
      })
    })

  })
})