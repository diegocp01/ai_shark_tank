from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import os
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from .config import Settings, get_settings
from .schemas import (
    DealSummary,
    Episode,
    EpisodeNarrative,
    InvestmentDecision,
    Pitch,
    SharkProfile,
    SharkReaction,
    StoryCard,
)
from .serialization import to_jsonable

try:
    from agents import (
        Agent,
        GuardrailFunctionOutput,
        ModelSettings,
        Runner,
        output_guardrail,
    )
    from agents.exceptions import OutputGuardrailTripwireTriggered
except ImportError:  # pragma: no cover - exercised via runtime error handling.
    Agent = None
    GuardrailFunctionOutput = None
    ModelSettings = None
    Runner = None
    OutputGuardrailTripwireTriggered = RuntimeError

    def output_guardrail(func=None, *, name=None):  # type: ignore[no-redef]
        if func is None:
            def decorator(inner):
                return inner

            return decorator
        return func


TModel = TypeVar("TModel", bound=BaseModel)
SINGLE_TURN_MAX = 1

SHARK_PROFILES: tuple[SharkProfile, ...] = (
    SharkProfile(
        display_name="Rex (The Skeptic)",
        persona="The Skeptic",
        style="Pokes holes in everything, cites risk, and sounds blunt but smart.",
        emoji="🧠",
    ),
    SharkProfile(
        display_name="Luna (The Visionary)",
        persona="The Visionary",
        style="Loves moonshot ideas, pushes the long-term vision, and sees cultural upside.",
        emoji="🌙",
    ),
    SharkProfile(
        display_name="Max (The Numbers Shark)",
        persona="The Numbers Shark",
        style="Only cares about revenue, unit economics, CAC, LTV, and margins.",
        emoji="📊",
    ),
    SharkProfile(
        display_name="Vera (The Brand Guru)",
        persona="The Brand Guru",
        style="Obsesses over branding, distribution, and emotional connection with the customer.",
        emoji="✨",
    ),
    SharkProfile(
        display_name="Wild Wes (The Wildcard)",
        persona="The Wildcard",
        style="Chaotic, unpredictable, and capable of either a hilarious lowball or a huge bet.",
        emoji="🎲",
    ),
)
EXPECTED_STORY_CARD_TYPES = [
    "cold_open",
    "pitch",
    "shark",
    "shark",
    "shark",
    "shark",
    "shark",
    "deal",
]
EXPECTED_SHARK_NAMES = [profile.display_name for profile in SHARK_PROFILES]


def _require_runtime() -> None:
    if Agent is None or Runner is None or ModelSettings is None:
        raise RuntimeError(
            "The OpenAI Agents SDK is not installed. Run `pip install -r requirements.txt`."
        )

    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Export it before generating episodes."
        )


