import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

export const sessionExpired = 'Tu sesión terminó. Vuelve a iniciar sesión.';

export function useProfessionalRead(load, onSessionEnd) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ revision: 0, loading: true });

  useFocusEffect(useCallback(() => {
    let active = true;
    setState({ revision, loading: true });
    load()
      .then((data) => { if (active) setState({ revision, data }); })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401) onSessionEnd(sessionExpired);
        else setState({ revision, error: error.message });
      });
    return () => { active = false; };
  }, [load, onSessionEnd, revision]));

  return {
    ...(state.revision === revision ? state : { loading: true }),
    refresh: () => setRevision((value) => value + 1),
  };
}
