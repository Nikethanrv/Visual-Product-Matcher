import dotenv from 'dotenv'
dotenv.config()

export const MONGO_URL = process.env.ATLAS_URL
export const DATABASE = process.env.DATABASE
export const COLLECTION = process.env.COLLECTION
export const PORT = process.env.PORT || 3000