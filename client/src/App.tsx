import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WaterTracker from './components/WaterTracker.tsx';
import Home from './components/Home.tsx';
import { LanguageProvider } from './LanguageContext.tsx'; // This path is correct based on your file structure
import { ThemeProvider } from './components/ThemeContext.tsx'; // This path is also correct

function App() {
  return (
    <Router>
      <ThemeProvider>
        <LanguageProvider>
          <div className="App">
            <Routes>
              <Route path="/water/" element={<WaterTracker />} />
              <Route path="/" element={<Home />} />
            </Routes>
          </div>
        </LanguageProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
