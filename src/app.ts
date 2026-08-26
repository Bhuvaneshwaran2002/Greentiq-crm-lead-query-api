import express from 'express';
import leadsRoutes from './routes/leads.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

const app = express();

app.use(express.json({ limit: '1mb' }));
app.get('/', (_req, res) => res.status(200).json({ status: 'ok', service: 'lead-query-api' }));
app.use(authMiddleware);
app.use('/api/v1', leadsRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
