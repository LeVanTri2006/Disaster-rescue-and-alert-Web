import { WayFlowPolicy } from './types';

export interface OnewayResolutionResult {
  policy: WayFlowPolicy;
  createForwardEdge: boolean;
  createReverseEdge: boolean;
  reason?: string;
}

export function resolveOnewayPolicy(
  tags: Record<string, string>
): OnewayResolutionResult {
  const oneway = tags['oneway']?.trim().toLowerCase();
  const onewayConditional = tags['oneway:conditional']?.trim();
  const junction = tags['junction']?.trim().toLowerCase();
  const highway = tags['highway']?.trim().toLowerCase();

  // 1. Explicit oneway:conditional
  if (onewayConditional && !oneway) {
    return {
      policy: 'CONDITIONAL',
      createForwardEdge: false,
      createReverseEdge: false,
      reason: `Conditional oneway requires dynamic schedule regulation: ${onewayConditional}`,
    };
  }

  // 2. Explicit oneway tag takes precedence
  if (oneway !== undefined) {
    if (oneway === 'yes' || oneway === '1' || oneway === 'true') {
      return { policy: 'FORWARD', createForwardEdge: true, createReverseEdge: false };
    }
    if (oneway === '-1' || oneway === 'reverse') {
      return { policy: 'REVERSE', createForwardEdge: false, createReverseEdge: true };
    }
    if (oneway === 'no' || oneway === 'false' || oneway === '0') {
      return { policy: 'BIDIRECTIONAL', createForwardEdge: true, createReverseEdge: true };
    }
    if (oneway === 'reversible') {
      return {
        policy: 'REVERSIBLE',
        createForwardEdge: false,
        createReverseEdge: false,
        reason: 'Reversible lane cannot be safely routed statically without active lane signal telemetry',
      };
    }
    if (oneway === 'alternating') {
      return {
        policy: 'ALTERNATING',
        createForwardEdge: false,
        createReverseEdge: false,
        reason: 'Alternating one-lane bottleneck cannot be safely routed statically without traffic signal state',
      };
    }
    // Unrecognized oneway value -> UNKNOWN, never default to BIDIRECTIONAL!
    return {
      policy: 'UNKNOWN',
      createForwardEdge: false,
      createReverseEdge: false,
      reason: `Unrecognized oneway tag value: '${oneway}'`,
    };
  }

  // 3. Default rules for specific highway/junction structures
  if (junction === 'roundabout') {
    return { policy: 'FORWARD', createForwardEdge: true, createReverseEdge: false };
  }

  if (junction === 'circular') {
    // DO NOT assume circular junction is oneway without explicit verification
    return {
      policy: 'UNKNOWN',
      createForwardEdge: false,
      createReverseEdge: false,
      reason: 'junction=circular lacks explicit oneway tag; cannot assume one-way roundabout',
    };
  }

  if (highway === 'motorway' || highway === 'motorway_link') {
    return { policy: 'FORWARD', createForwardEdge: true, createReverseEdge: false };
  }

  // Standard default for ordinary roads without oneway
  return { policy: 'BIDIRECTIONAL', createForwardEdge: true, createReverseEdge: true };
}
