# Fleet Tracking System

## Overview

This is a real-time GPS fleet tracking system built to monitor vehicles, track trips, and display live location data. The application provides a dashboard for viewing vehicle locations on a map, monitoring On-Board Diagnostics (OBD) data, and reviewing trip history. It uses WebSocket technology for real-time updates and features a modern, dark-themed UI for fleet management operations.

## Recent Changes (Oct 2025)

### Multi-Vehicle Map Display
- **Enhanced Dashboard**: The live tracking map now displays ALL vehicles simultaneously with individual markers
- **New API Endpoint**: Added GET `/api/vehicles/locations` to fetch all vehicle locations in one request
- **Map Component Update**: VehicleMap component refactored to support multiple vehicles with:
  - Individual markers for each vehicle with location data
  - Different marker colors (selected vehicle: primary blue, others: green)
  - Popup details on marker click showing vehicle name, plate, speed, and status
  - Auto-fit bounds to show all vehicles on the map
  - Center-on-vehicle button works with selected vehicle or all vehicles
- **OneStepGPS Integration**: Fixed device ID handling to properly sync 6 Dallas-area vehicles with real GPS coordinates

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack**: React with TypeScript, Vite build tool, and Wouter for routing

The frontend follows a component-based architecture with clear separation of concerns:

- **UI Layer**: Built using shadcn/ui components based on Radix UI primitives, providing accessible and customizable UI elements
- **State Management**: TanStack Query (React Query) for server state management with aggressive caching (staleTime: Infinity) and disabled auto-refetching
- **Real-time Communication**: Custom WebSocket hook (`useWebSocket`) that handles connection lifecycle, automatic reconnection with exponential backoff (up to 5 attempts), and message routing to invalidate React Query cache
- **Styling**: Tailwind CSS with CSS variables for theming, supporting a dark mode design system with custom color tokens
- **Map Integration**: Leaflet for interactive mapping with CartoDB dark tiles, vehicle markers, and route visualization

**Design Patterns**:
- Server state is managed through React Query with manual refetch intervals (3-30 seconds depending on data type)
- WebSocket messages trigger cache invalidations to keep UI synchronized
- Path aliases (@/, @shared/) for clean imports across client, server, and shared code

**Rationale**: This approach separates real-time push updates (WebSocket) from request/response patterns (REST API), allowing the system to efficiently handle both live data streams and on-demand queries. The aggressive caching strategy reduces unnecessary network requests while WebSocket ensures timely updates.

### Backend Architecture

**Technology Stack**: Express.js server with TypeScript, running on Node.js

The backend implements a hybrid API architecture:

- **REST API**: Traditional endpoints for CRUD operations on vehicles, drivers, and trips
- **WebSocket Server**: Dedicated `/ws` endpoint for bidirectional real-time communication
- **Storage Layer**: In-memory storage implementation (`MemStorage`) that implements the `IStorage` interface, designed to be easily swapped with a database-backed implementation
- **Development Mode**: Vite middleware integration for HMR and seamless development experience

**Design Patterns**:
- Interface-based storage abstraction (`IStorage`) allows switching between in-memory and database implementations without changing business logic
- WebSocket broadcast pattern to push updates to all connected clients
- Request logging middleware with JSON response capture for debugging

**Rationale**: The in-memory storage is suitable for prototyping and development but should be replaced with a persistent database for production. The interface abstraction makes this migration straightforward. WebSocket broadcast ensures all clients see updates immediately without polling.

**Future Consideration**: The codebase includes Drizzle ORM configuration pointing to PostgreSQL, suggesting a planned migration from in-memory to database storage. The schema is already defined in `shared/schema.ts`.

### Data Models

**Core Entities** (defined in `shared/schema.ts`):

1. **Vehicles**: Stores vehicle information (VIN, plate, make, model, year) and active driver assignment
2. **Drivers**: Driver profiles with license information
3. **Trips**: Complete trip records including start/end locations, coordinates, route history, and calculated metrics (distance, duration, speeds)
4. **Vehicle Locations**: Real-time GPS coordinates with speed and heading data
5. **OBD Data**: On-Board Diagnostics including RPM, engine load, fuel level, coolant temperature, and diagnostic trouble codes

**Schema Design**:
- All tables use UUID primary keys (PostgreSQL `gen_random_uuid()`)
- JSONB fields store complex data (coordinates, routes, diagnostic codes)
- Timestamps track creation and modification times
- Foreign key relationships connect vehicles to drivers and trips

**Validation**: Zod schemas generated from Drizzle tables using `drizzle-zod` for runtime type safety

### Real-time Data Flow

**WebSocket Message Types**:
1. `location`: Live GPS coordinate updates for vehicles
2. `obd`: Real-time OBD diagnostic data updates

**Flow**:
1. Backend receives data via REST POST endpoints
2. Data is stored in the storage layer
3. WebSocket broadcast sends updates to all connected clients
4. Frontend receives message, invalidates relevant React Query cache
5. UI components re-render with fresh data

**Reconnection Strategy**: Exponential backoff with 1-10 second delays over 5 attempts, preventing server overload during network instability.

### Database Strategy

**Current State**: In-memory storage using JavaScript Maps

**Planned State**: PostgreSQL database via Neon serverless driver

**Migration Path**:
- Drizzle ORM configuration already in place (`drizzle.config.ts`)
- Schema definitions compatible with PostgreSQL (`shared/schema.ts`)
- Storage interface allows drop-in replacement of `MemStorage` with database implementation
- Session storage configured for PostgreSQL (`connect-pg-simple`)

**Rationale**: The interface abstraction means the application logic doesn't need to change when migrating to PostgreSQL. Only the `IStorage` implementation needs to be replaced with database queries using Drizzle ORM.

## External Dependencies

### Third-party Services

**Mapping**:
- Leaflet library for map rendering
- CartoDB dark tile server for map tiles (requires internet connectivity)

**Fonts**:
- Google Fonts API: Inter, JetBrains Mono, Architects Daughter, DM Sans, Fira Code, Geist Mono

### Database

**Development**: In-memory JavaScript Maps (current implementation)

**Production**: 
- PostgreSQL database (Neon serverless driver configured)
- Connection via `DATABASE_URL` environment variable
- Drizzle ORM for query building and schema management

### UI Component Library

**shadcn/ui**: Extensive use of Radix UI primitives wrapped with custom styling
- Provides 40+ accessible, customizable components
- Styled with Tailwind CSS using CSS variables for theming
- Components are copied into the project rather than installed as dependencies

### Key npm Packages

**Frontend**:
- `@tanstack/react-query`: Server state management
- `wouter`: Lightweight routing
- `leaflet`: Interactive maps
- `date-fns`: Date formatting utilities
- `zod`: Runtime schema validation

**Backend**:
- `express`: Web server framework
- `ws`: WebSocket implementation
- `drizzle-orm`: Type-safe ORM
- `@neondatabase/serverless`: PostgreSQL driver for Neon

**Build Tools**:
- `vite`: Fast build tool and dev server
- `tsx`: TypeScript execution for development
- `esbuild`: Production bundling for server code

### Environment Requirements

**Required Environment Variables**:
- `DATABASE_URL`: PostgreSQL connection string (Drizzle config requires this, though not currently used by in-memory storage)

**Optional**:
- `NODE_ENV`: Set to "production" or "development"
- `REPL_ID`: Replit-specific identifier for dev tooling