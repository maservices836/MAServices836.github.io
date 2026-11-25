/**
 * hybrid-store.js
 * Persists sanitized hybrid AI audit logs & latency telemetry to Firestore
 * under /artifacts/ma-services-80545/users/{uid}/hybrid_briefs.
 */

import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { db, ensureHybridUser } from "./firebase-init.js";

const ARTIFACT_ROOT = "artifacts/ma-services-80545";

export async function saveHybridBrief(record) {
  const user = await ensureHybridUser();
  const briefsRef = collection(db, ARTIFACT_ROOT, "users", user.uid, "hybrid_briefs");

  const payload = {
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    serviceCategory: record.serviceCategory || "General",
    complexity: record.complexity || "MEDIUM",
    maskedInput: record.maskedInput || "",
    sanitizedProposal: record.sanitizedProposal || "",
    redactedCount: Number(record.redactedCount || 0),
    stage1Source: record.stage1Source || "UNKNOWN",
    stage1LatencyMs: Number(record.stage1LatencyMs || 0),
    stage2Source: record.stage2Source || "SKIPPED_AIRGAPPED",
    stage2LatencyMs: Number(record.stage2LatencyMs || 0),
    airGapped: Boolean(record.airGapped),
    createdAt: serverTimestamp()
  };

  const docRef = await addDoc(briefsRef, payload);
  return { id: docRef.id, uid: user.uid };
}

export async function fetchHybridHistory(maxItems = 8) {
  const user = await ensureHybridUser();
  const briefsRef = collection(db, ARTIFACT_ROOT, "users", user.uid, "hybrid_briefs");
  const q = query(briefsRef, orderBy("createdAt", "desc"), limit(maxItems));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}