import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installNetworkMeter } from './utils/networkMeter';
import App from './App';
import './styles.css';

// Start realtime zero-egress network monitoring before app mounts
installNetworkMeter();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
