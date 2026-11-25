/**
 * hybrid-ui.js
 * Interactive controller for MA Services Split-Custody Hybrid AI Studio.
 * Binds Stage 1 (On-Device Nano Redaction), Stage 2 (Cloud Sanitized Synthesis),
 * Local Re-Hydration, Air-Gapped Offline Mode, Firestore Audit Logs, and Request Modal Bridge.
 */

import { maskPayload, rehydratePayload } from "./privacy-vault.js";
import { runLocalTriage, runCloudProposal } from "./hybrid-router.js";
import { saveHybridBrief, fetchHybridHistory } from "./hybrid-store.js";
import { ensureHybridUser } from "./firebase-init.js";

const DEMO_PRESETS = {
  project: `Client: Tariq Al-Mansour (tariq.mansour@al-andalus-systems.jo, +962 7 9555 0142)
Course / Track: Senior Software Engineering Capstone — Staging Host: 192.168.14.88 (api.andalus-lab.local)
Test API Key in .env: AIzaSyD9x8K2mLpQ7vR4wN1zT6yB3cF8jH0kL9m
Requirement: Build a decoupled JAMstack web platform with Firestore real-time analytics, role-based access rules, and automated PDF report generation before final defense.`,

  technical: `Researcher: Elena Rostova (e.rostova@nordic-metrics.eu)
Dataset Endpoint: https://staging-data.nordic-metrics.eu/v2/telemetry
Staging Bearer Token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9_lab_test_99182
Requirement: Prepare a full Technical Report & statistical regression analysis (SPSS / Python) evaluating latency anomalies across 15,000 sensor records with publication-grade charts.`,

  security: `Escalation Lead: Zaid Haddad (z.haddad@kilo-one-ops.com, +962 7 8812 3390)
Target Gateway: amman-edge-gw-04 (203.0.113.42) — Diagnostic Key: sk-live9876543210abcdef1234567890abcdef
Requirement: Complete a Systems Engineering Project Solution diagnosing WebSocket packet drops on subnet 10.24.8.0/24, including firewall hardening documentation and automated health-check scripts.`
};

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatSourceBadge(source) {
  const normalized = String(source || "UNKNOWN").toUpperCase();
  if (normalized === "ON_DEVICE") {
    return `<span class="ma-hai-badge ma-hai-badge--local"><i class="fas fa-microchip"></i> ON_DEVICE (Gemini Nano)</span>`;
  }
  if (normalized === "IN_CLOUD") {
    return `<span class="ma-hai-badge ma-hai-badge--cloud"><i class="fas fa-cloud"></i> IN_CLOUD (Gemini 2.5)</span>`;
  }
  if (normalized === "SKIPPED_AIRGAPPED") {
    return `<span class="ma-hai-badge ma-hai-badge--airgap"><i class="fas fa-shield-alt"></i> SKIPPED (Air-Gapped)</span>`;
  }
  return `<span class="ma-hai-badge ma-hai-badge--neutral">${escapeHtml(normalized)}</span>`;
}

async function detectLocalNanoCapability() {
  try {
    if (typeof LanguageModel !== "undefined" && typeof LanguageModel.availability === "function") {
      return await LanguageModel.availability();
    }
    if (self.ai?.languageModel?.capabilities) {
      const caps = await self.ai.languageModel.capabilities();
      return caps?.available || "unavailable";
    }
  } catch {
    // Firebase AI Logic handles runtime fallback automatically
  }
  return "auto-fallback";
}

