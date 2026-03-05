# Design System: TrustChain — Solar Nocturne
**Style Origin:** OVO Redsun / Coinery-inspired dark Web3 aesthetic
**Screens:** 12 Stitch-generated HTML mockups

## 1. Visual Theme & Atmosphere
- **Mood:** Obsidian void, cinematic, premium crypto
- **Atmosphere:** Deep-space darkness punctuated by warm amber/orange solar flares
- **Texture:** Subtle film grain overlay (fractalNoise SVG, opacity 0.03)
- **Depth:** Glass panels with 40px backdrop-blur + 150% saturation
- **Signature Effects:**
  - **Pulse Orb** — Radial gradient glow (rgba(255,92,0,0.05)), 600-800px diameter, positioned as ambient background
  - **Solar Bloom** — Box-shadow `0 0 64px rgba(255,92,0,0.05)` on elevated cards
  - **Ghost Border** — `1px solid rgba(91,65,55,0.15)` → hover: `rgba(91,65,55,0.4)`
  - **Glass Panel** — `bg: rgba(14,14,14,0.2)` + `backdrop-blur(40px) saturate(150%)`

## 2. Color Palette & Roles

### Core Brand
| Role | Name | Hex | CSS Variable | Usage |
|------|------|-----|-------------|-------|
| Primary | Warm Peach-Salmon | `#FFB59A` | `--color-primary` | Text accents, links, highlights |
| Primary Container | Blazing Solar Orange | `#FF5C00` | `--color-primary-container` | CTAs, active states, primary buttons |
| Secondary | Amber Gold | `#FFB955` | `--color-secondary` | Progress bars, badges, secondary emphasis |
| Secondary Container | Deep Amber | `#DC9100` | `--color-secondary-container` | Verified badges, tier indicators |

### Surfaces (Darkest to Lightest)
| Role | Hex | Usage |
|------|-----|-------|
| Background (The Void) | `#050505` or `#0A0A0A` | Page body, deepest layer |
| Surface | `#131313` | Main content area |
| Surface Container Lowest | `#0E0E0E` | Cards, sidebar background |
| Surface Container Low | `#1C1B1B` | Elevated cards, form containers |
| Surface Container | `#201F1F` | Mid-elevation panels |
| Surface Container High | `#2A2A2A` | Input backgrounds, hover states |
| Surface Container Highest | `#353534` | Borders, dividers, progress track |

### Text
| Role | Hex | Usage |
|------|-----|-------|
| On Surface | `#E5E2E1` | Primary text |
| On Surface Variant | `#E4BEB1` | Secondary/muted text (warm tint) |
| On Primary | `#5A1B00` | Text on primary-container buttons |
| Outline | `#AB897D` | Subtle borders |
| Outline Variant | `#5B4137` | Ghost borders, dividers |

### Status
| Role | Hex | Usage |
|------|-----|-------|
| Error | `#FFB4AB` | Error text |
| Error Container | `#93000A` | Error backgrounds |
| Success | (use Secondary `#FFB955`) | Success indicators |

## 3. Typography Rules

### Font Stack
- **Headlines:** Space Grotesk (weights: 300-900)
- **Body:** Inter (weights: 300-700)
- **Labels:** Inter (weights: 400-600)

### Type Scale
| Element | Font | Size | Weight | Transform | Tracking |
|---------|------|------|--------|-----------|----------|
| Display (Hero) | Space Grotesk | 3.5-4.5rem | 900 (Black) | UPPERCASE | -0.04em (Tight) |
| H1 | Space Grotesk | 3rem-3.5rem | 700 (Bold) | UPPERCASE | -0.04em |
| H2 | Space Grotesk | 2rem-3rem | 700 | UPPERCASE | -0.02em to tight |
| H3 | Space Grotesk | 1.25rem-2rem | 700 | UPPERCASE | wide to tight |
| Section Label | Space Grotesk | 0.625rem (10px) | 700 | UPPERCASE | 0.2-0.3em (Very Wide) |
| Body | Inter | 0.875-1rem | 400 (Regular/Light) | normal | normal |
| Label/Caption | Inter | 0.625-0.6875rem | 500-600 | UPPERCASE | 0.05em |
| Mono (addresses) | monospace | 0.75rem | 400 | normal | normal |

