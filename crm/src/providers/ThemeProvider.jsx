import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const DEFAULT_THEME_MODE = 'light';
const DEFAULT_UI_ACCENT = '#2563EB';

const ThemeContext = createContext({
  themeMode: DEFAULT_THEME_MODE,
  uiAccentColor: DEFAULT_UI_ACCENT,
  ready: false,
  savePreferences: async () => {},
});

const applyTheme = ({ themeMode, uiAccentColor }) => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.classList.toggle('dark', themeMode === 'dark');
  root.style.setProperty('--ui-accent', uiAccentColor || DEFAULT_UI_ACCENT);
};

export const ThemeProvider = ({ user, children }) => {
  const [themeMode, setThemeMode] = useState(DEFAULT_THEME_MODE);
  const [uiAccentColor, setUiAccentColor] = useState(DEFAULT_UI_ACCENT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setThemeMode(DEFAULT_THEME_MODE);
      setUiAccentColor(DEFAULT_UI_ACCENT);
      setReady(true);
      applyTheme({ themeMode: DEFAULT_THEME_MODE, uiAccentColor: DEFAULT_UI_ACCENT });
      return undefined;
    }

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      const preferences = snapshot.data()?.preferences || {};
      const nextMode = preferences.themeMode === 'dark' ? 'dark' : 'light';
      const nextAccent = preferences.uiAccentColor || DEFAULT_UI_ACCENT;

      setThemeMode(nextMode);
      setUiAccentColor(nextAccent);
      setReady(true);
      applyTheme({ themeMode: nextMode, uiAccentColor: nextAccent });
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const savePreferences = useCallback(
    async ({ nextThemeMode, nextUiAccentColor }) => {
      if (!user?.uid) throw new Error('Usuário não autenticado.');

      const payload = {
        themeMode: nextThemeMode === 'dark' ? 'dark' : 'light',
        uiAccentColor: nextUiAccentColor || DEFAULT_UI_ACCENT,
        updatedAt: serverTimestamp(),
      };

      await setDoc(
        doc(db, 'users', user.uid),
        {
          preferences: payload,
        },
        { merge: true }
      );
    },
    [user?.uid]
  );

  const value = useMemo(
    () => ({
      themeMode,
      uiAccentColor,
      ready,
      savePreferences,
    }),
    [themeMode, uiAccentColor, ready, savePreferences]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemePreferences = () => useContext(ThemeContext);
