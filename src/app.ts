import express from 'express';
import cors from 'cors';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import swaggerUi from 'swagger-ui-express';
import swaggerUiDist from 'swagger-ui-dist';
import leadsRoutes from './routes/leads.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import openApiDocument from './docs/openapi.js';

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({
	origin: allowedOrigins?.length ? allowedOrigins : true,
	allowedHeaders: ['Content-Type', 'x-tenant-id', 'x-user-id', 'x-user-role'],
	methods: ['GET', 'POST', 'OPTIONS'],
}));
app.use(express.json({ limit: '1mb' }));
app.get('/', (_req, res) => res.status(200).json({ status: 'ok', service: 'lead-query-api' }));
app.get('/docs/swagger-ui.css', (_req, res) => {
	res.type('css').send(readFileSync(path.join(swaggerUiDist.getAbsoluteFSPath(), 'swagger-ui.css')));
});
app.use('/docs', express.static(swaggerUiDist.getAbsoluteFSPath(), { index: false }));
app.use('/docs', swaggerUi.serve);
app.use('/docs', swaggerUi.setup(openApiDocument));
app.get('/docs.json', (_req, res) => res.status(200).json(openApiDocument));
app.use(authMiddleware);
app.use('/api/v1', leadsRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
