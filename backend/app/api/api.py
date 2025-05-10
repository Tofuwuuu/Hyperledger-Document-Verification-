from fastapi import APIRouter

# Import only the routes that exist
from app.api.routes import fabric, notifications, admin, roles, users, healthcheck

# Use standard routes from the app.routes package
from app.routes import auth, alumni, documents, verification, events, registrations

api_router = APIRouter()

# Include API routers
api_router.include_router(healthcheck.router, prefix="/healthcheck", tags=["healthcheck"])
api_router.include_router(fabric.router, prefix="/fabric", tags=["fabric"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(roles.router, prefix="/admin", tags=["admin", "roles"])
api_router.include_router(users.router, prefix="/admin", tags=["admin", "users"])

# Include the primary routes
api_router.include_router(auth.router)
api_router.include_router(alumni.router)
api_router.include_router(documents.router)
api_router.include_router(verification.router)
api_router.include_router(events.router)
api_router.include_router(registrations.router) 