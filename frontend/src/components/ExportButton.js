import React from "react";

export default function ExportButton({ href, label = "Export CSV", className = "" }) {
  return (
    <a
      href={href}
      download
      className={`export-btn ${className}`}
      title={label}
    >
      <span className="export-icon">↓</span> {label}
    </a>
  );
}