import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { 
  BuildingLibraryIcon, 
  AcademicCapIcon, 
  DocumentCheckIcon, 
  ShieldCheckIcon,
  CalendarIcon,
  UserGroupIcon,
  BookOpenIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';

const stats = [
  { 
    id: 1, 
    name: 'Established', 
    value: '1998', 
    icon: CalendarIcon, 
    description: 'Years of academic excellence'
  },
  { 
    id: 2, 
    name: 'Alumni', 
    value: '15,000+', 
    icon: UserGroupIcon,
    description: 'Graduates making an impact'
  },
  { 
    id: 3, 
    name: 'Programs', 
    value: '20+', 
    icon: BookOpenIcon,
    description: 'Academic programs offered'
  },
  { 
    id: 4, 
    name: 'Partners', 
    value: '50+', 
    icon: BuildingOfficeIcon,
    description: 'Industry and academic partners'
  },
];

const timelineEvents = [
  {
    year: '1998',
    title: 'Campus Establishment',
    description: 'CVSU-Carmona Campus was established to provide quality education to the residents of Carmona and nearby municipalities.'
  },
  {
    year: '2010',
    title: 'Expansion of Programs',
    description: 'The campus expanded its academic offerings to include more programs in technology and business administration.'
  },
  {
    year: '2018',
    title: 'Technology Innovation Center',
    description: 'Launched the Technology Innovation Center to foster research and development in emerging technologies.'
  },
  {
    year: '2023',
    title: 'Blockchain Initiative',
    description: 'Pioneered the first blockchain-based document verification system for academic credentials in the Philippines.'
  }
];

export default function AboutPage() {
  const [animatedStats, setAnimatedStats] = useState(stats.map(stat => ({...stat, animated: false})));

  useEffect(() => {
    // Reset animation state when component mounts
    setAnimatedStats(stats.map(stat => ({...stat, animated: false})));
    
    // Start animation after component mounts
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setTimeout(() => {
          setAnimatedStats(stats.map(stat => ({...stat, animated: true})));
        }, 300);
      }
    }, { threshold: 0.5 });

    const statsElement = document.getElementById('stats-section');
    if (statsElement) observer.observe(statsElement);

    return () => {
      if (statsElement) observer.unobserve(statsElement);
    };
  }, []);

  return (
    <div className="bg-white">
      {/* Hero section with background overlay */}
      <div className="relative bg-cover bg-center h-[500px]" style={{ backgroundImage: "url('/src/assets/cvsu-campus.jpg')" }}>
        <div className="absolute inset-0 bg-gradient-to-r from-cvsu-green/90 to-cvsu-green/80"></div>
        <div className="absolute inset-0 bg-[url('/src/assets/pattern.svg')] opacity-10"></div>
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 h-full flex flex-col justify-center">
          <div className="max-w-3xl">
            <div className="animate-slideDown">
              <span className="inline-flex items-center rounded-full bg-cvsu-yellow/90 text-white px-4 py-1.5 text-sm font-medium mb-5 shadow-md backdrop-blur-sm">
                <span className="flex h-2 w-2 rounded-full bg-white mr-1.5 animate-pulse"></span>
                About Our Institution
              </span>
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl drop-shadow-md animate-fadeIn">
              About <span className="text-cvsu-yellow">CVSU-Carmona</span>
            </h1>
            <p className="mt-6 max-w-xl text-xl leading-8 text-white/95 drop-shadow font-light backdrop-blur-[2px] pl-3 border-l-4 border-cvsu-yellow animate-slideUp">
              Discover our mission to connect alumni and secure academic 
              credentials with cutting-edge blockchain technology.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 animate-fadeIn">
              <a href="#mission" className="px-5 py-2.5 bg-white/20 backdrop-blur-md text-white rounded-lg hover:bg-white/30 transition duration-300 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"></path>
                </svg>
                Our Mission
              </a>
              <a href="#timeline" className="px-5 py-2.5 bg-white/20 backdrop-blur-md text-white rounded-lg hover:bg-white/30 transition duration-300 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Our Timeline
              </a>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent"></div>
      </div>

      {/* University Mission */}
      <div id="mission" className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-12 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 items-center">
            <div>
              <div className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-cvsu-green mb-4">
                Our Purpose
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Our Mission
              </h2>
              <div className="mt-6 text-lg leading-8 text-gray-600 space-y-4">
                <p>
                  Cavite State University-Carmona Campus is committed to providing accessible,
                  quality education that empowers students to achieve their full potential and become
                  productive members of society.
                </p>
                <p>
                  We strive to create a learning environment that
                  fosters innovation, critical thinking, and social responsibility while preparing our
                  students for the challenges of the future.
                </p>
              </div>
              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Link to="/register" className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-cvsu-green hover:bg-green-700 transition-all duration-200 shadow-md">
                  Join Our Network
                  <svg className="ml-2 -mr-1 w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </Link>
                <Link to="/verify" className="inline-flex items-center justify-center px-5 py-3 border border-cvsu-green text-base font-medium rounded-md text-cvsu-green bg-white hover:bg-gray-50 transition-all duration-200 shadow-sm">
                  Verify Documents
                </Link>
              </div>
            </div>
            
            {/* Stats with animation */}
            <div id="stats-section" className="grid grid-cols-2 gap-6">
              {animatedStats.map((stat) => (
                <div 
                  key={stat.id} 
                  className="flex flex-col border border-gray-200 rounded-xl p-8 text-center items-center hover:shadow-lg hover:border-cvsu-green transition-all duration-300 group bg-white relative overflow-hidden"
                >
                  <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-green-100 group-hover:bg-green-200 transition-all duration-300"></div>
                  <div className="relative">
                    <stat.icon className="h-10 w-10 text-cvsu-green mx-auto mb-4 group-hover:scale-110 transition-all duration-300" />
                    
                    <dd className={`text-3xl font-bold tracking-tight text-cvsu-green sm:text-5xl mb-2 transition-all duration-1000 ${stat.animated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                      {stat.value}
                    </dd>
                    
                    <dt className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      {stat.name}
                    </dt>
                    
                    <p className="text-sm text-gray-600 mt-1">
                      {stat.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline section */}
      <div id="timeline" className="bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center mb-16">
            <div className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-cvsu-green mb-4">
              <span className="flex h-2 w-2 rounded-full bg-cvsu-green mr-1.5 animate-pulse"></span>
              Our Journey
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              The <span className="text-cvsu-green">CVSU-Carmona</span> Timeline
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              From our founding to becoming a pioneer in blockchain technology for education
            </p>
          </div>

          <div className="mx-auto max-w-4xl">
            <div className="relative">
              {/* Timeline center line */}
              <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-gradient-to-b from-green-100 via-cvsu-green to-green-100"></div>
              
              {/* Timeline events */}
              <div className="space-y-12">
                {timelineEvents.map((event, index) => (
                  <div key={index} className={`relative flex items-center ${index % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                    <div className={`w-5/12 ${index % 2 === 1 ? 'order-last pl-8' : 'order-first pr-8 text-right'}`}>
                      <div className="p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 group transform hover:-translate-y-1 hover:border-cvsu-green">
                        <span className="text-xs font-semibold inline-block py-1 px-2 rounded-full bg-green-100 text-cvsu-green mb-2 group-hover:bg-cvsu-green group-hover:text-white transition-all duration-300">
                          {event.year}
                        </span>
                        <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-cvsu-green transition-colors duration-300">{event.title}</h3>
                        <p className="text-gray-600">{event.description}</p>
                      </div>
                    </div>
                    
                    {/* Timeline dot */}
                    <div className="absolute left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-full bg-cvsu-green border-4 border-white z-10 shadow-md"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <div className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-cvsu-green mb-4">
              Alumni Portal
            </div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              The First Blockchain-Based University Document System in the Philippines
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Our platform combines traditional alumni networking with innovative blockchain
              technology to provide a secure, transparent, and efficient system for document
              verification and alumni connectivity.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
              {[
                {
                  icon: BuildingLibraryIcon,
                  title: "Alumni Networking",
                  description: "Connect with fellow CVSU-Carmona graduates, share experiences, and expand your professional network through our comprehensive alumni directory."
                },
                {
                  icon: AcademicCapIcon,
                  title: "Academic Profiles",
                  description: "Create and maintain your comprehensive academic profile, showcasing your achievements, work experience, and continuing education."
                },
                {
                  icon: DocumentCheckIcon,
                  title: "Document Verification",
                  description: "Our blockchain-based verification system provides tamper-proof authentication of academic credentials, eliminating fraud and simplifying verification for employers."
                },
                {
                  icon: ShieldCheckIcon,
                  title: "Hyperledger Fabric Security",
                  description: "Built on Hyperledger Fabric, our system ensures the highest level of security and transparency for all academic documents and credentials."
                }
              ].map((feature, index) => (
                <div key={index} className="group relative rounded-xl p-6 border border-gray-200 hover:border-cvsu-green transition-all duration-300 hover:shadow-lg bg-white">
                  <dt className="flex items-center gap-x-4 text-lg font-semibold leading-7 text-gray-900">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 group-hover:bg-cvsu-green transition-all duration-300">
                      <feature.icon className="h-6 w-6 text-cvsu-green group-hover:text-white transition-all duration-300" aria-hidden="true" />
                    </div>
                    <span className="group-hover:text-cvsu-green transition-all duration-300">{feature.title}</span>
                  </dt>
                  <dd className="mt-4 text-base leading-7 text-gray-600 pl-16">
                    {feature.description}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* CTA section */}
      <div className="bg-gradient-to-r from-cvsu-green to-green-700">
        <div className="px-6 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to join the CVSU-Carmona alumni network?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-white">
              Create your profile today and start connecting with fellow alumni while
              securing your academic credentials with blockchain technology.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-x-6 gap-y-4">
              <Link
                to="/register"
                className="w-full sm:w-auto rounded-md bg-white px-5 py-3 text-base font-semibold text-cvsu-green shadow-lg hover:bg-cvsu-yellow hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-all duration-300"
              >
                Get started
              </Link>
              <Link
                to="/verify"
                className="w-full sm:w-auto rounded-md border-2 border-white bg-transparent px-5 py-3 text-base font-semibold text-white shadow-md hover:bg-white hover:text-cvsu-green transition-all duration-300"
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