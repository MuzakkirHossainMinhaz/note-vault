# note-vault-backend

Secure TypeScript/Node.js/Express REST API for note-taking, posts, and interest grouping with JWT auth, MongoDB/Mongoose, and role-based access control.

## Stack

- Node.js 18+
- TypeScript (strict type checking)
- Express
- MongoDB + Mongoose
- JWT (HS256)
- bcryptjs
- Zod validation
- Helmet + CORS + rate limiting

## Local setup

1. Copy `.env.example` to `.env` and fill in your own values.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Check types and compile:

   ```bash
   npm run typecheck
   npm run build
   ```

4. Start the API in development mode:

   ```bash
   npm run dev
   ```

5. Or start the compiled production build:

   ```bash
   npm run build
   npm start
   ```

The API source, Vercel function, and maintenance scripts are TypeScript. `npm run dev` runs `src/server.ts` through `tsx`; `npm start` runs the compiled output from `dist/`.

## Environment variables

The app expects these values in `.env`:

```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/notevault?retryWrites=true&w=majority
JWT_SECRET=replace-with-a-long-random-string
JWT_EXPIRES_IN=1h
BCRYPT_COST=12
FRONTEND_URL=http://localhost:5173
ADMIN_EMAIL=admin@notevault.local
ADMIN_PASSWORD=replace-with-a-strong-password
ADMIN_NAME=NoteVault Admin
```

## Admin bootstrap

The local server can call `ensureAdmin()` at startup to create an admin user if none already exists with `ADMIN_EMAIL`. For Vercel deployments, seed manually from a local machine configured with the Atlas URI using `npm run seed:admin`. The script is idempotent and never logs the password.

## API overview

All API routes are under `/api`.

| Method | Route | Access | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Creates a normal user; ignores any role supplied |
| POST | `/api/auth/login` | Public | Authenticates with email + password |
| GET | `/health` | Public | Health check; no DB query |
| GET | `/api/users/me` | Authenticated | Current user profile |
| PATCH | `/api/users/me` | Authenticated | Update name, interests, password |
| POST | `/api/users` | Admin | Create a user |
| GET | `/api/users` | Admin | Paginated user list |
| GET | `/api/users/:id` | Admin | User details |
| PATCH | `/api/users/:id` | Admin | Update a user; dedupe email and maintain last-admin protection |
| DELETE | `/api/users/:id` | Admin | Removes user and cascades notes/posts |
| GET | `/api/users/:id/posts` | Public | User posts via aggregation lookup |
| POST | `/api/notes` | Authenticated | Create note for current user |
| GET | `/api/notes` | Authenticated | Paginated notes; admin can filter by `?owner=` |
| GET | `/api/notes/:id` | Authenticated | Own note or any note for admin |
| PATCH | `/api/notes/:id` | Authenticated | Own note only |
| DELETE | `/api/notes/:id` | Authenticated | Own note only |
| POST | `/api/posts` | Authenticated | Create post |
| GET | `/api/posts` | Authenticated | Cursor-paginated community feed with author names |
| GET | `/api/posts/:id` | Public | Post details |
| PATCH | `/api/posts/:id` | Authenticated | Author only |
| DELETE | `/api/posts/:id` | Authenticated | Author only |
| GET | `/api/interests/groups` | Authenticated | Aggregated interest groups with pagination |
| GET | `/api/interests/groups/:interest/members` | Authenticated | Paginated group members; optional `?search=` matches names |

## Authentication

- Auth header format: `Authorization: Bearer <token>`
- JWT claims: `{ sub, role }`
- JWT secret comes from `JWT_SECRET`
- Expiry comes from `JWT_EXPIRES_IN` and defaults to `1h` in `.env.example`
- The middleware verifies the token and reloads the user from MongoDB so deleted users or role changes take effect immediately.

## Pagination

Offset-paginated list endpoints accept:

- `page` (default `1`, min `1`)
- `limit` (default `10`, max `100`)

Responses follow this shape:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

The community feed uses cursor pagination instead: `GET /api/posts?limit=10&cursor=<id>` returns `{ data, pagination: { nextCursor, hasMore } }`. Use `nextCursor` for the next request; the cursor is based on the last returned ObjectId, so loading more does not require an increasingly large offset. Feed items include the author `_id` and name only.

All list endpoints sort by `_id` descending on purpose so the newest items appear first and MongoDB can use the natural ObjectId ordering. In production, indexes are not built at runtime; run `npm run db:indexes` once against the Atlas database.

## Explicit indexes (exactly 4)

The app intentionally declares exactly four schema indexes and no field-level `index: true` or `unique: true` settings. All other lookup patterns rely on the default MongoDB `_id` index.

### Model index table

| Model | Query | Index |
| --- | --- | --- |
| User | login by email, unique email guarantee | `userSchema.index({ email: 1 }, { unique: true })` |
| User | interest grouping / filter by interest | `userSchema.index({ interests: 1 })` |
| Note | list my notes, admin owner filter, countDocuments({owner}), deleteMany({owner}) | `noteSchema.index({ owner: 1, _id: -1 })` |
| Post | user post lookup via `$lookup`, deleteMany({author}) | `postSchema.index({ author: 1, _id: -1 })` |

