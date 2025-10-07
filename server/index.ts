import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storagePromise } from "./storage";
import { OneStepGPSService } from "./onestepgps";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Set up automatic OneStepGPS sync every 5 seconds
  const apiKey = process.env.ONESTEPGPS_API_KEY;
  if (apiKey) {
    const storage = await storagePromise;
    const oneStepGPS = new OneStepGPSService(apiKey);
    
    // Initial sync
    oneStepGPS.syncDevicesToVehicles(storage).then(count => {
      log(`Initial OneStepGPS sync completed: ${count} devices`);
    }).catch(err => {
      console.error('Initial OneStepGPS sync failed:', err);
    });

    // Recurring sync every 5 seconds
    setInterval(async () => {
      try {
        const count = await oneStepGPS.syncDevicesToVehicles(storage);
        if (count > 0) {
          log(`OneStepGPS auto-sync: ${count} devices updated`);
        }
      } catch (error) {
        console.error('OneStepGPS auto-sync error:', error);
      }
    }, 5000); // 5 seconds interval
    
    log('OneStepGPS auto-sync enabled (5s interval)');
  } else {
    log('OneStepGPS auto-sync disabled (no API key configured)');
  }
})();
