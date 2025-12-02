import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';
import { useLanguage } from '../LanguageContext.tsx'; // Corrected path
import { useTheme } from './ThemeContext.tsx'; // Corrected path

function Home() {
  const { theme, toggleTheme } = useTheme(); // Using the hook
  const { language, toggleLanguage, t } = useLanguage(); // Using the hook

  return (
    <div className={`home-container ${theme}`}>
      <header className="home-header">
        <div className="header-controls">
            <button onClick={toggleLanguage} className="language-toggle">
                {language.toUpperCase()}
            </button>
            <button onClick={toggleTheme} className="theme-toggle">
                {theme === 'light' ? '🌙' : '☀️'}
            </button>
        </div>
        <h1>{t('home.title')}</h1>
        <p>{t('home.subtitle')}</p>
      </header>
      <main className="features-grid">
        <Link to="/water/" className="feature-card">
          <div className="card-content">
            <h2>{t('home.waterTrackerTitle')}</h2>
            <p>{t('home.waterTrackerDesc')}</p>
          </div>
          <span className="card-cta">{t('home.trackNow')}</span>
        </Link>
        
        <div className="feature-card placeholder-card">
           <div className="card-content">
            <h2>{t('home.comingSoonTitle')}</h2>
            <p>{t('home.comingSoonDesc')}</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Home;