import {
  RawWay,
  RoadEdge,
  TurnRestriction,
  ViaWayCompilationStatus,
} from './types';

export interface ViaWayResolutionResult {
  status: ViaWayCompilationStatus;
  orderedDirectedEdgeIds?: string[];
  error?: string | null;
}

export interface ViaWayResolverLimits {
  /** Maximum number of DFS edge step explorations allowed per restriction resolution. Default: 500 */
  maxEdgeExplorations?: number;
  /** Maximum number of complete candidate sequences allowed before aborting due to explosion. Default: 20 */
  maxCandidateSequences?: number;
}

export const DEFAULT_VIA_WAY_RESOLVER_LIMITS: Required<ViaWayResolverLimits> = {
  maxEdgeExplorations: 500,
  maxCandidateSequences: 20,
};

/**
 * Finds all simple directed paths of edges belonging to a single OSM way
 * that start at startNodeId and terminate at any of targetNodeIds.
 */
function findPathsOnWay(
  wayEdges: RoadEdge[],
  startNodeId: string,
  targetNodeIds: Set<string>,
  onExplore: () => boolean
): RoadEdge[][] {
  const paths: RoadEdge[][] = [];
  const outgoingMap = new Map<string, RoadEdge[]>();

  for (const e of wayEdges) {
    let list = outgoingMap.get(e.fromNodeId);
    if (!list) {
      list = [];
      outgoingMap.set(e.fromNodeId, list);
    }
    list.push(e);
  }

  function dfs(
    currentNodeId: string,
    currentPath: RoadEdge[],
    visitedEdges: Set<string>
  ) {
    if (currentPath.length > 0 && targetNodeIds.has(currentNodeId)) {
      paths.push([...currentPath]);
      return;
    }

    const nextEdges = outgoingMap.get(currentNodeId) ?? [];
    for (const e of nextEdges) {
      if (!visitedEdges.has(e.id)) {
        const canContinue = onExplore();
        if (!canContinue) {
          return;
        }
        visitedEdges.add(e.id);
        currentPath.push(e);
        dfs(e.toNodeId, currentPath, visitedEdges);
        currentPath.pop();
        visitedEdges.delete(e.id);
      }
    }
  }

  dfs(startNodeId, [], new Set<string>());
  return paths;
}

/**
 * Resolves topology and compiles the ordered directed edge sequence
 * for an OSM via-way turn restriction.
 *
 * Sequence format: [fromApproachEdge, viaEdge1, ..., viaEdgeN, toDepartureEdge]
 *
 * Requirements:
 * - Cardinality: exactly 1 from-way, >= 1 via-ways in member order, exactly 1 to-way.
 * - Topological continuity: previous.toNodeId === next.fromNodeId for all consecutive edges.
 * - Direction resolution: respects actual directed edges in graph, not ID naming suffixes.
 * - Ambiguity handling: if multiple candidate sequences exist, marks UNRESOLVED with diagnostic.
 * - Bounded search: aborts fail-closed if exploration steps or candidate count exceeds limits.
 * - Fail-closed: does NOT alter restriction supportStatus; caller retains fail-closed safety.
 */
