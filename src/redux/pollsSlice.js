import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Async thunks for API calls
export const fetchPolls = createAsyncThunk(
  'polls/fetchPolls',
  async () => {
    const response = await axios.get('/api/polls');
    return response.data;
  }
);

export const createPoll = createAsyncThunk(
  'polls/createPoll',
  async (pollData) => {
    const response = await axios.post('/api/polls', pollData);
    return response.data;
  }
);

export const updatePoll = createAsyncThunk(
  'polls/updatePoll',
  async ({ id, pollData }) => {
    const response = await axios.put(`/api/polls/${id}`, pollData);
    return response.data;
  }
);

export const votePoll = createAsyncThunk(
  'polls/votePoll',
  async ({ pollId, optionId }) => {
    const response = await axios.post(`/api/polls/${pollId}/vote`, { optionId });
    return response.data;
  }
);

// Persist undo vote on server (decrement counts)
export const unvotePoll = createAsyncThunk(
  'polls/unvotePoll',
  async ({ pollId, optionId }) => {
    const response = await axios.post(`/api/polls/${pollId}/unvote`, { optionId });
    return response.data;
  }
);

export const deletePoll = createAsyncThunk(
  'polls/deletePoll',
  async (pollId) => {
    const response = await axios.delete(`/api/polls/${pollId}`);
    return { pollId, ...response.data };
  }
);

export const resetPoll = createAsyncThunk(
  'polls/resetPoll',
  async (pollId) => {
    const response = await axios.post(`/api/polls/${pollId}/reset`);
    return response.data;
  }
);

const pollsSlice = createSlice({
  name: 'polls',
  initialState: {
    polls: [],
    currentPoll: null,
    loading: false,
    error: null,
  },
  reducers: {
    setCurrentPoll: (state, action) => {
      state.currentPoll = action.payload;
    },
    updatePollInStore: (state, action) => {
      const index = state.polls.findIndex(poll => poll._id === action.payload._id);
      if (index !== -1) {
        state.polls[index] = action.payload;
      }
      if (state.currentPoll && state.currentPoll._id === action.payload._id) {
        state.currentPoll = action.payload;
      }
    },
    addPollToStore: (state, action) => {
      state.polls.unshift(action.payload);
    },
    removePollFromStore: (state, action) => {
      const pollId = action.payload;
      state.polls = state.polls.filter(p => p._id !== pollId);
      if (state.currentPoll && state.currentPoll._id === pollId) {
        state.currentPoll = null;
      }
    },
    // Optimistic vote update (increment a local copy until server confirms)
    incrementVoteOptimistic: (state, action) => {
      const { pollId, optionId } = action.payload;
      const poll = state.polls.find(p => p._id === pollId);
      if (!poll) return;
      const option = poll.options.find(o => o._id === optionId);
      if (!option) return;
      option.votes += 1;
      poll.totalVotes += 1;
      if (state.currentPoll && state.currentPoll._id === pollId) {
        state.currentPoll = { ...poll };
      }
    },
    // Optimistic vote decrement (when user removes their vote)
    decrementVoteOptimistic: (state, action) => {
      const { pollId, optionId } = action.payload;
      const poll = state.polls.find(p => p._id === pollId);
      if (!poll) return;
      const option = poll.options.find(o => o._id === optionId);
      if (!option) return;
      option.votes = Math.max(0, option.votes - 1);
      poll.totalVotes = Math.max(0, poll.totalVotes - 1);
      if (state.currentPoll && state.currentPoll._id === pollId) {
        state.currentPoll = { ...poll };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch polls
      .addCase(fetchPolls.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPolls.fulfilled, (state, action) => {
        state.loading = false;
        state.polls = action.payload;
        state.error = null;
      })
      .addCase(fetchPolls.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Create poll
      .addCase(createPoll.fulfilled, (state, action) => {
        state.polls.unshift(action.payload);
      })
      // Update poll
      .addCase(updatePoll.fulfilled, (state, action) => {
        const index = state.polls.findIndex(poll => poll._id === action.payload._id);
        if (index !== -1) {
          state.polls[index] = action.payload;
        }
      })
      // Vote poll (server confirmation)
      .addCase(votePoll.fulfilled, (state, action) => {
        const index = state.polls.findIndex(poll => poll._id === action.payload._id);
        if (index !== -1) {
          state.polls[index] = action.payload;
        }
        if (state.currentPoll && state.currentPoll._id === action.payload._id) {
          state.currentPoll = action.payload;
        }
      })
      // Unvote poll (server confirmation)
      .addCase(unvotePoll.fulfilled, (state, action) => {
        const index = state.polls.findIndex(poll => poll._id === action.payload._id);
        if (index !== -1) {
          state.polls[index] = action.payload;
        }
        if (state.currentPoll && state.currentPoll._id === action.payload._id) {
          state.currentPoll = action.payload;
        }
      })
      // Delete poll
      .addCase(deletePoll.fulfilled, (state, action) => {
        const pollId = action.payload.pollId;
        state.polls = state.polls.filter(p => p._id !== pollId);
        if (state.currentPoll && state.currentPoll._id === pollId) {
          state.currentPoll = null;
        }
      })
      // Reset poll
      .addCase(resetPoll.fulfilled, (state, action) => {
        const index = state.polls.findIndex(p => p._id === action.payload._id);
        if (index !== -1) {
          state.polls[index] = action.payload;
        }
        if (state.currentPoll && state.currentPoll._id === action.payload._id) {
          state.currentPoll = action.payload;
        }
      });
  },
});

export const { setCurrentPoll, updatePollInStore, addPollToStore, removePollFromStore, incrementVoteOptimistic, decrementVoteOptimistic } = pollsSlice.actions;
export default pollsSlice.reducer;
