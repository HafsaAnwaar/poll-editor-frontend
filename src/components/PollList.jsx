import React from 'react';
import DOMPurify from 'dompurify';
import './PollList.css';

const PollList = ({ polls, onPollSelect, selectedPoll }) => {

  const truncateText = (text, maxLength = 50) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

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
        return text || trimmed;
      } catch (_) {
        return trimmed;
      }
    }
    return trimmed;
  };

  const getPollPreview = (poll) => {
    // Prefer rich HTML if available
    if (poll.questionHtml) {
      const clean = DOMPurify.sanitize(poll.questionHtml);
      return { type: 'html', value: clean };
    }
    const plain = extractPlainFromMaybeJson(poll.question);
    if (plain) return { type: 'text', value: truncateText(plain, 60) };
    return { type: 'text', value: 'No preview available' };
  };

  return (
    <div className="poll-list">
      <div className="poll-list-header">
        <h2>Polls ({polls.length})</h2>
        <button 
          className="btn btn-success"
          onClick={() => onPollSelect(null)}
        >
          + New Poll
        </button>
      </div>
      
      <div className="poll-list-content">
        {polls.length === 0 ? (
          <div className="empty-state">
            <p>No polls yet. Create your first poll!</p>
          </div>
        ) : (
          polls.map((poll) => (
            <div
              key={poll._id}
              className={`poll-item ${selectedPoll?._id === poll._id ? 'selected' : ''}`}
              onClick={() => onPollSelect(poll)}
            >
              <div className="poll-item-header">
                {(() => {
                  const preview = getPollPreview(poll);
                  if (preview.type === 'html') {
                    return (
                      <h3 dangerouslySetInnerHTML={{ __html: preview.value }} />
                    );
                  }
                  return (<h3>{preview.value}</h3>);
                })()}
                <div className="poll-statuses">
                  <span className={`status ${poll.isActive ? 'active' : 'inactive'}`}>
                    {poll.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              
              <div className="poll-item-details">
                <p className="poll-options">
                  {poll.options.length} option{poll.options.length !== 1 ? 's' : ''}
                </p>
                <p className="poll-votes">
                  {poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}
                </p>
                <span className={`status ${(poll.allowMultipleVotes === true || poll.allowMultipleVotes === 'true') ? 'multiple-answer' : 'single-answer'}`}>
                  {(poll.allowMultipleVotes === true || poll.allowMultipleVotes === 'true') ? 'Multiple Answer' : 'Single Answer'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PollList;
