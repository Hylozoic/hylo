const { validateDemoSpec } = require('../../../../lib/demo/validate')
const { isDemoAddress } = require('../../../../lib/demo/addresses')
const river = require('../../../../demos/specs/river-city.json')
const hudson = require('../../../../demos/specs/hudson-valley.json')

describe('demo specs', () => {
  it('accepts the committed demos', () => {
    expect(validateDemoSpec(river)).to.deep.equal([])
    expect(validateDemoSpec(hudson)).to.deep.equal([])
  })

  it('rejects a post that names spaces as a string', () => {
    const broken = JSON.parse(JSON.stringify(river))
    broken.posts[0].spaces = broken.posts[0].spaces[0]
    const errors = validateDemoSpec(broken)
    expect(errors.some(error => error.includes('spaces must be an array'))).to.equal(true)
  })

  it('treats the demo domain as undeliverable', () => {
    expect(isDemoAddress('rosa@demo.invalid')).to.equal(true)
    expect(isDemoAddress('Rosa <rosa@demo.invalid>')).to.equal(true)
    expect(isDemoAddress('tibet@terran.io')).to.equal(false)
    expect(isDemoAddress('')).to.equal(false)
  })
})
