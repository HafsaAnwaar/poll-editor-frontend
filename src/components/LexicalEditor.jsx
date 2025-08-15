import React, { useMemo } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, FORMAT_TEXT_COMMAND, $createParagraphNode, $createTextNode } from 'lexical';
import './LexicalEditor.css';

function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  return (
    <div className="lexical-toolbar">
      <button
        type="button"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        className="toolbar-btn"
        title="Bold"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        className="toolbar-btn"
        title="Italic"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
        className="toolbar-btn"
        title="Underline"
      >
        <u>U</u>
      </button>
      
    </div>
  );
}

// HTML serialization that preserves basic text formatting
function editorStateToHtml(editorState) {
  const escapeHtml = (str) =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  let html = '';
  editorState.read(() => {
    const root = $getRoot();
    const paragraphs = root.getChildren();
    html = paragraphs
      .map((paragraphNode) => {
        if (typeof paragraphNode.getChildren !== 'function') return '';
        const textNodes = paragraphNode.getChildren();
        const inner = textNodes
          .map((textNode) => {
            if (typeof textNode.getTextContent !== 'function') return '';
            let segment = escapeHtml(textNode.getTextContent());
            const format = typeof textNode.getFormat === 'function' ? textNode.getFormat() : 0;
            // bit flags: 1 = bold, 2 = italic, 8 = underline
            if (format & 1) segment = `<strong>${segment}</strong>`;
            if (format & 2) segment = `<em>${segment}</em>`;
            if (format & 8) segment = `<u>${segment}</u>`;
            return segment;
          })
          .join('');
        return `<p>${inner}</p>`;
      })
      .join('');
  });
  return html;
}

function editorStateToPlainText(editorState) {
  let text = '';
  editorState.read(() => {
    const root = $getRoot();
    text = root.getTextContent();
  });
  return text;
}

const LexicalEditor = ({ initialValue, onChange, placeholder }) => {
  const initialConfig = useMemo(() => {
    const editorStateInitializer = (editor) => {
      const root = $getRoot();
      root.clear();
      if (typeof initialValue === 'string' && initialValue.trim()) {
        const trimmed = initialValue.trim();
        if (trimmed.startsWith('{') && trimmed.includes('"root"')) {
          // Parse serialized editor state JSON safely
          try {
            const parsed = editor.parseEditorState(trimmed);
            editor.setEditorState(parsed);
            return;
          } catch (e) {
            // fallback to plain text seed
          }
        }
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(initialValue));
        root.append(paragraph);
        return;
      }
      // default empty paragraph
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(''));
      root.append(paragraph);
    };

    return {
      namespace: 'PollEditor',
      theme: {
        paragraph: 'lexical-paragraph',
        text: {
          bold: 'lexical-text-bold',
          italic: 'lexical-text-italic',
          underline: 'lexical-text-underline',
        },
      },
      editorState: editorStateInitializer,
      onError: (error) => {
        console.error('Lexical error:', error);
      },
    };
  }, [initialValue]);

  const handleChange = (editorState) => {
    if (!onChange) return;
    const plain = editorStateToPlainText(editorState);
    const html = editorStateToHtml(editorState);
    onChange({ plain, html });
  };

  return (
    <div className="lexical-editor-wrapper">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="lexical-editor">
          <ToolbarPlugin />
          <RichTextPlugin
            contentEditable={<ContentEditable className="lexical-content-editable" placeholder={placeholder} />}
            placeholder={<div className="lexical-placeholder">{placeholder}</div>}
          />
          <OnChangePlugin onChange={handleChange} />
          <HistoryPlugin />
        </div>
      </LexicalComposer>
    </div>
  );
};

export default LexicalEditor;
