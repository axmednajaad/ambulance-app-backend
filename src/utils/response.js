
//
export const sendResponse = (res, statusCode, status, message, options = {}) => {
  const response = {
    status,
    message,
  };

  if (options.data !== undefined) response.data = options.data;
  if (options.errors !== undefined) response.errors = options.errors;
  if (options.stack !== undefined) response.stack = options.stack;

  return res.status(statusCode).json(response);
};
