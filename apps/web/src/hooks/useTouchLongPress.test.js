import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import useTouchLongPress from './useTouchLongPress'

function Pressable ({ onLongPress, onClick, onOuterTouchStart }) {
  const { handlers, consumeLongPress } = useTouchLongPress(onLongPress)
  return (
    <div onTouchStart={onOuterTouchStart}>
      <span
        data-testid='pressable'
        {...handlers}
        onClick={() => { if (!consumeLongPress()) onClick() }}
      >
        press me
      </span>
    </div>
  )
}

const touchAt = (x, y) => ({ touches: [{ pageX: x, pageY: y, clientX: x, clientY: y }] })

describe('useTouchLongPress', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  function setup () {
    const onLongPress = jest.fn()
    const onClick = jest.fn()
    const onOuterTouchStart = jest.fn()
    render(<Pressable onLongPress={onLongPress} onClick={onClick} onOuterTouchStart={onOuterTouchStart} />)
    return { onLongPress, onClick, onOuterTouchStart, el: screen.getByTestId('pressable') }
  }

  it('fires after 500ms of holding and swallows the click that follows', () => {
    const { onLongPress, onClick, el } = setup()
    fireEvent.touchStart(el, touchAt(10, 10))
    act(() => { jest.advanceTimersByTime(499) })
    expect(onLongPress).not.toHaveBeenCalled()
    act(() => { jest.advanceTimersByTime(1) })
    expect(onLongPress).toHaveBeenCalledTimes(1)

    const touchEnd = fireEvent.touchEnd(el)
    expect(touchEnd).toBe(false) // default prevented: no synthetic click
    fireEvent.click(el)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('leaves a normal tap alone', () => {
    const { onLongPress, onClick, el } = setup()
    fireEvent.touchStart(el, touchAt(10, 10))
    act(() => { jest.advanceTimersByTime(200) })
    expect(fireEvent.touchEnd(el)).toBe(true)
    fireEvent.click(el)
    act(() => { jest.advanceTimersByTime(1000) })
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('is cancelled by moving more than 10px so scrolling still works', () => {
    const { onLongPress, el } = setup()
    fireEvent.touchStart(el, touchAt(10, 10))
    fireEvent.touchMove(el, touchAt(10, 18))
    act(() => { jest.advanceTimersByTime(100) })
    fireEvent.touchMove(el, touchAt(10, 25))
    act(() => { jest.advanceTimersByTime(1000) })
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('is cancelled by touchcancel', () => {
    const { onLongPress, el } = setup()
    fireEvent.touchStart(el, touchAt(10, 10))
    fireEvent.touchCancel(el)
    act(() => { jest.advanceTimersByTime(1000) })
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('suppresses the context menu and keeps outer long presses from starting', () => {
    const { el, onOuterTouchStart } = setup()
    expect(fireEvent.contextMenu(el)).toBe(false)
    fireEvent.touchStart(el, touchAt(10, 10))
    expect(onOuterTouchStart).not.toHaveBeenCalled()
  })

  it('does nothing without a callback', () => {
    const onClick = jest.fn()
    const onOuterTouchStart = jest.fn()
    render(<Pressable onClick={onClick} onOuterTouchStart={onOuterTouchStart} />)
    const el = screen.getByTestId('pressable')
    fireEvent.touchStart(el, touchAt(10, 10))
    expect(onOuterTouchStart).toHaveBeenCalled()
    expect(fireEvent.contextMenu(el)).toBe(true)
    fireEvent.click(el)
    expect(onClick).toHaveBeenCalled()
  })
})
