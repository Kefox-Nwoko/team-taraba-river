# Portal Visits & Community Metrics Calculation Methodology

## 1. Overview
The **Portal Visits** metric displayed under **Community Impact** represents the verified, cumulative public and member engagements with the **Team Taraba River Community Portal**. To ensure absolute authenticity and eliminate any doubts regarding the statistical integrity, the system applies an industry-standard, session-deduplicated analytics model.

---

## 2. Mathematical & Algorithmic Specification

### A. 30-Minute Session Deduplication Gate (Anti-Spam & Debounce)
* When a visitor accesses the portal (via web, mobile, or desktop), the client checks the active browser session storage timestamp:
  $$\Delta t = t_{\text{current}} - t_{\text{last\_recorded}}$$
* **Condition:**
  * If $\Delta t < 30 \text{ minutes}$ and the session ID is identical:
    $$\text{Action: Maintain existing active session; do NOT increment.}$$
  * If $\Delta t \ge 30 \text{ minutes}$ or a new browser session is initiated:
    $$\text{Action: Register new authentic visit session.}$$
* **Purpose:** Refreshing the page (F5), navigating between tabs (Home, Media, Admin), or momentary disconnections will **never** artificially inflate the metric.

---

### B. Atomic Cloud Firestore Synchronization
* Once a new session passes the 30-minute deduplication threshold:
  1. An atomic increment operation is executed on Google Cloud Firestore:
     ```typescript
     await setDoc(doc(db, "system", "metrics"), {
       totalVisits: increment(1),
       lastVisitAt: serverTimestamp(),
       lastRecordedSession: Date.now()
     }, { merge: true });
     ```
  2. The server-authoritative counter is persisted in Firestore document `system/metrics`.
  3. Real-time snapshot listeners (`onSnapshot`) stream the verified integer to all active portal instances instantaneously.

---

### C. Privacy-First & Zero Tracking Overhead
* No personally identifiable browsing histories or invasive fingerprinting cookies are stored.
* Deduplication relies purely on localized session token storage and standard timestamp comparison.

---

## 3. Implementation Code References
* **Client-Side Real-Time Service:** [`src/services/firebaseService.ts`](../src/services/firebaseService.ts) (`recordSessionVisit`, `subscribeVisitMetrics`)
* **State Manager & Local Deduplication:** [`src/services/storage.ts`](../src/services/storage.ts) (`recordVisit`, `getTabSessionId`)
* **Backend API Route:** [`server.ts`](../server.ts) (`GET /api/system/visits`)
* **Live UI Component:** [`src/components/HeroBanner.tsx`](../src/components/HeroBanner.tsx)
* **Architecture Modal Section:** [`src/components/MicroservicesArchModal.tsx`](../src/components/MicroservicesArchModal.tsx) (Section 4)
