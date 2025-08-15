import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { PollProvider } from './context/PollContext';
import store from './redux/store';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <PollProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PollProvider>
    </Provider>
  </React.StrictMode>
);
