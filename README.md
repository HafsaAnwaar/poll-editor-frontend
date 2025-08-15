# 📊 Real-Time Poll Editor

A real-time poll/question editor using **Lexical**, **Redux**, and **WebSocket** for live collaboration.

## ⚙️ Tech Stack

- React + Lexical
- Redux Toolkit
- Context API
- Custom WebSocket API
- Tailwind CSS (optional)

## 🎯 Features

- Create and edit rich-text polls
- Broadcast polls to connected viewers
- Live voting results
- Theme and display settings via Context
- Save polls to backend
- Add multiple choice options
- Host in live event mode
- Create rich-text poll questions
- Broadcast polls to viewers in real time
- Toggle settings via Context (e.g., results, theme)

## 🚀 Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Start the backend server:
```bash
cd ../server
npm run start
```

## 📁 Project Structure

```
poll-editor/
├── public/
├── src/
│ ├── components/
│ │ ├── PollEditor.jsx
│ │ ├── PollList.jsx
│ │ └── PollViewer.jsx
│ ├── context/
│ │ └── PollContext.jsx
│ ├── redux/
│ │ ├── store.js
│ │ └── pollsSlice.js
│ ├── socket/
│ │ └── socket.js
│ ├── App.jsx
│ └── index.js
└── README.md
```

## 🔧 Development

The app connects to a WebSocket server running on `ws://localhost:4000` and a REST API on `http://localhost:5000`.

---

## 📦 Optional: Sample WebSocket Server

Here's a basic `ws-server.js` for all three apps:

```js
// ws-server.js
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 4000 });

wss.on('connection', function connection(ws) {
  console.log('Client connected');

  ws.on('message', function incoming(message) {
    // Broadcast to all clients
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on('close', () => console.log('Client disconnected'));
});

console.log('WebSocket server running on ws://localhost:4000');
```
