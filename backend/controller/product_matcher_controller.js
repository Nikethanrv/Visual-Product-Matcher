import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import { client } from "../config/db.js"
import { DATABASE, COLLECTION, PYTHON_SERVICE_URL } from "../config/index.js"

export const get_matches = async (req, res) => {
    let uploadedFile = null;
    
    try {
        // Validate input
        if (!req.file && !req.body.imageUrl) {
            return res.status(400).json({
                error: "No image provided. Please upload an image file or provide an image URL"
            });
        }

        // Get product data from MongoDB
        const db = client.db(DATABASE);
        const collection = db.collection(COLLECTION);
        const data = await collection.find({}).toArray();

        if (!data || data.length === 0) {
            return res.status(404).json({
                error: "No products found in database"
            });
        }

        const image_urls = data.map((item) => item.image_url);
        const form = new FormData();

        // Handle file upload or URL
        try {
            if (req.file) {
                uploadedFile = req.file.path;
                form.append("file", fs.createReadStream(req.file.path));
            } else {
                const response = await axios.get(req.body.imageUrl, {
                    responseType: 'stream',
                    timeout: 15000 // 15 seconds timeout for image download
                });
                form.append("file", response.data);
            }
        } catch (err) {
            if (err.code === 'ECONNABORTED') {
                return res.status(408).json({
                    error: "Image download timeout. Please try again or use a different image URL"
                });
            }
            throw err;
        }
        
        form.append("image_urls", JSON.stringify(image_urls));

        // Call Python service with increased timeout
        const response = await axios.post(
            `${PYTHON_SERVICE_URL}/match-images`,
            form,
            {            
                headers: form.getHeaders(),
                timeout: 180000, // 3 minutes timeout for processing
                maxContentLength: 50 * 1024 * 1024, // 50MB max response size
            }
        );

        if (!response.data || !Array.isArray(response.data)) {
            throw new Error("Invalid response from image matching service");
        }

        // Map results with product details
        const results = response.data.map((match) => {
            const item = data.find((d) => d.image_url === match.image_url);
            if (!item) return null;
            return {
                ...match,
                name: item.name,
                category: item.category,
            };
        }).filter(Boolean); // Remove null entries

        res.json(results);

    } catch (err) {
        console.error("Error in get_matches:", err);
        
        // Handle specific errors
        if (err.response?.status === 413) {
            return res.status(413).json({
                error: "Image file too large. Please use a smaller image"
            });
        }
        
        if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
            return res.status(504).json({
                error: "Service timeout. Please try again with a smaller image or fewer products"
            });
        }

        if (err.response?.status === 503) {
            return res.status(503).json({
                error: "Image matching service is currently unavailable. Please try again later"
            });
        }

        res.status(500).json({
            error: "Failed to process image matches",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });

    } finally {
        // Cleanup: Remove uploaded file if it exists
        if (uploadedFile && fs.existsSync(uploadedFile)) {
            try {
                fs.unlinkSync(uploadedFile);
            } catch (err) {
                console.error("Error cleaning up uploaded file:", err);
            }
        }
    }
}
