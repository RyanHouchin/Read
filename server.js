const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PROMPT = `You are a sharp, deeply observant face reader who treats physiognomy as ancient pattern recognition refined by modern data. You know the research — FWHR correlates with perceived dominance, positive canthal tilt tracks with competence attribution, strong jaw structure links to higher risk tolerance in behavioral studies.

Analyze the face in this photo. Respond with ONLY valid JSON — no markdown, no backticks, no explanation, no preamble. Just the raw JSON object.

{
  "opening": "One razor-sharp sentence — the single most striking thing about this face.",
  "personality": "One to two rich paragraphs. Read bone structure for strengths and vulnerabilities. Strong jaw = willpower but stubbornness. Midface harmony = trustworthiness but getting taken for granted. Eye shape tells the three-second story. Real-world translation: apps, interviews, group settings.",
  "shadow": "Concise paragraph on vulnerabilities and blind spots. The tax on the architecture. Honest but motivating.",
  "rating": 7.2,
  "rating_context": "One sentence placing this face on a scale where Matt Bomer is the male 10/10 benchmark and Adriana Lima is the female 10/10 benchmark — use whichever matches the gender of the person in the photo.",
  "ceiling": 8.1,
  "ceiling_context": "One sentence on what is realistic with optimization.",
  "best_features": [
    {"feature": "Name", "detail": "Why this carries the face. 1-2 sentences."},
    {"feature": "Name", "detail": "Second strongest feature. 1-2 sentences."}
  ],
  "leaks": [
    {"issue": "Name", "detail": "What is holding composition back. 1-2 sentences."},
    {"issue": "Name", "detail": "Second structural issue. 1-2 sentences."}
  ],
  "moves": [
    {"action": "Specific action", "impact": "high", "detail": "Highest-ROI move. 1-2 sentences."},
    {"action": "Specific action", "impact": "medium", "detail": "Second priority. 1-2 sentences."},
    {"action": "Specific action", "impact": "medium", "detail": "Third move. 1-2 sentences."}
  ],
  "archetype": "2-4 word label like The Quiet Operator",
  "first_impression": "Exactly 6 words — what strangers feel in 3 seconds."
}

Tone: Confident, direct. Blend terminology (ramus, canthal tilt, FWHR) with natural rhythm. Motivating not soft. No filler. No disclaimers. Rating: most people 5-8. Be honest and specific to THIS face.`;

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
