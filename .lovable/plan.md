# ToyWorld Dashboard

## Overview
Build the first screen as a polished toy-store operations dashboard with a collapsible navigation rail, responsive header controls, at-a-glance performance metrics, sales analytics, order tracking, and inventory alerts.

## What will be built
- A responsive dashboard shell with collapsible desktop navigation and a compact mobile menu.
- Header controls for global search, store location, date range, and notifications.
- Four KPI cards: revenue with a sparkline, toys sold, active locations, and top category.
- Interactive sales trend visualization with daily, weekly, and monthly views.
- Sales-by-category donut chart with a clear legend and totals.
- Recent orders table with status filters and readable status badges.
- Low-stock alert list with working restock actions and confirmation feedback.
- Purposeful empty/filter states, responsive layouts, keyboard-friendly controls, and reduced-motion support.

## Visual direction
A crisp retail-operations look: light neutral workspace, dark navigation, strong coral and teal accents, compact data typography, restrained shadows, and playful toy-inspired details without becoming childish.

## Technical details
- Keep all dashboard behavior in the frontend using React state and local sample data.
- Use the existing TanStack route and Tailwind design-token system.
- Add a chart library only if needed; otherwise use lightweight responsive SVG charts.
- Add page-specific title, description, Open Graph, and Twitter metadata.
- Validate the live page at desktop and mobile sizes and resolve any diagnostics.
