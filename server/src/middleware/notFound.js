/**
 * notFound middleware
 * Handles unmatched /api/* routes and returns a structured 404 JSON response.
 */
export const notFound = (req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};