### Why no other indexes exist

- The default `_id` index serves the global posts feed (including cursor pagination), `GET /users/:id`, `GET /notes/:id`, `GET /posts/:id`, and `GET /users/me` lookups.
- The `owner` and `author` compound indexes are only needed for the filtered owner/author queries that still sort newest-first.
- No extra indexes were added for auth, admin listing, updates, or deletes because those queries naturally use the default `_id` index and, for email uniqueness, the explicit `email` index is enough.

## Aggregation scenarios

### Scenario 1: users grouped by interests

`GET /api/interests/groups` uses a single `User.aggregate()` call with a `$facet` stage to compute:

1. `$match` on `interests`
2. `$unwind` interests
3. optional `$match` for a specific interest filter
4. `$group` by interest, count all members, and keep only the first three names for a compact preview
5. `$sort` by interest name
6. `$facet` for paginated `data` and `total`

The preview uses `$topN` (MongoDB 5.2+). The endpoint never exposes emails, password hashes, or roles. Full member lists are loaded separately through `GET /api/interests/groups/:interest/members`, which supports pagination and an optional case-insensitive name search.

### Scenario 2: posts of a user via `$lookup`

`GET /api/users/:id/posts` runs a single aggregation on `User` with a `$lookup` into `posts`:

1. `$match` the user by `_id`
2. `$project` the user name
3. `$lookup` posts using `localField: '_id'`, `foreignField: 'author'`
4. `$sort` posts by `_id: -1`
5. `$skip` and `$limit` with `limit + 1` to compute pagination
6. slice results back to `limit` for the response

This returns `{ user, posts, pagination }` and 404s when the user does not exist.

## Deployment (Vercel + MongoDB Atlas)

1. In MongoDB Atlas, create a free cluster, create a database user, and under Network Access allow `0.0.0.0/0` (Vercel uses dynamic IPs). Copy the `mongodb+srv` connection string and include a database name in its path.
2. Run locally once against Atlas: set `MONGO_URI` in `.env`, then run:

   ```bash
   npm run typecheck
   npm run build
   npm run db:indexes
   npm run seed:admin
   ```

3. Push the `note-vault-backend` repo to GitHub. In Vercel choose **Add New Project**, import the backend repo, select Framework Preset **Other**, use no build command, and set the root directory to the repo root.
4. Add these Production environment variables in Vercel: `MONGO_URI`, `JWT_SECRET` (long random string), `JWT_EXPIRES_IN`, `BCRYPT_COST`, `FRONTEND_URL` (initially a placeholder; deployed frontend URL with no trailing slash), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME`. Deploy.
5. Verify `GET https://<backend>.vercel.app/health` returns `{ "status": "ok" }`.
6. After deploying the frontend, set `FRONTEND_URL` to its production URL and redeploy the backend. Vercel environment changes apply only to new deployments.
7. Gotchas:
   - If Vercel Deployment Protection is enabled, make sure the production domain is public; otherwise the API may return 401 to preflight requests.
   - Set the function region close to the Atlas region in **Project Settings > Functions**.
   - The first request after idle may take 1-3 seconds due to a serverless cold start.

The authentication rate limiter uses an in-memory store and is best-effort per serverless instance on Vercel.

## Test credentials

The seeded admin account is created using `ADMIN_EMAIL` from the runtime environment. For example, the local default is:

- Email: `admin@notevault.local`

The password is intentionally not listed here.

## Security review checklist

- [x] Exactly 4 `schema.index()` calls; no field-level `index` or `unique` configuration
- [x] Every list endpoint is paginated
- [x] Scenario 1 uses exactly one `User.aggregate()` and no other query method for that endpoint
- [x] Scenario 2 uses a single aggregation with `$lookup`
- [x] Passwords are hashed with bcryptjs and never returned
- [x] Register cannot create admins; admin routes are protected
- [x] Users cannot read or modify other users' notes; admin can read them but cannot edit/delete them
- [x] User deletion cascades notes and posts
- [x] CORS allows only configured `FRONTEND_URL` origins; `/health` works and proxy trust is enabled
- [x] Admin seeding is idempotent and run manually for Vercel deployments

## MongoDB `explain()` notes

Build the declared indexes with `npm run db:indexes` against Atlas. To validate index usage locally, inspect the query plans for these operations:

- list my notes
- the interest-group aggregation pipeline
- the user-posts `$lookup` aggregation

The expected result is a query plan that uses `IXSCAN` on the relevant index rather than a collection scan. In practice, the note and post listing queries should show `IXSCAN` on `{ owner: 1, _id: -1 }` and `{ author: 1, _id: -1 }`, while the interest grouping pipeline should show `IXSCAN` on `{ interests: 1 }` and the user-posts lookup should show `IXSCAN` on the author compound index.

Example shape:

```js
const result = await Note.find({ owner: userId }).sort({ _id: -1 }).explain('executionStats');
console.log(result.queryPlanner.winningPlan);
```

This confirms the declared indexes are being used during the hot paths the challenge calls out.

## Verification summary

| Check | Result |
| --- | --- |
| TypeScript build | PASS |
| Smoke test | PASS (`npm run test:smoke`) |
| Index verification | PASS (`node scripts/verifyIndexes.js`) |
