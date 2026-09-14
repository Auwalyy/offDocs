# FolioSync — Version Report (Sprint 0)

Generated during Sprint 0 environment verification.

## Runtime

| Tool    | Version  |
|---------|----------|
| Node.js | v26.8.2  |
| npm     | 11.19.1  |

## Mobile — Core

| Package                    | Version   | Source                        |
|----------------------------|-----------|-------------------------------|
| expo                       | 57.0.22   | npx create-expo-app           |
| react-native               | 0.86.x    | resolved by Expo SDK 57       |
| react                      | 19.2.x    | resolved by Expo SDK 57       |
| expo-router                | 5.1.x     | npx expo install              |
| typescript                 | ~5.8.x    | npx expo install              |

## Mobile — UI & Animation

| Package                    | Version   | Notes                                      |
|----------------------------|-----------|--------------------------------------------|
| nativewind                 | 4.1.23    | requires tailwindcss >3.3.0                |
| tailwindcss                | 3.4.19    | NativeWind peer dep                        |
| react-native-reanimated    | 4.5.5     | SDK 57 ships Reanimated 4.x                |
| react-native-worklets      | 0.12.2    | Reanimated 4 worklets runtime              |

## Mobile — Storage & Files

| Package                    | Version   | Notes                                      |
|----------------------------|-----------|--------------------------------------------|
| expo-sqlite                | 57.0.3    | New Architecture async API                 |
| expo-secure-store          | resolved  | npx expo install                           |
| expo-document-picker       | resolved  | npx expo install                           |
| expo-file-system           | resolved  | npx expo install                           |
| expo-font                  | resolved  | npx expo install                           |
| expo-network               | resolved  | npx expo install                           |

## Mobile — Utilities

| Package                    | Version   | Notes                                      |
|----------------------------|-----------|--------------------------------------------|
| react-native-uuid          | latest    | UUID v4 generation, no native module       |

## Backend

| Package        | Version  | Notes                              |
|----------------|----------|------------------------------------|
| Node.js        | 26.8.2   | LTS-compatible                     |
| express        | 5.x      | latest stable                      |
| typescript     | 5.x      | strict mode                        |
| mongoose       | 8.x      | MongoDB ODM                        |
| zod            | 3.x      | schema validation                  |
| argon2         | latest   | password hashing                   |
| jsonwebtoken   | 9.x      | JWT access + refresh tokens        |
| multer         | 2.x      | multipart file upload              |
| @aws-sdk/client-s3 | 3.x  | S3-compatible object storage       |
| winston        | 3.x      | structured logging                 |
| jest           | 29.x     | testing                            |
| supertest      | 7.x      | HTTP integration testing           |

## Object Storage Decision

**Provider: Cloudflare R2**

Rationale:
- S3-compatible API (AWS SDK v3 works without modification)
- Free tier: 10 GB storage, 1M Class A ops/month, 10M Class B ops/month
- No egress fees
- Simple developer setup
- Suitable for a final-year project with real production characteristics

Alternative: AWS S3 (same SDK, different endpoint config)

## Architecture Decisions

See `docs/decisions.md`.
