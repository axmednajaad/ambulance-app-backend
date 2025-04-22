import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/error_handler_middle_ware.js';
import { sendResponse } from './utils/response.js';
import router from './routes/app.routes.js';

const createApp = (io) => {
  const app = express();

  app.use(express.json({ limit: '4000mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Attach io to every request
  app.use((req, res, next) => {
    req.io = io;
    next();
  });

  app.use(router);

  app.get('/', (req, res) => {
    return sendResponse(res, 200, 'success', 'Server is running success');
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;
