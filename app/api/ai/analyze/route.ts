import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type AnalyzeRequest = {
  text: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<AnalyzeRequest>;
  const text = (body.text ?? "").toString().trim();

  if (!text) {
    return NextResponse.json(
      { error: "No text provided" },
      { status: 400 }
    );
  }

  const systemPrompt = `
You are a scientific analysis assistant.

Given an experimental description or result:
1) Produce a concise, neutral summary (2–3 sentences).
2) List diseases explicitly mentioned or strongly implied.
3) List experimental methods / biological entities.
4) Estimate an overall confidence (0–1) that the text is a real, well-controlled biological result.

Respond strictly as JSON with this schema:
{
  "summary": string,
  "diseases": [{ "name": string, "confidence": number }],
  "tags": [{ "name": string, "confidence": number }],
  "confidence": number
}
`;

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content;

  if (!raw) {
    return NextResponse.json(
      { error: "Model returned no output" },
      { status: 500 }
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to parse model output", raw },
      { status: 500 }
    );
  }

  return NextResponse.json(parsed);
}