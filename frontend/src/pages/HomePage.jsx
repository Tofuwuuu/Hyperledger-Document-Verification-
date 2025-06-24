import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  AcademicCapIcon,
  DocumentCheckIcon,
  UserGroupIcon,
  LockClosedIcon,
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
      <div className="relative">
        <div className="absolute inset-0">
          <img
            className="w-full h-full object-cover"
            src={heroImage}
            alt="CVSU Campus"
          />
          <div className="absolute inset-0 bg-cvsu-green mix-blend-multiply" />
        </div>
        <div className="relative max-w-7xl mx-auto py-24 px-4 sm:py-32 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            CVSU-Carmona Alumni
          </h1>
          <p className="mt-6 text-xl text-white max-w-3xl">
            Welcome to the Cavite State University - Carmona Campus Alumni Profile 
            Management System with Document Verification. Connect with fellow 
            alumni and securely manage your academic credentials.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            {currentUser ? (
              <Link to="/dashboard" className="btn-primary inline-flex items-center justify-center">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-primary inline-flex items-center justify-center">
                  Sign In
                </Link>
                <Link to="/register" className="btn-secondary inline-flex items-center justify-center">
                  Register
                </Link>
              </>
            )}
            <Link to="/verify" className="btn-secondary inline-flex items-center justify-center">
              Verify Document
            </Link>
          </div>
        </div>
      </div>
      
      {/* Upcoming Events section */}
      <UpcomingEvents />
      
      {/* Features section */}
      <div className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-cvsu-green font-semibold tracking-wide uppercase">
              Features
            </h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              A better way to manage your alumni experience
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
              Our platform combines the security of blockchain technology with the
              connectivity of an alumni network to provide a complete solution.
            </p>
          </div>

          <div className="mt-10">
            <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
              {features.map((feature) => (
                <div key={feature.name} className="relative">
                  <dt>
                    <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-cvsu-green text-white">
                      <feature.icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                      {feature.name}
                    </p>
                  </dt>
                  <dd className="mt-2 ml-16 text-base text-gray-500">
                    {feature.description}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* CTA section */}
      <div className="bg-cvsu-green">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8 lg:flex lg:items-center lg:justify-between">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            <span className="block">Ready to get started?</span>
            <span className="block text-cvsu-yellow">Join our alumni network today.</span>
          </h2>
          <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
            <div className="inline-flex rounded-md shadow">
              <Link
                to="/register"
                className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-cvsu-green bg-white hover:bg-gray-50"
              >
                Get started
              </Link>
            </div>
            <div className="ml-3 inline-flex rounded-md shadow">
              <Link
                to="/about"
                className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-cvsu-green bg-opacity-60 hover:bg-opacity-70"
              >
                Learn more
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 