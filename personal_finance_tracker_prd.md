
# Product Requirements Document: Personal Finance Tracker

## 1. Executive Summary

### Product Vision
A web-based personal finance tracking application that empowers users to gain insights into their spending patterns by uploading bank statements and viewing automated categorization and visualizations.

### Target User
Individuals who want to understand their personal spending habits without connecting directly to financial institutions via APIs, preferring manual control over data sharing.

### Core Value Proposition
- **Privacy-first**: No direct bank connections required
- **Flexibility**: Support for multiple financial institutions through statement uploads
- **Actionable insights**: Automated categorization and visual analytics
- **User control**: Complete ownership of financial data

---

## 2. Goals & Success Metrics

### Primary Goals
1. Enable users to easily upload and parse bank statements from multiple sources
2. Automatically categorize transactions with high accuracy
3. Provide clear visualizations of spending patterns
4. Support multi-account tracking in one unified view

### Success Metrics
- **Adoption**: User creates account and uploads first statement within 5 minutes
- **Engagement**: Users upload statements at least monthly
- **Accuracy**: 85%+ transaction categorization accuracy (user-validated)
- **Retention**: 60% of users return monthly for 3+ consecutive months
- **Satisfaction**: NPS score of 40+

---

## 3. User Personas

### Primary Persona: "Budget-Conscious Bill"
- **Demographics**: 30-45, professional, manages multiple accounts
- **Goals**: Understand where money goes, identify savings opportunities
- **Pain Points**: 
  - Current banking apps don't consolidate all accounts
  - Spreadsheets are too manual and time-consuming
  - Doesn't trust third-party apps with direct bank access
- **Behaviors**: Reviews finances monthly, downloads statements regularly

### Secondary Persona: "Financial Optimizer"
- **Demographics**: 25-40, high earner, multiple income streams
- **Goals**: Optimize spending across categories, track investment allocations
- **Pain Points**: Needs granular categorization, wants year-over-year comparisons
- **Behaviors**: Active financial management, uses multiple tools

---

## 4. Core Features & Requirements

### 4.1 User Authentication & Account Management

**Implemented approach (shipped):**
- **Magic-link authentication** — no passwords. Users enter their email and receive a time-limited sign-in link (15-minute expiry). No credentials stored.
- **Household model** — each sign-up creates a household. Multiple users can share one household via invitation. All financial data is scoped to the household, not the individual user.
- **Invite flow** — admins enter an invitee's email address; an accept-invite link is emailed directly to them via SMTP (Resend). Link expires in 7 days, single-use.
- **Role-based access** — two roles: `admin` and `member`. The first user to create a household is automatically admin. Invited users join as members. Admins can promote members to admin from the Settings page.
- **Admin-only actions** — sending invites, revoking invites, removing members, changing household settings. The Settings page is hidden entirely from non-admin members.
- **Session management** — HTTP-only secure cookie, 30-day TTL in production, invalidated on logout.
- **SMTP** — Resend via SMTP (port 465 / implicit TLS). Sending domain: `mcconnalino.com` (verified).

**Priority:** P0 (Must Have) — shipped Phase 1 (dev resolver) + Phase 4 (magic-link, roles, invites)

---

### 4.2 Statement Upload & Parsing

**Requirements:**

**File Upload:**
- Support common formats: CSV, PDF, OFX, QFX
- Drag-and-drop interface + traditional file picker
- Multi-file upload capability (batch processing)
- File size limit: 10MB per file, 50MB per batch
- Clear upload progress indicators

**Statement Parsing:**
- Automatic detection of file format and institution
- Extract key data points:
  - Transaction date
  - Description/merchant
  - Amount (debit/credit)
  - Balance (if available)
  - Account identifier
- Handle various CSV formats (different column orders, headers)
- PDF parsing for standard bank statement layouts
- Error handling with clear user feedback for unparsable files

