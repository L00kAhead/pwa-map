document.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((registration) => {
        console.log(
          "Service Worker registered successfully with scope:",
          registration.scope
        );
      })
      .catch((error) => {
        console.error("Service Worker registration failed:", error);
      });
  } else {
    console.log("Service Worker not supported in this browser.");
  }

  const mapElement = document.getElementById("map");
  const notesListElement = document.getElementById("notes-list");
  const notesCountElement = document.getElementById("notes-count");
  const noteIdInput = document.getElementById("note-id");
  const noteTitleInput = document.getElementById("note-title");
  const noteContentInput = document.getElementById("note-content");
  const noteLatInput = document.getElementById("note-lat");
  const noteLngInput = document.getElementById("note-lng");
  const saveNoteBtn = document.getElementById("save-note-btn");
  const clearFormBtn = document.getElementById("clear-form-btn");
  const deleteNoteBtn = document.getElementById("delete-note-btn");

  //  Map Initialization
  let map;
  let temporaryMarker = null; // Marker for new note location before saving
  const defaultCoords = [56.4884, 84.948]; // Default to Tomsk
  const defaultZoom = 13;

  function initializeMap() {
    if (!mapElement) {
      console.error("Map element not found!");
      return;
    }

    // Remove existing map instance if it exists
    if (map) {
      map.remove();
    }

    console.log("Initializing map...");

    // Use setTimeout to ensure the map container has proper dimensions
    setTimeout(() => {
      map = L.map(mapElement).setView(defaultCoords, defaultZoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Force map to invalidate size after initialization
      map.invalidateSize();

      // Event listener for clicking on the map to get coordinates
      map.on("click", (e) => {
        clearForm();

        const { lat, lng } = e.latlng;
        noteLatInput.value = lat.toFixed(5);
        noteLngInput.value = lng.toFixed(5);

        temporaryMarker = L.marker([lat, lng], {
          icon: L.icon({
            iconUrl: "./icons/icon-512x512.png",
            iconSize: [30, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
          }),
        })
          .addTo(map)
          .bindPopup("New note location")
          .openPopup();
        console.log(
          `Map clicked at: Lat: ${lat}, Lng: ${lng}. Form reset for new note.`
        );
      });

      // Event listener for map movement to update notes in view
      map.on("moveend", () => {
        console.log("Map moved. Refreshing notes in view.");
        displayNotesInView();
      });

      // Attempt to get user's current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userCoords = [
              position.coords.latitude,
              position.coords.longitude,
            ];
            map.setView(userCoords, defaultZoom);
            L.marker(userCoords)
              .addTo(map)
              .bindPopup("Your current location")
              .openPopup();
          },
          () => {
            console.warn("Could not get user location, defaulting to Tomsk.");
          }
        );
      } else {
        console.warn("Geolocation is not supported by this browser.");
      }

      displayAllNotesOnMap();
      displayNotesInView();
    }, 100);
  }

  window.addEventListener("resize", () => {
    if (map) {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
  });

  const STORAGE_KEY = "PinItDown";
  let notes = []; // In-memory store for notes

  // Load notes from localStorage
  function loadNotes() {
    const storedNotes = localStorage.getItem(STORAGE_KEY);
    if (storedNotes) {
      notes = JSON.parse(storedNotes);
      console.log("Notes loaded from localStorage:", notes);
    } else {
      notes = []; // Initialize if no notes are stored
      console.log("No notes in localStorage, initialized empty notes array.");
    }
  }

  // Save notes to localStorage
  function saveNotesToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    console.log("Notes saved to localStorage.");
  }

  // Display all saved notes as markers on the map
  function displayAllNotesOnMap() {
    if (!map) return;

    // Clear existing note markers (but not the temporaryMarker or user location marker)
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer.options.isNoteMarker) {
        map.removeLayer(layer);
      }
    });

    notes.forEach((note) => {
      if (note.lat && note.lng) {
        const marker = L.marker([note.lat, note.lng], {
          isNoteMarker: true,
          icon: L.icon({
            iconUrl: "./icons/mark.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
          }),
        })
          .addTo(map)
          .bindPopup(
            // Richer popup content for saved notes
            `<div class="popup-content">
              <h4>${escapeHTML(note.title)}</h4>
              <p>${escapeHTML(note.content.substring(0, 100))}${
              note.content.length > 100 ? "..." : ""
            }</p>
              <small>Click marker to edit</small>
            </div>`
          )
          .on("click", () => {
            // When a saved note's marker is clicked, populate the form
            populateFormWithNote(note);
            map.setView([note.lat, note.lng], map.getZoom()); // Center map on the note
            if (temporaryMarker) {
              // Remove temporary new location marker if one exists
              map.removeLayer(temporaryMarker);
              temporaryMarker = null;
            }
          });
      }
    });
    console.log("Displayed all notes on map.");
  }

  // Display notes that are currently within the map's visible bounds in the list
  function displayNotesInView() {
    if (!map) return;

    const bounds = map.getBounds();
    notesListElement.innerHTML = ""; // Clear current list

    const notesInBounds = notes.filter((note) => {
      if (!note.lat || !note.lng) return false;
      const noteLatLng = L.latLng(note.lat, note.lng);
      return bounds.contains(noteLatLng);
    });

    // Update notes count display
    const totalNotes = notes.length;
    const notesInViewCount = notesInBounds.length;
    notesCountElement.textContent = `${notesInViewCount} of ${totalNotes} notes`;

    if (notesInBounds.length === 0) {
      const li = document.createElement("li");
      li.className = "no-notes-message";
      li.innerHTML = `
        <i class="fas fa-map-marker-alt"></i>
        <div>No notes in the current map view.</div>
        <small>Zoom out or pan around to find more notes, or add a new one!</small>
      `;
      notesListElement.appendChild(li);
    } else {
      notesInBounds.forEach((note) => {
        const li = document.createElement("li");
        li.className = "note-item";
        li.dataset.noteId = note.id;

        // Create elements for note details
        const titleSpan = document.createElement("span");
        titleSpan.className = "note-title";
        titleSpan.textContent = note.title;

        const contentP = document.createElement("p");
        contentP.className = "note-content-preview";
        contentP.textContent =
          note.content.substring(0, 100) +
          (note.content.length > 100 ? "..." : "");

        const coordsSpan = document.createElement("span");
        coordsSpan.className = "note-coords";
        coordsSpan.innerHTML = `
          <i class="fas fa-map-marker-alt"></i> 
          Lat: ${parseFloat(note.lat).toFixed(3)}, 
          Lng: ${parseFloat(note.lng).toFixed(3)}
        `;

        // Action buttons for each note item
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "note-actions";

        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn";
        editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
        editBtn.onclick = (e) => {
          e.stopPropagation(); // Prevent li click event
          populateFormWithNote(note);
          map.setView([note.lat, note.lng], Math.max(map.getZoom(), 15));
          if (temporaryMarker) {
            // Remove temporary new location marker if one exists
            map.removeLayer(temporaryMarker);
            temporaryMarker = null;
          }
        };

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn";
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
        deleteBtn.onclick = (e) => {
          e.stopPropagation(); // Prevent li click event
          deleteNote(note.id);
        };

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);

        li.appendChild(titleSpan);
        li.appendChild(contentP);
        li.appendChild(coordsSpan);
        li.appendChild(actionsDiv);

        // Clicking on the list item also populates form and centers map
        li.addEventListener("click", () => {
          populateFormWithNote(note);
          map.setView(
            [note.lat, note.lng],
            Math.max(map.getZoom() || defaultZoom, 15)
          );
          if (temporaryMarker) {
            // Remove temporary new location marker if one exists
            map.removeLayer(temporaryMarker);
            temporaryMarker = null;
          }
        });
        notesListElement.appendChild(li);
      });
    }
    console.log(`Displayed ${notesInBounds.length} notes in view.`);
  }

  // Populate the form with details of an existing note for editing
  function populateFormWithNote(note) {
    noteIdInput.value = note.id;
    noteTitleInput.value = note.title;
    noteContentInput.value = note.content;
    noteLatInput.value = parseFloat(note.lat).toFixed(5);
    noteLngInput.value = parseFloat(note.lng).toFixed(5);
    saveNoteBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Note'; // Changed icon and text
    clearFormBtn.style.display = "inline-block"; // Show clear button
    deleteNoteBtn.style.display = "inline-block"; // Show delete button

    if (temporaryMarker) {
      map.removeLayer(temporaryMarker);
      temporaryMarker = null;
    }
    noteTitleInput.focus(); // Focus on title for editing
    console.log("Form populated with note:", note.title);
  }

  // Clear the form fields and reset button states
  function clearForm() {
    noteIdInput.value = "";
    noteTitleInput.value = "";
    noteContentInput.value = "";
    noteLatInput.value = ""; // Will be repopulated if map click follows
    noteLngInput.value = ""; // Will be repopulated if map click follows
    saveNoteBtn.innerHTML = '<i class="fas fa-save"></i> Save Note'; // Reset button text/icon
    clearFormBtn.style.display = "none"; // Hide clear button
    deleteNoteBtn.style.display = "none"; // Hide delete button

    // Remove the temporary marker if it exists (used for new note locations)
    if (temporaryMarker) {
      map.removeLayer(temporaryMarker);
      temporaryMarker = null;
    }
    noteTitleInput.focus(); // Focus on title for new note entry
    console.log("Form cleared.");
  }

  // Delete a note by its ID
  function deleteNote(noteId) {
    // Use a custom confirmation dialog/modal in a real app instead of confirm()
    if (confirm("Are you sure you want to delete this note?")) {
      const noteIndex = notes.findIndex((note) => note.id === noteId);
      if (noteIndex > -1) {
        const deletedNote = notes.splice(noteIndex, 1)[0];
        saveNotesToStorage();
        displayAllNotesOnMap(); // Refresh map markers
        displayNotesInView(); // Refresh notes list

        // If the deleted note was the one in the form, clear the form
        if (noteIdInput.value === noteId) {
          clearForm();
        }
        console.log("Note deleted:", deletedNote.title);
      }
    }
  }

  // Helper function to escape HTML content before inserting into DOM
  function escapeHTML(str) {
    if (typeof str !== "string") return "";
    return str.replace(/[&<>"']/g, function (match) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[match];
    });
  }

  // Event Listeners for Form Buttons
  saveNoteBtn.addEventListener("click", () => {
    const id = noteIdInput.value;
    const title = noteTitleInput.value.trim();
    const content = noteContentInput.value.trim();
    const latString = noteLatInput.value;
    const lngString = noteLngInput.value;

    if (!title || !content) {
      // Use a more user-friendly notification system in a real app
      alert("Please enter a title and content for the note.");
      return;
    }
    if (!latString || !lngString) {
      alert("Please select a location on the map for the note.");
      return;
    }

    const lat = parseFloat(latString);
    const lng = parseFloat(lngString);

    if (isNaN(lat) || isNaN(lng)) {
      alert("Invalid location coordinates. Please click the map again.");
      return;
    }

    if (id) {
      // Update existing note
      const noteIndex = notes.findIndex((note) => note.id === id);
      if (noteIndex > -1) {
        notes[noteIndex] = { ...notes[noteIndex], title, content, lat, lng };
        console.log("Note updated:", notes[noteIndex]);
      }
    } else {
      // Add new note
      const newNote = {
        id: Date.now().toString(),
        title,
        content,
        lat,
        lng,
        createdAt: new Date().toISOString(),
      };
      notes.push(newNote);
      console.log("New note added:", newNote);
    }

    saveNotesToStorage();
    displayAllNotesOnMap(); // Refresh map markers
    displayNotesInView(); // Refresh notes list
    clearForm(); // Clear form after saving
  });

  clearFormBtn.addEventListener("click", clearForm);

  deleteNoteBtn.addEventListener("click", () => {
    const noteId = noteIdInput.value;
    if (noteId) {
      deleteNote(noteId);
    }
  });

  // Initial Load
  loadNotes();
  initializeMap();
});
