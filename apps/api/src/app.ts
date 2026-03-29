import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import "express-async-errors";
import routes from "./routes";
import { errorHandler } from "./middleware/error";
import { env } from "./config/env";

function resolveCorsOrigins(value: string) {
  if (value === "*") {
    return true;
  }
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : false;
}

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: resolveCorsOrigins(env.CORS_ORIGIN) }));
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as typeof req & { rawBody?: string }).rawBody = buf.toString("utf8");
      }
    })
  );
  app.use(morgan("dev"));

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", routes);

  app.use(errorHandler);
  return app;
}
