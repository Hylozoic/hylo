import React from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from 'util/index'
import MenuLink from 'routes/AuthLayoutRouter/components/ContextMenu/MenuLink'

export default function ManagementContextMenu () {
  const location = useLocation()

  return (
    <div className='ContextMenu bg-background relative z-20 !overflow-y-auto isolate pointer-events-auto h-full w-[250px] sm:w-[300px]'>
      <div className='relative min-h-full'>
        <div className='absolute inset-0 bg-gradient-to-b from-context-menu-background to-theme-background/10 dark:to-theme-background/40 z-0 pointer-events-none' />
        <div className='ContextDetails w-full z-20 relative'>
          <div className='MyHomeHeader relative flex flex-col justify-end p-2 bg-cover h-[190px] shadow-md'>
            <div className='absolute top-0 left-0 w-full h-full bg-darkening z-0 opacity-100' />
            <div className='flex flex-col text-foreground drop-shadow-md overflow-hidden relative z-20'>
              <h2 className='text-white font-bold leading-3 text-lg drop-shadow-md'>Management</h2>
            </div>
          </div>
        </div>
        <div className='relative flex flex-col items-center overflow-hidden z-20'>
          <div className='w-full'>
            <ul className='m-0 p-3 mb-6'>
              <li>
                <div>
                  <h3 className='text-base font-light opacity-50 text-foreground mb-2'>STAGING</h3>
                  <ul className='p-0'>
                    <li>
                      <MenuLink
                        to='/management/staging/email-testers'
                        className={cn(
                          'text-base text-foreground border-2 border-transparent hover:border-foreground/50 hover:text-foreground rounded-md p-1 pl-2 hover:bg-card text-foreground mb-[.5rem] w-full block transition-all scale-100 hover:scale-102 opacity-85 hover:opacity-100',
                          { 'border-secondary': location.pathname === '/management/staging/email-testers' }
                        )}
                      >
                        Email Testers
                      </MenuLink>
                    </li>
                  </ul>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
