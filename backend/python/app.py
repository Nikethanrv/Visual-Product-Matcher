import io
import json
import os
import gc
from typing import List

import requests
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

import torch
import open_clip
import torch.nn as nn

try:
    import pillow_avif
except:
    pass

# Force CPU usage and aggressive memory optimization
device = "cpu"
torch.set_num_threads(1)
torch.set_grad_enabled(False)

def cleanup_memory():
    """Aggressive memory cleanup"""
    gc.collect()
    torch.cuda.empty_cache() if torch.cuda.is_available() else None

# Initialize FastAPI with CORS
app = FastAPI(title="Image Matcher")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model only once and use an efficient model
model, _, preprocess = open_clip.create_model_and_transforms('ViT-L-14-quickgelu')
model = model.to(device)
model.eval()
    
# Function to process image with memory optimization
def process_image(image_data):
    try:
        if isinstance(image_data, bytes):
            image = Image.open(io.BytesIO(image_data))
        else:
            image = Image.open(image_data)
            
        # Convert to RGB if needed
        if image.mode != "RGB":
            image = image.convert("RGB")
            
        # Resize image to a smaller size before preprocessing to save memory
        max_size = 224  # CLIP's required size
        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        # Process image
        image_input = preprocess(image).unsqueeze(0).to(device)
        
        # Clear original image from memory
        image.close()
        del image
        cleanup_memory()
        
        return image_input
    except Exception as e:
        cleanup_memory()
        raise e

# Initialize cosine similarity
cos = nn.CosineSimilarity(dim=0)

@app.post("/match-images")
async def match_images(
    file: UploadFile = File(...),
    image_urls: str = Form(...)
):
    try:
        urls = json.loads(image_urls)
        if not isinstance(urls, list):
            raise ValueError
    except Exception:
        raise HTTPException(status_code=400, detail="image_urls must be a JSON list string")
    
    try:
        # Process input image with memory optimization
        content = await file.read()
        input_tensor = process_image(content)
        
        with torch.no_grad():
            input_features = model.encode_image(input_tensor)
            input_features = input_features / input_features.norm(dim=-1, keepdim=True)
        
        # Clear input tensor from memory
        del input_tensor
        cleanup_memory()

        results = []
        for url in urls:
            try:
                response = requests.get(url, timeout=10)
                if response.status_code != 200:
                    raise ValueError(f"Failed to get {url}")
                
                # Process comparison image with memory optimization
                img_tensor = process_image(response.content)
                
                with torch.no_grad():
                    feats = model.encode_image(img_tensor)
                    feats = feats / feats.norm(dim=-1, keepdim=True)
                    sim = cos(feats[0], input_features[0]).item()
                    sim_norm = (sim + 1.0) / 2.0
                
                # Clear tensors from memory
                del feats
                del img_tensor
                cleanup_memory()
                
                results.append({"image_url": url, "similarity": round(sim_norm, 4)})
            except Exception as e:
                cleanup_memory()
                results.append({"image_url": url, "error": str(e)})
        
        sorted_results = sorted(
            [r for r in results if "similarity" in r],
            key=lambda x: x["similarity"],
            reverse=True
        )
        
        # Final cleanup
        del input_features
        cleanup_memory()
        
        return JSONResponse(sorted_results)
    except Exception as e:
        cleanup_memory()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)