**Account Linking:**
- Allow users to map uploaded files to specific accounts
- Create new accounts on-the-fly during upload
- Support account nicknames/custom labels
- Account types: Checking, Savings, Credit Card, Investment

**Data Quality:**
- Duplicate detection (same transaction uploaded multiple times)
- Date range validation
- Currency normalization (assume USD initially, plan for multi-currency)

**Priority:** P0 (Must Have)

---

### 4.3 Transaction Management

**Requirements:**

**Transaction List View:**
- Paginated table of all transactions across all accounts
- Filterable by:
  - Date range (preset ranges + custom)
  - Account
  - Category
  - Amount range
  - Transaction type (debit/credit)
  - Merchant/description (search)
- Sortable by date, amount, merchant, category
- Bulk selection for batch operations

**Transaction Editing:**
- Edit individual transaction fields:
  - Category (required)
  - Description/notes
  - Tags (multi-tag support)
  - Split transactions (assign portions to different categories)
- Save category rules: "Always categorize [Merchant X] as [Category Y]"
- Undo capability for recent edits

**Transaction Details:**
- Click-through to detailed view
- Show original statement data vs. edited data
- Edit history/audit trail

**Priority:** P0 (Must Have)

---

### 4.4 Automatic Categorization

**Requirements:**

**Default Category System:**
- Pre-defined hierarchy:
  - **Housing**: Rent/Mortgage, Utilities, Home Maintenance, Insurance
  - **Transportation**: Gas, Public Transit, Car Payment, Parking, Maintenance
  - **Food**: Groceries, Restaurants, Coffee Shops, Delivery
  - **Healthcare**: Medical, Dental, Pharmacy, Insurance
  - **Personal**: Clothing, Personal Care, Entertainment, Subscriptions
  - **Financial**: Bank Fees, Interest, Transfers, Investments
  - **Income**: Salary, Freelance, Investment Income, Other
  - **Uncategorized**: Default catch-all

**Categorization Logic (shipped):**
- **Phase 1 — Rules engine**: Rule-based matching on merchant/description (contains, equals, regex). User-defined rules always take precedence over LLM results.
- **Phase 2 — LLM categorization**: Transactions not matched by a rule are sent in batches of 20 to Claude Haiku (Anthropic API) for categorization. The system prompt includes the household's category list and up to 30 recent user corrections as few-shot examples, improving accuracy over time.
- **Confidence thresholds**: LLM results with confidence ≥ 0.85 are applied to the transaction. Results with confidence ≥ 0.90 that include a match term are automatically promoted to new rules, reducing future LLM calls.
- **Graceful fallback**: If the Anthropic API is unavailable or the key is not set, imports fall back to rules-only categorization without error.
- **User feedback loop**: Users can mark any auto-categorized transaction as `correct` or `incorrect` via inline thumbs in the transaction list. Feedback is stored on the transaction and used as few-shot examples in future LLM calls. Thumbs-down records the signal without interrupting the user's flow.
- **Confidence scoring**: `auto_categorized` flag and `confidence_score` (0–1) stored on each transaction.

**Customization:**
- Users can create custom categories and subcategories
- Edit/merge/delete categories
- Bulk recategorization tools

**Priority:** P0 (Must Have)

---

### 4.5 Data Visualization & Insights

**Requirements:**

**Dashboard Overview:**
- Summary cards:
  - Total income (current month)
  - Total expenses (current month)
  - Net cashflow (current month)
  - Largest expense category
  - Account balances (if available from statements)
- Time period selector (month, quarter, year, custom range)

**Core Visualizations:**

1. **Spending by Category (Pie Chart)**
   - Interactive: click to drill into subcategories
   - Percentage and dollar amounts
   - Exclude income and transfers

2. **Spending Over Time (Line/Bar Chart)**
   - Monthly trends
   - Compare current vs. previous period
   - Stacked view by category

