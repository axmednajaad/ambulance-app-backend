import { AppError } from '../errors/app_errors.js';
import { ZodError } from 'zod';
import { sendResponse } from '../utils/response.js';

// 404 handler
export const notFoundHandler = (req, res) => {
  const message = `Endpoint ${req.originalUrl} not found. Please check the API documentation for available endpoints.`;
  return sendResponse(res, 404, 'fail', message);
};

// Global error handler
export const errorHandler = (err, req, res, next) => {
  console.error('Error details:', err);
  if (err instanceof AppError) {
    return sendResponse(res, err.statusCode, err.status, err.message, {
      errors: err,
      stack: err.stack,
    });
  }

  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    // let message = firstIssue.message;
    const message = `${firstIssue.message} -- (${firstIssue.path.join('.')})`;

    return sendResponse(res, 400, 'fail', message, {
      errors: err.errors,
      stack: err.stack,
    });
  }

  return sendResponse(res, 500, 'error', err.message || 'Something went wrong!', {
    stack: err.stack,
  });
};
