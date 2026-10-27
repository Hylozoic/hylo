/* globals bookshelf */
import prefixTsQuery from './prefixTsQuery'

describe('prefixTsQuery', () => {
  it('prefix-matches every word, ANDed together', () => {
    expect(prefixTsQuery('  al   bo ')).to.equal('al:* & bo:*')
  })

  it('returns an empty string when there are no usable words', () => {
    expect(prefixTsQuery()).to.equal('')
    expect(prefixTsQuery(' ')).to.equal('')
    expect(prefixTsQuery("<> ' !")).to.equal('')
    expect(prefixTsQuery("<> ' !", { splitWords: true })).to.equal('')
  })

  it('drops special characters from inside a word by default', () => {
    expect(prefixTsQuery("#release! o'brien a<b")).to.equal('release:* & obrien:* & ab:*')
  })

  it('splits words on special characters with splitWords', () => {
    expect(prefixTsQuery("#release! o'brien a<b", { splitWords: true }))
      .to.equal('release:* & o:* & brien:* & a:* & b:*')
  })

  it('keeps non-Latin letters and hyphens', () => {
    expect(prefixTsQuery('José Zoë 李 foo-bar', { splitWords: true }))
      .to.equal('José:* & Zoë:* & 李:* & foo-bar:*')
  })

  it('never produces a tsquery Postgres rejects', async () => {
    // Every printable ASCII punctuation character, alone, leading, trailing and inside a word
    const chars = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'.split('')
    const inputs = chars.flatMap(c => [c, `${c}a`, `a${c}`, `a${c}b`, `a ${c}${c} b`])
      .concat(['<->', 'a<->b', 'a<2>b', 'a<-', "''", "it's'"])
    for (const input of inputs) {
      for (const splitWords of [false, true]) {
        const query = prefixTsQuery(input, { splitWords })
        if (!query) continue
        for (const config of ['simple', 'english']) {
          await bookshelf.knex.raw('select to_tsquery(?::regconfig, ?)', [config, query])
            .catch(err => { throw new Error(`${JSON.stringify(input)} -> ${JSON.stringify(query)}: ${err.message}`) })
        }
      }
    }
  })
})
