const fs = require('fs');

async function test() {
  const env = fs.readFileSync('.env.local', 'utf-8');
  const key = env.split('=')[1].trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;

  const message = "I want to become a Software Engineer. I know C++, Java, HTML and CSS. Make a roadmap";

  const extractPrompt = `You are an expert AI Learning Architect.
Extract normalized learner profile facts from user input.
Learner Message: "${message}"
Existing Facts: []

Return a valid JSON object strictly matching this schema:
{
  "facts": [
    {
      "dimension": "string (e.g. declared_goal, known_skills, primary_language, target_domain, etc.)",
      "value": "any",
      "rawValue": "string",
      "evidence": "exact string snippet",
      "reliability": 0.95,
      "impact": "high"
    }
  ],
  "detectedGoal": "string or null",
  "targetRoleHint": "string or null",
  "unknownDimensions": ["string"],
  "contradictions": [],
  "clarificationNeeded": true
}`;

  console.log("Testing Extraction...");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: extractPrompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
    })
  });

  const extractJson = await res.json();
  const text = extractJson.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log("Extract Response:", text);

  console.log("\nTesting Question Proposal...");
  const qPrompt = `You are an expert AI Learning Coach.
The learner declared: "${message}"
Based on this goal and their known skills (C++, Java, HTML, CSS), propose dynamic, highly relevant clarification questions to determine their exact focus area (e.g. Full-Stack Web Development, Systems/C++ Engineering, Enterprise Java, Embedded/Desktop, etc.).

Return a JSON object conforming to:
{
  "candidates": [
    {
      "dimension": "specialization_focus",
      "question": "Which software engineering specialization do you want to pursue with your C++, Java, and Web skills?",
      "answerType": "single_choice",
      "options": [
        "Full-Stack Web Development (Java/Node + HTML/CSS/React)",
        "Systems & Performance Software (C++ / Core OS)",
        "Enterprise Backend Architecture (Java & Cloud Services)",
        "Cross-Platform Application & Game Engineering (C++ / Desktop)"
      ],
      "why": "Your background spans both systems (C++) and web (HTML/CSS/Java). Specializing defines whether your roadmap focuses on browser full-stack or low-level systems.",
      "predictedAnswerBuckets": ["fullstack", "systems", "enterprise_java", "desktop"]
    }
  ]
}`;

  const qRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: qPrompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
    })
  });
  const qJson = await qRes.json();
  console.log("Question Proposal Response:", qJson.candidates?.[0]?.content?.parts?.[0]?.text);
}

test().catch(console.error);
