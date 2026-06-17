import {
  hasActiveTextSelection,
  isCommentComposerTarget,
  isSelectionInPostDetailEditor,
  isTextInteractionTarget,
  createPersistentSelectionTracker
} from './textSelectionTouch'

describe('hasActiveTextSelection', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
  })

  it('returns true when window.getSelection has text', () => {
    const node = document.createElement('p')
    node.textContent = 'hello world'
    document.body.appendChild(node)

    const range = document.createRange()
    range.selectNodeContents(node)
    window.getSelection().addRange(range)

    expect(hasActiveTextSelection()).toBe(true)
  })

  it('returns true when a textarea has a non-empty range', () => {
    const textarea = document.createElement('textarea')
    textarea.value = 'hello world'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.setSelectionRange(0, 5)

    expect(hasActiveTextSelection()).toBe(true)
  })

  it('returns false when nothing is selected', () => {
    expect(hasActiveTextSelection()).toBe(false)
  })
})

describe('isTextInteractionTarget', () => {
  it('returns true for textarea, input, and contenteditable', () => {
    expect(isTextInteractionTarget(document.createElement('textarea'))).toBe(true)
    expect(isTextInteractionTarget(document.createElement('input'))).toBe(true)

    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    expect(isTextInteractionTarget(editable)).toBe(true)
  })

  it('returns true for descendants of ProseMirror', () => {
    const editor = document.createElement('div')
    editor.className = 'ProseMirror'
    const p = document.createElement('p')
    editor.appendChild(p)
    document.body.appendChild(editor)

    expect(isTextInteractionTarget(p)).toBe(true)
  })

  it('returns false for ordinary static text nodes', () => {
    const p = document.createElement('p')
    expect(isTextInteractionTarget(p)).toBe(false)
  })
})

describe('isCommentComposerTarget', () => {
  it('returns true for elements inside CommentForm', () => {
    const form = document.createElement('div')
    form.className = 'CommentForm'
    const child = document.createElement('span')
    form.appendChild(child)
    document.body.appendChild(form)

    expect(isCommentComposerTarget(child)).toBe(true)
    document.body.removeChild(form)
  })
})

describe('isSelectionInPostDetailEditor', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
  })

  it('returns true when selection is inside a post-detail comment editor', () => {
    const postDetail = document.createElement('div')
    postDetail.className = 'PostDetail'
    const form = document.createElement('div')
    form.className = 'CommentForm'
    const editor = document.createElement('div')
    editor.className = 'ProseMirror'
    const p = document.createElement('p')
    p.textContent = 'hello world'
    editor.appendChild(p)
    form.appendChild(editor)
    postDetail.appendChild(form)
    document.body.appendChild(postDetail)

    const range = document.createRange()
    range.selectNodeContents(p)
    window.getSelection().addRange(range)

    expect(isSelectionInPostDetailEditor()).toBe(true)
  })
})

describe('createPersistentSelectionTracker', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    window.getSelection()?.removeAllRanges()
    jest.useRealTimers()
  })

  it('keeps hasSelection true through a debounced empty selectionchange', () => {
    jest.useFakeTimers()

    const node = document.createElement('p')
    node.textContent = 'selected text'
    document.body.appendChild(node)

    const range = document.createRange()
    range.selectNodeContents(node)
    window.getSelection().addRange(range)

    const tracker = createPersistentSelectionTracker()
    expect(tracker.hasSelection).toBe(true)

    window.getSelection().removeAllRanges()
    document.dispatchEvent(new Event('selectionchange'))

    expect(tracker.hasSelection).toBe(true)

    jest.advanceTimersByTime(300)
    expect(tracker.hasSelection).toBe(false)

    tracker.destroy()
  })

  it('does not clear while getActiveTouch reports an active touch', () => {
    jest.useFakeTimers()

    const node = document.createElement('p')
    node.textContent = 'selected text'
    document.body.appendChild(node)

    const range = document.createRange()
    range.selectNodeContents(node)
    window.getSelection().addRange(range)

    let touchActive = true
    const tracker = createPersistentSelectionTracker({
      getActiveTouch: () => touchActive
    })

    window.getSelection().removeAllRanges()
    document.dispatchEvent(new Event('selectionchange'))
    jest.advanceTimersByTime(200)

    expect(tracker.hasSelection).toBe(true)

    touchActive = false
    document.dispatchEvent(new Event('selectionchange'))
    jest.advanceTimersByTime(200)

    expect(tracker.hasSelection).toBe(false)

    tracker.destroy()
  })
})
