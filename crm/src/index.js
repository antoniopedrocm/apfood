import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
// Importa o service worker
import * as serviceWorkerRegistration from './serviceWorker';

// Em produção, prepara redirecionamento para o domínio personalizado
if (process.env.NODE_ENV === 'production') {
  const { hostname, protocol, pathname, search, hash } = window.location;
  // Quando o app estiver hospedado no Firebase Hosting, o domínio será apfood-e9627.web.app.
  // Esta verificação permite redirecionar futuramente para a versão www do domínio.
  if (hostname === 'apfood-e9627.web.app') {
    const redirectURL = `${protocol}//www.${hostname}${pathname}${search}${hash}`;
    window.location.replace(redirectURL);
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Habilita o service worker para notificações, cache offline e PWA
serviceWorkerRegistration.register();