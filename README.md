# Academia LMS

Academia is a bilingual school management platform for Moroccan schools. It brings academic records, attendance, homework, timetables, fees, communication, and school settings into one role-based workspace.

The public experience and dashboards are available in French and Arabic, with automatic left-to-right and right-to-left layout support.

## Features

- Role-based workspaces for directors, supervisors, teachers, students, and parents
- Academic year, semesters, cycles, levels, classes, subjects, and coefficients
- Grade entry, weighted averages, rankings, mentions, and report cards
- Attendance tracking, justifications, discipline, and notifications
- Homework, submissions, announcements, messages, and timetables
- Fees, payments, installments, receipts, and financial tracking
- Massar-compatible identifiers and spreadsheet-oriented workflows
- French and Arabic localization with RTL support
- Configurable school identity, colors, rules, and Ramadan schedules
- Credentials-based authentication with JWT sessions

## Stack

- [Next.js 16](https://nextjs.org/) with the App Router
- React 19 and TypeScript
- [Prisma 7](https://www.prisma.io/) with PostgreSQL
- NextAuth credentials authentication
- `next-intl` for French and Arabic localization
- Tailwind CSS 4 and `lucide-react`
- Vitest for tests and ESLint for code quality

## Requirements

- Node.js 20 or newer
- pnpm 10 or newer
- PostgreSQL 14 or newer

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure the database

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/academia"
```

The database must exist before running Prisma commands.

### 3. Generate the Prisma client and migrate

```bash
pnpm db:generate
pnpm db:migrate
```

### 4. Seed development data

```bash
pnpm db:seed
```

The seed creates a Moroccan school structure, academic data, staff, students, parents, and demo records.

### 5. Start the development server

```bash
pnpm dev
```

Open [http://localhost:3000/fr](http://localhost:3000/fr) for the French experience or [http://localhost:3000/ar](http://localhost:3000/ar) for the Arabic experience.

## Demo Accounts

All seeded accounts use the password `Passw0rd!`.

| Role | Email |
| --- | --- |
| Director | `directeur@academia.ma` |
| Supervisor | `surveillant@academia.ma` |
| Teacher | `prof.maths@academia.ma` |
| Student | `eleve1@academia.ma` |
| Parent | `parent1@academia.ma` |

Do not use seeded credentials in a production environment.

## Project Structure

```text
app/[locale]/          Localized routes, layouts, login, and dashboards
components/            Shared UI, application shell, and landing page
i18n/                  Locale routing and request configuration
lib/actions/           Server actions for authentication and settings
lib/dal.ts             Session and data-access helpers
messages/              French and Arabic translation files
prisma/                Schema, migrations, and seed script
public/                Static assets
```

## Routes

| Route | Purpose |
| --- | --- |
| `/fr` or `/ar` | Public landing page |
| `/fr/login` or `/ar/login` | Sign-in |
| `/fr/director` | Director workspace |
| `/fr/surveillant` | Supervisor workspace |
| `/fr/teacher` | Teacher workspace |
| `/fr/student` | Student workspace |
| `/fr/parent` | Parent workspace |
| `/fr/settings` | School settings |

Authenticated users are redirected to the dashboard associated with their role.

## Commands

```bash
pnpm dev          # Start the development server
pnpm build        # Create a production build
pnpm start        # Start the production server
pnpm lint         # Run ESLint
pnpm typecheck    # Run TypeScript checks
pnpm test         # Run the test suite
pnpm db:generate  # Generate the Prisma client
pnpm db:migrate   # Create and apply a development migration
pnpm db:seed      # Seed the database
pnpm db:studio    # Open Prisma Studio
pnpm db:reset     # Reset the database and reapply migrations
```

## Localization

The application uses `fr` as the default locale and supports `ar` as the Arabic locale. Translation content lives in `messages/fr.json` and `messages/ar.json`. The locale layout sets the document direction, so shared components should use logical CSS properties such as `margin-inline`, `padding-inline`, and `inset-inline-start`.

## Production Notes

- Use a managed PostgreSQL database and a separate production `.env` file.
- Replace all seeded passwords and demo records before deployment.
- Run `pnpm build` during CI before starting the application.
- Keep `.env*`, generated Prisma files, local notes, and development tooling out of version control.
- Review authentication, permissions, file storage, and email delivery configuration before exposing the platform publicly.

## License

Private project. All rights reserved.
