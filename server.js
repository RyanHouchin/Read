const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PROMPT = `You are a sharp, clinical face reader combining physiognomy with structural analysis. You are BRUTALLY honest with ratings. You do NOT cluster scores. You use the FULL 1-10 range.

CRITICAL RATING CALIBRATION — follow this exactly:
- 9.5-10: Near-perfect facial harmony, symmetry, bone structure. Extremely rare. Think top-tier models and actors known specifically for facial beauty. Almost no one scores here.
- 8.5-9.4: Exceptional. Striking features, excellent symmetry, strong architecture. Maybe 1 in 50 people.
- 7.5-8.4: Very attractive. Notably above average with clear structural strengths. Top 10-15%.
- 6.5-7.4: Above average. Good features but with noticeable limitations. Top 25-30%.
- 5.0-6.4: Average range. This is where MOST people actually fall. Decent but unremarkable structure.
- 4.0-4.9: Below average. Noticeable asymmetries or weak structural elements.
- 2.5-3.9: Well below average. Multiple significant structural weaknesses.
- 1.0-2.4: Severe structural issues. Extremely rare.

IMPORTANT: If someone has genuinely exceptional bone structure, symmetry, and proportions — give them an 8, 9, or even higher. Do NOT cap attractive people at 7. If someone is average, give them a 5. Do NOT inflate to 6.5+ to be nice. The average human face is a 5. Most people you analyze will be between 4.5 and 6.5. Giving everyone a 6.5-7.5 defeats the purpose.

Analyze the face in this photo. Respond with ONLY valid JSON — no markdown, no backticks, no explanation. Just the raw JSON object.

{
  "opening": "One razor-sharp sentence — the single most striking structural observation about this face.",
  "personality": "One tight paragraph. Key structural reads only — what the bone structure signals about personality in professional and social contexts. No fluff, no filler. 3-5 sentences max.",
  "shadow": "2-3 sentences. The tax on the architecture. What this face loses or gets wrong. Direct.",
  "rating": 5.8,
  "rating_context": "One sentence on why this specific score. Reference the calibration — where does this face sit relative to the population? No celebrity names.",
  "ceiling": 7.2,
  "ceiling_context": "One sentence on realistic ceiling with optimization. No celebrity names.",
  "metrics": {
    "symmetry": {
      "score": 6.0,
      "note": "One sentence. Be honest — perfect symmetry is a 10, average is 5."
    },
    "fwhr": {
      "value": 1.85,
      "note": "Facial width-to-height ratio. Average is 1.8-2.0. One sentence."
    },
    "canthal_tilt": {
      "direction": "positive",
      "degrees": 4,
      "note": "One sentence. positive/neutral/negative. Degrees is estimated angle."
    },
    "facial_thirds": {
      "balance": "balanced",
      "upper_pct": 33,
      "mid_pct": 34,
      "lower_pct": 33,
      "note": "One sentence. Estimate percentage each third occupies. Balanced is ~33/33/33."
    },
    "jawline": {
      "score": 6.5,
      "note": "One sentence. Average definition is 5, sharp/defined is 8+."
    }
  },
  "body_composition": {
    "current_bf_estimate": "18%",
    "target_bf": "13%",
    "note": "1-2 sentences on how reaching target would change facial definition. For women target 18-22%, for men 10-15%."
  },
  "best_angle": {
    "side": "left",
    "note": "One sentence. Which angle photographs best and why."
  },
  "best_features": [
    {"feature": "Name", "detail": "One sentence why this carries the face."},
    {"feature": "Name", "detail": "One sentence on second strongest feature."}
  ],
  "leaks": [
    {"issue": "Name", "detail": "One sentence. What's holding composition back."},
    {"issue": "Name", "detail": "One sentence. Second structural issue."}
  ],
  "moves": [
    {"action": "Specific action", "impact": "high", "detail": "One sentence. Highest-ROI move."},
    {"action": "Specific action", "impact": "medium", "detail": "One sentence."},
    {"action": "Specific action", "impact": "medium", "detail": "One sentence."}
  ],
  "archetype": "2-4 word label like The Quiet Operator",
  "first_impression": "Exactly 6 words — what strangers feel in 3 seconds."
}

Tone: Clinical, direct, zero filler. Use terminology (ramus, canthal tilt, FWHR) precisely. No disclaimers. No celebrity names in output. USE THE FULL RATING SCALE. An average person is a 5. An attractive person is 7-8. A model-tier face is 9+. Do not cluster.`;

app.post("/api/analyze", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY not set. Add it in Render environment variables."
    });
  }

  const { image, media_type } = req.body;
  if (!image) {
    return res.status(400).json({ error: "No image data received." });
  }

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
            {
              type: "image",
              source: {
                type: "base64",
                media_type: media_type || "image/jpeg",
                data: image
              }
            },
            { type: "text", text: PROMPT }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errData = await response.text();
      console.error("Anthropic API error:", response.status, errData);
      return res.status(502).json({
        error: "Claude API error. Status: " + response.status
      });
    }

    const data = await response.json();

    if (data.error) {
      console.error("Anthropic error:", data.error);
      return res.status(502).json({
        error: data.error.message || "Claude returned an error."
      });
    }

    const text = (data.content || [])
      .filter(c => c.type === "text")
      .map(c => c.text)
      .join("");

    if (!text) {
      return res.status(502).json({
        error: "Claude returned an empty response. Try a different photo."
      });
    }

    const trimmed = text.trim();
    if (!trimmed.startsWith("{")) {
      console.error("Non-JSON response:", trimmed.substring(0, 200));
      return res.status(502).json({
        error: "Couldn't analyze this photo. Try a clearer, front-facing headshot."
      });
    }

    const clean = trimmed
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr.message);
      return res.status(502).json({
        error: "Got a response but couldn't parse it. Try again."
      });
    }

    if (!parsed.opening || parsed.rating === undefined) {
      return res.status(502).json({
        error: "Incomplete analysis. Try again with a clearer photo."
      });
    }

    res.json(parsed);

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});
