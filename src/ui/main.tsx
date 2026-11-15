import React from 'react';
import { createRoot } from 'react-dom/client';
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import './styles.css';
import App from './App.js';

const root = document.getElementById('root');
if (!root) throw new Error('Uygulama kökü bulunamadı.');

createRoot(root).render(
  <React.StrictMode>
    <Theme appearance="dark" accentColor="gray" grayColor="gray" radius="medium" scaling="100%">
      <App />
    </Theme>
  </React.StrictMode>,
);
