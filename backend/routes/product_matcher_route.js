import express from 'express'
import multer from "multer"
import { get_matches } from '../controller/product_matcher_controller.js'

const router = express.Router()
const upload = multer({
    dest: "uploads/"
})

router.post('/matches', upload.single("image"), get_matches)

export default router
