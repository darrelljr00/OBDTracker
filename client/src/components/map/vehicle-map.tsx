import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Vehicle, VehicleLocation, Trip } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Layers, Crosshair, Play, SkipBack, SkipForward } from "lucide-react";

interface VehicleMapProps {
  vehicle?: Vehicle;
  location?: VehicleLocation;
  activeTrip?: Trip;
  isLive: boolean;
}

export function VehicleMap({ vehicle, location, activeTrip, isLive }: VehicleMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      center: [40.7485, -73.9883],
      zoom: 13,
      zoomControl: false,
    });

    mapRef.current = map;

    // Add dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    return () => {
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !location) return;

    const map = mapRef.current;
    const { latitude, longitude, speed = 0, heading = 0 } = location;

    // Create or update vehicle marker
    const vehicleIcon = L.divIcon({
      className: 'bg-transparent',
      html: `
        <div class="w-5 h-5 bg-success border-2 border-white rounded-full shadow-lg flex items-center justify-center"
             style="transform: rotate(${heading}deg)">
          <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2L3 7v11h14V7l-7-5z"/>
          </svg>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng([latitude, longitude]);
      vehicleMarkerRef.current.setIcon(vehicleIcon);
    } else {
      const marker = L.marker([latitude, longitude], { icon: vehicleIcon }).addTo(map);
      marker.bindPopup(`
        <div class="text-sm">
          <strong>${vehicle?.name || 'Vehicle'}</strong><br>
          Speed: ${Math.round(speed ?? 0)} mph<br>
          Status: ${isLive ? 'Live' : 'Offline'}
        </div>
      `);
      vehicleMarkerRef.current = marker;
    }

    // Center map on vehicle (optional)
    map.setView([latitude, longitude], map.getZoom());

  }, [location, vehicle, isLive]);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Always clean up existing route line and markers first
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    if (startMarkerRef.current) {
      map.removeLayer(startMarkerRef.current);
      startMarkerRef.current = null;
    }
    if (endMarkerRef.current) {
      map.removeLayer(endMarkerRef.current);
      endMarkerRef.current = null;
    }

    // If no active trip, we're done (map is cleaned)
    if (!activeTrip) return;

    // Get route coordinates from trip data
    const tripRoute = activeTrip.route as Array<{lat: number, lng: number, timestamp: string}> | null;
    
    if (!tripRoute || tripRoute.length === 0) {
      return; // No route data yet
    }

    const routeCoordinates: [number, number][] = tripRoute.map(point => [point.lat, point.lng]);

    // Draw route line
    const routeLine = L.polyline(routeCoordinates, {
      color: 'hsl(217, 91%, 60%)',
      weight: 3,
      opacity: 0.7,
    }).addTo(map);

    routeLineRef.current = routeLine;

    // Add start and end markers if we have enough points
    if (routeCoordinates.length > 0) {
      const routeIcon = L.divIcon({
        className: 'bg-transparent',
        html: `<div class="w-3 h-3 bg-primary border border-white rounded-full shadow-lg"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      // Add start marker if coordinates exist
      if (activeTrip.startCoords) {
        const startCoords = activeTrip.startCoords as {lat: number, lng: number};
        startMarkerRef.current = L.marker([startCoords.lat, startCoords.lng], { icon: routeIcon }).addTo(map)
          .bindPopup(`<div class="text-sm"><strong>Start</strong><br>${activeTrip.startLocation}</div>`);
      }

      // Add end marker if coordinates exist
      if (activeTrip.endCoords) {
        const endCoords = activeTrip.endCoords as {lat: number, lng: number};
        endMarkerRef.current = L.marker([endCoords.lat, endCoords.lng], { icon: routeIcon }).addTo(map)
          .bindPopup(`<div class="text-sm"><strong>Current</strong><br>${activeTrip.endLocation || 'In Progress'}</div>`);
      }

      // Fit map to show route
      map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
    }

  }, [activeTrip]);

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleCenterOnVehicle = () => {
    if (location && mapRef.current) {
      mapRef.current.setView([location.latitude, location.longitude], 15);
    }
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full rounded-lg" data-testid="map-container" />
      
      {/* Map Controls Overlay */}
      <div className="absolute top-4 left-4 z-[1000] space-y-2">
        {/* Zoom Controls */}
        <div className="bg-card/95 backdrop-blur-sm rounded-lg border border-border overflow-hidden">
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-10 h-10 rounded-none border-b border-border"
            onClick={handleZoomIn}
            data-testid="button-zoom-in"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-10 h-10 rounded-none"
            onClick={handleZoomOut}
            data-testid="button-zoom-out"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Map Type Toggle */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="w-10 h-10 bg-card/95 backdrop-blur-sm border border-border"
          data-testid="button-map-type"
        >
          <Layers className="w-4 h-4" />
        </Button>
        
        {/* Center on Vehicle */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="w-10 h-10 bg-card/95 backdrop-blur-sm border border-border"
          onClick={handleCenterOnVehicle}
          data-testid="button-center-vehicle"
        >
          <Crosshair className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Route Replay Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="bg-card/95 backdrop-blur-sm rounded-lg border border-border px-6 py-3 flex items-center space-x-4">
          <Button variant="ghost" size="icon" data-testid="button-replay-back">
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button size="icon" className="rounded-full" data-testid="button-replay-play">
            <Play className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" data-testid="button-replay-forward">
            <SkipForward className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-border"></div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-muted-foreground">Speed:</span>
            <select className="bg-transparent text-xs focus:outline-none" data-testid="select-replay-speed" defaultValue="2">
              <option value="1">1x</option>
              <option value="2">2x</option>
              <option value="5">5x</option>
              <option value="10">10x</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Live Status Badge */}
      <div className="absolute top-4 right-4 z-[1000]">
        <div className={`backdrop-blur-sm rounded-full px-4 py-2 border flex items-center space-x-2 ${
          isLive 
            ? 'bg-success/20 border-success/30' 
            : 'bg-muted/20 border-muted/30'
        }`}>
          <span className={`status-dot ${isLive ? 'status-online' : 'status-offline'}`}></span>
          <span className={`text-xs font-medium ${isLive ? 'text-success' : 'text-muted-foreground'}`}
                data-testid="text-connection-status">
            {isLive ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </div>
  );
}
