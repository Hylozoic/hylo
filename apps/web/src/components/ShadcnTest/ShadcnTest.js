import React from 'react'
import { Button } from '../ui/button'

function ShadcnTest ({ yay = false }) {
  console.log('yay', yay)
  return (
    <div>
      <Button className={yay ? 'text-emerald-500 bg-emerald-500 font-bold' : ''}>Click me</Button>
    </div>
  )
}

export default ShadcnTest
