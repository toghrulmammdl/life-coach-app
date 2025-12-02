import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import en from './locales/en.json';
import az from './locales/az.json';

type Language = 'en' | 'az';

const translations = { en, az };

interface LanguageContextType {
    language: Language;
    toggleLanguage: () => void;
    t: (key: string) => string;
}

const getNestedValue = (obj: any, path: string): string => {
    const value = path.split('.').reduce((acc, part) => acc && acc[part], obj);
    return value || path;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'en');

    useEffect(() => {
        localStorage.setItem('language', language);
    }, [language]);

    const toggleLanguage = () => {
        setLanguage(prevLang => (prevLang === 'en' ? 'az' : 'en'));
    };

    const t = useCallback((key: string) => {
        return getNestedValue(translations[language], key);
    }, [language]);

    return (
        <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = (): LanguageContextType => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};