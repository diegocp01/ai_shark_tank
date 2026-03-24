from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StructuredOutputModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class InvestmentDecision(str, Enum):
    INVEST = "INVEST"
    OUT = "OUT"


class SharkProfile(StructuredOutputModel):
    display_name: str = Field(..., min_length=2)
    persona: str = Field(..., min_length=2)
    style: str = Field(..., min_length=12)
    emoji: str = Field(..., min_length=1, max_length=4)


class Pitch(StructuredOutputModel):
    company_name: str = Field(..., min_length=2, description="The startup's company name.")
    product_name: str = Field(..., min_length=2, description="The flagship product or service.")
    concept: str = Field(
        ...,
        min_length=20,
        max_length=280,
        description="A concise explanation of what the startup does and why it matters.",
    )
    ask_amount_usd: int = Field(..., gt=0, description="The founder's ask in U.S. dollars.")
    equity_offer_percent: float = Field(
        ...,
        gt=0,
        le=100,
        description="The equity percentage offered to investors.",
    )
    founder_pitch: str = Field(
        ...,
        min_length=60,
        max_length=700,
        description="A vivid 3-4 sentence Shark Tank style pitch.",
    )


class SharkReaction(StructuredOutputModel):
    shark_name: str = Field(..., min_length=2)
    shark_persona: str = Field(..., min_length=2)
    challenge: str = Field(
        ...,
        min_length=20,
        max_length=280,
        description="A tough question or comment from the shark.",
    )
    decision: InvestmentDecision
    counter_offer: str | None = Field(
        default=None,
        max_length=220,
        description="A short counter-offer sentence when the shark invests, otherwise null.",
    )
    reason: str = Field(
        ...,
        min_length=16,
        max_length=220,
        description="A concise reason for the shark's decision.",
    )

    @field_validator("counter_offer", mode="before")
    @classmethod
    def normalize_blank_counter_offer(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @model_validator(mode="after")
    def validate_counter_offer(self) -> "SharkReaction":
        if self.decision == InvestmentDecision.INVEST and not self.counter_offer:
            raise ValueError("Investing sharks must provide a counter_offer.")
        if self.decision == InvestmentDecision.OUT and self.counter_offer is not None:
            raise ValueError("Sharks that are OUT must leave counter_offer as null.")
        return self


class StoryCard(StructuredOutputModel):
    card_type: Literal["cold_open", "pitch", "shark", "deal"]
    title: str = Field(..., min_length=4, max_length=80)
    speaker: str = Field(..., min_length=2, max_length=80)
    emoji: str = Field(..., min_length=1, max_length=4)
    body: str = Field(
        ...,
        min_length=16,
        max_length=320,
        description="A short mobile-friendly story beat.",
    )


class DealSummary(StructuredOutputModel):
    headline: str = Field(..., min_length=8, max_length=120)
    outcome: str = Field(..., min_length=3, max_length=120)
    investors: list[str] = Field(default_factory=list, max_length=5)
    final_terms: str = Field(..., min_length=3, max_length=220)
    rationale: str = Field(..., min_length=12, max_length=220)

    @field_validator("investors")
    @classmethod
    def normalize_investors(cls, investors: list[str]) -> list[str]:
        deduped: list[str] = []
        seen: set[str] = set()

        for investor in investors:
            cleaned = investor.strip()
            if cleaned and cleaned not in seen:
                deduped.append(cleaned)
                seen.add(cleaned)

        return deduped


class EpisodeNarrative(StructuredOutputModel):
    episode_title: str = Field(..., min_length=4, max_length=120)
    teaser: str = Field(..., min_length=20, max_length=220)
    story_cards: list[StoryCard] = Field(default_factory=list, min_length=8, max_length=8)
    full_story_markdown: str = Field(..., min_length=40, max_length=4000)
    deal_summary: DealSummary

    @model_validator(mode="after")
    def validate_story_shape(self) -> "EpisodeNarrative":
        expected_card_types = [
            "cold_open",
            "pitch",
            "shark",
            "shark",
            "shark",
            "shark",
            "shark",
            "deal",
        ]
        actual_card_types = [card.card_type for card in self.story_cards]

        if actual_card_types != expected_card_types:
            raise ValueError(
                "story_cards must follow this order: cold_open, pitch, five shark cards, deal."
            )

        if "DEAL SUMMARY" not in self.full_story_markdown.upper():
            raise ValueError("full_story_markdown must contain a DEAL SUMMARY section.")

        return self


class Episode(StructuredOutputModel):
    episode_number: int = Field(..., ge=1)
    generated_at: datetime
    theme: str | None = None
    pitch: Pitch
    shark_reactions: list[SharkReaction] = Field(min_length=5, max_length=5)
    story: EpisodeNarrative
