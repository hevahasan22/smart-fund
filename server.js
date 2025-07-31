require('dotenv').config();
const express=require('express');
const mongoose  = require('mongoose');
const cors= require('cors');
const path = require('path');
const paymentController = require('./controllers/paymentController');
const app=express();
require('./models/index')

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

//  Database Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 2, // Maintain at least 2 socket connections
    });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.log('Failed to connect to MongoDB:', err);
    // Retry connection after 5 seconds
    setTimeout(connectDB, 5000);
  }
};

connectDB();

// Handle MongoDB connection errors
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB connection established');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

paymentController.initScheduler();

// Import contract controller for scheduled jobs
const { processPendingContractsJob } = require('./controllers/contractController');

// Set up scheduled job to process pending contracts every 5 minutes
setInterval(async () => {
  try {
    await processPendingContractsJob();
  } catch (error) {
    console.error('Error in scheduled contract processing:', error);
  }
}, 5 * 60 * 1000); // 5 minutes

//  Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Custom Middlewares
app.use(require('./middleware/requestLogger')); 
// app.use(require('./middleware/sanitizeInput'));


// Routes
const apiRoutes =require ('./routes/api')
app.use('/api',apiRoutes)

// require middleware
const errorHandler=require('./middleware/errorHandler')
app.use(errorHandler)

// Global error handler for unhandled errors
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

app.use((req, res, next) => {
  console.log('Incoming Headers:', req.headers);
  console.log('Authorization Header:', req.headers.authorization);
  next();
});


//  Server
const port=process.env.PORT||4000;
app.listen(port,()=>{
    console.log(`server is running on port:${port}`)
})

