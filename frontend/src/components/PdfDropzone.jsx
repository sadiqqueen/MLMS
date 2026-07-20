import { useRef, useState } from 'react';
import { IconFileText } from './icons';

// PDF-only dropzone for the "book of changes" required on every edit-with-approval
// (RULINGS §E24, proto_modals §9b). Empty = dashed prompt; attached = green strip
// with filename + size + "Ready" pill. The parent enables submit only once a file
// is attached.
//
//   <PdfDropzone file={file} onFile={setFile} onRemove={() => setFile(null)} />
//
// `file` is a File (or { name, size }). onFile receives a validated PDF File.
function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function PdfDropzone({ file, onFile, onRemove, label = 'Upload book of changes', required = true }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  function accept(f) {
    if (!f) return;
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
    if (isPdf && onFile) onFile(f);
  }

  function onDrop(e) {
    e.preventDefault();
    setDrag(false);
    accept(e.dataTransfer?.files?.[0]);
  }

  if (file) {
    return (
      <div className="mt-dropzone-strip">
        <div className="mt-dropzone-file-ic"><IconFileText size={18} /></div>
        <div style={{ minWidth: 0 }}>
          <div className="mt-dropzone-file-name">{file.name || 'book of changes.pdf'}</div>
          <div className="mt-dropzone-file-meta">
            {fmtSize(file.size)}{file.size ? ' · ' : ''}attached — click remove
          </div>
        </div>
        <span className="mt-dropzone-ready">Ready</span>
        {onRemove && (
          <button type="button" className="mt-btn--ghost" style={{ padding: '4px 10px' }} onClick={onRemove} aria-label="Remove file">
            Remove
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`mt-dropzone${drag ? ' is-drag' : ''}`}
      role="button" tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef} type="file" accept="application/pdf,.pdf" style={{ display: 'none' }}
        onChange={(e) => { accept(e.target.files?.[0]); e.target.value = ''; }}
      />
      <div className="mt-dropzone-ic"><IconFileText size={22} /></div>
      <div className="mt-dropzone-title">
        {label}{required && <span className="mt-label-req">*</span>}
      </div>
      <div className="mt-dropzone-sub">PDF only · drag &amp; drop or click to browse</div>
    </div>
  );
}
