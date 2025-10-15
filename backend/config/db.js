import { MongoClient } from 'mongodb'
import { MONGO_URL } from './index.js'

const client = new MongoClient(MONGO_URL)

async function connectDB() {
    if (!client.isConnected?.()) {
        await client.connect()
        console.log('Connected to MongoDB Atlas')
    }
}

export { client, connectDB }