def _agent_kwargs(
    settings: Settings,
    output_type: type[Any],
    model_settings: ModelSettings | None = None,
    output_guardrails: list[Any] | None = None,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {"output_type": output_type}
    if settings.explicit_openai_model:
        kwargs["model"] = settings.explicit_openai_model
    if model_settings is not None:
        kwargs["model_settings"] = model_settings
    if output_guardrails:
        kwargs["output_guardrails"] = output_guardrails
    return kwargs


def _pretty_json(value: Any) -> str:
    return json.dumps(to_jsonable(value), indent=2)


def _expect_model(value: Any, expected_type: type[TModel], label: str) -> TModel:
    if isinstance(value, expected_type):
        return value

    try:
        return expected_type.model_validate(value)
    except ValidationError as exc:
        raise RuntimeError(
            f"Expected {label} to validate as {expected_type.__name__}: {exc}"
        ) from exc


@output_guardrail(name="episode_story_shape_guardrail")
def episode_story_shape_guardrail(
    _context: Any, _agent: Any, output: EpisodeNarrative
) -> GuardrailFunctionOutput:
    errors: list[str] = []
    actual_card_types = [card.card_type for card in output.story_cards]

    if actual_card_types != EXPECTED_STORY_CARD_TYPES:
        errors.append(
            "story_cards must follow the required order of cold_open, pitch, five shark cards, and deal."
        )

    shark_card_speakers = [card.speaker for card in output.story_cards[2:7]]
    if shark_card_speakers != EXPECTED_SHARK_NAMES:
        errors.append(
            "The five shark story cards must appear in the configured shark order and use the shark display names as speakers."
        )

    invalid_investors = [
        investor
        for investor in output.deal_summary.investors
        if investor not in EXPECTED_SHARK_NAMES
    ]
    if invalid_investors:
        errors.append(
            f"deal_summary.investors contains unknown sharks: {', '.join(invalid_investors)}."
        )

    if not output.deal_summary.investors and output.deal_summary.final_terms.lower() != "no deal":
        errors.append("When there are no investors, final_terms must be 'No Deal'.")

    if output.deal_summary.investors and output.deal_summary.final_terms.lower() == "no deal":
        errors.append("When investors are present, final_terms cannot be 'No Deal'.")

    return GuardrailFunctionOutput(
        output_info={"errors": errors},
        tripwire_triggered=bool(errors),
    )


def _single_turn_settings(temperature: float) -> ModelSettings:
    return ModelSettings(temperature=temperature)


def _build_entrepreneur_agent(settings: Settings) -> Any:
    return Agent(
        name="Entrepreneur",
        instructions="""
You are a charismatic founder pitching on a fictional show called AI Shark Tank.
Invent an original, slightly outrageous startup that still sounds buildable.

Return structured data with these fields:
- company_name: a memorable startup name
- product_name: the flagship product or service name
- concept: 1-2 sentences on what the startup does and why people care
- ask_amount_usd: an integer amount in U.S. dollars
- equity_offer_percent: a numeric percentage offered to investors
- founder_pitch: 3-4 vivid sentences with on-stage energy, a hook, and concrete numbers

Make it funny, specific, and TV-ready.
""".strip(),
        **_agent_kwargs(
            settings,
            Pitch,
            model_settings=_single_turn_settings(temperature=1.0),
        ),
    )


def _build_shark_agent(profile: SharkProfile, settings: Settings) -> Any:
    return Agent(
        name=profile.display_name,
        instructions=f"""
You are {profile.display_name}, one of the five AI Sharks on AI Shark Tank.
Persona: {profile.persona}.
Style: {profile.style}

Return structured data with these fields:
- shark_name: "{profile.display_name}"
- shark_persona: "{profile.persona}"
- challenge: one tough question or comment in 1-2 punchy sentences
- decision: INVEST or OUT
- counter_offer: a short counter-offer sentence if you decide INVEST, otherwise null
- reason: one concise sentence explaining your decision

Stay fully in character and make your reaction feel like great television.
""".strip(),
        **_agent_kwargs(
            settings,
            SharkReaction,
            model_settings=_single_turn_settings(temperature=0.8),
        ),
    )


def _build_orchestrator_agent(settings: Settings) -> Any:
    return Agent(
        name="Orchestrator",
        instructions="""
You are the narrator and producer of AI Shark Tank.
Turn the founder pitch and all five shark reactions into a mobile-first episode recap.

Return structured data with these fields:
- episode_title: a catchy TV-style title
- teaser: 1-2 sentences that set the scene
- story_cards: exactly 8 cards in this order:
  1. cold_open
  2. pitch
  3-7. one shark card per shark
  8. deal

Each story card must include:
- card_type: one of cold_open, pitch, shark, deal
- title: a short headline
- speaker: who owns the moment
- emoji: one emoji that matches the beat
- body: 1-3 short sentences written for a scrollable mobile story card

Also return:
- full_story_markdown: a dramatic recap with headers and emojis that ends with a DEAL SUMMARY section
- deal_summary:
  - headline: one punchy summary sentence
  - outcome: the final verdict, such as "No Deal" or "Rex and Vera team up"
  - investors: a list of investing sharks, if any
  - final_terms: summarize the winning deal or say "No Deal"
  - rationale: one sentence on why the episode ended that way

Make it playful, dramatic, and easy to skim.
""".strip(),
        **_agent_kwargs(
            settings,
            EpisodeNarrative,
            model_settings=_single_turn_settings(temperature=0.7),
            output_guardrails=[episode_story_shape_guardrail],
        ),
    )


def _build_pitch_prompt(theme: str | None) -> str:
    theme = (theme or "").strip()
    prompt = (
        "Come up with a brand-new startup pitch for an AI Shark Tank episode. "
        "Avoid generic SaaS ideas and surprise the audience with something memorable."
    )
    if theme:
        prompt += f" Use this optional theme or inspiration: {theme}."
    return prompt


def _build_story_prompt(
    pitch: Pitch,
    shark_reactions: list[SharkReaction],
    repair_notes: dict[str, Any] | None = None,
) -> str:
    prompt = (
        "Build the final episode recap.\n\n"
        f"PITCH JSON:\n{_pretty_json(pitch)}\n\n"
        f"SHARK RESPONSES JSON:\n{_pretty_json(shark_reactions)}"
    )

    if repair_notes:
        prompt += (
            "\n\nREPAIR NOTES:\n"
            f"{_pretty_json(repair_notes)}\n\n"
            "Regenerate the entire structured response and fix every validation issue."
        )

    return prompt


async def _generate_shark_response(
    profile: SharkProfile, pitch: Pitch, settings: Settings
) -> SharkReaction:
    shark_agent = _build_shark_agent(profile, settings)
    shark_prompt = (
        "React to this founder pitch.\n\n"
        f"Pitch JSON:\n{_pretty_json(pitch)}\n\n"
        "Be sharp, specific, and stay in character."
    )
    result = await Runner.run(shark_agent, shark_prompt, max_turns=SINGLE_TURN_MAX)
    return _expect_model(result.final_output, SharkReaction, profile.display_name)


async def _generate_episode_story(
    pitch: Pitch, shark_reactions: list[SharkReaction], settings: Settings
) -> EpisodeNarrative:
    orchestrator = _build_orchestrator_agent(settings)
    base_prompt = _build_story_prompt(pitch, shark_reactions)

    try:
        story_result = await Runner.run(
            orchestrator,
            base_prompt,
            max_turns=SINGLE_TURN_MAX,
        )
        return _expect_model(
            story_result.final_output, EpisodeNarrative, "episode narrative"
        )
    except OutputGuardrailTripwireTriggered as exc:
        repair_notes = exc.guardrail_result.output.output_info
        story_result = await Runner.run(
            orchestrator,
            _build_story_prompt(pitch, shark_reactions, repair_notes=repair_notes),
            max_turns=SINGLE_TURN_MAX,
        )
        return _expect_model(
            story_result.final_output, EpisodeNarrative, "episode narrative"
        )


async def generate_episode(
    episode_number: int = 1,
    theme: str | None = None,
    settings: Settings | None = None,
) -> Episode:
    settings = settings or get_settings()
    _require_runtime()

    entrepreneur = _build_entrepreneur_agent(settings)
    pitch_result = await Runner.run(
        entrepreneur,
        _build_pitch_prompt(theme),
        max_turns=SINGLE_TURN_MAX,
    )
    pitch = _expect_model(pitch_result.final_output, Pitch, "pitch")

    # We keep the fan-out in Python so every shark is invoked exactly once.
    shark_reactions = await asyncio.gather(
        *[
            _generate_shark_response(profile, pitch, settings)
            for profile in SHARK_PROFILES
        ]
    )

    story = await _generate_episode_story(pitch, shark_reactions, settings)

    return Episode(
        episode_number=episode_number,
        generated_at=datetime.now(timezone.utc).isoformat(),
        theme=(theme or "").strip() or None,
        pitch=pitch,
        shark_reactions=shark_reactions,
        story=story,
    )


async def generate_episodes(
    count: int | None = None,
    theme: str | None = None,
    settings: Settings | None = None,
) -> list[Episode]:
    settings = settings or get_settings()
    target_count = settings.default_episode_count if count is None else count

    if target_count < 1 or target_count > settings.max_episode_count:
        raise ValueError(
            f"`count` must be between 1 and {settings.max_episode_count}."
        )

    episodes: list[Episode] = []
    for episode_number in range(1, target_count + 1):
        episodes.append(
            await generate_episode(
                episode_number=episode_number,
                theme=theme,
                settings=settings,
            )
        )

    return episodes


__all__ = [
    "DealSummary",
    "Episode",
    "EpisodeNarrative",
    "InvestmentDecision",
    "Pitch",
    "SHARK_PROFILES",
    "SharkReaction",
    "StoryCard",
    "episode_story_shape_guardrail",
    "generate_episode",
    "generate_episodes",
]
