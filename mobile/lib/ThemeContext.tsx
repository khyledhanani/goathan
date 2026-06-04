import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";

export type ThemeChoice = "system" | "light" | "dark";

type ThemeContextValue = {
  choice: ThemeChoice;
  setChoice: (c: ThemeChoice) => void;
};

const ThemeCtx = createContext<ThemeContextValue>({
  choice: "system",
  setChoice: () => {},
});

const STORAGE_KEY = "receipts.theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("system");

  useEffect(() => {
    const v = SecureStore.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") {
      setChoiceState(v);
    }
  }, []);

  const setChoice = (c: ThemeChoice) => {
    setChoiceState(c);
    SecureStore.setItem(STORAGE_KEY, c);
  };

  return (
    <ThemeCtx.Provider value={{ choice, setChoice }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useThemeChoice() {
  return useContext(ThemeCtx);
}