export function resolveViaWayEdgeSequence(
  restriction: TurnRestriction,
  rawWaysMap: Map<number, RawWay>,
  roadEdges: RoadEdge[],
  limits?: ViaWayResolverLimits
): ViaWayResolutionResult {
  const effectiveLimits = {
    ...DEFAULT_VIA_WAY_RESOLVER_LIMITS,
    ...limits,
  };

  // 1. Not applicable if no via-ways
  if (restriction.viaOsmWayIds.length === 0) {
    return {
      status: 'NOT_APPLICABLE',
      orderedDirectedEdgeIds: [],
      error: null,
    };
  }

  // 2. Cardinality validation
  if (restriction.fromOsmWayIds.length !== 1) {
    return {
      status: 'UNRESOLVED',
      orderedDirectedEdgeIds: [],
      error: `Via-way compilation requires exactly 1 from-way (found ${restriction.fromOsmWayIds.length})`,
    };
  }

  if (restriction.toOsmWayIds.length !== 1) {
    return {
      status: 'UNRESOLVED',
      orderedDirectedEdgeIds: [],
      error: `Via-way compilation requires exactly 1 to-way (found ${restriction.toOsmWayIds.length})`,
    };
  }

  // 3. Conditional restrictions are deferred (not supported in Task 2A/2B)
  if (restriction.conditionalExpression) {
    return {
      status: 'UNRESOLVED',
      orderedDirectedEdgeIds: [],
      error: `Conditional via-way restriction unresolved: "${restriction.conditionalExpression}"; conditional temporal solver not supported in Task 2A`,
    };
  }

  const fromWayId = restriction.fromOsmWayIds[0]!;
  const toWayId = restriction.toOsmWayIds[0]!;
  const viaWayIds = restriction.viaOsmWayIds;

  // 4. Raw OSM Way presence checks
  const fromRawWay = rawWaysMap.get(fromWayId);
  if (!fromRawWay) {
    return {
      status: 'UNRESOLVED',
      orderedDirectedEdgeIds: [],
      error: `Missing raw OSM way data for from-way ${fromWayId}`,
    };
  }

  const viaRawWays: RawWay[] = [];
  for (const viaId of viaWayIds) {
    const viaRaw = rawWaysMap.get(viaId);
    if (!viaRaw) {
      return {
        status: 'UNRESOLVED',
        orderedDirectedEdgeIds: [],
        error: `Missing raw OSM way data for via-way ${viaId}`,
      };
    }
    viaRawWays.push(viaRaw);
  }

  const toRawWay = rawWaysMap.get(toWayId);
  if (!toRawWay) {
    return {
      status: 'UNRESOLVED',
      orderedDirectedEdgeIds: [],
      error: `Missing raw OSM way data for to-way ${toWayId}`,
    };
  }
  const targetToRawWay: RawWay = toRawWay;

  // 5. Member order and topological physical connectivity check between consecutive ways
  const allRawWays: RawWay[] = [fromRawWay, ...viaRawWays, toRawWay];
  for (let i = 0; i < allRawWays.length - 1; i++) {
    const wayA = allRawWays[i]!;
    const wayB = allRawWays[i + 1]!;
    const sharedNodes = wayA.nodeRefs.filter((n) => wayB.nodeRefs.includes(n));
    if (sharedNodes.length === 0) {
      if (i === 0) {
        return {
          status: 'UNRESOLVED',
          orderedDirectedEdgeIds: [],
          error: `Discontinuous topology: from-way ${wayA.id} and via-way ${wayB.id} do not share any common junction node`,
        };
      } else if (i === allRawWays.length - 2) {
        return {
          status: 'UNRESOLVED',
          orderedDirectedEdgeIds: [],
          error: `Discontinuous topology: via-way ${wayA.id} and to-way ${wayB.id} do not share any common junction node`,
        };
      } else {
        return {
          status: 'UNRESOLVED',
          orderedDirectedEdgeIds: [],
          error: `Discontinuous topology: consecutive via-ways ${wayA.id} and ${wayB.id} do not share any common junction node`,
        };
      }
    }
  }

  // 6. Index graph edges by osmWayId and verify non-empty presence in graph
  const edgesByWay = new Map<number, RoadEdge[]>();
  for (const edge of roadEdges) {
    let list = edgesByWay.get(edge.osmWayId);
    if (!list) {
      list = [];
      edgesByWay.set(edge.osmWayId, list);
    }
    list.push(edge);
  }

  const fromEdges = edgesByWay.get(fromWayId) ?? [];
  if (fromEdges.length === 0) {
    return {
      status: 'UNRESOLVED',
      orderedDirectedEdgeIds: [],
      error: `Required edges for from-way ${fromWayId} missing from graph (filtered out by profile or bounding box)`,
    };
  }

  for (const viaId of viaWayIds) {
    const vEdges = edgesByWay.get(viaId) ?? [];
    if (vEdges.length === 0) {
      return {
        status: 'UNRESOLVED',
        orderedDirectedEdgeIds: [],
        error: `Required edges for via-way ${viaId} missing from graph (filtered out by profile or bounding box)`,
      };
    }
  }

  const toEdges = edgesByWay.get(toWayId) ?? [];
  if (toEdges.length === 0) {
    return {
      status: 'UNRESOLVED',
      orderedDirectedEdgeIds: [],
      error: `Required edges for to-way ${toWayId} missing from graph (filtered out by profile or bounding box)`,
    };
  }

  // 7. Find from-approach edge candidates entering the first via-way junction
  const firstVia = viaRawWays[0]!;
  const firstViaSharedNodeKeys = new Set(
    fromRawWay.nodeRefs
      .filter((n) => firstVia.nodeRefs.includes(n))
      .map((n) => `node_osm_${n}`)
  );

  const fromApproachCandidates = fromEdges.filter((e) =>
    firstViaSharedNodeKeys.has(e.toNodeId)
  );

  if (fromApproachCandidates.length === 0) {
    return {
      status: 'UNRESOLVED',
      orderedDirectedEdgeIds: [],
      error: `No directed incoming edge on from-way ${fromWayId} leads into first via-way ${viaWayIds[0]} at shared junction`,
    };
  }

  // 8. Bounded search state tracking
  let totalExplorations = 0;
  let limitExceededReason: string | null = null;

  const onExplore = (): boolean => {
    totalExplorations++;
    if (totalExplorations > effectiveLimits.maxEdgeExplorations) {
      limitExceededReason = `Search limit exceeded: reached maximum edge exploration limit of ${effectiveLimits.maxEdgeExplorations} steps during via-way traversal`;
      return false;
    }
    return true;
  };

  // 9. Traverse via-ways in strict member order to reach departure edge
  const allCompleteChains: RoadEdge[][] = [];

  function searchVias(
    viaIndex: number,
    currentNodeId: string,
    currentChain: RoadEdge[]
  ) {
    if (limitExceededReason) {
      return;
    }

    if (viaIndex === viaWayIds.length) {
      // Reached end of all via-ways. currentNodeId is the exit junction with to-way.
      const departureCandidates = toEdges.filter((e) => e.fromNodeId === currentNodeId);
      for (const dep of departureCandidates) {
        allCompleteChains.push([...currentChain, dep]);
        if (allCompleteChains.length > effectiveLimits.maxCandidateSequences) {
          limitExceededReason = `Search limit exceeded: candidate sequence count exceeded maximum limit of ${effectiveLimits.maxCandidateSequences}`;
          return;
        }
      }
      return;
    }

    const currentViaId = viaWayIds[viaIndex];
    const currentViaRaw = viaRawWays[viaIndex];
    if (currentViaId === undefined || !currentViaRaw) {
      return;
    }

    const nextRawWay: RawWay =
      viaIndex < viaWayIds.length - 1
        ? (viaRawWays[viaIndex + 1] ?? targetToRawWay)
        : targetToRawWay;

    const exitNodeKeys = new Set(
      currentViaRaw.nodeRefs
        .filter((n) => nextRawWay.nodeRefs.includes(n))
        .map((n) => `node_osm_${n}`)
    );

    const currentViaEdges = edgesByWay.get(currentViaId) ?? [];
    const viaPaths = findPathsOnWay(currentViaEdges, currentNodeId, exitNodeKeys, onExplore);

    for (const vPath of viaPaths) {
      if (limitExceededReason) return;
      const lastEdge = vPath[vPath.length - 1];
      if (!lastEdge) continue;
      const exitNodeId = lastEdge.toNodeId;
      searchVias(viaIndex + 1, exitNodeId, [...currentChain, ...vPath]);
    }
  }

  for (const fromEdge of fromApproachCandidates) {
    if (limitExceededReason) break;
    searchVias(0, fromEdge.toNodeId, [fromEdge]);
  }

  // 10. Check limit exceeded
  if (limitExceededReason) {
    return {
      status: 'UNRESOLVED',
      orderedDirectedEdgeIds: [],
      error: limitExceededReason,
    };
  }

  // 11. Evaluate candidate sequences
  if (allCompleteChains.length === 0) {
    return {
      status: 'UNRESOLVED',
      orderedDirectedEdgeIds: [],
      error: `No continuous directed edge sequence found traversing from-way ${fromWayId} through via-way(s) to to-way ${toWayId} (possible oneway direction conflict or disconnected edges)`,
    };
  }

  if (allCompleteChains.length > 1) {
    return {
      status: 'UNRESOLVED',
      orderedDirectedEdgeIds: [],
      error: `Ambiguous topology: found ${allCompleteChains.length} candidate directed edge sequences`,
    };
  }

  const seq = allCompleteChains[0]!;

  // 12. Strict continuity verification across all consecutive edge pairs
  for (let i = 0; i < seq.length - 1; i++) {
    const eCurrent = seq[i]!;
    const eNext = seq[i + 1]!;
    if (eCurrent.toNodeId !== eNext.fromNodeId) {
      return {
        status: 'UNRESOLVED',
        orderedDirectedEdgeIds: [],
        error: `Topological discontinuity between consecutive edges ${eCurrent.id} and ${eNext.id}`,
      };
    }
  }

  return {
    status: 'COMPILED',
    orderedDirectedEdgeIds: seq.map((e) => e.id),
    error: null,
  };
}
