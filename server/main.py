from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.water import router as water_router
from api.todos import router as todos_router
from database.session import Base, engine

Base.metadata.create_all(bind=engine)

app = FastAPI(title="LifeCoach API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(water_router, prefix="/api")
app.include_router(todos_router, prefix="/api", tags=["Todos"])
