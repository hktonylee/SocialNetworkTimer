# Timer Panel Height Design

## Goal

Make bottom glass timer panel occupy at least 20% of viewport height and scale timer digits with viewport height.

## Design

- Set timer panel minimum height to `20vh`.
- Center digits vertically and horizontally with flexbox.
- Scale digits with `font-size: clamp(64px, 12vh, 140px)`.
- Let panel width expand around scaled digits.
- Keep bottom anchoring, rounded top corners, red digits, and glass styling unchanged.

## Acceptance Criteria

- Glass panel occupies at least bottom 20% of viewport.
- Timer digits remain centered.
- Timer digits scale with viewport height.
- Timer remains readable without horizontal overflow on small screens.
