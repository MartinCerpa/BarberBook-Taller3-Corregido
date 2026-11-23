import { createContext, useContext } from 'react';

export const ProfessionalSession = createContext(null);
export const useProfessionalSession = () => useContext(ProfessionalSession);
