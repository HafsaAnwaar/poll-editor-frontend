import React, { createContext, useContext, useEffect, useState } from 'react';

const PollContext = createContext();

export const usePollContext = () => {
  const context = useContext(PollContext);
  if (!context) {
    throw new Error('usePollContext must be used within a PollProvider');
  }
  return context;
};

export const PollProvider = ({ children }) => {
  const getInitialTheme = () => {
    try {
      const saved = localStorage.getItem('app_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'light';
  };

  const [settings, setSettings] = useState({
    showResults: true,
    theme: getInitialTheme(),
    autoSave: true,
    liveMode: false,
    showRichText: false,
    displayMode: 'editor', // 'editor' | 'viewer' | 'presentation'
  });

  useEffect(() => {
    try {
      localStorage.setItem('app_theme', settings.theme);
    } catch {}
  }, [settings.theme]);

  const updateSettings = (newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const value = {
    settings,
    updateSettings,
    toggleSetting,
  };

  return (
    <PollContext.Provider value={value}>
      {children}
    </PollContext.Provider>
  );
};
