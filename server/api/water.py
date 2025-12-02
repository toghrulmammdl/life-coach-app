from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session  
from database.session import SessionLocal, get_db
from database.models import WaterLog
from schemas.water import WaterCreate, WaterResponse
from datetime import datetime, timedelta, time
import pytz

router = APIRouter()

@router.post("/water/", response_model=WaterResponse, status_code=status.HTTP_201_CREATED)  
def add_water(data: WaterCreate, db: Session = Depends(get_db)):
    baku_tz = pytz.timezone('Asia/Baku')

    water_log = WaterLog(
        amount_ml=data.amount_ml,
        timestamp=datetime.now(baku_tz) 
    )
    db.add(water_log)
    db.commit()
    db.refresh(water_log)
    return water_log

@router.get("/water/")
def today_stats(db: Session = Depends(get_db)):  
    baku_tz = pytz.timezone('Asia/Baku')
    
    today_baku = datetime.now(baku_tz).date()

    start_of_day_baku = baku_tz.localize(datetime.combine(today_baku, time.min))
    end_of_day_baku = start_of_day_baku + timedelta(days=1)

    logs = db.query(WaterLog).filter(WaterLog.timestamp >= start_of_day_baku, WaterLog.timestamp < end_of_day_baku).all()
    total = sum(log.amount_ml for log in logs)
    return {
        "today_total": total,
        "entries": logs
    } 

@router.get("/history")
def history(db: Session = Depends(get_db)):  
    logs = db.query(WaterLog).order_by(WaterLog.timestamp.desc()).all()
    return logs

@router.delete("/water/{water_log_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_water(water_log_id: int, db: Session = Depends(get_db)):
    water_log = db.query(WaterLog).filter(WaterLog.id == water_log_id).first()
    if not water_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Water log with id {water_log_id} not found"
        )
    db.delete(water_log)
    db.commit()
    return None