import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBookmarks } from "../contexts/BookmarkContext";

export default function BookmarksPage() {
  const { bookmarkList, removeBookmark, clearAll, count } = useBookmarks();
  const [compareSet, setCompareSet] = useState(new Set());
  const navigate = useNavigate();

  const toggleCompare = (id) => {
    setCompareSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 5) next.add(id);
      return next;
    });
  };

  const goCompare = () => {
    if (compareSet.size >= 2) {
      navigate(`/compare?ids=${[...compareSet].join(",")}`);
    }
  };

  return (
    <div className="bookmarks-page">
      <div className="bookmarks-header">
        <h1>Saved Antibodies ({count})</h1>
        {count > 0 && (
          <div className="bookmarks-actions">
            {compareSet.size >= 2 && (
              <button className="compare-launch-btn" onClick={goCompare}>
                Compare {compareSet.size} selected →
              </button>
            )}
            <button className="clear-btn" onClick={clearAll}>
              Clear All
            </button>
          </div>
        )}
      </div>

      {count === 0 ? (
        <div className="bookmarks-empty">
          <p>No saved antibodies yet.</p>
          <p>Click the ☆ icon next to any antibody to save it here for quick access and comparison.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>⊕</th>
              <th>Target</th>
              <th>Vendor</th>
              <th>Clone / Catalog</th>
              <th>Host</th>
              <th>Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bookmarkList.map((ab) => (
              <tr key={ab.id} className="clickable-row" onClick={() => navigate(`/antibody/${ab.id}`)}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={compareSet.has(ab.id)}
                    onChange={() => toggleCompare(ab.id)}
                    className="compare-checkbox"
                  />
                </td>
                <td>{ab.gene_name}</td>
                <td>{ab.vendor}</td>
                <td>{ab.clone_name || ab.catalog_number}</td>
                <td>{ab.host_species}</td>
                <td>
                  <span className="score">
                    {ab.overall_score ? Number(ab.overall_score).toFixed(1) : "—"}
                  </span>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    className="remove-btn"
                    onClick={() => removeBookmark(ab.id)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}