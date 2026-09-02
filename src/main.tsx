import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const root = document.getElementById('root');
if (root === null) throw new Error('#root missing from index.html');

createRoot(root).render(
  <StrictMode>
    <p className="p-8 text-lg">scaffold ok</p>
  </StrictMode>,
);
