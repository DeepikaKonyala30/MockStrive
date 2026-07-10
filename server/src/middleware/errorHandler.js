/**
 * errorHandler middleware
 * Global Express error handler — must be registered last in app.js.
 * Logs the error and returns a structured JSON error response.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  console.error(`[error] ${err.message}`);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
  });
};
