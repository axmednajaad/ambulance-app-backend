// src/controllers/auth.controller.ts
import prisma from '../config/db.js';
import { generateToken } from '../utils/jwt.js';
import { hashPassword, compareHashedPasswords } from '../utils/hash_utils.js';
import { sendResponse } from '../utils/response.js';

export const registerUser = async (req, res,next) => {
  try {
    const { email, password, role } = req.body;

    console.log(`register req.body: ${JSON.stringify(req.body)}`);

    // Input validation
    if (!email || !password) {
      return sendResponse(res, 400, 'error', 'Email and password are required');
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendResponse(res, 400, 'error', 'Invalid email format');
    }

    // Validate password strength
    if (password.length < 8) {
      return sendResponse(res, 400, 'error', 'Password must be at least 8 characters');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return sendResponse(res, 409, 'error', 'Email already exists');
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: role
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    const token = generateToken(user.id, user.role);
    return sendResponse(res, 201, 'success', 'Registration successful', {
      data: {
        user,
        token
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    next(err);
  }
};

export const loginUser = async (req, res,next) => {
  try {
    const { email, password } = req.body;

    console.log(`login req.body: ${JSON.stringify(req.body)}`);

    // Input validation
    if (!email || !password) {
      return sendResponse(res, 400, 'error', 'Email and password are required');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return sendResponse(res, 401, 'error', 'Invalid credentials');
    }

    const valid = await compareHashedPasswords(password, user.password);
    if (!valid) {
      return sendResponse(res, 401, 'error', 'Invalid credentials');
    }

    const token = generateToken(user.id, user.role);
    return sendResponse(res, 200, 'success', 'Login successful', {
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        token
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    next(err);
  }
};

export const getAllUsers = async (req, res,next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    return sendResponse(res, 200, 'success', 'Users retrieved successfully', {
      data: users
    });
  } catch (err) {
    console.error('Get users error:', err);
    next(err);
  }
};


export const getCurrentUser = async (req, res, next) => {
  try {
    const userId = req.user.userId; // set from token in middleware

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    if (!user) {
      return sendResponse(res, 404, 'error', 'User not found');
    }

    return sendResponse(res, 200, 'success', 'Current user retrieved successfully', {
      data: user
    });
  } catch (err) {
    console.error('Get current user error:', err);
    next(err);
  }
};
