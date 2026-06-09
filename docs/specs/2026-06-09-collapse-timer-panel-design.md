# Collapse Timer Panel Design

## Goal

Let user hide timer panel in current social-media tab for one minute.

## Interaction

- Add circular collapse button centered on panel top edge.
- Button uses downward chevron and accessible label.
- Panel remains non-interactive except collapse button.
- Clicking button hides entire panel, including button, for one minute.
- Timer continues counting while panel is hidden.
- Panel returns automatically after one minute.

## Scope and Persistence

- Collapse applies only to current tab.
- Store hide-expiry timestamp in page `sessionStorage`.
- Hide state survives reloads and same-tab navigation while expiry remains active.
- Closing tab clears hide state.
- Missing, malformed, or expired values show panel normally.

## Testing

- Hide-expiry parsing and validation.
- Active hide state.
- Expired hide state.
- One-minute expiry generation.
- Collapse button presence, placement, and clickability.
- Automatic panel return.

## Acceptance Criteria

- Circular collapse button appears centered on timer panel top edge.
- Clicking button hides entire panel for one minute in current tab only.
- Reload/navigation in same tab preserves remaining hidden duration.
- Panel returns automatically after expiry.
- Timer accounting continues unchanged while hidden.
