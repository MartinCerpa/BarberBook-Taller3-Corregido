import { useState } from 'react';
import { useProfessionalSession } from '../components/ProfessionalSession';
import { sessionExpired } from './useProfessionalRead';
import { obtenerSesionProfesional } from '../services/professionalApi';

export async function persistProfessionalSetting({ write, reload, onSaved, onReload = onSaved, session, onSession, onSessionEnd }) {
  try {
    onSaved(await write(session.csrfToken));
  } catch (error) {
    if (error.status === 401) {
      onSessionEnd(sessionExpired);
      return;
    }
    if (error.status === 403) {
      try {
        const current = await obtenerSesionProfesional();
        if (current?.id !== session.id) {
          onSessionEnd(sessionExpired);
          return;
        }
        onSession(current);
        return { error: `${error.message} Sesión actualizada. Revisa tus cambios y vuelve a guardar.` };
      } catch {
        return { error: `${error.message} No pudimos verificar la sesión.` };
      }
    }
    return { error: error.message };
  }

  try {
    onReload(await reload());
    return { notice: 'Cambios guardados.' };
  } catch (error) {
    if (error.status === 401) {
      onSessionEnd(sessionExpired);
      return;
    }
    return { notice: 'Cambios guardados.', error: `No pudimos consultar los datos actualizados. ${error.message}` };
  }
}

export function useProfessionalSettingsSave() {
  const context = useProfessionalSession();
  const { writing, beginWrite, endWrite } = context;
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function save(action) {
    if (!beginWrite()) return;
    setSaving(true);
    setFeedback(null);
    try {
      setFeedback(await persistProfessionalSetting({ ...action, ...context }));
    } finally {
      setSaving(false);
      endWrite();
    }
  }

  return { save, feedback, setFeedback, saving, disabled: writing };
}
