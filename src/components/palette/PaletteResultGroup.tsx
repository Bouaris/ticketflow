/**
 * PaletteResultGroup - Category header for grouped palette results
 *
 * Displays an uppercase label above each group of results in the command palette.
 */

interface PaletteResultGroupProps {
  label: string; // Category display name (translated)
}

export function PaletteResultGroup({ label }: PaletteResultGroupProps) {
  return (
    <div className="px-3 py-1.5 text-xs font-semibold text-on-surface-secondary uppercase tracking-wider">
      {label}
    </div>
  );
}