3. **Income vs. Expenses (Bar Chart)**
   - Side-by-side monthly comparison
   - Running balance projection

4. **Category Trends (Line Chart)**
   - Track specific categories over time
   - Identify unusual spikes

5. **Top Merchants (Bar Chart)**
   - Ranked by total spending
   - Filterable by category and time period

**Insight Cards:**
- "You spent 23% more on dining this month than last month"
- "Your largest recurring charge is $X to [Merchant]"
- "You haven't categorized X transactions"

**Priority:** P0 (Must Have for initial visualizations), P1 (Nice to Have for advanced insights)

---

### 4.6 Account Management

**Requirements:**
- Create, edit, delete financial accounts
- Account properties:
  - Name/nickname
  - Type (checking, credit card, etc.)
  - Institution name
  - Last four digits (optional, for reference)
  - Opening balance
  - Current balance (calculated from transactions)
- Account archive (soft delete for historical accounts)
- Account overview page showing all accounts with balances

**Priority:** P0 (Must Have)

---

### 4.7 Data Export & Backup

**Requirements:**
- Export transactions to CSV (filtered or all)
- Export visualizations as images (PNG/JPG)
- Full account backup (JSON format with all data)
- Schedule automated exports (email delivery)

**Priority:** P1 (Nice to Have)

---

### 4.8 Settings & Preferences

**Implemented (admin-only — shipped Phase 4):**
- Settings page is only accessible to users with the `admin` role. Non-admin members do not see the Settings tab.
- **Household settings**: default dashboard time period (`current`, `previous`, `latest_data`) and chart month range (3, 6, or 12 months).
- **Member management**: view all household members with their role and join date. Admins can remove members or promote members to admin. An admin cannot remove or demote themselves.
- **Invite management**: send invite emails to new members, view pending invites with expiry dates, revoke pending invites.

**Not yet implemented:**
- Time zone and currency preferences
- Email notification preferences
- Data retention policy / account deletion

**Priority:** P1 (Nice to Have)

---

## 5. Non-Functional Requirements

### 5.1 Security
- All data encrypted in transit (HTTPS/TLS)
- All data encrypted at rest
- Secure password hashing (bcrypt or Argon2)
- Protection against common vulnerabilities (OWASP Top 10)
- Regular security audits
- No storage of raw bank credentials
- Session timeout after 30 minutes of inactivity

### 5.2 Performance
- Page load time < 2 seconds for dashboard
- File upload processing < 5 seconds for typical CSV (100 transactions)
- Support up to 10,000 transactions per user without performance degradation
- Chart rendering < 1 second

### 5.3 Scalability
- Architecture supports multi-tenancy
- Database design supports horizontal scaling
- File storage on scalable object storage (S3 or equivalent)

### 5.4 Accessibility
- WCAG 2.1 Level AA compliance
- Keyboard navigation support
- Screen reader compatible
- Sufficient color contrast ratios

### 5.5 Browser Support
- Modern browsers: Chrome, Firefox, Safari, Edge (last 2 versions)
- Responsive design: desktop, tablet, mobile

### 5.6 Data Privacy
- GDPR compliance considerations
- Clear privacy policy
- User data portability
- Right to deletion
- No third-party data sharing without explicit consent

---

## 6. Technical Architecture

> All decisions below are locked. Do not re-propose alternatives.

### 6.1 Frontend (locked)
- **Framework**: React 18 + Vite
- **Charting**: Recharts
- **State / Data fetching**: TanStack Query
- **Styling**: Tailwind CSS
- **Language**: TypeScript

### 6.2 Backend (locked)
- **Runtime**: Node.js 22 + TypeScript
- **API framework**: Fastify
- **ORM**: Drizzle ORM
- **Job queue**: pg-boss (Postgres-backed)
- **Authentication**: Magic-link via email (nodemailer + Resend SMTP). HTTP-only session cookie.
- **AI categorization**: Anthropic API (Claude Haiku) via `@anthropic-ai/sdk`

