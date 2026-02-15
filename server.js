const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

function buildPrompt(metrics) {
  return `You are a clinical facial analyst. A 68-point landmark system computed structural measurements from this photo. The data is reference — use YOUR EYES.

COMPUTED DATA (reference only):
${JSON.stringify(metrics, null, 2)}

RESPOND WITH ONLY VALID JSON. No markdown, no backticks.

{
  "attractiveness_percentile": 85,
  "percentile_reasoning": "One sentence: why this percentile.",

  "presentation_percentiles": {
    "skin_clarity": { "percentile": 70, "note": "One sentence" },
    "coloring_contrast": { "percentile": 60, "note": "One sentence" },
    "hair": { "percentile": 75, "note": "One sentence" },
    "expression_quality": { "percentile": 50, "note": "One sentence" },
    "grooming": { "percentile": 70, "note": "One sentence" },
    "photo_quality": { "percentile": 60, "note": "One sentence" }
  },

  "harmony": {
    "adjustment": 0.3,
    "note": "One sentence. Range: -1.0 to +1.0."
  },

  "personality_read": "3-4 sentences. How do people instinctively react to this face? Professional, social, dating contexts.",

  "archetype": "2-4 word label",
  "opening": "One razor-sharp sentence about this face's architecture",
  "first_impression": "Exactly 6 words",

  "best_angle": { "side": "left", "note": "One sentence" },
  "best_features": [
    { "feature": "Name", "detail": "One sentence" }
  ],
  "leaks": [
    { "issue": "Name", "detail": "One sentence" }
  ],

  "today_moves": [
    { "action": "Same-day action", "bump_percentile": 3, "detail": "One sentence" }
  ],

  "regimen_moves": [
    { "action": "90-day commitment", "bump_percentile": 10, "detail": "One sentence" }
  ],

  "looksmaxxing": [
    {
      "technique": "Name",
      "target": "Problem addressed",
      "roi": "high",
      "detail": "2-3 sentences.",
      "evidence": "established"
    }
  ]
}

CRITICAL — ATTRACTIVENESS_PERCENTILE (1-99):
This is the MOST IMPORTANT field. Answer the question: "What percentage of the general adult population is this person MORE ATTRACTIVE than?"

This is NOT a 1-10 score. It's a percentile. Think about it concretely:
- If you lined up 100 random adults, where would this person rank?

CALIBRATION:
- 1-5: Among the least attractive. Severe structural issues, deformity
- 5-15: Well below average. Obvious flaws most people would notice
- 15-30: Below average. Multiple unflattering features
- 30-45: Slightly below average
- 45-55: Dead average. Unremarkable
- 55-70: Above average. Some attractive features
- 70-85: Clearly attractive. Most people would agree this person is good-looking
- 85-93: Very attractive. Turns heads. Top 10-15% of population
- 93-97: Exceptionally attractive. Model-tier. Top 3-7%
- 97-99: Strikingly beautiful. Top 1-3%. Elite bone structure, harmony, presence

CONCRETE EXAMPLES to anchor your judgment:
- An elderly person with age-related changes, round face, no notable bone structure = 15-25th percentile
- Average office worker, nothing special, nothing bad = 45-55th percentile  
- Someone with one or two good features but overall unremarkable = 55-65th percentile
- Clearly good-looking person who gets compliments = 75-85th percentile
- Someone who could model professionally, exceptional proportions = 93-97th percentile
- Perfect bone structure, ideal harmony, striking presence = 97-99th percentile

The percentile should MATCH COMMON SENSE. If most people would look at this photo and think "wow, extremely attractive" → 93+. If most would think "below average" → 25-35. Trust your eyes.

PRESENTATION PERCENTILES (1-99): Same logic — where does each factor rank vs general population?
1-10: Terrible. 10-30: Poor. 30-50: Below avg. 50: Average. 50-70: Above avg. 70-90: Good. 90-99: Exceptional.

TODAY MOVES (3-5): Achievable in hours. bump_percentile = how many percentile points this adds (1-8).
90-DAY REGIMEN (3-5): Long-term physiological changes ONLY. NOT grooming. bump_percentile = percentile points gained (5-25).
- Body fat reduction to 10-15% is the BIGGEST lever. If not lean, this is item #1 with bump of 15-25 percentile points. It transforms jawline, cheekbones, and overall facial harmony dramatically.
- Consistent retinol + SPF (5-10 points), posture correction (3-7), resistance training for neck/traps (3-7), dental alignment (3-5).
- Do NOT recommend low-impact generic health tips. Only things with VISIBLE facial impact.

LOOKSMAXXING (3-6): Match weaknesses to techniques. Only RELEVANT ones.

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
