# Ticketflow Privacy Policy

**Last updated:** 2026-02-17

---

## Overview

Ticketflow is a local-first desktop application. All your project data — backlogs, tickets, notes, and attachments — stays on your machine. Nothing is uploaded to external servers unless you explicitly use an AI provider you configure yourself.

Ticketflow can optionally collect anonymous usage data to help the development team understand how the application is used and prioritize improvements. This is entirely optional and requires your explicit consent.

---

## Telemetry

Telemetry collection is disabled by default. You will be asked on first launch whether you want to help improve Ticketflow by sharing anonymous usage data. You can change this decision at any time in **App Settings > Privacy**.

No data is sent to PostHog or any other service before you make a choice.

---

## What We Collect

If you accept telemetry, we collect:

- **Feature usage patterns** — which views you use (Kanban, List, Graph, Dashboard), which tools you open, and which AI providers you have configured
- **Anonymous error reports** — when an unexpected error occurs, we send the error message (first 200 characters only). No stack traces, no file paths, no project context.
- **App version and platform** — the version of Ticketflow you are running, and whether you are using the desktop (Tauri) or web version
- **Anonymous device identifier** — a randomly generated UUID stored in your browser's localStorage. This is not linked to your identity, your machine, or any account. It exists solely to deduplicate events (e.g., to count unique users rather than total events).

All events include these properties. No other data is collected.

---

## What We Never Collect

We do not collect and will never collect:

- **File contents** — your backlog markdown files, ticket descriptions, acceptance criteria, or any project content
- **Project names or paths** — the names of your projects or their file system locations
- **API keys or credentials** — your Groq, Gemini, OpenAI, or other provider API keys
- **Personally identifiable information** — no name, email address, IP address, or any other information that could identify you
- **Browsing activity or screen content** — Ticketflow does not instrument `window.fetch`, does not use autocapture, and does not record sessions
- **Clipboard contents** — nothing you copy or paste is transmitted

---

## How Data Is Processed

Events are sent to **PostHog** (EU data center, `eu.i.posthog.com`) for aggregation and analysis. PostHog is used in anonymous, cookieless mode.

In desktop mode (Tauri), events are first passed to a local Rust process (`ph_send_batch`) which forwards them to PostHog using the system's network stack. This is necessary because Tauri's embedded WebView has restrictions on direct outbound network calls.

In web mode (browser), events are sent directly to the EU PostHog endpoint via `fetch`.

No third-party trackers, advertising networks, or analytics resellers are involved. PostHog does not receive any information that could identify you personally.

---

## Your Rights

You have full control over telemetry:

- **Decline on first launch** — if you click "Decline" or dismiss the consent dialog twice, no data is ever collected
- **Toggle telemetry off at any time** — go to **App Settings > Privacy** and turn the toggle off. Data collection stops immediately upon revocation. No further events are sent.
- **Re-enable telemetry** — use the same toggle to re-enable. No friction, no additional prompts.
- **Right to erasure** — since no PII is collected and the device ID is anonymous, there is nothing to erase that could be traced back to you. If you want to reset your anonymous device ID, clear your localStorage for the Ticketflow app.

---

## Data Retention

Anonymous event data is retained for **90 days** in PostHog, then automatically deleted. No data is archived beyond this window.

---

## Contact

If you have questions about this privacy policy or data practices, please open an issue on the Ticketflow GitHub repository:

**https://github.com/Bouaris/ticketflow/issues**

---

## Changes to This Policy

This policy may be updated as Ticketflow evolves. Any changes will be noted in the application changelog (`CHANGELOG.md`) and will be reflected in the "Last updated" date at the top of this document.

We will not introduce new categories of data collection without updating this policy and (if the change is material) prompting you again for consent.
