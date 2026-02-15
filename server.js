const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

function buildPrompt(metrics) {
  return `You are a clinical face analyst. A facial landmark detection system has already computed structural measurements from this photo. Those scores are final — you do NOT reassign them.

YOUR JOB: Assess the VISUAL and PRESENTATIONAL qualities that landmark geometry cannot measure, interpret the personality profile, and provide optimization recommendations.

COMPUTED DATA FROM LANDMARK DETECTION:
${JSON.stringify(metrics, null, 2)}

Respond with ONLY valid JSON. No markdown, no backticks, no explanation.

{
  "presentation": {
    "skin_clarity": { "score": 7, "note": "One sentence — skin texture, blemishes, evenness, pores" },
    "coloring_contrast": { "score": 6, "note": "One sentence — lip-to-skin, eye-to-skin, brow-to-skin contrast strength" },
    "hair": { "score": 7, "note": "One sentence — hair quality, style, how it frames the face" },
    "expression_quality": { "score": 5, "note": "One sentence — how the current expression affects attractiveness" },
    "grooming": { "score": 7, "note": "One sentence — facial hair, brows, overall upkeep" },
    "photo_quality": { "score": 6, "note": "One sentence — lighting, angle, image clarity, background" }
  },
  "harmony": {
    "adjustment": 0.3,
    "note": "One sentence — do features work together beyond what geometry captures? Range: -1.0 to +1.0 only."
  },
  "personality_read": "2-3 sentences. Interpret what people instinctively feel seeing this face. Reference the computed trustworthiness, dominance, warmth scores. How does this face play in professional vs social vs dating contexts? Be specific.",
  "archetype": "2-4 word label like The Quiet Authority or The Warm Strategist",
  "opening": "One razor-sharp sentence — the single most striking observation about this face's architecture",
  "first_impression": "Exactly 6 words — what strangers register in 3 seconds",
  "best_angle": { "side": "left", "note": "One sentence explaining why" },
  "best_features": [
    { "feature": "Feature Name", "detail": "One sentence — reference actual measurements where relevant" },
    { "feature": "Feature Name", "detail": "One sentence" }
  ],
  "leaks": [
    { "issue": "Issue Name", "detail": "One sentence — reference measurements where relevant" },
    { "issue": "Issue Name", "detail": "One sentence" }
  ],
  "today_moves": [
    { "action": "Specific action doable today", "bump": 0.2, "detail": "One sentence — what it changes" },
    { "action": "Action 2", "bump": 0.15, "detail": "One sentence" },
    { "action": "Action 3", "bump": 0.1, "detail": "One sentence" }
  ],
  "regimen_moves": [
    { "action": "Specific 90-day commitment", "bump": 0.5, "detail": "One sentence — what changes over time" },
    { "action": "Action 2", "bump": 0.3, "detail": "One sentence" },
    { "action": "Action 3", "bump": 0.2, "detail": "One sentence" }
  ]
}

CRITICAL RULES:
- Presentation scores: USE THE FULL 1-10 RANGE. Disheveled/bad lighting = 2-3. Well-styled/professional = 8-9. Average = 5. DO NOT cluster at 6-7.
- Harmony adjustment MUST be between -1.0 and +1.0. Most people: -0.3 to +0.3. Reserve extremes.
- Be BRUTALLY HONEST. Bad skin gets 3. Bad grooming gets 2. Great presentation gets 9.
- today_moves: 3-5 actions. Each bump 0.05-0.4. Only relevant suggestions.
- regimen_moves: 3-5 actions. Each bump 0.1-0.8. Include body fat if not already lean (men target 10-15%, women 18-22%).
- No celebrity names. No disclaimers. Clinical and direct.
- All notes ONE sentence max. Personality read 2-3 sentences max.`;
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
