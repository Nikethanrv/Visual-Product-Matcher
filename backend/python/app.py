import io
import json
import os
import gc
from typing import List

import requests
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image

import torch
import clip
import torch.nn as nn

try:
    import pillow_avif
except:
    pass

# Force CPU usage and memory optimization
torch.cuda.is_available = lambda: False
device = "cpu"

# Initialize FastAPI with CORS
app = FastAPI(title="Image Matcher")

# Load model only once and use the smallest available model
model, preprocess = clip.load("ViT-B/32", device=device, jit=True)
model.eval()  # Set to evaluation mode

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_NAME = os.environ.get("CLIP_MODEL", "ViT-B/32")

print("Device:", DEVICE)
model, preprocess = clip.load(MODEL_NAME, device=DEVICE)
model.eval()

cos = nn.CosineSimilarity(dim=0)

def load_image_from_bytes(b: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(b)).convert("RGB")
    return img

def load_image_from_url(url: str) -> Image.Image:
    response = requests.get(url, timeout=10)
    if response.status_code != 200:
        raise ValueError(f"Failed to get {url} (status {response.status_code})")
    return load_image_from_bytes(response.content)

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
    
    content = await file.read()
    try:
        input_img = load_image_from_bytes(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Uploaded image invalid: {e}")
    
    with torch.no_grad():
        input_tensor = preprocess(input_img).unsqueeze(0).to(DEVICE)
        input_features = model.encode_image(input_tensor)
        input_features = input_features / input_features.norm(dim=-1, keepdim=True)

    results = []
    for url in urls:
        try:
            img = load_image_from_url(url)
            with torch.no_grad():
                t = preprocess(img).unsqueeze(0).to(DEVICE)
                feats = model.encode_image(t)
                feats = feats / feats.norm(dim=-1, keepdim=True)
                sim = cos(feats[0], input_features[0]).item()
                sim_norm = (sim + 1.0) / 2.0
            results.append({"image_url": url, "similarity": round(sim_norm, 4)})
        except Exception as e:
            results.append({"image_url": url, "error": str(e)})
    
    sorted_results = sorted(
        [r for r in results if "similarity" in r],
        key=lambda x: x["similarity"],
        reverse=True
    )

    return JSONResponse(sorted_results)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)