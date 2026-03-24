from __future__ import annotations

import os
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from pydantic import ValidationError

from api.config import Settings
from api.generate import SHARK_PROFILES, generate_episode, generate_episodes
import api.generate as generate_module
from api.schemas import (
    DealSummary,
    EpisodeNarrative,
    InvestmentDecision,
    Pitch,
    SharkReaction,
    StoryCard,
)


class FakeAgent:
    def __init__(self, **kwargs):
        self.name = kwargs["name"]
        self.instructions = kwargs["instructions"]
        self.model = kwargs.get("model")
        self.model_settings = kwargs.get("model_settings")
        self.output_type = kwargs.get("output_type")
        self.output_guardrails = kwargs.get("output_guardrails", [])


class FakeRunner:
    calls: list[tuple[str, str]] = []

    @classmethod
    async def run(cls, agent: FakeAgent, prompt: str, **_kwargs) -> SimpleNamespace:
        cls.calls.append((agent.name, prompt))

        if agent.name == "Entrepreneur":
            return SimpleNamespace(
                final_output=Pitch(
                    company_name="Snacktopus Labs",
                    product_name="Tentacle Taster",
                    concept="A smart countertop gadget that invents custom seaweed snacks "
                    "based on your mood and pantry leftovers.",
                    ask_amount_usd=250000,
                    equity_offer_percent=10.0,
                    founder_pitch="I'm seeking $250,000 for 10% of Snacktopus Labs. "
                    "Tentacle Taster turns sad leftovers into premium snack drops with "
                    "a 72% repeat purchase rate in our pilot. We sold out 4,000 units in "
                    "three weekends, and customers now call it Peloton for pantry weirdos.",
                )
            )

        if agent.name == "Orchestrator":
            shark_cards = [
                StoryCard(
                    card_type="shark",
                    title=f"{profile.persona} strikes",
                    speaker=profile.display_name,
                    emoji=profile.emoji,
                    body=f"{profile.display_name} leans in with a tough reaction.",
                )
                for profile in SHARK_PROFILES
            ]
            return SimpleNamespace(
                final_output=EpisodeNarrative(
                    episode_title="Seaweed, Sweat, and Snacks",
                    teaser="A founder walks in with an oddly compelling snack machine and a "
                    "room full of very opinionated sharks.",
                    story_cards=[
                        StoryCard(
                            card_type="cold_open",
                            title="Studio lights up",
                            speaker="Narrator",
                            emoji="🎬",
                            body="The sharks smell sea salt and startup chaos in the air.",
                        ),
                        StoryCard(
                            card_type="pitch",
                            title="The founder makes the ask",
                            speaker="Entrepreneur",
                            emoji="🦈",
                            body="Snacktopus Labs asks for $250,000 in exchange for 10%.",
                        ),
                        *shark_cards,
                        StoryCard(
                            card_type="deal",
                            title="No bites tonight",
                            speaker="Narrator",
                            emoji="📉",
                            body="The sharks love the theater, but nobody can swallow the risk.",
                        ),
                    ],
                    full_story_markdown=(
                        "## Opening Pitch\n"
                        "Snacktopus Labs storms the tank.\n\n"
                        "## DEAL SUMMARY\n"
                        "No Deal."
                    ),
                    deal_summary=DealSummary(
                        headline="Great TV, no term sheet.",
                        outcome="No Deal",
                        investors=[],
                        final_terms="No Deal",
                        rationale="The sharks liked the spectacle more than the business.",
                    ),
                )
            )

        return SimpleNamespace(
            final_output=SharkReaction(
                shark_name=agent.name,
                shark_persona="Judge",
                challenge=f"{agent.name} questions the repeat purchase story.",
                decision=InvestmentDecision.OUT,
                counter_offer=None,
                reason="The economics feel too shaky for this shark.",
            )
        )


class GenerateEpisodeTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        FakeRunner.calls = []
        self.settings = Settings(
            explicit_openai_model="gpt-4.1",
            default_episode_count=5,
            max_episode_count=10,
        )

    async def test_generate_episode_returns_mobile_story_payload(self) -> None:
        with (
            patch.object(generate_module, "Agent", FakeAgent),
            patch.object(generate_module, "Runner", FakeRunner),
            patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}, clear=False),
        ):
            episode = await generate_episode(
                episode_number=3,
                theme="food tech fever dream",
                settings=self.settings,
            )

        self.assertEqual(episode.episode_number, 3)
        self.assertEqual(episode.theme, "food tech fever dream")
        self.assertEqual(episode.pitch.company_name, "Snacktopus Labs")
        self.assertEqual(len(episode.shark_reactions), len(SHARK_PROFILES))
        self.assertEqual(len(episode.story.story_cards), 8)
        self.assertEqual(episode.story.deal_summary.outcome, "No Deal")
        self.assertEqual(len(FakeRunner.calls), 7)
        self.assertIn("food tech fever dream", FakeRunner.calls[0][1])

    async def test_generate_episodes_respects_requested_count(self) -> None:
        with (
            patch.object(generate_module, "Agent", FakeAgent),
            patch.object(generate_module, "Runner", FakeRunner),
            patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}, clear=False),
        ):
            episodes = await generate_episodes(
                count=2,
                theme=None,
                settings=self.settings,
            )

        self.assertEqual(len(episodes), 2)
        self.assertEqual([episode.episode_number for episode in episodes], [1, 2])
        self.assertEqual(len(FakeRunner.calls), 14)

    def test_episode_narrative_schema_enforces_card_order(self) -> None:
        with self.assertRaises(ValidationError):
            EpisodeNarrative(
                episode_title="Out of Order",
                teaser="A dramatic episode with scrambled cards.",
                story_cards=[
                    StoryCard(card_type="pitch", title="Pitch", speaker="Entrepreneur", emoji="🦈", body="The founder opens with a bold ask."),
                    StoryCard(card_type="cold_open", title="Cold open", speaker="Narrator", emoji="🎬", body="The tank is already buzzing."),
                    StoryCard(card_type="shark", title="Rex reacts", speaker="Rex (The Skeptic)", emoji="🧠", body="Rex asks a tough question about risk."),
                    StoryCard(card_type="shark", title="Luna reacts", speaker="Luna (The Visionary)", emoji="🌙", body="Luna imagines a much bigger future."),
                    StoryCard(card_type="shark", title="Max reacts", speaker="Max (The Numbers Shark)", emoji="📊", body="Max zeroes in on margins."),
                    StoryCard(card_type="shark", title="Vera reacts", speaker="Vera (The Brand Guru)", emoji="✨", body="Vera talks about the story customers will tell."),
                    StoryCard(card_type="shark", title="Wes reacts", speaker="Wild Wes (The Wildcard)", emoji="🎲", body="Wes threatens to make a strange offer."),
                    StoryCard(card_type="deal", title="Final verdict", speaker="Narrator", emoji="📉", body="The room lands on a dramatic ending."),
                ],
                full_story_markdown="## DEAL SUMMARY\nNo Deal",
                deal_summary=DealSummary(
                    headline="A messy episode.",
                    outcome="No Deal",
                    investors=[],
                    final_terms="No Deal",
                    rationale="The cards are in the wrong order.",
                ),
            )

    def test_story_guardrail_rejects_unknown_investor_names(self) -> None:
        valid_story = EpisodeNarrative(
            episode_title="Robot Snacks in the Tank",
            teaser="A bold founder enters the room and every shark gets a moment.",
            story_cards=[
                StoryCard(card_type="cold_open", title="Lights up", speaker="Narrator", emoji="🎬", body="The sharks smell opportunity and danger."),
                StoryCard(card_type="pitch", title="The founder swings big", speaker="Entrepreneur", emoji="🦈", body="Snacktopus Labs asks for a bold check."),
                StoryCard(card_type="shark", title="Rex reacts", speaker="Rex (The Skeptic)", emoji="🧠", body="Rex attacks the weak spots in the story."),
                StoryCard(card_type="shark", title="Luna reacts", speaker="Luna (The Visionary)", emoji="🌙", body="Luna sees a bigger cultural movement here."),
                StoryCard(card_type="shark", title="Max reacts", speaker="Max (The Numbers Shark)", emoji="📊", body="Max asks what the margins really look like."),
                StoryCard(card_type="shark", title="Vera reacts", speaker="Vera (The Brand Guru)", emoji="✨", body="Vera wants to know whether the brand can travel."),
                StoryCard(card_type="shark", title="Wes reacts", speaker="Wild Wes (The Wildcard)", emoji="🎲", body="Wes threatens to blow up the cap table."),
                StoryCard(card_type="deal", title="The room lands", speaker="Narrator", emoji="📉", body="The sharks deliver the final call."),
            ],
            full_story_markdown="## Opening Pitch\nSnack robots.\n\n## DEAL SUMMARY\nNo Deal",
            deal_summary=DealSummary(
                headline="A loud room, but not the right room.",
                outcome="No Deal",
                investors=["Mystery Shark"],
                final_terms="Mystery Shark offers a side deal.",
                rationale="The episode summary drifted away from the configured panel.",
            ),
        )

        result = generate_module.episode_story_shape_guardrail.guardrail_function(
            None, None, valid_story
        )

        self.assertTrue(result.tripwire_triggered)
        self.assertIn("unknown sharks", " ".join(result.output_info["errors"]))


if __name__ == "__main__":
    unittest.main()
