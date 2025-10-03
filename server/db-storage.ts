import { eq, desc, and } from 'drizzle-orm';
import { db } from './db';
import { 
  vehicles, 
  drivers, 
  trips, 
  vehicleLocations, 
  obdData,
  apiKeys,
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
} from '@shared/schema';
import type { IStorage } from './storage';

export class DbStorage implements IStorage {
  async getVehicle(id: string): Promise<Vehicle | undefined> {
    const result = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
    return result[0];
  }

  async getVehicles(): Promise<Vehicle[]> {
    return await db.select().from(vehicles);
  }

  async createVehicle(insertVehicle: InsertVehicle): Promise<Vehicle> {
    const result = await db.insert(vehicles).values(insertVehicle).returning();
    return result[0];
  }

  async updateVehicle(id: string, updates: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const result = await db.update(vehicles)
      .set(updates)
      .where(eq(vehicles.id, id))
      .returning();
    return result[0];
  }

  async getDriver(id: string): Promise<Driver | undefined> {
    const result = await db.select().from(drivers).where(eq(drivers.id, id)).limit(1);
    return result[0];
  }

  async getDrivers(): Promise<Driver[]> {
    return await db.select().from(drivers);
  }

  async createDriver(insertDriver: InsertDriver): Promise<Driver> {
    const result = await db.insert(drivers).values(insertDriver).returning();
    return result[0];
  }

  async getTrip(id: string): Promise<Trip | undefined> {
    const result = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
    return result[0];
  }

  async getTripsByVehicle(vehicleId: string): Promise<Trip[]> {
    return await db.select()
      .from(trips)
      .where(eq(trips.vehicleId, vehicleId))
      .orderBy(desc(trips.startTime));
  }

  async getActiveTrip(vehicleId: string): Promise<Trip | undefined> {
    const result = await db.select()
      .from(trips)
      .where(and(
        eq(trips.vehicleId, vehicleId),
        eq(trips.status, 'active')
      ))
      .limit(1);
    return result[0];
  }

  async createTrip(insertTrip: InsertTrip): Promise<Trip> {
    const result = await db.insert(trips).values(insertTrip).returning();
    return result[0];
  }

  async updateTrip(id: string, updates: Partial<Trip>): Promise<Trip | undefined> {
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    
    if (Object.keys(cleanUpdates).length === 0) {
      return this.getTrip(id);
    }
    
    const result = await db.update(trips)
      .set(cleanUpdates)
      .where(eq(trips.id, id))
      .returning();
    return result[0];
  }

  async completeTrip(id: string, endLocation: string, endCoords: { lat: number; lng: number }): Promise<Trip | undefined> {
    const result = await db.update(trips)
      .set({
        endLocation,
        endCoords,
        endTime: new Date(),
        status: 'completed'
      })
      .where(eq(trips.id, id))
      .returning();
    return result[0];
  }

  async getVehicleLocation(vehicleId: string): Promise<VehicleLocation | undefined> {
    const result = await db.select()
      .from(vehicleLocations)
      .where(eq(vehicleLocations.vehicleId, vehicleId))
      .orderBy(desc(vehicleLocations.timestamp))
      .limit(1);
    return result[0];
  }

  async getVehicleRoute(tripId: string): Promise<VehicleLocation[]> {
    return await db.select()
      .from(vehicleLocations)
      .where(eq(vehicleLocations.tripId, tripId))
      .orderBy(vehicleLocations.timestamp);
  }

  async createVehicleLocation(insertLocation: InsertVehicleLocation): Promise<VehicleLocation> {
    const result = await db.insert(vehicleLocations).values(insertLocation).returning();
    return result[0];
  }

  async getLatestObdData(vehicleId: string): Promise<ObdData | undefined> {
    const result = await db.select()
      .from(obdData)
      .where(eq(obdData.vehicleId, vehicleId))
      .orderBy(desc(obdData.timestamp))
      .limit(1);
    return result[0];
  }

  async createObdData(insertData: InsertObdData): Promise<ObdData> {
    const result = await db.insert(obdData).values(insertData).returning();
    return result[0];
  }

  async getApiKeys(): Promise<ApiKey[]> {
    return await db.select().from(apiKeys);
  }

  async getApiKey(key: string): Promise<ApiKey | undefined> {
    const result = await db.select()
      .from(apiKeys)
      .where(and(eq(apiKeys.key, key), eq(apiKeys.isActive, 1)))
      .limit(1);
    return result[0];
  }

  async createApiKey(insertApiKey: InsertApiKey): Promise<ApiKey> {
    const result = await db.insert(apiKeys).values(insertApiKey).returning();
    return result[0];
  }

  async deleteApiKey(id: string): Promise<void> {
    await db.update(apiKeys)
      .set({ isActive: 0 })
      .where(eq(apiKeys.id, id));
  }

  async updateApiKeyLastUsed(key: string): Promise<void> {
    await db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.key, key));
  }
}
