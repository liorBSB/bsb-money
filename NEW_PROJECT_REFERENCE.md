# CLAUDE.md — Standing Rules

## Tech Stack

- **Framework**: Next.js 15 (App Router) with React 19
- **Language**: JavaScript only — NEVER use TypeScript (`.ts` / `.tsx`). All files use `.js` / `.jsx`.
- **Styling**: Tailwind CSS + a central color palette file (`src/app/colors.js`) — see Color Palette below
- **Backend**: Firebase — Firestore, Storage (NO authentication / login flow)
- **Deployment**: Vercel — this is a **PWA** (Progressive Web App)
- **Reports** (if needed): jspdf / jspdf-autotable for PDF generation

## Language

- This app is **Hebrew only**. There is no i18n, no translation system, no English.
- All user-facing text is hardcoded in Hebrew directly in the components.
- The root layout must set `dir="rtl"` and `lang="he"` on the `<html>` tag.
- All text alignment defaults to right. Flex directions should account for RTL reading order.

## PWA Requirements

- This app **must be a Progressive Web App**. Set up:
  - A `manifest.json` (or `manifest.webmanifest`) in `public/` with `name`, `short_name`, `start_url`, `display: "standalone"`, `theme_color`, `background_color`, and icons.
  - A service worker for offline caching (use `next-pwa` or `@serwist/next` — whichever is current and maintained).
- The app should work well as an installed desktop PWA.

## Project Structure

- `src/app/` — Next.js App Router pages (each folder has `page.js`)
- `src/app/colors.js` — Central color palette (see below)
- `src/components/` — Reusable React components
- `src/lib/` — Firebase config, Firestore services, utilities
- `src/hooks/` — Custom React hooks

## Color Palette

Create `src/app/colors.js` with this exact palette:

```js
const colors = {
  primaryGreen: '#076332',
  gold: '#EDC381',
  goldHover: '#d4b06a',
  white: '#E7E3DD',
  black: '#000',
  muted: '#888',
  surface: '#F5F5F5',
  background: '#F9FAFB',
  text: '#222',
  gray400: '#ccc',
  yellow: '#FFD600',
  red: '#FF5252',
  green: '#4CAF50',
  sectionBg: 'rgba(0,0,0,0.28)',
  secondaryText: '#4F7DF3'
};

export default colors;
```

Always import colors from this file — never hardcode hex values:

```js
import colors from '@/app/colors';
```

### Tailwind Config Colors

Extend the Tailwind theme with these semantic tokens in `tailwind.config.js`:

```js
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#E0BF8A',
        accent: '#076332',
        background: '#FAF4EF',
        surface: '#F5F0E8',
        text: '#3B3B3B',
        muted: '#757575',
        success: '#076332',
        warning: '#EBA937',
        error: '#C85C5C',
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body: ['Poppins', 'sans-serif'],
      },
    }
  },
  plugins: [],
};
```

## Code Style

- Always use plain JavaScript (`.js`). Never generate TypeScript.
- All interactive pages and components must start with `'use client'` as the first line.
- Use `@/` path aliases for all imports:

```js
import { db, storage } from '@/lib/firebase';
import colors from '@/app/colors';
```

- Import Firebase services (`db`, `storage`) from `@/lib/firebase`.
- Import Firestore functions (`doc`, `getDoc`, `updateDoc`, etc.) directly from `firebase/firestore`.

## Styling Rules

- Use Tailwind CSS utility classes for layout, spacing, and responsive design.
- For palette colors that Tailwind can't express, use inline styles:

```jsx
<div className="p-4 rounded-lg" style={{ backgroundColor: colors.surface, color: colors.text }}>
```

- **Desktop-first**: Design for large screens first, then ensure it works on smaller screens. Use responsive breakpoints to adapt down to tablet/mobile when needed.
- Use `min-h-screen` on page containers.
- Leverage hover states, tooltips, and keyboard shortcuts where appropriate — this is a desktop-oriented app.
- Still ensure reasonable usability on tablets/phones, but desktop is the primary target.

## Dependencies (starting point)

```json
{
  "dependencies": {
    "firebase": "^11.6.0",
    "next": "^15.5.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.21",
    "eslint": "^9",
    "eslint-config-next": "^15.5.0",
    "postcss": "^8.5.3",
    "tailwindcss": "^3.4.17"
  }
}
```

Add `jspdf`, `jspdf-autotable`, `lodash`, or a PWA plugin as needed.
