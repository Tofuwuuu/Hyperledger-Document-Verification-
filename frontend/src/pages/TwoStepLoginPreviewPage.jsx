import { Navigate } from 'react-router-dom';
import MFASetup from '../components/MFASetup';
import { PREVIEW_MODE } from '../config';

// Public look at the two-step login setup card while the demo runs without an API.
// With a real API the card lives on the signed-in security settings page.
export default function TwoStepLoginPreviewPage() {
  if (!PREVIEW_MODE) return <Navigate to="/alumni/profile/security" replace />;
  return (
    <div className="min-h-[calc(100vh-73px)] bg-slate-50">
      <div role="note" className="border-b border-slate-200 bg-slate-100 px-4 py-1.5 text-center text-xs font-medium text-slate-500">
        UI preview. Login is turned off.
      </div>
      <div className="mx-auto w-full max-w-lg px-4 py-8 sm:py-12">
        <MFASetup />
      </div>
    </div>
  );
}
