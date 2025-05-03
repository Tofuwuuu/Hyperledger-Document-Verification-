/**
 * Configuration for Jitsi meetings with enhanced security
 */

const meetingConfig = {
  // Main Jitsi configuration
  jitsiConfig: {
    // Disable lobby since it's causing issues
    enableLobby: false,
    enableClosePage: true,
    disableProfile: false,
    prejoinPageEnabled: true,
    disableDeepLinking: true,
    membersOnly: false,
    
    // Default audio/video settings
    startWithAudioMuted: true,
    startWithVideoMuted: true,
    
    // Security settings
    security: {
      enableInsecureRoomNameWarning: false,
      roomPasswordRequired: false,
      lobby: {
        autoKnock: true,
        enableChat: true
      }
    },
    
    // Connection settings
    p2p: {
      enabled: true,
      preferredCodec: 'VP9'
    },
    
    // Room configuration
    roomPasswordNumberOfDigits: 0,
    disableModeratorIndicator: false,
    enableNoisyMicDetection: true,
    
    // Disable third-party extension requests
    disableThirdPartyRequests: true,
    
    // Enhanced security controls
    // Prevent non-moderators from kicking others
    disableKick: true,
    
    // Strictly enforce moderator roles
    enforceModerator: true,
    
    // Only allow moderators to record
    fileRecordingsEnabled: true,
    fileRecordingsServiceEnabled: true,
    fileRecordingsServiceSharingEnabled: false,
    
    // Only allow moderators to start recording
    liveStreamingEnabled: true,
    localRecording: {
      enabled: true,
      onlySelf: false,
      disableSelfRecording: true
    }
  },
  
  // Interface configuration
  interfaceConfig: {
    TOOLBAR_BUTTONS: [
      'microphone', 'camera', 'desktop', 'fullscreen',
      'hangup', 'profile', 'chat', 'settings', 'raisehand',
      'videoquality', 'filmstrip', 'shortcuts', 'tileview',
      'security'
    ],
    SETTINGS_SECTIONS: ['devices', 'language', 'moderator', 'profile', 'calendar'],
    SHOW_JITSI_WATERMARK: false,
    SHOW_WATERMARK_FOR_GUESTS: false,
    DEFAULT_BACKGROUND: '#f8f9fa',
    DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
    DISABLE_FOCUS_INDICATOR: false,
    SHOW_CHROME_EXTENSION_BANNER: false,
    MOBILE_APP_PROMO: false,
    DISABLE_PRESENCE_STATUS: false,
    DISABLE_TRANSCRIPTION_SUBTITLES: false,
    DEFAULT_REMOTE_DISPLAY_NAME: 'Participant',
    VERTICAL_FILMSTRIP: true,
    TILE_VIEW_MAX_COLUMNS: 5
  },
  
  // Generate a unique, secure room name
  generateSecureRoomName: (originalRoomName) => {
    // Create a name with more entropy
    const timestamp = Date.now().toString();
    const randomString = Math.random().toString(36).substring(2, 10);
    const cleanBase = (originalRoomName || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    // Make sure we have a valid base
    const baseStr = cleanBase || 'room';
    
    return `alumni_${baseStr}_${randomString}_${timestamp.slice(-6)}`;
  },
  
  // Generate JWT token for secure room access
  generateJWT: async (roomName, displayName, userId, isHost = false) => {
    try {
      console.log('Generating JWT token with params:', { roomName, displayName, userId, isHost });
      // Call backend endpoint to generate JWT token
      const response = await fetch('/api/meetings/generate-token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({
          roomName,
          displayName,
          userId,
          isHost,
          // Add explicit security restrictions for non-hosts
          restrictions: !isHost ? {
            disableKick: true,
            disableRemoteMute: true,
            disableModeratorIndicator: true,
            disablePrivateChat: false,
            disableReactions: false
          } : {}
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('JWT generation error response:', errorData);
        throw new Error(errorData.detail || 'Failed to generate meeting token');
      }
      
      const data = await response.json();
      console.log('JWT token generated successfully');
      return data.token;
    } catch (error) {
      console.error('JWT generation failed:', error);
      return null;
    }
  },
  
  // Generate direct URL for Jitsi meetings with secure parameters
  generateDirectUrl: async (roomName, displayName, userId, isHost = false) => {
    const baseUrl = 'https://meet.jit.si';
    const secureRoomName = meetingConfig.generateSecureRoomName(roomName);
    
    console.log('Generating direct URL for meeting:', {
      roomName: secureRoomName,
      displayName,
      userId,
      isHost
    });
    
    // Try to get JWT token first for better security
    let jwtToken = null;
    try {
      if (userId) {
        jwtToken = await meetingConfig.generateJWT(secureRoomName, displayName, userId, isHost);
      }
    } catch (error) {
      console.warn('Failed to generate JWT token, falling back to URL params:', error);
    }
    
    if (jwtToken) {
      // Use JWT token for authentication (most secure)
      return `${baseUrl}/${secureRoomName}?jwt=${jwtToken}#config.prejoinPageEnabled=false`;
    }
    
    // Fallback to URL parameters
    let url = `${baseUrl}/${secureRoomName}#config.prejoinPageEnabled=false&config.startWithVideoMuted=true`;
    
    // Add moderator flag for host/admin users
    if (isHost) {
      url += '&userInfo.moderator=true';
    } else {
      url += '&userInfo.moderator=false';
      // Explicitly disable moderation capabilities for non-hosts
      url += '&config.disableKick=true';
      url += '&config.remoteVideoMenu.disableKick=true';
      url += '&config.disableRemoteMute=true';
    }
    
    // Add user display name
    url += `&userInfo.displayName=${encodeURIComponent(displayName || 'User')}`;
    
    console.log('Generated URL:', url.substring(0, 100) + '...');
    return url;
  },
  
  // Handle network reconnection scenarios
  handleReconnection: (api) => {
    if (!api) return;
    
    // Add network quality listeners
    api.addEventListener('connectionEstablished', () => {
      console.log('Jitsi connection established');
    });
    
    api.addEventListener('connectionFailed', (error) => {
      console.warn('Jitsi connection failed - attempting to reconnect', error);
      
      // Add specific handling for membersOnly error
      if (error && error.name === 'conference.connectionError.membersOnly') {
        console.error('MembersOnly error detected - this usually means JWT token issues');
      }
    });
    
    api.addEventListener('videoConferenceLeft', () => {
      console.log('Left video conference');
    });
    
    // Add participant handling
    api.addEventListener('participantJoined', (participant) => {
      console.log('Participant joined:', participant);
    });
  }
};

export default meetingConfig; 