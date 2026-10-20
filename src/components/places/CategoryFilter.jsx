import { ALL_CATEGORIES_KEY, allCategoriesLabel, categories } from '../../data/categories'

export default function CategoryFilter({ activeCategory, onSelect }) {
  const options = [{ key: ALL_CATEGORIES_KEY, name: allCategoriesLabel, icon: '✦' }, ...categories]

  return (
    <div className="categories" role="group" aria-label="Filtrar por categoría">
      {options.map((category) => {
        const isSelected = activeCategory === category.key

        return (
          <button
            key={category.key}
            type="button"
            className={`category-chip ${isSelected ? 'selected' : ''}`}
            aria-pressed={isSelected}
            title={category.note}
            onClick={() => onSelect(category.key)}
          >
            <span aria-hidden="true">{category.icon}</span>
            {category.name}
          </button>
        )
      })}
    </div>
  )
}
