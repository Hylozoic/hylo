import { noncircular, didPropsChange } from './index'

describe('noncircular', () => {
  it('works as expected', () => {
    const foo = { ok: 'yay' }
    const bar = { z: { x: foo } }
    foo.wow = bar

    expect(noncircular(foo)).toMatchSnapshot()
  })
})

describe('didPropsChange', () => {
  it('return true for different props', () => {
    const props = {
      a: 1,
      b: 3
    }
    const nextProps = {
      a: 1,
      b: 2
    }

    expect(didPropsChange(props, nextProps)).toBeTruthy()
  })

  it('returns false for same props', () => {
    const obj = { id: 4 }
    const props = {
      a: 1,
      b: 2,
      c: obj
    }
    const nextProps = {
      a: 1,
      b: 2,
      c: obj
    }

    expect(didPropsChange(props, nextProps)).toBeFalsy()
  })

  it('returns true for same props different object reference', () => {
    const obj = { id: 4 }
    const obj2 = { id: 4 }
    const props = {
      a: 1,
      b: 2,
      c: obj
    }
    const nextProps = {
      a: 1,
      b: 2,
      c: obj2
    }

    expect(didPropsChange(props, nextProps)).toBeTruthy()
  })

  it('return false for same object', () => {
    const props = {
      a: 1,
      b: 3
    }
    const nextProps = props

    expect(didPropsChange(props, nextProps)).toBeFalsy()
  })

  it('return true for same props but different keys', () => {
    const props = {
      a: 1,
      b: 2
    }
    const nextProps = {
      a: 1,
      b: 2,
      c: 3
    }

    expect(didPropsChange(props, nextProps)).toBeTruthy()
  })

  it('return true for same props but different keys (inverse)', () => {
    const props = {
      a: 1,
      b: 2,
      c: 3
    }
    const nextProps = {
      a: 1,
      b: 2
    }

    expect(didPropsChange(props, nextProps)).toBeTruthy()
  })
})
