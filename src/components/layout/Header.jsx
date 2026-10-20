import { useEffect, useState } from 'react'
import { useAuth } from '../../context/authContext.js'

const sections = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'categorias', label: 'Categorías' },
  { id: 'destinos', label: 'Destinos' },
]

function useActiveSection(enabled) {
  const [activeSection, setActiveSection] = useState('inicio')

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    const sectionElements = sections
      .map((section) => document.getElementById(section.id))
      .filter(Boolean)

    if (sectionElements.length === 0 || !('IntersectionObserver' in window)) {
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        if (visibleEntries[0]) {
          setActiveSection(visibleEntries[0].target.id)
        }
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: [0.1, 0.35, 0.6] },
    )

    sectionElements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [enabled])

  return activeSection
}

export default function Header({ pathname, onNavigateSection, onNavigateHome }) {
  const { user, configured } = useAuth()
  const isHome = pathname === '/'
  const activeSection = useActiveSection(isHome)

  const getSectionHref = (sectionId) => (isHome ? `#${sectionId}` : `/#${sectionId}`)

  const handleSectionClick = (event, sectionId) => {
    if (isHome) return
    event.preventDefault()
    onNavigateSection(sectionId)
  }

  const handleBrandClick = (event) => {
    if (isHome) return
    event.preventDefault()
    onNavigateHome()
  }

  return (
    <header className="header">
      <a className="brand" href={isHome ? '#inicio' : '/'} onClick={handleBrandClick}>
        <span className="brand-icon" aria-hidden="true">
          ✳
        </span>
        <span>
          Experiencia<span className="brand-highlight">SV</span>
        </span>
      </a>

      <nav className="nav" aria-label="Navegación principal">
        {sections.map((section) => (
          <a
            key={section.id}
            href={getSectionHref(section.id)}
            aria-current={
              isHome && activeSection === section.id ? 'location' : undefined
            }
            onClick={(event) => handleSectionClick(event, section.id)}
          >
            {section.label}
          </a>
        ))}
      </nav>

      <div className="header-actions">
        {configured && (
          <a
            className="header-account"
            href={user ? '/cuenta' : '/cuenta/iniciar-sesion'}
          >
            {user ? 'Mi cuenta' : 'Iniciar sesión'}
          </a>
        )}
        <a
          className="header-button"
          href={getSectionHref('destinos')}
          onClick={(event) => handleSectionClick(event, 'destinos')}
        >
          Explorar lugares <span aria-hidden="true">↗</span>
        </a>
      </div>
    </header>
  )
}
