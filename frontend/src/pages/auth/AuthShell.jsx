import { Link } from 'react-router-dom';
import {
  AcademicCapIcon,
  CheckBadgeIcon,
  DocumentCheckIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import cvsuLogo from '../../assets/cvsu-logo.png';

const authHighlights = [
  {
    icon: AcademicCapIcon,
    title: 'Alumni access',
    text: 'Manage your CVSU-Carmona alumni profile and directory visibility.',
  },
  {
    icon: DocumentCheckIcon,
    title: 'Document services',
    text: 'Request, upload, and verify academic records in one place.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Protected records',
    text: 'Account recovery and blockchain-backed verification help keep records trusted.',
  },
];

export default function AuthShell({
  title,
  subtitle,
  switchText,
  switchTo,
  switchLabel,
  badgeText,
  children,
}) {
  return (
    <div className="min-h-[calc(100vh-73px)] bg-slate-50">
      <div className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_480px] lg:px-8 lg:py-12">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cvsu-green/20 bg-white px-3 py-1 text-sm font-semibold text-cvsu-green shadow-sm">
              <CheckBadgeIcon className="h-4 w-4" aria-hidden="true" />
              {badgeText}
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-normal text-slate-950">
              CVSU-Carmona Alumni Portal
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
              A focused space for alumni profiles, campus events, document requests, and secure record verification.
            </p>
            <div className="mt-8 grid gap-4">
              {authHighlights.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="flex gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cvsu-green/10 text-cvsu-green">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-950">{item.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="w-full">
          <div className="mx-auto w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70 sm:p-8">
            <div className="text-center">
              <Link to="/" className="inline-flex items-center justify-center gap-3">
                <img className="h-12 w-auto" src={cvsuLogo} alt="CVSU" />
                <span className="text-left text-sm font-bold leading-tight text-cvsu-green">
                  CVSU-Carmona
                  <span className="block text-xs font-semibold text-slate-500">Alumni Portal</span>
                </span>
              </Link>
              <h2 className="mt-6 text-2xl font-bold tracking-normal text-slate-950">{title}</h2>
              <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
              <p className="mt-3 text-sm text-slate-600">
                {switchText}{' '}
                <Link to={switchTo} className="font-semibold text-cvsu-green hover:text-cvsu-green/80">
                  {switchLabel}
                </Link>
              </p>
            </div>

            <div className="mt-8">{children}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
