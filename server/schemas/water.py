from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class WaterCreate(BaseModel):
    amount_ml: int = Field(..., description="Amount of water consumed in milliliters")

class WaterResponse(BaseModel):
    id: int
    amount_ml: int
    timestamp: datetime

    class Config:
        from_attributes = True