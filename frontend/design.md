# Design Tokens: Cyber-Philanthropy (V2)

## Color System

### Primary Palette
| Token               | Value       | Usage                  |
|---------------------|-------------|------------------------|
| --color-primary     | #00F0FF     | CTAs, interactive elements, blockchain links |
| --color-primary-light | rgba(0, 240, 255, 0.2)  | Hover states, neon glows  |
| --color-primary-dark  | #06B6D4  | Pressed, active states |

### Accent Palette
| Token               | Value       | Usage                        |
|---------------------|-------------|------------------------------|
| --color-accent      | #F59E0B     | Warm amber/gold for Donations, Money |
| --color-accent-dark | #D97706     | Pressed/darker accent        |

### Semantic Colors
| Token               | Value       | Usage                        |
|---------------------|-------------|------------------------------|
| --color-success     | #10B981     | Success states, positive     |
| --color-warning     | #F59E0B     | Warnings, pending            |
| --color-error       | #EF4444     | Errors, destructive          |
| --color-info        | #00F0FF     | Information, links           |

### Neutral Scale (Space Dark Default)
| Token               | Value       | Usage                        |
|---------------------|-------------|------------------------------|
| --color-bg          | #050505     | Pure deep space black        |
| --color-surface     | rgba(20, 25, 40, 0.6) | Frosted obsidian surfaces |
| --color-surface-hover | rgba(30, 35, 50, 0.8) | Hover background       |
| --color-border      | rgba(0, 240, 255, 0.15) | Borders with subtle cyan tint |
| --color-text        | #FFFFFF     | Primary text                 |
| --color-text-muted  | #94A3B8     | Secondary text               |

## Typography

### Font Stack
- **Primary**: `'Outfit', 'Space Grotesk', sans-serif`
- **Body**: `'Inter', sans-serif`
- **Mono**: `'JetBrains Mono', monospace`

### Type Scale
| Level | Size    | Weight | Line Height | Token            |
|-------|---------|--------|-------------|------------------|
| H1    | 3.5rem  | 800    | 1.1         | --text-h1        |
| H2    | 2.5rem  | 700    | 1.2         | --text-h2        |
| H3    | 1.5rem  | 600    | 1.3         | --text-h3        |
| Body  | 1rem    | 400    | 1.6         | --text-body      |
| Small | 0.875rem| 400    | 1.5         | --text-small     |
| Mono  | 1rem    | 500    | 1.5         | --text-mono      |

## Spacing System
Base unit: 4px

| Token   | Value | Usage                 |
|---------|-------|-----------------------|
| --sp-1  | 4px   | Tight inner padding   |
| --sp-2  | 8px   | Icon gaps             |
| --sp-3  | 12px  | Input padding         |
| --sp-4  | 16px  | Card padding          |
| --sp-6  | 24px  | Section gaps          |
| --sp-8  | 32px  | Page margins          |
| --sp-12 | 48px  | Section separators    |
| --sp-16 | 64px  | Major section gaps    |

## Shape & Radius
| Token          | Value | Usage              |
|----------------|-------|--------------------|
| --radius-sm    | 6px   | Chips, tags        |
| --radius-md    | 12px  | Inputs             |
| --radius-lg    | 24px  | Cards, panels      |
| --radius-xl    | 32px  | Modals, dialogs    |
| --radius-full  | 999px | Avatars, Buttons   |

## Component Tokens

### Glassmorphism (V2)
- Background: `rgba(20, 25, 40, 0.6)`
- Backdrop-filter: `blur(24px)`
- Border: `1px solid rgba(0, 240, 255, 0.15)`
- Shadow: `0 8px 32px rgba(0, 0, 0, 0.5)`

### Button (Cyber)
- Primary colors: `--color-primary`, `--color-bg` for text
- Radius: `--radius-full`
- Transition: `all 300ms cubic-bezier(0.34,1.56,0.64,1)`
- Hover: `scale(1.05)`, intense neon glow (`0 0 20px rgba(0, 240, 255, 0.4)`)
- Active: `scale(0.95)`

### Card (Floating Data Slate)
- Background: `var(--color-surface)`
- Border: `1px solid var(--color-border)`
- Radius: `var(--radius-lg)`
- Padding: `var(--sp-6)`
- Shadow: `0 10px 40px rgba(0,0,0,0.5)`
- Hover: `translateY(-4px)`, text shadow glow, border color shifts to `--color-primary`.

## Motion Tokens
| Token              | Value  | Usage                    |
|--------------------|--------|--------------------------|
| --duration-quick   | 150ms  | Micro-interactions       |
| --duration-normal  | 300ms  | State changes, glows, page transitions |
| --duration-slow    | 600ms  | Page loads, floating anims |
| --easing-default   | ease-out | Standard easing        |
| --easing-bounce    | cubic-bezier(0.34,1.56,0.64,1) | Buttons & interactive elements |
