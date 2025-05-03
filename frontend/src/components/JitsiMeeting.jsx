import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import meetingService from '../services/meetingService';
import meetingConfig from '../services/meetingConfig';
import { useAuth } from '../context/AuthContext';

const JitsiMeeting = ({ roomName, displayName: initialDisplayName, onClose, onJoin, onLeave, meetingId, isAdmin: explicitIsAdmin }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [showPreJoin, setShowPreJoin] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [iframeUrl, setIframeUrl] = useState('');
  const [jitsiAPI, setJitsiAPI] = useState(null);
  const [roomExists, setRoomExists] = useState(false);
  const apiRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const { user } = useAuth();
  
  // Determine if user is admin - convert to boolean explicitly
  const isAdmin = explicitIsAdmin === true || explicitIsAdmin === "true" || user?.is_admin === true;
  
  // URLs for external links (initialized at component level)
  const [fallbackUrl, setFallbackUrl] = useState(`https://meet.jit.si/${roomName || `alumni-meeting-${Date.now()}`}#config.prejoinPageEnabled=false&userInfo.displayName=${encodeURIComponent(initialDisplayName || 'Guest')}&userInfo.moderator=false`);
  const [adminDirectUrl, setAdminDirectUrl] = useState(`https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false&userInfo.displayName=${encodeURIComponent(initialDisplayName || 'Admin Host')}&userInfo.moderator=true&interfaceConfig.TOOLBAR_ALWAYS_VISIBLE=true`);
  
  // Generate secure URLs with JWT tokens
  useEffect(() => {
    let isMounted = true;
    
    const generateSecureUrls = async () => {
      try {
        // Generate tokens for both admin and non-admin users
        const userId = user?._id || 'guest-' + Math.random().toString(36).substring(2, 10);
        let adminToken = null;
        let userToken = null;
        
        if (user) {
          if (isAdmin) {
            adminToken = await meetingConfig.generateJWT(roomName, displayName || 'Admin Host', userId, true);
          }
          userToken = await meetingConfig.generateJWT(roomName, displayName || 'Guest', userId, false);
        }
        
        // Generate URLs with tokens if available
        if (userToken && isMounted) {
          setFallbackUrl(`https://meet.jit.si/${roomName}?jwt=${userToken}#config.prejoinPageEnabled=false`);
        }
        
        if (adminToken && isMounted) {
          setAdminDirectUrl(`https://meet.jit.si/${roomName}?jwt=${adminToken}#config.prejoinPageEnabled=false`);
        }
      } catch (err) {
        console.error("Error generating JWT tokens:", err);
        // Fallback URLs are already set as initial state
      }
    };
    
    generateSecureUrls();
    
    return () => {
      isMounted = false;
    };
  }, [roomName, displayName, user, isAdmin]);
  
  // Initialize component
  useEffect(() => {
    setLoading(false);
    
    // If we have a room name, check if it exists already
    if (roomName) {
      checkRoomExists(roomName);
    }
    
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [roomName]);
  
  // Function to check if a Jitsi room already exists
  const checkRoomExists = async (room) => {
    try {
      // Use meetingService to check room existence if available
      if (meetingService.checkRoomExists) {
        const exists = await meetingService.checkRoomExists(room);
        setRoomExists(exists);
        console.log(`Room ${room} exists: ${exists}`);
      } else {
        // Fallback - assume room might exist
        console.log("Room existence check not available in service");
        setRoomExists(false);
      }
    } catch (err) {
      console.warn("Failed to check room existence:", err);
      setRoomExists(false);
    }
  };
  
  // Record leave on component unmount
  useEffect(() => {
    return () => {
      if (meetingId && onLeave && !showPreJoin) {
        meetingService.leaveMeeting(meetingId)
          .then(onLeave)
          .catch(err => {
            console.error('Failed to record meeting leave:', err);
            if (onLeave) onLeave();
          });
      }
      
      if (apiRef.current) {
        apiRef.current.dispose();
      }
    };
  }, [meetingId, onLeave, showPreJoin]);

  const handleJoinMeeting = async () => {
    try {
      if (!displayName.trim()) {
        setError("Please enter your name before joining");
        return;
      }
      
      console.log("MEETING INITIALIZATION - Admin Status:", isAdmin, "typeof:", typeof isAdmin);
      console.log("Room exists status:", roomExists);
      
      setLoading(true);
      setError(null);
      
      // If the room exists and user is admin, we should redirect to direct join
      if (roomExists && isAdmin) {
        console.log("Room already exists and user is admin - should use direct join");
        setError("This meeting room already exists. As an admin, you need to join directly to gain host privileges.");
        setLoading(false);
        return;
      }
      
      // Record join on backend
      if (meetingId && onJoin) {
        try {
          await meetingService.joinMeeting(meetingId);
          if (onJoin) onJoin();
        } catch (err) {
          console.error('Failed to record meeting join:', err);
        }
      }
      
      try {
        setShowPreJoin(false);
        
        const effectiveRoomName = roomName || `alumni-meeting-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        
        console.log("Joining meeting with room name:", effectiveRoomName, "isAdmin:", isAdmin);
        
        // Generate JWT token for secure user role enforcement
        const userId = user?._id || 'guest-' + Math.random().toString(36).substring(2, 10);
        let jwtToken = null;
        
        try {
          // Only try to generate JWT if we have auth data
          if (user) {
            jwtToken = await meetingConfig.generateJWT(
              effectiveRoomName, 
              displayName, 
              userId, 
              isAdmin
            );
          }
        } catch (tokenError) {
          console.error("Failed to generate JWT token:", tokenError);
          // Continue without JWT - will use URL params as fallback
        }
        
        // Small delay to ensure the container is rendered in the DOM
        setTimeout(() => {
          const jitsiContainer = document.getElementById('jitsi-container');
          
          if (!jitsiContainer) {
            throw new Error("Meeting container element not found");
          }
          
          // Clear container first
          jitsiContainer.innerHTML = '';
          
          // For admin users, we'll try the direct approach first
          if (isAdmin && !roomExists) {
            console.log("Admin user - using direct approach for room creation");
            // Create a direct URL with admin privileges and JWT if available
            let directAdminUrl = `https://meet.jit.si/${effectiveRoomName}#config.prejoinPageEnabled=false&userInfo.displayName=${encodeURIComponent(displayName)}&userInfo.moderator=true&interfaceConfig.TOOLBAR_ALWAYS_VISIBLE=true`;
            
            // Add JWT token if available
            if (jwtToken) {
              directAdminUrl = `https://meet.jit.si/${effectiveRoomName}?jwt=${jwtToken}#config.prejoinPageEnabled=false`;
            }
            
            // Enhance the container to take more space
            jitsiContainer.style.minHeight = "75vh";
            
            // Create an iframe for direct access with enhanced styling
            const iframe = document.createElement('iframe');
            iframe.allow = "camera; microphone; fullscreen; display-capture; autoplay";
            iframe.src = directAdminUrl;
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            iframe.style.border = "0";
            iframe.style.borderRadius = "4px";
            iframe.id = "jitsi-admin-frame";
            
            jitsiContainer.appendChild(iframe);
            
            console.log("Admin direct iframe created");
            
            // Store api reference for cleanup
            apiRef.current = {
              dispose: () => {
                if (jitsiContainer) {
                  jitsiContainer.innerHTML = '';
                }
              }
            };
            
            // Set loading complete after short delay
            setTimeout(() => {
              setLoading(false);
              console.log("Admin meeting initialized via direct iframe");
            }, 2000);
            
            return; // Exit early for admin path
          }
          
          // Regular API approach for non-admins or existing rooms
          // Load the Jitsi Meet External API script dynamically
          const script = document.createElement('script');
          script.src = 'https://meet.jit.si/external_api.js';
          script.async = true;
          
          script.onload = () => {
            console.log("Jitsi API script loaded successfully");
            
            try {
              // Create options with proper moderator configuration
              const domain = 'meet.jit.si';
              const options = {
                roomName: effectiveRoomName,
                width: '100%',
                height: '100%',
                parentNode: jitsiContainer,
                lang: 'en',
                configOverwrite: {
                  prejoinPageEnabled: false,
                  startWithAudioMuted: !audioEnabled,
                  startWithVideoMuted: !videoEnabled,
                  enableLobby: false,
                  membersOnly: false,
                  defaultLanguage: 'en',
                  // Strictly enforce moderator status
                  disableRemoteMute: !isAdmin,
                  remoteVideoMenu: {
                    disableKick: !isAdmin
                  },
                  disableKick: !isAdmin,
                  // Prevent the first-user-is-moderator behavior
                  disableModeratorIndicator: !isAdmin,
                  // Prevent recording for non-admins
                  fileRecordingsEnabled: isAdmin,
                  liveStreamingEnabled: isAdmin
                },
                interfaceConfigOverwrite: {
                  DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
                  MOBILE_APP_PROMO: false,
                  HIDE_INVITE_MORE_HEADER: true,
                  TOOLBAR_ALWAYS_VISIBLE: true,
                  // Hide moderator-only buttons for non-admins
                  TOOLBAR_BUTTONS: isAdmin ? 
                    ['microphone', 'camera', 'desktop', 'fullscreen', 'hangup', 'profile', 
                     'chat', 'recording', 'livestreaming', 'settings', 'raisehand',
                     'videoquality', 'filmstrip', 'shortcuts', 'tileview', 'select-background', 'security'] :
                    ['microphone', 'camera', 'hangup', 'chat', 'settings', 'raisehand',
                     'videoquality', 'filmstrip', 'tileview']
                },
                userInfo: {
                  displayName: displayName,
                  email: '',
                  moderator: isAdmin // Explicitly set moderator status based on admin role
                }
              };

              // Add JWT token if available - this is the most secure way to enforce roles
              if (jwtToken) {
                options.jwt = jwtToken;
              }
              
              // Add moderator flag specifically for admin users
              if (isAdmin) {
                options.userInfo.role = 'moderator';
                options.configOverwrite.enableClosePage = true;
              } else {
                // For non-admins, explicitly prevent moderator access
                options.userInfo.role = 'participant';
              }
              
              console.log("Creating Jitsi meeting with options:", options);
              
              // Create the API object
              const api = new window.JitsiMeetExternalAPI(domain, options);
              
              // Set up basic event handlers
              api.addEventListener('videoConferenceJoined', () => {
                console.log("Successfully joined the conference!");
                setLoading(false);
                
                // If admin, explicitly grant moderator rights after joining
                if (isAdmin) {
                  try {
                    // Set moderator status using executeCommand
                    api.executeCommand('toggleLobby', false);
                  } catch (err) {
                    console.warn("Failed to execute admin commands:", err);
                  }
                }
              });
              
              api.addEventListener('videoConferenceLeft', () => {
                console.log("Left the conference");
                handleMeetingClose();
              });
              
              api.addEventListener('errorOccurred', (error) => {
                console.error("Jitsi error:", error);
                
                // Handle members-only error specifically
                if (error && error.error && error.error.name === 'conference.connectionError.membersOnly') {
                  setShowPreJoin(false); // Make sure we're not in pre-join state
                  setLoading(false); // Stop loading
                  
                  if (isAdmin) {
                    setError("This meeting requires host approval. As an admin, you should join directly using the button below to create the meeting first.");
                  } else {
                    setError("This meeting requires host approval. Please try again later or wait for the host to join first.");
                  }
                } else {
                  setError(`Meeting error: ${error?.error?.message || "Unknown error"}`);
                  setLoading(false);
                }
              });
              
              // Store the API reference
              apiRef.current = api;
              setJitsiAPI(api);
              
            } catch (err) {
              console.error("Failed to initialize Jitsi meeting with external API:", err);
              setError(`Failed to start meeting: ${err.message}`);
              setLoading(false);
              
              // Show error UI instead of trying fallback that will also fail
              setShowPreJoin(false);
            }
          };
          
          script.onerror = (e) => {
            console.error("Failed to load Jitsi API script:", e);
            setError("Failed to load meeting tools. Check your internet connection.");
            setLoading(false);
          };
          
          // Add the script to the document
          document.body.appendChild(script);
          
        }, 500);
        
      } catch (err) {
        console.error('Error joining meeting:', err);
        setError(`Failed to join meeting: ${err.message}`);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error joining meeting:', err);
      setError('Failed to join meeting. Please try again.');
      setLoading(false);
    }
  };

  const handleMeetingClose = () => {
    if (meetingId && onLeave) {
      meetingService.leaveMeeting(meetingId)
        .then(() => {
          if (onClose) onClose();
        })
        .catch(err => {
          console.error('Failed to record meeting leave:', err);
          if (onClose) onClose();
        });
    } else if (onClose) {
      onClose();
    }
    
    // Clean up API or any iframe
    if (apiRef.current) {
      try {
        if (typeof apiRef.current.dispose === 'function') {
          apiRef.current.dispose();
        }
      } catch (e) {
        console.warn('Error disposing Jitsi API:', e);
      }
      apiRef.current = null;
    }
    
    // Always clear the container as a fallback
    try {
      const container = document.getElementById('jitsi-container');
      if (container) {
        container.innerHTML = '';
      }
    } catch (e) {
      console.warn('Error clearing container:', e);
    }
  };

  if (error) {
    // Generate direct links that definitely work for direct access
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 bg-white rounded-lg shadow-lg">
        <div className="text-red-600 text-xl font-semibold mb-4">
          {error.includes("membersOnly") || error.includes("host approval") 
            ? "This meeting requires host approval" 
            : error}
        </div>
        
        <div className="mb-4 text-center max-w-md">
          <p className="mb-2">We're having trouble connecting you to the meeting automatically.</p>
          {isAdmin ? (
            <p className="font-medium">As an admin, you need to create the meeting room first by joining directly through Jitsi.</p>
          ) : (
            <p>You can try joining directly through the Jitsi website or wait for the host to join first.</p>
          )}
        </div>
        
        {isAdmin && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 max-w-md">
            <p className="text-yellow-700 font-medium mb-2">
              Admin troubleshooting:
            </p>
            <ul className="text-yellow-700 text-sm list-disc list-inside">
              <li>Admin status: {String(isAdmin)}</li>
              <li>The person who creates the room first gets host privileges</li>
              <li>Open the link below in a new tab to create the room as host</li>
              <li>Once you've joined as host in the new tab, others can join normally</li>
            </ul>
          </div>
        )}
        
        <div className="flex flex-col gap-3 items-center">
          <a 
            href={isAdmin ? adminDirectUrl : fallbackUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className={`${isAdmin ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-3 rounded-lg transition-colors duration-200 font-semibold`}
          >
            {isAdmin ? 'Create Meeting as Host (New Tab)' : 'Join Meeting Directly'}
          </a>
          
          <button 
            onClick={() => {
              setError(null);
              setConnectionAttempts(0);
              setShowPreJoin(true); // Go back to pre-join screen
            }} 
            className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-800 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // The rest of the component remains the same...
  if (reconnecting) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 bg-white rounded-lg shadow-lg">
        <div className="text-amber-600 text-xl font-semibold mb-4">Reconnecting to meeting...</div>
        <div className="mb-4">Attempt {connectionAttempts} of 3</div>
        <div className="w-16 h-16 border-t-4 border-blue-500 rounded-full animate-spin"></div>
        <button 
          onClick={() => {
            if (reconnectTimerRef.current) {
              clearTimeout(reconnectTimerRef.current);
            }
            setReconnecting(false);
            setError(null);
            setConnectionAttempts(0);
            setShowPreJoin(true);
          }} 
          className="mt-4 text-blue-600 hover:underline"
        >
          Cancel Reconnection
        </button>
      </div>
    );
  }

  // Pre-join screen
  if (showPreJoin) {
    return (
      <div className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden">
        <div className={`${isAdmin ? 'bg-purple-800' : 'bg-gray-900'} text-white p-4 flex justify-between items-center`}>
          <h2 className="text-xl font-semibold">
            Ready to join virtual meeting
            {isAdmin && (
              <span className="ml-2 text-sm bg-purple-600 px-2 py-0.5 rounded-full">Host</span>
            )}
          </h2>
          <button 
            onClick={handleMeetingClose}
            className="text-white hover:text-gray-300"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex flex-col md:flex-row h-full">
          <div className="w-full md:w-2/3 p-6 bg-gray-100 flex flex-col items-center justify-center">
            <div className="relative w-full max-w-md aspect-video bg-black rounded-lg mb-4 flex items-center justify-center">
              {videoEnabled ? (
                <div className="text-white text-lg">Camera preview will appear here</div>
              ) : (
                <div className={`h-32 w-32 rounded-full ${isAdmin ? 'bg-purple-500' : 'bg-blue-500'} flex items-center justify-center text-white text-4xl font-bold`}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              
              {isAdmin && (
                <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
                  Host
                </div>
              )}
              
              <div className="absolute bottom-2 left-0 right-0 flex justify-center space-x-4">
                <button 
                  onClick={() => setAudioEnabled(!audioEnabled)}
                  className={`rounded-full p-2 ${audioEnabled ? 'bg-gray-700' : 'bg-red-600'}`}
                  aria-label={audioEnabled ? "Mute audio" : "Unmute audio"}
                >
                  {audioEnabled ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  )}
                </button>
                
                <button 
                  onClick={() => setVideoEnabled(!videoEnabled)}
                  className={`rounded-full p-2 ${videoEnabled ? 'bg-gray-700' : 'bg-red-600'}`}
                  aria-label={videoEnabled ? "Turn off camera" : "Turn on camera"}
                >
                  {videoEnabled ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            
            <div className="w-full max-w-md mb-4">
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your name"
              />
            </div>
            
            <button
              onClick={handleJoinMeeting}
              className={`w-full max-w-md ${isAdmin ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold py-4 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 text-lg`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>{isAdmin ? 'Start Meeting as Host' : 'Join Meeting Now'}</span>
            </button>
            
            {isAdmin && (
              <>
                <a
                  href="#"
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full max-w-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 mt-2"
                  onClick={async (e) => {
                    e.preventDefault();
                    
                    // Generate JWT token for more secure external access
                    const userId = user?._id || 'guest-' + Math.random().toString(36).substring(2, 10);
                    let extUrl = `https://meet.jit.si/${roomName || `alumni-meeting-${Date.now()}`}#config.prejoinPageEnabled=false&userInfo.displayName=${encodeURIComponent(displayName || 'Admin Host')}&userInfo.moderator=true&interfaceConfig.TOOLBAR_ALWAYS_VISIBLE=true`;
                    
                    try {
                      if (user) {
                        const token = await meetingConfig.generateJWT(
                          roomName || `alumni-meeting-${Date.now()}`, 
                          displayName || 'Admin Host', 
                          userId, 
                          true
                        );
                        
                        if (token) {
                          extUrl = `https://meet.jit.si/${roomName || `alumni-meeting-${Date.now()}`}?jwt=${token}#config.prejoinPageEnabled=false`;
                        }
                      }
                    } catch (err) {
                      console.error("Failed to generate JWT for external link:", err);
                    }
                    
                    // Open in new tab
                    window.open(extUrl, '_blank');
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>Open in New Tab</span>
                </a>
                
                <div className="mt-2 bg-yellow-50 border-l-4 border-yellow-400 p-3 max-w-md">
                  <p className="text-sm text-yellow-800">
                    <strong>Note for admins:</strong> If this meeting already exists, you'll need to join directly via the link provided on the next screen to gain host privileges.
                  </p>
                </div>
              </>
            )}
            
            {!isAdmin && (
              <>
                <a
                  href="#"
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full max-w-md bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 mt-2"
                  onClick={async (e) => {
                    e.preventDefault();
                    
                    // Generate JWT token for secure external access
                    const userId = user?._id || 'guest-' + Math.random().toString(36).substring(2, 10);
                    let extUrl = `https://meet.jit.si/${roomName || `alumni-meeting-${Date.now()}`}#config.prejoinPageEnabled=false&userInfo.displayName=${encodeURIComponent(displayName || 'Participant')}&userInfo.moderator=false&config.disableKick=true&config.remoteVideoMenu.disableKick=true&config.disableRemoteMute=true`;
                    
                    try {
                      if (user) {
                        const token = await meetingConfig.generateJWT(
                          roomName || `alumni-meeting-${Date.now()}`, 
                          displayName || 'Participant', 
                          userId, 
                          false // Explicitly set to false for non-admin
                        );
                        
                        if (token) {
                          // Even with JWT, add security parameters to URL as a fallback
                          extUrl = `https://meet.jit.si/${roomName || `alumni-meeting-${Date.now()}`}?jwt=${token}#config.prejoinPageEnabled=false&config.disableKick=true&config.remoteVideoMenu.disableKick=true&config.disableRemoteMute=true&config.disableReactions=false&config.startAudioMuted=2&interfaceConfig.TOOLBAR_BUTTONS=["microphone","camera","hangup","chat","settings","raisehand","videoquality","filmstrip","tileview"]`;
                        }
                      } else {
                        // Add extra security for unauthenticated users
                        extUrl += '&interfaceConfig.TOOLBAR_BUTTONS=["microphone","camera","hangup","chat","settings","raisehand","videoquality","filmstrip","tileview"]';
                      }
                    } catch (err) {
                      console.error("Failed to generate JWT for external link:", err);
                    }
                    
                    // Open in new tab
                    window.open(extUrl, '_blank');
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>Open in New Tab</span>
                </a>
                
                <p className="text-sm text-gray-500 mt-2">
                  Each meeting creates a new room with direct access
                </p>
              </>
            )}
          </div>
          
          <div className="w-full md:w-1/3 p-6 border-t md:border-t-0 md:border-l border-gray-200">
            <h3 className="text-lg font-medium mb-4">Meeting Details</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Meeting Type</p>
                <p className="text-md">Virtual Meeting</p>
                <p className="text-xs text-gray-400 mt-1">Creates a new secure room each time</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">You're joining as</p>
                <p className="text-md font-medium">
                  {displayName || 'Guest User'}
                  {isAdmin && (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      Host
                    </span>
                  )}
                </p>
              </div>
              
              {isAdmin && (
                <div className="bg-purple-50 p-3 rounded border border-purple-200">
                  <h4 className="text-sm font-medium text-purple-800 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Host Privileges:
                  </h4>
                  <ul className="text-xs text-purple-800 mt-1 space-y-1">
                    <li>• Admit participants from the lobby</li>
                    <li>• Mute/unmute other participants</li>
                    <li>• Remove disruptive participants</li>
                    <li>• Enable/disable chat</li>
                    <li>• Start/stop recording (if available)</li>
                  </ul>
                </div>
              )}
              
              <div className="pt-4">
                <h4 className="text-sm font-medium mb-2">Tips for a better experience:</h4>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-start">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Use headphones for better audio quality</span>
                  </li>
                  <li className="flex items-start">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Mute yourself when not speaking</span>
                  </li>
                  <li className="flex items-start">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Choose a quiet location with good lighting</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active meeting view
  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden">
      <div className={`${isAdmin ? 'bg-purple-800' : 'bg-gray-900'} text-white p-4 flex justify-between items-center`}>
        <h2 className="text-xl font-semibold">
          Virtual Meeting
          {isAdmin && (
            <span className="ml-2 text-sm bg-purple-600 px-2 py-0.5 rounded-full">Host</span>
          )}
        </h2>
        <button 
          onClick={handleMeetingClose}
          className="text-white hover:text-gray-300"
          aria-label="Close Meeting"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="flex-1 relative min-h-[75vh]">
        <div id="jitsi-container" className="absolute inset-0"></div>
        
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <div className="text-center">
              <div className="w-16 h-16 border-t-4 border-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">{isAdmin ? 'Starting meeting as host...' : 'Joining meeting...'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

JitsiMeeting.propTypes = {
  roomName: PropTypes.string.isRequired,
  displayName: PropTypes.string,
  onClose: PropTypes.func,
  onJoin: PropTypes.func,
  onLeave: PropTypes.func,
  meetingId: PropTypes.string,
  isAdmin: PropTypes.bool
};

JitsiMeeting.defaultProps = {
  displayName: '',
  onClose: null,
  onJoin: null,
  onLeave: null,
  isAdmin: false
};

export default JitsiMeeting; 