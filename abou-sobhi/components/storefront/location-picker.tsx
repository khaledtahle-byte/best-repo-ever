'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import { translator } from '@/lib/i18n';
import type { Locale } from '@/lib/types';

interface LocationPickerProps {
  center: { lat: number; lng: number };
  value: { lat: number; lng: number } | null;
  onChange: (value: { lat: number; lng: number }) => void;
  locale: Locale;
}

/**
 * OpenStreetMap through Leaflet: no API key, no billing account, no per-load
 * quota — which matters when the buyer is a single shawarma shop, not a chain.
 *
 * The marker is a CSS pin rather than Leaflet's default PNG so there are no
 * image assets to lose when the app is bundled or moved behind a sub-path.
 */
export default function LocationPicker({ center, value, onChange, locale }: LocationPickerProps) {
  const t = translator(locale);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(false);

  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const start = value ?? center;
      map = L.map(containerRef.current, { attributionControl: true, zoomControl: true }).setView(
        [start.lat, start.lng],
        value ? 17 : 14,
      );
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(map);

      const icon = L.divIcon({
        className: '',
        html: `<div style="width:30px;height:40px;position:relative">
                 <div style="position:absolute;inset:0;background:#D7282F;
                   clip-path:path('M15 40C15 40 30 22 30 14A15 15 0 1 0 0 14c0 8 15 26 15 26z');"></div>
                 <div style="position:absolute;left:10px;top:9px;width:10px;height:10px;
                   border-radius:50%;background:#fff"></div>
               </div>`,
        iconSize: [30, 40],
        iconAnchor: [15, 40],
      });

      const marker = L.marker([start.lat, start.lng], { draggable: true, icon }).addTo(map);
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLatLng();
        onChangeRef.current({ lat, lng });
      });
      map.on('click', (event) => {
        marker.setLatLng(event.latlng);
        onChangeRef.current({ lat: event.latlng.lat, lng: event.latlng.lng });
      });

      mapRef.current = map;
      markerRef.current = marker;

      // Leaflet mismeasures a container that was hidden while it initialised.
      setTimeout(() => map?.invalidateSize(), 60);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Deliberately mounted once: `value` moves the marker through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the pin in step when the value changes from outside (the locate button).
  useEffect(() => {
    if (!value || !markerRef.current || !mapRef.current) return;
    const current = markerRef.current.getLatLng();
    if (Math.abs(current.lat - value.lat) < 1e-7 && Math.abs(current.lng - value.lng) < 1e-7) return;
    markerRef.current.setLatLng([value.lat, value.lng]);
    mapRef.current.setView([value.lat, value.lng], Math.max(mapRef.current.getZoom(), 17));
  }, [value]);

  const locate = () => {
    if (!navigator.geolocation) {
      setError(true);
      return;
    }
    setLocating(true);
    setError(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onChangeRef.current({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setLocating(false);
        setError(true);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 pb-2">
        <button type="button" onClick={locate} disabled={locating} className="btn-ink btn-sm">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3.5" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
          </svg>
          {locating ? t('locating') : t('useMyLocation')}
        </button>
        {value ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-state-done">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('locationSet')}
          </span>
        ) : null}
      </div>

      <div
        ref={containerRef}
        className="h-56 w-full overflow-hidden rounded-xl border border-brand-line sm:h-64"
      />

      <p className={`mt-2 text-xs ${error ? 'font-semibold text-brand-red' : 'text-brand-muted'}`}>
        {error ? t('locationDenied') : t('locationHelp')}
      </p>
    </div>
  );
}
