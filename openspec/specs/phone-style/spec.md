# Spec: Phone Style — Visual Design System

## Overview

Defines the "Papel y Tinta" visual identity for the phone client. The phone interface MUST read as a printed artifact — aged paper, ink accents, torn edges — not a modern app. The visual language is generic and MUST stay independent of any specific subject matter. Pure visual spec: no functional behavior changes.

## Visual Identity

The phone UI IS part of the installation. Every visual decision derives from the p5 collage's torn-edge language: shared `clip-path` jitter, same sepia-ink palette (`--color-bg #f5e6c8`, `--color-accent #8b2c24`), zero rounded corners. The phone feels like a physical paper object: parchment, ink, torn edges.

## Design Tokens

All visual values MUST be CSS custom properties on `:root` — single source of truth.

| Token | Value | Role |
|-------|-------|------|
| `--color-bg` | `#f5e6c8` | Aged parchment background |
| `--color-text` | `#1a1a1a` | Ink black body text |
| `--color-accent` | `#8b2c24` | Deep red accent |
| `--color-accent-active` | `#6e201a` | Active/pressed accent |
| `--color-surface` | `rgba(245,230,200,0.9)` | Translucent paper for cards |
| `--color-muted` | `#8b7d6b` | Secondary / label text |
| `--color-border` | `#3a2a1a` | Dark ink strokes |
| `--color-success` | `#2d6a4f` | Faded green — connection OK |
| `--color-error` | `#8b2c24` | Connection lost (same as accent) |
| `--font-heading` | `'Playfair Display', Georgia, serif` | Section headings |
| `--font-body` | `'Courier Prime', 'Courier New', monospace` | Body / button labels |
| `--spacing-xs` | `0.25rem` | Minimal gap |
| `--spacing-sm` | `0.5rem` | Tight |
| `--spacing-md` | `0.75rem` | Standard |
| `--spacing-lg` | `1rem` | Section |
| `--spacing-xl` | `1.5rem` | Large section |

Typography scale: 0.75rem / 0.875rem / 1rem / 1.25rem / 1.5rem. No font weights below 400.

## Component Specifications

### 1. Background / Canvas
- **Purpose**: Aged paper backdrop across the entire viewport.
- **Visual**: Body background MUST be `--color-bg`. A `body::after` overlay MUST apply the inline SVG `feTurbulence` grain filter with `mix-blend-mode: multiply` and `pointer-events: none`. This is CSS-only — no JS for textures.
- **Token ref**: `--color-bg`, SVG filter `#paper-texture` (fractalNoise, baseFrequency 0.04, numOctaves 3, sepia tint via feColorMatrix).

### 2. Slot Badge
- **Purpose**: Display assigned slot number.
- **Visual**: Ink-stamp — inset `box-shadow`, slight rotation (-1deg to 1deg), `--font-heading` bold, `--color-accent` text on `--color-surface` background. Positioned top-left of header.

### 3. Connection Status
- **Purpose**: Show WebSocket state.
- **Visual**: Filled dot (●) + label text in `--font-body`. Dot color MUST switch between `--color-success` (connected) and `--color-error` (disconnected). Text reads "Conectado"/"Desconectado".

### 4. Permission Screen
- **Purpose**: Request sensor permissions.
- **Visual**: Heading in `--font-heading` 1.25rem, body in `--font-body` 0.875rem, button as ink-stamp — thick `--color-accent` border, slight rotation, `--color-surface` bg, `--color-text` text. `clip-path` torn edge (12 vertices) on the card container.

