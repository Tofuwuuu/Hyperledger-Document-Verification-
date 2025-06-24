import { useState } from 'react';

export default function AlumniDirectoryPage() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="bg-white">
      {/* Hero section */}
      <div className="relative bg-cover bg-center h-[300px]" style={{ backgroundImage: "url('/src/assets/graduation.jpg')" }}>
        <div className="absolute inset-0 bg-gradient-to-r from-cvsu-green/90 to-cvsu-green/80"></div>
        <div className="absolute inset-0 bg-[url('/src/assets/pattern.svg')] opacity-10"></div>
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 h-full flex flex-col justify-center">
          <div className="max-w-3xl">
            <div className="animate-slideDown">
              <span className="inline-flex items-center rounded-full bg-cvsu-yellow/90 text-white px-4 py-1.5 text-sm font-medium mb-5 shadow-md backdrop-blur-sm">
                <span className="flex h-2 w-2 rounded-full bg-white mr-1.5 animate-pulse"></span>
                Connect With Alumni
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl drop-shadow-md animate-fadeIn">
              Alumni <span className="text-cvsu-yellow">Directory</span>
            </h1>
            <p className="mt-6 max-w-xl text-xl leading-8 text-white/95 drop-shadow font-light backdrop-blur-[2px] pl-3 border-l-4 border-cvsu-yellow animate-slideUp">
              Connect with CVSU-Carmona graduates and build your professional network.
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent"></div>
      </div>

      {/* Alumni Director Section */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-8 flex flex-col justify-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Meet Our Alumni Director</h2>
              <p className="text-gray-600 mb-4">
                The Alumni Relations Office actively engages with our graduates, maintaining strong connections between the university and its alumni community.
              </p>
              <p className="text-gray-600 mb-6">
                Through the RE-IGNITE program, we facilitate networking opportunities, career development resources, and meaningful engagement for all CVSU-Carmona graduates.
              </p>
              <div className="flex items-center">
                <div className="h-12 w-12 rounded-full overflow-hidden mr-4 bg-cvsu-green flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Joe Marlou Añosa Opella</h3>
                  <p className="text-sm text-gray-500">Alumni Relations Director</p>
                </div>
              </div>
            </div>
            <div className="relative h-full min-h-[400px]">
              <img 
                src="/src/assets/alumni-director.jfif" 
                alt="Alumni Director and staff helping alumni register" 
                className="w-full h-full object-cover"
              />

            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 