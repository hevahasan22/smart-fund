require('dotenv').config();
const express=require('express');
const app=express();
app.use(express.json())
const router=express.Router();
const { default: mongoose } = require('mongoose');
const session=require('express-session')
app.use('/api', router);


//Routers
app.use("/api/register",require('./routes/auth'))
app.use("/",require('./routes/auth'))
app.use("/api/upload",require('./routes/upload'))

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Something went wrong!' });

}); 
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
  }));


//mongo connecter
const moongoURI=process.env.MONGO_URI
mongoose.connect(moongoURI)
.then(()=>{
    console.log('Connected to MongoDB')
})
.catch((err)=>{
    console.log('Failed to connect to MongoDB:', err)
})


//server
const port=process.env.PORT;
app.listen(port,()=>{
    console.log(`server is running on port:${port}`)
})

