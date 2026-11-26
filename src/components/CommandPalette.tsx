import { useEffect, useState } from 'react';
import { Search, Command } from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  section: string;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: CommandItem[];
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  if (!open) return null;

  const filtered = commands.filter(
    (c) =>
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.section.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cmd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-input-row">
          <Search size={16} className="muted-icon" />
          <input
            autoFocus
            className="cmd-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search workspace..."
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && filtered[0]) {
                filtered[0].action();
                onClose();
              }
            }}
          />
          <span className="kbd">ESC</span>
        </div>

        <div className="cmd-list">
          {filtered.length === 0 ? (
            <div className="cmd-empty">No matching commands.</div>
          ) : (
            filtered.map((cmd) => (
              <button
                key={cmd.id}
                type="button"
                className="cmd-item"
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
              >
                <div>
                  <span className="cmd-section">{cmd.section}</span>
                  <span className="cmd-label">{cmd.label}</span>
                </div>
                {cmd.shortcut && <span className="kbd">{cmd.shortcut}</span>}
              </button>
            ))
          )}
        </div>

        <div className="cmd-footer">
          <Command size={12} /> Kavcy Quick Command Palette
        </div>
      </div>
    </div>
  );
}
