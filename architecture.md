# QuickNotes Architecture

QuickNotes moves from a browser-only app to an online service for 1 million users. This document lists the requirements, estimates the load and describes the architecture the backend team will build.

## 1. Requirements

### Functional requirements

- Users can register and log in.
- Users can create, view, edit and delete their own notes.
- Users can add tags to notes and filter their notes by tag.
- Notes are saved on the server, so they are available from any device.
- A user can never see another user's notes.

### Non-functional requirements

- **Availability:** the service should stay up even if one server fails (target 99.9%).
- **Performance:** listing notes should respond in under 300 ms for most requests.
- **Scalability:** it must handle 1 million users and be able to grow by adding servers.
- **Durability:** a saved note must never be lost, so the database is backed up and replicated.
- **Security:** all traffic uses HTTPS, passwords are stored as hashes and every request is authenticated.
- **Maintainability:** the app servers are stateless, so they can be added, removed and deployed without losing data.

## 2. Load estimate for 1 million users

### Assumptions

- 1,000,000 registered users.
- 20% are active each day, so **200,000 daily active users**.
- Each active user loads their notes (reads) 20 times a day.
- Each active user makes 5 writes a day (creating, editing or deleting notes).
- A note takes about 1 KB on average (title, body and metadata).
- A day has 86,400 seconds, and peak traffic is 5 times the average.

### Results

| Measure | Per day | Average per second | Peak per second (x5) |
| --- | --- | --- | --- |
| Reads | 4,000,000 | about 46 | about 231 |
| Writes | 1,000,000 | about 12 | about 58 |

**Storage per year:** 1,000,000 new notes a day x 1 KB x 365 days = about **365 GB a year** of note data. Indexes and a read replica increase the space actually used, so I would plan for roughly three times that.

**Conclusion:** the system is **read-heavy** (4 reads for every write). The peak of about 231 reads and 58 writes a second is modest, so one primary database with a read replica and a cache can handle it. The architecture below is designed to also stay available and to grow.

## 3. Architecture diagram

```text
                        +---------------------------+
                        |  Client (browser / app)   |
                        +-------------+-------------+
                                      |
                                      v
                        +---------------------------+
                        |            DNS            |
                        |  api.quicknotes.example   |
                        +------+-------------+------+
                               |             |
              static files     |             |   API calls (HTTPS)
        (HTML, CSS, JS, images)|             |
                               v             v
                     +-------------+   +--------------------+
                     |     CDN     |   |   Load balancer    |
                     | (edge cache)|   |  (standby copy)    |
                     +------+------+   +----------+---------+
                            |                     |
                            | miss      +---------+---------+
                            v           v                   v
                     +-------------+  +-----------+    +-----------+
                     |   Static    |  | App       |    | App       |   ... more servers
                     |   hosting   |  | server 1  |    | server 2  |
                     +-------------+  +-----+-----+    +-----+-----+
                                            \                /
                              +--------------+--------------+------------------+
                              |                             |                  |
                              | reads: check first          | reads: on miss   | writes
                              v                             v                  v
                       +-------------+              +--------------+   +----------------+
                       |    Cache    |              |  Database    |<--|   Database     |
                       |   (Redis)   |              |  READ REPLICA|   |   PRIMARY      |
                       +-------------+              +--------------+   +--------+-------+
                                                            ^   replication     |
                                                            +-------------------+
                                                                                |
                              +-------------------------------------------------+
                              |  background jobs (publish)
                              v
                       +-------------+        +--------------------+
                       |    Queue    |------->|  Worker(s)         |
                       +-------------+        |  (email, search    |
                                              |   index, cleanup)  |
                                              +---------+----------+
                                                        |
                                                        v
                                                 writes back to the
                                                 primary database
```

## 4. What each component does

