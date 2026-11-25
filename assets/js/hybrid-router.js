/**
 * hybrid-router.js
 * Split-custody inference router powered by Firebase AI Logic (v12.14.0).
 * Stage 1: On-device Gemini Nano entity extraction & service classification.
 * Stage 2: Cloud Gemini sanitized architectural & academic scoping.
 */

import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-ai.js";
import { app } from "./firebase-init.js";

const ai = getAI(app, { backend: new GoogleAIBackend() });

// Stage 1A: Hybrid local-first model (Chrome Gemini Nano when ready, falls back to Flash-Lite)
const preferOnDeviceModel = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,
  inCloudParams: { model: "gemini-2.5-flash-lite" }
});

// Stage 1B: Strict air-gapped local model (throws if Gemini Nano is unavailable—zero cloud egress)
const strictOnDeviceModel = getGenerativeModel(ai, {
  mode: InferenceMode.ONLY_ON_DEVICE
});

// Stage 2: Cloud synthesis model for tokenized/sanitized payloads
const preferInCloudModel = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_IN_CLOUD,
  inCloudParams: { model: "gemini-2.5-flash" }
});

const ALLOWED_SERVICES = [
  "Project Solution",
  "Technical Report",
  "Research Assay",
  "Thesis Writing",
  "Assignments",
  "Math & Statistics",
  "Case Study",
  "Literature Review"
];

function parseNanoJson(rawOutput, fallbackText) {
  try {
    const cleaned = rawOutput
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const data = JSON.parse(cleaned);
    const matchedService = ALLOWED_SERVICES.find(
      (s) => s.toLowerCase() === String(data.serviceCategory || "").trim().toLowerCase()
    );
    return {
      serviceCategory: matchedService || "Project Solution",
      complexity: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(String(data.complexity).toUpperCase())
        ? String(data.complexity).toUpperCase()
        : "MEDIUM",
      summary: data.summary || fallbackText.slice(0, 140),
      sensitiveEntities: Array.isArray(data.sensitiveEntities) ? data.sensitiveEntities : [],
      deliverables: Array.isArray(data.deliverables) ? data.deliverables : []
    };
  } catch {
    return {
      serviceCategory: "Project Solution",
      complexity: "MEDIUM",
      summary: rawOutput.slice(0, 180) || fallbackText.slice(0, 140),
      sensitiveEntities: [],
      deliverables: ["Requirements Analysis", "Core Implementation", "Final Verification"]
    };
  }
}

export async function runLocalTriage(rawText, { airGapped = false } = {}) {
  const t0 = performance.now();
  const activeModel = airGapped ? strictOnDeviceModel : preferOnDeviceModel;

  const prompt = `Analyze this technical or academic project brief for MA Services.
Return ONLY raw valid JSON (no markdown) with exact keys:
{
  "serviceCategory": "Project Solution | Technical Report | Research Assay | Thesis Writing | Assignments | Math & Statistics | Case Study | Literature Review",
  "complexity": "LOW | MEDIUM | HIGH | CRITICAL",
  "summary": "1 concise sentence summarizing the core requirement without repeating secrets",
  "sensitiveEntities": ["exact substring of any person name, university/company name, domain, server hostname, or internal project code found in the text"],
  "deliverables": ["short deliverable 1", "short deliverable 2", "short deliverable 3"]
}

Brief:
${rawText}`;

  const result = await activeModel.generateContent(prompt);
  const latencyMs = Math.round(performance.now() - t0);
  const rawResponse = result.response.text();
  const inferenceSource = result.response.inferenceSource || (airGapped ? "ON_DEVICE" : "UNKNOWN");

  return {
    parsed: parseNanoJson(rawResponse, rawText),
    inferenceSource,
    latencyMs,
    modeUsed: airGapped ? "ONLY_ON_DEVICE" : "PREFER_ON_DEVICE"
  };
}

export async function runCloudProposal(maskedText, triageMeta) {
  const t0 = performance.now();

  const prompt = `You are a Principal Technical & Academic Architect at MA Services.
Matched Service: ${triageMeta.serviceCategory}
Complexity Tier: ${triageMeta.complexity}

Generate a concise, structured execution plan for the sanitized brief below.
CRITICAL RULE: Preserve every redacted placeholder token (such as [EMAIL_1], [IP_ADDR_1], [ENTITY_1], [SECRET_1]) verbatim in your response. Never alter or guess their values.

Format with 3 concise sections:
1. Recommended Architecture & Methodology
2. Phased Implementation Milestones
3. Quality, Security & Delivery Checklist

Sanitized Brief:
${maskedText}`;

  const result = await preferInCloudModel.generateContent(prompt);
  const latencyMs = Math.round(performance.now() - t0);
  const inferenceSource = result.response.inferenceSource || "IN_CLOUD";

  return {
    proposalText: result.response.text(),
    inferenceSource,
    latencyMs,
    modeUsed: "PREFER_IN_CLOUD"
  };
}