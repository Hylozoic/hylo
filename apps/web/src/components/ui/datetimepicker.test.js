import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { DateTimePicker, NativeDateTimePicker, TimePicker } from './datetimepicker'

function mockPointer ({ coarse, anyFine }) {
  window.matchMedia.mockImplementation(query => ({
    matches: query === '(pointer: coarse)' ? coarse : query === '(any-pointer: fine)' ? anyFine : false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }))
}

describe('TimePicker typing', () => {
  const date = new Date(2026, 9, 21, 7, 0)

  it('applies digits from keydown (desktop / iOS keyboards)', () => {
    const onChange = jest.fn()
    render(<TimePicker date={date} onChange={onChange} hourCycle={24} granularity='minute' />)
    const hour = document.getElementById('datetime-picker-hour-input')
    fireEvent.keyDown(hour, { key: '3' })
    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 9, 21, 3, 0))
  })

  it('does not apply the same digit twice when keydown and input both fire', () => {
    const onChange = jest.fn()
    render(<TimePicker date={date} onChange={onChange} hourCycle={24} granularity='minute' />)
    const hour = document.getElementById('datetime-picker-hour-input')
    fireEvent.keyDown(hour, { key: '3' })
    fireEvent.input(hour, { target: { value: '073' }, data: '3' })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('applies digits that only arrive through the input event (Android soft keyboards)', () => {
    const onChange = jest.fn()
    render(<TimePicker date={date} onChange={onChange} hourCycle={24} granularity='minute' />)
    const hour = document.getElementById('datetime-picker-hour-input')
    fireEvent.keyDown(hour, { key: 'Unidentified', keyCode: 229 })
    fireEvent.input(hour, { target: { value: '075' } })
    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 9, 21, 5, 0))
  })

  it('ignores deletions and non-digits from the input event', () => {
    const onChange = jest.fn()
    render(<TimePicker date={date} onChange={onChange} hourCycle={24} granularity='minute' />)
    const hour = document.getElementById('datetime-picker-hour-input')
    fireEvent.input(hour, { target: { value: '0' } })
    fireEvent.input(hour, { target: { value: '07a' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps arrow-key behaviour and shows a Done key that calls onEnter', () => {
    const onChange = jest.fn()
    const onEnter = jest.fn()
    render(<TimePicker date={date} onChange={onChange} onEnter={onEnter} hourCycle={24} granularity='minute' />)
    const hour = document.getElementById('datetime-picker-hour-input')
    expect(hour).toHaveAttribute('enterkeyhint', 'done')
    fireEvent.keyDown(hour, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 9, 21, 8, 0))
    fireEvent.keyDown(hour, { key: 'Enter' })
    expect(onEnter).toHaveBeenCalledTimes(1)
  })
})

