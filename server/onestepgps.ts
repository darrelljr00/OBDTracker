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

type OneStepGPSResponse = OneStepGPSDevice[];

export class OneStepGPSService {
  private apiKey: string;
  private baseUrl = 'https://track.onestepgps.com/v3/api/public';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getDevices(): Promise<OneStepGPSDevice[]> {
    try {
      const url = `${this.baseUrl}/device-info?lat_lng=1&api-key=${this.apiKey}`;
      console.log('Fetching OneStepGPS devices from:', url.replace(this.apiKey, '***'));
      console.log('API key first 5 chars:', this.apiKey.substring(0, 5), 'length:', this.apiKey.length);
      
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OneStepGPS API error:', response.status, response.statusText);
        console.error('Error details:', errorText.substring(0, 200));
        throw new Error(`OneStepGPS API error: ${response.statusText}`);
      }

      const data: OneStepGPSResponse = await response.json();
      console.log('OneStepGPS API response:', JSON.stringify(data, null, 2));
      console.log('OneStepGPS devices fetched successfully:', data?.length || 0);
      return data || [];
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
        // Use display_name as unique identifier since device_id isn't provided
        const deviceId = device.device_id || device.display_name;
        
        // Check if vehicle exists by device_id or display_name as plate
        const existingVehicles = await storage.getVehicles();
        let vehicle = existingVehicles.find(v => v.plate === deviceId || v.name === device.display_name);

        if (!vehicle) {
          // Create new vehicle from OneStepGPS device
          vehicle = await storage.createVehicle({
            name: device.display_name || `Vehicle ${deviceId}`,
            plate: deviceId,
            vin: device.params?.vin || `ONESTEP-${deviceId}`,
            make: 'OneStepGPS',
            model: 'Tracked Device',
            year: new Date().getFullYear(),
            isActive: device.active_state === 'active' ? 1 : 0,
          });
        } else {
          // Update existing vehicle's active status
          const newActiveState = device.active_state === 'active' ? 1 : 0;
          if (vehicle.isActive !== newActiveState) {
            vehicle = await storage.updateVehicle(vehicle.id, {
              isActive: newActiveState,
            }) || vehicle;
          }
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
