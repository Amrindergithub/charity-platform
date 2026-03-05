# TrustChain — UI/UX Rules & Anti-Patterns

## Color System

### 60-30-10 Rule
- 60% Dominant: Surface/background colors (`#050505`, `#0E0E0E`, `#131313`)
- 30% Secondary: Text and structural elements (`#E5E2E1`, `#E4BEB1`)
- 10% Accent: CTAs, active states, highlights (`#FF5C00`, `#FFB955`)

### DO
- Ensure WCAG AA compliance (4.5:1 for text, 3:1 for large text)
- Use semantic color tokens (`--color-success`, `--color-error`, `--color-primary`)
- Test in dark mode (our primary mode)

### DON'T
- Use more than 3 primary colors
- Use pure black (#000) on pure white (#FFF) — too harsh
- Rely on color alone for information (add icons/text)
- Use low-contrast grey text

---

## Typography

### Font Stack
- **Headings:** Space Grotesk (variable, 300-900)
- **Body:** Inter (variable, 300-700)
- **Mono:** JetBrains Mono (wallet addresses, hashes, code)

### Weights
- 400 Regular (body text)
- 500 Medium (labels)
- 600 Semibold (emphasis)
- 700 Bold (headings)
- 900 Black (display/hero only)

### Rules
- All headings UPPERCASE with tight letter-spacing (-0.02 to -0.04em)
- Labels: uppercase, wide tracking (0.05-0.3em), 10-11px
- Body: 14-16px, regular/light weight, relaxed line-height
- Max 2 font families per view
- Max 5 font sizes per view
- Use 8px grid for spacing

---

## Animations & Interactions

### Button Interactions
- **Scale up:** `transform: scale(1.02)`
- **Lift:** `box-shadow` elevation + `translateY(-2px)`
- **Glow:** Outer glow on hover (`box-shadow` with brand color)
- **Timing:** 150-300ms
- **Easing:** `cubic-bezier(0.4, 0, 0.2, 1)`

### Input Focus States
- **Ring:** 2-4px outline with brand color at 50% opacity
- **Glow:** Soft box-shadow with brand color
- **Border shift:** Border color change (transparent → primary)
- **Always** visible focus indicators (min 3px outline, 3:1 contrast)

### Card Hover Effects
- **Lift + Shadow:** `translateY(-4px)` + shadow increase
- **Image zoom:** Scale image 1.05-1.1x inside container (overflow hidden)
- **Border reveal:** Ghost border brightens on hover
- **Duration:** 300ms transition

### Scroll Animations
- **Fade up:** opacity 0→1 + translateY(20px→0)
- **Stagger delay:** 100ms between elements
- **Trigger:** When element is 20% in viewport
- **Duration:** 600ms, ease-out
- **Parallax:** Subtle only, max 20-30px movement, use `transform` not `position`

### Page Transitions
- **Fade:** opacity transition 200ms
- **Modal entrance:** Backdrop opacity 0→1 (200ms), then content scale(0.95→1) + opacity (300ms)
- **Modal exit:** Reverse, faster (200ms)

### Loading States
- **Skeleton loaders:** Shimmer effect, shape matches final content
- **Shimmer:** Linear gradient animation, 1.5s infinite ease-in-out
- **Spinners:** Rotating circle with gradient, 1-2s infinite

### Glassmorphism (Solar Nocturne Spec)
```css
backdrop-filter: blur(40px) saturate(150%);
background: rgba(14, 14, 14, 0.2);
border: 1px solid rgba(91, 65, 55, 0.15);
```

### Performance Rules
**DO:**
- Use `transform` and `opacity` only (GPU accelerated)
- Set `will-change` for animated elements
- Use CSS animations over JS when possible
- Debounce scroll events
- Test on low-end devices
- Respect `prefers-reduced-motion`

**DON'T:**
- Animate `width`, `height`, or `position`
- Use animations longer than 500ms for interactions
- Animate during user input
- Use too many simultaneous animations
- Animate on scroll without throttling

---

## Anti-Patterns: What to AVOID

### Design Anti-Patterns
- No animations that block user action
- No transitions longer than 300ms for interactions
- No auto-playing videos with sound
- No infinite scroll without pagination option
- No inconsistent spacing (use 8px grid)

### Low Contrast Crimes
- No light grey on white backgrounds
- No pure white text on pure black (too harsh)
- WCAG AA minimum (4.5:1 for text)
- Test with color blindness simulators

### Mystery Meat Navigation
- Icons MUST have labels or tooltips
- No hamburger menus on desktop
- No hidden navigation without clear affordance

### Mobile Hostility
- No tiny tap targets (minimum 44x44px)
- No horizontal scrolling (unless intentional carousel)
- No hover-dependent interactions on touch
- No fixed elements that cover content

### Performance Sins
- No unoptimized images (use WebP, lazy loading)
- No render-blocking resources
- No layout shifts (CLS > 0.1)
- No heavy animations on page load

### Form Frustrations
- No labels inside inputs only (accessibility issue)
- No "clear all" without confirmation
- No validation only on submit (use inline validation on blur)
- No disabled submit buttons without explanation (show errors instead)

### Content Crimes
- No walls of text without hierarchy
- No auto-playing carousels
- No "click here" links (use descriptive text)

### Accessibility Failures
- No keyboard navigation traps
- No missing alt text on images
- No color-only information conveyance
- No auto-focus on page load (except search)