- **Client:** It is the part the user sees and uses, and it talks to the API over HTTPS (this is the `api.js` client built in this project).
- **DNS:** It turns the name `api.quicknotes.example` into the address of our load balancer, so users never need to know any server addresses and we can move servers without changing the name.
- **CDN:** It serves static files (HTML, CSS, JavaScript, images) from servers close to the user, so pages load quickly and this traffic never reaches our app servers.
- **Load balancer:** It spreads requests across the app servers and stops sending traffic to a server that has failed, so no one server is overloaded or a single point of failure.
- **App servers (two or more):** They run the API logic (checking login, validating notes, building responses) and keep no data of their own, so we can add more of them as traffic grows.
- **Cache:** It keeps recently used data, such as a user's note list, in memory, so most reads skip the slower database.
- **Primary database:** It is the single source of truth that stores users, notes and tags safely, and it handles all writes.
- **Read replica:** It is a continuously updated copy of the primary that serves read queries, so reading does not slow down writing and the copy can take over if the primary fails.
- **Queue:** It holds background jobs (such as "send a welcome email"), so a request can finish immediately without waiting for slow work.
- **Worker:** It takes jobs from the queue and does the slow work in the background, so it can be scaled and retried separately from the API.

## 5. Request flows

### `GET /notes` (read)

1. The client sends `GET /v1/notes` with its token. DNS resolves the name and the request reaches the **load balancer**.
2. The load balancer sends it to one healthy **app server**.
3. The app server checks the token. If it is missing or expired it replies `401`.
4. The app server looks for this user's note list in the **cache**.
5. **Cache hit:** the app server returns the cached list immediately with `200 OK`.
6. **Cache miss:** the app server runs the query on the **read replica** (`WHERE user_id = ... ORDER BY created_at DESC LIMIT ...`).
7. The app server stores the result in the cache (with a short expiry, for example 60 seconds) and returns it with `200 OK`.

### `POST /notes` (write)

1. The client sends `POST /v1/notes` with its token and a JSON body. The request reaches the **load balancer** and one **app server**.
2. The app server checks the token (`401` if invalid) and validates the body: the title is required and at most 100 characters (`400` if not).
3. The app server inserts the note into the **primary database**, which gives it an id and timestamps.
4. The app server removes this user's cached note list, so the next read does not show stale data.
5. The app server puts a background job on the **queue**, for example to update the search index.
6. The app server replies `201 Created` with the new note and a `Location` header. The user does not wait for the background job.
7. A **worker** picks up the job and does it. If the job fails, it is retried later.
8. The **primary database** copies the new note to the **read replica**, usually within a fraction of a second.

## 6. Trade-offs

- **Cache: speed against freshness.** The cache makes reads fast and protects the database, but data in it can be slightly out of date. We reduce this by clearing the user's cache on every write and using short expiry times. A longer expiry would send less traffic to the database but show older data.
- **Read replica: scale and safety against consistency.** The replica spreads read load and acts as a backup, but there is a short delay (replication lag) before a new note appears on it. A user could create a note and not see it in the next list. We avoid this by reading from the primary for a few seconds after that user's write.
- **Queue and worker: fast responses against extra complexity.** Background work keeps `POST /notes` quick, but a queue and workers are more parts to run, monitor and retry safely. Jobs may also run twice, so they must be written so that running them again does no harm.
- **SQL primary: strong rules against write scaling.** One primary database keeps the data consistent and simple, but all writes go through one machine. This is fine at about 58 writes per second at peak. If writes grew much larger, we would need to split the data across several databases (sharding), which is much harder.

## 7. Avoiding single points of failure

| Part | How a failure is survived |
| --- | --- |
| DNS | Use a managed DNS provider with several name servers. |
| CDN | CDNs run on many servers worldwide, and if the CDN fails, requests can go straight to the origin. |
| Load balancer | Run a second load balancer as a standby (or use a managed, multi-zone one), so traffic switches over if one fails. |
| App servers | Run at least two (ideally in different zones) behind the load balancer. If one fails, health checks remove it and the others carry on. |
| Cache | Use a cache with a replica. Even if the whole cache is lost, the app still works because it falls back to the database, just more slowly. |
| Database | The primary has a replica in another zone. If the primary fails, the replica is promoted to be the new primary. Regular backups protect against data corruption or deletion. |
| Queue | Use a managed or replicated queue that stores jobs on disk, so jobs are not lost if one node fails. |
| Workers | Run more than one worker, so jobs are still processed if one stops. |

The aim is that no single machine, or single zone, is the only copy of something the service depends on.
