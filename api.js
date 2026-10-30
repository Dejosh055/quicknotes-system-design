// QuickNotes API client. Talks to JSONPlaceholder, a free practice API.
// Note: JSONPlaceholder pretends to save changes but never stores them, so
// this client keeps its own list of notes (the `notes` array) up to date.

const API_URL = "https://jsonplaceholder.typicode.com/posts";
const LOAD_LIMIT = 10;
const MAX_TITLE_LENGTH = 100;

const loadBtn = document.querySelector("#load-btn");
const statusEl = document.querySelector("#status");
const form = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitBtn = document.querySelector("#submit-btn");
const notesList = document.querySelector("#notes-list");

// Notes currently on screen. `key` is a local unique id: JSONPlaceholder
// gives every new post the same id (101), so `id` alone cannot tell
// two newly created notes apart.
let notes = [];
let nextKey = 1;
let isBusy = false;

// ---------- Status and busy state ----------
// type is "loading", "success" or "error"; the CSS styles each differently.
function setStatus(type, message) {
  statusEl.className = type;
  statusEl.textContent = message;
}

// Disables every button while a request is running so it cannot be sent twice.
function setBusy(busy) {
  isBusy = busy;
  loadBtn.disabled = busy;
  submitBtn.disabled = busy;
  notesList.querySelectorAll(".delete-btn").forEach(function (button) {
    button.disabled = busy;
  });
}

// ---------- The reusable request function ----------
// fetch() only rejects when the network fails. A 404 or 500 is still a
// "successful" fetch, so response.ok has to be checked and an error thrown.
async function request(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error("Server responded with status " + response.status);
  }

  // A DELETE can return an empty body, so read text first and only parse
  // it when there is something to parse.
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// ---------- GET: load 10 notes ----------
async function loadNotes() {
  if (isBusy) {
    return;
  }
  setBusy(true);
  setStatus("loading", "Loading notes...");

  try {
    const data = await request(API_URL + "?_limit=" + LOAD_LIMIT);

    notes = data.map(function (item) {
      return { key: nextKey++, id: item.id, title: item.title, body: item.body };
    });
    render();

    if (notes.length === 0) {
      setStatus("success", "Loaded successfully, but there are no notes yet.");
    } else {
      setStatus("success", "Loaded " + notes.length + " notes.");
    }
  } catch (error) {
    setStatus("error", "Could not load notes: " + error.message);
  } finally {
    setBusy(false);
  }
}

// ---------- Validation ----------
// Returns an error message, or "" when the title is valid.
function validateTitle(title) {
  if (title === "") {
    return "A title is required.";
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return (
      "The title can have at most " + MAX_TITLE_LENGTH +
      " characters (yours has " + title.length + ")."
    );
  }
  return "";
}

// ---------- POST: create a note ----------
async function createNote(title, body) {
  if (isBusy) {
    return;
  }

  const problem = validateTitle(title);
  if (problem !== "") {
    setStatus("error", problem);
    return;
  }

  setBusy(true);
  setStatus("loading", "Saving note...");

  try {
    const saved = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ title: title, body: body, userId: 1 })
    });

    notes.unshift({ key: nextKey++, id: saved.id, title: saved.title, body: saved.body });
    render();

    titleInput.value = "";
    bodyInput.value = "";
    setStatus("success", "Note added.");
  } catch (error) {
    // The form keeps what the user typed so nothing is lost.
    setStatus("error", "Could not add the note: " + error.message);
  } finally {
    setBusy(false);
  }
}

// ---------- DELETE: remove a note ----------
async function deleteNote(note) {
  if (isBusy) {
    return;
  }
  setBusy(true);
  setStatus("loading", "Deleting note...");

  try {
    await request(API_URL + "/" + note.id, { method: "DELETE" });

    notes = notes.filter(function (item) {
      return item.key !== note.key;
    });
    render();
    setStatus("success", "Note deleted.");
  } catch (error) {
    setStatus("error", "Could not delete the note: " + error.message);
  } finally {
    setBusy(false);
  }
}

// ---------- Rendering ----------
// All text from the user or the API goes in through textContent only.
function createNoteElement(note) {
  const item = document.createElement("li");
  item.className = "note";

  const content = document.createElement("div");

  const title = document.createElement("h3");
  title.textContent = note.title;

  const body = document.createElement("p");
  body.textContent = note.body;

  content.append(title, body);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "Delete";
  deleteBtn.disabled = isBusy;
  deleteBtn.addEventListener("click", function () {
    return deleteNote(note);
  });

  item.append(content, deleteBtn);
  return item;
}

function render() {
  notesList.textContent = "";

  // Empty state
  if (notes.length === 0) {
    const empty = document.createElement("li");
    empty.className = "note empty";
    empty.textContent = "No notes to show. Load notes or add one below.";
    notesList.append(empty);
    return;
  }

  notes.forEach(function (note) {
    notesList.append(createNoteElement(note));
  });
}

// ---------- Events ----------
loadBtn.addEventListener("click", loadNotes);

form.addEventListener("submit", function (event) {
  event.preventDefault();
  return createNote(titleInput.value.trim(), bodyInput.value.trim());
});

render();
