// Reexporta la definición compartida con el servidor para que la interfaz y
// el API usen exactamente las mismas categorías y etiquetas de OpenStreetMap.
export {
  ALL_CATEGORIES_KEY,
  categories,
  getCategoryByKey,
  describeOsmTags,
} from '../../shared/categories.js'

export const allCategoriesLabel = 'Todos'
