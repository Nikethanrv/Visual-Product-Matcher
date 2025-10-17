import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import { client } from "../config/db.js"
import { DATABASE, COLLECTION, PYTHON_SERVICE_URL } from "../config/index.js"

export const get_matches = async (req, res) => {
    try {
        const db = client.db(DATABASE)
        const collection = db.collection(COLLECTION)
        const data = await collection.find({}).toArray()

        let fileContent
        if (req.file) {
            fileContent = fs.readFileSync(req.file.path)
        } else if (req.body.imageUrl) {
            const response = await axios.get(req.body.imageUrl, {
                responseType: 'stream',
                timeout: 10000
            })
            fileContent = response.data
        } else {
            return res.status(400).json({
                error: "No image uploaded"
            })
        }

        const image_urls = data.map((item) => item.image_url)

        const form = new FormData()
        if (req.file) {
            form.append("file", fs.createReadStream(req.file.path))
        } else if (req.body.imageUrl) {
            form.append("file", fileContent)
        }
        
        form.append("image_urls", JSON.stringify(image_urls))

        const response = await axios.post(`${PYTHON_SERVICE_URL}/match-images`,
            form,
            {            
                headers: form.getHeaders(),
                timeout: 120000,
            }
        )
        console.log("Response from image matching service:", response.data)
        const results = response.data.map((match) => {
            const item = data.find((d) => d.image_url === match.image_url)
            return {
                ...match,
                name: item.name,
                category: item.category
            }
        }) 

        res.json(results)
    } catch (err) {
        console.error("Error fetching matches:", err)
        res.status(500).json({ error: "Failed to fetch matches" })
    }
}
