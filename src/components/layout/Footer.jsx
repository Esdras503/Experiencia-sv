import BrandLogo from '../brand/BrandLogo.jsx'

export default function Footer({ pathname, onNavigateHome }) {
  const isHome = pathname === '/'

  const handleHomeClick = (event) => {
    if (isHome) return
    event.preventDefault()
    onNavigateHome()
  }

  return (
    <footer className="footer">
      <a
        className="brand"
        href={isHome ? '#inicio' : '/'}
        onClick={handleHomeClick}
        aria-label="Experiencia SV — Inicio"
      >
        <BrandLogo decorative />
      </a>
      <p>Descubre lo extraordinario de El Salvador.</p>
      <nav className="footer-links" aria-label="Enlaces del pie de página">
        <a href="/planes">Planes y precios</a>
      </nav>
      <span>© {new Date().getFullYear()} Experiencia SV</span>
    </footer>
  )
}
