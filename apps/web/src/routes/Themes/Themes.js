import React from 'react'
import Button from 'components/ui/button'
import Checkbox from 'components/ui/checkbox'
import { Input } from 'components/ui/input'
import { Label } from 'components/ui/label'
import { RadioGroup, RadioGroupItem } from 'components/ui/radio-group'
import { Switch } from 'components/ui/switch'
import Toggle from 'components/ui/toggle'

// Component to display a color sample with label
function ColorSample ({ colorName, bgClass, textClass = 'text-foreground' }) {
  return (
    <div className={`${bgClass} ${textClass} p-3 rounded mb-2 border border-border`}>
      <div className='text-sm font-medium'>{colorName}</div>
      <div className='text-xs opacity-70'>{bgClass}</div>
    </div>
  )
}

// Component to display a button variant with label
function ButtonSample ({ variantName, variant }) {
  return (
    <div className='mb-3'>
      <div className='text-sm font-medium mb-2'>{variantName}</div>
      <Button variant={variant}>
        {variantName} Button
      </Button>
    </div>
  )
}

// Component for theme column
function ThemeColumn ({ title, isDark = false }) {
  const columnClass = isDark ? 'dark' : ''

  return (
    <div className={`flex-1 p-6 ${columnClass}`}>
      <div className='bg-background text-foreground min-h-screen p-4 rounded-lg border border-border'>
        <h2 className='text-xl font-bold mb-6 text-center'>{title}</h2>

        {/* Basic Colors */}
        <div className='mb-6'>
          <h3 className='text-lg font-semibold mb-3'>Basic Colors</h3>
          <ColorSample colorName='Background' bgClass='bg-background' />
          <ColorSample colorName='Midground' bgClass='bg-midground' />
          <ColorSample colorName='Foreground' bgClass='bg-foreground' textClass='text-background' />
          <ColorSample colorName='Black' bgClass='bg-darkening' textClass='text-background' />
        </div>

        {/* Interactive Colors */}
        <div className='mb-6'>
          <h3 className='text-lg font-semibold mb-3'>Interactive Colors</h3>
          <ColorSample colorName='Focus' bgClass='bg-focus' textClass='text-white' />
          <ColorSample colorName='Selected' bgClass='bg-selected' textClass='text-white' />
          <ColorSample colorName='Border' bgClass='bg-border' />
          <ColorSample colorName='Input' bgClass='bg-input' />
          <ColorSample colorName='Ring' bgClass='bg-ring' textClass='text-white' />
        </div>

        {/* Component Colors */}
        <div className='mb-6'>
          <h3 className='text-lg font-semibold mb-3'>Component Colors</h3>
          <ColorSample colorName='Card' bgClass='bg-card' textClass='text-card-foreground' />
          <ColorSample colorName='Popover' bgClass='bg-popover' textClass='text-popover-foreground' />
          <ColorSample colorName='Muted' bgClass='bg-muted' textClass='text-muted-foreground' />
        </div>

        {/* Semantic Colors */}
        <div className='mb-6'>
          <h3 className='text-lg font-semibold mb-3'>Semantic Colors</h3>
          <ColorSample colorName='Primary' bgClass='bg-primary' textClass='text-primary-foreground' />
          <ColorSample colorName='Secondary' bgClass='bg-secondary' textClass='text-secondary-foreground' />
          <ColorSample colorName='Accent' bgClass='bg-accent' textClass='text-accent-foreground' />
          <ColorSample colorName='Destructive' bgClass='bg-destructive' textClass='text-destructive-foreground' />
          <ColorSample colorName='Error' bgClass='bg-error' textClass='text-error-foreground' />
        </div>

        {/* Theme Colors */}
        <div className='mb-6'>
          <h3 className='text-lg font-semibold mb-3'>Theme Colors</h3>
          <ColorSample colorName='Theme Background' bgClass='bg-theme-background' textClass='text-theme-foreground' />
        </div>

        {/* Buttons */}
        <div className='mb-6'>
          <h3 className='text-lg font-semibold mb-3'>Buttons</h3>
          <ButtonSample variantName='Default' variant='default' />
          <ButtonSample variantName='Destructive' variant='destructive' />
          <ButtonSample variantName='Outline' variant='outline' />
          <ButtonSample variantName='Secondary' variant='secondary' />
          <ButtonSample variantName='Tertiary' variant='tertiary' />
          <ButtonSample variantName='Ghost' variant='ghost' />
          <ButtonSample variantName='Link' variant='link' />
        </div>

        {/* Form Controls */}
        <div className='mb-6'>
          <h3 className='text-lg font-semibold mb-3'>Form Controls</h3>
          <div className='space-y-4'>
            <div>
              <Label className='mb-2 block'>Input Field</Label>
              <Input placeholder='Type something...' />
            </div>

            <div className='flex items-center space-x-2'>
              <Checkbox id={`checkbox-${isDark ? 'dark' : 'light'}`} defaultChecked />
              <Label htmlFor={`checkbox-${isDark ? 'dark' : 'light'}`}>Checkbox</Label>
            </div>

            <div className='flex items-center space-x-2'>
              <Switch id={`switch-${isDark ? 'dark' : 'light'}`} defaultChecked />
              <Label htmlFor={`switch-${isDark ? 'dark' : 'light'}`}>Switch</Label>
            </div>

            <div>
              <Label className='mb-2 block'>Radio Group</Label>
              <RadioGroup defaultValue='option1'>
                <div className='flex items-center space-x-2'>
                  <RadioGroupItem value='option1' id={`radio1-${isDark ? 'dark' : 'light'}`} />
                  <Label htmlFor={`radio1-${isDark ? 'dark' : 'light'}`}>Option 1</Label>
                </div>
                <div className='flex items-center space-x-2'>
                  <RadioGroupItem value='option2' id={`radio2-${isDark ? 'dark' : 'light'}`} />
                  <Label htmlFor={`radio2-${isDark ? 'dark' : 'light'}`}>Option 2</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className='mb-2 block'>Toggle Buttons</Label>
              <div className='flex gap-2'>
                <Toggle variant='default' defaultPressed>Default</Toggle>
                <Toggle variant='outline'>Outline</Toggle>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Themes () {
  return (
    <div className='flex flex-col lg:flex-row min-h-screen bg-background'>
      <ThemeColumn title='Light Mode' />
      <ThemeColumn title='Dark Mode' isDark />
    </div>
  )
}
