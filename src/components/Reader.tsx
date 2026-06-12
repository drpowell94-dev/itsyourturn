// The table reader's voice: a single serif aside beneath the board.
export function Reader({ text }: { text: string }) {
  return (
    <div className="mt-4 flex items-baseline gap-2.5 px-1">
      <span aria-hidden className="text-accent text-sm leading-none select-none">✳</span>
      <p className="font-display italic text-[15px] sm:text-base text-ink/75 leading-snug">
        {text}
      </p>
    </div>
  );
}
