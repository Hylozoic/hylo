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
          <ColorSample colorName='Black' bgClass='bg-black' textClass='text-background' />
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

        {/* Mobile Color Migration Guide */}
        {!isDark && ( <div className='mb-6'>
          <h3 className='text-lg font-semibold mb-3'>Mobile Color Migration</h3>
          <p className='text-sm text-muted-foreground mb-3'>
            Colors currently used in mobile app → Suggested theme replacements
          </p>

          <div className='space-y-3'>
            {/* High Priority - Most Used */}
            <div className='p-3 bg-destructive/10 rounded border border-destructive/20'>
              <div className='text-xs font-medium text-destructive mb-2'>🔥 High Priority (20+ files)</div>
              <div className='grid grid-cols-2 gap-3 text-xs'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#F4F4F2] border border-border' title='#F4F4F2' />
                  <span>twBackground</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-background border border-border' title='background' />
                  <span>→ background</span>
                </div>
              </div>
            </div>

            {/* Rhino Variants - Very Common */}
            <div className='p-3 bg-accent/10 rounded border border-accent/20'>
              <div className='text-xs font-medium text-accent mb-2'>🦏 Rhino Variants (15+ files)</div>
              <div className='grid grid-cols-2 gap-2 text-xs'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#2C4059] border border-border' title='#2C4059' />
                  <span>rhino</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-foreground border border-border' title='foreground' />
                  <span>→ foreground</span>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-2 text-xs mt-2'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#1A2435] border border-border' title='rhino80' />
                  <span>rhino80</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-foreground border border-border' title='foreground' />
                  <span>→ foreground</span>
                </div>
              </div>
              <div className='text-xs text-muted-foreground mt-2'>
                rhino05-60 → muted variants, rhino10-40 → background variants
              </div>
            </div>

            {/* Caribbean Green Family */}
            <div className='p-3 bg-accent/10 rounded border border-accent/20'>
              <div className='text-xs font-medium text-accent mb-2'>🌿 Caribbean Green (10+ files)</div>
              <div className='grid grid-cols-2 gap-2 text-xs'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#0DC39F] border border-border' title='#0DC39F' />
                  <span>caribbeanGreen</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-selected border border-border' title='selected' />
                  <span>→ selected</span>
                </div>
              </div>
              <div className='text-xs text-muted-foreground mt-2'>
                white*onCaribbeanGreen → accent variants, black10OnCaribbeanGreen → accent/10
              </div>
            </div>

            {/* Cape Cod Variants */}
            <div className='p-3 bg-muted/10 rounded border border-muted/20'>
              <div className='text-xs font-medium text-muted-foreground mb-2'>🏗️ Cape Cod Variants (8+ files)</div>
              <div className='grid grid-cols-2 gap-2 text-xs'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#363D3C] border border-border' title='#363D3C' />
                  <span>capeCod</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-foreground border border-border' title='foreground' />
                  <span>→ foreground</span>
                </div>
              </div>
              <div className='text-xs text-muted-foreground mt-2'>
                capeCod05-40 → muted/background variants
              </div>
            </div>

            {/* Athens Gray Family */}
            <div className='p-3 bg-muted/10 rounded border border-muted/20'>
              <div className='text-xs font-medium text-muted-foreground mb-2'>⚪ Athens Gray (6+ files)</div>
              <div className='grid grid-cols-2 gap-2 text-xs'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#FAFBFC] border border-border' title='#FAFBFC' />
                  <span>athensGray</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-muted border border-border' title='muted' />
                  <span>→ muted</span>
                </div>
              </div>
              <div className='text-xs text-muted-foreground mt-2'>
                athensGrayDark/Medium → muted variants
              </div>
            </div>

            {/* Error/Destructive Colors */}
            <div className='p-3 bg-destructive/10 rounded border border-destructive/20'>
              <div className='text-xs font-medium text-destructive mb-2'>⚠️ Error Colors (6+ files)</div>
              <div className='grid grid-cols-2 gap-2 text-xs'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#EE4266] border border-border' title='#EE4266' />
                  <span>amaranth</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-destructive border border-border' title='destructive' />
                  <span>→ destructive</span>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-2 text-xs mt-2'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#FE6848] border border-border' title='#FE6848' />
                  <span>persimmon</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-accent border border-border' title='accent' />
                  <span>→ accent</span>
                </div>
              </div>
            </div>

            {/* Navigation Colors */}
            <div className='p-3 bg-primary/10 rounded border border-primary/20'>
              <div className='text-xs font-medium text-primary mb-2'>🧭 Navigation Colors (5+ files)</div>
              <div className='grid grid-cols-2 gap-2 text-xs'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#818A88] border border-border' title='#818A88' />
                  <span>gunsmoke</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-muted-foreground border border-border' title='muted-foreground' />
                  <span>→ muted-foreground</span>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-2 text-xs mt-2'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#DCDCDC] border border-border' title='#DCDCDC' />
                  <span>gainsboro</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-primary border border-border' title='primary' />
                  <span>→ primary</span>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-2 text-xs mt-2'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#0DC39F] border border-border' title='#0DC39F' />
                  <span>black10OnCaribbeanGreen</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-selected border border-border' title='selected' />
                  <span>→ selected</span>
                </div>
              </div>
            </div>

            {/* Quick Reference */}
            <div className='p-3 bg-border/10 rounded border border-border'>
              <div className='text-xs font-medium mb-2'>📋 Quick Reference</div>
              <div className='grid grid-cols-2 gap-3 text-xs'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#FFFFFF] border border-border' title='#FFFFFF' />
                  <span>white</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-muted border border-border' title='muted' />
                  <span>→ muted</span>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-3 text-xs mt-2'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#000000] border border-border' title='#000000' />
                  <span>black</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-black border border-border' title='black' />
                  <span>→ black</span>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-3 text-xs mt-2'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#CCD1D7] border border-border' title='#CCD1D7' />
                  <span>ghost</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-muted border border-border' title='muted' />
                  <span>→ muted</span>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-3 text-xs mt-2'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#F8F8F8] border border-border' title='#F8F8F8' />
                  <span>alabaster</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-background border border-border' title='background' />
                  <span>→ background</span>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-3 text-xs mt-2'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#FF9D21] border border-border' title='#FF9D21' />
                  <span>treePoppy</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-accent border border-border' title='accent' />
                  <span>→ accent</span>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-3 text-xs mt-2'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#FDD549] border border-border' title='#FDD549' />
                  <span>mangoYellow</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-accent border border-border' title='accent' />
                  <span>→ accent</span>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-3 text-xs mt-2'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#41A1DC] border border-border' title='#41A1DC' />
                  <span>havelockBlue</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-secondary border border-border' title='secondary' />
                  <span>→ secondary</span>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-3 text-xs mt-2'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#40A1DD] border border-border' title='#40A1DD' />
                  <span>pictonBlue</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-secondary border border-border' title='secondary' />
                  <span>→ secondary</span>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-3 text-xs mt-2'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#9883E5] border border-border' title='#9883E5' />
                  <span>mediumPurple</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-secondary border border-border' title='secondary' />
                  <span>→ secondary</span>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-3 text-xs mt-2'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#664BA5] border border-border' title='#664BA5' />
                  <span>butterflyBush</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-secondary border border-border' title='secondary' />
                  <span>→ secondary</span>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-3 text-xs mt-2'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#8490a1] border border-border' title='#8490a1' />
                  <span>slateGrey80</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-muted-foreground border border-border' title='muted-foreground' />
                  <span>→ muted-foreground</span>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-3 text-xs mt-2'>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-[#808C9B] border border-border' title='#808C9B' />
                  <span>regent</span>
                </div>
                <div className='flex items-center space-x-2'>
                  <div className='w-6 h-6 rounded bg-muted-foreground border border-border' title='muted-foreground' />
                  <span>→ muted-foreground</span>
                </div>
              </div>
            </div>
          </div>
        </div>)}
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
