from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional
import os

from .core.config import settings
from .api.api_v1.api import api_router
from fastapi import FastAPI
from app.db.mongodb import MongoDB




# ...existing code...
app = FastAPI(
    title="Talent Intel AI API",
    description="API for parsing resumes, job descriptions, and calculating matching scores",
    version="1.0.0",
)
@app.on_event("startup")
async def startup_db_client():
    print("Connecting to MongoDB...")
    await MongoDB.connect_db()

@app.on_event("shutdown")
async def shutdown_db_client():
    await MongoDB.close_db()
# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Welcome to Talent Intel AI API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
