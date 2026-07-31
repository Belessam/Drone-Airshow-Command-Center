import { useContext } from 'react'
import { AuthContext } from '@/features/auth/AuthContext'

export function useSites() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useSites must be used within an AuthProvider')
  }
  return {
    sites: context.sites,
    userSite: context.userSite,
  }
}
