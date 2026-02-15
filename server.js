const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

function buildPrompt(metrics) {
  return `You are a clinical facial analyst with expertise in physiognomy, facial proportion science, and looksmaxxing optimization. A 68-point facial landmark system computed structural measurements. However, landmark detection is imperfect and can be thrown off by photo angle, lighting, or expression. YOUR CRITICAL ROLE is to provide a COMMON SENSE adjustment to the structural score AND assess presentation, personality, and optimization.

COMPUTED DATA FROM LANDMARKS:
${JSON.stringify(metrics, null, 2)}

RESPOND WITH ONLY VALID JSON. No markdown, no backticks, no explanation.

{
  "structural_adjustment": 0.5,
  "structural_adjustment_note": "One sentence explaining why you're adjusting up or down.",

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

STRUCTURAL ADJUSTMENT (-2.5 to +2.5):
This is your MOST IMPORTANT field. Look at the photo with your own eyes and compare to the computed structural score (${metrics?.structural?.structural || 'unknown'}).
- If the person is CLEARLY very attractive but the structural score is too low → adjust UP significantly. A model-tier face should land at 8.5-9.5 structural after your adjustment.
- If the person is clearly unattractive but the structural score is too high → adjust DOWN.
- If the score seems approximately right → adjust near 0.
- USE COMMON SENSE. Do not let a gorgeous face sit at 6.0. Do not let a below-average face sit at 8.0.
- Most people: -0.5 to +0.5. Reserve ±1.5 to ±2.5 for obvious errors.
- Be BRAVE. If someone is a 9, make sure they end up near 9 after your adjustment.

PRESENTATION SCORES (1-10): USE THE FULL RANGE.
1-2: Terrible. 3-4: Below average. 5: Average. 6-7: Above average. 8-9: Excellent. 10: Flawless.
Do NOT cluster at 5-7. Bad grooming = 2-3. Great style = 8-9. Be HONEST.

TODAY MOVES (3-5): Achievable in hours. Grooming, styling, quick-fix skincare, expression, outfit. Bumps 0.05-0.4.

90-DAY REGIMEN (3-5): ONLY long-term physiological changes. Body recomposition, skincare protocols (retinol/SPF), posture correction, dental work, sleep optimization. NOT grooming — that's a today move. Bumps 0.1-0.8.

LOOKSMAXXING (3-6): Match THIS person's weaknesses to techniques:
- Body recomposition → soft jawline, undefined cheeks, facial bloat (ROI: high, evidence: established)
- Mewing → recessed maxilla, weak chin, flat midface, narrow palate (ROI: medium, evidence: moderate)
- Thumb pulling → maxilla expansion (ROI: low-medium, evidence: anecdotal)
- Mastic gum chewing → weak masseter, narrow jaw (ROI: medium, evidence: moderate)
- Gua sha → puffiness, undefined cheek hollows (ROI: medium, evidence: moderate)
- Chin tucking → forward head posture (ROI: medium, evidence: established)
- Neck training → narrow neck (ROI: medium, evidence: established)
- Minoxidil → patchy beard for jawline framing (ROI: medium, evidence: established)
- Dermarolling + retinol → skin texture (ROI: medium, evidence: established)
- Brow lamination → eye framing (ROI: low, evidence: established)
- Teeth whitening → smile impact (ROI: low, evidence: established)
Only include techniques RELEVANT to detected problems. Rate evidence honestly. If person scores 8+ structurally, recommend refinements only.

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
