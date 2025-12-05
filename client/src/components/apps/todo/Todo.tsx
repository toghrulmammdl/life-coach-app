import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Calendar, Clock, MessageSquare, Paperclip, Link2, Send, CheckCircle2, Loader2, X, Play, Pause, RefreshCw, Percent, EyeOff, Eye, ArchiveRestore, Circle, ListChecks, Pencil, ChevronUp, ChevronDown } from 'lucide-react';
import styles from './Todo.module.css';

type TodoStatus = 'To Do' | 'In Progress' | 'Done';
type AttachmentType = 'image' | 'pdf' | 'link';

interface Comment {
  id: number;
  text: string;
  created_at: string;
}

interface Attachment {
  id: number;
  attachment_type: AttachmentType;
  file_path: string | null;
  url: string | null;
  created_at: string;
}

interface Todo {
  id: number;
  title: string;
  description: string | null;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: TodoStatus;
  tags: { name: string; color: string; background: string; }[];
  due_date: string | null;
  duration_minutes: number | null;
  hidden: boolean;
  completed_seconds: number;
  subtasks: Todo[];
  comments: Comment[];
  attachments: Attachment[];
  assignees: { id: number; name: string; avatar_url: string }[];
}

function Todo() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDesc, setNewTodoDesc] = useState('');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');
  const [newTodoDuration, setNewTodoDuration] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTodo, setSelectedTodo] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskDuration, setNewSubtaskDuration] = useState('');
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [taskPath, setTaskPath] = useState<Todo[]>([]);
  const [activeView, setActiveView] = useState<'kanban' | 'list' | 'history'>('kanban');
  const [activeTimerId, setActiveTimerId] = useState<number | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(true);
  const [showElapsedTime, setShowElapsedTime] = useState(false);

  // State for interactive duration editing
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [tempEditHours, setTempEditHours] = useState(0);
  const [tempEditMinutes, setTempEditMinutes] = useState(0);
  const API_BASE_URL = 'http://localhost:8000/api/todos';
  const alarmSoundRef = useRef<HTMLAudioElement | null>(null);

  const fetchTodos = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/?top_level_only=true`);
      if (!response.ok) throw new Error('Failed to fetch todos');
      const data: Todo[] = await response.json();
      setTodos(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  useEffect(() => {
    // NOTE: For the alarm to work, you need to place an audio file (e.g., 'alarm.mp3')
    // in the `public` directory of your React application.
    alarmSoundRef.current = new Audio('/alarm.mp3');
  }, []);

  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    channelRef.current = new BroadcastChannel('todo_channel');

    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data;
      if (type === 'TODO_UPDATED') {
        setTodos(prevTodos => updateNestedTodo(prevTodos, payload.todoId, payload.updateData));
      }
    };

    channelRef.current.addEventListener('message', handleMessage);

    return () => {
      channelRef.current?.removeEventListener('message', handleMessage);
      channelRef.current?.close();
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (activeTimerId && !isTimerPaused) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            alarmSoundRef.current?.play().catch(e => console.error("Error playing alarm sound:", e));
            const { task: todo } = findTaskAndPath(todos, activeTimerId);
            if (todo && todo.duration_minutes) {
              handleUpdateTodo(activeTimerId, { completed_seconds: todo.duration_minutes * 60, status: 'Done' });
            }
            setActiveTimerId(null);
            clearInterval(interval!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTimerId, isTimerPaused, todos]);

  // Helper to convert total minutes to hours and minutes
  const minutesToHoursMinutes = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { hours, minutes };
  };

  // Helper to convert hours and minutes to total minutes
  const hoursMinutesToMinutes = (hours: number, minutes: number) => {
    return hours * 60 + minutes;
  };

  const updateNestedTodo = (tasks: Todo[], todoId: number, updateData: Partial<Todo>): Todo[] => {
    return tasks.map(task => {
      if (task.id === todoId) {
        return { ...task, ...updateData };
      }
      if (task.subtasks && task.subtasks.length > 0) {
        return { ...task, subtasks: updateNestedTodo(task.subtasks, todoId, updateData) };
      }
      return task;
    });
  };

  const deleteNestedTodo = (tasks: Todo[], todoId: number): Todo[] => {
    return tasks.filter(task => task.id !== todoId).map(task => {
      if (task.subtasks && task.subtasks.length > 0) {
        return { ...task, subtasks: deleteNestedTodo(task.subtasks, todoId) };
      }
      return task;
    });
  };

  const handleUpdateTodo = async (todoId: number, updateData: Partial<Todo>) => {
    let newTodos = [...todos];
    const { task: oldTask, path: taskPath } = findTaskAndPath(newTodos, todoId);

    if (!oldTask) return;

    if (updateData.completed_seconds !== undefined) {
      const oldCompletedSeconds = oldTask.completed_seconds;
      const delta = updateData.completed_seconds - oldCompletedSeconds;

      newTodos = updateNestedTodo(newTodos, todoId, updateData);

      const parents = taskPath.slice(0, -1);
      parents.forEach(parent => {
        const { task: currentParentState } = findTaskAndPath(newTodos, parent.id);
        if (currentParentState) {
          newTodos = updateNestedTodo(newTodos, parent.id, { completed_seconds: currentParentState.completed_seconds + delta });
        }
      });
    } else {
      newTodos = updateNestedTodo(newTodos, todoId, updateData);
    }

    setTodos(newTodos);

    channelRef.current?.postMessage({
      type: 'TODO_UPDATED',
      payload: { todoId, updateData }
    });

    try {
      const response = await fetch(`${API_BASE_URL}/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      if (!response.ok) {
        throw new Error('Failed to update todo. Reverting changes.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAddTodo = async () => {
    if (!newTodoTitle.trim()) return;

    try {
      const payload: any = { title: newTodoTitle, priority: 'Medium' }; // Default priority
      if (newTodoDesc) payload.description = newTodoDesc;
      if (newTodoDueDate) payload.due_date = new Date(newTodoDueDate).toISOString();
      if (newTodoDuration) payload.duration_minutes = parseInt(newTodoDuration);

      const response = await fetch(`${API_BASE_URL}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to add todo');
      const newTodo = await response.json();
      setTodos([...todos, newTodo]);
      setNewTodoTitle('');
      setNewTodoDesc('');
      setNewTodoDueDate('');
      setNewTodoDuration('');
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleStatusChange = async (todoId: number, newStatus: TodoStatus) => {
    handleUpdateTodo(todoId, { status: newStatus });
  };

  const handleDeleteTodo = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete todo');
      setTodos(prevTodos => deleteNestedTodo(prevTodos, id));
      if (selectedTodo === id) setSelectedTodo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedTodo) return;

    try {
      const response = await fetch(`${API_BASE_URL}/${selectedTodo}/comments/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentText }),
      });

      if (!response.ok) throw new Error('Failed to add comment');
      const newComment = await response.json();
      setTodos(prevTodos => updateNestedTodo(prevTodos, selectedTodo, { comments: [...(selectedTodoData?.comments || []), newComment] }));
      setCommentText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim() || !selectedTodo) return;

    try {
      const response = await fetch(`${API_BASE_URL}/${selectedTodo}/attachments/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachment_type: 'link', url: linkUrl }),
      });

      if (!response.ok) throw new Error('Failed to add link');
      const newAttachment = await response.json();
      setTodos(prevTodos => updateNestedTodo(prevTodos, selectedTodo, { attachments: [...(selectedTodoData?.attachments || []), newAttachment] }));
      setLinkUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim() || !selectedTodo) return;

    const parentTask = selectedTodoData;
    if (parentTask && parentTask.duration_minutes) {
      const newDuration = newSubtaskDuration ? parseInt(newSubtaskDuration, 10) : 0;
      if (isNaN(newDuration)) {
        setError("Invalid subtask duration.");
        return;
      }
      const existingSubtasksDuration = parentTask.subtasks.reduce((sum, subtask) => sum + (subtask.duration_minutes || 0), 0);
      
      if (existingSubtasksDuration + newDuration > parentTask.duration_minutes) {
        setError(`Total duration of subtasks cannot exceed the parent task's duration of ${parentTask.duration_minutes} minutes.`);
        return;
      }
    }

    try {
      const payload: any = { 
        title: newSubtaskTitle,
        parent_id: selectedTodo
      };
      if (newSubtaskDuration) payload.duration_minutes = parseInt(newSubtaskDuration);

      const response = await fetch(`${API_BASE_URL}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to add subtask');
      const newSubtask = await response.json();
      
      setTodos(prevTodos => updateNestedTodo(prevTodos, selectedTodo, { subtasks: [...(selectedTodoData?.subtasks || []), newSubtask] }));

      setNewSubtaskTitle('');
      setNewSubtaskDuration('');
      setShowSubtaskForm(false);
      setError(null);

    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!selectedTodo) return;
    try {
      const response = await fetch(`${API_BASE_URL}/${selectedTodo}/comments/${commentId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete comment');
      setTodos(prevTodos => updateNestedTodo(prevTodos, selectedTodo, { comments: selectedTodoData?.comments.filter(c => c.id !== commentId) || [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!selectedTodo) return;
    try {
      const response = await fetch(`${API_BASE_URL}/${selectedTodo}/attachments/${attachmentId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete attachment');
      setTodos(prevTodos => updateNestedTodo(prevTodos, selectedTodo, { attachments: selectedTodoData?.attachments.filter(a => a.id !== attachmentId) || [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteSubtask = async (subtaskId: number) => {
    if (!selectedTodo) return;
    try {
      const response = await fetch(`${API_BASE_URL}/${subtaskId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete subtask');
      setTodos(prevTodos => updateNestedTodo(prevTodos, selectedTodo, { subtasks: selectedTodoData?.subtasks.filter(st => st.id !== subtaskId) || [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCloseDetails = () => {
    const { task: todo } = findTaskAndPath(todos, selectedTodo || 0);
    if (todo && todo.duration_minutes && activeTimerId === todo.id && !isTimerPaused) {
      const totalDurationSeconds = todo.duration_minutes * 60;
      const newCompletedSeconds = totalDurationSeconds - timerSeconds;
      handleUpdateTodo(todo.id, { completed_seconds: Math.floor(newCompletedSeconds) });
    }
    setSelectedTodo(null);
    setActiveTimerId(null);
    setIsTimerPaused(true);
  };

  const handleSubtaskStatusToggle = (subtaskId: number, currentStatus: TodoStatus) => {
    handleUpdateTodo(subtaskId, { status: currentStatus === 'Done' ? 'To Do' : 'Done' });
  };

  const findTaskAndPath = (tasks: Todo[], taskId: number, currentPath: Todo[] = []): { task: Todo | null, path: Todo[] } => {
    for (const task of tasks) {
      const newPath = [...currentPath, task];
      if (task.id === taskId) {
        return { task, path: newPath };
      }
      if (task.subtasks && task.subtasks.length > 0) {
        const result = findTaskAndPath(task.subtasks, taskId, newPath);
        if (result.task) {
          return result;
        }
      }
    }
    return { task: null, path: [] };
  };

  const handleSelectTodo = (todoId: number) => {
    if (selectedTodo === todoId) {
      handleCloseDetails();
      return;
    }

    const { task, path } = findTaskAndPath(todos, todoId);
    
    setSelectedTodo(todoId);
    setTaskPath(path);
    if (task && task.duration_minutes) {
      const totalDurationSeconds = task.duration_minutes * 60;
      setTimerSeconds(totalDurationSeconds - task.completed_seconds);
    }
    setActiveTimerId(null);
    // Initialize tempEdit values for potential immediate editing
    if (task && task.duration_minutes) {
      const { hours, minutes } = minutesToHoursMinutes(task.duration_minutes);
      setTempEditHours(hours);
      setTempEditMinutes(minutes);
    }
    setIsTimerPaused(true);
    setShowElapsedTime(false);
    setIsEditingDuration(false);
  };

  const handleTimerToggle = () => {
    const { task: todo } = findTaskAndPath(todos, selectedTodo || 0);
    if (!todo || !todo.duration_minutes) return;

    if (activeTimerId === todo.id) {
      const newPausedState = !isTimerPaused;
      setIsTimerPaused(newPausedState);
      if (newPausedState && todo.duration_minutes) {
        const totalDurationSeconds = todo.duration_minutes * 60;
        const newCompletedSeconds = totalDurationSeconds - timerSeconds;
        handleUpdateTodo(todo.id, { completed_seconds: Math.floor(newCompletedSeconds) });
      }
    } else {
      setActiveTimerId(todo.id);
      setIsTimerPaused(false);
      if (todo.status === 'To Do') {
        handleUpdateTodo(todo.id, { status: 'In Progress' });
      }
    }
  };

  const handleTimerReset = () => {
    const { task: todo } = findTaskAndPath(todos, selectedTodo || 0);
    if (!todo || !todo.duration_minutes) return;

    setIsTimerPaused(true);
    setActiveTimerId(null);
    setTimerSeconds(todo.duration_minutes * 60);
    handleUpdateTodo(todo.id, { completed_seconds: 0 });
  };

  const handleEditDurationClick = () => {
    if (selectedTodoData?.duration_minutes) {
      // Pause timer if running
      setIsTimerPaused(true);
      setActiveTimerId(null);

      const { hours, minutes } = minutesToHoursMinutes(selectedTodoData.duration_minutes);
      setTempEditHours(hours);
      setTempEditMinutes(minutes);
      setIsEditingDuration(true);
      setError(null); // Clear any previous errors
    }
  };

  const handleSaveDuration = async () => { // Made async to match handleUpdateTodo
    if (!selectedTodoData) return;

    const newDuration = hoursMinutesToMinutes(tempEditHours, tempEditMinutes);
    if (newDuration < 0) { // parseInt already handles NaN, so just check for negative
      setError("Invalid duration. Please enter a positive number.");
      return;
    }

    const subtasksDuration = selectedTodoData.subtasks.reduce((sum, subtask) => sum + (subtask.duration_minutes || 0), 0);
    if (newDuration < subtasksDuration) {
      setError(`New duration cannot be less than the total duration of its subtasks (${subtasksDuration} minutes).`);
      return;
    }

    const oldDuration = selectedTodoData.duration_minutes || 0;
    const durationDifference = (newDuration - oldDuration) * 60; // in seconds

    // Update the timer seconds to reflect the change
    setTimerSeconds(prevSeconds => {
      const newTimerSeconds = prevSeconds + durationDifference;
      return newTimerSeconds > 0 ? newTimerSeconds : 0;
    });

    await handleUpdateTodo(selectedTodoData.id, { duration_minutes: newDuration }); // Await the update

    // Reset editing state
    setIsEditingDuration(false);
    setError(null);
  };

  const handleCancelDurationEdit = () => {
    setIsEditingDuration(false);
    setError(null);
  };

  const incrementHours = () => {
    setTempEditHours(prev => prev + 1);
  };

  const decrementHours = () => {
    setTempEditHours(prev => Math.max(0, prev - 1));
  };

  const incrementMinutes = () => {
    setTempEditMinutes(prev => {
      if (prev === 59) {
        setTempEditHours(h => h + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const decrementMinutes = () => {
    setTempEditMinutes(prev => {
      if (prev === 0 && tempEditHours > 0) {
        setTempEditHours(h => h - 1);
        return 59;
      }
      return Math.max(0, prev - 1); // Ensure minutes don't go below 0
    });
  };


  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':');
  };

  const getTodayDateString = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getDueDateInfo = (dueDate: string | null) => {
    if (!dueDate) return { text: '', color: '#6b7280', background: '#f3f4f6' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(dueDate);
    taskDate.setHours(0, 0, 0, 0);

    const text = taskDate.toLocaleDateString();

    if (taskDate < today) return { text, color: '#991b1b', background: '#fee2e2' };
    if (taskDate.getTime() === today.getTime()) return { text: 'Today', color: '#9a3412', background: '#ffedd5' };
    return { text, color: '#6b7280', background: '#f3f4f6' };
  };

  const getPriorityInfo = (priority: 'Low' | 'Medium' | 'High' | 'Urgent' | undefined) => {
    switch (priority) {
      case 'Urgent':
        return { text: 'Urgent', color: '#991b1b', background: '#fee2e2' };
      case 'High':
        return { text: 'High', color: '#9a3412', background: '#ffedd5' };
      case 'Low':
        return { text: 'Low', color: '#065f46', background: '#d1fae5' };
      default: // Medium or undefined
        return { text: 'Medium', color: '#1e40af', background: '#dbeafe' };
    }
  };

  const getStatusInfo = (status: TodoStatus) => {
    switch (status) {
      case 'Done':
        return { text: 'Done', color: '#065f46', background: '#d1fae5' };
      case 'In Progress':
        return { text: 'In Progress', color: '#9a3412', background: '#ffedd5' };
      case 'To Do':
        return { text: 'To Do', color: '#1e40af', background: '#dbeafe' };
      default:
        return { text: 'To Do', color: '#1e40af', background: '#dbeafe' };
    }
  };

  const visibleTodos = todos.filter(t => !t.hidden);
  const hiddenTodos = todos.filter(t => t.hidden);

  const todosByStatus = {
    'To Do': visibleTodos.filter(t => t.status === 'To Do'),
    'In Progress': visibleTodos.filter(t => t.status === 'In Progress'),
    'Done': visibleTodos.filter(t => t.status === 'Done'),
  };

  const stats = {
    total: visibleTodos.length,
    completed: visibleTodos.filter(t => t.status === 'Done').length,
    inProgress: visibleTodos.filter(t => t.status === 'In Progress').length,
  };

  const findSelectedTodoData = (tasks: Todo[], taskId: number | null): Todo | undefined => {
    if (!taskId) return undefined;
    const { task } = findTaskAndPath(tasks, taskId);
    return task || undefined;
  };

  const selectedTodoData = findSelectedTodoData(todos, selectedTodo);
  
  const handleToggleHidden = () => {
    if (selectedTodoData) handleUpdateTodo(selectedTodoData.id, { hidden: !selectedTodoData.hidden });
  };

  return (
    <div className={styles.container}>
      {/* Top Bar */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <h1 className={styles.topBarTitle}>Tasks</h1>
          <div className={styles.topBarNav}>
            <button
              onClick={() => setActiveView('kanban')}
              className={`${styles.topBarNavButton} ${activeView === 'kanban' ? styles.topBarNavButtonActive : ''}`}
            >
              Board
            </button>
            <button
              onClick={() => setActiveView('list')}
              className={`${styles.topBarNavButton} ${activeView === 'list' ? styles.topBarNavButtonActive : ''}`}
            >
              List
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={`${styles.topBarNavButton} ${activeView === 'history' ? styles.topBarNavButtonActive : ''}`}
            >
              History ({hiddenTodos.length})
            </button>
          </div>
        </div>
        
        <div className={styles.topBarRight}>
          <div className={styles.statsContainer}>
            <span>{stats.total} Total</span>
            <span className={styles.statsSeparator}>•</span>
            <span>{stats.inProgress} Active</span>
            <span className={styles.statsSeparator}>•</span>
            <span>{stats.completed} Done</span>
          </div>
          <button onClick={() => setShowAddForm(!showAddForm)} className={styles.buttonPrimary}>
            <Plus size={16} />
            New Task
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Left Panel */}
        <div className={styles.leftPanel}>
          {/* Add Task Form */}
          {showAddForm && (
            <div className={styles.formCard}>
              <h3 className={styles.formTitle}>Create New Task</h3>
              <div className={styles.formFields}>
                <input
                  type="text"
                  value={newTodoTitle}
                  onChange={(e) => setNewTodoTitle(e.target.value)}
                  placeholder="Task title"
                  className={styles.inputField}
                />
                <textarea
                  value={newTodoDesc}
                  onChange={(e) => setNewTodoDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className={styles.inputField}
                  rows={3}
                />
                <div className={styles.formRow}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="date"
                      value={newTodoDueDate}
                      onChange={(e) => setNewTodoDueDate(e.target.value)}
                      className={styles.inputField}
                      style={{ flex: 1 }}
                    />
                    <button onClick={() => setNewTodoDueDate(getTodayDateString())} className={styles.buttonSecondary}>
                      Today
                    </button>
                  </div>
                  <input
                    type="number"
                    value={newTodoDuration}
                    onChange={(e) => setNewTodoDuration(e.target.value)}
                    placeholder="Duration (minutes)"
                    className={styles.inputField}
                  />
                </div>
                <div className={styles.formActions}>
                  <button onClick={() => setShowAddForm(false)} className={styles.buttonSecondary}>
                    Cancel
                  </button>
                  <button onClick={handleAddTodo} className={styles.buttonPrimary}>
                    Create Task
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && <div className={styles.errorMessage}>{error}</div>}

          {/* Kanban View */}
          {activeView === 'kanban' && (
            <div className={styles.kanbanBoard}>
              {(['To Do', 'In Progress', 'Done'] as TodoStatus[]).map((status) => (
                <div key={status} className={styles.kanbanColumn}>
                  <div className={styles.kanbanHeader}>
                    <h3 className={styles.kanbanTitle}>{status}</h3>
                    <span className={styles.kanbanCount}>{todosByStatus[status].length}</span>
                  </div>
                  <div className={styles.kanbanTasks}>
                    {todosByStatus[status].map((todo) => (
                      <div
                        key={todo.id}
                        onClick={() => handleSelectTodo(todo.id)}
                        className={styles.taskCard}
                        style={{
                          border: selectedTodo === todo.id ? '2px solid #111827' : '1px solid #e5e7eb',
                          boxShadow: selectedTodo === todo.id ? '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)' : '0 1px 2px 0 rgba(0,0,0,0.05)',
                        }}
                      >
                        <h4 className={styles.taskTitle}>{todo.title}</h4>
                        {todo.description && <p className={styles.taskDescription}>{todo.description}</p>}

                        {todo.duration_minutes && (
                          <div className={styles.taskProgress}>
                            <div className={styles.progressHeader}>
                              <span className={styles.progressLabel}>Progress</span>
                              <span className={styles.progressValue}>
                                {Math.round((todo.completed_seconds / (todo.duration_minutes * 60)) * 100)}%
                              </span>
                            </div>
                            <div className={styles.progressBar}>
                              <div
                                className={styles.progressFill}
                                style={{
                                  width: `${(todo.completed_seconds / (todo.duration_minutes * 60)) * 100}%`,
                                  background: todo.status === 'Done' ? '#16a34a' : '#111827',
                                }}
                              />
                            </div>
                          </div>
                        )}

                        <div className={styles.taskMeta}>
                          {todo.due_date && (
                            (() => {
                              const dueDateInfo = getDueDateInfo(todo.due_date);
                              return (
                                <span className={styles.metaBadge} style={{ color: dueDateInfo.color, background: dueDateInfo.background }}>
                                  <Calendar size={12} />
                                  {dueDateInfo.text}
                                </span>
                              );
                            })()
                          )}
                          {todo.comments.length > 0 && (
                            <span className={styles.metaBadge} style={{ color: '#6b7280', background: '#f3f4f6' }}>
                              <MessageSquare size={12} />
                              {todo.comments.length}
                            </span>
                          )}
                          {todo.attachments.length > 0 && (
                            <span className={styles.metaBadge} style={{ color: '#6b7280', background: '#f3f4f6' }}>
                              <Paperclip size={12} />
                              {todo.attachments.length}
                            </span>
                          )}
                          {todo.subtasks.length > 0 && (
                            <span className={styles.metaBadge} style={{ color: '#6b7280', background: '#f3f4f6' }}>
                              <ListChecks size={12} />
                              {todo.subtasks.filter(st => st.status === 'Done').length}/{todo.subtasks.length}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

{/* List View */}
{activeView === "list" && (
  <div className={styles.listView}>
    {visibleTodos.map((todo) => {
      const completion =
        todo.duration_minutes
          ? Math.min(
              100,
              Math.round(
                (todo.completed_seconds / (todo.duration_minutes * 60)) * 100
              )
            )
          : 0;

      const statusInfo = getStatusInfo(todo.status);
      const due = todo.due_date ? getDueDateInfo(todo.due_date) : null;

      return (
        <div
          key={todo.id}
          onClick={() => handleSelectTodo(todo.id)}
          className={`${styles.taskCard} ${styles.listCard} ${
            selectedTodo === todo.id ? styles.selectedCard : ''
          }`}
        >
          {/* Checkbox */}
          <div
            className={`${styles.checkbox} ${
              todo.status === "Done" ? styles.checkboxDone : ""
            }`}
            onClick={(e) => { e.stopPropagation(); handleSubtaskStatusToggle(todo.id, todo.status); }}>
            {todo.status === "Done" && <CheckCircle2 size={12} color="white" />}
          </div>

          {/* Main Content */}
          <div className={styles.listCardMainContent}>
            <h4 className={styles.title}>{todo.title}</h4>
            {todo.description && (
              <p className={styles.description}>{todo.description}</p>
            )}

            {todo.duration_minutes && !todo.tags?.length && (
              <div className={styles.progressWrapper}>
                <div className={styles.progressHeader}>
                  <span>Progress</span>
                  <span>{completion}%</span>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Meta Section */}
          <div className={styles.metaSection}>
            <div
              className={styles.statusBadge}
              style={{ color: statusInfo.color, background: statusInfo.background }}
            >
              {statusInfo.text}
            </div>

            {due && (
              <div className={styles.dueDate} style={{ color: due.color }}>
                <Calendar size={12} />
                {due.text}
              </div>
            )}

            {todo.subtasks.length > 0 && (
              <span className={styles.subtaskBadge}>
                <ListChecks size={12} />
                {todo.subtasks.filter((s) => s.status === "Done").length}/
                {todo.subtasks.length}
              </span>
            )}
          </div>

          {/* Second Row: Tags or Progress */}
          {todo.tags?.length > 0 ? (
            <div className={styles.tagsContainer}>
              {todo.tags.slice(0, 4).map(tag => (
                <span key={tag.name} className={styles.tagBadge} style={{ color: tag.color, background: tag.background }}>
                  {tag.name}
                </span>
              ))}
            </div>
          ) : (<> </>)}

        </div>
      );
    })}
  </div>
)}

          {/* History View */}
          {activeView === 'history' && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
                Archived Tasks
              </h2>
              {hiddenTodos.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '14px' }}>No hidden tasks.</p>
              ) : (
                <div className={styles.listView}>
                  {hiddenTodos.map((todo) => (
                    <div
                      key={todo.id}
                      onClick={() => handleSelectTodo(todo.id)}
                      className={`${styles.taskCard} ${styles.listTaskCard}`}
                      style={{
                        opacity: 0.8,
                        border: selectedTodo === todo.id ? '2px solid #111827' : '1px solid #e5e7eb',
                        boxShadow: selectedTodo === todo.id ? '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)' : '0 1px 2px 0 rgba(0,0,0,0.05)',
                      }}
                    >
                      <div className={styles.listTaskContent}>
                        <div
                          className={styles.taskCheckbox}
                          style={{ background: todo.status === 'Done' ? '#111827' : 'white' }}
                        >
                          {todo.status === 'Done' && <CheckCircle2 size={12} color="white" />}
                        </div>
                        <div className={styles.taskDetails}>
                          <h4 className={styles.taskTitle} style={{ fontSize: '15px', textDecoration: 'line-through' }}>
                            {todo.title}
                          </h4>
                          <div className={styles.taskStatus}>
                            <span className={styles.statusBadge}>{todo.status}</span>
                            {todo.due_date && (
                              (() => {
                                const dueDateInfo = getDueDateInfo(todo.due_date);
                                return (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: dueDateInfo.color }}>
                                    <Calendar size={12} />
                                    {dueDateInfo.text}
                                  </span>
                                );
                              })()
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isLoading && (
            <div className={styles.loadingContainer}>
              <Loader2 size={24} className={styles.spinAnimation} />
            </div>
          )}
        </div>

        {/* Right Sidebar - Task Details */}
        {selectedTodoData && (
          <div className={styles.rightSidebar}>
            <div className={styles.sidebarHeader}>
              <h3 className={styles.sidebarTitle}>
                <div className={styles.breadcrumb}>
                  {taskPath.slice(0, -1).map(p => (
                    <React.Fragment key={p.id}>
                      <span onClick={() => handleSelectTodo(p.id)} className={styles.breadcrumbLink}>
                        {p.title}
                      </span>
                      <span className={styles.breadcrumbSeparator}>/</span>
                    </React.Fragment>
                  ))}
                  <span className={styles.breadcrumbCurrent}>{selectedTodoData.title}</span>
                </div>
              </h3>
            </div>

            <div className={styles.sidebarActions}>
              <button
                onClick={handleToggleHidden}
                title={selectedTodoData.hidden ? "Restore Task" : "Hide Task"}
                className={styles.iconButton}
                style={{ color: '#6b7280' }}
              >
                {selectedTodoData.hidden ? <ArchiveRestore size={18} /> : <EyeOff size={18} />}
              </button>
              <button onClick={() => handleDeleteTodo(selectedTodoData.id)} className={styles.iconButton} style={{ color: '#ef4444', marginLeft: '8px' }}>
                <Trash2 size={18} />
              </button>
              <button onClick={handleCloseDetails} className={styles.iconButton} style={{ color: '#6b7280', marginLeft: '8px' }}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.sidebarContent}>
              {/* Description */}
              {selectedTodoData.description && (
                <div className={styles.section}>
                  <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.6', margin: 0 }}>
                    {selectedTodoData.description}
                  </p>
                </div>
              )}

              {/* Status */}
              <div className={styles.section}>
                <label className={styles.sectionLabel}>Status</label>
                <div className={styles.statusButtons}>
                  {(['To Do', 'In Progress', 'Done'] as TodoStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(selectedTodoData.id, status)}
                      className={styles.statusButton}
                      style={{
                        background: selectedTodoData.status === status ? '#111827' : 'white',
                        color: selectedTodoData.status === status ? 'white' : '#6b7280',
                      }}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Details */}
              {(selectedTodoData.due_date || selectedTodoData.duration_minutes) && (
                <div className={styles.section}>
                  <label className={styles.sectionLabel}>Details</label> {/* Keep label even if duration is moved */}
                  <div className={styles.detailsGrid}>
                    {selectedTodoData.due_date && (
                      <div className={styles.detailRow}>
                        <Calendar size={16} color="#6b7280" />
                        <span style={{ flexGrow: 1 }}>{new Date(selectedTodoData.due_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Timer */}
              {selectedTodoData.duration_minutes && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <label className={styles.sectionLabel}>Timer</label>
                    {!isEditingDuration && (
                      <button onClick={handleEditDurationClick} className={styles.editButton}>
                        <Pencil size={12} />
                        Edit
                      </button>
                    )}
                  </div>
                  <div className={styles.timerCard}>
                    {error && <div className={styles.errorMessage} style={{marginBottom: '12px'}}>{error}</div>}
                    {isEditingDuration ? (
                      <div className={styles.editTimerForm}>
                        <div className={styles.timerEditControls}>
                          <div className={styles.timerEditUnit}>
                            <button onClick={incrementHours} className={styles.iconButton} style={{padding: '2px'}}><ChevronUp size={16} /></button>
                            <input
                              type="number"
                              value={tempEditHours}
                              onChange={(e) => setTempEditHours(Math.max(0, parseInt(e.target.value) || 0))}
                              className={styles.inputField}
                              style={{ width: '40px', textAlign: 'center', height: '30px', padding: '4px' }}
                              min="0"
                            />
                            <button onClick={decrementHours} className={styles.iconButton} style={{padding: '2px'}}><ChevronDown size={16} /></button>
                          </div>
                          <span className={styles.timerEditSeparator}>:</span>
                          <div className={styles.timerEditUnit}>
                            <button onClick={incrementMinutes} className={styles.iconButton} style={{padding: '2px'}}><ChevronUp size={16} /></button>
                            <input
                              type="number"
                              value={tempEditMinutes}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setTempEditMinutes(Math.max(0, Math.min(59, val))); // Minutes 0-59
                              }}
                              className={styles.inputField}
                              style={{ width: '40px', textAlign: 'center', height: '30px', padding: '4px' }}
                              min="0"
                              max="59"
                            />
                            <button onClick={decrementMinutes} className={styles.iconButton} style={{padding: '2px'}}><ChevronDown size={16} /></button>
                          </div>
                        </div>
                        <div className={styles.timerEditActions}>
                          <button onClick={handleSaveDuration} className={styles.buttonPrimary} style={{ padding: '4px 8px', height: '30px' }}>Save</button>
                          <button onClick={handleCancelDurationEdit} className={styles.buttonSecondary} style={{ padding: '4px 8px', height: '30px' }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={styles.timerDisplay}>
                          {showElapsedTime
                            ? formatTime((selectedTodoData.duration_minutes * 60) - timerSeconds)
                            : formatTime(timerSeconds)
                          }
                        </div>
                        <div className={styles.timerControls}>
                          <button
                            onClick={handleTimerToggle}
                            disabled={timerSeconds <= 0 && activeTimerId !== selectedTodoData.id}
                            className={styles.timerButton}
                            style={{ opacity: (timerSeconds <= 0 && activeTimerId !== selectedTodoData.id) ? 0.5 : 1 }}
                          >
                            {isTimerPaused || activeTimerId !== selectedTodoData.id ? <Play size={16} /> : <Pause size={16} />}
                            <span>{isTimerPaused || activeTimerId !== selectedTodoData.id ? 'Start' : 'Pause'}</span>
                          </button>
                          <button onClick={handleTimerReset} className={styles.buttonSecondary} style={{ padding: '8px', width: 'auto' }}>
                            <RefreshCw size={16} />
                          </button>
                          <button onClick={() => setShowElapsedTime(!showElapsedTime)} className={styles.buttonSecondary} style={{ padding: '8px', width: 'auto' }}>
                            <Percent size={16} />
                          </button>
                        </div>
                        <div className={styles.timerLabel}>
                          {showElapsedTime ? 'Time Elapsed' : 'Time Remaining'}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Checklist */}
              <div className={styles.section}>
                <div className={styles.checklistHeader}>
                  <label className={styles.sectionLabel}>
                    Checklist ({selectedTodoData.subtasks.filter(st => st.status === 'Done').length}/{selectedTodoData.subtasks.length})
                  </label>
                  <span className={styles.checklistTime}>
                    {formatTime(
                      selectedTodoData.subtasks
                        .filter(st => st.status === 'Done' && st.duration_minutes)
                        .reduce((sum, task) => sum + (task.duration_minutes || 0) * 60, 0)
                    )} finished
                  </span>
                </div>

                {selectedTodoData.subtasks.length > 0 && (
                  <div className={styles.checklistProgress}>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{
                          width: `${(selectedTodoData.subtasks.filter(st => st.status === 'Done').length / selectedTodoData.subtasks.length) * 100}%`,
                          background: '#111827',
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className={styles.checklistItems}>
                  {selectedTodoData.subtasks.map((subtask) => (
                    <div key={subtask.id} className={styles.checklistItem}>
                      <button onClick={() => handleSubtaskStatusToggle(subtask.id, subtask.status)} className={styles.checkButton}>
                        {subtask.status === 'Done' ? <CheckCircle2 size={20} color="#111827" /> : <Circle size={20} color="#9ca3af" />}
                      </button>
                      <span
                        onClick={() => handleSelectTodo(subtask.id)}
                        className={styles.checklistText}
                        style={{
                          textDecoration: subtask.status === 'Done' ? 'line-through' : 'none',
                          opacity: subtask.status === 'Done' ? 0.6 : 1,
                        }}
                      >
                        {subtask.title}
                      </span>
                      <button onClick={() => handleDeleteSubtask(subtask.id)} className={styles.deleteButton} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}>
                        <Trash2 size={14} />
                      </button>
                      {subtask.duration_minutes && (
                        <span style={{ fontSize: '12px', color: '#6b7280', background: '#e5e7eb', padding: '2px 6px', borderRadius: '4px' }}>
                          {subtask.duration_minutes}m
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {showSubtaskForm ? (
                  <div className={styles.checklistForm}>
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="New subtask title"
                      className={styles.inputField}
                    />
                    <input
                      type="number"
                      value={newSubtaskDuration}
                      onChange={(e) => setNewSubtaskDuration(e.target.value)}
                      placeholder="Duration (mins, optional)"
                      className={styles.inputField}
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => setShowSubtaskForm(false)} className={styles.buttonSecondary}>Cancel</button>
                      <button onClick={handleAddSubtask} className={styles.buttonPrimary}>Add</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowSubtaskForm(true)} className={styles.addButton}>
                    <Plus size={16} />
                    Add item
                  </button>
                )}
              </div>

              {/* Comments */}
              <div className={styles.section}>
                <label className={styles.sectionLabel}>Comments ({selectedTodoData.comments.length})</label>
                <div className={styles.itemsList}>
                  {selectedTodoData.comments.map((comment) => (
                    <div key={comment.id} className={`${styles.listItem} ${styles.listItemHover}`}>
                      <div className={styles.commentContent}>
                        <p className={styles.commentText}>{comment.text}</p>
                        <div className={styles.commentFooter}>
                          <span className={styles.commentTime}>{new Date(comment.created_at).toLocaleString()}</span>
                          <button onClick={() => handleDeleteComment(comment.id)} className={styles.deleteButton} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', marginRight: '-4px' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={styles.inputGroup}>
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className={`${styles.inputField} ${styles.inputFlex}`}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                  />
                  <button onClick={handleAddComment} className={styles.sendButton}>
                    <Send size={16} />
                  </button>
                </div>
              </div>

              {/* Links */}
              <div className={styles.section}>
                <label className={styles.sectionLabel}>Links ({selectedTodoData.attachments.length})</label>
                <div className={styles.itemsList}>
                  {selectedTodoData.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.linkItem} ${styles.listItemHover}`}
                    >
                      <Link2 size={16} color="#6b7280" />
                      <span className={styles.linkText}>{attachment.url}</span>
                      <button
                        onClick={(e) => { e.preventDefault(); handleDeleteAttachment(attachment.id); }}
                        className={styles.deleteButton}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', marginLeft: '8px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </a>
                  ))}
                </div>
                <div className={styles.inputGroup}>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="Add a link..."
                    className={`${styles.inputField} ${styles.inputFlex}`}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddLink()}
                  />
                  <button onClick={handleAddLink} className={styles.sendButton}>
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Todo;