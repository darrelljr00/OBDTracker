import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MetricsStrip } from "@/components/dashboard/metrics-strip";
import { VehicleMap } from "@/components/map/vehicle-map";
import { TripHistory } from "@/components/dashboard/trip-history";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar, Bell } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import type { Vehicle, VehicleLocation, ObdData, Trip } from "@shared/schema";

export default function Dashboard() {
  const { isConnected } = useWebSocket();

  // Get all vehicles
  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ['/api/vehicles'],
  });

  const selectedVehicleId = vehicles.length > 0 ? vehicles[0].id : null;
  const selectedVehicle = vehicles[0];

  // Get vehicle location
  const { data: location } = useQuery<VehicleLocation>({
    queryKey: ['/api/vehicles', selectedVehicleId, 'location'],
    enabled: !!selectedVehicleId,
    refetchInterval: 5000,
  });

  // Get vehicle OBD data
  const { data: obdData } = useQuery<ObdData>({
    queryKey: ['/api/vehicles', selectedVehicleId, 'obd'],
    enabled: !!selectedVehicleId,
    refetchInterval: 3000,
  });

  // Get active trip
  const { data: activeTrip } = useQuery<Trip>({
    queryKey: ['/api/vehicles', selectedVehicleId, 'active-trip'],
    enabled: !!selectedVehicleId,
    refetchInterval: 10000,
  });

  // Get trip history
  const { data: trips = [] } = useQuery<Trip[]>({
    queryKey: ['/api/vehicles', selectedVehicleId, 'trips'],
    enabled: !!selectedVehicleId,
    refetchInterval: 30000,
  });

  if (vehiclesLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading vehicles...</p>
        </div>
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-semibold mb-2">No Vehicles Found</p>
          <p className="text-muted-foreground">Please add a vehicle to start tracking.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        isConnected={isConnected} 
        vehicle={selectedVehicle}
        obdData={obdData}
      />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Live Vehicle Tracking</h2>
              <p className="text-sm text-muted-foreground">Real-time GPS monitoring and trip analytics</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Vehicle Selector */}
              <div className="relative">
                <Select value={selectedVehicleId || ""} data-testid="select-vehicle">
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map(vehicle => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.name} - {vehicle.plate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Date Range */}
              <Button variant="outline" size="sm" data-testid="button-date-range">
                <Calendar className="w-4 h-4 mr-2" />
                Today
              </Button>
              
              {/* Notifications */}
              <Button variant="outline" size="sm" className="relative" data-testid="button-notifications">
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-xs flex items-center justify-center">
                  3
                </span>
              </Button>
            </div>
          </div>
        </header>
        
        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-6">
          <div className="grid grid-cols-12 gap-6 h-full">
            
            {/* Map Section (70%) */}
            <div className="col-span-8 flex flex-col space-y-4">
              
              {/* Real-time Metrics Strip */}
              <MetricsStrip 
                location={location}
                obdData={obdData}
                activeTrip={activeTrip}
              />
              
              {/* Map Container */}
              <div className="flex-1 bg-card rounded-lg border border-border overflow-hidden">
                <VehicleMap 
                  vehicle={selectedVehicle}
                  location={location}
                  activeTrip={activeTrip}
                  isLive={isConnected}
                />
              </div>
              
              {/* Current Location Info */}
              <Card className="p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Current Location</p>
                    <p className="text-sm font-medium" data-testid="text-current-location">
                      {activeTrip?.startLocation || "Location not available"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Coordinates</p>
                    <p className="text-sm font-mono" data-testid="text-coordinates">
                      {location ? `${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°` : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Last Update</p>
                    <p className="text-sm" data-testid="text-last-update">
                      {location ? 
                        new Date(location.timestamp!).toLocaleTimeString() : 
                        "No recent updates"
                      }
                    </p>
                  </div>
                </div>
              </Card>
            </div>
            
            {/* Right Panel - Trip History & Stats (30%) */}
            <div className="col-span-4">
              <TripHistory 
                vehicle={selectedVehicle}
                trips={trips}
                obdData={obdData}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
