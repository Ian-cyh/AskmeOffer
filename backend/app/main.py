from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import profile, generate, interview, voice, code, courses, coding

app = FastAPI(title="AskmeOffer API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(generate.router, prefix="/api/generate", tags=["generate"])
app.include_router(interview.router, prefix="/api/interview", tags=["interview"])
app.include_router(voice.router, prefix="/api/voice", tags=["voice"])
app.include_router(code.router, prefix="/api/code", tags=["code"])
app.include_router(courses.router, prefix="/api/courses", tags=["courses"])
app.include_router(coding.router, prefix="/api/coding", tags=["coding"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
