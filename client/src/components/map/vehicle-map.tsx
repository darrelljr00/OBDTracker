import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Vehicle, VehicleLocation, Trip } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ZoomIn, ZoomOut, Layers, Crosshair, Play, SkipBack, SkipForward } from "lucide-react";

type MapLayer = 'dark' | 'light' | 'medium';
type VehicleType = 'car' | 'truck' | 'van';

const MAP_LAYERS = {
  dark: {
    name: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap contributors © CARTO'
  },
  light: {
    name: 'Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap contributors © CARTO'
  },
  medium: {
    name: 'Medium',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap contributors © CARTO'
  }
} as const;

const VEHICLE_ICONS = {
  car: `<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
  </svg>`,
  truck: `<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
  </svg>`,
  van: `<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17 5H3c-1.1 0-2 .89-2 2v9h2c0 1.65 1.34 3 3 3s3-1.35 3-3h5.5c0 1.65 1.34 3 3 3s3-1.35 3-3H23v-5l-6-6zM6 17.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM17.5 13L17 7h1l3.5 3.5V13h-4zm.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
  </svg>`
} as const;

interface VehicleMapProps {
  vehicles: Vehicle[];
  allLocations: VehicleLocation[];
  selectedVehicle?: Vehicle;
  activeTrip?: Trip;
  isLive: boolean;
}

