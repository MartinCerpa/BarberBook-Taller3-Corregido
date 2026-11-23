import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { BookingFlow } from '../../components/BookingFlow';
import { BookingPage, Button, Message } from '../../components/BookingPage';
import { obtenerProfesionales, obtenerServicios } from '../../services/api';

export default function BookingRoute() {
  const { professionalId } = useLocalSearchParams();
  const id = typeof professionalId === 'string' ? Number(professionalId) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) {
    return (
      <BookingPage title="Profesional no válido">
        <Button label="Volver al catálogo" onPress={() => router.dismissTo('/')} />
      </BookingPage>
    );
  }
  return <ProfessionalBooking key={id} professionalId={id} />;
}

function ProfessionalBooking({ professionalId }) {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([obtenerProfesionales(), obtenerServicios()])
      .then(([professionals, items]) => {
        if (active) setCatalog({
          professional: professionals.find(({ id }) => id === professionalId),
          services: items.filter((item) => item.professional_id === professionalId),
        });
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => { active = false; };
  }, [professionalId, revision]);

  if (catalog?.professional && catalog.services.length) {
    return <BookingFlow professional={catalog.professional} services={catalog.services} />;
  }
  return (
    <BookingPage title="Servicios">
      {error ? (
        <>
          <Message error>{error}</Message>
          <Button label="Reintentar" onPress={() => {
            setError('');
            setRevision((value) => value + 1);
          }} />
        </>
      ) : (
        <Message>{catalog?.professional
          ? 'Este profesional no tiene servicios publicados.'
          : catalog ? 'El profesional ya no está en el catálogo.' : 'Cargando profesional y servicios…'}</Message>
      )}
      <Button label="Volver al catálogo" secondary onPress={() => router.dismissTo('/')} />
    </BookingPage>
  );
}
