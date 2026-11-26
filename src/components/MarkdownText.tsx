import React from 'react';

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export function MarkdownText({ content }: { content: string }) {
  const blocks = content.split(/```([\s\S]*?)```/g);

  return (
    <div className="md-body">
      {blocks.map((block, bIdx) => {
        if (bIdx % 2 === 1) {
          const lines = block.split('\n');
          const code = lines.length > 1 && /^[a-z0-9_-]+$/i.test(lines[0].trim())
            ? lines.slice(1).join('\n')
            : block;
          return (
            <pre key={bIdx} className="md-code">
              <code>{code.trim()}</code>
            </pre>
          );
        }

        const lines = block.split('\n');
        return (
          <div key={bIdx}>
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lIdx} style={{ height: 6 }} />;
              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={lIdx} className="md-h4">
                    {renderInline(trimmed.slice(4))}
                  </h4>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h3 key={lIdx} className="md-h3">
                    {renderInline(trimmed.slice(3))}
                  </h3>
                );
              }
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lIdx} className="md-li">
                    <span className="md-bullet">•</span>
                    <span>{renderInline(trimmed.slice(2))}</span>
                  </div>
                );
              }
              return (
                <p key={lIdx} className="md-p">
                  {renderInline(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
