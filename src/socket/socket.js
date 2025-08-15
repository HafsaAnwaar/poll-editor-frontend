import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect() {
    if (this.socket) return;

    this.socket = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  subscribeToPoll(pollId) {
    if (this.socket && pollId) {
      this.socket.emit('subscribe', { pollId });
    }
  }

  unsubscribeFromPoll(pollId) {
    if (this.socket && pollId) {
      this.socket.emit('unsubscribe', { pollId });
    }
  }

  broadcastPollCreated(poll) {
    if (this.socket) {
      this.socket.emit('poll_created', poll);
    }
  }

  broadcastPollUpdated(poll) {
    if (this.socket) {
      this.socket.emit('poll_updated', poll);
    }
  }

  broadcastPollDeleted(pollId) {
    if (this.socket) {
      this.socket.emit('poll_deleted', { pollId });
    }
  }

  broadcastVote(pollId, optionId, updatedPoll) {
    if (this.socket) {
      this.socket.emit('vote_cast', { pollId, optionId, updatedPoll });
    }
  }

  onPollCreated(callback) {
    if (this.socket) {
      this.socket.on('poll_created', callback);
    }
  }

  onPollUpdated(callback) {
    if (this.socket) {
      this.socket.on('poll_updated', callback);
    }
  }

  onPollDeleted(callback) {
    if (this.socket) {
      this.socket.on('poll_deleted', callback);
    }
  }

  onVoteUpdate(callback) {
    if (this.socket) {
      this.socket.on('vote_update', callback);
    }
  }

  off(event) {
    if (this.socket) {
      this.socket.off(event);
    }
  }
}

export default new SocketService();
