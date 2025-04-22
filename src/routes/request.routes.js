import express from 'express';
import { createRequest, acceptRequest,rejectRequest,completeRequest } from '../controller/request.controller.js';
import { requireAuth } from '../middleware/auth_middleware.js';
import { requireRole } from '../middleware/role_middleware.js';

const requestRouter = express.Router();

// ✅ Only PATIENT can create a request
requestRouter.post('/newRequest', requireAuth, requireRole('PATIENT'), createRequest);

// ✅ Only DRIVER can accept a request
requestRouter.post('/:id/accept', requireAuth, requireRole('DRIVER'), acceptRequest);

// ✅ Only DRIVER can reject a request
requestRouter.post('/:id/reject', requireAuth, requireRole('DRIVER'), rejectRequest);

// ✅ Only DRIVER can complete a request
requestRouter.post('/:id/complete', requireAuth, requireRole('DRIVER'), completeRequest);

export default requestRouter;
