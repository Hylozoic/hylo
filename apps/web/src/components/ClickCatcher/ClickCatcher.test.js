import { handleClick, internalPathname } from './ClickCatcher'

function clickEvent (element) {
  return {
    target: element,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn()
  }
}

describe('handleClick', () => {
  it('navigates topic tags to group search', () => {
    document.body.innerHTML = '<span class="topic" data-id="climate" data-label="#climate">#climate</span>'
    const navigate = jest.fn()
    const event = clickEvent(document.querySelector('.topic'))

    handleClick(navigate, 'awesome-team')(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.stopPropagation).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/search?t=%23climate&groupSlug=awesome-team')
  })

  it('navigates legacy hashtag links to search', () => {
    document.body.innerHTML = '<a href="/groups/old/topics/offer" class="hashtag" data-search="#offer">#offer</a>'
    const navigate = jest.fn()
    const event = clickEvent(document.querySelector('.hashtag'))

    handleClick(navigate, 'awesome-team')(event)

    expect(navigate).toHaveBeenCalledWith('/search?t=%23offer&groupSlug=awesome-team')
  })

  it('searches globally when there is no current group', () => {
    document.body.innerHTML = '<span class="topic" data-id="climate">#climate</span>'
    const navigate = jest.fn()
    const event = clickEvent(document.querySelector('.topic'))

    handleClick(navigate, 'all')(event)

    expect(navigate).toHaveBeenCalledWith('/search?t=%23climate')
  })

  it('still navigates member mentions to the member page', () => {
    document.body.innerHTML = '<span class="mention" data-id="123">Pat</span>'
    const navigate = jest.fn()
    const event = clickEvent(document.querySelector('.mention'))

    handleClick(navigate, 'awesome-team')(event)

    expect(navigate).toHaveBeenCalledWith('/groups/awesome-team/members/123')
  })

  it('navigates same-origin hylo links internally', () => {
    document.body.innerHTML = `<a href="${window.location.origin}/groups/foo">link</a>`
    const navigate = jest.fn()
    const link = document.querySelector('a')
    const event = clickEvent(link)

    handleClick(navigate, 'awesome-team')(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/groups/foo')
    expect(link.getAttribute('target')).toBe(null)
  })

  it('navigates relative hylo paths internally', () => {
    document.body.innerHTML = '<a href="/groups/foo">link</a>'
    const navigate = jest.fn()
    const event = clickEvent(document.querySelector('a'))

    handleClick(navigate, 'awesome-team')(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/groups/foo')
  })

  it('opens a different hylo environment in a new tab', () => {
    document.body.innerHTML = '<a href="https://staging.hylo.com/groups/foo">link</a>'
    const navigate = jest.fn()
    const link = document.querySelector('a')
    const event = clickEvent(link)

    handleClick(navigate, 'awesome-team')(event)

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('opens a different hylo environment in a new tab when the click is on nested text', () => {
    document.body.innerHTML = '<a href="https://staging.hylo.com/groups/foo"><strong>link</strong></a>'
    const navigate = jest.fn()
    const link = document.querySelector('a')
    const event = clickEvent(document.querySelector('strong'))

    handleClick(navigate, 'awesome-team')(event)

    expect(navigate).not.toHaveBeenCalled()
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('opens a fully external url in a new tab', () => {
    document.body.innerHTML = '<a href="https://example.com/article">link</a>'
    const navigate = jest.fn()
    const link = document.querySelector('a')
    const event = clickEvent(link)

    handleClick(navigate, 'awesome-team')(event)

    expect(navigate).not.toHaveBeenCalled()
    expect(link.getAttribute('target')).toBe('_blank')
  })
})

describe('internalPathname', () => {
  it('treats www and bare hylo.com as the same root domain', () => {
    expect(internalPathname('https://www.hylo.com/groups/foo', 'https://hylo.com')).toEqual('/groups/foo')
    expect(internalPathname('https://hylo.com/groups/foo', 'https://www.hylo.com')).toEqual('/groups/foo')
  })

  it('keeps query and hash on same-domain links', () => {
    expect(internalPathname('https://hylo.com/groups/foo?x=1#bar', 'https://hylo.com'))
      .toEqual('/groups/foo?x=1#bar')
  })

  it('does not treat a different hylo environment as internal', () => {
    expect(internalPathname('https://staging.hylo.com/groups/foo', 'https://hylo.com')).toBe(null)
    expect(internalPathname('https://hylo.com/groups/foo', 'https://staging.hylo.com')).toBe(null)
    expect(internalPathname('https://www.hylo.com/groups/foo', 'https://staging.hylo.com')).toBe(null)
  })
})
