require('dotenv').config();
const express=require('express');
const mongoose  = require('mongoose');
const cors= require('cors')
const app=express();


//  Database Connection
mongoose.connect(process.env.MONGO_URI)
.then(()=>{
    console.log('Connected to MongoDB');
})
.catch((err)=>{
    console.log('Failed to connect to MongoDB:', err)
})

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


//  Server
const port=process.env.PORT||4000;
app.listen(port,()=>{
    console.log(`server is running on port:${port}`)
})

