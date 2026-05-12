import { Link } from 'react-router-dom';
import {
  AcademicCapIcon,
  ArrowRightIcon,
  BuildingLibraryIcon,
  CheckBadgeIcon,
  DocumentCheckIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import heroImage from '../assets/cvsu-hero.jpg';

const stats = [
  { id: 1, name: 'Established', value: '1998' },
  { id: 2, name: 'Alumni records', value: '15,000+' },
  { id: 3, name: 'Programs', value: '20+' },
  { id: 4, name: 'Partners', value: '50+' },
];

const features = [
  {
    name: 'Alumni Networking',
    description:
      'Connect with fellow CVSU-Carmona graduates, share professional updates, and stay visible in the alumni directory.',
    icon: UserGroupIcon,
  },
  {
    name: 'Academic Profiles',
    description:
      'Maintain a focused alumni profile with your education, work history, achievements, and continuing education.',
    icon: AcademicCapIcon,
  },
  {
    name: 'Document Verification',
    description:
      'Validate academic credentials through a tamper-aware workflow that helps employers and administrators verify records faster.',
    icon: DocumentCheckIcon,
  },
  {
    name: 'Hyperledger Fabric Security',
    description:
      'Use blockchain-backed document proofs to keep credential checks transparent without exposing private files.',
    icon: ShieldCheckIcon,
  },
];

const principles = [
  'Accessible alumni services for CVSU-Carmona graduates',
  'Admin-reviewed records before document release',
  'Public verification for trusted academic credentials',
];

export default function AboutPage() {
  return (
    <div className="bg-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img className="h-full w-full object-cover" src={heroImage} alt="CVSU-Carmona campus" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-cvsu-green/75 to-cvsu-green/30" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white to-transparent" />
        </div>

        <div className="relative mx-auto flex min-h-[500px] max-w-7xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
              <BuildingLibraryIcon className="h-4 w-4" aria-hidden="true" />
              CVSU-Carmona Alumni Portal
            </div>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              About CVSU-Carmona
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/90 sm:text-xl">
              Connecting alumni, campus services, and trusted academic credentials through a secure digital portal.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link to="/register" className="btn-primary bg-cvsu-yellow text-slate-950 hover:bg-yellow-300">
                Join Our Network
                <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/verify" className="btn-secondary border-white/30 bg-white text-cvsu-green hover:bg-slate-50">
                Verify Documents
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {principles.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-lg border border-white/20 bg-white/90 p-4 shadow-sm backdrop-blur">
                <CheckBadgeIcon className="h-5 w-5 shrink-0 text-cvsu-green" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-800">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-wide text-cvsu-green">Our Mission</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              A campus network built around service, records, and trust
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
              Cavite State University-Carmona Campus is committed to accessible, quality education that helps students become productive members of society. The alumni portal extends that mission after graduation by making profiles, document requests, and verification easier to manage.
            </p>
            <p className="mt-4 text-base leading-7 text-slate-600">
              The system brings alumni services and blockchain-backed credential verification into one workflow, reducing manual checks while keeping document access controlled.
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3">
            {stats.map((stat) => (
              <div key={stat.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <dt className="text-sm font-semibold text-slate-500">{stat.name}</dt>
                <dd className="mt-3 text-3xl font-extrabold tracking-tight text-cvsu-green">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-wide text-cvsu-green">Alumni Portal</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              Built for alumni records that need to be verified
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
              The platform supports the full path from profile creation to document validation, giving alumni and administrators a clearer way to manage trusted records.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {features.map((feature) => (
              <div key={feature.name} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-cvsu-green/10 text-cvsu-green">
                  <feature.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-950">{feature.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="lg:col-span-1">
            <p className="text-sm font-bold uppercase tracking-wide text-cvsu-green">How it helps</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">
              Simpler access for alumni and verifiers
            </h2>
          </div>
          <div className="grid gap-4 lg:col-span-2 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-6">
              <p className="text-sm font-bold text-slate-950">For alumni</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Keep your profile updated, request available documents, and participate in campus events through your dashboard.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-6">
              <p className="text-sm font-bold text-slate-950">For verifiers</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Check submitted academic credentials through the public verification page without needing full account access.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-cvsu-green">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-16">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-cvsu-yellow">Get started</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Ready to join the CVSU-Carmona alumni network?
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/90">
              Create your profile, connect with fellow alumni, and use secure verification services for academic credentials.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
            <Link to="/register" className="btn-primary bg-white text-cvsu-green hover:bg-slate-50">
              Get started
            </Link>
            <Link to="/verify" className="btn-secondary border-white/30 bg-cvsu-green text-white hover:bg-white hover:text-cvsu-green">
              Verify Document
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