function initStudioWorkspace(root) {
  const inputEl = root.querySelector("#ma-hai-input");
  const airGapToggle = root.querySelector("#ma-hai-airgap");
  const runBtn = root.querySelector("#ma-hai-run-btn");
  const clearBtn = root.querySelector("#ma-hai-clear-btn");
  const applyModalBtn = root.querySelector("#ma-hai-apply-modal-btn");
  const statusBanner = root.querySelector("#ma-hai-status");
  const nanoCapBadge = root.querySelector("#ma-hai-nano-cap");
  const netBadge = root.querySelector("#ma-hai-net-status");

  const s1SourceEl = root.querySelector("#ma-hai-s1-source");
  const s1LatencyEl = root.querySelector("#ma-hai-s1-latency");
  const s1MetaEl = root.querySelector("#ma-hai-s1-meta");
  const maskedOutputEl = root.querySelector("#ma-hai-masked");
  const vaultTableEl = root.querySelector("#ma-hai-vault-list");

  const s2SourceEl = root.querySelector("#ma-hai-s2-source");
  const s2LatencyEl = root.querySelector("#ma-hai-s2-latency");
  const finalOutputEl = root.querySelector("#ma-hai-final-output");
  const rehydrateToggle = root.querySelector("#ma-hai-rehydrate-toggle");
  const historyListEl = root.querySelector("#ma-hai-mini-history");

  let lastSanitizedProposal = "";
  let lastRehydratedProposal = "";
  let lastMatchedService = "Project Solution";

  const syncNetworkHud = () => {
    const online = navigator.onLine;
    if (netBadge) {
      netBadge.innerHTML = online
        ? `<span class="ma-hai-dot ma-hai-dot--online"></span> ONLINE (Hybrid Ready)`
        : `<span class="ma-hai-dot ma-hai-dot--offline"></span> OFFLINE (Local Nano + Cache)`;
    }
    if (!online && airGapToggle && !airGapToggle.checked) {
      airGapToggle.checked = true;
    }
  };
  window.addEventListener("online", syncNetworkHud);
  window.addEventListener("offline", syncNetworkHud);
  syncNetworkHud();

  detectLocalNanoCapability().then((cap) => {
    if (!nanoCapBadge) return;
    if (cap === "available" || cap === "readily") {
      nanoCapBadge.innerHTML = `<span class="ma-hai-badge ma-hai-badge--local">Gemini Nano: READY</span>`;
    } else if (cap === "downloadable" || cap === "downloading" || cap === "after-download") {
      nanoCapBadge.innerHTML = `<span class="ma-hai-badge ma-hai-badge--warn">Gemini Nano: ${escapeHtml(cap.toUpperCase())}</span>`;
    } else {
      nanoCapBadge.innerHTML = `<span class="ma-hai-badge ma-hai-badge--cloud">Hybrid Mode: AUTO-FALLBACK</span>`;
    }
  });

  root.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-preset");
      if (DEMO_PRESETS[key] && inputEl) {
        inputEl.value = DEMO_PRESETS[key];
        setStatus(`Loaded "${key}" sample brief containing simulated PII & secrets. Ready to execute.`, "info");
      }
    });
  });

  if (rehydrateToggle && finalOutputEl) {
    rehydrateToggle.addEventListener("change", () => {
      if (!lastSanitizedProposal) return;
      finalOutputEl.textContent = rehydrateToggle.checked
        ? lastRehydratedProposal
        : lastSanitizedProposal;
    });
  }

  // Bridge generated scope directly into services.html's #req-modal
  if (applyModalBtn) {
    applyModalBtn.addEventListener("click", () => {
      const activeScope =
        (rehydrateToggle && !rehydrateToggle.checked ? lastSanitizedProposal : lastRehydratedProposal) ||
        finalOutputEl?.textContent ||
        "";
      if (!activeScope || activeScope.startsWith("Awaiting")) {
        setStatus("Run the Hybrid AI pipeline first to generate a technical scope.", "error");
        return;
      }
      document.querySelectorAll('#req-form textarea[name="details"]').forEach((ta) => {
        ta.value = activeScope;
      });
      if (typeof window.openModal === "function") {
        window.openModal(lastMatchedService);
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (inputEl) inputEl.value = "";
      if (maskedOutputEl) maskedOutputEl.textContent = "Awaiting Stage 1 local redaction...";
      if (vaultTableEl) vaultTableEl.innerHTML = `<div class="ma-hai-empty">No tokens vaulted yet.</div>`;
      if (finalOutputEl) finalOutputEl.textContent = "Awaiting Stage 2 cloud synthesis...";
      if (s1MetaEl) s1MetaEl.innerHTML = "";
      lastSanitizedProposal = "";
      lastRehydratedProposal = "";
      setStatus("Workspace cleared.", "info");
    });
  }

  function setStatus(msg, type = "info") {
    if (!statusBanner) return;
    statusBanner.className = `ma-hai-status ma-hai-status--${type}`;
    statusBanner.textContent = msg;
  }

  async function refreshMiniHistory() {
    if (!historyListEl) return;
    try {
      const runs = await fetchHybridHistory(4);
      if (!runs.length) {
        historyListEl.innerHTML = `<div class="ma-hai-empty">No persisted hybrid runs yet. Execute a brief above.</div>`;
        return;
      }
      historyListEl.innerHTML = runs
        .map(
          (r) => `
          <div class="ma-hai-history-item">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
              <strong style="color:#fff;">${escapeHtml(r.serviceCategory)}</strong>
              <span class="ma-hai-pill">${escapeHtml(r.complexity)}</span>
              <span class="ma-hai-pill ma-hai-pill--redacted">${r.redactedCount || 0} Masked</span>
            </div>
            <div class="ma-hai-history-badges">
              <span>S1: ${formatSourceBadge(r.stage1Source)} (${r.stage1LatencyMs}ms)</span>
              <span>S2: ${formatSourceBadge(r.stage2Source)} (${r.stage2LatencyMs}ms)</span>
            </div>
          </div>`
        )
        .join("");
    } catch (err) {
      historyListEl.innerHTML = `<div class="ma-hai-empty">Audit telemetry ready once Firestore rules are deployed (${escapeHtml(err.message)}).</div>`;
    }
  }

  if (runBtn) {
    runBtn.addEventListener("click", async () => {
      const rawText = inputEl?.value.trim() || "";
      if (rawText.length < 15) {
        setStatus("Enter at least 15 characters of raw project brief or select a Demo Preset.", "error");
        return;
      }

      const airGapped = Boolean(airGapToggle?.checked) || !navigator.onLine;
      runBtn.disabled = true;
      runBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Running Hybrid AI...`;

      try {
        setStatus("Stage 1/3: Running on-device classification & PII entity detection...", "working");
        const stage1 = await runLocalTriage(rawText, { airGapped });
        const { maskedText, vault, stats } = maskPayload(rawText, stage1.parsed.sensitiveEntities);
        lastMatchedService = stage1.parsed.serviceCategory;

        if (s1SourceEl) s1SourceEl.innerHTML = formatSourceBadge(stage1.inferenceSource);
        if (s1LatencyEl) s1LatencyEl.textContent = `${stage1.latencyMs} ms`;
        if (maskedOutputEl) maskedOutputEl.textContent = maskedText;

        if (s1MetaEl) {
          s1MetaEl.innerHTML = `
            <span class="ma-hai-pill">${escapeHtml(stage1.parsed.serviceCategory)}</span>
            <span class="ma-hai-pill">Tier: ${escapeHtml(stage1.parsed.complexity)}</span>
            <span class="ma-hai-pill ma-hai-pill--redacted">${stats.totalRedacted} PII Stripped</span>
          `;
        }

        if (vaultTableEl) {
          if (vault.size === 0) {
            vaultTableEl.innerHTML = `<div class="ma-hai-empty">No sensitive PII detected in brief.</div>`;
          } else {
            const rows = [];
            for (const [token, info] of vault.entries()) {
              rows.push(`
                <div class="ma-hai-vault-row">
                  <code class="ma-hai-token">${escapeHtml(token)}</code>
                  <span class="ma-hai-vault-cat">${escapeHtml(info.category)}</span>
                  <span class="ma-hai-vault-val" title="Kept in local browser RAM only">${escapeHtml(info.original)}</span>
                </div>
              `);
            }
            vaultTableEl.innerHTML = rows.join("");
          }
        }

        let stage2Source = "SKIPPED_AIRGAPPED";
        let stage2LatencyMs = 0;

        if (airGapped) {
          lastSanitizedProposal = `[AIR-GAPPED LOCAL TRIAGE ONLY — ZERO CLOUD REQUESTS SENT]\n\nMatched Service: ${stage1.parsed.serviceCategory}\nComplexity: ${stage1.parsed.complexity}\nSummary: ${stage1.parsed.summary}\n\nLocal Deliverables:\n${stage1.parsed.deliverables.map((d, i) => `${i + 1}. ${d}`).join("\n")}`;
          lastRehydratedProposal = lastSanitizedProposal;

          if (s2SourceEl) s2SourceEl.innerHTML = formatSourceBadge("SKIPPED_AIRGAPPED");
          if (s2LatencyEl) s2LatencyEl.textContent = "0 ms";
          if (finalOutputEl) finalOutputEl.textContent = lastSanitizedProposal;
        } else {
          setStatus("Stage 2/3: Sending sanitized [REDACTED_N] tokens to Cloud Gemini...", "working");
          const stage2 = await runCloudProposal(maskedText, stage1.parsed);
          stage2Source = stage2.inferenceSource;
          stage2LatencyMs = stage2.latencyMs;

          lastSanitizedProposal = stage2.proposalText;
          lastRehydratedProposal = rehydratePayload(stage2.proposalText, vault);

          if (s2SourceEl) s2SourceEl.innerHTML = formatSourceBadge(stage2Source);
          if (s2LatencyEl) s2LatencyEl.textContent = `${stage2LatencyMs} ms`;
          if (finalOutputEl) {
            finalOutputEl.textContent =
              rehydrateToggle && !rehydrateToggle.checked
                ? lastSanitizedProposal
                : lastRehydratedProposal;
          }
        }

        setStatus("Stage 3/3: Persisting sanitized audit telemetry to Firestore...", "working");
        await saveHybridBrief({
          serviceCategory: stage1.parsed.serviceCategory,
          complexity: stage1.parsed.complexity,
          maskedInput: maskedText,
          sanitizedProposal: lastSanitizedProposal,
          redactedCount: stats.totalRedacted,
          stage1Source: stage1.inferenceSource,
          stage1LatencyMs: stage1.latencyMs,
          stage2Source,
          stage2LatencyMs,
          airGapped
        });

        await refreshMiniHistory();
        setStatus(
          airGapped
            ? `Air-Gapped Local Execution complete (${stage1.latencyMs}ms). ${stats.totalRedacted} items redacted; 0 bytes sent to cloud.`
            : `Split-Custody Hybrid execution complete! ${stats.totalRedacted} sensitive items protected locally before cloud synthesis.`,
          "success"
        );
      } catch (err) {
        console.error("[HybridAI] Pipeline error:", err);
        setStatus(`Execution Error: ${err.message}`, "error");
      } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = `<i class="fas fa-bolt"></i> Run Hybrid AI`;
      }
    });
  }

  ensureHybridUser()
    .then(() => refreshMiniHistory())
    .catch((err) => console.warn("[HybridAI] Auth init pending:", err.message));
}

async function initDashboardAuditPanel(panel) {
  const tbody = panel.querySelector("#ma-hai-audit-tbody");
  const refreshBtn = panel.querySelector("#ma-hai-audit-refresh");
  const statsSummary = panel.querySelector("#ma-hai-audit-kpis");

  async function renderTable() {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6">Loading Firestore hybrid telemetry...</td></tr>`;
    try {
      const runs = await fetchHybridHistory(15);
      if (!runs.length) {
        tbody.innerHTML = `<tr><td colspan="6">No hybrid AI runs recorded yet. Test the studio on services.html.</td></tr>`;
        return;
      }

      const totalRedacted = runs.reduce((acc, r) => acc + (r.redactedCount || 0), 0);
      const localCount = runs.filter((r) => r.stage1Source === "ON_DEVICE").length;

      if (statsSummary) {
        statsSummary.innerHTML = `
          <span>Total Audits: <strong>${runs.length}</strong></span>
          <span>On-Device Stage 1 Runs: <strong>${localCount}/${runs.length}</strong></span>
          <span>Total PII Tokens Protected: <strong>${totalRedacted}</strong></span>
        `;
      }

      tbody.innerHTML = runs
        .map(
          (r) => `
          <tr>
            <td><strong>${escapeHtml(r.serviceCategory)}</strong><br><small>${escapeHtml(r.complexity)}</small></td>
            <td>${formatSourceBadge(r.stage1Source)} <small>(${r.stage1LatencyMs}ms)</small></td>
            <td>${formatSourceBadge(r.stage2Source)} <small>(${r.stage2LatencyMs}ms)</small></td>
            <td><span class="ma-hai-pill ma-hai-pill--redacted">${r.redactedCount || 0}</span></td>
            <td><code>${escapeHtml((r.maskedInput || "").slice(0, 72))}...</code></td>
            <td>${r.airGapped ? "Air-Gapped" : "Hybrid"}</td>
          </tr>`
        )
        .join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6">Error loading audit logs: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  if (refreshBtn) refreshBtn.addEventListener("click", renderTable);
  await renderTable();
}

document.addEventListener("DOMContentLoaded", () => {
  const studioEl = document.getElementById("ma-hybrid-studio");
  if (studioEl) initStudioWorkspace(studioEl);

  const auditPanelEl = document.getElementById("ma-hybrid-audit-panel");
  if (auditPanelEl) initDashboardAuditPanel(auditPanelEl);
});