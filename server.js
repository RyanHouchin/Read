const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

function buildPrompt(metrics) {
  return `You are a clinical facial analyst. A 68-point landmark system computed structural measurements. Use the data as context but trust YOUR EYES for the overall assessment.

COMPUTED DATA (reference):
${JSON.stringify(metrics, null, 2)}

RESPOND WITH ONLY VALID JSON. No markdown, no backticks.

{
  "tier": 6,
  "tier_placement": 7,
  "tier_reasoning": "One sentence: why this tier and placement.",

  "presentation_tiers": {
    "skin_clarity": { "tier": 5, "placement": 6, "note": "One sentence" },
    "coloring_contrast": { "tier": 4, "placement": 5, "note": "One sentence" },
    "hair": { "tier": 5, "placement": 7, "note": "One sentence" },
    "expression_quality": { "tier": 4, "placement": 5, "note": "One sentence" },
    "grooming": { "tier": 5, "placement": 6, "note": "One sentence" },
    "photo_quality": { "tier": 4, "placement": 5, "note": "One sentence" }
  },

  "harmony": { "adjustment": 0.3, "note": "One sentence. Range -1.0 to +1.0." },

  "personality_read": "3-4 sentences. How do people instinctively react to this face?",

  "archetype": "2-4 word label",
  "opening": "One razor-sharp sentence about this face's architecture",
  "first_impression": "Exactly 6 words",

  "best_angle": { "side": "left", "note": "One sentence" },
  "best_features": [{ "feature": "Name", "detail": "One sentence" }],
  "leaks": [{ "issue": "Name", "detail": "One sentence" }],

  "today_moves": [{ "action": "Same-day action", "bump_tiers": 0, "bump_placement": 2, "detail": "One sentence" }],
  "regimen_moves": [{ "action": "90-day commitment", "bump_tiers": 1, "bump_placement": 3, "detail": "One sentence" }],

  "looksmaxxing": [{
    "technique": "Name", "target": "Problem", "roi": "high",
    "detail": "2-3 sentences.", "evidence": "established"
  }]
}

=== TIER SYSTEM (MOST IMPORTANT) ===

You MUST pick exactly ONE tier for overall attractiveness. This is a CATEGORICAL judgment, not a number.

Read each tier description. Pick the ONE that best matches what you see. Be honest.

TIER 1 — WELL BELOW AVERAGE
"Most people would immediately notice significant unattractiveness."
Obvious structural problems. Features that draw negative attention. Facial deformity, extreme asymmetry, or severely unflattering proportions.

TIER 2 — BELOW AVERAGE  
"Noticeably less attractive than most people."
Multiple unflattering features. Weak bone structure, poor proportions, or aging that significantly impacts appearance. Most observers would rate below average.

TIER 3 — SLIGHTLY BELOW AVERAGE
"Unremarkable, leaning unflattering."
Nothing severely wrong, but nothing that stands out positively. Features that are somewhat unflattering but not dramatically so.

TIER 4 — AVERAGE
"Blends into a crowd. Neither attractive nor unattractive."
Completely unremarkable. The kind of face you pass on the street and don't remember. No standout features in either direction.

TIER 5 — ABOVE AVERAGE
"Noticeably good-looking. Gets occasional compliments."
Some genuinely attractive features. Most people would agree this person is better-looking than average. Could be a local news anchor, the good-looking person in an office.

TIER 6 — VERY ATTRACTIVE
"Turns heads. Undeniably good-looking to almost everyone."
Strong bone structure, good proportions, attractive features. People notice when this person walks into a room. Could model for regional brands. Top 10-15% of population.

TIER 7 — EXCEPTIONALLY ATTRACTIVE
"Strikingly beautiful. Professional model or actor tier."
Elite bone structure, near-ideal proportions, powerful facial harmony. The kind of face that stops conversations. Top 1-5% of population. Could be a lead actor or high-fashion model.

TIER PLACEMENT (1-10): Where within the tier does this person fall?
1 = barely qualifies for this tier (almost the tier below)
5 = solidly in the middle of this tier
10 = at the very top of this tier (almost the tier above)

DECISION PROCESS — answer these in your head before choosing:
1. "Would most people call this person attractive?" → If clearly yes, tier 5+
2. "Does this person turn heads?" → If yes, tier 6+
3. "Could this person be a professional model/actor based on looks alone?" → If yes, tier 7
4. "Would most people consider this person below average?" → If yes, tier 1-3

TEST YOUR ANSWER: Does your tier match the gut reaction most humans would have seeing this face? If it doesn't, change it.

=== PRESENTATION TIERS (same 1-7 system) ===
Apply the same tier logic to each presentation factor.

=== OPTIMIZATION ===
TODAY MOVES (3-5): Same-day actions. bump_tiers = 0 usually, bump_placement = 1-4.
REGIMEN (3-5): 90-day commitments. bump_tiers = 0-1, bump_placement = 1-8.
- Body fat reduction to 10-15% is the BIGGEST lever. If not lean, this is #1. bump_tiers: 1, bump_placement: 5-8. Transforms jawline, cheekbones, facial harmony.
- Retinol + SPF skincare, posture correction, neck/trap training, dental work.
- Do NOT recommend low-impact generic tips. Only VISIBLE facial impact.

LOOKSMAXXING (3-6): Match weaknesses to techniques. Only relevant ones.

No celebrity names. No disclaimers. Clinical and direct.`;
}

app.post("/api/analyze", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set." });

  const { image, media_type, metrics } = req.body;
  if (!image) return res.status(400).json({ error: "No image data." });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: media_type || "image/jpeg", data: image } },
            { type: "text", text: buildPrompt(metrics || {}) }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("API error:", response.status, err);
      return res.status(502).json({ error: "Claude API error: " + response.status });
    }

    const data = await response.json();
    if (data.error) return res.status(502).json({ error: data.error.message });

    const text = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("");
    if (!text) return res.status(502).json({ error: "Empty response. Try different photo." });

    const clean = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed;
    try { parsed = JSON.parse(clean); }
    catch (e) { return res.status(502).json({ error: "Parse error. Try again." }); }

    res.json(parsed);
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, "0.0.0.0", () => console.log("Server running on port " + PORT));
