from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from aivoice_python import AIVoiceTTsControl
import uuid
import os
import uvicorn
import wave
from fastapi.staticfiles import StaticFiles

app = FastAPI()

# Enable CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TTS Controller
tts = AIVoiceTTsControl()

# Initialize on startup
@app.on_event("startup")
def startup_event():
    try:
        # Get available hosts
        hosts = tts.get_available_host_names()
        if not hosts:
            print("No A.I.VOICE Editor found.")
            return
        
        # Use the first available host
        host_name = hosts[0]
        print(f"Initializing with host: {host_name}")
        tts.initialize(host_name)
        
        # Connect to host
        tts.connect()
        print("Connected to A.I.VOICE Editor.")
    except Exception as e:
        print(f"Failed to initialize A.I.VOICE: {e}")

@app.on_event("shutdown")
def shutdown_event():
    try:
        tts.disconnect()
    except:
        pass

class SynthesizeRequest(BaseModel):
    text: str
    preset: str = None

@app.get("/presets")
def get_presets():
    try:
        return {"presets": tts.voice_preset_names}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/synthesize")
def synthesize(request: SynthesizeRequest):
    try:
        if request.preset:
            tts.current_voice_preset_name = request.preset
        
        tts.text = request.text
        
        # Generate filename
        filename = f"{uuid.uuid4()}.wav"
        # We save it to a public directory so it can be accessed
        # In this context, let's save it to a folder the server serves
        output_dir = os.path.abspath("static/audio")
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.join(output_dir, filename)
        
        # Save audio
        tts.save_audio_to_file(filepath)
        
        # Get duration
        duration = 0
        try:
            with wave.open(filepath, 'rb') as f:
                frames = f.getnframes()
                rate = f.getframerate()
                duration = frames / float(rate)
        except Exception as e:
            print(f"Failed to get duration: {e}")
        
        return {
            "url": f"http://localhost:8000/static/audio/{filename}",
            "filename": filename,
            "duration": duration
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Serve static files
os.makedirs("static/audio", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
