from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import shutil
import os
import uuid

from database.session import get_db
from database.models import Todo as TodoModel, Comment as CommentModel, Attachment as AttachmentModel, AttachmentType
from schemas.todo import (
    Todo as TodoSchema, 
    TodoCreate, 
    TodoUpdate,
    Comment as CommentSchema,
    CommentCreate,
    Attachment as AttachmentSchema,
    AttachmentCreate,
    CommentDelete,
    AttachmentDelete
)

router = APIRouter()

# --- Helper Functions ---

UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def get_task_or_404(db: Session, todo_id: int) -> TodoModel:
    """Helper to get a task by ID or raise a 404 error."""
    task = db.query(TodoModel).filter(TodoModel.id == todo_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task

def get_comment_or_404(db: Session, comment_id: int) -> CommentModel:
    """Helper to get a comment by ID or raise a 404 error."""
    comment = db.query(CommentModel).filter(CommentModel.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    return comment

def get_attachment_or_404(db: Session, attachment_id: int) -> AttachmentModel:
    """Helper to get an attachment by ID or raise a 404 error."""
    attachment = db.query(AttachmentModel).filter(AttachmentModel.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    return attachment

# --- Main Task (Todo) Endpoints ---

@router.post("/todos/", response_model=TodoSchema, status_code=status.HTTP_201_CREATED)
def create_todo(todo: TodoCreate, db: Session = Depends(get_db)):
    """
    Create a new task or subtask.
    To create a subtask, provide the `parent_id`.

    **Request Body:**
    ```json
    {
        "title": "Learn FastAPI",
        "description": "Read the official documentation and build a project.",
        "due_date": "2024-12-31T23:59:59",
        "duration_minutes": 120,
        "parent_id": null
    }
    ```

    **Success Response (201):**
    ```json
    {
        "title": "Learn FastAPI",
        "description": "Read the official documentation and build a project.",
        "status": "To Do",
        "due_date": "2024-12-31T23:59:59",
        "duration_minutes": 120,
        "id": 1,
        "completed_seconds": 0,
        "subtasks": [],
        "comments": [],
        "attachments": []
    }
    ```
    """
    # If parent_id is provided, ensure the parent task exists.
    if todo.parent_id:
        # The get_task_or_404 function will raise an exception if the parent is not found.
        # This prevents creating orphaned subtasks.
        parent_task = get_task_or_404(db, todo.parent_id)
    
    db_todo = TodoModel(**todo.model_dump())
    db.add(db_todo)
    db.commit()
    db.refresh(db_todo)
    return db_todo

@router.get("/todos/", response_model=List[TodoSchema])
def read_todos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), top_level_only: bool = True):
    """_
    Retrieve tasks. By default, only retrieves top-level tasks.
    Set `top_level_only=false` to retrieve all tasks, including subtasks.

    **Success Response (200):**
    ```json
    [
        {
            "title": "Learn FastAPI",
            "description": "Read the official documentation and build a project.",
            "status": "To Do",
            "due_date": "2024-12-31T23:59:59",
            "duration_minutes": 120,
            "id": 1,
            "completed_seconds": 0,
            "subtasks": [],
            "comments": [],
            "attachments": []
        }
    ]
    ```
    """
    query = db.query(TodoModel).order_by(TodoModel.id)
    if top_level_only:
        query = query.filter(TodoModel.parent_id.is_(None))
    
    todos = query.offset(skip).limit(limit).all()
    return todos

@router.get("/todos/{todo_id}", response_model=TodoSchema)
def read_todo(todo_id: int, db: Session = Depends(get_db)):
    """
    Retrieve a single task by its ID, including its subtasks, comments, and attachments.

    **Success Response (200):**
    ```json
    {
        "title": "Learn FastAPI",
        "description": "Read the official documentation and build a project.",
        "status": "In Progress",
        "due_date": "2024-12-31T23:59:59",
        "duration_minutes": 120,
        "id": 1,
        "completed_seconds": 1800,
        "subtasks": [
            {
                "title": "Read about Pydantic",
                "description": null,
                "status": "Done",
                "id": 2
            }
        ],
        "comments": [],
        "attachments": []
    }
    ```
    """
    return get_task_or_404(db, todo_id)

@router.put("/todos/{todo_id}", response_model=TodoSchema)
def update_todo(todo_id: int, todo: TodoUpdate, db: Session = Depends(get_db)):
    """
    Update a task's details (title, status, due date, etc.).

    **Request Body:**
    ```json
    {
        "status": "In Progress",
        "completed_seconds": 1800
    }
    ```

    **Success Response (200):**
    ```json
    {
        "title": "Learn FastAPI",
        "description": "Read the official documentation and build a project.",
        "status": "In Progress",
        "due_date": "2024-12-31T23:59:59",
        "duration_minutes": 120,
        "id": 1,
        "completed_seconds": 1800,
        "subtasks": [],
        "comments": [],
        "attachments": []
    }
    ```
    """
    db_todo = get_task_or_404(db, todo_id)
    update_data = todo.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_todo, key, value)
    
    db.commit()
    db.refresh(db_todo)
    return db_todo

