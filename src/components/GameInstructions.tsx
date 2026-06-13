import { ChevronDown, X } from "lucide-react";

type Props = {
  instructions: string;
  onClose: () => void;
};

export function GameInstructions({ instructions, onClose }: Props) {
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t-2 border-line shadow-lg fade-in">
        <div className="max-w-2xl mx-auto px-5 sm:px-6 py-5 sm:py-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <span className="microcap font-semibold">How to play</span>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-ink/50 hover:text-ink/75 transition-colors"
              aria-label="Close instructions"
            >
              <X size={18} />
            </button>
          </div>
          <p className="text-[13px] leading-relaxed text-ink/75">{instructions}</p>
        </div>
      </div>
    </>
  );
}

export function GameInstructionsToggle({
  setIsOpen
}: {
  setIsOpen: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => setIsOpen(true)}
      className="flex items-center gap-1.5 px-2 py-1 -my-1 text-ink/50 hover:text-ink/75 transition-colors"
      aria-label="Show instructions"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide">How to play</span>
      <ChevronDown size={14} />
    </button>
  );
}
