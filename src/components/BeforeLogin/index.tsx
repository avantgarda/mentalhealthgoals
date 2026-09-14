import React from 'react'
import { BRAND_DOMAIN } from '@/brand/tokens'

const BeforeLogin: React.FC = () => {
  return (
    <div>
      <p>
        <b>Mental Health Goals Programme</b>
        {` — sign in to manage the content of ${BRAND_DOMAIN}.`}
      </p>
    </div>
  )
}

export default BeforeLogin
