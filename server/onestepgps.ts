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
      const url = `${this.baseUrl}/device?latest_point=1`;
      console.log('Fetching OneStepGPS devices from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OneStepGPS API error (Bearer auth):', response.status, errorText.substring(0, 200));
        
        console.log('Trying query parameter authentication...');
        const response2 = await fetch(`${this.baseUrl}/device?latest_point=1&api-key=${this.apiKey}`);
        
        if (!response2.ok) {
          const errorText2 = await response2.text();
          console.error('OneStepGPS API error (query param):', response2.status, errorText2.substring(0, 200));
          throw new Error(`OneStepGPS API error: ${response2.statusText}`);
        }
        
        const data2: OneStepGPSResponse = await response2.json();
        console.log('OneStepGPS devices fetched (query param):', data2.result_list?.length || 0);
        return data2.result_list || [];
      }

      const data: OneStepGPSResponse = await response.json();
      console.log('OneStepGPS devices fetched (Bearer):', data.result_list?.length || 0);
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
