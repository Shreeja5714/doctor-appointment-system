// server.js
require('dotenv').config();
const express = require('express');
const connectDB = require('./src/config/database.js');

const app = express();
connectDB();

app.use(express.json());

// routes
const authRoutes = require('./src/routes/authRoutes');

app.use(express.json());
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
