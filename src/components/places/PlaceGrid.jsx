import PlaceCard from './PlaceCard'

export default function PlaceGrid({ places, getDetailHref, onOpenPlace }) {
  return (
    <div className="place-grid">
      {places.map((place) => (
        <PlaceCard
          key={place.id}
          place={place}
          detailHref={getDetailHref(place)}
          onOpen={onOpenPlace}
        />
      ))}
    </div>
  )
}
