import { useContext } from 'react'
import { ThemeContext } from '@/features/theme/ThemeContext'

export function useTheme() {
  return useContext(ThemeContext)
}
