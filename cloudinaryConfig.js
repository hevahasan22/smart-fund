require('dotenv').config();
const cloudinary=require('cloudinary');
const {CloudinaryStorage}=require('multer-storage-cloudinary')
const multer=require('multer')

//cloudinary config

cloudinary.config({
    cloud_name:process.env.CLOUDINARY_CLOUD_NAME,
    api_key:process.env.CLOUDINARY_API_KEY,
    api_secret:process.env.CLOUDINARY_API_SECRET,
})

//set up multer storage

const storage=new CloudinaryStorage({
    cloudinary,
    params:async(req,file)=>{
    let format=file.mimetype.split('/')[1];//get the file extension
    return{
        folder:'uploads',// Cloudinary folder name
        resource_type:'auto',// Supports both PDFs & images
        format:'fotmat',// Store in the same format as uploaded
    }   
    }
})

//set up muler storage

const upload=multer({
    storage,
    fileFilter:(req,res,cb)=>
    {
        const allowedMimeTypes=['application/pdf','image/jpeg','image/jpg','image/png']

        if(!allowedMimeTypes.includes(file.mimetype)){
            return cb(new Error('Only PDFs, JPEG, JPG, and PNG files are allowed!'),false)
        }
        cb(null,true)
    }
})


module.exports={
    upload
}

