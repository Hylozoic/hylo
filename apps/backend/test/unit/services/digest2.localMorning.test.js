/* eslint-disable no-unused-expressions */
// Digests in each member's local morning (D41): who is due in an hourly run, the window
// each digest covers, and the per-membership marker that stops repeats
import { DateTime } from 'luxon'
import {
  CATCH_UP_HOURS,
  SLOT_SETTING,
  isDue,
  isValidTimezone,
  latestSlot,
  savedSearchDigestTypesAt,
  windowFor
} from '../../../lib/group/digest2/localMorning'
import { getRecipients } from '../../../lib/group/digest2/util'
import { sendAllDigests } from '../../../lib/group/digest2'
import setup from '../../setup'
import factories from '../../setup/factories'
import { mockify, unspyify } from '../../setup/helpers'

const utc = iso => DateTime.fromISO(iso, { zone: 'utc' })
const HOUR = 60 * 60 * 1000

describe('digest2 local-morning schedule', () => {
  describe('slots and windows', () => {
    it('sends at 08:00 in the member timezone', () => {
      // 06:30 UTC is 08:30 in Berlin (summer time)
      const slot = latestSlot('daily', 'Europe/Berlin', utc('2026-09-29T06:30:00'))
      expect(slot.toUTC().toISO()).to.equal('2026-09-29T06:00:00.000Z')
      // Before 08:00 the latest slot is yesterday's
      expect(latestSlot('daily', 'Europe/Berlin', utc('2026-09-29T05:30:00')).toUTC().toISO()).to.equal('2026-09-28T06:00:00.000Z')
      // Half-hour zones go out at 08:00 local too
      expect(latestSlot('daily', 'Asia/Kolkata', utc('2026-09-29T03:00:00')).toUTC().toISO()).to.equal('2026-09-29T02:30:00.000Z')
    })

    it('keeps noon Pacific for members without a (usable) timezone', () => {
      const at = utc('2026-09-29T19:10:00') // 12:10 in Los Angeles
      expect(latestSlot('daily', null, at).toUTC().toISO()).to.equal('2026-09-29T19:00:00.000Z')
      expect(latestSlot('daily', 'Not/AZone', at).toUTC().toISO()).to.equal('2026-09-29T19:00:00.000Z')
      expect(isValidTimezone('Not/AZone')).to.be.false
      expect(isValidTimezone('America/Sao_Paulo')).to.be.true
    })

    it('sends weekly digests on the local Wednesday', () => {
      // 2026-09-29 is a Tuesday. At 23:30 UTC it is already Wednesday 08:30 in Tokyo,
      // but still Tuesday in Berlin, whose last weekly slot was the Wednesday before.
      const at = utc('2026-09-29T23:30:00')
      const tokyo = latestSlot('weekly', 'Asia/Tokyo', at)
      expect(tokyo.weekday).to.equal(3)
      expect(tokyo.toUTC().toISO()).to.equal('2026-09-29T23:00:00.000Z')
      const berlin = latestSlot('weekly', 'Europe/Berlin', at)
      expect(berlin.weekday).to.equal(3)
      expect(berlin.toUTC().toISO()).to.equal('2026-09-23T06:00:00.000Z')
    })

    it('covers the local day before the send, including across a daylight saving change', () => {
      // Clocks in New York go forward on 2026-03-08 at 02:00
      const before = latestSlot('daily', 'America/New_York', utc('2026-03-08T12:30:00'))
      expect(before.toUTC().toISO()).to.equal('2026-03-08T12:00:00.000Z')
      const [start, end] = windowFor('daily', before)
      expect(start.toUTC().toISO()).to.equal('2026-03-07T13:00:00.000Z')
      expect(end.toMillis() - start.toMillis()).to.equal(23 * HOUR)
      const next = latestSlot('daily', 'America/New_York', utc('2026-03-09T12:30:00'))
      expect(windowFor('daily', next)[0].toMillis()).to.equal(end.toMillis())

      const [weekStart, weekEnd] = windowFor('weekly', latestSlot('weekly', 'Europe/Berlin', utc('2026-10-28T07:00:00')))
      // Berlin leaves summer time on 2026-10-25: this week is an hour longer
      expect(weekEnd.toMillis() - weekStart.toMillis()).to.equal((7 * 24 + 1) * HOUR)
    })

    it('leaves no gap and no overlap across a month of hourly runs', () => {
      const zones = ['Europe/Berlin', 'America/New_York', 'Asia/Kolkata', 'Australia/Lord_Howe', null]
      for (const type of ['daily', 'weekly']) {
        for (const zone of zones) {
          let sentFor = null
          const windows = []
          // 2026-10-15 to 2026-11-15 spans the European and North American clock changes
          for (let at = utc('2026-10-15T00:05:00'); at < utc('2026-11-15T00:00:00'); at = at.plus({ hours: 1 })) {
            const slot = latestSlot(type, zone, at)
            if (isDue(type, slot, sentFor, at)) {
              windows.push(windowFor(type, slot))
              sentFor = slot.toUTC().toISO()
            }
          }
          expect(windows.length, `${type} ${zone}`).to.be.above(type === 'daily' ? 29 : 3)
          for (let i = 1; i < windows.length; i++) {
            expect(windows[i][0].toMillis(), `${type} ${zone} #${i}`).to.equal(windows[i - 1][1].toMillis())
          }
        }
      }
    })
  })

  describe('isDue', () => {
    const slot = utc('2026-09-29T06:00:00')

    it('is due only in the hour of the slot for someone never sent one under this schedule', () => {
      expect(isDue('daily', slot, null, slot.plus({ minutes: 5 }))).to.be.true
      expect(isDue('daily', slot, null, slot.plus({ minutes: 70 }))).to.be.false
      expect(isDue('daily', slot, null, slot.minus({ minutes: 5 }))).to.be.false
    })

    it('catches up a missed or failed hour, for a while', () => {
      const yesterday = slot.minus({ days: 1 }).toISO()
      expect(isDue('daily', slot, yesterday, slot.plus({ hours: 3 }))).to.be.true
      expect(isDue('daily', slot, yesterday, slot.plus({ hours: CATCH_UP_HOURS, minutes: 1 }))).to.be.false
    })

    it('never sends the same slot twice', () => {
      expect(isDue('daily', slot, slot.toISO(), slot.plus({ minutes: 5 }))).to.be.false
    })

    it('skips a day already covered after the member changed timezone', () => {
      // Sent at 08:00 Berlin; the member then set New York, whose 08:00 is 6 hours later
      const newYorkSlot = utc('2026-09-29T12:00:00')
      expect(isDue('daily', newYorkSlot, slot.toISO(), newYorkSlot.plus({ minutes: 5 }))).to.be.false
    })
  })

  describe('saving the timezone', () => {
    before(() => setup.clearDb())

    it('keeps an IANA timezone and drops anything else', async () => {
      const user = await factories.user().save()
      await user.validateAndSave(null, { settings: { timezone: 'Europe/Berlin' } })
      await user.refresh()
      expect(user.getSetting('timezone')).to.equal('Europe/Berlin')

      await user.validateAndSave(null, { settings: { timezone: 'Mars/Olympus_Mons', locale: 'de' } })
      await user.refresh()
      expect(user.getSetting('timezone')).to.equal('Europe/Berlin')
      expect(user.getSetting('locale')).to.equal('de')
    })
  })

  it('keeps saved-search digests at noon Pacific', () => {
    expect(savedSearchDigestTypesAt(utc('2026-09-29T19:05:00'))).to.deep.equal(['daily']) // Tuesday noon
    expect(savedSearchDigestTypesAt(utc('2026-09-30T19:05:00'))).to.deep.equal(['daily', 'weekly']) // Wednesday noon
    expect(savedSearchDigestTypesAt(utc('2026-09-30T06:05:00'))).to.deep.equal([])
  })

  describe('hourly runs', () => {
    let group, author, calls, previousEmailNotificationsEnabled
    // Wednesday 08:10 in Berlin
    const at = utc('2026-09-30T06:10:00')

    const member = async (timezone, attrs = {}, target = group, digestFrequency = 'daily') => {
      const settings = timezone ? { timezone } : {}
      const user = await factories.user({ settings: { ...settings, ...(attrs.settings || {}) }, last_active_at: at.minus({ days: 1 }).toJSDate() }).save()
      await target.addMembers([user.id], { settings: { sendEmail: true, digestFrequency } })
      return user
    }
    const post = async (target, createdAt) => {
      const p = await factories.post({ user_id: author.id, type: 'discussion', created_at: createdAt.toJSDate() }).save()
      await target.posts().attach(p)
      return p
    }
    const sentTo = user => calls.filter(call => call.address === user.get('email'))
    const markerOf = async (user, target = group, type = 'daily') => {
      const row = await bookshelf.knex('group_memberships').where({ user_id: user.id, group_id: target.id }).first('settings')
      return row.settings[SLOT_SETTING[type]] || null
    }

    beforeEach(async () => {
      await setup.clearDb()
      previousEmailNotificationsEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true'
      calls = []
      mockify(Email, 'sendSimpleEmail', (address, templateId, data, extraOptions) => {
        calls.push({ address, data, extraOptions })
        return Promise.resolve({ success: true })
      })
      group = await factories.group().save()
      author = await factories.user().save()
      await group.addMembers([author.id], { settings: { sendEmail: false, digestFrequency: 'never' } })
    })

    afterEach(() => {
      unspyify(Email, 'sendSimpleEmail')
      process.env.EMAIL_NOTIFICATIONS_ENABLED = previousEmailNotificationsEnabled
    })

    it('sends to members whose local morning it is, for the day before their send', async () => {
      const berlin = await member('Europe/Berlin')
      const newYork = await member('America/New_York')
      const noTimezone = await member(null)
      const inWindow = await post(group, at.minus({ hours: 3 }))
      await post(group, at.minus({ hours: 30 }))

      const recipients = await getRecipients(group.id, 'daily', { at: at.toJSDate(), timezones: new Map([['Europe/Berlin', latestSlot('daily', 'Europe/Berlin', at)]]) })
      expect(recipients.map(u => String(u.id))).to.deep.equal([String(berlin.id)])

      const result = await sendAllDigests('daily', { at: at.toJSDate() })
      expect(result).to.deep.equal([[group.id, 1]])
      expect(sentTo(berlin)).to.have.length(1)
      expect(sentTo(berlin)[0].data.discussions.map(d => String(d.id))).to.deep.equal([String(inWindow.id)])
      expect(sentTo(newYork)).to.have.length(0)
      expect(sentTo(noTimezone)).to.have.length(0)
      expect(await markerOf(berlin)).to.equal('2026-09-30T06:00:00.000Z')

      // The same hour again sends nothing more
      await sendAllDigests('daily', { at: at.plus({ minutes: 20 }).toJSDate() })
      expect(sentTo(berlin)).to.have.length(1)
    })

    it('keeps noon Pacific for members without a timezone', async () => {
      const noTimezone = await member(null)
      const noon = utc('2026-09-30T19:05:00')
      await post(group, noon.minus({ hours: 2 }))

      await sendAllDigests('daily', { at: noon.toJSDate() })
      expect(sentTo(noTimezone)).to.have.length(1)
      expect(await markerOf(noTimezone)).to.equal('2026-09-30T19:00:00.000Z')
    })

    it('tries again next hour after a failed send, and marks members with nothing to send', async () => {
      const berlin = await member('Europe/Berlin')
      const quietGroup = await factories.group().save()
      await quietGroup.addMembers([berlin.id], { settings: { sendEmail: true, digestFrequency: 'daily' } })
      await post(group, at.minus({ hours: 3 }))
      // Sent yesterday under this schedule, so a missed hour can be caught up
      await bookshelf.knex.raw('UPDATE group_memberships SET settings = settings || ?::jsonb WHERE user_id = ?',
        [JSON.stringify({ [SLOT_SETTING.daily]: '2026-09-29T06:00:00.000Z' }), berlin.id])

      mockify(Email, 'sendSimpleEmail', () => Promise.resolve(false))
      await sendAllDigests('daily', { at: at.toJSDate() })
      expect(await markerOf(berlin)).to.equal('2026-09-29T06:00:00.000Z')
      // The quiet group had nothing for them: done for today
      expect(await markerOf(berlin, quietGroup)).to.equal('2026-09-30T06:00:00.000Z')

      mockify(Email, 'sendSimpleEmail', (address, templateId, data, extraOptions) => {
        calls.push({ address, data, extraOptions })
        return Promise.resolve({ success: true })
      })
      await sendAllDigests('daily', { at: at.plus({ hours: 1 }).toJSDate() })
      expect(sentTo(berlin)).to.have.length(1)
      expect(await markerOf(berlin)).to.equal('2026-09-30T06:00:00.000Z')
    })

    it('sends the weekly digest on the local Wednesday, covering the week before', async () => {
      const berlin = await member('Europe/Berlin', {}, group, 'weekly')
      const tokyo = await member('Asia/Tokyo', {}, group, 'weekly')
      const thisWeek = await post(group, at.minus({ days: 5 }))
      await post(group, at.minus({ days: 8 }))

      await sendAllDigests('weekly', { at: at.toJSDate() })
      expect(sentTo(berlin)).to.have.length(1)
      expect(sentTo(berlin)[0].data.discussions.map(d => String(d.id))).to.deep.equal([String(thisWeek.id)])
      expect(sentTo(tokyo)).to.have.length(0)
      expect(await markerOf(berlin, group, 'weekly')).to.equal('2026-09-30T06:00:00.000Z')
    })

    it('sends one unified digest covering every group of a member who asked for one', async () => {
      const otherGroup = await factories.group().save()
      const unified = await member('Europe/Berlin', { settings: { unified_email_digest: true } })
      await otherGroup.addMembers([unified.id], { settings: { sendEmail: true, digestFrequency: 'daily' } })
      await post(group, at.minus({ hours: 3 }))
      await post(otherGroup, at.minus({ hours: 4 }))

      await sendAllDigests('daily', { at: at.toJSDate() })
      expect(sentTo(unified)).to.have.length(1)
      expect(sentTo(unified)[0].data.unified).to.equal(true)
      expect(sentTo(unified)[0].data.discussions).to.have.length(2)
      expect(await markerOf(unified, group)).to.equal('2026-09-30T06:00:00.000Z')
      expect(await markerOf(unified, otherGroup)).to.equal('2026-09-30T06:00:00.000Z')

      await sendAllDigests('daily', { at: at.plus({ minutes: 30 }).toJSDate() })
      expect(sentTo(unified)).to.have.length(1)
    })

    it('still sends to everyone when called without a run time', async () => {
      const berlin = await member('Europe/Berlin')
      const newYork = await member('America/New_York')
      await post(group, DateTime.now().minus({ hours: 6 }))
      const start = DateTime.now().minus({ days: 1 })
      await sendAllDigests('daily', { startTime: start, endTime: DateTime.now() })
      expect(sentTo(berlin)).to.have.length(1)
      expect(sentTo(newYork)).to.have.length(1)
    })
  })
})
