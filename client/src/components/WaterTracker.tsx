import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Link } from 'react-router-dom';
import './WaterTracker.css';
import { useLanguage } from '../LanguageContext.tsx'; // Corrected path
import { useTheme } from './ThemeContext.tsx'; // Corrected path
import AnimatedNumber from './AnimatedNumber.tsx';

const API_BASE_URL = '/api';
interface WaterLog {
    id: number;
    amount_ml: number;
    timestamp: string;
}

interface TodayStats {
    today_total: number;
    entries: WaterLog[];
}

interface WeeklyData {
    date: string;
    total_ml: number;
}

interface DailyHourlyData {
    hour: string;
    total_ml: number;
}

const QUICK_ADD_AMOUNTS = [250, 500, 750];

const WaterTracker: React.FC = () => {
    const [todayStats, setTodayStats] = useState<TodayStats>({ today_total: 0, entries: [] });
    const [history, setHistory] = useState<WaterLog[]>([]);
    const [customAmount, setCustomAmount] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState<boolean>(false);
    const [showHistory, setShowHistory] = useState<boolean>(false);

    const [chartView, setChartView] = useState<'weekly' | 'daily'>('weekly');
    // localStorage'dan hedefi oku veya varsayılanı kullan
    const [dailyGoal, setDailyGoal] = useState<number>(() => {
        const savedGoal = localStorage.getItem('dailyWaterGoal');
        return savedGoal ? parseInt(savedGoal, 10) : 2500;
    });
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [newGoal, setNewGoal] = useState(dailyGoal.toString());

    const { theme, toggleTheme } = useTheme();
    const { language, toggleLanguage, t } = useLanguage();

    const streakCount = useMemo(() => {
        if (!history.length || !dailyGoal) return 0;

        const dailyTotals = new Map<string, number>();
        history.forEach(log => {
            const dateKey = new Date(log.timestamp).toLocaleDateString('en-CA'); // YYYY-MM-DD
            dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + log.amount_ml);
        });

        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if today's goal is met from todayStats to include real-time progress
        const todayKey = today.toLocaleDateString('en-CA');
        if (todayStats.today_total >= dailyGoal) {
             dailyTotals.set(todayKey, todayStats.today_total);
        }

        // Start checking from today backwards
        for (let i = 0; ; i++) {
            const dateToCheck = new Date(today);
            dateToCheck.setDate(today.getDate() - i);
            const dateKey = dateToCheck.toLocaleDateString('en-CA');

            if ((dailyTotals.get(dateKey) || 0) >= dailyGoal) {
                streak++;
            } else {
                break; // Streak is broken
            }
        }
        return streak;
    }, [history, dailyGoal, todayStats.today_total]);

    const getCustomWeekday = useCallback((date: Date, lang: 'en' | 'az') => {
        if (lang === 'az') {
            // Custom abbreviations for Azerbaijani weekdays as requested.
            const azWeekdays = ['B.', 'B.E.', 'Ç.A.', 'Ç.', 'C.A.', 'C.', 'Ş.'];
            const dayIndex = date.getDay();
            // This will produce formats like "b.e.", "ç.a.", "c.", etc.
            return azWeekdays[dayIndex].toLowerCase();
        }
        // Default English short weekdays.
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    }, []);

    const weeklyChartData = useMemo(() => {
        const last7Days: { [key: string]: number } = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Use a stable locale for date keys to avoid issues
        const dateLocale = 'en-CA'; // YYYY-MM-DD format

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateString = d.toLocaleDateString('en-CA'); // YYYY-MM-DD format
            last7Days[dateString] = 0;
        }

        history.forEach(log => {
            const logDate = new Date(log.timestamp).toLocaleDateString('en-CA');
            if (last7Days[logDate] !== undefined) {
                last7Days[logDate] += log.amount_ml;
            }
        });

        return Object.entries(last7Days).map(([date, total_ml]) => ({
            // By replacing hyphens with slashes, we ensure the date is parsed in the user's local timezone,
            // preventing off-by-one day errors that can occur with 'YYYY-MM-DD' format.
            // This makes the weekday display consistently correct across timezones.
            date: getCustomWeekday(new Date(date.replace(/-/g, '/')), language),
            total_ml,
        }));
    }, [history, language, getCustomWeekday]);

    const dailyHourlyChartData = useMemo(() => {
        const hours = Array.from({ length: 24 }, (_, i) => {
            const hourLabel = `${i.toString().padStart(2, '0')}:00`;
            return { hour: hourLabel, total_ml: 0 };
        });

        todayStats.entries.forEach(log => {
            const logHour = new Date(log.timestamp).getHours();
            if (hours[logHour]) {
                hours[logHour].total_ml += log.amount_ml;
            }
        });

        return hours;
    }, [todayStats.entries]);


    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [todayResponse, historyResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/water/`),
                fetch(`${API_BASE_URL}/history`)
            ]);

            if (!todayResponse.ok || !historyResponse.ok) {
                throw new Error(t('waterTracker.fetchError'));
            }

            const todayData: TodayStats = await todayResponse.json();
            const historyData: WaterLog[] = await historyResponse.json();

            setTodayStats(todayData);
            setHistory(historyData);
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError(t('waterTracker.unknownError'));
            }
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddWater = useCallback(async (amount: number) => {
        if (!amount || amount <= 0 || isAdding) return;

        setIsAdding(true);
        const previousTodayStats = todayStats;
        const previousHistory = history;

        try {
            const response = await fetch(`${API_BASE_URL}/water/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount_ml: amount }),
            });

            if (!response.ok) {
                throw new Error(t('waterTracker.addError'));
            }

            const newLog: WaterLog = await response.json();
            setTodayStats(prev => ({
                today_total: prev.today_total + amount,
                entries: [newLog, ...prev.entries]
            }));
            setHistory(prev => [newLog, ...prev]);

            setCustomAmount('');
        } catch (err) {
             if (err instanceof Error) {
                setError(err.message);
            } else {
                setError(t('waterTracker.unknownError'));
            }
            // Rollback on error
            setTodayStats(previousTodayStats);
            setHistory(previousHistory);
        } finally {
            setIsAdding(false);
        }
    }, [isAdding, t]);

    const handleDeleteWater = useCallback(async (logId: number, amount: number) => {
        // Keep the previous state in case of an error
        const previousTodayStats = todayStats;
        const previousHistory = history;

        // Optimistic UI update
        setTodayStats(prev => ({
            today_total: prev.today_total - amount,
            entries: prev.entries.filter(log => log.id !== logId)
        }));
        setHistory(prev => prev.filter(log => log.id !== logId));

        try {
            const response = await fetch(`${API_BASE_URL}/water/${logId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error(t('waterTracker.deleteError'));
            }
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError(t('waterTracker.unknownError'));
            }
            // Rollback on error
            setTodayStats(previousTodayStats);
            setHistory(previousHistory);
        }
    }, [todayStats, history, t]);

    const handleGoalSave = () => {
        const goal = parseInt(newGoal, 10);
        if (!isNaN(goal) && goal > 0) {
            setDailyGoal(goal);
            localStorage.setItem('dailyWaterGoal', newGoal);
            setIsEditingGoal(false);
        }
    };

    // Allow percentage to go over 100 for over-achievement state
    const progressPercentage = dailyGoal > 0 ? (todayStats.today_total / dailyGoal) * 100 : 0;
    const displayPercentage = Math.min(progressPercentage, 100);
    const isGoalMet = progressPercentage >= 100;

    const amountFontSize = useMemo(() => {
        const numChars = String(todayStats.today_total).length;
        // If the goal is met, the text below takes up space, so we need to be more aggressive with shrinking.
        if (isGoalMet) {
            if (numChars > 4) return '2.0rem';
            return '2.2rem';
        }
        if (numChars > 5) return '2.0rem';
        if (numChars > 4) return '2.2rem';
        return '2.5rem';
    }, [todayStats.today_total, isGoalMet]);

    if (isLoading) return <div className="loading">{t('waterTracker.loading')}</div>;
    if (error) return <div className="error">{t('waterTracker.error')}: {error}</div>;

    return (
        <div className={`water-tracker ${theme}`}>
            <header>
                <Link to="/" className="home-link">
                    {t('waterTracker.goHome')}
                </Link>
                <div className="header-controls">
                    {streakCount > 0 && (
                        <div className="streak-display-header">
                            🔥 {streakCount}
                        </div>
                    )}
                    <button onClick={toggleLanguage} className="language-toggle">
                        {language.toUpperCase()}
                    </button>
                    <button onClick={toggleTheme} className="theme-toggle">{theme === 'light' ? '🌙' : '☀️'}</button>
                </div>
                <h1>{t('waterTracker.title')}</h1>
                <div className="daily-goal">
                    {isEditingGoal ? (
                        <div className="goal-edit">
                            <input type="number" value={newGoal} onChange={(e) => setNewGoal(e.target.value)} />
                            <button onClick={handleGoalSave}>{t('waterTracker.save')}</button>
                            <button onClick={() => setIsEditingGoal(false)} className="cancel">{t('waterTracker.cancel')}</button>
                        </div>
                    ) : (
                        <>
                            <span>{t('waterTracker.goal')}: {dailyGoal / 1000} {t('waterTracker.liters')}</span>
                            <button onClick={() => setIsEditingGoal(true)} className="edit-goal-btn">✏️</button>
                        </>
                    )}
                </div>
            </header>

            <div className="progress-section">
                <div
                    className={`progress-circle-container ${isGoalMet ? 'goal-met' : ''} ${
                        progressPercentage > 100 ? 'goal-overachieved' : ''
                    }`}
                >
                    <svg viewBox="0 0 36 36" className="progress-circle">
                        <path className="circle-bg"
                            d="M18 2.0845
                              a 15.9155 15.9155 0 0 1 0 31.831
                              a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path className="circle"
                            strokeDasharray={`${displayPercentage}, 100`}
                            d="M18 2.0845
                              a 15.9155 15.9155 0 0 1 0 31.831
                              a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                    </svg>
                     <div className="progress-text">
                        <strong style={{ fontSize: amountFontSize }}><AnimatedNumber value={todayStats.today_total} /> ml</strong>
                        {isGoalMet ? (
                            <span className="goal-reached-text">{t('waterTracker.goalReached')}</span>
                        ) : (
                            <span>/ {dailyGoal} ml</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="add-water-section">
                <h3>{t('waterTracker.quickAdd')}</h3>
                <div className="quick-add-buttons">
                    {QUICK_ADD_AMOUNTS.map(amount => (
                        <button key={amount} onClick={() => handleAddWater(amount)}>+ {amount} ml</button>
                    ))}
                </div>
                <div className="custom-add">
                    <input
                        type="number"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder={t('waterTracker.customAmountPlaceholder')}
                    />
                    <button onClick={() => handleAddWater(parseInt(customAmount, 10))} disabled={isAdding}>
                        {isAdding ? t('waterTracker.adding') : t('waterTracker.add')}
                    </button>
                </div>
            </div>

            <div className="stats-section">
                <div className="stats-header">
                    <h3>{chartView === 'weekly' ? t('waterTracker.weeklyStats') : t('waterTracker.hourlyIntake')}</h3>
                    <div className="chart-toggle-buttons">
                        <button
                            onClick={() => setChartView('weekly')}
                            className={chartView === 'weekly' ? 'active' : ''}
                        >
                            {t('waterTracker.weekly')}
                        </button>
                        <button
                            onClick={() => setChartView('daily')}
                            className={chartView === 'daily' ? 'active' : ''}
                        >
                            {t('waterTracker.daily')}
                        </button>
                    </div>
                </div>
                <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                        {chartView === 'weekly' ? (
                            <BarChart data={weeklyChartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted-color)' }} stroke="var(--border-color)" />
                                <YAxis unit="ml" tick={{ fill: 'var(--text-muted-color)' }} stroke="var(--border-color)" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--card-bg-color)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                                    formatter={(value: number) => [`${value} ml`, t('waterTracker.intake')]}
                                />
                                <Bar dataKey="total_ml" fill="var(--primary-color)" name={t('waterTracker.waterDrunk')} />
                            </BarChart>
                        ) : (
                            <BarChart data={dailyHourlyChartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
                                <XAxis dataKey="hour" tick={{ fill: 'var(--text-muted-color)' }} stroke="var(--border-color)" interval={2} />
                                <YAxis unit="ml" tick={{ fill: 'var(--text-muted-color)' }} stroke="var(--border-color)" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--card-bg-color)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                                    formatter={(value: number) => [`${value} ml`, t('waterTracker.intake')]}
                                />
                                <Bar dataKey="total_ml" fill="var(--secondary-color, #82ca9d)" name={t('waterTracker.waterDrunk')} />
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="log-section">
                <h3>{t('waterTracker.todaysLogs')}</h3>
                <ul className="log-list">
                    {todayStats.entries.length > 0 ? (
                        todayStats.entries.map(log => (
                            <li key={log.id} className="log-item">
                                <span>{log.amount_ml} ml - {new Date(log.timestamp).toLocaleTimeString(language === 'az' ? 'az-AZ' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: language === 'en' })}</span>
                                <button onClick={() => handleDeleteWater(log.id, log.amount_ml)} className="delete-log-btn">🗑️</button>
                            </li>
                        ))
                    ) : (
                        <li className="empty-log">{t('waterTracker.noWaterToday')}</li>
                    )}
                </ul>
            </div>

            <div className="history-section">
                <button className="toggle-history" onClick={() => setShowHistory(!showHistory)}>
                    {showHistory ? t('waterTracker.hideHistory') : t('waterTracker.showHistory')}
                </button>
                {showHistory && (
                    <ul className="log-list">
                        {history.length > 0 ? (
                            history.map(log => (
                                <li key={log.id}>
                                    <span>{log.amount_ml} ml</span>
                                    <span>{new Date(log.timestamp).toLocaleString(language === 'az' ? 'az-AZ' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                </li>
                            ))
                        ) : (
                            <li className="empty-log">{t('waterTracker.noRecords')}</li>
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default WaterTracker;