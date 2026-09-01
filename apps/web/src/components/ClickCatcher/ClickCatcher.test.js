import { handleClick } from './ClickCatcher'

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
})
