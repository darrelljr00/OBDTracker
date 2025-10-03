import { Card } from "@/components/ui/card";
import { Gauge, Route, Clock, Fuel } from "lucide-react";
import type { VehicleLocation, ObdData, Trip } from "@shared/schema";

interface MetricsStripProps {
  location?: VehicleLocation;
  obdData?: ObdData;
  activeTrip?: Trip;
}

export function MetricsStrip({ location, obdData, activeTrip }: MetricsStripProps) {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      {/* Speed Card */}
      <Card className="p-4 metric-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Speed</span>
          <Gauge className="w-4 h-4 text-primary" />
        </div>
        <p className="text-2xl font-bold font-mono" data-testid="metric-speed">
          {Math.round(location?.speed || obdData?.speed || 0)}
        </p>
        <p className="text-xs text-muted-foreground">mph</p>
      </Card>
      
      {/* Distance Card */}
      <Card className="p-4 metric-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Distance</span>
          <Route className="w-4 h-4 text-secondary" />
        </div>
        <p className="text-2xl font-bold font-mono" data-testid="metric-distance">
          {activeTrip?.distance?.toFixed(1) || '0.0'}
        </p>
        <p className="text-xs text-muted-foreground">miles</p>
      </Card>
      
      {/* Duration Card */}
      <Card className="p-4 metric-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Duration</span>
          <Clock className="w-4 h-4 text-warning" />
        </div>
        <p className="text-2xl font-bold font-mono" data-testid="metric-duration">
          {activeTrip?.duration ? formatDuration(activeTrip.duration) : '0:00'}
        </p>
        <p className="text-xs text-muted-foreground">hours</p>
      </Card>
      
      {/* Fuel Card */}
      <Card className="p-4 metric-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Fuel</span>
          <Fuel className="w-4 h-4 text-success" />
        </div>
        <p className="text-2xl font-bold font-mono" data-testid="metric-fuel">
          {Math.round(obdData?.fuelLevel || 0)}
        </p>
        <p className="text-xs text-muted-foreground">%</p>
      </Card>
    </div>
  );
}
