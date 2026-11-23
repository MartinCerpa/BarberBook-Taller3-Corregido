import { createContext, useContext, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { palettes } from './tokens';

type Mode = keyof typeof palettes;

const AppearanceContext = createContext({
  mode: 'light' as Mode,
  colors: palettes.light,
  toggle: () => {},
});

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const system: Mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [override, setOverride] = useState<Mode | null>(null);
  const mode = override ?? system;

  function toggle() {
    const next = mode === 'dark' ? 'light' : 'dark';
    setOverride(next === system ? null : next);
  }

  return (
    <AppearanceContext.Provider value={{ mode, colors: palettes[mode], toggle }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export const useAppearance = () => useContext(AppearanceContext);
