# Task 3 - WhatsApp Setup Improvements & Citizen Access

## Summary

Completed all requested improvements to the KHOTLA AI WhatsApp integration:

### A. Rewrote `src/components/khotla/khotla-whatsapp-setup.tsx`

- **Two-column layout**: Left column for admin connection management, right column for citizen access
- **Left column features**:
  - Connection status with ONLINE/OFFLINE/STARTING badge
  - Admin QR code for WhatsApp linking
  - Connect/Disconnect button
  - Phone number display when connected
  - Supported message types card
- **Right column features** ("Citizen Access"):
  - Big green WhatsApp button linking to wa.me
  - Direct wa.me link display
  - WhatsApp phone number display (with LIVE/OFFLINE badge)
  - Visual QR code placeholder (canvas-generated) for citizens to scan
  - Instructions in **English** and **Sesotho**
- **Better error handling**:
  - Auto-retry with increasing intervals (5s, 15s, 30s) when Evolution API is unreachable
  - Yellow/amber warnings instead of red error toasts for connectivity issues
  - "WhatsApp Service is Starting Up" banner with countdown timer
  - Friendly messages like "WhatsApp service is starting up, please wait..." instead of errors
  - 503 status code handling with auto-retry

### B. Added Citizen WhatsApp Banner to Dashboard

- Modified `src/components/khotla/khotla-dashboard.tsx`
- Added prominent gold banner at top of dashboard: "Report via WhatsApp — Send a message to KHOTLA AI on WhatsApp"
- Includes Sesotho subtitle: "Roma pego ka WhatsApp"
- Links to wa.me with the connected phone number
- Eye-catching gold background with navy text

### C. Improved API Routes

**`src/app/api/whatsapp-setup/route.ts`**:
- Increased all Evolution API timeouts to 20-30 seconds (from 8-15s)
- Added instance existence check (GET before POST) to avoid conflicts
- Phone number extraction from fetchInstances response
- Returns 503 (Service Unavailable) instead of 500 for connectivity issues
- Friendly error messages
- Phone number caching in database
- Disconnect now clears phoneNumber

**`src/app/api/whatsapp-status/route.ts`**:
- Increased timeout to 15 seconds (from 3s)
- Returns `phoneNumber` field in response
- Phone number extraction from connection state and instance data
- Caching phone number in WhatsAppConfig table
- Returns `api_unreachable` state instead of generic `offline` when API times out
- Friendly "starting up" messages

### D. Prisma Schema Update

- Added `phoneNumber` field to `WhatsAppConfig` model
- Ran `npx prisma db push` successfully

### E. WhatsApp Phone Number API Route

- Initially created `/api/whatsapp-phone/route.ts`
- Removed due to Turbopack dev server not detecting new route directories
- Phone number functionality integrated into `whatsapp-status` route instead
- Frontend components updated to use `/api/whatsapp-status` for phone number retrieval

## Files Modified

1. `prisma/schema.prisma` - Added phoneNumber field
2. `src/app/api/whatsapp-setup/route.ts` - Complete rewrite with better timeouts, instance check, phone number support
3. `src/app/api/whatsapp-status/route.ts` - Increased timeout, added phoneNumber, better error messages
4. `src/components/khotla/khotla-whatsapp-setup.tsx` - Complete rewrite with two-column layout, citizen access, retry logic
5. `src/components/khotla/khotla-dashboard.tsx` - Added WhatsApp banner, phone number state
6. `src/app/page.tsx` - Minor comment addition (to trigger recompilation)

## Technical Notes

- The Turbopack dev server does not detect new API route directories created after startup. Workaround: integrated phone number retrieval into existing `whatsapp-status` route.
- The canvas-based QR code generation is a visual placeholder since we can't install new npm packages. It creates a styled representation with WhatsApp branding colors.
- All timeouts are now generous (15-30s) to accommodate the free Render tier spin-up time.
- The `api_unreachable` state is a new state that triggers the auto-retry UI in the frontend.
