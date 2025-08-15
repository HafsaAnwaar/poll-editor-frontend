import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { usePollContext } from '../context/PollContext';
import { createPoll, updatePoll, deletePoll, resetPoll } from '../redux/pollsSlice';
import socketService from '../socket/socket';
import LexicalEditor from './LexicalEditor';
import './PollEditor.css';

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
      return text || '';
    } catch (_) {
      return '';
    }
  }
  return trimmed;
};

const PollEditor = ({ poll, onPollSelect }) => {
  const dispatch = useDispatch();
  const { settings } = usePollContext();
  const [questionText, setQuestionText] = useState('');
  const [questionHtml, setQuestionHtml] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isActive, setIsActive] = useState(true);
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Initialize form when poll changes
  useEffect(() => {
    if (poll) {
      const plain = extractPlainFromMaybeJson(poll.question);
      setQuestionText(plain || '');
      setQuestionHtml(poll.questionHtml || '');
      setOptions(poll.options?.map(opt => opt.text) || ['', '']);
      setIsActive(poll.isActive !== false);
      // Ensure proper boolean handling for allowMultipleVotes
      setAllowMultipleVotes(poll.allowMultipleVotes === true || poll.allowMultipleVotes === 'true');
    } else {
      // New poll defaults to 2 empty options
      setQuestionText('');
      setQuestionHtml('');
      setOptions(['', '']);
      setIsActive(true);
      setAllowMultipleVotes(true); // Default to true (checked)
    }
    setError('');
  }, [poll]);

  const handleQuestionChange = useCallback(({ plain, html }) => {
    setQuestionText(plain || '');
    setQuestionHtml(html || '');
  }, []);

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    }
  };

  const handleSave = async () => {
    if (!questionText.trim()) {
      setError('Question is required');
      return;
    }

    const validOptions = options.filter(opt => opt.trim());
    if (validOptions.length < 2) {
      setError('At least 2 options are required');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      // Debug logging
      console.log('=== SAVE DEBUG ===');
      console.log('allowMultipleVotes state:', allowMultipleVotes);
      console.log('Type of allowMultipleVotes:', typeof allowMultipleVotes);
      
      const pollData = {
        question: questionText.trim(),
        questionHtml,
        options: validOptions,
        isActive,
        allowMultipleVotes,
        contentType: 'lexical'
      };
      
      console.log('pollData being sent:', pollData);

      let result;
      if (poll) {
        // Update existing poll
        result = await dispatch(updatePoll({ id: poll._id, pollData })).unwrap();
        socketService.broadcastPollUpdated(result);
      } else {
        // Create new poll
        result = await dispatch(createPoll(pollData)).unwrap();
        socketService.broadcastPollCreated(result);
        onPollSelect(result);
      }

      if (settings.autoSave) {
        // Auto-save feedback
        setTimeout(() => {
          setIsSaving(false);
        }, 1000);
      } else {
        setIsSaving(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to save poll');
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      if (poll) {
        const updated = await dispatch(resetPoll(poll._id)).unwrap();
        socketService.broadcastPollUpdated(updated);
      }
      // Reset form values to current poll state or defaults
      if (poll) {
        const plain = extractPlainFromMaybeJson(poll.question);
        setQuestionText(plain || '');
        setQuestionHtml(poll.questionHtml || '');
        setOptions(poll.options?.map(opt => opt.text) || ['', '']);
        setIsActive(poll.isActive !== false);
        setAllowMultipleVotes(poll.allowMultipleVotes === true || poll.allowMultipleVotes === 'true');
      } else {
        setQuestionText('');
        setQuestionHtml('');
        setOptions(['', '']);
        setIsActive(true);
        setAllowMultipleVotes(true); // Default to true (checked)
      }
      setError('');
    } catch (e) {
      setError('Failed to reset poll');
    }
  };

  const handleDelete = async () => {
    if (!poll) return;
    try {
      await dispatch(deletePoll(poll._id)).unwrap();
      socketService.broadcastPollDeleted(poll._id);
      onPollSelect(null);
    } catch (e) {
      setError('Failed to delete poll');
    }
  };

  // Prefer to seed editor with HTML or plain text; if older polls contain JSON in question, editor handles it, preview uses extracted plain
  const initialEditorValue = poll ? (poll.question || poll.questionHtml || '') : '';

  return (
    <div className="poll-editor">
      <div className="poll-editor-header">
        <h2>{poll ? 'Edit Poll' : 'Create New Poll'}</h2>
        <div className="poll-editor-actions">
          {poll && (
            <button 
              className="btn btn-secondary"
              onClick={handleReset}
              disabled={isSaving}
              title="Reset votes"
            >
              Reset Votes
            </button>
          )}
          <button 
            className="btn btn-secondary"
            onClick={() => {
              // revert UI fields to defaults/current
              if (poll) {
                const plain = extractPlainFromMaybeJson(poll.question);
                setQuestionText(plain || '');
                setQuestionHtml(poll.questionHtml || '');
                setOptions(poll.options?.map(opt => opt.text) || ['', '']);
                setIsActive(poll.isActive !== false);
                setAllowMultipleVotes(poll.allowMultipleVotes === true || poll.allowMultipleVotes === 'true');
              } else {
                setQuestionText('');
                setQuestionHtml('');
                setOptions(['', '']);
                setIsActive(true);
                setAllowMultipleVotes(true); // Default to true (checked)
              }
            }}
            disabled={isSaving}
          >
            Reset Form
          </button>
          {poll && (
            <button
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={isSaving}
              title="Delete poll"
            >
              Delete
            </button>
          )}
          <button 
            className="btn btn-success"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : (poll ? 'Update' : 'Create')}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="poll-editor-content">
        <div className="form-section">
          <label className="form-label">Question</label>
          <div className="lexical-editor-container">
            <LexicalEditor
              initialValue={initialEditorValue}
              onChange={handleQuestionChange}
              placeholder="Enter your poll question..."
            />
          </div>
        </div>

        <div className="form-section">
          <label className="form-label">Options</label>
          <div className="options-container">
            {options.map((option, index) => (
              <div key={index} className="option-input-group">
                <input
                  type="text"
                  className="input option-input"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    className="btn btn-remove"
                    onClick={() => removeOption(index)}
                    title="Remove option"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-add-option"
              onClick={addOption}
            >
              + Add Option
            </button>
          </div>
        </div>

        <div className="form-section">
          <label className="form-label">Settings</label>
          <div className="settings-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active Poll
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={allowMultipleVotes}
                onChange={(e) => setAllowMultipleVotes(e.target.checked)}
              />
              Allow Multiple Votes
            </label>
          </div>
        </div>

        {poll && (
          <div className="form-section">
            <label className="form-label">Preview</label>
            <div className="poll-preview">
              <div className="preview-content" dangerouslySetInnerHTML={{ __html: questionHtml || questionText }} />
              <div className="preview-options">
                {options.filter(opt => opt.trim()).map((option, index) => (
                  <div key={index} className="preview-option">
                    {option}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PollEditor;
