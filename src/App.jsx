
import { useState } from 'react'
import './App.css'

const categories = [
  { name: 'Naturaleza', icon: '🌿' },
  { name: 'Playas', icon: '🏖️' },
  { name: 'Montañas', icon: '⛰️' },
  { name: 'Cultura', icon: '🏛️' },
  { name: 'Aventura', icon: '🥾' },
  { name: 'Gastronomía', icon: '🍽️' },
]

const places = [
  {
    id: 1,
    name: 'Lago de Coatepeque',
    location: 'Santa Ana',
    category: 'Naturaleza',
    description: 'Disfruta de paisajes volcánicos y vistas al lago.',
    image:
      'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 2,
    name: 'El Tunco',
    location: 'La Libertad',
    category: 'Playas',
    description: 'Una playa conocida por el surf y su ambiente turístico.',
    image:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 3,
    name: 'Cerro Verde',
    location: 'Santa Ana',
    category: 'Montañas',
    description: 'Explora senderos y disfruta de vistas volcánicas.',
    image:
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 4,
    name: 'Centro Histórico',
    location: 'San Salvador',
    category: 'Cultura',
    description: 'Descubre arquitectura, plazas y espacios históricos.',
    image:
      'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=900&q=80',
  },
]

function App() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [chatOpen, setChatOpen] = useState(false)
  const [message, setMessage] = useState('')

  const filteredPlaces = places.filter((place) => {
    const matchesSearch = `${place.name} ${place.location} ${place.category}`
      .toLowerCase()
      .includes(search.toLowerCase())

    const matchesCategory =
      activeCategory === 'Todos' || place.category === activeCategory

    return matchesSearch && matchesCategory
  })

  return (
    <div className="app">
      <header className="header">
        <a className="brand" href="#" aria-label="Experiencia SV, inicio">
          <span className="brand-icon">✳</span>
          <span>
            Experiencia<span className="brand-highlight">SV</span>
          </span>
        </a>

        <nav className="nav">
          <a href="#inicio">Inicio</a>
          <a href="#destinos">Destinos</a>
          <a href="#categorias">Categorías</a>
        </nav>

        <a className="header-button" href="#destinos">
          Explorar lugares <span>↗</span>
        </a>
      </header>

      <main>
        <section className="hero" id="inicio">
          <div className="hero-content">
            <span className="eyebrow">
              <span className="status-dot" />
              DESCUBRE EL SALVADOR
            </span>

            <h1>
              Tu próxima aventura
              <br />
              comienza <span>aquí.</span>
            </h1>

            <p className="hero-description">
              Encuentra lugares increíbles, descubre rincones únicos y
              planifica experiencias inolvidables en El Salvador.
            </p>

            <form
              className="search-box"
              onSubmit={(event) => {
                event.preventDefault()
                document
                  .getElementById('destinos')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              <span className="search-icon">⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="¿A dónde quieres ir?"
                aria-label="Buscar destinos o departamentos"
              />
              <button type="submit">Buscar <span>→</span></button>
            </form>

            <div className="hero-note">
              <span>✦</span> Explora a tu ritmo. Vive a tu manera.
            </div>
          </div>

          <div className="hero-visual">
            <img
              className="hero-image"
              src="https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=85"
              alt="Paisaje natural para inspirar tu próxima aventura"
            />
            <div className="image-label">
              <span className="image-label-icon">⌖</span>
              <div>
                <strong>Hay un lugar para ti</strong>
                <span>Tu próxima historia comienza hoy</span>
              </div>
            </div>
            <div className="floating-star">✳</div>
          </div>
        </section>

        <section className="discovery" id="categorias">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ENCUENTRA TU EXPERIENCIA</span>
              <h2>¿Qué te gustaría descubrir?</h2>
              <p>Hay muchas formas de enamorarte de El Salvador.</p>
            </div>
          </div>

          <div className="categories">
            <button
              className={`category-chip ${activeCategory === 'Todos' ? 'selected' : ''}`}
              onClick={() => setActiveCategory('Todos')}
              type="button"
            >
              <span>✦</span> Todos
            </button>

            {categories.map((category) => (
              <button
                className={`category-chip ${activeCategory === category.name ? 'selected' : ''}`}
                key={category.name}
                onClick={() => setActiveCategory(category.name)}
                type="button"
              >
                <span>{category.icon}</span>
                {category.name}
              </button>
            ))}
          </div>
        </section>

        <section className="destinations" id="destinos">
          <div className="destination-heading">
            <div>
              <span className="eyebrow">INSPÍRATE Y EXPLORA</span>
              <h2>Lugares que te esperan</h2>
            </div>
            <span className="results-count">
              {filteredPlaces.length} lugares
            </span>
          </div>

          {filteredPlaces.length > 0 ? (
            <div className="place-grid">
              {filteredPlaces.map((place) => (
                <article className="place-card" key={place.id}>
                  <div className="place-image-wrapper">
                    <img src={place.image} alt={place.name} loading="lazy" />
                    <span className="place-category">{place.category}</span>
                  </div>
                  <div className="place-info">
                    <span className="place-location">
                      <span>⌖</span> {place.location}, El Salvador
                    </span>
                    <h3>{place.name}</h3>
                    <p>{place.description}</p>
                    <button
                      className="place-link"
                      type="button"
                      onClick={() =>
                        window.alert(
                          `${place.name}\n\n${place.description}\n\nPróximamente podrás consultar detalles reales del lugar.`,
                        )
                      }
                    >
                      Descubrir lugar <span>↗</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span>⌕</span>
              <h3>No encontramos lugares</h3>
              <p>Prueba con otro nombre, departamento o categoría.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setActiveCategory('Todos')
                }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </section>

        <section className="assistant-banner">
          <div className="assistant-icon">✳</div>
          <div>
            <span className="eyebrow">TU ASISTENTE DE VIAJES</span>
            <h2>¿No sabes por dónde empezar?</h2>
            <p>Cuéntanos qué te gusta y te ayudaremos a encontrar tu próxima aventura.</p>
          </div>
          <button type="button" onClick={() => setChatOpen(true)}>
            Hablar con el asistente <span>→</span>
          </button>
        </section>
      </main>

      <footer className="footer">
        <a className="brand" href="#inicio">
          <span className="brand-icon">✳</span>
          <span>
            Experiencia<span className="brand-highlight">SV</span>
          </span>
        </a>
        <p>Descubre lo extraordinario de El Salvador.</p>
        <span>© {new Date().getFullYear()} Experiencia SV</span>
      </footer>

      <button
        className="chat-fab"
        type="button"
        aria-label={chatOpen ? 'Cerrar asistente' : 'Abrir asistente de viajes'}
        onClick={() => setChatOpen(!chatOpen)}
      >
        {chatOpen ? '×' : '✳'}
        {!chatOpen && <span className="chat-fab-label">¿Te ayudo a explorar?</span>}
      </button>

      {chatOpen && (
        <aside className="chat-panel" aria-label="Asistente de viajes">
          <div className="chat-header">
            <div className="chat-avatar">✳</div>
            <div>
              <strong>Asistente Experiencia SV</strong>
              <span><span className="status-dot" /> Listo para ayudarte</span>
            </div>
            <button
              type="button"
              aria-label="Cerrar chat"
              onClick={() => setChatOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="chat-body">
            <div className="chat-message">
              ¡Hola! 👋 Soy tu asistente de viajes. ¿Qué tipo de lugares te
              gustaría descubrir en El Salvador?
            </div>
            <div className="chat-suggestions">
              {['Playas para visitar', 'Lugares de naturaleza', 'Un paseo económico'].map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setMessage(suggestion)}
                  >
                    {suggestion}
                  </button>
                ),
              )}
            </div>
            <p className="chat-disclaimer">
              Este chat es una demostración visual. La conexión con la IA se
              implementará en una siguiente etapa.
            </p>
          </div>

          <form
            className="chat-input"
            onSubmit={(event) => {
              event.preventDefault()
              if (!message.trim()) return
              window.alert(
                'El chatbot todavía no está conectado a una IA. Tu mensaje fue: ' +
                  message,
              )
              setMessage('')
            }}
          >
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Escribe tu consulta..."
              aria-label="Mensaje para el asistente"
            />
            <button type="submit" aria-label="Enviar mensaje">↑</button>
          </form>
        </aside>
      )}
    </div>
  )
}

export default App
