import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  AcademicCapIcon,
  DocumentCheckIcon,
  UserGroupIcon,
  LockClosedIcon,
  ArrowRightIcon,
  CheckBadgeIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import UpcomingEvents from '../components/UpcomingEvents';
import heroImage from '../assets/cvsu-hero.jpg';

const features = [
  {
    name: 'Alumni Profiles',
    description:
      'Create and manage your alumni profile with your academic history, work experience, and accomplishments.',
    icon: AcademicCapIcon,
  },
  {
    name: 'Document Verification',
    description:
      'Securely store and verify your academic documents using blockchain technology for tamper-proof verification.',
    icon: DocumentCheckIcon,
  },
  {
    name: 'Alumni Directory',
    description:
      'Connect with fellow CVSU-Carmona alumni through our comprehensive alumni directory.',
    icon: UserGroupIcon,
  },
  {
    name: 'Secure Technology',
    description:
      'Your documents are secured using Hyperledger Fabric blockchain technology with SHA-2 encryption.',
    icon: LockClosedIcon,
  },
];

export default function HomePage() {
  const { currentUser } = useAuth();

  return (
    <div className="bg-white">
      {/* Hero section */}
      <section className="relative min-h-[560px] overflow-hidden">
        <div className="absolute inset-0">
          <img
            className="w-full h-full object-cover"
            src={heroImage}
            alt="CVSU Campus"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-cvsu-green/75 to-cvsu-green/35" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white to-transparent" />
        </div>
        <div className="relative mx-auto flex min-h-[560px] max-w-7xl flex-col justify-center px-4 pb-24 pt-20 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
              Blockchain-secured alumni credentials
            </div>
            <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
            CVSU-Carmona Alumni
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/90 sm:text-xl">
              Manage your alumni profile, request verified documents, and validate academic credentials through a secure Hyperledger Fabric workflow.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              {currentUser ? (
                <Link to="/dashboard" className="btn-primary bg-cvsu-yellow text-slate-950 hover:bg-yellow-300">
                  Go to Dashboard
                  <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn-primary bg-cvsu-yellow text-slate-950 hover:bg-yellow-300">
                    Create Alumni Account
                    <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </Link>
                  <Link to="/login" className="btn-secondary border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white hover:text-slate-950">
                    Sign In
                  </Link>
                </>
              )}
              <Link to="/verify" className="btn-secondary border-white/30 bg-white text-cvsu-green hover:bg-slate-50">
                Verify Document
              </Link>
            </div>
          </div>

          <div className="absolute bottom-6 left-4 right-4 mx-auto grid max-w-7xl gap-3 sm:left-6 sm:right-6 md:grid-cols-3 lg:left-8 lg:right-8">
            {[
              ['Approved uploads', 'Store verified document hashes on-chain.'],
              ['Fast requests', 'Release documents from existing verified uploads.'],
              ['Public checks', 'Validate records without exposing private files.'],
            ].map(([title, description]) => (
              <div key={title} className="rounded-lg border border-white/20 bg-white/90 p-4 shadow-sm backdrop-blur">
                <p className="text-sm font-bold text-slate-900">{title}</p>
                <p className="mt-1 text-sm text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming Events section */}
      <UpcomingEvents />

      {/* Features section */}
      <section className="bg-white py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-wide text-cvsu-green">Features</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              Built for alumni records that need to be trusted
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              The portal connects profile management, document uploads, admin review, and blockchain verification in one focused workflow.
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

      <section className="border-y border-slate-200 bg-slate-50 py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="flex gap-4">
            <CheckBadgeIcon className="h-8 w-8 flex-none text-cvsu-green" />
            <div>
              <h3 className="font-bold text-slate-950">Admin-approved records</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Document requests are only available after an uploaded file is approved and recorded.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <ShieldCheckIcon className="h-8 w-8 flex-none text-cvsu-green" />
            <div>
              <h3 className="font-bold text-slate-950">Hash-based integrity</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Files stay in storage while tamper checks use their blockchain hash proofs.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <DocumentCheckIcon className="h-8 w-8 flex-none text-cvsu-green" />
            <div>
              <h3 className="font-bold text-slate-950">Cleaner release flow</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Alumni request only documents they already have verified in the system.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="bg-cvsu-green">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:flex lg:items-center lg:justify-between lg:px-8 lg:py-16">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-cvsu-yellow">Get started</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Join the CVSU-Carmona alumni network today.
            </h2>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:flex-shrink-0">
              <Link
                to="/register"
                className="btn-primary bg-white text-cvsu-green hover:bg-slate-50"
              >
                Get started
              </Link>
              <Link
                to="/about"
                className="btn-secondary border-white/30 bg-cvsu-green text-white hover:bg-white hover:text-cvsu-green"
              >
                Learn more
              </Link>
          </div>
        </div>
      </section>
    </div>
  );
} 
