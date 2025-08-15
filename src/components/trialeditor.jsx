import React, {useState, useEffect, useMemo, useCallBack} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { usePollContext } from '../context/PollContext';
import {votePoll, incrementVoteOptimistic, decrementVoteOptimistic} from '../redux/pollsSlice';
import socketService from '../socket/socket'
import DOMPurify from 'dompurify';
import './PollViewer.css'

const PollViewer = ({polls, selectedPoll, onPollSelect = false }) => {
    const dispatch = useDispatch();
    const {settings} = usePollContext();
    const {currentPoll} = useSelector(state => state.polls);

    const [votingId, setVotingId] = useState(null);

    const activePoll = useMemo(()=>{
        const selectedId = selectedPoll?._id || currentPoll?._id;
        if(!selectedId) return null;
        return polls.find(p => p._id === selectedId) || null;
    }, [polls, selectedPoll, currentPoll]);

    useEffect(() =>{
        socketService.onVoteUpdate(({
            pollId, updatedPoll
        })=>{
            if(updatedPoll) {
                dispatch({type: 'polls/updatedPollInStore',
                    payload: updatedPoll
                });
            }
        });
        return () => {
            socketService.off('vote_update');
        };
    }, [dispatch]);

    const extractPlainFromMaybeJson = (str) => {
        if(!str) return '';
        const trimmed = String(str).trim();
        if(trimmed.startWith('{') && trimmed.includes ('"roots"')){
            try{
                const json = JSON.parse(trimmed);
                const children = json?.root?.chidren || [];
                const text = children.map((node)=> Array.isArray(node.children)?node.children.map((c)=>c.text || '').join(''):'').join(' ').trim();
                return text || 'Untitled Poll';
            }catch(_){
                return 'Untitled Poll';
            }
        }
        return trimmed || 'Untitled Poll';
    };

    const convertLexicalToHtml = (str) =>{
        if(!str) return '';
        const trimmed = String(str).trim();
        if(trimmed.startsWith('{') && trimmed.includes('"root"')){
            try{
                const json = JSON.parse(trimmed);
                const children = json?.root?.children || [];
                return children.map((node) => {
                    if(node.type == 'paragraph'){
                        const textContent = Array.isArray(node.children)?node.children.map((child) =>{
                            let text = child.text || '';
                            if(child.format && child.format > 0){
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
   
  const sanitize = (html) => ({
    __html: DOMPurify.sanitize(html || "")
  });

  const renderQuestion = (poll) => {
   if (poll.questionHtml){
    return <div 
    className='poll-question-content'
    dangerouslySetInnerHTML={sanitize(poll.questionHtml)} />;

   }
   else if ( poll.question){
    const richHtml = convertLexicalToHtml(poll.question);
    return <div
    className='poll-question-content'
    dangerouslySetInnerHTML={sanitize(richHtml)} />;

   }
   return <div
   className='poll-question-content'>
    <p>Untitled Poll</p>
   </div>;

  };

  const renderOptionText = (option) => {
    if(option.html){
        return <span
        dangerouslySetInnerHTML={sanitize(Option.html)} />;
    }else if (option.text) {
        const trimmed = String(option.text).trim();
        if (trimmed.startsWith('{') && trimmed.includes('"root"')){
            const richHtml = convertLexicalToHtml(option.text);
            return <span 
            dangerouslySetInnerHTML={sanitize(richHtml)} />;
        }
        return <span>{option.text}</span>;
    }
    return <span>Option</span>
  };

  const getUserVotes = (pollId) => {
    try{
        const votes = JSON.parse(localStorage.getItem(`user_votes_${pollId}`) || '[]');
        return Array.isArray(votes) ? 
        votes : [];
    } catch{
        return[];
    }
  };
    const saveUserVotes = (pollId, votes) => {
    localStorage.setItem(`user_votes_${pollId}`, JSON.stringify(votes));
  };

  // Check if user voted for a specific option
  const hasUserVotedForOption = (pollId, optionId) => {
    const userVotes = getUserVotes(pollId);
    return userVotes.includes(optionId);
  };

  const toggleVote = useCallBack(
    async (pollId, optionId) =>{
        if(!activePoll || !activePoll.isActive) return;
        setVotingId(optionId);

        try{
            const userVotes = getUserVotes(pollId);
            const hasVoted = userVotes.includes(optionId);

            if(hasVoted){
                const newVotes = userVotes.flter(id => id !== optionId);
                saveUserVotes(pollId, newVotes);

                dispatch(decrementVoteOptimistic({
                    pollId, optionId
                }));

                console.log('Vote removed from option');

            }else {
                const newVotes = [...userVotes, optionId];
                saveUserVotes(pollId, newVotes);

                dispatch(incrementVoteOptimistic({pollId, optionId}));

                const result = await dispatch (votePoll({pollId, optionId})).unwrap();

                socketService.broadcastVote(pollId, optionId, result);

                console.log('vote added to option')
            }
        }catch (error){
            console.error('Vote operation failed:', error);
            alert('vote operation failed');

            if(!hasUserVotedForOption(pollId, optionId)){
                const userVotes = getUserVotes(pollId);
                const newVotes = userVotes.filter (id => id !== optionId);
                saveUserVotes(pollId, newVotes);
            }
        }finally {
            setVotingId(null);
        }
    },[activePoll, dispatch]
  );

  const calculatePercentage = (votes, totalVotes) => {
    if (totalVotes === 0)
        return 0;
    return Math.round((votes/totalVotes)*100);
  };

  const renderPoll = (poll) => {
    const userVotes = getUserVotes(poll._id);
    return(
        <div key={poll._id}
        className='poll-viewer-card'>
            <h2>{renderQuestion(poll)}</h2>
            <div className="poll-meta">
                         <span className={`status ${poll.isActive ? 'active' : 'inactive'}`}>
              {poll.isActive ? 'Active' : 'Inactive'}
            </span>
            <span 
            className='poll-votes'>
                {poll.totalVotes} vote {poll.totalVotes !== 1? 's' : ''}
            </span>
            <span 
            className='poll-created'>
                Created {new Date(poll.createdAt).toLocaleDateString()}
            </span>
            </div>
        </div>
        
    )
  }
}