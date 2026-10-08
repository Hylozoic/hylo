import React from 'react'
import ItemSelectorModal from 'components/ItemSelectorModal'

export const PeopleListModal = React.forwardRef((forwardedProps, ref) => {
  return (
    <ItemSelectorModal
      search={false}
      {...forwardedProps}
      ref={ref}
    />
  )
})

export default PeopleListModal
