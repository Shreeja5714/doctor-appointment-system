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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
