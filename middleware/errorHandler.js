// middlewares/errorHandler.js
module.exports = (err, req, res, next) => {
  console.error('Admin Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: err.errors
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};