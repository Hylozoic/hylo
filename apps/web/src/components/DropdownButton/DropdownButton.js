/**
 * DropdownButton Component
 *
 * A reusable dropdown button component that displays a list of selectable options.
 * The component supports custom styling based on the label, positioning options,
 * and callback functions for handling selection.
 */
import { cn } from 'util/index'
import React, { Component } from 'react'
import classes from './DropdownButton.module.scss'

export default class DropdownButton extends Component {
  /**
   * Component state
   * @property {boolean} expanded - Whether the dropdown menu is currently expanded
   * @property {any} selectedValue - The currently selected value (if not controlled by parent)
   */
  state = {
    expanded: false,
    selectedValue: this.props.value || null
  }

  /**
   * Toggles the expanded state of the dropdown menu
   */
  toggleExpanded = () => {
    const { expanded } = this.state
    this.setState({
      expanded: !expanded
    })
  }

  /**
   * Handles the selection of an option from the dropdown
   * @param {any} value - The value of the selected option
   * @param {string} label - The display label of the selected option
   */
  onChoose = (value, label) => {
    const { onChoose } = this.props
    this.setState({
      expanded: false,
      selectedValue: value
    })
    if (onChoose) {
      onChoose(value)
    }
  }

  /**
   * Renders the dropdown button and its options
   * @returns {JSX.Element} The rendered component
   */
  render () {
    const { label, className, choices, position } = this.props
    const { expanded } = this.state

    return (
      <div className='relative z-20'>
        {/* Main button that toggles the dropdown */}
        <div
          role='button'
          className={cn(
            'flex flex-col relative transition-all border-2 rounded-md bg-background text-foreground text-foreground hover:text-foreground p-1 px-2',
            {
              'border-selected/100 text-selected': label === 'Going',
              'border-accent/20 text-accent': label === 'Not Going',
              'border-focus/20 text-focus': label === 'Interested',
              'border-foreground/20': label !== 'Going' && label !== 'Not Going' && label !== 'Interested'
            },
            className
          )}
          onClick={this.toggleExpanded}
          data-position={position}
        >
          {label}&nbsp;&nbsp;|&nbsp;&nbsp;▾
        </div>

        {/* Dropdown menu containing the choices */}
        <div
          className={cn(
            'flex-col hidden gap-2 w-max absolute top-10 shadow-lg bg-background text-foreground text-foreground hover:text-foreground p-1 px-2',
            {
              'flex scale-100': expanded,
              [classes.top]: position === 'top'
            }
          )}
          data-testid='dropdown-button-choices'
        >
          {choices.map(({ label, value }) => (
            <span
              className={cn(
                'flex rounded-lg relative transition-all border-2 rounded-md bg-background text-foreground text-foreground hover:text-foreground p-1 px-2 cursor-pointer',
                {
                  'border-selected/100 text-selected': label === 'Going',
                  'border-accent/20 text-accent': label === 'Not Going',
                  'border-focus/20 text-focus': label === 'Interested',
                  'border-foreground/20': label !== 'Going' && label !== 'Not Going' && label !== 'Interested'
                }
              )}
              key={value}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                this.onChoose(value, label)
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    )
  }
}

/**
 * Props documentation:
 * @property {string} label - The display text for the dropdown button
 * @property {Array<{label: string, value: any}>} choices - Array of options for the dropdown
 * @property {string} [className] - Additional CSS classes to apply to the button
 * @property {string} [position='bottom'] - Position of the dropdown ('top' or 'bottom')
 * @property {Function} [onChoose] - Callback function called when an option is selected
 * @property {any} [value] - The currently selected value (for controlled components)
 */
