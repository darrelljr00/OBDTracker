import type { IStorage } from './storage';

interface OneStepGPSDevice {
  device_id: string;
  display_name: string;
  active_state: string;
  dt_tracker: string;
  lat: number;
  lng: number;
  angle: number;
  speed: number;
  params?: {
    vin?: string;
  };
}

interface OneStepGPSResponse {
  result_list: OneStepGPSDevice[];
}

export class OneStepGPSService {
  private apiKey: string;
  private baseUrl = 'https://track.onestepgps.com/v3/api/public';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getDevices(): Promise<OneStepGPSDevice[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/device-info?lat_lng=1&api-key=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`OneStepGPS API error: ${response.statusText}`);
      }

      const data: OneStepGPSResponse = await response.json();
      return data.result_list || [];
    } catch (error) {
      console.error('Failed to fetch OneStepGPS devices:', error);
      return [];
    }
  }

  async syncDevicesToVehicles(storage: IStorage): Promise<number> {
    const devices = await this.getDevices();
    let syncedCount = 0;

    for (const device of devices) {
      try {
        // Check if vehicle exists by device_id as plate
        const existingVehicles = await storage.getVehicles();
        let vehicle = existingVehicles.find(v => v.plate === device.device_id);

        if (!vehicle) {
          // Create new vehicle from OneStepGPS device
          vehicle = await storage.createVehicle({
            name: device.display_name || `Vehicle ${device.device_id}`,
            plate: device.device_id,
            vin: device.params?.vin || `ONESTEP-${device.device_id}`,
            make: 'OneStepGPS',
            model: 'Tracked Device',
            year: new Date().getFullYear(),
            isActive: device.active_state === 'active' ? 1 : 0,
          });
        }

        // Update location if we have valid coordinates
        if (device.lat && device.lng) {
          await storage.createVehicleLocation({
            vehicleId: vehicle.id,
            latitude: device.lat,
            longitude: device.lng,
            speed: device.speed || 0,
            heading: device.angle || 0,
            altitude: 0,
            accuracy: 5,
          });

          // Check for active trip and update it
          const activeTrip = await storage.getActiveTrip(vehicle.id);
          if (activeTrip) {
            const currentRoute = (activeTrip.route as Array<{lat: number, lng: number, timestamp: string}>) || [];
            const newRoutePoint = {
              lat: device.lat,
              lng: device.lng,
              timestamp: device.dt_tracker || new Date().toISOString(),
            };
            
            await storage.updateTrip(activeTrip.id, {
              route: [...currentRoute, newRoutePoint] as any,
              maxSpeed: Math.max(activeTrip.maxSpeed || 0, device.speed || 0),
              endCoords: { lat: device.lat, lng: device.lng } as any,
            });
          }
        }

        syncedCount++;
      } catch (error) {
        console.error(`Failed to sync device ${device.device_id}:`, error);
      }
    }

    return syncedCount;
  }
}
