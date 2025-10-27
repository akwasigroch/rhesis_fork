from typing import Dict, List, Optional

from pydantic import UUID4, BaseModel, ConfigDict, Field, field_validator

from .base import Base
from .status import Status
from .tag import Tag
from .type_lookup import TypeLookup
from .user import User


class ModelBase(Base):
    """Base schema for Model"""

    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    model_name: str
    endpoint: Optional[str] = Field(
        default=None, description="API endpoint URL (optional for cloud providers)"
    )
    key: str
    request_headers: Optional[Dict] = None
    is_protected: Optional[bool] = Field(
        default=False, description="System models are protected and cannot be deleted"
    )
    organization_id: Optional[UUID4] = None
    user_id: Optional[UUID4] = None

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, v):
        """Ensure endpoint is either None or a non-empty string"""
        if v is not None and (not isinstance(v, str) or not v.strip()):
            raise ValueError("Endpoint must be a valid non-empty URL if provided")
        return v if v is None else v.strip()


class ModelCreate(ModelBase):
    """Schema for creating a new Model"""

    provider_type_id: Optional[UUID4] = None
    status_id: Optional[UUID4] = None
    owner_id: Optional[UUID4] = None
    assignee_id: Optional[UUID4] = None


class ModelUpdate(ModelBase):
    """Schema for updating an existing Model"""

    name: Optional[str] = None
    model_name: Optional[str] = None
    endpoint: Optional[str] = None
    key: Optional[str] = None
    provider_type_id: Optional[UUID4] = None
    status_id: Optional[UUID4] = None
    owner_id: Optional[UUID4] = None
    assignee_id: Optional[UUID4] = None


class Model(ModelBase):
    """Complete Model schema with relationships"""

    id: UUID4
    provider_type_id: Optional[UUID4] = None
    status_id: Optional[UUID4] = None
    owner_id: Optional[UUID4] = None
    assignee_id: Optional[UUID4] = None
    is_protected: bool = False
    provider_type: Optional[TypeLookup] = None
    status: Optional[Status] = None
    owner: Optional[User] = None
    assignee: Optional[User] = None
    tags: Optional[List[Tag]] = []

    model_config = ConfigDict(from_attributes=True)


class TestModelConnectionRequest(BaseModel):
    """Schema for testing a model connection before creating it"""

    provider: str
    model_name: str
    api_key: str
    endpoint: Optional[str] = Field(
        default=None, description="Optional endpoint URL for self-hosted providers"
    )

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, v):
        """Ensure endpoint is either None or a non-empty string"""
        if v is not None and (not isinstance(v, str) or not v.strip()):
            raise ValueError("Endpoint must be a valid non-empty URL if provided")
        return v if v is None else v.strip()


class TestModelConnectionResponse(BaseModel):
    """Schema for the model connection test response"""

    success: bool
    message: str
    provider: str
    model_name: str
