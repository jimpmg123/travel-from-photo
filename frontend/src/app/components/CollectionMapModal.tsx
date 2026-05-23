import { useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'

import type { GalleryImage } from '../types'

type CollectionMapModalProps = {
  title: string
  images: GalleryImage[]
  onClose: () => void
}

const markerIcon = (label: number) =>
  L.divIcon({
    className: 'collection-map-pin',
    html: `
      <div style="
        width: 32px; height: 32px;
        border-radius: 999px;
        background: #ffffff;
        border: 2px solid #2d6a5f;
        color: #2d6a5f;
        display: grid;
        place-items: center;
        font-weight: 700;
        font-size: 12px;
        box-shadow: 0 6px 16px rgba(0,0,0,0.18);
      ">${label}</div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })

export function CollectionMapModal({ title, images, onClose }: CollectionMapModalProps) {
  const geotagged = useMemo(
    () =>
      images.filter(
        (image): image is GalleryImage & { latitude: number; longitude: number } =>
          typeof image.latitude === 'number' && typeof image.longitude === 'number',
      ),
    [images],
  )

  const bounds = useMemo(() => {
    if (geotagged.length === 0) return null
    return L.latLngBounds(geotagged.map((image) => [image.latitude, image.longitude]))
  }, [geotagged])

  const fallbackCenter: [number, number] = geotagged[0]
    ? [geotagged[0].latitude, geotagged[0].longitude]
    : [20, 0]

  const noGpsCount = images.length - geotagged.length

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="collection-map-overlay" onClick={onClose}>
      <div className="collection-map-modal" onClick={(event) => event.stopPropagation()}>
        <header className="collection-map-header">
          <div>
            <h3>{title}</h3>
            <p>
              {geotagged.length} on map
              {noGpsCount > 0 ? ` · ${noGpsCount} without GPS` : ''}
            </p>
          </div>
          <button
            type="button"
            className="collection-map-close"
            onClick={onClose}
            aria-label="Close map"
          >
            <X size={18} />
          </button>
        </header>

        <div className="collection-map-body">
          {geotagged.length === 0 ? (
            <div className="collection-map-empty">
              <strong>No GPS data</strong>
              <p>Photos in this collection do not have location coordinates yet.</p>
            </div>
          ) : (
            <MapContainer
              {...(bounds ? { bounds, boundsOptions: { padding: [32, 32] } } : { center: fallbackCenter, zoom: 13 })}
              scrollWheelZoom={true}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {geotagged.map((image, index) => (
                <Marker
                  key={image.id}
                  position={[image.latitude, image.longitude]}
                  icon={markerIcon(index + 1)}
                >
                  <Popup>
                    <strong>{image.title}</strong>
                    <br />
                    <span style={{ color: '#64748b', fontSize: '0.85em' }}>{image.date}</span>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>
      </div>
    </div>
  )
}
