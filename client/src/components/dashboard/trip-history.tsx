import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import type { Vehicle, Trip, ObdData } from "@shared/schema";

interface TripHistoryProps {
  vehicle?: Vehicle;
  trips: Trip[];
  obdData?: ObdData;
}

export function TripHistory({ vehicle, trips, obdData }: TripHistoryProps) {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (date: Date | string) => {
    const tripDate = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - tripDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `Today, ${tripDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      })}`;
    } else if (diffDays === 1) {
      return `Yesterday, ${tripDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      })}`;
    } else {
      return `${diffDays} days ago, ${tripDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      })}`;
    }
  };

  // Calculate weekly summary
  const weeklyTrips = trips.filter(trip => {
    if (!trip.startTime) return false;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return trip.startTime >= weekAgo;
  });

  const totalDistance = weeklyTrips.reduce((sum, trip) => sum + (trip.distance || 0), 0);
  const totalDuration = weeklyTrips.reduce((sum, trip) => sum + (trip.duration || 0), 0);
  const avgSpeed = weeklyTrips.length > 0 
    ? weeklyTrips.reduce((sum, trip) => sum + (trip.avgSpeed || 0), 0) / weeklyTrips.length
    : 0;

  return (
    <div className="flex flex-col space-y-4 h-full overflow-hidden">
      {/* Trip History */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b border-border flex flex-row items-center justify-between py-4">
          <CardTitle className="text-base">Trip History</CardTitle>
          <Button variant="link" size="sm" className="text-primary" data-testid="button-view-all-trips">
            View All
          </Button>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {trips.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">No trips recorded</p>
            </div>
          ) : (
            trips.slice(0, 10).map((trip) => (
              <div 
                key={trip.id}
                className="border border-border rounded-lg p-3 hover:bg-muted/10 transition-colors cursor-pointer"
                data-testid={`trip-entry-${trip.id}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium" data-testid={`trip-route-${trip.id}`}>
                      {trip.startLocation}
                      {trip.endLocation && ` → ${trip.endLocation}`}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`trip-date-${trip.id}`}>
                      {trip.startTime ? formatDate(trip.startTime) : 'Unknown time'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Distance</p>
                    <p className="font-mono" data-testid={`trip-distance-${trip.id}`}>
                      {trip.distance?.toFixed(1) || '0.0'} mi
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Duration</p>
                    <p className="font-mono" data-testid={`trip-duration-${trip.id}`}>
                      {trip.duration ? formatDuration(trip.duration) : '0m'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Speed</p>
                    <p className="font-mono" data-testid={`trip-speed-${trip.id}`}>
                      {Math.round(trip.avgSpeed || 0)} mph
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      
      {/* Weekly Summary */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Weekly Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Trips</span>
            <span className="text-sm font-bold" data-testid="summary-trips">
              {weeklyTrips.length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Distance</span>
            <span className="text-sm font-bold" data-testid="summary-distance">
              {totalDistance.toFixed(0)} mi
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Driving Time</span>
            <span className="text-sm font-bold" data-testid="summary-time">
              {formatDuration(totalDuration)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Avg Speed</span>
            <span className="text-sm font-bold" data-testid="summary-avg-speed">
              {Math.round(avgSpeed)} mph
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
