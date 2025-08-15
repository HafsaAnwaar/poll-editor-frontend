import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { usePollContext } from '../context/PollContext';
import { votePoll, unvotePoll, incrementVoteOptimistic, decrementVoteOptimistic } from '../redux/pollsSlice';
import socketService from '../socket/socket';
import DOMPurify from 'dompurify';
import './PollViewer.css';

const PollViewer = ({ polls, selectedPoll, onPollSelect, presentationMode = false }) => {
  const dispatch = useDispatch();
  const { settings } = usePollContext();
  const { currentPoll } = useSelector(state => state.polls);
  
  const [votingId, setVotingId] = useState(null);

  // Always derive the active poll fresh from the Redux store by id so updates reflect immediately
  const activePoll = useMemo(() => {
    const selectedId = selectedPoll?._id || currentPoll?._id;
    if (!selectedId) return null;
    return polls.find(p => p._id === selectedId) || null;
  }, [polls, selectedPoll, currentPoll]);

  useEffect(() => {
    // Listen for vote updates from WebSocket
    socketService.onVoteUpdate(({ pollId, updatedPoll }) => {
      if (updatedPoll) {
        dispatch({ type: 'polls/updatePollInStore', payload: updatedPoll });
      }
    });

    return () => {
      socketService.off('vote_update');
    };
  }, [dispatch]);

  const extractPlainFromMaybeJson = (str) => {
    if (!str) return '';
    const trimmed = String(str).trim();
    if (trimmed.startsWith('{') && trimmed.includes('"root"')) {
      try {
        const json = JSON.parse(trimmed);
        const children = json?.root?.children || [];
        const text = children
          .map((node) => Array.isArray(node.children) ? node.children.map((c) => c.text || '').join('') : '')
          .join(' ')
          .trim();
        return text || 'Untitled Poll';
      } catch (_) {
        return 'Untitled Poll';
      }
    }
    return trimmed || 'Untitled Poll';
  };

  const convertLexicalToHtml = (str) => {
    if (!str) return '';
    const trimmed = String(str).trim();
    if (trimmed.startsWith('{') && trimmed.includes('"root"')) {
      try {
        const json = JSON.parse(trimmed);
        const children = json?.root?.children || [];
        return children
          .map((node) => {
            if (node.type === 'paragraph') {
              const textContent = Array.isArray(node.children) 
                ? node.children.map((child) => {
                    let text = child.text || '';
                    if (child.format && child.format > 0) {
                      // Apply Lexical formatting
                      if (child.format & 1) text = `<strong>${text}</strong>`; // bold
                      if (child.format & 2) text = `<em>${text}</em>`; // italic
                      if (child.format & 8) text = `<u>${text}</u>`; // underline
                    }
                    return text;
                  }).join('')
                : '';
              return `<p>${textContent}</p>`;
            }
            return '';
          })
          .join('');
      } catch (_) {
        return `<p>${trimmed}</p>`;
      }
    }
    return `<p>${trimmed}</p>`;
  };

  const sanitize = (html) => ({ __html: DOMPurify.sanitize(html || "") });

  const renderQuestion = (poll) => {
    // Always try to show rich text if available
    if (poll.questionHtml) {
      return <div className="poll-question-content" dangerouslySetInnerHTML={sanitize(poll.questionHtml)} />;
    } else if (poll.question) {
      const richHtml = convertLexicalToHtml(poll.question);
      return <div className="poll-question-content" dangerouslySetInnerHTML={sanitize(richHtml)} />;
    }
    return <div className="poll-question-content"><p>Untitled Poll</p></div>;
  };

  const renderOptionText = (option) => {
    // Check if option has HTML content
    if (option.html) {
      return <span dangerouslySetInnerHTML={sanitize(option.html)} />;
    } else if (option.text) {
      // Try to convert if it's Lexical JSON, otherwise show as plain text
      const trimmed = String(option.text).trim();
      if (trimmed.startsWith('{') && trimmed.includes('"root"')) {
        const richHtml = convertLexicalToHtml(option.text);
        return <span dangerouslySetInnerHTML={sanitize(richHtml)} />;
      }
      return <span>{option.text}</span>;
    }
    return <span>Option</span>;
  };

  // Get user's votes for a specific poll
  const getUserVotes = (pollId) => {
    try {
      const votes = JSON.parse(localStorage.getItem(`user_votes_${pollId}`) || '[]');
      return Array.isArray(votes) ? votes : [];
    } catch {
      return [];
    }
  };

  // Save user's votes for a specific poll
  const saveUserVotes = (pollId, votes) => {
    localStorage.setItem(`user_votes_${pollId}`, JSON.stringify(votes));
  };

  // Check if user voted for a specific option
  const hasUserVotedForOption = (pollId, optionId) => {
    const userVotes = getUserVotes(pollId);
    return userVotes.includes(optionId);
  };

  const toggleVote = useCallback(
    async (pollId, optionId) => {
      if (!activePoll || !activePoll.isActive) return;
      
      setVotingId(optionId);
      
      try {
        const userVotes = getUserVotes(pollId);
        const hasVoted = userVotes.includes(optionId);
        
        // Debug logging
        console.log('=== VOTE DEBUG ===');
        console.log('Poll allowMultipleVotes:', activePoll.allowMultipleVotes);
        console.log('Type of allowMultipleVotes:', typeof activePoll.allowMultipleVotes);
        
        // Ensure proper boolean handling for allowMultipleVotes
        const isMultipleVoteMode = activePoll.allowMultipleVotes === true || activePoll.allowMultipleVotes === 'true';
        console.log('Is multiple vote mode:', isMultipleVoteMode);
        console.log('Current user votes:', userVotes);
        console.log('Has voted for this option:', hasVoted);
        
        if (hasVoted) {
          // Remove vote (undo) - works in both modes
          const newVotes = userVotes.filter(id => id !== optionId);
          saveUserVotes(pollId, newVotes);
          
          // Send unvote to server to properly decrement vote count
          const result = await dispatch(unvotePoll({ pollId, optionId })).unwrap();
          
          // Broadcast unvote via WebSocket
          socketService.broadcastVote(pollId, optionId, result);
          
          console.log('Vote removed from option:', optionId);
        } else {
          // Adding a new vote
          if (!isMultipleVoteMode && userVotes.length > 0) {
            // Single vote mode: remove previous vote and add new one
            const previousVote = userVotes[0];
            console.log('Single vote mode: removing previous vote:', previousVote);
            
            // Send unvote for previous option first
            try {
              await dispatch(unvotePoll({ pollId, optionId: previousVote })).unwrap();
              console.log('Previous vote removed from server');
            } catch (error) {
              console.error('Failed to remove previous vote:', error);
            }
            
            // Save only the new vote (single vote mode)
            saveUserVotes(pollId, [optionId]);
            console.log('Single vote mode: saved new vote:', optionId);
          } else {
            // Multiple vote mode: add to existing votes
            const newVotes = [...userVotes, optionId];
            saveUserVotes(pollId, newVotes);
            console.log('Multiple vote mode: added vote to existing votes:', newVotes);
          }
          
          // Send vote to server
          const result = await dispatch(votePoll({ pollId, optionId })).unwrap();
          
          // Broadcast vote via WebSocket
          socketService.broadcastVote(pollId, optionId, result);

          console.log('Vote added to option:', optionId);
        }
      } catch (error) {
        console.error('Vote operation failed:', error);
        alert("Vote operation failed");
        
        // Revert optimistic changes on error
        if (!hasUserVotedForOption(pollId, optionId)) {
          const userVotes = getUserVotes(pollId);
          const newVotes = userVotes.filter(id => id !== optionId);
          saveUserVotes(pollId, newVotes);
        }
      } finally {
        setVotingId(null);
      }
    },
    [activePoll, dispatch]
  );

  const calculatePercentage = (votes, totalVotes) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  const renderPoll = (poll) => {
    const userVotes = getUserVotes(poll._id);
    
    // Debug logging for render
    console.log('=== RENDER DEBUG ===');
    console.log('Poll ID:', poll._id);
    console.log('Poll allowMultipleVotes:', poll.allowMultipleVotes);
    console.log('Type of allowMultipleVotes:', typeof poll.allowMultipleVotes);
    
    // Ensure proper boolean handling for allowMultipleVotes
    const isMultipleVoteMode = poll.allowMultipleVotes === true || poll.allowMultipleVotes === 'true';
    console.log('Is multiple vote mode (render):', isMultipleVoteMode);

    return (
      <div key={poll._id} className="poll-viewer-card">
        <div className="poll-question">
          <h2>{renderQuestion(poll)}</h2>
          <div className="poll-meta">
            <div className="poll-statuses">
              <span className={`status ${poll.isActive ? 'active' : 'inactive'}`}>
                {poll.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <span className="poll-votes">
              {poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}
            </span>
            <span className="poll-created">
              Created {new Date(poll.createdAt).toLocaleString()}
            </span>
            <span className={`status ${isMultipleVoteMode ? 'multiple-answer' : 'single-answer'}`}>
              {isMultipleVoteMode ? 'Multiple Answer' : 'Single Answer'}
            </span>
          </div>
          


        </div>

        <div className="poll-options">
          {poll.options.map((option) => {
            const percentage = calculatePercentage(option.votes, poll.totalVotes);
            const isWinning = poll.totalVotes > 0 && option.votes === Math.max(...poll.options.map(o => o.votes));
            const hasUserVoted = hasUserVotedForOption(poll._id, option._id);
            const isVoting = votingId === option._id;

            return (
              <div
                key={option._id}
                className={`poll-option ${hasUserVoted ? 'user-voted' : ''} ${isWinning ? 'winning' : ''} ${!poll.isActive ? 'disabled' : ''}`}
                onClick={() => poll.isActive && toggleVote(poll._id, option._id)}
                style={{ cursor: poll.isActive ? 'pointer' : 'default' }}
              >
                <div className="option-content">
                  <div className="option-text">
                    {renderOptionText(option)}
                  </div>
                  
                  <div className="option-stats">
                    <span className="vote-count">
                      {option.votes} vote{option.votes !== 1 ? 's' : ''}
                    </span>
                    <span className="percentage">{percentage}%</span>
                  </div>

                  <div className="vote-bar">
                    <div 
                      className="vote-fill"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
                
                {hasUserVoted && (
                  <div className="user-vote-indicator">✓ Your vote</div>
                )}
                
                {isVoting && (
                  <div className="voting-indicator">Processing...</div>
                )}
              </div>
            );
          })}
        </div>

        {/* {userVotes.length > 0 && (
          <div className="vote-feedback">
            <p>You've voted for {userVotes.length} option{userVotes.length !== 1 ? 's' : ''} 🎉</p>
            <p className="vote-hint">
              {isMultipleVoteMode 
                ? "Click on an option again to remove your vote" 
                : "Click on another option to change your vote"
              }
            </p>
          </div>
        )} */}
        
        {/* {!isMultipleVoteMode && userVotes.length === 0 && (
          <div className="vote-feedback single-vote-notice">
            <p>Single Answer Mode: You can only choose one option</p>
          </div>
        )} */}
        
        {/* {isMultipleVoteMode && userVotes.length === 0 && (
          <div className="vote-feedback multiple-vote-notice">
            <p>Multiple Answer Mode: You can choose multiple options</p>
          </div>
        )} */}
        
        {/* Voting mode indicator */}
       
      </div>
    );
  };

  // if (presentationMode) {
  //   // Full-screen presentation mode
  //   return (
  //     <div className="poll-viewer presentation-mode">
  //       {activePoll ? (
  //         <div className="presentation-content">
  //           {renderPoll(activePoll)}
  //         </div>
  //       ) : (
  //         <div className="presentation-placeholder">
  //           <h1>No poll selected</h1>
  //           <p>Select a poll to start the presentation</p>
  //         </div>
  //       )}
  //     </div>
  //   );
  // }

  return (
    <div className="poll-viewer">
      <div className="poll-viewer-header">
        <h1>Poll Viewer</h1>
        <div className="poll-selector">
          <select 
            value={activePoll?._id || ''} 
            onChange={(e) => {
              const poll = polls.find(p => p._id === e.target.value);
              onPollSelect(poll);
            }}
            className="poll-select"
          >
            <option value="">Select a poll...</option>
            {polls.map(poll => (
              <option key={poll._id} value={poll._id}>
                {extractPlainFromMaybeJson(poll.question)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="poll-viewer-content">
        {activePoll ? (
          renderPoll(activePoll)
        ) : (
          <div className="no-poll-selected">
            <h2>No poll selected</h2>
            <p>Choose a poll from the dropdown above to start voting</p>
          </div>
        )}
      </div>

      {polls.length > 0 && (
        <div className="poll-list-mini">
          <h3>All Polls</h3>
          <div className="mini-poll-list">
            {polls.map(poll => (
              <div
                key={poll._id}
                className={`mini-poll-item ${activePoll?._id === poll._id ? 'active' : ''}`}
                onClick={() => onPollSelect(poll)}
              >
                <span className="mini-poll-title">
                  {extractPlainFromMaybeJson(poll.question)}
                </span>
                <span className="mini-poll-votes">
                  {poll.totalVotes} votes
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PollViewer;
