# Product Overview

Buisnez is a Pakistan-first local discovery and review platform: think "Yelp for Pakistan." Customers search
for and review local businesses; business owners claim and manage their listings.

## Users

- **Customer** — browses, searches, reviews, favorites, and reports businesses. No approval needed to sign up.
- **Business Owner** — everything a customer can do, plus manages businesses they have claimed (profile,
  hours, photos, replies to reviews).
- **Admin** — moderates listings, reviews, claims, and reports; manages categories and features.

A single account can hold only one role at a time (`User.role`). A user becomes a `BUSINESS_OWNER` implicitly
once an admin approves their first business claim (see [`10-auth-roles.md`](10-auth-roles.md)).

## Geography model

Pakistan is modeled as a strict three-level hierarchy:

```
Province (e.g. Punjab, Sindh)
  └─ City (e.g. Lahore, Karachi) — has a centroid point
       └─ Area (e.g. Gulberg, DHA Phase 5, Clifton) — a neighborhood/locality within a city
```

Every `Business` belongs to exactly one Province/City, and optionally one Area, plus its own precise
coordinate (`Business.location`). Seed data should cover all Pakistan provinces and the major cities within
each (see `packages/database/prisma/seed.ts`), with a handful of common areas per major city.

## Category tree

Categories form a two-level tree (top-level category → subcategories). A `Business` belongs to exactly one
leaf category. This is the canonical Phase 1 tree; new categories can be added later without a schema change.

1. **Food & Dining** — Restaurants, Cafes & Coffee, Fast Food, Bakeries & Sweets, Street Food, Catering
2. **Health & Medical** — Hospitals, Clinics, Dentists, Pharmacies, Diagnostic Labs, Physiotherapy
3. **Beauty & Wellness** — Salons, Spas, Barbershops, Gyms & Fitness, Tattoo Studios
4. **Home Services** — Electricians, Plumbers, AC Repair, Cleaning Services, Carpenters, Painters
5. **Automotive** — Car Workshops, Car Wash, Tyre Shops, Car Dealers, Bike Mechanics
6. **Shopping & Retail** — Clothing, Electronics, Grocery Stores, Mobile Shops, Furniture
7. **Education** — Schools, Colleges & Universities, Tuition Centers, Language Academies, Driving Schools
8. **Professional Services** — Lawyers, Accountants, Real Estate Agents, IT Services, Photographers
9. **Travel & Hospitality** — Hotels & Guest Houses, Travel Agents, Car Rentals, Wedding Halls
10. **Entertainment & Events** — Event Planners, Cinemas, Parks & Recreation, Videographers

## Feature list (amenities)

A flat, business-agnostic tag list, many-to-many with `Business` via `BusinessFeature`:

Free WiFi, Parking Available, Home Delivery, Card Payment Accepted, Cash on Delivery, Outdoor Seating,
Family Section, Air Conditioned, Wheelchair Accessible, Open 24 Hours, Takes Reservations, Halal Certified.

## Core entities (Phase 1 scope)

- **Business** — the listing: name, category, location, contact info, hours, status (moderation lifecycle).
- **Review** — a 1–5 star rating with optional text, owned by a user, attached to a business.
- **Photo** — attached to a business or a review.
- **Favorite** — a user bookmarking a business.
- **Claim** — a user asserting ownership of an unclaimed (or disputed) business; reviewed by an admin.
- **Report** — a user flagging a business or review for moderation (spam, fake, closed, duplicate, other).

Money, wherever it appears (e.g. future paid placements), is always integer paisa — see
[`15-conventions.md`](15-conventions.md).

## Out of scope for Phase 1

Payments, paid placements/ads, messaging between users and business owners, and the mobile app are out of
scope. Phase 1 delivers the schema and auth only; search, business/category CRUD, reviews, claims, and admin
moderation endpoints are later phases (see [`16-ai-prompts.md`](16-ai-prompts.md)).
