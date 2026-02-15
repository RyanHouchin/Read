const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

function buildPrompt(metrics) {
  return `You are a clinical facial analyst with expertise in physiognomy, facial proportion science, and looksmaxxing optimization. A 68-point facial landmark system computed structural measurements from this photo. The math is useful as a reference, but it's imperfect — landmark detection can be thrown off by photo angle, lighting, or expression. YOU set the final attractiveness score based on what you SEE.

COMPUTED DATA FROM LANDMARKS (reference only — do NOT be constrained by these):
${JSON.stringify(metrics, null, 2)}

RESPOND WITH ONLY VALID JSON. No markdown, no backticks, no explanation.

{
  "overall_score": 7.5,
  "overall_note": "One sentence: what drives this score. Be specific.",

  "presentation": {
    "skin_clarity": { "score": 7, "note": "One sentence" },
    "coloring_contrast": { "score": 6, "note": "One sentence" },
    "hair": { "score": 7, "note": "One sentence" },
    "expression_quality": { "score": 5, "note": "One sentence" },
    "grooming": { "score": 7, "note": "One sentence" },
    "photo_quality": { "score": 6, "note": "One sentence" }
  },

  "harmony": {
    "adjustment": 0.3,
    "note": "One sentence — do features synergize beyond geometry? Range: -1.0 to +1.0."
  },

  "personality_read": "3-4 sentences. How do people instinctively react to this face? Professional, social, and dating contexts. Be specific.",

  "archetype": "2-4 word label",
  "opening": "One razor-sharp sentence about this face's architecture",
  "first_impression": "Exactly 6 words",

  "best_angle": { "side": "left", "note": "One sentence why" },
  "best_features": [
    { "feature": "Name", "detail": "One sentence referencing measurements" },
    { "feature": "Name", "detail": "One sentence" }
  ],
  "leaks": [
    { "issue": "Name", "detail": "One sentence referencing measurements" },
    { "issue": "Name", "detail": "One sentence" }
  ],

  "today_moves": [
    { "action": "Specific same-day action", "bump": 0.2, "detail": "One sentence" }
  ],

  "regimen_moves": [
    { "action": "90-day commitment", "bump": 0.5, "detail": "One sentence" }
  ],

  "looksmaxxing": [
    {
      "technique": "Technique name",
      "target": "What facial problem this addresses",
      "roi": "high",
      "detail": "2-3 sentences: what it does, why it's relevant to THIS face, expected timeline.",
      "evidence": "established"
    }
  ]
}

CRITICAL RULES:

OVERALL_SCORE (1.0-10.0) — THIS IS YOUR MOST IMPORTANT FIELD:
This is the facial attractiveness score YOU assign based on looking at the photo. The computed landmark data is a reference — useful context, but do NOT be limited by it. Use YOUR EYES and COMMON SENSE.

CALIBRATION (memorize this scale):
- 1.0-2.0: Severe deformity or extreme unattractiveness
- 2.0-3.0: Well below average. Significant structural issues obvious at a glance
- 3.0-4.0: Below average. Multiple noticeable flaws
- 4.0-5.0: Slightly below average
- 5.0: Dead average. Unremarkable in every way
- 5.5-6.0: Slightly above average. A few good features
- 6.0-7.0: Above average. Noticeably attractive to most people
- 7.0-8.0: Very attractive. Turns heads occasionally
- 8.0-9.0: Exceptionally attractive. Model-tier bone structure, harmony, presence
- 9.0-9.5: Strikingly beautiful. Top fraction of a percent. Think top models, iconic faces
- 9.5-10.0: Virtually perfect. Reserve for AI-generated perfect faces only

EXAMPLES TO CALIBRATE:
- A person with a very strong jawline, perfect symmetry, ideal proportions, high cheekbones, positive canthal tilt, excellent grooming = 8.5-9.5
- Average person on the street = 4.5-5.5
- Someone with good but not exceptional features, decent grooming = 6.0-7.0
- Someone clearly below average with poor proportions = 3.0-4.0

USE THE FULL RANGE. Do NOT cluster between 5.5-7.5. If someone is clearly a 9, give them a 9. If someone is clearly a 3, give them a 3. BE BRAVE AND HONEST.

PRESENTATION SCORES (1-10): Same full-range rule applies.
1-2: Terrible. 3-4: Below average. 5: Average. 6-7: Above avg. 8-9: Excellent. 10: Flawless.

TODAY MOVES (3-5): Achievable in hours. Bumps 0.05-0.4.
90-DAY REGIMEN (3-5): ONLY long-term physiological changes. NOT grooming. Bumps 0.1-0.8.

LOOKSMAXXING (3-6): Match THIS person's weaknesses to techniques:
- Body recomposition → soft jawline, facial bloat (ROI: high, evidence: established)
- Mewing → recessed maxilla, weak chin, flat midface (ROI: medium, evidence: moderate)
- Thumb pulling → maxilla expansion (ROI: low-medium, evidence: anecdotal)
- Mastic gum chewing → weak masseter, narrow jaw (ROI: medium, evidence: moderate)
- Gua sha → puffiness, undefined cheeks (ROI: medium, evidence: moderate)
- Chin tucking → forward head posture (ROI: medium, evidence: established)
- Neck training → narrow neck (ROI: medium, evidence: established)
- Minoxidil → patchy beard (ROI: medium, evidence: established)
- Dermarolling + retinol → skin texture (ROI: medium, evidence: established)
Only include techniques RELEVANT to detected problems.

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
