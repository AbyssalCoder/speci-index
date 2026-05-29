'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Layers, Navigation } from 'lucide-react';
import { GlassCard, Button } from '@/components/ui';
import { getRarityColor } from '@/lib/utils';
import type { MapMarker, RestrictedZoneInfo } from '@/types';

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [zones, setZones] = useState<RestrictedZoneInfo[]>([]);

  useEffect(() => {
    async function initMap() {
      const maplibregl = (await import('maplibre-gl')).default;

      if (!mapContainer.current) return;

      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'osm',
              type: 'raster',
              source: 'osm',
            },
          ],
          // Dark filter overlay
          glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        },
        center: [0, 20],
        zoom: 2,
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
        }),
        'top-right'
      );

      mapInstance.current = map;

      map.on('load', () => {
        setLoading(false);
        loadMapData(map);
      });

      map.on('moveend', () => {
        loadMapData(map);
      });

      return () => map.remove();
    }

    initMap();
  }, []);

  async function loadMapData(map: any) {
    const bounds = map.getBounds();
    const params = new URLSearchParams({
      south: bounds.getSouth().toString(),
      north: bounds.getNorth().toString(),
      west: bounds.getWest().toString(),
      east: bounds.getEast().toString(),
    });

    try {
      const res = await fetch(`/api/map?${params}`);
      const data = await res.json();
      if (data.success) {
        setMarkers(data.data.markers);
        setZones(data.data.restrictedZones);
        renderMarkers(map, data.data.markers);
        renderZones(map, data.data.restrictedZones);
      }
    } catch (err) {
      console.error('Map data error:', err);
    }
  }

  function renderMarkers(map: any, markers: MapMarker[]) {
    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.species-marker');
    existingMarkers.forEach((m) => m.remove());

    const maplibregl = (window as any).maplibregl;
    if (!maplibregl) return;

    markers.forEach((marker) => {
      const el = document.createElement('div');
      el.className = 'species-marker';
      el.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: ${getRarityColor(marker.species.rarityTier)};
        border: 2px solid white;
        cursor: pointer;
        box-shadow: 0 0 8px ${getRarityColor(marker.species.rarityTier)}80;
      `;

      new maplibregl.Marker({ element: el })
        .setLngLat([marker.longitude, marker.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 10 }).setHTML(`
            <div style="color: #333; font-size: 12px;">
              <strong>${marker.species.commonName}</strong><br/>
              <span style="color: #666;">by ${marker.discoveredBy}</span>
            </div>
          `)
        )
        .addTo(map);
    });
  }

  function renderZones(map: any, zones: RestrictedZoneInfo[]) {
    // Add restricted zone circles
    if (map.getSource('restricted-zones')) {
      map.removeLayer('restricted-zones-fill');
      map.removeLayer('restricted-zones-border');
      map.removeSource('restricted-zones');
    }

    if (zones.length === 0) return;

    // Create GeoJSON circles (approximation)
    const features = zones.map((zone) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [zone.longitude, zone.latitude],
      },
      properties: {
        name: zone.name,
        radius: zone.radiusMeters,
      },
    }));

    map.addSource('restricted-zones', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
    });

    map.addLayer({
      id: 'restricted-zones-fill',
      type: 'circle',
      source: 'restricted-zones',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 5, 15, 50],
        'circle-color': '#ef4444',
        'circle-opacity': 0.1,
      },
    });

    map.addLayer({
      id: 'restricted-zones-border',
      type: 'circle',
      source: 'restricted-zones',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 5, 15, 50],
        'circle-color': 'transparent',
        'circle-stroke-color': '#ef4444',
        'circle-stroke-width': 1,
        'circle-stroke-opacity': 0.3,
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-white">Explore Map</h1>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-400" /> Species
          <span className="w-2 h-2 rounded-full bg-red-400" /> Restricted
        </div>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-white/10" style={{ height: 'calc(100dvh - 220px)' }}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-0">
            <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
          </div>
        )}
        <div ref={mapContainer} className="w-full h-full" />
      </div>

      {/* Stats */}
      <GlassCard className="p-3 flex items-center justify-around text-center">
        <div>
          <p className="text-lg font-bold text-white">{markers.length}</p>
          <p className="text-[10px] text-gray-500">Sightings</p>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div>
          <p className="text-lg font-bold text-white">{zones.length}</p>
          <p className="text-[10px] text-gray-500">Restricted Zones</p>
        </div>
      </GlassCard>
    </div>
  );
}
