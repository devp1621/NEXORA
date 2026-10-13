"""Request validation (pydantic v2). Field errors are returned to the client as
``{"error": {"code": "validation_error", "message": ..., "details": [{"field", "message"}]}}``."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Level = Literal["beginner", "intermediate", "advanced"]


def _strip(value):
    return value.strip() if isinstance(value, str) else value


class _Base(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")


class SkillIn(_Base):
    name: str = Field(min_length=1, max_length=60)
    level: Level = "intermediate"

    @field_validator("level", mode="before")
    @classmethod
    def _lower_level(cls, v):
        return v.strip().lower() if isinstance(v, str) else v


class ProjectIn(_Base):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=1000)
    technologies: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("technologies")
    @classmethod
    def _tech_len(cls, v):
        cleaned = [t.strip() for t in v if isinstance(t, str) and t.strip()]
        if any(len(t) > 60 for t in cleaned):
            raise ValueError("Each technology must be 60 characters or fewer.")
        return cleaned


class CertificationIn(_Base):
    name: str = Field(min_length=1, max_length=120)
    issuer: str = Field(default="", max_length=120)


class ExperienceIn(_Base):
    role: str = Field(min_length=1, max_length=100)
    organization: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=1000)


class ProfileIn(_Base):
    name: str = Field(min_length=1, max_length=80)
    degree: str = Field(min_length=1, max_length=80)
    branch: str = Field(min_length=1, max_length=80)
    year: str = Field(min_length=1, max_length=40)
    technicalSkills: list[SkillIn] = Field(default_factory=list, max_length=60)
    softSkills: list[str] = Field(default_factory=list, max_length=30)
    projects: list[ProjectIn] = Field(default_factory=list, max_length=15)
    certifications: list[CertificationIn] = Field(default_factory=list, max_length=20)
    experience: list[ExperienceIn] = Field(default_factory=list, max_length=10)
    achievements: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("softSkills", "achievements")
    @classmethod
    def _clean_strings(cls, v):
        cleaned = [s.strip() for s in v if isinstance(s, str) and s.strip()]
        if any(len(s) > 300 for s in cleaned):
            raise ValueError("Each entry must be 300 characters or fewer.")
        return cleaned


class AnalyzeRequest(_Base):
    careerId: str = Field(min_length=1, max_length=40)
    profile: ProfileIn


class ChatTurn(_Base):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(_Base):
    careerId: str = Field(min_length=1, max_length=40)
    profile: ProfileIn
    message: str = Field(min_length=1, max_length=500)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)
