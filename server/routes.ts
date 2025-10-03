import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storagePromise } from "./storage";
import { 
  insertVehicleLocationSchema, 
  insertObdDataSchema,
  type WebSocketMessage,
  type LocationUpdate,
  type ObdUpdate 
} from "@shared/schema";
import { z } from "zod";

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

  // OBD device endpoint - receive GPS coordinates and vehicle data
  app.post("/api/obd/location", async (req, res) => {
    try {
      const locationData = insertVehicleLocationSchema.parse(req.body);
      const location = await storage.createVehicleLocation(locationData);
      
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
  app.post("/api/obd/data", async (req, res) => {
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
