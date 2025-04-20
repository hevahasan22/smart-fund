const express=require('express')
const router =express.Router()
const uploadController=require('../controllers/upload')

router.post('./upload',uploadController.uploadAfil)

module.exports=router