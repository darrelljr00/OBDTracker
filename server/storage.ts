import { 
  type Vehicle, 
  type InsertVehicle,
  type Driver,
  type InsertDriver,
  type Trip,
  type InsertTrip,
  type VehicleLocation,
  type InsertVehicleLocation,
  type ObdData,
  type InsertObdData,
  type ApiKey,
  type InsertApiKey
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Vehicle operations
  getVehicle(id: string): Promise<Vehicle | undefined>;
  getVehicles(): Promise<Vehicle[]>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, updates: Partial<InsertVehicle>): Promise<Vehicle | undefined>;

  // Driver operations
  getDriver(id: string): Promise<Driver | undefined>;
  getDrivers(): Promise<Driver[]>;
  createDriver(driver: InsertDriver): Promise<Driver>;

  // Trip operations
  getTrip(id: string): Promise<Trip | undefined>;
  getTripsByVehicle(vehicleId: string): Promise<Trip[]>;
  getActiveTrip(vehicleId: string): Promise<Trip | undefined>;
  createTrip(trip: InsertTrip): Promise<Trip>;
  updateTrip(id: string, updates: Partial<Trip>): Promise<Trip | undefined>;
  completeTrip(id: string, endLocation: string, endCoords: { lat: number; lng: number }): Promise<Trip | undefined>;

  // Location operations
  getVehicleLocation(vehicleId: string): Promise<VehicleLocation | undefined>;
  getVehicleRoute(tripId: string): Promise<VehicleLocation[]>;
  createVehicleLocation(location: InsertVehicleLocation): Promise<VehicleLocation>;

  // OBD operations
  getLatestObdData(vehicleId: string): Promise<ObdData | undefined>;
  createObdData(data: InsertObdData): Promise<ObdData>;

  // API Key operations
  getApiKeys(): Promise<ApiKey[]>;
  getApiKey(key: string): Promise<ApiKey | undefined>;
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  deleteApiKey(id: string): Promise<void>;
  updateApiKeyLastUsed(key: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private vehicles: Map<string, Vehicle> = new Map();
  private drivers: Map<string, Driver> = new Map();
  private trips: Map<string, Trip> = new Map();
  private vehicleLocations: Map<string, VehicleLocation> = new Map();
  private obdData: Map<string, ObdData> = new Map();

  constructor() {
    this.seedData();
  }

  private seedData() {
    // Create a sample driver
    const driver: Driver = {
      id: "driver-1",
      name: "Sarah Johnson",
      licenseNumber: "DL123456789",
      createdAt: new Date(),
    };
    this.drivers.set(driver.id, driver);

    // Create a sample vehicle
    const vehicle: Vehicle = {
      id: "vehicle-1",
      name: "Tesla Model S",
      plate: "ABC-1234",
      vin: "5YJ3E1EA7KF123456",
      make: "Tesla",
      model: "Model S",
      year: 2023,
      driverId: driver.id,
      isActive: 1,
      createdAt: new Date(),
    };
    this.vehicles.set(vehicle.id, vehicle);

    // Create a sample active trip
    const trip: Trip = {
      id: "trip-1",
      vehicleId: vehicle.id,
      driverId: driver.id,
      startLocation: "1250 Broadway, New York, NY 10001",
      endLocation: null,
      startCoords: { lat: 40.7485, lng: -73.9883 },
      endCoords: null,
      distance: 142.3,
      duration: 10020, // 2 hours 47 minutes in seconds
      avgSpeed: 51,
      maxSpeed: 75,
      route: [],
      startTime: new Date(Date.now() - 2.5 * 60 * 60 * 1000), // 2.5 hours ago
      endTime: null,
      status: "active",
    };
    this.trips.set(trip.id, trip);

    // Create current vehicle location
    const location: VehicleLocation = {
      id: "location-1",
      vehicleId: vehicle.id,
      tripId: trip.id,
      latitude: 40.7485,
      longitude: -73.9883,
      speed: 68,
      heading: 45,
      altitude: 50,
      accuracy: 5,
      timestamp: new Date(),
    };
    this.vehicleLocations.set(`${vehicle.id}-current`, location);

    // Create current OBD data
    const obd: ObdData = {
      id: "obd-1",
      vehicleId: vehicle.id,
      tripId: trip.id,
      rpm: 2450,
      speed: 68,
      coolantTemp: 195,
      batteryVoltage: 14.2,
      throttlePosition: 32,
      fuelLevel: 67,
      engineLoad: 45,
      timestamp: new Date(),
    };
    this.obdData.set(`${vehicle.id}-current`, obd);
  }

  // Vehicle operations
  async getVehicle(id: string): Promise<Vehicle | undefined> {
    return this.vehicles.get(id);
  }

  async getVehicles(): Promise<Vehicle[]> {
    return Array.from(this.vehicles.values());
  }

  async createVehicle(insertVehicle: InsertVehicle): Promise<Vehicle> {
    const vehicle: Vehicle = {
      ...insertVehicle,
      id: randomUUID(),
      driverId: insertVehicle.driverId ?? null,
      isActive: insertVehicle.isActive ?? 1,
      createdAt: new Date(),
    };
    this.vehicles.set(vehicle.id, vehicle);
    return vehicle;
  }

  async updateVehicle(id: string, updates: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const vehicle = this.vehicles.get(id);
    if (!vehicle) return undefined;
    
    const updated = { ...vehicle, ...updates };
    this.vehicles.set(id, updated);
    return updated;
  }

  // Driver operations
  async getDriver(id: string): Promise<Driver | undefined> {
    return this.drivers.get(id);
  }

  async getDrivers(): Promise<Driver[]> {
    return Array.from(this.drivers.values());
  }

  async createDriver(insertDriver: InsertDriver): Promise<Driver> {
    const driver: Driver = {
      ...insertDriver,
      id: randomUUID(),
      createdAt: new Date(),
    };
    this.drivers.set(driver.id, driver);
    return driver;
  }

  // Trip operations
  async getTrip(id: string): Promise<Trip | undefined> {
    return this.trips.get(id);
  }

  async getTripsByVehicle(vehicleId: string): Promise<Trip[]> {
    return Array.from(this.trips.values())
      .filter(trip => trip.vehicleId === vehicleId)
      .sort((a, b) => b.startTime!.getTime() - a.startTime!.getTime());
  }

  async getActiveTrip(vehicleId: string): Promise<Trip | undefined> {
    return Array.from(this.trips.values())
      .find(trip => trip.vehicleId === vehicleId && trip.status === "active");
  }

  async createTrip(insertTrip: InsertTrip): Promise<Trip> {
    const trip: Trip = {
      ...insertTrip,
      id: randomUUID(),
      driverId: insertTrip.driverId ?? null,
      endLocation: insertTrip.endLocation ?? null,
      endCoords: insertTrip.endCoords ?? null,
      distance: insertTrip.distance ?? 0,
      duration: insertTrip.duration ?? 0,
      avgSpeed: insertTrip.avgSpeed ?? 0,
      maxSpeed: insertTrip.maxSpeed ?? 0,
      route: insertTrip.route ?? [],
      status: insertTrip.status ?? "active",
      startTime: new Date(),
      endTime: null,
    };
    this.trips.set(trip.id, trip);
    return trip;
  }

  async updateTrip(id: string, updates: Partial<Trip>): Promise<Trip | undefined> {
    const trip = this.trips.get(id);
    if (!trip) return undefined;
    
    const updated = { ...trip, ...updates };
    this.trips.set(id, updated);
    return updated;
  }

  async completeTrip(id: string, endLocation: string, endCoords: { lat: number; lng: number }): Promise<Trip | undefined> {
    const trip = this.trips.get(id);
    if (!trip) return undefined;
    
    const updated: Trip = {
      ...trip,
      endLocation,
      endCoords,
      endTime: new Date(),
      status: "completed",
    };
    this.trips.set(id, updated);
    return updated;
  }

  // Location operations
  async getVehicleLocation(vehicleId: string): Promise<VehicleLocation | undefined> {
    return this.vehicleLocations.get(`${vehicleId}-current`);
  }

  async getVehicleRoute(tripId: string): Promise<VehicleLocation[]> {
    return Array.from(this.vehicleLocations.values())
      .filter(location => location.tripId === tripId)
      .sort((a, b) => a.timestamp!.getTime() - b.timestamp!.getTime());
  }

  async createVehicleLocation(insertLocation: InsertVehicleLocation): Promise<VehicleLocation> {
    const location: VehicleLocation = {
      ...insertLocation,
      id: randomUUID(),
      tripId: insertLocation.tripId ?? null,
      speed: insertLocation.speed ?? 0,
      heading: insertLocation.heading ?? 0,
      altitude: insertLocation.altitude ?? 0,
      accuracy: insertLocation.accuracy ?? 0,
      timestamp: new Date(),
    };
    
    // Store as current location for the vehicle
    this.vehicleLocations.set(`${location.vehicleId}-current`, location);
    
    // Also store with unique ID for route history
    this.vehicleLocations.set(location.id, location);
    
    return location;
  }

  // OBD operations
  async getLatestObdData(vehicleId: string): Promise<ObdData | undefined> {
    return this.obdData.get(`${vehicleId}-current`);
  }

  async createObdData(insertData: InsertObdData): Promise<ObdData> {
    const data: ObdData = {
      ...insertData,
      id: randomUUID(),
      tripId: insertData.tripId ?? null,
      rpm: insertData.rpm ?? 0,
      speed: insertData.speed ?? 0,
      coolantTemp: insertData.coolantTemp ?? 0,
      batteryVoltage: insertData.batteryVoltage ?? 0,
      throttlePosition: insertData.throttlePosition ?? 0,
      fuelLevel: insertData.fuelLevel ?? 0,
      engineLoad: insertData.engineLoad ?? 0,
      timestamp: new Date(),
    };
    
    // Store as current data for the vehicle
    this.obdData.set(`${data.vehicleId}-current`, data);
    
    // Also store with unique ID for history
    this.obdData.set(data.id, data);
    
    return data;
  }

  // API Key operations (stub implementations for temporary MemStorage)
  async getApiKeys(): Promise<ApiKey[]> {
    return [];
  }

  async getApiKey(key: string): Promise<ApiKey | undefined> {
    return undefined;
  }

  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    throw new Error('MemStorage does not support API key creation');
  }

  async deleteApiKey(id: string): Promise<void> {
    throw new Error('MemStorage does not support API key deletion');
  }

  async updateApiKeyLastUsed(key: string): Promise<void> {
    // No-op for temporary storage
  }
}

