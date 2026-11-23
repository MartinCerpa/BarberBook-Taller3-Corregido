import { Platform } from 'react-native';

const light = {
  background: '#F3F4F2',
  surface: '#FCFCFA',
  surfaceStrong: '#E8ECE9',
  text: '#20292B',
  muted: '#566365',
  border: '#CDD5D2',
  accent: '#245A63',
  accentPressed: '#1C4850',
  accentText: '#FFFFFF',
  cover: '#245A63',
  warning: '#785315',
  warningSurface: '#F5ECD9',
  success: '#2D6344',
  successSurface: '#E5EFE7',
  error: '#A13D43',
};

export const palettes = {
  light,
  dark: {
    background: '#181D1E',
    surface: '#232A2B',
    surfaceStrong: '#30393A',
    text: '#F1F4F2',
    muted: '#B3BFBE',
    border: '#465354',
    accent: '#9BCBD0',
    accentPressed: '#B2DADD',
    accentText: '#172D31',
    cover: '#30393A',
    warning: '#E6C181',
    warningSurface: '#3B3223',
    success: '#A5D3B2',
    successSurface: '#25382D',
    error: '#F0A6AB',
  },
};

export const serif = Platform.select({ ios: 'Georgia', default: 'serif' });
