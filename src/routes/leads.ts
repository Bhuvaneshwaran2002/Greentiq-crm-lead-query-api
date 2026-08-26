import { Router } from 'express';
import { queryLeads } from '../controllers/queryLeads.js';

const router = Router();

router.post('/leads/query', queryLeads);

export default router;
