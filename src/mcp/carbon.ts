export type CarbonPhase = 'completed' | 'planned';

export interface CarbonEstimate {
  operation: string;
  phase: CarbonPhase;
  model: 'runtime_power_x_grid_intensity';
  estimatedGramsCO2: number;
  estimatedEnergyWh: number;
  durationMs: number;
  estimatedAveragePowerW: number;
  gridIntensityGramsCO2PerKWh: number;
  gridIntensitySource: string;
  boundary: string;
  disclaimer: string;
}

interface Factor {
  value: number;
  source: string;
}

const DEFAULT_POWER_W = 50;
const DEFAULT_GRID_INTENSITY = 445;
const BOUNDARY = 'MCP server process only; excludes client devices, external REST/PostgreSQL providers, network equipment, datacenter overhead/PUE, and embodied hardware emissions.';
const DISCLAIMER = 'Modeled estimate, not a meter reading or provider invoice. Actual energy and emissions may differ.';

function factorFromEnv(name: string, fallback: number, max: number, fallbackSource: string): Factor {
  const raw = process.env[name]?.trim();
  if (!raw) return { value: fallback, source: fallbackSource };
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > max) {
    return { value: fallback, source: `invalid ${name}; fallback used` };
  }
  return { value, source: 'operator-configured environment value' };
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function estimateCarbon(durationMs: number, phase: CarbonPhase, operation: string): CarbonEstimate {
  const elapsedMs = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  const power = factorFromEnv('RECONCILE_CARBON_ESTIMATED_POWER_W', DEFAULT_POWER_W, 10_000, 'illustrative 50 W model default; not measured');
  const grid = factorFromEnv(
    'RECONCILE_CARBON_GRID_INTENSITY_G_CO2_KWH',
    DEFAULT_GRID_INTENSITY,
    5_000,
    'IEA Electricity 2025: 2024 global electricity-generation intensity (445 g CO2/kWh); fallback, not location-specific',
  );
  const energyWh = (power.value * elapsedMs) / 3_600_000;
  const gramsCO2 = (energyWh / 1_000) * grid.value;

  return {
    operation,
    phase,
    model: 'runtime_power_x_grid_intensity',
    estimatedGramsCO2: round(gramsCO2, 8),
    estimatedEnergyWh: round(energyWh, 8),
    durationMs: round(elapsedMs, 2),
    estimatedAveragePowerW: power.value,
    gridIntensityGramsCO2PerKWh: grid.value,
    gridIntensitySource: grid.source,
    boundary: BOUNDARY,
    disclaimer: DISCLAIMER,
  };
}

export function carbonMarkdown(estimate: CarbonEstimate): string {
  const phase = estimate.phase === 'completed' ? 'Completed call' : 'Planned call';
  const value = estimate.estimatedGramsCO2 < 0.001
    ? `${(estimate.estimatedGramsCO2 * 1_000).toFixed(3)} mg CO2`
    : `${estimate.estimatedGramsCO2.toFixed(4)} g CO2`;
  return [
    '## Estimated carbon footprint',
    `- ${phase} (${estimate.operation}): **${value}** (modeled; not metered).`,
    `- Energy proxy: ${estimate.estimatedEnergyWh.toFixed(6)} Wh over ${estimate.durationMs.toFixed(0)} ms wall time; assumed average power ${estimate.estimatedAveragePowerW} W.`,
    `- Grid factor: ${estimate.gridIntensityGramsCO2PerKWh} g CO2/kWh (${estimate.gridIntensitySource}).`,
    `- Boundary: ${estimate.boundary}`,
    `- ${estimate.disclaimer}`,
  ].join('\n');
}
