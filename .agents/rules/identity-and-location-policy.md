# Identity, Location, and Narrative Policy: Team Taraba River

## 1. Group Identity
"Team Taraba River" is strictly the official name of the alumni fellowship group under URIP (Usosans Resident in Port Harcourt) and USOSA (Unity Schools Old Students Association).
- It is solely an organizational/group identity.
- It has NO connection to any physical river, body of water, or geographic location.
- It is strictly prohibited from being referenced as a valid location or venue anywhere in the application.

## 2. Event Folder Location Field Rules
- The `location` field in all Event and Media folders MUST default to an empty string (`""`).
- Setting, populating, or editing the `location` field is EXCLUSIVELY permitted through:
  1. The user workflow for creating a new Event folder.
  2. The user workflow for editing existing Event folder metadata.
- Automated pipelines (Google Drive sync, YouTube sync, cron workers, server middlewares, or AI queries) MUST NEVER automatically populate, default, or infer this field.
- If no location was explicitly provided by the user, the field remains blank (`""`), and no location badge or map pin is rendered on the UI.

## 3. Prohibition of False Narratives
- Never associate Team Taraba River with environmental or river cleanup campaigns, sanitation drives, or ecological rehabilitation themes.
- The group is an alumni fellowship for Federal Unity Colleges old students resident in Port Harcourt, organizing social outings, health walks, bi-annual meetings, sports tournaments, and professional networking.
