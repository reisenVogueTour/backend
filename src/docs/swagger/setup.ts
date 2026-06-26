import path from "path";
import { existsSync, readFileSync } from "fs";
import { parse } from "yaml";
import swaggerUi from "swagger-ui-express";
import type { Express } from "express";
import { env } from "../../config/env";

function resolveSpecPath(): string {
  const candidates = [
    path.join(__dirname, "openapi.yaml"),
    path.join(process.cwd(), "src/docs/swagger/openapi.yaml"),
  ];

  const specPath = candidates.find((candidate) => existsSync(candidate));

  if (!specPath) {
    throw new Error("OpenAPI spec not found. Expected src/docs/swagger/openapi.yaml");
  }

  return specPath;
}

function loadOpenApiSpec() {
  const raw = readFileSync(resolveSpecPath(), "utf8");
  const spec = parse(raw) as Record<string, unknown>;

  if (Array.isArray(spec.servers) && spec.servers[0]) {
    (spec.servers[0] as { url: string }).url = env.apiBaseUrl;
  }

  return spec;
}

export function setupSwagger(app: Express): void {
  const spec = loadOpenApiSpec();

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(spec));
  app.get("/api-docs.json", (_req, res) => {
    res.json(spec);
  });
}
