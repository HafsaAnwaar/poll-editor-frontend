import { configureStore } from '@reduxjs/toolkit';
import pollsReducer from './pollsSlice';

export const store = configureStore({
  reducer: {
    polls: pollsReducer,
  },
});

export default store;
