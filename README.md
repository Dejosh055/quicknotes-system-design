# QuickNotes API Client and Design Documents

QuickNotes is moving from a browser-only app to an online service for 1 million users. This repository has two parts. The first is a small front-end client that proves a web page can load, create and delete notes through a REST API (using the free JSONPlaceholder practice API). The second is a set of design documents that the backend team will build the real service from.

## Features of the API client

- **Load** 10 notes with a `GET` request.
- **Create** a note with a `POST` request. The title is required and can have at most 100 characters.
- **Delete** a note with a `DELETE` request.
- A reusable `request()` function that checks `response.ok` and throws an error on failure.
- Loading, success, error and empty states shown in the page, with different colours for success and error.
- Buttons are disabled while a request is running, so nothing is sent twice.
- All text is inserted with `textContent`, never `innerHTML`.

## How to run the API client

1. Download or clone the repository.
2. Open `index.html` in a browser, or open the folder in VS Code and start it with the Live Server extension. Nothing needs to be installed.
3. You need an internet connection, because the page calls `https://jsonplaceholder.typicode.com/posts`.
4. Click **Load notes** to fetch 10 notes, use the form to add a note, and use **Delete** to remove one.

To test the error state, temporarily change the end of `API_URL` in `api.js` to `/postz`, reload the page and click **Load notes**. You should see a red error message. Change it back afterwards.

**Note:** JSONPlaceholder pretends to save changes but never stores them. A created note gets the id 101 every time, and a refresh brings back the original data. The client therefore keeps its own list of notes on the page. A real backend would store the changes.

## Design documents

- [REST API design](docs/api-design.md): endpoints, JSON examples and error codes.
- [Data model](docs/data-model.md): tables, relationships, SQL, an index and example queries.
- [Architecture](docs/architecture.md): requirements, load estimate, diagram, request flows and trade-offs.

## What I learned

- `fetch()` only rejects when the network fails. A `404` or `500` still counts as a finished request, so I have to check `response.ok` and throw an error myself.
- A `try / catch / finally` block keeps the page working when a request fails: `catch` shows the error and `finally` always re-enables the buttons.
- A user's loading, success, error and empty states all need to be designed, not just the happy path. Disabling buttons while a request runs stops duplicate requests.
- Putting user text in with `textContent` instead of `innerHTML` stops anything typed from being treated as HTML.
- A many-to-many relationship such as notes and tags needs a join table (`note_tags`), and indexes should match the most common query.
- Estimating load (reads and writes per second, storage per year) shows whether a system is read-heavy, and that decides where to add caches and read replicas.
- Every part of an architecture should solve a clear problem, and each one has a trade-off, such as a cache being fast but sometimes stale.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Page with the load button, status message, note form and notes list |
| `style.css` | Styles, including different success and error messages |
| `api.js` | The API client: `request()`, GET, POST, DELETE, validation and rendering |
| `docs/` | The three design documents |