### Key Rules
- All headings are UPPERCASE with tight letter-spacing
- Labels use extra-wide tracking (0.1-0.3em) in uppercase
- Body text is light weight (300-400) for the ethereal feel
- `text-shadow: 0 0 20px rgba(255,181,154,0.3)` for hero text glow

## 4. Component Stylings

### Buttons
| Variant | Background | Text | Border | Hover Effect |
|---------|-----------|------|--------|-------------|
| Primary (CTA) | `#FF5C00` | `#050505` (black) | none | `shadow: 0 0 30px rgba(255,92,0,0.4)` |
| Glass | transparent + blur(10px) | `#FFB59A` | `1px solid primary/30` | `bg-primary-container/10` |
| Ghost | transparent | `#FFB59A` | ghost-border | border brightens |

### Cards
- Background: `#0E0E0E` (surface-container-lowest)
- Border: ghost-border (1px solid rgba(91,65,55,0.15))
- Hover: border brightens, optional `translate-y(-4px)`
- Elevation: solar-bloom shadow on important cards
- Image overlay: `bg-gradient-to-t from-black via-black/40 to-transparent`

### Navigation
- **Sidebar:** Fixed left, 256px width, `#0E0E0E` background
- **Active indicator:** `text-[#FF5C00] font-bold border-r-2 border-[#FF5C00]`
- **Inactive:** `text-[#E5E2E1]/60` → hover: `bg-[#1C1B1B] text-[#FFB59A]`
- **Top bar:** Glass panel (blur-40px), fixed, `shadow: 0 0 30px rgba(255,92,0,0.05)`
- **Mobile bottom nav:** `bg-black/40 backdrop-blur-[40px]`, 5 max items

### Inputs
- Background: `#2A2A2A` (surface-container-high)
- Border: bottom-only, transparent → focus: primary color
- No visible border-radius (sharp edges)
- Labels: 10px uppercase, wide tracking, on-surface-variant

### Badges/Tags
- Glass panel + ghost-border, rounded-xl
- Icon + uppercase label, 10px text
- Used for: AI Score, Verified, Status indicators

### Progress Bars
- Track: `#353534` (surface-container-highest)
- Fill: gradient `from-secondary to-primary-container`
- Height: 1px (subtle) to 12px (prominent)

## 5. Layout Principles

### Spacing
- 8px base grid system
- Section gaps: 48-128px (mb-12 to mb-32)
- Card padding: 32-40px (p-8 to p-10)
- Inner element gaps: 16-32px (gap-4 to gap-8)

### Grid
- Max content width: 1200-1600px
- Sidebar: 256px fixed left (desktop only)
- Main grid: 12-column on large screens
- Campaign cards: 1-3 columns responsive
- Bento grid for stats (2-4 columns)

### Border Radius
- Default: 0px (sharp, industrial)
- Cards/containers: 0.5-0.75rem (xl)
- Buttons: 0px to 0.75rem
- Avatars/pills: 9999px (full)

### Responsive
- Sidebar hidden on mobile (`hidden md:flex`)
- Bottom nav shown on mobile (`md:hidden`)
- Content adjusts: `sidebar-offset { margin-left: 256px }` on desktop
- Stack to single column on mobile

## 6. Animation & Motion
- Hover transforms: `translate-y(-4px)`, `translate-x(1px)`
- Image zoom on hover: `scale-110`, duration 700ms
- Staggered entrance: slideUp with cubic-bezier(0.16, 1, 0.3, 1), 100ms stagger
- Pulse animation on orb indicator dots
- Spinning border for network health indicator
- All transitions: 300ms default, ease or cubic-bezier

## 7. Icon System
- **Library:** Material Symbols Outlined
- **Default settings:** FILL 0, wght 400, GRAD 0, opsz 24
- **Filled variant:** `font-variation-settings: 'FILL' 1` for active states
- **Sizing:** 16-24px for UI, 32-40px for feature highlights
