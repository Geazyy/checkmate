# CheckMate

CheckMate is an Expo and React Native application for creating exams, managing answer keys and rosters, printing OMR answer sheets, scanning completed sheets, grading responses, and reviewing class analytics.

## Features

- Exam and editable answer-key management
- Student roster management
- Printable A4 and Letter answer sheets
- 25-item and 50-item OMR scanning with A-D choices
- Camera capture and gallery image selection
- Perspective normalization and local lighting correction
- Blank, multiple, uncertain, and detected answer states
- Editable scan review before grading
- PDF, print, share, and spreadsheet export tools
- Item analysis, score distribution, and exam analytics
- Local SQLite storage with optional Supabase integration

## Technology

- Expo SDK 57
- React Native 0.86
- Expo Router
- TypeScript
- Zustand
- Expo Camera, Image Picker, Image Manipulator, Print, Sharing, and SQLite

## Requirements

- Node.js and npm
- Expo Go on a compatible Android or iOS device, or a web browser
- Phone and computer on the same network for LAN testing

## Setup

```bash
npm install
npx expo start
```

To test from a phone when LAN discovery is unavailable:

```bash
npx expo start --tunnel
```

Open Expo Go and scan the QR code shown by Expo.

For the web build:

```bash
npm run web
```

## Optional Supabase Configuration

Create a local environment file and provide public Expo variables:

```text
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Without these values, the app uses local demonstration data and SQLite behavior.

## OMR Workflow

1. Create or select an exam and configure its answer key.
2. Generate and print a matching blank answer sheet.
3. Fill bubbles clearly using a dark pencil or pen.
4. Keep the entire sheet visible when taking a photo.
5. Review blank or flagged rows before selecting **Grade Answers**.

The scanner and answer-sheet generator share the versioned layout definition in `src/services/omr/sheetLayout.ts`. Detection is based only on sheet geometry and mark density; the answer key is applied afterward for grading.

## Verification

```bash
npx tsc --noEmit
```

Real 50-item OMR regression images and independently transcribed expected answers are stored in `fixtures/omr`.

## Project Structure

```text
src/app/                 Expo Router screens
src/components/          Shared UI and scanner components
src/services/omr/        Sheet geometry and OMR processing
src/services/export/     PDF and spreadsheet generation
src/services/database/   Local database support
src/store/               Application state
fixtures/omr/            Scanner regression fixtures
```
