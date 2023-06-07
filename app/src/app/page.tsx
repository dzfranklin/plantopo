'use client';

import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import dynamic from 'next/dynamic';

export default dynamic(() => Promise.resolve(App), { ssr: false });

function App() {
  return (
    <Router>
      <div>
        <ul>
          <li>
            <Link to="/">Home</Link>
            <Link to="/maps">Maps</Link>
          </li>
        </ul>
      </div>

      <Routes>
        <Route path="/maps" element={<h1>Maps</h1>} />
        <Route path="/" element={<h1>Home</h1>} />
      </Routes>
    </Router>
  );
}
