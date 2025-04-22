import authRouter from './auth.routes.js';
import requestRouter from './request.routes.js';

import { Router } from 'express';

const router = Router();

router.use('/api/v1/auth', authRouter);
router.use('/api/v1/request', requestRouter);

export default router;
