import { OSM_ATTRIBUTION, OSM_COPYRIGHT_URL } from '../../../shared/osm.js'

/**
 * Atribución obligatoria de OpenStreetMap (licencia ODbL). Debe ser visible
 * siempre que se muestren datos derivados de OSM y enlazar a la página de
 * derechos de autor.
 */
export default function OpenStreetMapAttribution({ prefix = 'Datos de lugares:' }) {
  return (
    <span className="osm-attribution">
      {prefix && <span className="osm-attribution-prefix">{prefix} </span>}
      <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener noreferrer">
        {OSM_ATTRIBUTION}
      </a>
    </span>
  )
}
