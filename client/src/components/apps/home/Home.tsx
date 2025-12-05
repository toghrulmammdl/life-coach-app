import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Home.module.css';
import { useLanguage } from '../../utils/LanguageContext.tsx'; // Corrected path
import { useTheme } from '../../utils/ThemeContext.tsx'; // Corrected path

function Home() {
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <div className={styles.homeContainer}>
      <header className={styles.homeHeader}>
        <div className={styles.headerControls}>
            <button onClick={toggleLanguage} className={`${styles.controlButton} ${styles.languageToggle}`}>
                {language.toUpperCase()}
            </button>
            <button onClick={toggleTheme} className={styles.controlButton}>
                {theme === 'light' ? '🌙' : '☀️'}
            </button>
        </div>
        <h1>{t('home.title')}</h1>
        <p>{t('home.subtitle')}</p>
      </header>
      <main className={styles.featuresGrid}>
        <Link to="/water/" className={styles.featureCard}>
          <div className={styles.cardContent}>
            <h2>{t('home.waterTrackerTitle')}</h2>
            <p>{t('home.waterTrackerDesc')}</p>
          </div>
          <span className={styles.cardCta}>{t('home.trackNow')}</span>
        </Link>
        
        <Link to="/todos/" className={styles.featureCard}>
          <div className={styles.cardContent}>
            <h2>{t('home.todoListTitle')}</h2>
            <p>{t('home.todoListDesc')}</p>
          </div>
          <span className={styles.cardCta}>{t('home.organizeNow')}</span>
        </Link>
      </main>
    </div>
  );
}

export default Home;