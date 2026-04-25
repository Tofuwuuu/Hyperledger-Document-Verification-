from pydantic import BaseModel, Field


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6)
    confirm_password: str = Field(min_length=6)


class ChangePasswordResponse(BaseModel):
    success: bool
    message: str
