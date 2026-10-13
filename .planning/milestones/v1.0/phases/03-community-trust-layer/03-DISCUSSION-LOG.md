# Phase 3 Discussion Log

**Date:** 2026-07-09
Human-reference audit trail. Not consumed by downstream agents (see 03-CONTEXT.md for the canonical decisions).

## Areas discussed (all 4 selected)

### 1. Review trigger & timer
- Options: from check-out date / from accept date / explicit "stay completed" event
- **Chosen:** From check-out date — review window opens after `StayRequest.checkOut`; 14-day timer anchored on checkOut. Reuses an existing field, real "stay happened" signal, no new infra.

### 2. Blind-release mechanism (REVW-03)
- Options: lazy-on-read / cron scheduled job / hybrid
- **Chosen:** Lazy-on-read — visibility computed at read time (both submitted OR now−checkOut ≥ 14d). No scheduler infra (MVP has none); cannot leak early.

### 3. Review form
- Options: stars 1-5 + text / text only / stars + text editable
- **Chosen:** Stars 1-5 + text, immutable after submit, aggregated to profile (avg + count) after reveal.

### 4. Feed scope & moderation
- Options: global + Report / city-scoped / global without Report
- **Chosen:** Global feed, reverse-chronological + pagination; moderation via Report (01-07); deletion by author + admin.

## Claude's discretion (documented in CONTEXT)
Comments in separate collection; idempotent likes + likeCount; feed/comments/likes REST for MVP; Report extended with target discriminator; optional comment push; review write rejects before checkOut or on duplicate.

## Deferred
Real-time feed, post search/hashtags, meetups, multi-photo/video posts, exact-moment reveal push.
