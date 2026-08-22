# Peppy Assistive Design System

Peppy is a calm daily-life assistant for disabled, neurodivergent, chronically ill, and cognitively overloaded people. Accessibility is the product architecture, not a display setting.

## Experience contract

1. Ask for the minimum information needed for the next useful action.
2. Prefer recognition over recall: choices, recent items, defaults, autofill, and confirmation.
3. Show one primary action per view. Secondary actions are Help, Not now, and Back.
4. Save after every choice. Never make the user repeat completed setup.
5. Always provide a low-energy path with fewer steps and no penalty language.
6. Explain what will happen before an action and confirm what happened afterward.
7. Never diagnose, prescribe, shame, score a person, or imply failure.
8. Let the person choose a trusted helper and exactly what that helper can see or do.
9. Support keyboard, switch control, screen readers, voice input, zoom, large type, high contrast, reduced motion, and slow networks.
10. Keep urgent help reachable without navigating away from the current task.

## Visual direction

- Light-first, calm, familiar, and spacious. Dark mode is supported but never the only comfortable theme.
- Body text: 18px default, 1.6 line height; never below 16px for meaningful content.
- Text width: 35–65 characters.
- Touch targets: 48px minimum, 12px minimum separation for primary choices.
- Radius: 14px for cards and actions; boundaries remain visible in high contrast.
- Motion: none by default beyond 150ms colour/opacity state feedback. No entrance choreography.
- Icons: Lucide outline icons with text labels. Never icon-only for primary actions.
- Colour never carries meaning alone.

## Semantic colour tokens

| Role | Light | Dark | Use |
|---|---|---|---|
| Page | #F6F7F2 | #171A1F | Quiet background |
| Surface | #FFFFFF | #22262D | Cards and controls |
| Ink | #18201D | #F5F7F5 | Primary text |
| Muted ink | #4E5B55 | #C3CBC7 | Supporting text |
| Primary | #275D50 | #8FCDBB | Primary action and focus |
| Support | #E7F2ED | #263B35 | Reassuring supporting state |
| Attention | #8A571B | #FFD18A | Needs review, never alarm |
| Danger | #9F2F35 | #FFB4B7 | Destructive or urgent |
| Rule | #B8C2BD | #59635E | Visible boundaries |

Every foreground/background pairing must be verified independently at WCAG 2.2 AA; target AAA for body copy where practical.

## Core components

### Guided choice
A plain-language question, up to three 64px choices, optional “I’m not sure,” and a visible Back action. Selecting a choice saves and advances.

### Today card
Shows only: what to do, why it matters (optional), when, and the next action. Actions: Done, Help me, Not now.

### Low-energy day
Reduces Today to essential safety and care tasks selected by the person. It is a valid mode, never a failed day.

### Quick capture
Offers Talk, Take a photo, Choose recent, or Type. Typing is always last, never required when another input works.

### Trusted help
Permission is granular, time-bound where possible, revocable, and written in plain language. Peppy always states who will be notified.

## Navigation

Four labelled top-level destinations maximum: Today, Plan, Capture, Support. Settings live inside Support. On wider screens the same hierarchy becomes a rail; it does not change meaning.

## Form and feedback rules

- Visible labels, semantic input types, autofill, and examples outside placeholders.
- Validate after leaving a field or submitting, never while typing.
- Errors state what happened and provide Retry, Change, or Ask for help.
- Long work autosaves. Confirm with “Saved” plus what changed.
- Destructive actions offer Undo wherever possible.
- Loading keeps the page shape and names what is loading.
- Offline mode preserves captured information and shows when it will retry.

## Forbidden patterns

No streak pressure, guilt copy, red/green-only state, hidden gestures, drag-only interaction, countdown urgency, unsolicited animation, required long forms, ambiguous icons, auto-playing audio, or AI claims that imply professional care.