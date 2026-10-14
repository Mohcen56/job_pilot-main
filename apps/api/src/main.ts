import { webDirectory } from "./paths";
import "reflect-metadata";
// Set the mode before importing the env loader or Next itself.
Object.assign(process.env, { NODE_ENV: process.argv.includes("--production") ? "production" : process.env.NODE_ENV || "development" });

async function bootstrap() {
  await import("./env");
  const [{ NestFactory }, { default: next }, { default: express }, { AppModule }, { isAllowedOrigin }, { appUrl }] = await Promise.all([
    import("@nestjs/core"), import("next"), import("express"), import("./app.module"), import("./http"), import("./auth/service"),
  ]);
  const port = Number(process.env.PORT || 3000);
  const hostname = process.env.HOSTNAME || "0.0.0.0";
  appUrl();
  process.env.__NEXT_PRIVATE_ORIGIN = appUrl();
  const frontend = next({ dir: webDirectory, dev: process.env.NODE_ENV !== "production", port, hostname });
  await frontend.prepare();
  const app = await NestFactory.create(AppModule.register(frontend.getRequestHandler()), { bodyParser: false });
  const { trustedHost, trustedProxies } = await import("./security");
  app.getHttpAdapter().getInstance().set("trust proxy", trustedProxies());
  app.use(trustedHost);
  app.use("/api", (req: import("express").Request, res: import("express").Response, nextMiddleware: import("express").NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !isAllowedOrigin(req.headers.origin)) {
      res.status(403).json({ success: false, error: "This request must come from JobHunt EZ." }); return;
    }
    nextMiddleware();
  });
  // Parsing is restricted to Nest's API routes. Next must receive untouched Server Action bodies.
  app.use("/api", express.json({ limit: "64kb" }), express.urlencoded({ extended: false, limit: "64kb" }));
  app.enableShutdownHooks();
  await app.listen(port, hostname);
  console.log(`JobHunt EZ listening on port ${port}`);
}
bootstrap().catch((error: unknown) => {
  console.error("Startup failed:", error instanceof Error ? error.message : "Check the backend configuration and build output.");
  process.exitCode = 1;
});
