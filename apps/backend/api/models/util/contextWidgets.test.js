import { reorderTree } from "./contextWidgets"


describe('ContextWidget', () => {
  describe('reorderTree', () => {
    let testTreeOne, testTreeTwo, testTreeThree;

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
    });

    it('should move a widget to the end of the list', () => {
      const newWidgetPosition = { id: 12, addToEnd: true }
      const reorderedWidgets = reorderTree({ newWidgetPosition, allWidgets: testTreeOne })

      expect(reorderedWidgets).to.deep.equal([
        { id: 1, order: 1, parentId: null },
        { id: 2, order: 2, parentId: null },
        { id: 3, order: 3, parentId: null },
        { id: 12, order: 4, parentId: null }
      ])
    })

    it('should move a widget in front of another widget', () => {
      const priorWidgetState = { id: 3, order: 3 }
      const newWidgetPosition = { id: 3, orderInFrontOfWidgetId: 1 }
      const reorderedWidgets = reorderTree({ priorWidgetState, newWidgetPosition, allWidgets: testTreeTwo })

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
      const priorWidgetState = { id: 9, order: 2, parentId: 3 }
      const newWidgetPosition = { id: 9, orderInFrontOfWidgetId: 7 }
      const reorderedWidgets = reorderTree({ priorWidgetState, newWidgetPosition, allWidgets: testTreeThree })

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
      const priorWidgetState = { id: 10, order: null }
      const newWidgetPosition = { id: 10, parentId: 1, addToEnd: true }
      const reorderedWidgets = reorderTree({ priorWidgetState, newWidgetPosition, allWidgets: testTreeTwo })

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
      const priorWidgetState = { id: 7, order: 1, parentId: 3 }
      const newWidgetPosition = { id: 7, parentId: 1, orderInFrontOfWidgetId: 4 }
      const reorderedWidgets = reorderTree({ priorWidgetState, newWidgetPosition, allWidgets: testTreeThree })

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
      const priorWidgetState = { id: 4, order: 1, parentId: 1 }
      const newWidgetPosition = { id: 4, orderInFrontOfWidgetId: 2 }
      const reorderedWidgets = reorderTree({ priorWidgetState, newWidgetPosition, allWidgets: testTreeTwo })

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
      const priorWidgetState = { id: 7, order: 1, parentId: 3 }
      const newWidgetPosition = { id: 7, parentId: 1, addToEnd: true }
      const reorderedWidgets = reorderTree({ priorWidgetState, newWidgetPosition, allWidgets: testTreeThree })

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
  })
})