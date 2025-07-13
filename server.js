require('dotenv').config();
const express=require('express');
const mongoose  = require('mongoose');
const cors= require('cors');
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
mongoose.connect(process.env.MONGO_URI)
.then(()=>{
    console.log('Connected to MongoDB');
})
.catch((err)=>{
    console.log('Failed to connect to MongoDB:', err)
})

// Handle MongoDB connection errors
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
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

