import { ProfessionalRequests } from '../../components/ProfessionalRequests';
import { useProfessionalSession } from '../../components/ProfessionalSession';

export default function ProfessionalRequestsRoute() {
  const context = useProfessionalSession();
  return <ProfessionalRequests {...context} />;
}
