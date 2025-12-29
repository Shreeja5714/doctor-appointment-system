// server.js
require('dotenv').config();
const express = require('express');
const connectDB = require('./src/config/database.js');

const app = express();
connectDB();

// Middleware
app.use(express.json());

// routes
const authRoutes = require('./src/routes/authRoutes');
const slotRoutes = require('./src/routes/slotRoutes');
const doctorRoutes = require('./src/routes/doctorRoutes');
const bookingRoutes = require('./src/routes/bookingRoutes');
app.use('/api/auth', authRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/bookings', bookingRoutes);

// 404 handler for undefined routes (must be before error handler)
app.use((req, res, next) => {
  const { NotFoundError } = require('./src/utils/errors');
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
});

// Error handling middleware (must be after all routes and 404 handler)
const { errorHandler } = require('./src/middlewares/errorHandler');
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
