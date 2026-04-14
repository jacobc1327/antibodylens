import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { BookmarkProvider, useBookmarks } from "./contexts/BookmarkContext";
import SearchPage from "./pages/SearchPage";
import TargetPage from "./pages/TargetPage";
import AntibodyDetailPage from "./pages/AntibodyDetailPage";
import BookmarksPage from "./pages/BookmarksPage";
import ComparePage from "./pages/ComparePage";
import "./App.css";

function NavBar() {
  const { count } = useBookmarks();
  return (
    <header className="app-header">
      <div className="header-left">
        <Link to="/" className="logo">
          <span className="logo-icon">🔬</span>
          <span className="logo-text">AntibodyLens</span>
        </Link>
        <p className="tagline">Open-source antibody validation intelligence</p>
      </div>
      <nav className="header-nav">
        <Link to="/bookmarks" className="nav-link">
          ★ Saved{count > 0 && <span className="nav-badge">{count}</span>}
        </Link>
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <BookmarkProvider>
        <div className="app">
          <NavBar />

          <main className="app-main">
            <Routes>
              <Route path="/" element={<SearchPage />} />
              <Route path="/target/:id" element={<TargetPage />} />
              <Route path="/antibody/:id" element={<AntibodyDetailPage />} />
              <Route path="/bookmarks" element={<BookmarksPage />} />
              <Route path="/compare" element={<ComparePage />} />
            </Routes>
          </main>

          <footer className="app-footer">
            <p>
              Data sourced from UniProt &amp; public antibody registries. Built
              by Jacob Cho — Duke BME/CS '28.
            </p>
          </footer>
        </div>
      </BookmarkProvider>
    </BrowserRouter>
  );
}