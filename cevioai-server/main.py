import os
import uuid
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
from cevioai_python.cevioai_control import Talker2, ServiceControl2

app = FastAPI()

# Setup uploads directory
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount static files to serve the generated audio
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Start Cevio AI Host if not started
try:
    if not ServiceControl2.is_host_started():
        ServiceControl2.start_host(False)
except Exception as e:
    print(f"Warning: Failed to start/check Cevio AI host: {e}")

class SynthesizeRequest(BaseModel):
    text: str
    cast: str
    speed: Optional[int] = None
    tone: Optional[int] = None
    alpha: Optional[int] = None
    volume: Optional[int] = None

@app.get("/speakers")
async def get_speakers():
    try:
        casts = Talker2.available_casts()
        result = []
        for cast in casts:
            result.append({
                "name": cast,
                "speaker_uuid": cast,
                "styles": [
                    {"id": 0, "name": "Default"}
                ]
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/synthesize")
async def synthesize(req: SynthesizeRequest):
    try:
        filename = f"synth-cevio-{uuid.uuid4()}.wav"
        filepath = os.path.join(UPLOAD_DIR, filename)
        
        talker = Talker2()
        talker.cast = req.cast
        
        if req.speed is not None: talker.speed = req.speed
        if req.tone is not None: talker.tone = req.tone
        if req.alpha is not None: talker.alpha = req.alpha
        if req.volume is not None: talker.volume = req.volume
        
        # Synthesis
        ok = talker.output_wave_to_file(req.text, filepath)
        if not ok:
            raise Exception("Cevio AI failed to output wave file")
            
        duration = talker.get_text_duration(req.text)
        
        return {
            "url": f"/uploads/{filename}",
            "duration": duration,
            "filename": filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
