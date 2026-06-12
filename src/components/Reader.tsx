// The table reader's voice: a friendly note beneath the board.
export function Reader({ text }: { text: string }) {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-2xl border-2 border-line bg-surface px-4 py-3">
      <span aria-hidden className="text-accent text-base leading-snug select-none">✳</span>
      <p className="text-sm sm:text-[15px] font-semibold text-ink/75 leading-snug">{text}</p>
    </div>
  );
}
