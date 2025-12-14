import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <h1>ReconX</h1>
          <p>Invoice Reconciliation System for Medical Clinics</p>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <p>ReconX v0.1.0 | HIPAA Compliant</p>
        </footer>
      </div>
    </Router>
  );
}

function HomePage() {
  return (
    <div className="home-page">
      <h2>Welcome to ReconX</h2>
      <p>Your invoice reconciliation solution is ready to be configured.</p>
      <div className="features">
        <div className="feature-card">
          <h3>CSV Import</h3>
          <p>Import invoices from CSV files</p>
        </div>
        <div className="feature-card">
          <h3>PDF Parsing</h3>
          <p>Extract data from PDF invoices</p>
        </div>
        <div className="feature-card">
          <h3>Fuzzy Matching</h3>
          <p>Intelligent reconciliation algorithms</p>
        </div>
      </div>
    </div>
  );
}

export default App;