@router.delete("/todos/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(todo_id: int, db: Session = Depends(get_db)):
    """
    Delete a task by its ID. This will also delete all its subtasks, comments, and attachments.

    **Success Response (204):**
    - No content is returned.
    """
    db_todo = get_task_or_404(db, todo_id)
    db.delete(db_todo)
    db.commit()
    return None

# --- Comment Endpoints ---

@router.post("/todos/{todo_id}/comments/", response_model=CommentSchema, status_code=status.HTTP_201_CREATED)
def create_comment_for_task(todo_id: int, comment: CommentCreate, db: Session = Depends(get_db)):
    """
    Add a comment to a specific task.

    **Request Body:**
    ```json
    {
        "text": "This is an important task for Q4."
    }
    ```

    **Success Response (201):**
    ```json
    {
        "text": "This is an important task for Q4.",
        "id": 1,
        "created_at": "2024-10-27T10:30:00Z"
    }
    ```
    """
    task = get_task_or_404(db, todo_id)
    db_comment = CommentModel(**comment.model_dump(), task_id=task.id)
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment

@router.delete("/todos/{todo_id}/comments/{comment_id}", response_model=CommentDelete)
def delete_comment(comment_id: int, db: Session = Depends(get_db)):
    """
    Delete a comment by its ID.

    **Success Response (200):**
    ```json
    {
        "message": "Comment deleted successfully"
    }
    ```
    """
    db_comment = get_comment_or_404(db, comment_id)
    db.delete(db_comment)
    db.commit()
    return CommentDelete()

# --- Attachment Endpoints ---

@router.post("/todos/{todo_id}/attachments/upload", response_model=AttachmentSchema, status_code=status.HTTP_201_CREATED)
async def upload_attachment_for_task(todo_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Upload a file (image, pdf) as an attachment to a specific task.
    This endpoint expects a `multipart/form-data` request.

    **Success Response (201):**
    ```json
    {
        "attachment_type": "image",
        "file_path": "static/uploads/some-unique-id.jpg",
        "url": null,
        "id": 1,
        "created_at": "2024-10-27T10:35:00Z"
    }
    ```
    """
    task = get_task_or_404(db, todo_id)
    
    # Generate a unique filename to prevent overwrites
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    attachment_type = AttachmentType.IMAGE if file.content_type.startswith("image") else AttachmentType.PDF
    
    db_attachment = AttachmentModel(
        task_id=task.id,
        file_path=file_path,
        attachment_type=attachment_type
    )
    db.add(db_attachment)
    db.commit()
    db.refresh(db_attachment)
    return db_attachment

@router.delete("/todos/{todo_id}/attachments/{attachment_id}", response_model=AttachmentDelete)
def delete_attachment(attachment_id: int, db: Session = Depends(get_db)):
    """
    Delete an attachment by its ID.
    If the attachment is a file, it will be removed from the server.

    **Success Response (200):**
    ```json
    {
        "message": "Attachment deleted successfully"
    }
    ```
    """
    db_attachment = get_attachment_or_404(db, attachment_id)

    # If it's a file, delete it from the filesystem
    if db_attachment.file_path and os.path.exists(db_attachment.file_path):
        os.remove(db_attachment.file_path)

    db.delete(db_attachment)
    db.commit()
    return AttachmentDelete()

@router.post("/todos/{todo_id}/attachments/link", response_model=AttachmentSchema, status_code=status.HTTP_201_CREATED)
def create_link_attachment_for_task(todo_id: int, attachment: AttachmentCreate, db: Session = Depends(get_db)):
    """
    Add a URL link as an attachment to a specific task.

    **Request Body:**
    ```json
    {
        "attachment_type": "link",
        "url": "https://fastapi.tiangolo.com/"
    }
    ```

    **Success Response (201):**
    ```json
    {
        "attachment_type": "link",
        "file_path": null,
        "url": "https://fastapi.tiangolo.com/",
        "id": 2,
        "created_at": "2024-10-27T10:40:00Z"
    }
    ```
    """
    if attachment.attachment_type != AttachmentType.LINK or not attachment.url:
        raise HTTPException(status_code=400, detail="Invalid request for link attachment.")
        
    task = get_task_or_404(db, todo_id)
    db_attachment = AttachmentModel(
        task_id=task.id,
        url=attachment.url,
        attachment_type=AttachmentType.LINK
    )
    db.add(db_attachment)
    db.commit()
    db.refresh(db_attachment)
    return db_attachment