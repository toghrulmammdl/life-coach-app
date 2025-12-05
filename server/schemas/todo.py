from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database.models import TaskStatus, AttachmentType

# --- Attachment Schemas ---
class AttachmentBase(BaseModel):
    attachment_type: AttachmentType
    file_path: Optional[str] = None
    url: Optional[str] = None

class AttachmentCreate(AttachmentBase):
    pass

class Attachment(AttachmentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class AttachmentDelete(BaseModel):
    message: str = "Attachment deleted successfully"

# --- Comment Schemas ---
class CommentBase(BaseModel):
    text: str

class CommentCreate(CommentBase):
    pass

class Comment(CommentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class CommentDelete(BaseModel):
    message: str = "Comment deleted successfully"

# --- Todo Schemas ---

class TodoBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[TaskStatus] = TaskStatus.TODO
    due_date: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    hidden: Optional[bool] = False

class TodoCreate(TodoBase):
    parent_id: Optional[int] = None

class TodoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    due_date: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    hidden: Optional[bool] = None
    completed_seconds: Optional[int] = None

class Todo(TodoBase):
    id: int
    completed_seconds: Optional[int] = 0
    subtasks: List['Todo'] = []
    comments: List[Comment] = []
    attachments: List[Attachment] = []

    class Config:
        from_attributes = True