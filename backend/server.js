import express from 'express'
import cors from 'cors'
import { connectDB } from './config/db.js'
import productMatcherRoute from './routes/product_matcher_route.js'
import { PORT } from './config/index.js'

// Setting up MongoDB Atlas connection
const app = express()
app.use(cors())

await connectDB()

app.use('/api', productMatcherRoute)

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})