export function VehicleMap({ vehicles, allLocations, selectedVehicle, activeTrip, isLive }: VehicleMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const vehicleMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const vehicleTrailsRef = useRef<Map<string, L.Polyline>>(new Map());
  const vehicleHistoryRef = useRef<Map<string, Array<[number, number]>>>(new Map());
  const routeLineRef = useRef<L.Polyline | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [hasInitialFit, setHasInitialFit] = useState(false);
  const [lastSelectedVehicleId, setLastSelectedVehicleId] = useState<string | undefined>();
  const [selectedLayer, setSelectedLayer] = useState<MapLayer>('dark');

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      center: [40.7485, -73.9883],
      zoom: 13,
      zoomControl: false,
    });

    mapRef.current = map;

    // Add initial tile layer
    const layer = MAP_LAYERS[selectedLayer];
    const tileLayer = L.tileLayer(layer.url, {
      attribution: layer.attribution,
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    return () => {
      map.remove();
    };
  }, []);

  // Handle layer changes
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;

    const map = mapRef.current;
    const layer = MAP_LAYERS[selectedLayer];

    // Remove old tile layer
    map.removeLayer(tileLayerRef.current);

    // Add new tile layer
    const newTileLayer = L.tileLayer(layer.url, {
      attribution: layer.attribution,
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = newTileLayer;
  }, [selectedLayer]);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const markers = vehicleMarkersRef.current;

    // Remove markers for vehicles that no longer exist
    const currentVehicleIds = new Set(vehicles.map(v => v.id));
    markers.forEach((marker, vehicleId) => {
      if (!currentVehicleIds.has(vehicleId)) {
        map.removeLayer(marker);
        markers.delete(vehicleId);
      }
    });

    // Update or create markers for all vehicles with trails
    allLocations.forEach(location => {
      const vehicle = vehicles.find(v => v.id === location.vehicleId);
      if (!vehicle) return;

      const { latitude, longitude, speed = 0, heading = 0 } = location;
      const isSelected = vehicle.id === selectedVehicle?.id;

      // Update vehicle history for trail
      const history = vehicleHistoryRef.current.get(vehicle.id) || [];
      const newPos: [number, number] = [latitude, longitude];
      
      // Only add if position changed
      const lastPos = history[history.length - 1];
      if (!lastPos || lastPos[0] !== newPos[0] || lastPos[1] !== newPos[1]) {
        history.push(newPos);
        // Keep only last 20 positions for trail
        if (history.length > 20) history.shift();
        vehicleHistoryRef.current.set(vehicle.id, history);
      }

      // Draw or update trail line
      const trails = vehicleTrailsRef.current;
      if (history.length > 1 && vehicle.isActive) {
        const existingTrail = trails.get(vehicle.id);
        const trailColor = isSelected ? 'hsl(217, 91%, 60%)' : 'hsl(160, 84%, 39%)';
        
        if (existingTrail) {
          existingTrail.setLatLngs(history);
          existingTrail.setStyle({ color: trailColor });
        } else {
          const trail = L.polyline(history, {
            color: trailColor,
            weight: 3,
            opacity: 0.6,
            dashArray: '5, 10',
          }).addTo(map);
          trails.set(vehicle.id, trail);
        }
      } else if (!vehicle.isActive) {
        // Remove trail if vehicle is inactive
        const trail = trails.get(vehicle.id);
        if (trail) {
          map.removeLayer(trail);
          trails.delete(vehicle.id);
        }
      }

      // Different color for selected vehicle
      const iconColor = isSelected ? 'bg-primary' : 'bg-success';
      const borderColor = isSelected ? 'border-primary' : 'border-white';

      // Get vehicle icon based on type
      const vehicleType = (vehicle.vehicleType || 'car') as VehicleType;
      const vehicleIconSvg = VEHICLE_ICONS[vehicleType] || VEHICLE_ICONS.car;

      // Show speed badge for active vehicles with movement
      const currentSpeed = speed ?? 0;
      const speedDisplay = vehicle.isActive && currentSpeed > 0 
        ? `<div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap shadow-lg" style="animation: speed-pulse 2s ease-in-out infinite;">
             ${Math.round(currentSpeed)} mph
           </div>` 
        : '';

      const vehicleIcon = L.divIcon({
        className: 'bg-transparent',
        html: `
          <div class="relative">
            ${speedDisplay}
            <div class="w-5 h-5 ${iconColor} border-2 ${borderColor} rounded-full shadow-lg flex items-center justify-center"
                 style="transform: rotate(${heading}deg)">
              ${vehicleIconSvg}
            </div>
          </div>
        `,
        iconSize: [20, 40],
        iconAnchor: [10, 20],
      });

      const existingMarker = markers.get(vehicle.id);
      
      if (existingMarker) {
        // Smooth animation to new position
        const currentLatLng = existingMarker.getLatLng();
        const newLatLng = L.latLng(latitude, longitude);
        
        // Only animate if position actually changed and vehicle is active
        if (vehicle.isActive && !currentLatLng.equals(newLatLng)) {
          // Use Leaflet's slide animation for smooth movement
          existingMarker.setLatLng(newLatLng);
        } else {
          existingMarker.setLatLng(newLatLng);
        }
        existingMarker.setIcon(vehicleIcon);
      } else {
        const marker = L.marker([latitude, longitude], { icon: vehicleIcon }).addTo(map);
        marker.bindPopup(`
          <div class="text-sm">
            <strong>${vehicle.name}</strong><br>
            ${vehicle.plate}<br>
            Speed: ${Math.round(speed ?? 0)} mph<br>
            Status: ${isLive ? 'Live' : 'Offline'}
          </div>
        `);
        markers.set(vehicle.id, marker);
      }
    });

    // Only auto-fit bounds on initial load or when selected vehicle changes
    const shouldFitBounds = !hasInitialFit || (selectedVehicle && lastSelectedVehicleId !== selectedVehicle.id);
    
    if (shouldFitBounds && allLocations.length > 0) {
      const bounds = L.latLngBounds(
        allLocations.map(loc => [loc.latitude, loc.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      setHasInitialFit(true);
      if (selectedVehicle) {
        setLastSelectedVehicleId(selectedVehicle.id);
      }
    }

  }, [vehicles, allLocations, selectedVehicle, isLive, hasInitialFit, lastSelectedVehicleId]);

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
    if (!mapRef.current) return;
    
    // Find location for selected vehicle
    const selectedLocation = allLocations.find(loc => loc.vehicleId === selectedVehicle?.id);
    
    if (selectedLocation) {
      mapRef.current.setView([selectedLocation.latitude, selectedLocation.longitude], 15);
    } else if (allLocations.length > 0) {
      // If no selected vehicle, center on all vehicles
      const bounds = L.latLngBounds(
        allLocations.map(loc => [loc.latitude, loc.longitude])
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
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
            <ZoomIn className="w-4 h-4 text-black" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-10 h-10 rounded-none"
            onClick={handleZoomOut}
            data-testid="button-zoom-out"
          >
            <ZoomOut className="w-4 h-4 text-black" />
          </Button>
        </div>
        
        {/* Map Layer Switcher */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-10 h-10 bg-card/95 backdrop-blur-sm border border-border"
              data-testid="button-map-layers"
            >
              <Layers className="w-4 h-4 text-black" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-2 z-[1100]" side="right">
            <div className="space-y-1">
              <p className="text-xs font-semibold mb-2 text-muted-foreground">Map Style</p>
              {Object.entries(MAP_LAYERS).map(([key, layer]) => (
                <button
                  key={key}
                  onClick={() => setSelectedLayer(key as MapLayer)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                    selectedLayer === key 
                      ? 'bg-primary text-primary-foreground font-medium' 
                      : 'hover:bg-muted'
                  }`}
                  data-testid={`layer-option-${key}`}
                >
                  {layer.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        
        {/* Center on Vehicle */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="w-10 h-10 bg-card/95 backdrop-blur-sm border border-border"
          onClick={handleCenterOnVehicle}
          data-testid="button-center-vehicle"
        >
          <Crosshair className="w-4 h-4 text-black" />
        </Button>
      </div>
      
      {/* Route Replay Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="bg-card/95 backdrop-blur-sm rounded-lg border border-border px-6 py-3 flex items-center space-x-4">
          <Button variant="ghost" size="icon" data-testid="button-replay-back">
            <SkipBack className="w-4 h-4 text-black" />
          </Button>
          <Button size="icon" className="rounded-full" data-testid="button-replay-play">
            <Play className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" data-testid="button-replay-forward">
            <SkipForward className="w-4 h-4 text-black" />
          </Button>
          <div className="w-px h-6 bg-border"></div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-black">Speed:</span>
            <select className="bg-transparent text-xs text-black focus:outline-none" data-testid="select-replay-speed" defaultValue="2">
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
