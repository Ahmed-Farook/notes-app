import React, { useState } from 'react';
import { NodeViewWrapper, NodeViewContent, NodeViewProps } from '@tiptap/react';
import { Check, Copy, ChevronDown } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

export const SUPPORTED_LANGUAGES = [
  { label: 'Auto / Plain Text', value: '' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'Python', value: 'python' },
  { label: 'HTML / XML', value: 'html' },
  { label: 'CSS', value: 'css' },
  { label: 'Bash / Shell', value: 'bash' },
  { label: 'JSON', value: 'json' },
  { label: 'C++', value: 'cpp' },
  { label: 'C', value: 'c' },
  { label: 'C#', value: 'csharp' },
  { label: 'Java', value: 'java' },
  { label: 'Rust', value: 'rust' },
  { label: 'Go', value: 'go' },
  { label: 'SQL', value: 'sql' },
  { label: 'Markdown', value: 'markdown' },
  { label: 'YAML', value: 'yaml' },
  { label: 'PHP', value: 'php' },
  { label: 'Ruby', value: 'ruby' },
  { label: 'GraphQL', value: 'graphql' },
  { label: 'Diff', value: 'diff' },
];

export const CodeBlockView: React.FC<NodeViewProps> = ({ node, updateAttributes, extension }) => {
  const [copied, setCopied] = useState(false);
  const currentLang = node.attrs.language || '';

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    triggerHaptic();
    try {
      const codeText = node.textContent;
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    triggerHaptic();
    updateAttributes({ language: e.target.value });
  };

  return (
    <NodeViewWrapper
      className="code-block-wrapper relative my-3 rounded-xl overflow-hidden border border-[#DFD3C0] dark:border-[#223344] bg-[#F7F2EA] dark:bg-[#121922] shadow-xs select-none"
      spellCheck={false}
    >
      {/* Code Block Header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 bg-[#EFE7D8]/80 dark:bg-[#18232E]/90 border-b border-[#DFD3C0]/60 dark:border-[#223344]/80 text-xs text-[#5A6E82] dark:text-[#8AA0B4] select-none"
        contentEditable={false}
      >
        {/* Language Selector */}
        <div className="relative inline-flex items-center">
          <select
            value={currentLang}
            onChange={handleLanguageChange}
            className="appearance-none bg-transparent pl-1.5 pr-5 py-0.5 rounded text-[11px] font-mono font-medium text-[#213A50] dark:text-[#CBD8E3] hover:text-black dark:hover:text-white cursor-pointer outline-none focus:ring-1 focus:ring-apple-yellow dark:focus:ring-[#7EAAD0]"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option
                key={lang.value}
                value={lang.value}
                className="bg-[#FAF6EF] dark:bg-[#1A2532] text-[#213A50] dark:text-[#E8EEF3]"
              >
                {lang.label}
              </option>
            ))}
          </select>
          <ChevronDown size={11} className="pointer-events-none absolute right-0.5 text-neutral-400 dark:text-neutral-500" />
        </div>

        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium text-[#5A6E82] dark:text-[#8AA0B4] hover:text-[#213A50] dark:hover:text-[#E8EEF3] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check size={12} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Text Content */}
      <pre
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        className="py-3.5 pl-5 pr-4 m-0 font-mono text-[13px] leading-relaxed overflow-x-auto text-[#1C2B36] dark:text-[#E8EEF3] select-text"
      >
        <NodeViewContent
          as="code"
          spellCheck={false}
          className={currentLang ? `language-${currentLang}` : undefined}
        />
      </pre>
    </NodeViewWrapper>
  );
};

