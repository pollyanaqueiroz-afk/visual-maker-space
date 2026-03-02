import { useSearchParams } from 'react-router-dom';
import BriefingForm from '@/pages/BriefingForm';

export default function ClienteSolicitar() {
  const [searchParams] = useSearchParams();
  const mockupOnly = searchParams.get('mockup') === '1';

  return <BriefingForm mockupOnly={mockupOnly} />;
}
