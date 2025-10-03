import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const vehicles = pgTable("vehicles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  plate: text("plate").notNull().unique(),
  vin: text("vin").notNull().unique(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  year: integer("year").notNull(),
  driverId: varchar("driver_id"),
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const drivers = pgTable("drivers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  licenseNumber: text("license_number").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const trips = pgTable("trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  driverId: varchar("driver_id"),
  startLocation: text("start_location").notNull(),
  endLocation: text("end_location"),
  startCoords: jsonb("start_coords").notNull(), // { lat: number, lng: number }
  endCoords: jsonb("end_coords"), // { lat: number, lng: number }
  distance: real("distance").default(0), // in miles
  duration: integer("duration").default(0), // in seconds
  avgSpeed: real("avg_speed").default(0), // in mph
  maxSpeed: real("max_speed").default(0), // in mph
  route: jsonb("route").default([]), // array of { lat: number, lng: number, timestamp: string }
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  status: text("status").default("active"), // active, completed, paused
});

export const vehicleLocations = pgTable("vehicle_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  tripId: varchar("trip_id"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  speed: real("speed").default(0), // mph
  heading: real("heading").default(0), // degrees
  altitude: real("altitude").default(0), // feet
  accuracy: real("accuracy").default(0), // meters
  timestamp: timestamp("timestamp").defaultNow(),
});

export const obdData = pgTable("obd_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  tripId: varchar("trip_id"),
  rpm: integer("rpm").default(0),
  speed: real("speed").default(0), // mph
  coolantTemp: real("coolant_temp").default(0), // fahrenheit
  batteryVoltage: real("battery_voltage").default(0), // volts
  throttlePosition: real("throttle_position").default(0), // percentage
  fuelLevel: real("fuel_level").default(0), // percentage
  engineLoad: real("engine_load").default(0), // percentage
  timestamp: timestamp("timestamp").defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
});

// Insert schemas
export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  createdAt: true,
});

export const insertDriverSchema = createInsertSchema(drivers).omit({
  id: true,
  createdAt: true,
});

export const insertTripSchema = createInsertSchema(trips).omit({
  id: true,
  startTime: true,
  endTime: true,
});

export const insertVehicleLocationSchema = createInsertSchema(vehicleLocations).omit({
  id: true,
  timestamp: true,
});

export const insertObdDataSchema = createInsertSchema(obdData).omit({
  id: true,
  timestamp: true,
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

// Types
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;

export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;

export type VehicleLocation = typeof vehicleLocations.$inferSelect;
export type InsertVehicleLocation = z.infer<typeof insertVehicleLocationSchema>;

export type ObdData = typeof obdData.$inferSelect;
export type InsertObdData = z.infer<typeof insertObdDataSchema>;

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

// Additional types for WebSocket messages
export type LocationUpdate = {
  type: 'location';
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: string;
};

export type ObdUpdate = {
  type: 'obd';
  vehicleId: string;
  rpm: number;
  coolantTemp: number;
  batteryVoltage: number;
  throttlePosition: number;
  fuelLevel: number;
  engineLoad: number;
  timestamp: string;
};

export type WebSocketMessage = LocationUpdate | ObdUpdate;
