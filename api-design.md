# QuickNotes REST API Design

This is the API the backend team will build. It is a JSON REST API for a user's notes and tags.

## Conventions

- **Base URL:** `https://api.quicknotes.example/v1`
- **Format:** requests and responses use JSON (`Content-Type: application/json`).
- **Authentication:** every endpoint except `POST /auth/login` needs the header `Authorization: Bearer <token>`.
- **Ownership:** a user can only see and change their own notes and tags.
- **Timestamps:** ISO 8601 in UTC, for example `2026-10-30T09:15:00Z`.
- **Note fields:** `title` is required (1 to 100 characters), `body` is optional text, and `tags` is a list of tag names.

## Endpoints

| # | Method | Path | Description | Success status |
| --- | --- | --- | --- | --- |
| 1 | `POST` | `/auth/login` | Log in with email and password and receive a token. | `200 OK` |
| 2 | `GET` | `/notes` | List the current user's notes (supports `?page=`, `?limit=` and `?tag=`). | `200 OK` |
| 3 | `GET` | `/notes/{id}` | Get one note. | `200 OK` |
| 4 | `POST` | `/notes` | Create a new note. | `201 Created` |
| 5 | `PUT` | `/notes/{id}` | Replace a note's title, body and tags. | `200 OK` |
| 6 | `DELETE` | `/notes/{id}` | Delete a note. | `204 No Content` |
| 7 | `GET` | `/tags` | List the current user's tags. | `200 OK` |

### 1. `POST /auth/login`

- **Request body:** `{ "email": "amina@example.com", "password": "correct-horse" }`
- **Response body:** `{ "token": "eyJhbGciOi...", "expiresIn": 3600 }`

### 2. `GET /notes`

- **Query parameters:**
  - `page` is the page number (default 1).
  - `limit` is the number of notes per page (default 10, maximum 50).
  - `tag` is an optional tag name to filter by.
- **Request body:** none
- **Success status:** `200 OK`

### 3. `GET /notes/{id}`

- **Request body:** none
- **Response body:** a single note object, as shown in the examples below.

### 4. `POST /notes`

- **Success status:** `201 Created`, with a `Location: /v1/notes/{id}` header.
- The server sets `id`, `userId`, `createdAt` and `updatedAt`.

### 5. `PUT /notes/{id}`

- **Request body:** the full note (`title`, `body`, `tags`). Anything left out is cleared.
- **Response body:** the updated note.

### 6. `DELETE /notes/{id}`

- **Request body:** none
- **Response body:** none (empty).

### 7. `GET /tags`

- **Response body:** `{ "data": [ { "id": 1, "name": "work" }, { "id": 2, "name": "study" } ] }`

## Examples

### Create a note: `POST /notes`

Request:

```json
{
  "title": "Finish the API design",
  "body": "Write the endpoints, errors and data model documents.",
  "tags": ["work", "docs"]
}
```

Response (`201 Created`):

```json
{
  "id": 42,
  "userId": 7,
  "title": "Finish the API design",
  "body": "Write the endpoints, errors and data model documents.",
  "tags": ["work", "docs"],
  "createdAt": "2026-10-30T09:15:00Z",
  "updatedAt": "2026-10-30T09:15:00Z"
}
```

### List notes: `GET /notes?page=1&limit=2`

Response (`200 OK`):

```json
{
  "data": [
    {
      "id": 42,
      "userId": 7,
      "title": "Finish the API design",
      "body": "Write the endpoints, errors and data model documents.",
      "tags": ["work", "docs"],
      "createdAt": "2026-10-30T09:15:00Z",
      "updatedAt": "2026-10-30T09:15:00Z"
    },
    {
      "id": 41,
      "userId": 7,
      "title": "Buy milk",
      "body": "",
      "tags": [],
      "createdAt": "2026-10-29T18:02:00Z",
      "updatedAt": "2026-10-29T18:02:00Z"
    }
  ],
  "page": 1,
  "limit": 2,
  "total": 25
}
```

## Error responses

Every error uses the same body shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The title is required and must be 100 characters or fewer.",
    "details": [{ "field": "title", "problem": "missing" }]
  }
}
```

| Status | Name | When it happens | Example |
| --- | --- | --- | --- |
| `400` | Bad Request | The request is malformed or fails validation. | `POST /notes` with no `title`, a title of 150 characters, or invalid JSON. |
| `401` | Unauthorized | The user is not logged in, or the token is missing, expired or invalid. | `GET /notes` with no `Authorization` header. |
| `403` | Forbidden | The user is logged in but is not allowed to do this. | `DELETE /notes/42` where note 42 belongs to a different user. |
| `404` | Not Found | The note or tag does not exist. | `GET /notes/9999` when no note has that id. |
| `500` | Internal Server Error | The server failed unexpectedly. It is not the client's fault. | The database is down while handling `POST /notes`. |

Example bodies:

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Your session has expired. Please log in again." } }
```

```json
{ "error": { "code": "FORBIDDEN", "message": "You do not have permission to delete this note." } }
```

```json
{ "error": { "code": "NOT_FOUND", "message": "No note with id 9999." } }
```

```json
{ "error": { "code": "INTERNAL_ERROR", "message": "Something went wrong on our side. Please try again later." } }
```

For `500` errors the body never includes stack traces or other internal details.
