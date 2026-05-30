import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

type EditableMatchMapProps = {
  latitude: number | null
  longitude: number | null
  placeName: string | null
  editable: boolean
  onPick: (lat: number, lng: number, suggested: { placeName: string | null; formattedAddress: string | null } | null) => void
}

const PIN_ICON = L.divIcon({
  className: 'editable-match-map-pin',
  html: `
    <div style="
      width: 22px;
      height: 22px;
      border-radius: 999px;
      background: #2d5a4c;
      border: 3px solid #fff;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    "></div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

function RecenterOnChange({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], map.getZoom())
  }, [lat, lng, map])
  return null
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

type LookupState = {
  status: 'idle' | 'loading' | 'ready' | 'failed'
  placeName: string | null
  formattedAddress: string | null
}

export function EditableMatchMap({ latitude, longitude, placeName, editable, onPick }: EditableMatchMapProps) {
  const [lookup, setLookup] = useState<LookupState>({
    status: 'idle',
    placeName,
    formattedAddress: null,
  })
  const popupRef = useRef<L.Popup | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    setLookup((cur) => ({ ...cur, placeName }))
  }, [placeName])

  useEffect(() => {
    if (editable && markerRef.current) {
      markerRef.current.openPopup()
    }
  }, [editable, latitude, longitude, lookup.placeName, lookup.formattedAddress])

  if (latitude == null || longitude == null) {
    return <div className="match-map-placeholder">No coordinates available.</div>
  }

  const handlePick = async (lat: number, lng: number) => {
    setLookup({ status: 'loading', placeName: null, formattedAddress: null })
    onPick(lat, lng, null)
    try {
      const res = await fetch(`${API_BASE}/geocode/reverse?lat=${lat}&lng=${lng}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as {
        place_name: string | null
        formatted_address: string | null
      }
      setLookup({
        status: 'ready',
        placeName: body.place_name,
        formattedAddress: body.formatted_address,
      })
      onPick(lat, lng, {
        placeName: body.place_name,
        formattedAddress: body.formatted_address,
      })
    } catch {
      setLookup({ status: 'failed', placeName: null, formattedAddress: null })
    }
  }

  const popupTitle = lookup.placeName ?? placeName ?? 'Selected location'
  const popupAddress = lookup.formattedAddress
  const isLoading = lookup.status === 'loading'

  return (
    <div className={`editable-match-map${editable ? ' editable-match-map--active' : ''}`}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={15}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={editable}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterOnChange lat={latitude} lng={longitude} />
        {editable ? <ClickHandler onClick={(lat, lng) => void handlePick(lat, lng)} /> : null}
        <Marker
          position={[latitude, longitude]}
          icon={PIN_ICON}
          ref={(m) => {
            markerRef.current = m
          }}
        >
          <Popup
            ref={(p) => {
              popupRef.current = p
            }}
            autoClose={false}
            closeOnClick={false}
            closeButton={false}
          >
            <div className="pin-popup">
              {isLoading ? (
                <div className="pin-popup-loading">Looking up...</div>
              ) : (
                <>
                  <strong className="pin-popup-title">{popupTitle}</strong>
                  {popupAddress ? <p className="pin-popup-address">{popupAddress}</p> : null}
                </>
              )}
            </div>
          </Popup>
        </Marker>
      </MapContainer>
      {editable ? (
        <div className="editable-match-map-hint">
          Click anywhere on the map to drop a new pin
        </div>
      ) : null}
    </div>
  )
}
