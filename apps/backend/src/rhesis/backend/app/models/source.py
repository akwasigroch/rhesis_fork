from sqlalchemy import Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from .base import Base
from .guid import GUID
from .mixins import CommentsMixin, CountsMixin, OrganizationAndUserMixin, TagsMixin


class Source(Base, OrganizationAndUserMixin, TagsMixin, CommentsMixin, CountsMixin):
    __tablename__ = "source"

    # Basic information
    title = Column(String, nullable=False)  # Source name or title, required
    description = Column(Text)
    content = Column(Text)  # Raw text content from source, extracted
    source_type_id = Column(
        GUID(), ForeignKey("type_lookup.id")
    )  # Type of source (e.g., 'website', 'document')

    # Status relationship
    status_id = Column(GUID(), ForeignKey("status.id"))

    # Additional information
    url = Column(String)  # Optional, URL if the source is a website
    citation = Column(Text)  # Optional, citation details for papers or books
    language_code = Column(
        String(5), comment="Language in IETF language tag format"
    )  # Language of the source (e.g., 'en-US')

    # File metadata as JSONB object
    source_metadata = Column(
        JSONB, default=dict
    )  # Should contain file_path, file_type, file_size, file_hash

    # Relationships
    source_type = relationship("TypeLookup", back_populates="sources")
    status = relationship("Status", back_populates="sources")
    user = relationship("User", foreign_keys="[Source.user_id]", back_populates="created_sources")
    prompt_templates = relationship("PromptTemplate", back_populates="source")
    prompts = relationship("Prompt", back_populates="source")
    # New many-to-many backref for tests that reference this source via association
    tests_multi = relationship("Test", secondary="test_source", back_populates="sources")
    # Comment relationship (polymorphic)
    comments = relationship(
        "Comment",
        primaryjoin=(
            "and_(Comment.entity_id == foreign(Source.id), Comment.entity_type == 'Source')"
        ),
        viewonly=True,
        uselist=True,
    )
