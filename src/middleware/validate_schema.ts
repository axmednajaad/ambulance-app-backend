import { ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validateSchema =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      next(error); // Caught by global error handler
    }
  };
