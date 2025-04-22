import express from 'express';
import { registerUser, loginUser, getAllUsers, getCurrentUser } from '../controller/auth.controller.js';
import { requireAuth } from '../middleware/auth_middleware.js'

const authRouter = express.Router();

authRouter.post('/register', registerUser);
authRouter.post('/login', loginUser);
authRouter.get('/users', getAllUsers);
authRouter.get('/me', requireAuth, getCurrentUser);

export default authRouter;
