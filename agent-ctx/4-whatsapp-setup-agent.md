# Task 4 - WhatsApp Setup API Route

## Task
Create comprehensive WhatsApp management API at `/api/whatsapp-setup/route.ts`

## Work Completed

### 1. Added WhatsAppConfig model to Prisma schema
- Fields: id, instanceName (@unique), apiKey, instanceToken, apiBaseUrl, webhookUrl, isConnected, qrCode, lastConnectedAt, createdAt, updatedAt
- Removed duplicate model that existed in schema
- Pushed schema to database with `bun run db:push`

### 2. Created `/src/app/api/whatsapp-setup/route.ts`
Complete API route with four HTTP method handlers:

#### GET - Fetch current configuration and connection status
- Fetches all WhatsAppConfig records from database
- For each config, queries Evolution API's `/instance/connectionState/{instanceName}` for live state
- Syncs database isConnected flag with live state
- Returns enriched configs with `liveState` field

#### POST - Save Evolution API configuration
- Accepts: instanceName, apiKey, apiBaseUrl (all required)
- Validates Evolution API connectivity before saving (health check to `/instance/fetchInstances`)
- Builds webhook URL from NEXT_PUBLIC_APP_URL env or request headers
- Upserts config by instanceName (unique constraint)
- Returns saved config (excluding sensitive fields in response)

#### PUT - Create WhatsApp instance and connect
- Requires instanceName (must have existing POST-saved config)
- Step 1: Creates instance via `POST /instance/create` with `integration: "WHATSAPP-BAILEYS"` and `qrcode: true`
- Stores instance token from creation response
- Step 2: Configures webhook via `POST /webhook/set/{instanceName}` with MESSAGES_UPSERT event
- Step 3: Connects via `GET /instance/connect/{instanceName}` to get QR code
- Parses QR code from various Evolution API response formats (base64, qrcode.base64, code)
- Updates database with qrCode and connection state
- Returns QR code for frontend display

#### DELETE - Disconnect/logout WhatsApp instance
- Requires instanceName
- Calls `DELETE /instance/logout/{instanceName}` on Evolution API
- Updates database: isConnected=false, qrCode=null, instanceToken=null
- Gracefully handles offline/unreachable Evolution API

### 3. Helper: buildWebhookUrl
- Priority: NEXT_PUBLIC_APP_URL env var
- Fallback: derives from request host + x-forwarded-proto headers
- Points to `/api/whatsapp-webhook` (existing route)

### 4. Error handling
- All Evolution API requests have AbortSignal.timeout (5-15 seconds)
- Non-fatal failures (webhook set) are logged but don't block the flow
- Instance creation failures return 502 with descriptive message
- All top-level handlers have try/catch with proper error responses

### 5. Lint: passes cleanly ✓