import { DbStorage } from './db-storage';

async function seedDatabase(dbStorage: DbStorage) {
  const existingVehicles = await dbStorage.getVehicles();
  if (existingVehicles.length > 0) {
    return;
  }

  const driver = await dbStorage.createDriver({
    name: "Sarah Johnson",
    licenseNumber: "DL123456789",
  });

  const vehicle = await dbStorage.createVehicle({
    name: "Tesla Model S",
    plate: "ABC-1234",
    vin: "5YJ3E1EA7KF123456",
    make: "Tesla",
    model: "Model S",
    year: 2023,
    driverId: driver.id,
    isActive: 1,
  });

  const trip = await dbStorage.createTrip({
    vehicleId: vehicle.id,
    driverId: driver.id,
    startLocation: "1250 Broadway, New York, NY 10001",
    endLocation: null,
    startCoords: { lat: 40.7485, lng: -73.9883 },
    endCoords: null,
    distance: 142.3,
    duration: 10020,
    avgSpeed: 51,
    maxSpeed: 75,
    route: [],
    status: "active",
  });

  // Create initial location for the trip
  await dbStorage.createVehicleLocation({
    vehicleId: vehicle.id,
    tripId: trip.id,
    latitude: 40.7485,
    longitude: -73.9883,
    speed: 68,
    heading: 45,
    altitude: 50,
    accuracy: 5,
  });

  await dbStorage.createObdData({
    vehicleId: vehicle.id,
    tripId: trip.id,
    rpm: 2450,
    speed: 68,
    coolantTemp: 195,
    batteryVoltage: 14.2,
    throttlePosition: 32,
    fuelLevel: 67,
    engineLoad: 45,
  });

  console.log('Database seeded with initial data');
}

async function initializeStorage(): Promise<IStorage> {
  const dbStorage = new DbStorage();
  await seedDatabase(dbStorage);
  console.log('Database storage initialized');
  return dbStorage;
}

export const storagePromise = initializeStorage();
export let storage: IStorage;
