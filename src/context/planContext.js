import { createContext, useContext } from 'react'

export const PlanContext = createContext(null)

export function usePlanStatus() {
  const context = useContext(PlanContext)
  if (!context) {
    throw new Error('usePlanStatus debe usarse dentro de PlanProvider')
  }
  return context
}
