import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
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
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.get('/docs.json', (_req, res) => res.status(200).json(openApiDocument));
app.use(authMiddleware);
app.use('/api/v1', leadsRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
