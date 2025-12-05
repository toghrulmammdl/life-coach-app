import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WaterTracker from './components/apps/watertracker/WaterTracker.tsx';
import Home from './components/apps/home/Home.tsx';
import Todo from './components/apps/todo/Todo.tsx'; 
import { LanguageProvider } from './components/utils/LanguageContext.tsx'; // This path is correct based on your file structure
import { ThemeProvider } from './components/utils/ThemeContext.tsx'; // This path is also correct
function App() {
  return (
    <Router>
      <ThemeProvider>
        <LanguageProvider>
          <div className="App">
            <Routes>
              <Route path="/water/" element={<WaterTracker />} />
              <Route path="/todo/" element={<Todo />} />
              <Route path="/" element={<Home />} />
            </Routes>
          </div>
        </LanguageProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
