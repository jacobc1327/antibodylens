import React from "react";
import { useBookmarks } from "../contexts/BookmarkContext";

export default function BookmarkButton({ antibody, size = "sm" }) {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const bookmarked = isBookmarked(antibody.id);

  const handleClick = (e) => {
    e.stopPropagation(); // don't trigger row click
    toggleBookmark(antibody);
  };

  return (
    <button
      className={`bookmark-btn bookmark-${size} ${bookmarked ? "bookmarked" : ""}`}
      onClick={handleClick}
      title={bookmarked ? "Remove from saved" : "Save antibody"}
      aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
    >
      {bookmarked ? "★" : "☆"}
    </button>
  );
}