/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import {
  EXPERIMENTS,
  FIRST_POST_NUDGE,
  LIFECYCLE_EMAILS_HOLDOUT,
  REACTION_NOTICES,
  TABLE,
  assign,
  bucketOf,
  isInVariant,
  storedVariant,
  variantByHash
} from '../../../lib/experiments'

const rowsFor = (experiment, subjectId) =>
  bookshelf.knex(TABLE).where({ experiment: experiment.name, subject_id: subjectId })

describe('experiments', () => {
  describe('registered experiments', () => {
    it('registers the lifecycle holdout, reaction notices and first-post nudge', () => {
      expect(EXPERIMENTS).to.deep.equal([LIFECYCLE_EMAILS_HOLDOUT, REACTION_NOTICES, FIRST_POST_NUDGE])
    })

    it('gives every experiment a unique name and percentages that add up to 100', () => {
      const names = EXPERIMENTS.map(e => e.name)
      expect(new Set(names).size).to.equal(names.length)
      for (const experiment of EXPERIMENTS) {
        const total = experiment.variants.reduce((sum, v) => sum + v.percent, 0)
        expect(total, experiment.name).to.equal(100)
      }
    })
  })

  describe('hashing', () => {
    it('gives the same subject the same bucket and variant every time', () => {
      for (const id of [1, 42, 99999]) {
        expect(bucketOf(REACTION_NOTICES, id)).to.equal(bucketOf(REACTION_NOTICES, id))
        expect(variantByHash(REACTION_NOTICES, id)).to.equal(variantByHash(REACTION_NOTICES, id))
      }
    })

    it('buckets the same subject independently in different experiments', () => {
      const differs = Array.from({ length: 200 }, (_, i) => i + 1)
        .some(id => bucketOf(REACTION_NOTICES, id) !== bucketOf(FIRST_POST_NUDGE, id))
      expect(differs).to.equal(true)
    })

    it('splits a synthetic population close to the configured percentages', () => {
      const population = 20000
      const counts = {}
      for (let id = 1; id <= population; id++) {
        const variant = variantByHash(LIFECYCLE_EMAILS_HOLDOUT, id)
        counts[variant] = (counts[variant] || 0) + 1
      }
      const holdoutShare = counts.holdout / population
      expect(holdoutShare).to.be.within(0.09, 0.11)

      const halves = {}
      for (let id = 1; id <= population; id++) {
        const variant = variantByHash(REACTION_NOTICES, id)
        halves[variant] = (halves[variant] || 0) + 1
      }
      expect(halves.notices / population).to.be.within(0.48, 0.52)
    })
  })

  describe('assign', () => {
    before(() => setup.clearDb())

    it('records the first assignment once', async () => {
      const first = await assign(REACTION_NOTICES, 101)
      const second = await assign(REACTION_NOTICES, 101)
      expect(second).to.equal(first)
      expect(first).to.equal(variantByHash(REACTION_NOTICES, 101))
      const rows = await rowsFor(REACTION_NOTICES, 101)
      expect(rows).to.have.length(1)
      expect(rows[0].subject_type).to.equal('user')
      expect(rows[0].assigned_at).to.be.an.instanceof(Date)
    })

    it('keeps one row when first calls race', async () => {
      const variants = await Promise.all(Array.from({ length: 6 }, () => assign(FIRST_POST_NUDGE, 202)))
      expect(new Set(variants).size).to.equal(1)
      expect(await rowsFor(FIRST_POST_NUDGE, 202)).to.have.length(1)
    })

    it('keeps the stored variant when the percentages change later', async () => {
      const original = await assign(LIFECYCLE_EMAILS_HOLDOUT, 303)
      const flipped = {
        ...LIFECYCLE_EMAILS_HOLDOUT,
        variants: original === 'holdout'
          ? [{ name: 'emails', percent: 100 }, { name: 'holdout', percent: 0 }]
          : [{ name: 'holdout', percent: 100 }, { name: 'emails', percent: 0 }]
      }
      expect(await assign(flipped, 303)).to.equal(original)
    })

    it('reports no stored variant before assignment', async () => {
      expect(await storedVariant(REACTION_NOTICES, 404)).to.equal(null)
    })

    it('answers whether a subject is in a variant', async () => {
      const variant = await assign(REACTION_NOTICES, 505)
      expect(await isInVariant(REACTION_NOTICES, 505, variant)).to.equal(true)
      const other = variant === 'notices' ? 'control' : 'notices'
      expect(await isInVariant(REACTION_NOTICES, 505, other)).to.equal(false)
    })

    it('refuses a missing subject', async () => {
      await expect(assign(REACTION_NOTICES, null)).to.be.rejectedWith(/subject id/)
    })
  })
})
