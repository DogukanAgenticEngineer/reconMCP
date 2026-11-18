import { afterEach, describe, expect, it } from 'vitest';
import { estimateCarbon } from '../src/mcp/carbon.js';

const originalPower = process.env.RECONCILE_CARBON_ESTIMATED_POWER_W;
const originalGrid = process.env.RECONCILE_CARBON_GRID_INTENSITY_G_CO2_KWH;

afterEach(() => {
  if (originalPower === undefined) delete process.env.RECONCILE_CARBON_ESTIMATED_POWER_W;
  else process.env.RECONCILE_CARBON_ESTIMATED_POWER_W = originalPower;
  if (originalGrid === undefined) delete process.env.RECONCILE_CARBON_GRID_INTENSITY_G_CO2_KWH;
  else process.env.RECONCILE_CARBON_GRID_INTENSITY_G_CO2_KWH = originalGrid;
});

describe('MCP carbon estimate model', () => {
  it('computes energy and CO2 from elapsed time, assumed power and grid intensity', () => {
    process.env.RECONCILE_CARBON_ESTIMATED_POWER_W = '100';
    process.env.RECONCILE_CARBON_GRID_INTENSITY_G_CO2_KWH = '500';
    const result = estimateCarbon(3_600, 'planned', 'generate_report');
    expect(result.estimatedEnergyWh).toBe(0.1);
    expect(result.estimatedGramsCO2).toBe(0.05);
    expect(result.phase).toBe('planned');
    expect(result.operation).toBe('generate_report');
    expect(result.gridIntensitySource).toContain('operator-configured');
  });

  it('clamps invalid negative elapsed time to zero', () => {
    const result = estimateCarbon(-1, 'completed', 'compare_datasets');
    expect(result.durationMs).toBe(0);
    expect(result.estimatedGramsCO2).toBe(0);
  });
});
