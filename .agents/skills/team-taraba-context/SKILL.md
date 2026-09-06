---
name: team-taraba-context
description: Comprehensive domain knowledge, group identity guidelines, and location field policies for Team Taraba River.
---

# Team Taraba River: Domain Knowledge & Policies

## Context
"Team Taraba River" is an official chapter fellowship group under **URIP (Usosans Resident in Port Harcourt)**, a recognized branch of **USOSA (Unity Schools Old Students Association)**.
- Members are alumni of Federal Unity Colleges across Nigeria who reside in and around Port Harcourt, Rivers State.
- Activities include health aerobics, health walks, bi-annual meetings, club nites, reunions, and professional networking.

## Absolute Identity & Location Rule
1. **Not a Geographic Location**: "Team Taraba River" is strictly a team name. It is NEVER a physical venue, town, river, or location.
2. **Blank Default Location**: In all event schemas, databases, and UI components, the `location` field for event folders MUST default to `""` (blank).
3. **Restricted Workflow**: Only user-initiated forms (creating a new folder or editing an existing folder) may modify or populate `location`. Automated sync jobs must never set default locations.
4. **No River Cleanup Narratives**: Do not frame the group as an environmental river sanitation or cleanup campaign.
