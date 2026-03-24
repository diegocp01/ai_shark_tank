from __future__ import annotations

import unittest
from unittest.mock import patch

from app import app
from api.schemas import (
    DealSummary,
    Episode,
    EpisodeNarrative,
    Pitch,
    SharkReaction,
    StoryCard,
)
from api.serialization import to_jsonable


class FlaskAppTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = app.test_client()

    def test_index_renders_html_shell(self) -> None:
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertIn(b"AI Shark Tank", response.data)
        self.assertIn(b"Producer Console", response.data)

    def test_api_generate_returns_json_payload(self) -> None:
        fake_episode = Episode(
            episode_number=1,
            generated_at="2026-03-14T00:00:00+00:00",
            theme="snack robots",
            pitch=Pitch(
                company_name="Snacktopus Labs",
                product_name="Tentacle Taster",
                concept="Snack robots for every pantry.",
                ask_amount_usd=250000,
                equity_offer_percent=10.0,
                founder_pitch=(
                    "I'm asking for $250,000 for 10% of Snacktopus Labs. "
                    "Tentacle Taster brings custom snack robots into neglected pantries, "
                    "and our early testers keep reordering flavor pods every month."
                ),
            ),
            shark_reactions=[
                SharkReaction(
                    shark_name="Rex (The Skeptic)",
                    shark_persona="The Skeptic",
                    challenge="I do not trust these margins.",
                    decision="OUT",
                    counter_offer=None,
                    reason="Too weird for me.",
                ),
                SharkReaction(
                    shark_name="Luna (The Visionary)",
                    shark_persona="The Visionary",
                    challenge="Could this become a breakout consumer story?",
                    decision="OUT",
                    counter_offer=None,
                    reason="The vision is interesting, but the moat feels thin.",
                ),
                SharkReaction(
                    shark_name="Max (The Numbers Shark)",
                    shark_persona="The Numbers Shark",
                    challenge="What happens to your margins after hardware support costs hit?",
                    decision="OUT",
                    counter_offer=None,
                    reason="The unit economics do not work for me.",
                ),
                SharkReaction(
                    shark_name="Vera (The Brand Guru)",
                    shark_persona="The Brand Guru",
                    challenge="Why would customers tell this story to their friends?",
                    decision="OUT",
                    counter_offer=None,
                    reason="I do not yet believe the brand is sticky enough.",
                ),
                SharkReaction(
                    shark_name="Wild Wes (The Wildcard)",
                    shark_persona="The Wildcard",
                    challenge="I like the chaos, but can this survive the real world?",
                    decision="OUT",
                    counter_offer=None,
                    reason="It is fun TV, not my kind of investment.",
                ),
            ],
            story=EpisodeNarrative(
                episode_title="Robot Snacks in the Tank",
                teaser="A bold founder enters the room.",
                story_cards=[
                    StoryCard(
                        card_type="cold_open",
                        title="Lights up",
                        speaker="Narrator",
                        emoji="🎬",
                        body="The studio hums.",
                    ),
                    StoryCard(
                        card_type="pitch",
                        title="The founder makes the ask",
                        speaker="Entrepreneur",
                        emoji="🦈",
                        body="Snacktopus Labs makes a big swing for a fresh check.",
                    ),
                    StoryCard(
                        card_type="shark",
                        title="Rex digs in",
                        speaker="Rex (The Skeptic)",
                        emoji="🧠",
                        body="Rex questions whether anyone needs a snack robot at all.",
                    ),
                    StoryCard(
                        card_type="shark",
                        title="Luna sees the future",
                        speaker="Luna (The Visionary)",
                        emoji="🌙",
                        body="Luna wonders whether this could become a cult consumer brand.",
                    ),
                    StoryCard(
                        card_type="shark",
                        title="Max wants the math",
                        speaker="Max (The Numbers Shark)",
                        emoji="📊",
                        body="Max goes straight to margins, pods, and repeat purchase behavior.",
                    ),
                    StoryCard(
                        card_type="shark",
                        title="Vera hears a story",
                        speaker="Vera (The Brand Guru)",
                        emoji="✨",
                        body="Vera asks whether the founder can turn novelty into loyalty.",
                    ),
                    StoryCard(
                        card_type="shark",
                        title="Wes gets weird",
                        speaker="Wild Wes (The Wildcard)",
                        emoji="🎲",
                        body="Wes threatens to fund it only if he gets a lifetime snack pass.",
                    ),
                    StoryCard(
                        card_type="deal",
                        title="No one bites",
                        speaker="Narrator",
                        emoji="📉",
                        body="The sharks enjoy the show, but the deal never gets over the line.",
                    ),
                ],
                full_story_markdown=(
                    "## Opening Pitch\n"
                    "Snacktopus Labs rolls out a theatrical pantry robot.\n\n"
                    "## DEAL SUMMARY\n"
                    "No Deal."
                ),
                deal_summary=DealSummary(
                    headline="No one bites.",
                    outcome="No Deal",
                    investors=[],
                    final_terms="No Deal",
                    rationale="The sharks are unconvinced.",
                ),
            ),
        )

        with patch("app._run_generate_episodes", return_value=[to_jsonable(fake_episode)]):
            response = self.client.post(
                "/api/generate-episodes",
                json={"count": 1, "theme": "snack robots"},
            )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["episodes"][0]["theme"], "snack robots")


if __name__ == "__main__":
    unittest.main()
