import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storagePromise } from "./storage";
import { 
  insertVehicleLocationSchema, 
  insertObdDataSchema,
  insertApiKeySchema,
  type WebSocketMessage,
  type LocationUpdate,
  type ObdUpdate 
} from "@shared/schema";
import { z } from "zod";
import { randomBytes } from "crypto";
import { OneStepGPSService } from "./onestepgps";

// Haversine formula to calculate distance between two GPS coordinates (in miles)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const storage = await storagePromise;
  const httpServer = createServer(app);

  // WebSocket server for real-time communication
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    clients.add(ws);

    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Broadcast to all connected clients
  const broadcast = (message: WebSocketMessage) => {
    const data = JSON.stringify(message);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  };

  // API Key validation middleware for OBD devices
  const validateApiKey = async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.header('X-API-Key');
    
    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }

    const key = await storage.getApiKey(apiKey);
    if (!key) {
      return res.status(403).json({ error: "Invalid API key" });
    }

    // Update last used timestamp
    await storage.updateApiKeyLastUsed(apiKey);
    
    next();
  };

  // Admin authentication middleware for API key management
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    // For now, API key management is only accessible from the same origin
    // In production, this should be protected by proper user authentication
    const origin = req.header('Origin') || req.header('Referer');
    const host = req.header('Host');
    
    // Allow requests from same origin (our frontend)
    if (origin && host && origin.includes(host)) {
      return next();
    }
    
    // Block external requests
    return res.status(403).json({ error: "Unauthorized access" });
  };

  // API Routes

  // Get all vehicles
  app.get("/api/vehicles", async (req, res) => {
    try {
      const vehicles = await storage.getVehicles();
      res.json(vehicles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  });

  // Get all vehicle locations
  app.get("/api/vehicles/locations", async (req, res) => {
    try {
      const locations = await storage.getAllVehicleLocations();
      res.json(locations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch locations" });
    }
  });

  // Get vehicle by ID
  app.get("/api/vehicles/:id", async (req, res) => {
    try {
      const vehicle = await storage.getVehicle(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      res.json(vehicle);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vehicle" });
    }
  });

  // Get vehicle's current location
  app.get("/api/vehicles/:id/location", async (req, res) => {
    try {
      const location = await storage.getVehicleLocation(req.params.id);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      res.json(location);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch location" });
    }
  });

  // Get vehicle's latest OBD data
  app.get("/api/vehicles/:id/obd", async (req, res) => {
    try {
      const obdData = await storage.getLatestObdData(req.params.id);
      if (!obdData) {
        return res.status(404).json({ error: "OBD data not found" });
      }
      res.json(obdData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch OBD data" });
    }
  });

  // Get vehicle's trip history
  app.get("/api/vehicles/:id/trips", async (req, res) => {
    try {
      const trips = await storage.getTripsByVehicle(req.params.id);
      res.json(trips);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trips" });
    }
  });

  // Get active trip for vehicle
  app.get("/api/vehicles/:id/active-trip", async (req, res) => {
    try {
      const trip = await storage.getActiveTrip(req.params.id);
      if (!trip) {
        return res.status(404).json({ error: "No active trip found" });
      }
      res.json(trip);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active trip" });
    }
  });

  // Get trip route data
  app.get("/api/trips/:id/route", async (req, res) => {
    try {
      const route = await storage.getVehicleRoute(req.params.id);
      res.json(route);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch route" });
    }
  });

  // API Key management routes (admin only)
  app.get("/api/keys", requireAdmin, async (req, res) => {
    try {
      const keys = await storage.getApiKeys();
      res.json(keys);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });

  app.post("/api/keys", requireAdmin, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }
      
      // Generate a secure random API key
      const key = `fts_${randomBytes(32).toString('hex')}`;
      
      const apiKey = await storage.createApiKey({
        key,
        name,
        isActive: 1,
      });
      
      res.json(apiKey);
    } catch (error) {
      res.status(500).json({ error: "Failed to create API key" });
    }
  });

  app.delete("/api/keys/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteApiKey(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete API key" });
    }
  });

  // Config settings routes (admin only)
  app.get("/api/config/:key", requireAdmin, async (req, res) => {
    try {
      const setting = await storage.getConfigSetting(req.params.key);
      res.json(setting || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.post("/api/config", requireAdmin, async (req, res) => {
    try {
      const { key, value } = req.body;
      if (!key) {
        return res.status(400).json({ error: "Key is required" });
      }
      
      const setting = await storage.upsertConfigSetting({ key, value });
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: "Failed to save setting" });
    }
  });

  // OneStepGPS integration routes
  app.post("/api/onestepgps/sync", requireAdmin, async (req, res) => {
    try {
      const apiKey = process.env.ONESTEPGPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "OneStepGPS API key not configured" });
      }

      const oneStepGPS = new OneStepGPSService(apiKey);
      const syncedCount = await oneStepGPS.syncDevicesToVehicles(storage);
      
      res.json({ 
        success: true, 
        syncedCount,
        message: `Successfully synced ${syncedCount} devices from OneStepGPS`
      });
    } catch (error) {
      console.error('OneStepGPS sync error:', error);
      res.status(500).json({ error: "Failed to sync OneStepGPS devices" });
    }
  });

  app.get("/api/onestepgps/devices", requireAdmin, async (req, res) => {
    try {
      const apiKey = process.env.ONESTEPGPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "OneStepGPS API key not configured" });
      }

      const oneStepGPS = new OneStepGPSService(apiKey);
      const devices = await oneStepGPS.getDevices();
      
      res.json({ devices, count: devices.length });
    } catch (error) {
      console.error('OneStepGPS devices fetch error:', error);
      res.status(500).json({ error: "Failed to fetch OneStepGPS devices" });
    }
  });

  // OBD device endpoint - receive GPS coordinates and vehicle data
  app.post("/api/obd/location", validateApiKey, async (req, res) => {
    try {
      const locationData = insertVehicleLocationSchema.parse(req.body);
      const location = await storage.createVehicleLocation(locationData);
      
      // If there's an active trip, append this location to the route
      const activeTrip = await storage.getActiveTrip(location.vehicleId);
      if (activeTrip) {
        const currentRoute = (activeTrip.route as Array<{lat: number, lng: number, timestamp: string}>) || [];
        const newRoutePoint = {
          lat: location.latitude,
          lng: location.longitude,
          timestamp: location.timestamp!.toISOString(),
        };
        
        // Calculate distance from previous point if available
        let additionalDistance = 0;
        if (currentRoute.length > 0) {
          const lastPoint = currentRoute[currentRoute.length - 1];
          additionalDistance = calculateDistance(
            lastPoint.lat,
            lastPoint.lng,
            location.latitude,
            location.longitude
          );
        }
        
        // Update trip with new route point and statistics
        await storage.updateTrip(activeTrip.id, {
          route: [...currentRoute, newRoutePoint] as any,
          distance: (activeTrip.distance || 0) + additionalDistance,
          maxSpeed: Math.max(activeTrip.maxSpeed || 0, location.speed || 0),
          endCoords: { lat: location.latitude, lng: location.longitude } as any,
        });
      }
      
      // Broadcast location update via WebSocket
      const locationUpdate: LocationUpdate = {
        type: 'location',
        vehicleId: location.vehicleId,
        latitude: location.latitude,
        longitude: location.longitude,
        speed: location.speed ?? 0,
        heading: location.heading ?? 0,
        timestamp: location.timestamp!.toISOString(),
      };
      broadcast(locationUpdate);
      
      res.json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid location data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to store location data" });
    }
  });

  // OBD device endpoint - receive diagnostic data
  app.post("/api/obd/data", validateApiKey, async (req, res) => {
    try {
      const obdDataInput = insertObdDataSchema.parse(req.body);
      const obdData = await storage.createObdData(obdDataInput);
      
      // Broadcast OBD update via WebSocket
      const obdUpdate: ObdUpdate = {
        type: 'obd',
        vehicleId: obdData.vehicleId,
        rpm: obdData.rpm ?? 0,
        coolantTemp: obdData.coolantTemp ?? 0,
        batteryVoltage: obdData.batteryVoltage ?? 0,
        throttlePosition: obdData.throttlePosition ?? 0,
        fuelLevel: obdData.fuelLevel ?? 0,
        engineLoad: obdData.engineLoad ?? 0,
        timestamp: obdData.timestamp!.toISOString(),
      };
      broadcast(obdUpdate);
      
      res.json(obdData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid OBD data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to store OBD data" });
    }
  });

  // Start a new trip
  app.post("/api/trips", async (req, res) => {
    try {
      const { vehicleId, driverId, startLocation, startCoords } = req.body;
      
      // Check if vehicle already has an active trip
      const activeTrip = await storage.getActiveTrip(vehicleId);
      if (activeTrip) {
        return res.status(400).json({ error: "Vehicle already has an active trip" });
      }
      
      const trip = await storage.createTrip({
        vehicleId,
        driverId,
        startLocation,
        startCoords,
        endLocation: null,
        endCoords: null,
        distance: 0,
        duration: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        route: [],
        status: "active",
      });
      
      res.json(trip);
    } catch (error) {
      res.status(500).json({ error: "Failed to create trip" });
    }
  });

  // Complete a trip
  app.post("/api/trips/:id/complete", async (req, res) => {
    try {
      const { endLocation, endCoords } = req.body;
      const trip = await storage.completeTrip(req.params.id, endLocation, endCoords);
      
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      res.json(trip);
    } catch (error) {
      res.status(500).json({ error: "Failed to complete trip" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      connections: clients.size 
    });
  });

  return httpServer;
}
