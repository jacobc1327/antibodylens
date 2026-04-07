import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SearchPage from "./pages/SearchPage";
import TargetPage from "./pages/TargetPage";
import AntibodyDetailPage from "./pages/AntibodyDetailPage";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="app-header">
          <a href="/" className="logo">
            <span className="logo-icon">🔬</span>
            <span className="logo-text">AntibodyLens</span>
          </a>
          <p className="tagline">Open-source antibody validation intelligence</p>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/target/:id" element={<TargetPage />} />
            <Route path="/antibody/:id" element={<AntibodyDetailPage />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <p>
            Data sourced from UniProt &amp; public antibody registries.
            Built by Jacob Cho — Duke BME/CS '28.
          </p>
        </footer>
      </div>
    </BrowserRouter>
  );
}