### 6.3 Database (locked)
- **Primary**: PostgreSQL 16
- **Key tables**: households, users (with role), accounts, transactions (with auto_categorized, confidence_score, categorization_feedback), categories, rules, magic_tokens, sessions, household_invites, budgets, savings_goals, recurring_bills

### 6.4 Monorepo structure (locked)
- `packages/api` — Fastify server, Drizzle migrations
- `packages/web` — Vite + React SPA
- `packages/shared` — Zod schemas and shared types

### 6.5 Hosting (locked)
- **Platform**: Fly.io (`pennywise-app`)
- **Custom domain**: `pennywise.mcconnalino.com` (TLS via Let's Encrypt / Fly certs)
- **Email**: Resend (domain: `mcconnalino.com`)

---

## 7. User Experience & Design

### 7.1 Key User Flows

**First-Time User Flow:**
1. Landing page → Sign up
2. Welcome screen with quick tour
3. "Upload Your First Statement" prompt
4. Upload statement → parsing → review parsed data
5. Automatic categorization preview
6. Dashboard with first insights

**Returning User Flow:**
1. Login → Dashboard
2. View spending insights
3. Upload new statement (if needed)
4. Review/correct categorizations
5. Explore visualizations

### 7.2 Design Principles
- **Simplicity**: Minimal clicks to accomplish tasks
- **Clarity**: Clear labeling, no financial jargon
- **Confidence**: Show data source, transparency in calculations
- **Progressive disclosure**: Advanced features available but not overwhelming

---

## 8. Implementation Phases

### Phase 1: MVP (Months 1-2)
- User authentication
- Single CSV upload and parsing
- Basic manual categorization
- Simple transaction list
- One visualization: spending by category (pie chart)
- Single account support

**Success Criteria**: Can upload CSV, categorize transactions, see basic breakdown

### Phase 2: Core Features (Months 3-4)
- Multiple file format support (PDF, OFX)
- Automatic categorization with rules
- Multiple account support
- Full dashboard with 3-4 core visualizations
- Transaction editing and management

**Success Criteria**: Daily usable for personal finance tracking

### Phase 3: Polish & Insights (Months 5-6)
- Advanced visualizations
- Insight generation
- Data export
- Performance optimization
- Mobile responsiveness

**Success Criteria**: Feature-complete for target users

### Phase 4: Enhancement (Ongoing) — shipped 2026-05-21

- ✅ **LLM categorization** — Claude Haiku categorizes unmatched transactions at import; high-confidence results auto-promote to rules; household correction history used as few-shot examples.
- ✅ **User feedback integration** — Inline thumbs up/down on auto-categorized transactions in the transaction list. Thumbs-down records `incorrect` without interrupting flow. Feedback feeds back into the LLM as few-shot examples.
- ✅ **Admin roles** — `admin` / `member` roles on users. Settings page restricted to admins. Admins can invite members, remove members, and promote members to admin.
- ✅ **Budgeting features** — Monthly budgets per category with progress tracking.
- ✅ **Goal tracking** — Savings goals with target amounts and deadlines.
- ✅ **Bill reminders** — Recurring bill tracking with due-date awareness.
- ✅ **Magic-link auth** — Replaced dev-resolver with production magic-link sign-in via Resend.
- ✅ **Custom domain** — Live at `https://pennywise.mcconnalino.com`.

---

## 9. Open Questions & Decisions

### Technical Decisions
- [ ] Which PDF parsing library? (intentionally deferred — CSV-only for now)
- [x] Client-side vs server-side file parsing? → **Server-side** (Fastify route, streamed multipart)
- [x] Real-time vs batch transaction processing? → **Synchronous** for CSV (fast enough); pg-boss queue available for heavier future work

### Product Decisions
- [x] Should we support bank API connections? → **No** — privacy-first, upload-only. Plaid/Yodlee listed as future consideration only.
- [ ] Multi-currency support priority? → Not yet addressed
- [x] Budgeting features timing? → **Shipped Phase 2/3**
- [x] Shared account access? → **Shipped Phase 4** via household model + invite flow + admin roles

### Business Decisions
- [ ] Pricing model: Free tier + premium? Freemium? Subscription?
- [ ] Data retention policy: unlimited or time-limited?
- [ ] Support model: self-service vs. email support?

---

## 10. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Parsing accuracy too low | High | Medium | Extensive testing with real statements, manual override options |
| Security breach | Critical | Low | Security audit, penetration testing, encryption, regular updates |
| Poor categorization accuracy | Medium | Medium | Improve rules engine, add ML, make manual override easy |
| Low user adoption | High | Medium | User testing, clear value prop, frictionless onboarding |
| Scalability issues | Medium | Low | Design for scale from start, load testing |
| File format incompatibility | Medium | High | Support most common formats, clear error messages, template examples |

---

## 11. Success Criteria & KPIs

### Launch Readiness
- [ ] 95% uptime in staging for 2 weeks
- [ ] Successful parsing of 20+ different bank statement formats
- [ ] Security audit completed with no critical issues
- [ ] User testing with 10+ participants, >80% task completion rate

### Post-Launch (3 months)
- 100+ active users
- 75%+ transactions categorized automatically
- <5% error rate in parsing
- Average user uploads statements at least monthly
- User satisfaction score >4/5

---

## 12. Future Considerations

### Potential Enhancements
- Mobile app (iOS/Android)
- Bank API integrations (Plaid, Yodlee)
- Budgeting and goal-setting features
- Bill tracking and reminders
- Investment portfolio tracking
- Tax preparation assistance (export for accountant)
- Household/multi-user accounts
- AI-powered financial advice
- Recurring transaction detection and prediction
- Cashflow forecasting

### Monetization Options
- Freemium: Basic free, premium features for $5-10/month
- One-time purchase for lifetime access
- Pay-per-feature model
- White-label for financial advisors

---

## Appendix A: Sample Transaction Data Model

```
Transaction {
  id: UUID
  user_id: UUID (foreign key)
  account_id: UUID (foreign key)
  transaction_date: Date
  post_date: Date (optional)
  amount: Decimal
  type: Enum (debit, credit)
  description: String
  merchant: String (parsed/normalized)
  category_id: UUID (foreign key)
  subcategory_id: UUID (optional)
  notes: Text (user-added)
  tags: Array<String>
  original_description: String (from statement)
  auto_categorized: Boolean
  confidence_score: Float (0-1)
  categorization_feedback: Enum(correct, incorrect) | null  // set via inline thumbs UI
  splits: Array<TransactionSplit> (optional)
  created_at: Timestamp
  updated_at: Timestamp
}

User {
  id: UUID
  email: String
  household_id: UUID (foreign key)
  role: Enum(admin, member)  // first user in household is admin; invited users are member
  created_at: Timestamp
  updated_at: Timestamp
}
```

---

## Appendix B: Competitive Analysis Summary

**Mint** (free, bank API-connected)
- Strengths: Automatic syncing, bill tracking, budgeting
- Weaknesses: Privacy concerns, ads, requires bank credentials

**YNAB** ($99/year, bank API or manual)
- Strengths: Strong budgeting methodology, active community
- Weaknesses: Expensive, steeper learning curve

**Personal Capital** (free, bank API-connected)
- Strengths: Investment tracking, net worth focus
- Weaknesses: Aggressive upselling to wealth management

**Your App's Differentiation:**
- Privacy-first (no direct bank connections)
- One-time or low-cost subscription
- Simple, focused on spending insights vs. comprehensive budgeting
- User controls all data sharing

---

*Document Version: 2.0*  
*Last Updated: May 21, 2026*  
*Owner: Bill (Product Manager)*
