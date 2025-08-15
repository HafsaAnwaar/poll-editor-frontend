import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { usePollContext } from './context/PollContext';
import { fetchPolls } from './redux/pollsSlice';
import PollEditor from './components/PollEditor';
import PollList from './components/PollList';
import PollViewer from './components/PollViewer';
import socketService from './socket/socket';
import './App.css';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';

function App() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings, updateSettings } = usePollContext();
  const { polls, loading, error } = useSelector(state => state.polls);
  const [selectedPoll, setSelectedPoll] = useState(null);

  useEffect(() => {
    // Connect to WebSocket
    socketService.connect();
    
    // Fetch polls on mount
    dispatch(fetchPolls());

    // Set up WebSocket listeners
    socketService.onPollCreated((poll) => {
      dispatch({ type: 'polls/addPollToStore', payload: poll });
    });

    socketService.onPollUpdated((poll) => {
      dispatch({ type: 'polls/updatePollInStore', payload: poll });
    });

    socketService.onPollDeleted(({ pollId }) => {
      dispatch({ type: 'polls/removePollFromStore', payload: pollId });
      setSelectedPoll((prev) => (prev && prev._id === pollId ? null : prev));
    });

    return () => {
      socketService.disconnect();
    };
  }, [dispatch]);

  // Sync route -> displayMode
  useEffect(() => {
    if (location.pathname.startsWith('/editor') && settings.displayMode !== 'editor') {
      updateSettings({ displayMode: 'editor' });
    } else if (location.pathname.startsWith('/viewer') && settings.displayMode !== 'viewer') {
      updateSettings({ displayMode: 'viewer' });
    } 
  }, [location.pathname]);

  const handleModeChange = (mode) => {
    updateSettings({ displayMode: mode });
    if (mode === 'editor') navigate('/editor');
    if (mode === 'viewer') navigate('/viewer');

  };

  const handlePollSelect = (poll) => {
    setSelectedPoll(poll);
    if (poll) {
      socketService.subscribeToPoll(poll._id);
    }
  };

  const EditorScreen = () => (
    <div className="app-content">
      <PollList 
        polls={polls} 
        onPollSelect={handlePollSelect}
        selectedPoll={selectedPoll}
      />
      <PollEditor 
        poll={selectedPoll}
        onPollSelect={handlePollSelect}
      />
    </div>
  );

  const ViewerScreen = ({ presentationMode = false }) => (
    <PollViewer 
      polls={polls}
      selectedPoll={selectedPoll}
      onPollSelect={handlePollSelect}
      presentationMode={presentationMode}
    />
  );

  if (loading) {
    return <div className="loading">Loading polls...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className={`app`} data-theme={settings.theme}>
      <header className="app-header">
        <h1>Real-Time Poll Editor</h1>
        <div className="mode-selector">
          <button 
            className={`btn ${settings.displayMode === 'editor' ? 'btn-success' : 'btn-secondary'}`}
            onClick={() => handleModeChange('editor')}
          >
            Editor
          </button>
          <button 
            className={`btn ${settings.displayMode === 'viewer' ? 'btn-success' : 'btn-secondary'}`}
            onClick={() => handleModeChange('viewer')}
          >
            Viewer
          </button>
          <div className="theme-toggle" title="Toggle theme">
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.theme === 'dark'}
                onChange={() => updateSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' })}
              />
              <span className="slider" />
            </label>
            <span className="theme-label">{settings.theme === 'light' ? 'Light' : 'Dark'}</span>
          </div>
        </div>
        {/* <div className="settings">
          <label>
            <input 
              type="checkbox" 
              checked={settings.showResults}
              onChange={() => updateSettings({ showResults: !settings.showResults })}
            />
            Show Results
          </label>
          <label>
            <input 
              type="checkbox" 
              checked={settings.liveMode}
              onChange={() => updateSettings({ liveMode: !settings.liveMode })}
            />
            Live Mode
          </label>
        </div> */}
      </header>
      
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/editor" replace />} />
          <Route path="/editor" element={<EditorScreen />} />
          <Route path="/viewer" element={<ViewerScreen />} />
          <Route path="/presentation" element={<ViewerScreen presentationMode={true} />} />
          <Route path="*" element={<Navigate to="/editor" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
