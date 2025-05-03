import { Link } from 'react-router-dom';
import { BuildingLibraryIcon, AcademicCapIcon, DocumentCheckIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

const stats = [
  { id: 1, name: 'Established', value: '1998' },
  { id: 2, name: 'Alumni', value: '15,000+' },
  { id: 3, name: 'Programs', value: '20+' },
  { id: 4, name: 'Partners', value: '50+' },
];

export default function AboutPage() {
  return (
    <div className="bg-white">
      {/* Hero section */}
      <div className="bg-cvsu-green py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            About CVSU-Carmona
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white">
            Discover our mission to connect alumni and secure academic credentials
            with cutting-edge blockchain technology.
          </p>
        </div>
      </div>

      {/* University Mission */}
      <div className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Our Mission
              </h2>
              <p className="mt-6 text-lg leading-8 text-gray-600">
                Cavite State University-Carmona Campus is committed to providing accessible,
                quality education that empowers students to achieve their full potential and become
                productive members of society. We strive to create a learning environment that
                fosters innovation, critical thinking, and social responsibility.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link to="/register" className="btn-primary inline-flex items-center justify-center">
                  Join Our Network
                </Link>
                <Link to="/verify" className="btn-secondary inline-flex items-center justify-center">
                  Verify Documents
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat) => (
                <div key={stat.id} className="flex flex-col border border-gray-200 rounded-lg p-8 text-center items-center">
                  <dt className="text-base leading-7 text-gray-600">{stat.name}</dt>
                  <dd className="order-first text-3xl font-semibold tracking-tight text-cvsu-green sm:text-5xl">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-cvsu-green">Alumni Portal</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              The First Blockchain-Based University Document System in the Philippines
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Our platform combines traditional alumni networking with innovative blockchain
              technology to provide a secure, transparent, and efficient system for document
              verification and alumni connectivity.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-cvsu-green">
                    <BuildingLibraryIcon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  Alumni Networking
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">
                  Connect with fellow CVSU-Carmona graduates, share experiences, and expand your
                  professional network through our comprehensive alumni directory.
                </dd>
              </div>
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-cvsu-green">
                    <AcademicCapIcon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  Academic Profiles
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">
                  Create and maintain your comprehensive academic profile, showcasing your
                  achievements, work experience, and continuing education.
                </dd>
              </div>
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-cvsu-green">
                    <DocumentCheckIcon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  Document Verification
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">
                  Our blockchain-based verification system provides tamper-proof authentication
                  of academic credentials, eliminating fraud and simplifying verification for employers.
                </dd>
              </div>
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-cvsu-green">
                    <ShieldCheckIcon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  Hyperledger Fabric Security
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">
                  Built on Hyperledger Fabric, our system ensures the highest level of security
                  and transparency for all academic documents and credentials.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* CTA section */}
      <div className="bg-cvsu-green">
        <div className="px-6 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to join the CVSU-Carmona alumni network?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-white">
              Create your profile today and start connecting with fellow alumni while
              securing your academic credentials with blockchain technology.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                to="/register"
                className="rounded-md bg-white px-5 py-3 text-base font-semibold text-cvsu-green shadow-sm hover:bg-cvsu-yellow hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Get started
              </Link>
              <Link
                to="/verify"
                className="rounded-md border border-white bg-transparent px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-white hover:text-cvsu-green"
              >
                Verify Document
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 