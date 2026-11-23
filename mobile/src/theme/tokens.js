import { Platform } from 'react-native';

export const colors = {
  background: '#F3F4F2',
  surface: '#FCFCFA',
  surfaceStrong: '#E8ECE9',
  text: '#20292B',
  muted: '#566365',
  border: '#CDD5D2',
  accent: '#245A63',
  accentText: '#FFFFFF',
  error: '#A13D43',
};

export const serif = Platform.select({ ios: 'Georgia', default: 'serif' });
