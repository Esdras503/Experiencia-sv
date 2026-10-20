export default function SearchBar({ query, onQueryChange, onSubmit, inputRef }) {
  const handleClear = () => {
    onQueryChange('')
    inputRef.current?.focus()
  }

  return (
    <form className="search-box" role="search" onSubmit={onSubmit}>
      <div className="search-field">
        <span className="search-icon" aria-hidden="true">
          ⌕
        </span>
        <label className="visually-hidden" htmlFor="search-input">
          Buscar destinos por nombre, municipio, departamento o categoría
        </label>
        <input
          id="search-input"
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="¿A dónde quieres ir?"
          autoComplete="off"
        />
        {query.length > 0 && (
          <button
            type="button"
            className="search-clear"
            aria-label="Borrar búsqueda"
            onClick={handleClear}
          >
            ×
          </button>
        )}
      </div>
      <button type="submit" className="search-submit">
        Buscar <span aria-hidden="true">→</span>
      </button>
    </form>
  )
}
