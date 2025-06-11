require('dotenv').config();
const express=require('express');
const app=express();
const router=express.Router();
const { default: mongoose } = require('mongoose');
const cors= require('cors')
const auth = require('./middleware/auth');

// Middleware
app.use(cors());
app.use(express.json());


//router requirment
const userRoutes =require('./routes/user');
const uploadRouter=require('./routes/upload')
const sponsorRoutes = require('./routes/sponsor');
const contractRoutes = require('./routes/contract');
// const additionalDocumentRoutes = require('./routes/additionalDocumet');
// const additionalDocumentTypeRoutes = require('./routes/additionalDocumentType');
const paymentRoutes = require('./routes/payment');
const loanRoutes = require('./routes/loan');
const investorRoutes = require('./routes/investor');
const typeTermRoutes = require('./routes/typeTerm');
const loanTypeRoutes = require('./routes/loanType');
const loanTermRoutes = require('./routes/loanTerm');

app.use('/api', router);


//Routers
app.use('/api',uploadRouter)
app.use('/api/users', userRoutes);
app.use('/api/sponsors', sponsorRoutes);
app.use('/api/contracts', contractRoutes);
// app.use('/api/documents', additionalDocumentRoutes);
// app.use('/api/document-types', additionalDocumentTypeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/investors', investorRoutes);
app.use('/api/type-terms', typeTermRoutes);
app.use('/api/loan-types', loanTypeRoutes);
app.use('/api/loan-terms', loanTermRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Something went wrong!' });

}); 
app.use(express.urlencoded({ extended: true }));


//mongo connecterMONGO_URI
const moongoURI= process.env.MONGO_URI
mongoose.connect(moongoURI)
.then(()=>{
    console.log('Connected to MongoDB')
})
.catch((err)=>{
    console.log('Failed to connect to MongoDB:', err)
})


//server
const port=process.env.PORT||4000;
app.listen(port,()=>{
    console.log(`server is running on port:${port}`)
})

