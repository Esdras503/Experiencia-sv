import { useCallback, useEffect, useState } from 'react'

function readLocation() {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  }
}

export function useAppRoute() {
  const [location, setLocation] = useState(readLocation)

  useEffect(() => {
    const handlePopState = () => setLocation(readLocation())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((to, { replace = false } = {}) => {
    const url = new URL(to, window.location.href)
    const nextUrl = `${url.pathname}${url.search}${url.hash}`
    window.history[replace ? 'replaceState' : 'pushState']({}, '', nextUrl)
    setLocation(readLocation())
  }, [])

  return { ...location, navigate }
}
