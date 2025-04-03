import * as DateTimeHelpers from './DateTimeHelpers'
import { DateTime } from 'luxon'

describe('formatDatePair', () => {
    it('displays differences of dates', () => {
      const d1 = DateTime.fromMillis(1551908483315, {zone: 'Etc/GMT'}).set({month: 1, day: 1, hour: 18})
      const d2 = d1.set({hour: 21})
      const d3 = d2.set({day: 2})
      const d4 = d3.set({month: 2})
      const d5 = d4.set({year: 2050})
  
      expect(TextHelpers.formatDatePair(d1)).toMatchSnapshot()
      expect(TextHelpers.formatDatePair(d1, d2)).toMatchSnapshot()
      expect(TextHelpers.formatDatePair(d1, d3)).toMatchSnapshot()
      expect(TextHelpers.formatDatePair(d1, d4)).toMatchSnapshot()
      expect(TextHelpers.formatDatePair(d1, d5)).toMatchSnapshot()
    })
  
    it('can accept a custom timezone', () => {
      const d1 = DateTime.fromMillis(1551908483315, {zone: 'Etc/GMT'}).set({month: 1, day: 1, hour: 18})
      const d2 = d1.set({hour: 21})
      expect(TextHelpers.formatDatePair(d1, d2, false, 'America/New_York')).toMatchSnapshot()
    })
  })
  