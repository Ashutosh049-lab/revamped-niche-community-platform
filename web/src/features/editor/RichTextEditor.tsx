import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { 
  LinkIcon,
  PhotoIcon,
  PlayCircleIcon,
  CodeBracketIcon,
  Bars3BottomLeftIcon,
  ListBulletIcon,
  ArrowUturnRightIcon,
  MinusIcon,
  TableCellsIcon,
  XMarkIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import YouTube from '@tiptap/extension-youtube';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Node } from '@tiptap/core';
import { uploadFile } from '../../lib/upload';

const SafeIframe = Node.create({
  name: 'safeIframe',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      width: { default: 640 },
      height: { default: 360 },
      allowfullscreen: { default: true },
    };
  },
  parseHTML() {
    return [{ tag: 'iframe[data-safe="true"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['iframe', { ...HTMLAttributes, 'data-safe': 'true', frameborder: '0' }];
  },
  addCommands() {
    return {
      setSafeIframe:
        (attrs: any) => ({ commands }: any) => {
          return commands.insertContent({ type: this.name, attrs });
        },
    } as any;
  },
});

interface RichTextEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  enableMedia?: boolean;
  communityId?: string;
  onSubmit?: () => void;
}

export default function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Write something...", 
  className = "",
  enableMedia = true,
  communityId,
  onSubmit,
}: RichTextEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: {},
        blockquote: {},
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      YouTube.configure({ inline: false, controls: true }),
      SafeIframe,
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'tiptap-content',
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          if (onSubmit) onSubmit();
          return true;
        }
        return false;
      },
    },
  });

  // Keep editor in sync if parent updates value externally
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || '') !== current) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  async function addImage() {
    if (!enableMedia || !editor) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const url = await uploadFile(file, `communities/${communityId || 'general'}/images`);
        editor.chain().focus().setImage({ src: url }).run();
      } catch (e) {
        alert('Failed to upload image');
      }
    };
    input.click();
  }

  function sanitizeUrl(url: string): string | null {
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u.toString();
    } catch {
      return null;
    }
  }

  function addLink() {
    if (!editor) return;
    const current = editor.getAttributes('link')?.href as string | undefined;
    setUrlInput(current || 'https://');
    setLinkOpen(true);
  }

  function confirmLink() {
    const safe = sanitizeUrl(urlInput);
    if (!safe) { alert('Invalid URL'); return; }
    editor?.chain().focus().extendMarkRange('link').setLink({ href: safe }).run();
    setLinkOpen(false);
  }

  function unsetLink() {
    editor?.chain().focus().unsetLink().run();
  }

  function addYouTube() {
    if (!editor) return;
    setUrlInput('https://');
    setVideoOpen(true);
  }

  function toEmbedUrl(url: string): { src: string; width: number; height: number } | null {
    // YouTube
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      if ((host === 'youtube.com' || host === 'm.youtube.com') && u.searchParams.get('v')) {
        const id = u.searchParams.get('v');
        return { src: `https://www.youtube.com/embed/${id}`, width: 640, height: 360 };
      }
      if (host === 'youtu.be') {
        const id = u.pathname.replace('/', '');
        if (id) return { src: `https://www.youtube.com/embed/${id}`, width: 640, height: 360 };
      }
      // Vimeo
      if (host === 'vimeo.com') {
        const id = u.pathname.split('/').filter(Boolean)[0];
        if (id) return { src: `https://player.vimeo.com/video/${id}`, width: 640, height: 360 };
      }
      if (host === 'player.vimeo.com' && u.pathname.includes('/video/')) {
        return { src: u.toString(), width: 640, height: 360 };
      }
    } catch {}
    return null;
  }

  function confirmYouTube() {
    const safe = sanitizeUrl(urlInput);
    if (!safe) { alert('Invalid URL'); return; }
    const embed = toEmbedUrl(safe);
    if (!embed) { alert('Unsupported video URL'); return; }
    // Try dedicated YouTube extension first, else fallback to safe iframe
    if (embed.src.includes('youtube.com/embed/')) {
      editor?.chain().focus().setYoutubeVideo({ src: embed.src, width: embed.width, height: embed.height }).run();
    } else {
      (editor as any)?.chain().focus().setSafeIframe({ src: embed.src, width: embed.width, height: embed.height, allowfullscreen: true }).run();
    }
    setVideoOpen(false);
  }

  function addTable() {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }
  function addHr() {
    editor?.chain().focus().setHorizontalRule().run();
  }

  return (
    <div className={`richtext-editor ${className}`}>
      <style>{`
        .richtext-editor { position: relative; }
        .richtext-editor .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          border: 1px solid #d1d5db;
          border-bottom: none;
          border-top-left-radius: 8px;
          border-top-right-radius: 8px;
          background: #f9fafb;
          padding: 6px;
        }
        .richtext-editor .toolbar button {
          font-size: 12px;
          padding: 4px 6px;
          border: 1px solid #e5e7eb;
          background: white;
          border-radius: 6px;
          min-width: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .richtext-editor .toolbar .ico { width: 16px; height: 16px; }
        .richtext-editor .toolbar .rotate-90 { transform: rotate(90deg); }
        .richtext-editor .toolbar .sep { width: 1px; background: #e5e7eb; height: 22px; margin: 0 6px; }
        .richtext-editor .tiptap-content {
          min-height: 120px;
          font-size: 14px;
          line-height: 1.6;
          background: white;
          border: 1px solid #d1d5db;
          border-bottom-left-radius: 8px;
          border-bottom-right-radius: 8px;
          padding: 10px 12px;
        }
        .richtext-editor .tiptap-content p.is-editor-empty:first-child::before {
          content: '${placeholder.replace(/'/g, "\\'")}';
          color: #9ca3af;
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>

      <div className="toolbar">
        <button type="button" aria-label="Bold" title="Bold" onClick={() => editor?.chain().focus().toggleBold().run()}>B</button>
        <button type="button" aria-label="Italic" title="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()}><i>I</i></button>
        <button type="button" aria-label="Underline" title="Underline" onClick={() => editor?.chain().focus().toggleUnderline().run()}><u>U</u></button>
        <button type="button" aria-label="Strike" title="Strike" onClick={() => editor?.chain().focus().toggleStrike().run()}><s>S</s></button>
        <button type="button" aria-label="H1" title="H1" onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
        <button type="button" aria-label="H2" title="H2" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button type="button" aria-label="H3" title="H3" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <button type="button" aria-label="Bullet list" title="Bullet list" onClick={() => editor?.chain().focus().toggleBulletList().run()}><ListBulletIcon className="ico" /></button>
        <button type="button" aria-label="Numbered list" title="Numbered list" onClick={() => editor?.chain().focus().toggleOrderedList().run()}>1.</button>
        <button type="button" aria-label="Quote" title="Quote" onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Bars3BottomLeftIcon className="ico" /></button>
        <button type="button" aria-label="Code block" title="Code block" onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><CodeBracketIcon className="ico" /></button>
        <button type="button" aria-label="Horizontal rule" title="Horizontal rule" onClick={addHr}><MinusIcon className="ico" /></button>
        <button type="button" aria-label="Insert link" title="Insert link" onClick={addLink}><LinkIcon className="ico" /></button>
        <button type="button" aria-label="Remove link" title="Remove link" onClick={unsetLink}><XMarkIcon className="ico" /></button>
        {enableMedia && <button type="button" aria-label="Insert image" title="Insert image" onClick={addImage}><PhotoIcon className="ico" /></button>}
        {enableMedia && <button type="button" aria-label="Insert video" title="Insert video" onClick={addYouTube}><PlayCircleIcon className="ico" /></button>}
        <div className="sep" />
        <button type="button" aria-label="Insert table" title="Insert table" onClick={addTable}><TableCellsIcon className="ico" /></button>
        {/* Table controls */}
        <button type="button" aria-label="Row + above" title="Row + above" onClick={() => editor?.chain().focus().addRowBefore().run()}><ArrowUpIcon className="ico" /></button>
        <button type="button" aria-label="Row + below" title="Row + below" onClick={() => editor?.chain().focus().addRowAfter().run()}><ArrowDownIcon className="ico" /></button>
        <button type="button" aria-label="Delete row" title="Delete row" onClick={() => editor?.chain().focus().deleteRow().run()}><XMarkIcon className="ico" /></button>
        <button type="button" aria-label="Col + left" title="Col + left" onClick={() => editor?.chain().focus().addColumnBefore().run()}><ArrowLeftIcon className="ico" /></button>
        <button type="button" aria-label="Col + right" title="Col + right" onClick={() => editor?.chain().focus().addColumnAfter().run()}><ArrowRightIcon className="ico" /></button>
        <button type="button" aria-label="Delete col" title="Delete col" onClick={() => editor?.chain().focus().deleteColumn().run()}><XMarkIcon className="ico" /></button>
        <button type="button" aria-label="Toggle header row" title="Toggle header row" onClick={() => editor?.chain().focus().toggleHeaderRow().run()}>Hdr Row</button>
        <button type="button" aria-label="Toggle header col" title="Toggle header col" onClick={() => editor?.chain().focus().toggleHeaderColumn().run()}>Hdr Col</button>
        <button type="button" aria-label="Delete table" title="Delete table" onClick={() => editor?.chain().focus().deleteTable().run()}><XMarkIcon className="ico" /></button>
        <div className="sep" />
        <button type="button" aria-label="Clear formatting" title="Clear formatting" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}><ArrowUturnRightIcon className="ico" /></button>
        {onSubmit && <button type="button" aria-label="Submit" title="Submit" onClick={() => onSubmit?.()}><PaperAirplaneIcon className="ico" /></button>}
      </div>

      <EditorContent editor={editor} />


      {(linkOpen || videoOpen) && (
        <div className="popover" role="dialog" aria-modal="true">
          <div className="card">
            <div className="title">{linkOpen ? 'Insert link' : 'Insert YouTube URL'}</div>
            <input
              className="input"
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://..."
            />
            <div className="actions">
              <button type="button" onClick={() => { setLinkOpen(false); setVideoOpen(false); }}>Cancel</button>
              <button type="button" onClick={() => (linkOpen ? confirmLink() : confirmYouTube())}>Insert</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .popover { position: absolute; inset: 0; background: rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; }
        .popover .card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; width: 320px; box-shadow: 0 10px 20px rgba(0,0,0,0.08); }
        .popover .title { font-weight: 600; margin-bottom: 8px; }
        .popover .input { width: 100%; border: 1px solid #d1d5db; border-radius: 6px; padding: 8px; margin-bottom: 10px; }
        .popover .actions { display: flex; gap: 8px; justify-content: flex-end; }
        .popover button { font-size: 12px; padding: 6px 10px; border: 1px solid #e5e7eb; background: #fff; border-radius: 6px; }
      `}</style>
    </div>
  );
}
