import { render } from '@solidjs/web';
import './styles.css';
import App from './App.js';
const root = document.getElementById('root');
if (!root) throw new Error('Uygulama kökü bulunamadı.');
render(() => <App />, root);
