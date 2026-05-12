---
Task ID: 6-7
Agent: Backend Agent
Task: Update reports/[id] PATCH and whatsapp-status routes for DB-driven WhatsApp integration

Work Log:
- Updated `/src/app/api/reports/[id]/route.ts` PATCH handler:
  - Reads WhatsAppConfig from database via `db.whatsAppConfig.findFirst()`
  - When report is Resolved + source is 'whatsapp' + has whatsappJid + not yet notified:
    - Sends personalized Sesotho message via Evolution API: "KHOTLA AI: Bothata ba hau ba {category} bo hodutse! Re leboha pako ea hau. (Your {category} issue has been resolved! Thank you for your report.)"
    - Uses `whatsappJid.split('@')[0]` as the number field
    - Sets `resolutionNotified: true` on successful send
    - Falls back gracefully on any WhatsApp/API failure (does not fail the PATCH)
  - Preserves existing status/category/priority update functionality
  - Re-fetches report after potential resolutionNotified update to return latest data

- Rewrote `/src/app/api/whatsapp-status/route.ts`:
  - Reads WhatsAppConfig from database instead of environment variables
  - Returns `{ online: false, state: 'not_configured', message: 'WhatsApp not configured yet...' }` if no config or no apiKey
  - Checks real connection state from Evolution API: `GET {apiBaseUrl}/instance/connectionState/{instanceName}`
  - Updates `isConnected` and `lastConnectedAt` fields in the database based on API response
  - Returns full status: `{ online, state, instance, qrCode, message }` with human-readable messages per state
  - Handles unreachable API and network errors gracefully

- All lint checks pass cleanly