describe('NativeDateTimePicker', () => {
  it('shows the placeholder when empty and labels both inputs', () => {
    render(<NativeDateTimePicker placeholder='Select Start' label='Select Start' granularity='minute' />)
    expect(screen.getByText('Select Start')).toBeInTheDocument()
    expect(screen.getByTestId('native-date-input')).toHaveValue('')
    expect(screen.getByTestId('native-date-input')).toHaveAttribute('aria-label', 'Select Start, Date')
    expect(screen.getByTestId('native-time-input')).toHaveAttribute('aria-label', 'Select Start, Time')
    expect(screen.getByTestId('native-time-input')).toHaveAttribute('step', '60')
  })

  it('maps the wall-clock value to input values and back', () => {
    const onChange = jest.fn()
    render(<NativeDateTimePicker value={new Date(2026, 9, 21, 14, 30)} onChange={onChange} granularity='minute' />)
    expect(screen.getByTestId('native-date-input')).toHaveValue('2026-10-21')
    expect(screen.getByTestId('native-time-input')).toHaveValue('14:30')

    fireEvent.change(screen.getByTestId('native-date-input'), { target: { value: '2026-11-05' } })
    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 10, 5, 14, 30))

    fireEvent.change(screen.getByTestId('native-time-input'), { target: { value: '09:15' } })
    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 10, 5, 9, 15))
  })

  it('ignores a cleared input and keeps the value', () => {
    const onChange = jest.fn()
    render(<NativeDateTimePicker value={new Date(2026, 9, 21, 14, 30)} onChange={onChange} granularity='minute' />)
    fireEvent.change(screen.getByTestId('native-time-input'), { target: { value: '' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByTestId('native-time-input')).toHaveValue('14:30')
  })

  it('follows value prop changes and supports ref.setValue', () => {
    const ref = React.createRef()
    const { rerender } = render(<NativeDateTimePicker ref={ref} value={new Date(2026, 9, 21, 14, 30)} granularity='minute' />)
    rerender(<NativeDateTimePicker ref={ref} value={undefined} granularity='minute' />)
    expect(screen.getByTestId('native-date-input')).toHaveValue('')
    act(() => ref.current.setValue(new Date(2027, 0, 2, 3, 4)))
    expect(screen.getByTestId('native-date-input')).toHaveValue('2027-01-02')
    expect(screen.getByTestId('native-time-input')).toHaveValue('03:04')
    expect(ref.current.value).toEqual(new Date(2027, 0, 2, 3, 4))
  })
  it('shows the end adornment inside the time input box, with room kept for it', () => {
    render(<NativeDateTimePicker value={new Date(2026, 9, 21, 14, 30)} granularity='minute' endAdornment={<button type='button'>x</button>} />)
    const adornment = screen.getByTestId('datetime-picker-end-adornment')
    const timeBox = screen.getByTestId('native-time-input').parentElement
    expect(timeBox).toContainElement(adornment)
    expect(screen.getByTestId('native-time-input')).toHaveClass('pr-10')
    expect(screen.getByTestId('native-date-input').parentElement).not.toContainElement(adornment)
    expect(screen.getByTestId('native-date-input')).not.toHaveClass('pr-10')
  })

  it('puts the end adornment in the date input when there is no time input', () => {
    render(<NativeDateTimePicker value={new Date(2026, 9, 21)} granularity='day' endAdornment={<button type='button'>x</button>} />)
    expect(screen.getByTestId('native-date-input').parentElement).toContainElement(screen.getByTestId('datetime-picker-end-adornment'))
    expect(screen.getByTestId('native-date-input')).toHaveClass('pr-10')
  })

  it('reserves no room when there is no adornment', () => {
    render(<NativeDateTimePicker value={new Date(2026, 9, 21, 14, 30)} granularity='minute' endAdornment={false} />)
    expect(screen.queryByTestId('datetime-picker-end-adornment')).not.toBeInTheDocument()
    expect(screen.getByTestId('native-time-input')).not.toHaveClass('pr-10')
  })
})

describe('DateTimePicker', () => {
  const matchMediaImpl = window.matchMedia.getMockImplementation()
  afterEach(() => window.matchMedia.mockImplementation(matchMediaImpl))

  it('uses the popover picker with a mouse or trackpad', () => {
    mockPointer({ coarse: false, anyFine: true })
    render(<DateTimePicker placeholder='Select Start' granularity='minute' />)
    expect(screen.queryByTestId('native-datetime-picker')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Select Start/ })).toBeInTheDocument()
  })

  it('shows the end adornment inside the popover trigger\'s box, and clicking it does not open the popover', () => {
    mockPointer({ coarse: false, anyFine: true })
    const onAdornmentClick = jest.fn()
    render(
      <DateTimePicker
        placeholder='Select Start'
        granularity='minute'
        value={new Date(2026, 9, 21, 14, 30)}
        endAdornment={<button type='button' aria-label='Remove start time' onClick={onAdornmentClick}>x</button>}
      />
    )
    const adornment = screen.getByTestId('datetime-picker-end-adornment')
    const trigger = document.querySelector('[aria-haspopup="dialog"]')
    // Overlaid on the trigger (same wrapper), not nested in its <button>
    expect(trigger.parentElement).toContainElement(adornment)
    expect(trigger).not.toContainElement(adornment)
    expect(trigger).toHaveClass('pr-10')

    fireEvent.click(screen.getByRole('button', { name: 'Remove start time' }))
    expect(onAdornmentClick).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('uses the native pickers on touch-only devices', () => {
    mockPointer({ coarse: true, anyFine: false })
    render(<DateTimePicker placeholder='Select Start' granularity='minute' />)
    expect(screen.getByTestId('native-datetime-picker')).toBeInTheDocument()
  })
})
