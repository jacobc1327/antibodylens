import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const BookmarkContext = createContext();

const STORAGE_KEY = "antibodylens_bookmarks";

function loadBookmarks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveBookmarks(bookmarks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

export function BookmarkProvider({ children }) {
  // bookmarks is a map: { [antibodyId]: { id, vendor, clone_name, catalog_number, gene_name, overall_score, addedAt } }
  const [bookmarks, setBookmarks] = useState(loadBookmarks);

  useEffect(() => {
    saveBookmarks(bookmarks);
  }, [bookmarks]);

  const addBookmark = useCallback((antibody) => {
    setBookmarks((prev) => ({
      ...prev,
      [antibody.id]: {
        id: antibody.id,
        vendor: antibody.vendor,
        clone_name: antibody.clone_name,
        catalog_number: antibody.catalog_number,
        gene_name: antibody.gene_name,
        overall_score: antibody.overall_score,
        host_species: antibody.host_species,
        clonality: antibody.clonality,
        target_id: antibody.target_id,
        addedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const removeBookmark = useCallback((antibodyId) => {
    setBookmarks((prev) => {
      const next = { ...prev };
      delete next[antibodyId];
      return next;
    });
  }, []);

  const toggleBookmark = useCallback((antibody) => {
    setBookmarks((prev) => {
      if (prev[antibody.id]) {
        const next = { ...prev };
        delete next[antibody.id];
        return next;
      }
      return {
        ...prev,
        [antibody.id]: {
          id: antibody.id,
          vendor: antibody.vendor,
          clone_name: antibody.clone_name,
          catalog_number: antibody.catalog_number,
          gene_name: antibody.gene_name,
          overall_score: antibody.overall_score,
          host_species: antibody.host_species,
          clonality: antibody.clonality,
          target_id: antibody.target_id,
          addedAt: new Date().toISOString(),
        },
      };
    });
  }, []);

  const isBookmarked = useCallback(
    (antibodyId) => !!bookmarks[antibodyId],
    [bookmarks]
  );

  const bookmarkList = Object.values(bookmarks).sort(
    (a, b) => new Date(b.addedAt) - new Date(a.addedAt)
  );

  const clearAll = useCallback(() => setBookmarks({}), []);

  return (
    <BookmarkContext.Provider
      value={{
        bookmarks,
        bookmarkList,
        addBookmark,
        removeBookmark,
        toggleBookmark,
        isBookmarked,
        clearAll,
        count: bookmarkList.length,
      }}
    >
      {children}
    </BookmarkContext.Provider>
  );
}

export function useBookmarks() {
  const ctx = useContext(BookmarkContext);
  if (!ctx) throw new Error("useBookmarks must be used within BookmarkProvider");
  return ctx;
}