# Task 5 - WhatsApp Webhook Handler Rewrite

## Agent: Webhook Agent
## Task ID: 5

## Task
Rewrite `/src/app/api/whatsapp-webhook/route.ts` to fully support the KHOTLA AI citizen flow with all message types from Evolution API v2.3.7.

## Work Completed

### Complete Rewrite of WhatsApp Webhook Handler

The previous handler only supported text messages with hardcoded env vars. The new handler is a full-featured, production-ready implementation:

### 1. Message Type Support

| Type | Handler | Flow |
|------|---------|------|
| `conversation` / `extendedTextMessage` | `handleTextMessage()` | Extract text → AI categorization → Save report → Reply in Sesotho |
| `audioMessage` | `handleAudioMessage()` | Download audio → Base64 → ASR transcription → Process as text → Save report → Reply in Sesotho |
| `imageMessage` | `handleImageMessage()` | Download image → Base64 → VLM analysis → Save report → Reply in Sesotho with analysis summary |
| `locationMessage` | `handleLocationMessage()` | Extract lat/lng → Update recent report (within 10 min) OR create new report → Reply in Sesotho |

### 2. WhatsApp Reply Function
- `sendWhatsAppReply(jid, text)` reads WhatsAppConfig from database
- Uses stored apiKey, instanceName, apiBaseUrl
- Sends via Evolution API: `POST /message/sendText/{instanceName}` with `{ number, text }` body and `apikey` header
- Falls back to env vars if no database config exists
- Gracefully handles errors without crashing

### 3. AI Integration (z-ai-web-dev-sdk)
- **Text analysis**: `zai.chat.completions.create()` — categorizes into WATER/ROADS/CORRUPTION/HEALTH/EDUCATION/ELECTRICITY/SANITATION/OTHER with priority HIGH/MEDIUM/LOW and Sesotho reply
- **Audio transcription**: `zai.audio.asr.create({ file_base64 })` — transcribes voice notes, then processes as text
- **Image analysis**: `zai.chat.completions.createVision()` — detects infrastructure damage with severity, confidence, category, urgency

### 4. Database Integration
- All reports saved with: `source='whatsapp'`, `whatsappJid`, `phoneNumber` (formatted as +266 XXXX XXXX), `pushName`, `messageType`
- Audio reports include `audioUrl`
- Image reports include `imageUrl`
- Location messages update existing reports if found within 10 minutes, otherwise create new reports with `category=OTHER`

### 5. Robustness Features
- Strip markdown code blocks from AI JSON responses before parsing
- `detectMessageType()` falls back to inspecting message object keys when `messageType` field is missing
- Ignores `fromMe` messages (sent by the bot itself)
- Ignores group messages (`@g.us` JIDs)
- Ignores non-`messages.upsert` events
- Media downloads include 30-second timeout
- All errors caught and logged — webhook never crashes (returns 200 to prevent Evolution API retries)
- Comprehensive logging with `[WhatsApp Webhook]` prefix

### 6. GET Handler
Returns webhook status and supported types for health checks / verification

### 7. Lint
Passes cleanly ✓
