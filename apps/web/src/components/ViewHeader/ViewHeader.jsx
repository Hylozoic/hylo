import React from 'react'

const ViewHeader = ({
  title,
  children
}) => {
  return (
    <header className='flex flex-row justify-between z-10 px-4 bg-background shadow-[0_4px_15px_0px_rgba(0,0,0,0.1)]'>
      <h2 className='text-foreground'>{title}</h2>
      {children}
    </header>
  )
}

export default ViewHeader
