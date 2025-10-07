import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { 
  MapPin, 
  Route, 
  Car, 
  BarChart3, 
  Settings, 
  User, 
  MoreVertical,
  Plug
} from "lucide-react";
import type { Vehicle, ObdData } from "@shared/schema";

interface SidebarProps {
  isConnected: boolean;
  vehicles: Vehicle[];
  selectedVehicle?: Vehicle;
  obdData?: ObdData;
  onVehicleSelect?: (vehicleId: string) => void;
}

export function Sidebar({ isConnected, vehicles, selectedVehicle, obdData, onVehicleSelect }: SidebarProps) {
  const [location] = useLocation();
  
  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col slide-in">
      {/* Logo & Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <MapPin className="text-primary-foreground text-xl" />
          </div>
          <div>
            <h1 className="text-lg font-bold">FleetTrack Pro</h1>
            <p className="text-xs text-muted-foreground">GPS Tracking System</p>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <Link href="/">
          <Button 
            variant={location === "/" || location === "/dashboard" ? "secondary" : "ghost"}
            className={`w-full justify-start space-x-3 ${location === "/" || location === "/dashboard" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="nav-live-tracking"
          >
            <MapPin className="w-5 h-5" />
            <span>Live Tracking</span>
          </Button>
        </Link>
        <Button 
          variant="ghost" 
          className="w-full justify-start space-x-3 text-muted-foreground hover:text-foreground"
          data-testid="nav-trip-history"
        >
          <Route className="w-5 h-5" />
          <span>Trip History</span>
        </Button>
        <Button 
          variant="ghost" 
          className="w-full justify-start space-x-3 text-muted-foreground hover:text-foreground"
          data-testid="nav-vehicles"
        >
          <Car className="w-5 h-5" />
          <span>Vehicles</span>
        </Button>
        <Button 
          variant="ghost" 
          className="w-full justify-start space-x-3 text-muted-foreground hover:text-foreground"
          data-testid="nav-analytics"
        >
          <BarChart3 className="w-5 h-5" />
          <span>Analytics</span>
        </Button>
        <Link href="/settings">
          <Button 
            variant={location === "/settings" ? "secondary" : "ghost"}
            className={`w-full justify-start space-x-3 ${location === "/settings" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="nav-settings"
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Button>
        </Link>
      </nav>
      
      {/* Connection Status */}
      <div className="p-4 border-t border-border">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">OBD Connection</span>
            <span className={`status-dot ${isConnected ? 'status-online' : 'status-offline'}`}></span>
          </div>
          <p className={`text-xs font-mono ${isConnected ? 'text-success' : 'text-muted-foreground'}`}
             data-testid="text-obd-status">
            {isConnected ? 'Connected' : 'Disconnected'}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">WebSocket</span>
            <span className={`status-dot ${isConnected ? 'status-online' : 'status-offline'}`}></span>
          </div>
          <p className={`text-xs font-mono ${isConnected ? 'text-success' : 'text-muted-foreground'}`}
             data-testid="text-websocket-status">
            {isConnected ? 'Active' : 'Inactive'}
          </p>
        </Card>
      </div>
      
      {/* Vehicle List */}
      <div className="p-4 border-t border-border">
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Fleet Vehicles ({vehicles.length})</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {vehicles.map((vehicle) => (
            <Card 
              key={vehicle.id} 
              className={`p-3 cursor-pointer transition-colors ${
                selectedVehicle?.id === vehicle.id 
                  ? 'border-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => onVehicleSelect?.(vehicle.id)}
              data-testid={`vehicle-card-${vehicle.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate" data-testid={`text-vehicle-name-${vehicle.id}`}>
                    {vehicle.name}
                  </h4>
                  <p className="text-xs text-muted-foreground truncate" data-testid={`text-vehicle-plate-${vehicle.id}`}>
                    {vehicle.plate}
                  </p>
                </div>
                <Badge 
                  variant="outline" 
                  className={`ml-2 text-xs ${
                    vehicle.isActive 
                      ? 'bg-success/20 text-success border-success/30' 
                      : 'bg-muted/20 text-muted-foreground border-muted/30'
                  }`}
                >
                  {vehicle.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {vehicle.make} {vehicle.model} • {vehicle.year}
              </div>
            </Card>
          ))}
        </div>
      </div>
      
      {/* OBD Data Card */}
      {obdData && (
        <div className="p-4 border-t border-border">
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-4 flex items-center justify-between">
              <span>OBD Diagnostics</span>
              <Plug className="w-4 h-4 text-primary" />
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Engine RPM</span>
                <span className="text-sm font-mono" data-testid="text-obd-rpm">
                  {obdData.rpm?.toLocaleString() || '0'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Coolant Temp</span>
                <span className="text-sm font-mono" data-testid="text-obd-coolant">
                  {Math.round(obdData.coolantTemp || 0)}°F
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Battery Voltage</span>
                <span className="text-sm font-mono" data-testid="text-obd-voltage">
                  {obdData.batteryVoltage?.toFixed(1) || '0.0'}V
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Throttle Position</span>
                <span className="text-sm font-mono" data-testid="text-obd-throttle">
                  {Math.round(obdData.throttlePosition || 0)}%
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}
      
      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium" data-testid="text-user-name">Fleet Manager</p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
          <Button variant="ghost" size="icon" data-testid="button-user-menu">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
