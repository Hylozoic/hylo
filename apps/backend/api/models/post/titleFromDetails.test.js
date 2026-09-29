/* eslint-disable no-unused-expressions */
import titleFromDetails, { needsTitleFallback } from './titleFromDetails'

describe('titleFromDetails', () => {
  it('uses short text as it is, without markup', () => {
    expect(titleFromDetails('<p>Hello <strong>everyone</strong></p>')).to.equal('Hello everyone')
  })

  it('is empty when the text is only blank lines', () => {
    expect(titleFromDetails('<p></p><p>   </p>')).to.equal('')
  })

  it('cuts long text at a word and ends it with an ellipsis', () => {
    const title = titleFromDetails(`<p>${'word '.repeat(40)}</p>`)
    expect(title.length).to.be.at.most(80)
    expect(title.endsWith('word…')).to.be.true
  })

  it('never ends halfway through an emoji', () => {
    const title = titleFromDetails(`<p>${'a'.repeat(78)}🌱🌱 and more</p>`)
    expect(title.length).to.be.at.most(80)
    expect(title).to.equal(`${'a'.repeat(78)}…`)
    expect(/[\uD800-\uDBFF]…$/.test(title)).to.be.false
  })
})

describe('needsTitleFallback', () => {
  it('is true only for a discussion given an empty title', () => {
    expect(needsTitleFallback('discussion', '  ')).to.be.true
    expect(needsTitleFallback('discussion', 'Hello')).to.be.false
    expect(needsTitleFallback('discussion', undefined)).to.be.false
    expect(needsTitleFallback('request', '')).to.be.false
  })
})
