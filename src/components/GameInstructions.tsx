import { ChevronDown } from "lucide-react";

type Props = {
  instructions: string;
};

export function GameInstructions({ instructions }: Props) {
  return (
    <div className="px-3 sm:px-4 py-3 border-b border-line bg-surface/50">
      <p className="text-[13px] leading-relaxed text-ink/75">{instructions}</p>
    </div>
  );
}

export function GameInstructionsToggle({
  isOpen,
  setIsOpen
}: {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className="flex items-center gap-1.5 px-2 py-1 -my-1 text-ink/50 hover:text-ink/75 transition-colors"
      aria-label={isOpen ? "Hide instructions" : "Show instructions"}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide">How to play</span>
      <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
    </button>
  );
}