### 5. Action Buttons
- **Purpose**: 3-column grid of collage manipulation commands.
- **Visual**: Ink-stamp on paper. `box-shadow: 1px 1px 0 var(--color-border)`, slight rotation (-1 to 1deg per button), `--color-surface` bg, `--color-border` 1px solid. Active: `--color-accent` border replaces default. Locked: `--color-muted` border, crosshatch `repeating-linear-gradient` overlay. Recording: `--color-error` pulsing border (opacity oscillation 0.4→1 over 1.5s — vintage pulse, not modern glow+scale).
- **Touch**: `:active` only — no `:hover`. No scale transform on active (period stamps don't shrink).

### 6. Recording Indicator
- **Purpose**: Show active gesture recording.
- **Visual**: Couriers  ●● Grabando" in `--color-error`. Pulse animation: opacity oscillates 0.4→1 over 1.5s ease-in-out. NOT the modern CSS pulse with scale and glow. Courier Prime, 0.875rem.

### 7. Gesture Status
- **Purpose**: Feedback after gesture record/playback.
- **Visual**: Courier Prime 0.75rem. Success: `--color-success` text. Error: `--color-error` text. Fades out after 3s via CSS animation (opacity 1→0 over 0.5s after 2.5s delay).

### 8. Torn Edges
- **Purpose**: Visual continuity with the p5 collage.
- **Mechanism**: `clip-path: polygon(...)` with 12-16 pseudo-random vertices per element. Derived from p5's `generateTornBorder()` algorithm (seeded jitter). Applied to: header row, permission card, thumbnail container. NOT applied to individual buttons (preserves touch targets).

## Interaction States

| Component | Default | Active | Disconnected | Locked |
|-----------|---------|--------|-------------|--------|
| Action button | Ink-stamp paper | Accent border | Muted border | Crosshatch overlay |
| Permission btn | Ink-stamp | Accent border | N/A | N/A |
| Slot badge | Ink-stamp | N/A | Dashed border | N/A |
| Recording indicator | Hidden | Pulsing opacity | N/A | N/A |

No `:hover` — all touch via `:active`. CSS transitions: 0.15s ease on color/border/background.

## Accessibility / Constraints

- **Contrast**: WCAG AA ≥4.5:1 for body text. `--color-muted` on `--color-bg` MUST be tested.
- **Font loading**: `font-display: swap` on Google Fonts `<link>`. Fallbacks (serif for headings, monospace for body) MUST render legibly before fonts load.
- **Performance**: `feTurbulence` applied once as static body overlay. `clip-path` ≤16 vertices. No per-frame layout triggers — `will-change: transform` on animated elements.
- **Touch targets**: All interactive elements ≥44×44px.
- **No build step**: Plain CSS with custom properties. Served directly by the bridge.
- **Asset independence**: Design MUST work without any user-created assets. Optional texture assets in `phone-client/assets/` layer on top via `mix-blend-mode: multiply`.
- **Browser targets**: iOS Safari 15+, Android Chrome 90+.

## Scenarios

### Scenario 1: New user opens the phone client
- GIVEN the phone loads the client URL for the first time
- WHEN the page renders
- THEN the body shows aged paper (`--color-bg`) with `feTurbulence` grain overlay
- AND the permission screen heading renders in Playfair Display ink-black on parchment
- AND the activation button renders as an ink stamp with slight rotation and accent border

### Scenario 2: Connected and manipulating the collage
- GIVEN the phone is WebSocket-connected (dot is `--color-success`)
- WHEN the collage image changes
- THEN the cell image thumbnail updates with the new image
- AND action buttons appear as a 3-column grid of slightly rotated ink stamps
- AND the slot badge shows the assigned number as an ink-stamp numeral

### Scenario 3: Recording a gesture
- GIVEN the user taps the record button
- WHEN recording state activates
- THEN the button shows pulsing `--color-error` border (opacity 0.4→1 over 1.5s, no scale)
- AND the recording indicator text "●● Grabando" pulses in Courier Prime, `--color-error`

### Scenario 4: Connection lost
- GIVEN the phone disconnects from the bridge
- WHEN the status updates
- THEN the connection dot turns `--color-error`
- AND the status text reads "Desconectado" in `--color-muted`
- AND all action buttons lose accent borders, switching to `--color-muted` default

### Scenario 5: Optional user texture loads
- GIVEN a texture image exists at `phone-client/assets/bg-texture.jpg`
- WHEN the image loads
- THEN it layers over the paper background via `mix-blend-mode: multiply`
- AND the underlying `--color-bg` + `feTurbulence` remain visible as base layer
