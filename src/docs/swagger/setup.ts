import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { parse } from 'yaml';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';
import { env } from '../../config/env';

function resolveSpecPath(): string {
  const candidates = [
    path.join(__dirname, 'openapi.yaml'),
    path.join(process.cwd(), 'src/docs/swagger/openapi.yaml'),
  ];

  const specPath = candidates.find((candidate) => existsSync(candidate));

  if (!specPath) {
    throw new Error('OpenAPI spec not found. Expected src/docs/swagger/openapi.yaml');
  }

  return specPath;
}

function loadOpenApiSpec() {
  const raw = readFileSync(resolveSpecPath(), 'utf8');
  const spec = parse(raw) as Record<string, unknown>;

  // Update server URL based on environment
  if (Array.isArray(spec.servers) && spec.servers.length > 0) {
    // Replace first server URL with env.apiBaseUrl
    (spec.servers[0] as { url: string; description?: string }).url = env.apiBaseUrl;
    (spec.servers[0] as { url: string; description?: string }).description =
      env.nodeEnv === 'production' ? 'Production server' : 'Development server';
  }

  return spec;
}

export function setupSwagger(app: Express): void {
  try {
    const spec = loadOpenApiSpec();

    app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(spec, {
        customSiteTitle: 'Resisen API Documentation',
        customCss: '.swagger-ui .topbar { display: none }',
      }),
    );

    app.get('/api-docs.json', (_req, res) => {
      res.json(spec);
    });

    console.log(`✅ Swagger UI available at /api-docs`);
  } catch (error) {
    console.error('❌ Failed to load Swagger:', error);
  }
}
