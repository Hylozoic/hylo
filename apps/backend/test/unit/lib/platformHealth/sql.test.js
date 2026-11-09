/* eslint-env mocha */
const { expect } = require('chai')
const { normalizeAsOf, renderSql, InvalidAsOfError, EARLIEST_AS_OF } = require('../../../../lib/platformHealth/sql')

describe('platformHealth/sql', () => {
  const now = new Date('2026-03-28T12:00:00.000Z')

  describe('normalizeAsOf', () => {
    it('defaults to now for empty input', () => {
      expect(normalizeAsOf(undefined, now)).to.equal(now.toISOString())
      expect(normalizeAsOf(null, now)).to.equal(now.toISOString())
      expect(normalizeAsOf('', now)).to.equal(now.toISOString())
    })

    it('defaults to the real current time when no now is given', () => {
      const before = Date.now()
      const result = normalizeAsOf()
      expect(new Date(result).getTime()).to.be.within(before, Date.now())
    })

    it('accepts a date-only string as midnight UTC', () => {
      expect(normalizeAsOf('2026-03-27', now)).to.equal('2026-03-27T00:00:00.000Z')
    })

    it('accepts date-time strings with and without seconds and millis', () => {
      expect(normalizeAsOf('2026-03-27T10:15Z', now)).to.equal('2026-03-27T10:15:00.000Z')
      expect(normalizeAsOf('2026-03-27T10:15:30Z', now)).to.equal('2026-03-27T10:15:30.000Z')
      expect(normalizeAsOf('2026-03-27T10:15:30.5Z', now)).to.equal('2026-03-27T10:15:30.500Z')
    })

    it('accepts a leap day in a leap year', () => {
      expect(normalizeAsOf('2024-02-29', now)).to.equal('2024-02-29T00:00:00.000Z')
    })

    it('accepts the earliest allowed moment', () => {
      expect(normalizeAsOf(EARLIEST_AS_OF, now)).to.equal(EARLIEST_AS_OF)
    })

    const junk = [
      'yesterday',
      '2026-3-27',
      '2026/03/27',
      '2026-03-27T10:15:30',
      '2026-03-27T10:15:30+02:00',
      ' 2026-03-27',
      "2026-01-01'; drop table users;--",
      "2026-01-01T00:00Z'::timestamptz); delete from users; --",
      '2026-13-45',
      '2026-02-30T25:61Z',
      '2026-02-31',
      '2026-02-29',
      '2025-04-31T00:00Z',
      '2026-01-01T24:00Z'
    ]
    junk.forEach(input => {
      it(`rejects ${JSON.stringify(input)}`, () => {
        expect(() => normalizeAsOf(input, now)).to.throw(InvalidAsOfError)
      })
    })

    it('rejects non-string input', () => {
      expect(() => normalizeAsOf(20260327, now)).to.throw(InvalidAsOfError)
      expect(() => normalizeAsOf(new Date('2026-03-27'), now)).to.throw(InvalidAsOfError)
      expect(() => normalizeAsOf(['2026-03-27'], now)).to.throw(InvalidAsOfError)
    })

    it('rejects dates in the future', () => {
      expect(() => normalizeAsOf('2026-03-29', now)).to.throw(InvalidAsOfError, /future/)
      expect(() => normalizeAsOf('2026-03-28T12:05Z', now)).to.throw(InvalidAsOfError, /future/)
    })

    it('tolerates up to a minute of clock skew', () => {
      expect(normalizeAsOf('2026-03-28T12:00:30Z', now)).to.equal('2026-03-28T12:00:30.000Z')
    })

    it('rejects dates that are too early', () => {
      expect(() => normalizeAsOf('2013-12-31', now)).to.throw(InvalidAsOfError, /too early/)
    })

    it('throws errors named InvalidAsOfError', () => {
      try {
        normalizeAsOf('nope', now)
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).to.be.an.instanceof(InvalidAsOfError)
        expect(err).to.be.an.instanceof(Error)
        expect(err.name).to.equal('InvalidAsOfError')
      }
    })
  })

  describe('renderSql', () => {
    const iso = '2026-03-27T00:00:00.000Z'
    const literal = `('${iso}'::timestamptz)`

    it('replaces every :asOf with a timestamptz literal', () => {
      const sql = 'select * from posts where created_at < :asOf and created_at >= :asOf - interval \'7 days\''
      const rendered = renderSql(sql, iso)
      expect(rendered).to.equal(`select * from posts where created_at < ${literal} and created_at >= ${literal} - interval '7 days'`)
      expect(rendered).not.to.contain(':asOf')
    })

    it('replaces :asOf followed by punctuation', () => {
      expect(renderSql('date_trunc(\'week\', :asOf)', iso)).to.equal(`date_trunc('week', ${literal})`)
      expect(renderSql(':asOf::date', iso)).to.equal(`${literal}::date`)
    })

    it('leaves SQL without placeholders unchanged', () => {
      expect(renderSql('select 1', iso)).to.equal('select 1')
    })

    it('escapes ? so knex does not treat it as a binding', () => {
      expect(renderSql('select settings ? \'foo\' from groups', iso)).to.equal('select settings \\? \'foo\' from groups')
      expect(renderSql('select a ?| b, c ?& d', iso)).to.equal('select a \\?| b, c \\?& d')
    })

    it('does not double-escape an already escaped ?', () => {
      expect(renderSql('select settings \\? \'foo\', x ? \'bar\' from groups', iso))
        .to.equal('select settings \\? \'foo\', x \\? \'bar\' from groups')
    })

    it('rejects non-canonical ISO input', () => {
      expect(() => renderSql('select :asOf', '2026-03-27')).to.throw(/canonical ISO/)
      expect(() => renderSql('select :asOf', '2026-03-27T00:00:00Z')).to.throw(/canonical ISO/)
      expect(() => renderSql('select :asOf', "2026-03-27T00:00:00.000Z'; drop table users;--")).to.throw(/canonical ISO/)
      expect(() => renderSql('select :asOf', undefined)).to.throw(/canonical ISO/)
    })

    it('rejects leftover :as_of or differently-cased placeholders', () => {
      expect(() => renderSql('select :as_of', iso)).to.throw(/Unrecognized as-of placeholder/)
      expect(() => renderSql('select :asof', iso)).to.throw(/Unrecognized as-of placeholder/)
      expect(() => renderSql('select :AS_OF, :asOf', iso)).to.throw(/Unrecognized as-of placeholder/)
    })
  })
})
