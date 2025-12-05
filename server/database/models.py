from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Enum, Text
from sqlalchemy.orm import relationship
from database.session import Base
import datetime
import enum

class WaterLog(Base):
    __tablename__ = "water_logs"

    id = Column(Integer, primary_key=True, index=True)
    amount_ml = Column(Integer, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class TaskStatus(str, enum.Enum):
    TODO = "To Do"
    IN_PROGRESS = "In Progress"
    DONE = "Done"

class AttachmentType(str, enum.Enum):
    IMAGE = "image"
    PDF = "pdf"
    LINK = "link"

class Todo(Base):
    __tablename__ = "todos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(TaskStatus), default=TaskStatus.TODO, nullable=False)
    due_date = Column(DateTime, nullable=True)
    
    # Duration in minutes
    duration_minutes = Column(Integer, nullable=True)
    completed_seconds = Column(Integer, default=0)
    hidden = Column(Boolean, default=False, nullable=False)

    # For subtasks
    parent_id = Column(Integer, ForeignKey("todos.id"), nullable=True)
    parent = relationship("Todo", remote_side=[id], back_populates="subtasks")
    subtasks = relationship("Todo", back_populates="parent", cascade="all, delete-orphan")

    # For comments and attachments
    comments = relationship("Comment", back_populates="task", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="task", cascade="all, delete-orphan")

class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    task_id = Column(Integer, ForeignKey("todos.id"), nullable=False)
    task = relationship("Todo", back_populates="comments")

class Attachment(Base):
    __tablename__ = "attachments"
    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String, nullable=True) # For image/pdf paths
    url = Column(String, nullable=True) # For links
    attachment_type = Column(Enum(AttachmentType), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    task_id = Column(Integer, ForeignKey("todos.id"), nullable=False)
    task = relationship("Todo", back_populates="attachments")
