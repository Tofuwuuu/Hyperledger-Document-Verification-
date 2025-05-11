from .user import (
    UserBase, 
    UserCreate, 
    UserUpdate, 
    UserInDB, 
    UserOut, 
    UserLogin, 
    TokenData, 
    TokenPayload,
    Token, 
    PasswordChange,
    PaginationMeta,
    UserPaginatedResponse
)

# Import password reset schemas from dedicated file
from .password_reset import (
    PasswordReset,
    PasswordResetToken,
    PasswordResetConfirm
)

# Import MFA schemas
from .mfa import (
    MFASetupRequest,
    MFAEnableRequest,
    MFALoginRequest,
    MFAStatusResponse,
    MFASetupResponse
)

from .alumni import (
    SocialMedia,
    Education,
    WorkExperience,
    Achievement,
    AlumniBase,
    AlumniCreate,
    AlumniUpdate,
    AlumniInDB,
    AlumniOut,
    AlumniSearchParams,
    AlumniSearchResult,
    ProfilePictureUpload
)

from .document import (
    DocumentType,
    VerificationStatus,
    DocumentBase,
    DocumentCreate,
    DocumentUpdate,
    DocumentInDB,
    DocumentOut,
    DocumentSearchParams,
    DocumentSearchResult,
    DocumentUpload,
    VerificationRequest,
    VerificationResponse,
    PublicVerificationRequest,
    PublicVerificationResponse
)

from .role import (
    PermissionBase,
    PermissionCreate,
    PermissionInDB,
    PermissionOut,
    RoleBase,
    RoleCreate,
    RoleUpdate,
    RoleInDB,
    RoleOut,
    AssignPermissionRequest,
    RolePaginatedResponse
)

# Import event schemas
from .event import (
    EventBase,
    EventCreate,
    EventUpdate,
    EventInDB,
    EventOut,
    EventSearchParams,
    EventSearchResult,
    RegistrationCreate,
    RegistrationOut
) 