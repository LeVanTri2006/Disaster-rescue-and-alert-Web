import { OsmImporter } from '../src/osm-importer';
import {
  EdgeCompatibilityStatus,
  OsmRelationMember,
  RawWay,
  RestrictionSupportStatus,
  RoadEdge,
  TurnRestriction,
  TurnRestrictionType,
  WayFlowPolicy,
} from '../src/types';
import { resolveViaWayEdgeSequence } from '../src/via-way-resolver';

function createMockEdge(params: {
  id: string;
  osmWayId: number;
  fromNodeId: string;
  toNodeId: string;
  isWayForward?: boolean;
  lengthMeters?: number;
  wayFlowPolicy?: WayFlowPolicy;
  compatibilityStatus?: EdgeCompatibilityStatus;
  isEligibleForStrictRouting?: boolean;
}): RoadEdge {
  return {
    id: params.id,
    osmWayId: params.osmWayId,
    fromNodeId: params.fromNodeId,
    toNodeId: params.toNodeId,
    isWayForward: params.isWayForward ?? true,
    lengthMeters: params.lengthMeters ?? 100,
    geometry: [
      { lat: 16.05, lon: 108.2 },
      { lat: 16.06, lon: 108.21 },
    ],
    wayFlowPolicy: params.wayFlowPolicy ?? 'FORWARD',
    metadata: {
      name: `Way ${params.osmWayId}`,
      highwayType: 'primary',
      surface: 'asphalt',
      smoothness: 'good',
      widthMeters: 7.0,
      effectiveWidthMeters: 7.0,
      maxWidthMeters: null,
      maxPhysicalWidthMeters: null,
      maxHeightMeters: null,
      maxPhysicalHeightMeters: null,
      maxWeightTons: null,
      maxWeightRatingTons: null,
      maxAxleLoadTons: null,
      maxSpeedKmH: 50,
      bridge: false,
      tunnel: false,
      layer: 0,
      rawTags: {},
    },
    compatibilityStatus: params.compatibilityStatus ?? 'VERIFIED_COMPATIBLE',
    isEligibleForStrictRouting: params.isEligibleForStrictRouting ?? true,
  };
}

function createMockWay(
  id: number,
  nodeRefs: number[],
  tags: Record<string, string> = {}
): RawWay {
  return {
    id,
    nodeRefs,
    tags: { highway: 'primary', ...tags },
  };
}

function createMockRestriction(params: {
  id: string;
  type?: TurnRestrictionType;
  fromOsmWayIds: number[];
  viaOsmWayIds: number[];
  toOsmWayIds: number[];
  conditionalExpression?: string | null;
  supportStatus?: RestrictionSupportStatus;
}): TurnRestriction {
  const members: OsmRelationMember[] = [
    ...params.fromOsmWayIds.map((ref, idx) => ({
      type: 'way' as const,
      ref,
      role: 'from',
      order: idx,
    })),
    ...params.viaOsmWayIds.map((ref, idx) => ({
      type: 'way' as const,
      ref,
      role: 'via',
      order: params.fromOsmWayIds.length + idx,
    })),
    ...params.toOsmWayIds.map((ref, idx) => ({
      type: 'way' as const,
      ref,
      role: 'to',
      order:
        params.fromOsmWayIds.length + params.viaOsmWayIds.length + idx,
    })),
  ];

  return {
    id: params.id,
    type: params.type ?? 'NO_U_TURN',
    members,
    fromOsmWayIds: params.fromOsmWayIds,
    viaOsmNodeIds: [],
    viaOsmWayIds: params.viaOsmWayIds,
    toOsmWayIds: params.toOsmWayIds,
    restrictionMode: null,
    exceptModes: [],
    conditionalExpression: params.conditionalExpression ?? null,
    supportStatus: params.supportStatus ?? 'FAIL_CLOSED_UNRESOLVED',
    isExemptForProfile: false,
  };
}

describe('Phase 4 Task 2A: Via-Way Topology Resolver & Directed Edge Sequence Compiler', () => {
  // Test 1: Một via-way có hướng forward hợp lệ
  it('1. Compiles a single via-way with valid forward orientation', () => {
    const rawWaysMap = new Map<number, RawWay>([
      [101, createMockWay(101, [1, 2])],
      [201, createMockWay(201, [2, 3])],
      [301, createMockWay(301, [3, 4])],
    ]);

    const roadEdges: RoadEdge[] = [
      createMockEdge({
        id: 'edge_w101_n1_n2_F',
        osmWayId: 101,
        fromNodeId: 'node_osm_1',
        toNodeId: 'node_osm_2',
        isWayForward: true,
      }),
      createMockEdge({
        id: 'edge_w201_n2_n3_F',
        osmWayId: 201,
        fromNodeId: 'node_osm_2',
        toNodeId: 'node_osm_3',
        isWayForward: true,
      }),
      createMockEdge({
        id: 'edge_w301_n3_n4_F',
        osmWayId: 301,
        fromNodeId: 'node_osm_3',
        toNodeId: 'node_osm_4',
        isWayForward: true,
      }),
    ];

    const restriction = createMockRestriction({
      id: 'rel_1',
      fromOsmWayIds: [101],
      viaOsmWayIds: [201],
      toOsmWayIds: [301],
    });

    const result = resolveViaWayEdgeSequence(restriction, rawWaysMap, roadEdges);

    expect(result.status).toBe('COMPILED');
    expect(result.orderedDirectedEdgeIds).toEqual([
      'edge_w101_n1_n2_F',
      'edge_w201_n2_n3_F',
      'edge_w301_n3_n4_F',
    ]);
    expect(result.error).toBeNull();
  });

  // Test 2: Một via-way có hướng reverse hợp lệ
  it('2. Compiles a single via-way with valid reverse orientation', () => {
    const rawWaysMap = new Map<number, RawWay>([
      [101, createMockWay(101, [1, 2])],
      [201, createMockWay(201, [3, 2])], // OSM node sequence is [3, 2]
      [301, createMockWay(301, [3, 4])],
    ]);

    const roadEdges: RoadEdge[] = [
      createMockEdge({
        id: 'edge_w101_n1_n2_F',
        osmWayId: 101,
        fromNodeId: 'node_osm_1',
        toNodeId: 'node_osm_2',
        isWayForward: true,
      }),
      createMockEdge({
        id: 'edge_w201_n2_n3_R',
        osmWayId: 201,
        fromNodeId: 'node_osm_2',
        toNodeId: 'node_osm_3',
        isWayForward: false,
      }),
      createMockEdge({
        id: 'edge_w301_n3_n4_F',
        osmWayId: 301,
        fromNodeId: 'node_osm_3',
        toNodeId: 'node_osm_4',
        isWayForward: true,
      }),
    ];

    const restriction = createMockRestriction({
      id: 'rel_2',
      fromOsmWayIds: [101],
      viaOsmWayIds: [201],
      toOsmWayIds: [301],
    });

    const result = resolveViaWayEdgeSequence(restriction, rawWaysMap, roadEdges);

    expect(result.status).toBe('COMPILED');
    expect(result.orderedDirectedEdgeIds).toEqual([
      'edge_w101_n1_n2_F',
      'edge_w201_n2_n3_R',
      'edge_w301_n3_n4_F',
    ]);
    expect(result.error).toBeNull();
  });

  // Test 3: Hai via-way liên tiếp
  it('3. Compiles two consecutive via-ways in sequence', () => {
    const rawWaysMap = new Map<number, RawWay>([
      [101, createMockWay(101, [1, 2])],
      [201, createMockWay(201, [2, 3])],
      [202, createMockWay(202, [3, 4])],
      [301, createMockWay(301, [4, 5])],
    ]);

    const roadEdges: RoadEdge[] = [
      createMockEdge({
        id: 'edge_w101_n1_n2_F',
        osmWayId: 101,
        fromNodeId: 'node_osm_1',
        toNodeId: 'node_osm_2',
      }),
      createMockEdge({
        id: 'edge_w201_n2_n3_F',
        osmWayId: 201,
        fromNodeId: 'node_osm_2',
        toNodeId: 'node_osm_3',
      }),
      createMockEdge({
        id: 'edge_w202_n3_n4_F',
        osmWayId: 202,
        fromNodeId: 'node_osm_3',
        toNodeId: 'node_osm_4',
      }),
      createMockEdge({
        id: 'edge_w301_n4_n5_F',
        osmWayId: 301,
        fromNodeId: 'node_osm_4',
        toNodeId: 'node_osm_5',
      }),
    ];

    const restriction = createMockRestriction({
      id: 'rel_3',
      fromOsmWayIds: [101],
      viaOsmWayIds: [201, 202],
      toOsmWayIds: [301],
    });

    const result = resolveViaWayEdgeSequence(restriction, rawWaysMap, roadEdges);

    expect(result.status).toBe('COMPILED');
    expect(result.orderedDirectedEdgeIds).toEqual([
      'edge_w101_n1_n2_F',
      'edge_w201_n2_n3_F',
      'edge_w202_n3_n4_F',
      'edge_w301_n4_n5_F',
    ]);
  });

  // Test 4: Nhiều segment trong một via-way
  it('4. Compiles multiple segments within a single via-way', () => {
    const rawWaysMap = new Map<number, RawWay>([
      [101, createMockWay(101, [1, 2])],
      [201, createMockWay(201, [2, 10, 3])], // via-way has intermediate intersection node 10
      [301, createMockWay(301, [3, 4])],
    ]);

    const roadEdges: RoadEdge[] = [
      createMockEdge({
        id: 'edge_w101_n1_n2_F',
        osmWayId: 101,
        fromNodeId: 'node_osm_1',
        toNodeId: 'node_osm_2',
      }),
      createMockEdge({
        id: 'edge_w201_n2_n10_F',
        osmWayId: 201,
        fromNodeId: 'node_osm_2',
        toNodeId: 'node_osm_10',
      }),
      createMockEdge({
        id: 'edge_w201_n10_n3_F',
        osmWayId: 201,
        fromNodeId: 'node_osm_10',
        toNodeId: 'node_osm_3',
      }),
      createMockEdge({
        id: 'edge_w301_n3_n4_F',
        osmWayId: 301,
        fromNodeId: 'node_osm_3',
        toNodeId: 'node_osm_4',
      }),
    ];

    const restriction = createMockRestriction({
      id: 'rel_4',
      fromOsmWayIds: [101],
      viaOsmWayIds: [201],
      toOsmWayIds: [301],
    });

    const result = resolveViaWayEdgeSequence(restriction, rawWaysMap, roadEdges);

    expect(result.status).toBe('COMPILED');
    expect(result.orderedDirectedEdgeIds).toEqual([
      'edge_w101_n1_n2_F',
      'edge_w201_n2_n10_F',
      'edge_w201_n10_n3_F',
      'edge_w301_n3_n4_F',
    ]);
  });

  // Test 5: From-way và via-way không kết nối
  it('5. Marks UNRESOLVED when from-way and via-way share no junction node', () => {
    const rawWaysMap = new Map<number, RawWay>([
      [101, createMockWay(101, [1, 2])],
      [201, createMockWay(201, [8, 9])], // Disconnected from 101!
      [301, createMockWay(301, [9, 10])],
    ]);

    const roadEdges: RoadEdge[] = [
      createMockEdge({
        id: 'edge_w101_n1_n2_F',
        osmWayId: 101,
        fromNodeId: 'node_osm_1',
        toNodeId: 'node_osm_2',
      }),
      createMockEdge({
        id: 'edge_w201_n8_n9_F',
        osmWayId: 201,
        fromNodeId: 'node_osm_8',
        toNodeId: 'node_osm_9',
      }),
      createMockEdge({
        id: 'edge_w301_n9_n10_F',
        osmWayId: 301,
        fromNodeId: 'node_osm_9',
        toNodeId: 'node_osm_10',
      }),
    ];

    const restriction = createMockRestriction({
      id: 'rel_5',
      fromOsmWayIds: [101],
      viaOsmWayIds: [201],
      toOsmWayIds: [301],
    });

    const result = resolveViaWayEdgeSequence(restriction, rawWaysMap, roadEdges);

    expect(result.status).toBe('UNRESOLVED');
    expect(result.orderedDirectedEdgeIds).toEqual([]);
    expect(result.error).toContain('Discontinuous topology');
    expect(result.error).toContain('from-way 101 and via-way 201');
  });

  // Test 6: Hai via-way liên tiếp không kết nối
  it('6. Marks UNRESOLVED when consecutive via-ways share no junction node', () => {
    const rawWaysMap = new Map<number, RawWay>([
      [101, createMockWay(101, [1, 2])],
      [201, createMockWay(201, [2, 3])],
      [202, createMockWay(202, [8, 9])], // Disconnected from 201!
      [301, createMockWay(301, [9, 10])],
    ]);

    const roadEdges: RoadEdge[] = [
      createMockEdge({
        id: 'edge_w101_n1_n2_F',
        osmWayId: 101,
        fromNodeId: 'node_osm_1',
        toNodeId: 'node_osm_2',
      }),
      createMockEdge({
        id: 'edge_w201_n2_n3_F',
        osmWayId: 201,
        fromNodeId: 'node_osm_2',
        toNodeId: 'node_osm_3',
      }),
      createMockEdge({
        id: 'edge_w202_n8_n9_F',
        osmWayId: 202,
        fromNodeId: 'node_osm_8',
        toNodeId: 'node_osm_9',
      }),
      createMockEdge({
        id: 'edge_w301_n9_n10_F',
        osmWayId: 301,
        fromNodeId: 'node_osm_9',
        toNodeId: 'node_osm_10',
      }),
    ];

    const restriction = createMockRestriction({
      id: 'rel_6',
      fromOsmWayIds: [101],
      viaOsmWayIds: [201, 202],
      toOsmWayIds: [301],
    });

    const result = resolveViaWayEdgeSequence(restriction, rawWaysMap, roadEdges);

    expect(result.status).toBe('UNRESOLVED');
    expect(result.error).toContain('Discontinuous topology');
    expect(result.error).toContain('consecutive via-ways 201 and 202');
  });

  // Test 7: Via-way và to-way không kết nối
  it('7. Marks UNRESOLVED when via-way and to-way share no junction node', () => {
    const rawWaysMap = new Map<number, RawWay>([
      [101, createMockWay(101, [1, 2])],
      [201, createMockWay(201, [2, 3])],
      [301, createMockWay(301, [8, 9])], // Disconnected from 201!
    ]);

    const roadEdges: RoadEdge[] = [
      createMockEdge({
        id: 'edge_w101_n1_n2_F',
        osmWayId: 101,
        fromNodeId: 'node_osm_1',
        toNodeId: 'node_osm_2',
      }),
      createMockEdge({
        id: 'edge_w201_n2_n3_F',
        osmWayId: 201,
        fromNodeId: 'node_osm_2',
        toNodeId: 'node_osm_3',
      }),
      createMockEdge({
        id: 'edge_w301_n8_n9_F',
        osmWayId: 301,
        fromNodeId: 'node_osm_8',
        toNodeId: 'node_osm_9',
      }),
    ];

    const restriction = createMockRestriction({
      id: 'rel_7',
      fromOsmWayIds: [101],
      viaOsmWayIds: [201],
      toOsmWayIds: [301],
    });

    const result = resolveViaWayEdgeSequence(restriction, rawWaysMap, roadEdges);

    expect(result.status).toBe('UNRESOLVED');
    expect(result.error).toContain('Discontinuous topology');
    expect(result.error).toContain('via-way 201 and to-way 301');
  });

  // Test 8: Way có nhiều điểm kết nối gây ambiguity
  it('8. Marks UNRESOLVED when multiple connection points create ambiguous candidate sequences', () => {
    // 101 and 201 meet at BOTH node 2 and node 3, and both lead to valid paths
    const rawWaysMap = new Map<number, RawWay>([
      [101, createMockWay(101, [1, 2, 3])],
      [201, createMockWay(201, [2, 10, 3, 4])],
      [301, createMockWay(301, [4, 5])],
    ]);

    const roadEdges: RoadEdge[] = [
      // Approach to node 2
      createMockEdge({
        id: 'edge_w101_n1_n2_F',
        osmWayId: 101,
        fromNodeId: 'node_osm_1',
        toNodeId: 'node_osm_2',
      }),
      // Approach to node 3
      createMockEdge({
        id: 'edge_w101_n2_n3_F',
        osmWayId: 101,
        fromNodeId: 'node_osm_2',
        toNodeId: 'node_osm_3',
      }),
      // Path 1 from node 2: 2 -> 10 -> 3 -> 4
      createMockEdge({
        id: 'edge_w201_n2_n10_F',
        osmWayId: 201,
        fromNodeId: 'node_osm_2',
        toNodeId: 'node_osm_10',
      }),
      createMockEdge({
        id: 'edge_w201_n10_n3_F',
        osmWayId: 201,
        fromNodeId: 'node_osm_10',
        toNodeId: 'node_osm_3',
      }),
      createMockEdge({
        id: 'edge_w201_n3_n4_F',
        osmWayId: 201,
        fromNodeId: 'node_osm_3',
        toNodeId: 'node_osm_4',
      }),
      // Departure from node 4
      createMockEdge({
        id: 'edge_w301_n4_n5_F',
        osmWayId: 301,
        fromNodeId: 'node_osm_4',
        toNodeId: 'node_osm_5',
      }),
    ];

    const restriction = createMockRestriction({
      id: 'rel_8',
      fromOsmWayIds: [101],
      viaOsmWayIds: [201],
      toOsmWayIds: [301],
    });

    const result = resolveViaWayEdgeSequence(restriction, rawWaysMap, roadEdges);

    expect(result.status).toBe('UNRESOLVED');
    expect(result.error).toContain('Ambiguous topology');
  });

  // Test 9: Way hai chiều nhưng relation chỉ hợp lệ theo một hướng
  it('9. Selects the correct directed edge when via-way is bidirectional', () => {
    const rawWaysMap = new Map<number, RawWay>([
      [101, createMockWay(101, [1, 2])],
      [201, createMockWay(201, [2, 3])],
      [301, createMockWay(301, [3, 4])],
    ]);

    const roadEdges: RoadEdge[] = [
      createMockEdge({
        id: 'edge_w101_n1_n2_F',
        osmWayId: 101,
        fromNodeId: 'node_osm_1',
        toNodeId: 'node_osm_2',
      }),
      // Bidirectional via-way has both forward and reverse directed edges
      createMockEdge({
        id: 'edge_w201_n2_n3_F',
        osmWayId: 201,
        fromNodeId: 'node_osm_2',
        toNodeId: 'node_osm_3',
        wayFlowPolicy: 'BIDIRECTIONAL',
      }),
      createMockEdge({
        id: 'edge_w201_n3_n2_R',
        osmWayId: 201,
        fromNodeId: 'node_osm_3',
        toNodeId: 'node_osm_2',
        wayFlowPolicy: 'BIDIRECTIONAL',
        isWayForward: false,
      }),
      createMockEdge({
        id: 'edge_w301_n3_n4_F',
        osmWayId: 301,
        fromNodeId: 'node_osm_3',
        toNodeId: 'node_osm_4',
      }),
    ];

    const restriction = createMockRestriction({
      id: 'rel_9',
      fromOsmWayIds: [101],
      viaOsmWayIds: [201],
      toOsmWayIds: [301],
    });

    const result = resolveViaWayEdgeSequence(restriction, rawWaysMap, roadEdges);

    expect(result.status).toBe('COMPILED');
    expect(result.orderedDirectedEdgeIds).toEqual([
      'edge_w101_n1_n2_F',
      'edge_w201_n2_n3_F',
      'edge_w301_n3_n4_F',
    ]);
  });

  // Test 10: Hướng ngược lại không được chọn nhầm (oneway violation on via-way)
  it('10. Does NOT pick the reverse edge when via-way is oneway in opposite direction', () => {
    const rawWaysMap = new Map<number, RawWay>([
      [101, createMockWay(101, [1, 2])],
      [201, createMockWay(201, [2, 3], { oneway: 'yes' })],
      [301, createMockWay(301, [3, 4])],
    ]);

    const roadEdges: RoadEdge[] = [
      createMockEdge({
        id: 'edge_w101_n1_n2_F',
        osmWayId: 101,
        fromNodeId: 'node_osm_1',
        toNodeId: 'node_osm_2',
      }),
      // Only the reverse edge exists in graph (traffic flows 3 -> 2 only)
      createMockEdge({
        id: 'edge_w201_n3_n2_R',
        osmWayId: 201,
        fromNodeId: 'node_osm_3',
        toNodeId: 'node_osm_2',
        isWayForward: false,
        wayFlowPolicy: 'FORWARD',
      }),
      createMockEdge({
        id: 'edge_w301_n3_n4_F',
        osmWayId: 301,
        fromNodeId: 'node_osm_3',
        toNodeId: 'node_osm_4',
      }),
    ];

    const restriction = createMockRestriction({
      id: 'rel_10',
      fromOsmWayIds: [101],
      viaOsmWayIds: [201],
      toOsmWayIds: [301],
    });

    const result = resolveViaWayEdgeSequence(restriction, rawWaysMap, roadEdges);

    expect(result.status).toBe('UNRESOLVED');
    expect(result.orderedDirectedEdgeIds).toEqual([]);
    expect(result.error).toContain('No continuous directed edge sequence found');
  });

  // Test 11: Thiếu OSM way hoặc node data
  it('11. Marks UNRESOLVED when raw OSM way data is missing', () => {
    const rawWaysMap = new Map<number, RawWay>([
      [101, createMockWay(101, [1, 2])],
      // Way 201 missing from map!
      [301, createMockWay(301, [3, 4])],
    ]);

    const roadEdges: RoadEdge[] = [];

    const restriction = createMockRestriction({
      id: 'rel_11',
      fromOsmWayIds: [101],
      viaOsmWayIds: [201],
      toOsmWayIds: [301],
    });

    const result = resolveViaWayEdgeSequence(restriction, rawWaysMap, roadEdges);

    expect(result.status).toBe('UNRESOLVED');
    expect(result.error).toContain('Missing raw OSM way data for via-way 201');
  });

  // Test 12: Relation thiếu from/via/to
  it('12. Marks UNRESOLVED or NOT_APPLICABLE on invalid member cardinality', () => {
    const rawWaysMap = new Map<number, RawWay>();
    const roadEdges: RoadEdge[] = [];

    // 12a: Missing from
    const noFrom = createMockRestriction({
      id: 'rel_12a',
      fromOsmWayIds: [],
      viaOsmWayIds: [201],
      toOsmWayIds: [301],
    });
    expect(resolveViaWayEdgeSequence(noFrom, rawWaysMap, roadEdges).status).toBe(
      'UNRESOLVED'
    );

    // 12b: Missing via
    const noVia = createMockRestriction({
      id: 'rel_12b',
      fromOsmWayIds: [101],
      viaOsmWayIds: [],
      toOsmWayIds: [301],
    });
    expect(resolveViaWayEdgeSequence(noVia, rawWaysMap, roadEdges).status).toBe(
      'NOT_APPLICABLE'
    );

    // 12c: Missing to
    const noTo = createMockRestriction({
      id: 'rel_12c',
      fromOsmWayIds: [101],
      viaOsmWayIds: [201],
      toOsmWayIds: [],
    });
    expect(resolveViaWayEdgeSequence(noTo, rawWaysMap, roadEdges).status).toBe(
      'UNRESOLVED'
    );
  });

  // Test 13: Conditional via-way restriction vẫn unresolved
  it('13. Marks conditional via-way restriction as UNRESOLVED', () => {
    const rawWaysMap = new Map<number, RawWay>([
      [101, createMockWay(101, [1, 2])],
      [201, createMockWay(201, [2, 3])],
      [301, createMockWay(301, [3, 4])],
    ]);
    const roadEdges: RoadEdge[] = [
      createMockEdge({
        id: 'edge_w101_n1_n2_F',
        osmWayId: 101,
        fromNodeId: 'node_osm_1',
        toNodeId: 'node_osm_2',
      }),
      createMockEdge({
        id: 'edge_w201_n2_n3_F',
        osmWayId: 201,
        fromNodeId: 'node_osm_2',
        toNodeId: 'node_osm_3',
      }),
      createMockEdge({
        id: 'edge_w301_n3_n4_F',
        osmWayId: 301,
        fromNodeId: 'node_osm_3',
        toNodeId: 'node_osm_4',
      }),
    ];

    const restriction = createMockRestriction({
      id: 'rel_13',
      fromOsmWayIds: [101],
      viaOsmWayIds: [201],
      toOsmWayIds: [301],
      conditionalExpression: 'no_u_turn @ (07:00-09:00)',
    });

    const result = resolveViaWayEdgeSequence(restriction, rawWaysMap, roadEdges);

    expect(result.status).toBe('UNRESOLVED');
    expect(result.error).toContain('Conditional via-way restriction unresolved');
  });

  // Test 14: Edge cần thiết bị loại khỏi graph do profile filtering
  it('14. Marks UNRESOLVED when required edge is filtered out of graph', () => {
    const rawWaysMap = new Map<number, RawWay>([
      [101, createMockWay(101, [1, 2])],
      [201, createMockWay(201, [2, 3])],
      [301, createMockWay(301, [3, 4])],
    ]);

    // from-way 101 has 0 edges in graph (e.g. filtered out by vehicle profile or bounding box)
    const roadEdges: RoadEdge[] = [
      createMockEdge({
        id: 'edge_w201_n2_n3_F',
        osmWayId: 201,
        fromNodeId: 'node_osm_2',
        toNodeId: 'node_osm_3',
      }),
      createMockEdge({
        id: 'edge_w301_n3_n4_F',
        osmWayId: 301,
        fromNodeId: 'node_osm_3',
        toNodeId: 'node_osm_4',
      }),
    ];

    const restriction = createMockRestriction({
      id: 'rel_14',
      fromOsmWayIds: [101],
      viaOsmWayIds: [201],
      toOsmWayIds: [301],
    });

    const result = resolveViaWayEdgeSequence(restriction, rawWaysMap, roadEdges);

    expect(result.status).toBe('UNRESOLVED');
    expect(result.error).toContain(
      'Required edges for from-way 101 missing from graph'
    );
  });

  // Test 15: Closed way hoặc topology phức tạp không thể xác định duy nhất
  it('15. Marks UNRESOLVED on ambiguous closed loop via-way with multiple paths', () => {
    // Via-way forms a closed loop where two distinct paths connect node 2 to node 3
    const rawWaysMap = new Map<number, RawWay>([
      [101, createMockWay(101, [1, 2])],
      [201, createMockWay(201, [2, 10, 3, 20, 2])],
      [301, createMockWay(301, [3, 4])],
    ]);

    const roadEdges: RoadEdge[] = [
      createMockEdge({
        id: 'edge_w101_n1_n2_F',
        osmWayId: 101,
        fromNodeId: 'node_osm_1',
        toNodeId: 'node_osm_2',
      }),
      // Path A: 2 -> 10 -> 3
      createMockEdge({
        id: 'edge_w201_n2_n10_F',
        osmWayId: 201,
        fromNodeId: 'node_osm_2',
        toNodeId: 'node_osm_10',
      }),
      createMockEdge({
        id: 'edge_w201_n10_n3_F',
        osmWayId: 201,
        fromNodeId: 'node_osm_10',
        toNodeId: 'node_osm_3',
      }),
      // Path B: 2 -> 20 -> 3
      createMockEdge({
        id: 'edge_w201_n2_n20_F',
        osmWayId: 201,
        fromNodeId: 'node_osm_2',
        toNodeId: 'node_osm_20',
      }),
      createMockEdge({
        id: 'edge_w201_n20_n3_F',
        osmWayId: 201,
        fromNodeId: 'node_osm_20',
        toNodeId: 'node_osm_3',
      }),
      // Departure:
      createMockEdge({
        id: 'edge_w301_n3_n4_F',
        osmWayId: 301,
        fromNodeId: 'node_osm_3',
        toNodeId: 'node_osm_4',
      }),
    ];

    const restriction = createMockRestriction({
      id: 'rel_15',
      fromOsmWayIds: [101],
      viaOsmWayIds: [201],
      toOsmWayIds: [301],
    });

    const result = resolveViaWayEdgeSequence(restriction, rawWaysMap, roadEdges);

    expect(result.status).toBe('UNRESOLVED');
    expect(result.error).toContain('Ambiguous topology');
  });

  // Test 16: Relation có nhiều via-way phải giữ đúng member order
  it('16. Preserves strict member order of via-ways regardless of way ID sorting', () => {
    // Via-ways in member order: 500 then 200 (200 has lower ID than 500!)
    const rawWaysMap = new Map<number, RawWay>([
      [101, createMockWay(101, [1, 2])],
      [500, createMockWay(500, [2, 3])], // via1
      [200, createMockWay(200, [3, 4])], // via2 (lower ID!)
      [301, createMockWay(301, [4, 5])],
    ]);

    const roadEdges: RoadEdge[] = [
      createMockEdge({
        id: 'edge_w101_n1_n2_F',
        osmWayId: 101,
        fromNodeId: 'node_osm_1',
        toNodeId: 'node_osm_2',
      }),
      createMockEdge({
        id: 'edge_w500_n2_n3_F',
        osmWayId: 500,
        fromNodeId: 'node_osm_2',
        toNodeId: 'node_osm_3',
      }),
      createMockEdge({
        id: 'edge_w200_n3_n4_F',
        osmWayId: 200,
        fromNodeId: 'node_osm_3',
        toNodeId: 'node_osm_4',
      }),
      createMockEdge({
        id: 'edge_w301_n4_n5_F',
        osmWayId: 301,
        fromNodeId: 'node_osm_4',
        toNodeId: 'node_osm_5',
      }),
    ];

    const restriction = createMockRestriction({
      id: 'rel_16',
      fromOsmWayIds: [101],
      viaOsmWayIds: [500, 200], // Member order: 500 first, 200 second
      toOsmWayIds: [301],
    });

    const result = resolveViaWayEdgeSequence(restriction, rawWaysMap, roadEdges);

    expect(result.status).toBe('COMPILED');
    expect(result.orderedDirectedEdgeIds).toEqual([
      'edge_w101_n1_n2_F',
      'edge_w500_n2_n3_F',
      'edge_w200_n3_n4_F',
      'edge_w301_n4_n5_F',
    ]);
  });

  // Test 17: Relation đã compile vẫn giữ FAIL_CLOSED_UNRESOLVED
  it('17. Preserves FAIL_CLOSED_UNRESOLVED support status on compiled via-way restriction during importXml', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="test">
  <node id="1" lat="16.0500" lon="108.2000"/>
  <node id="2" lat="16.0510" lon="108.2010"/>
  <node id="3" lat="16.0520" lon="108.2020"/>
  <node id="4" lat="16.0530" lon="108.2030"/>
  
  <way id="101">
    <nd ref="1"/>
    <nd ref="2"/>
    <tag k="highway" v="primary"/>
    <tag k="oneway" v="yes"/>
  </way>
  <way id="201">
    <nd ref="2"/>
    <nd ref="3"/>
    <tag k="highway" v="primary"/>
    <tag k="oneway" v="yes"/>
  </way>
  <way id="301">
    <nd ref="3"/>
    <nd ref="4"/>
    <tag k="highway" v="primary"/>
    <tag k="oneway" v="yes"/>
  </way>
  
  <relation id="9001">
    <member type="way" ref="101" role="from"/>
    <member type="way" ref="201" role="via"/>
    <member type="way" ref="301" role="to"/>
    <tag k="type" v="restriction"/>
    <tag k="restriction" v="no_u_turn"/>
  </relation>
</osm>`;

    const importer = new OsmImporter();
    const result = importer.importXml(xml, {
      osmSnapshotTimestamp: '2026-11-04T00:00:00Z',
    });

    const rel = result.graph.turnRestrictions.find(
      (r) => r.id === 'rel_osm_9001'
    );
    expect(rel).toBeDefined();

    // Verify compilation succeeded
    expect(rel!.viaWayCompilationStatus).toBe('COMPILED');
    expect(rel!.orderedDirectedEdgeIds).toEqual([
      'edge_w101_n1_n2_F',
      'edge_w201_n2_n3_F',
      'edge_w301_n3_n4_F',
    ]);
    expect(rel!.viaWayCompilationError).toBeNull();

    // CRITICAL: MUST REMAIN FAIL_CLOSED_UNRESOLVED!
    expect(rel!.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
  });

  // Test 18: Graph strict-routing readiness không bị thay đổi bởi việc compile sequence
  it('18. Ensures graph strict-routing readiness remains NOT_READY when via-way restrictions are compiled', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="test">
  <node id="1" lat="16.0500" lon="108.2000"/>
  <node id="2" lat="16.0510" lon="108.2010"/>
  <node id="3" lat="16.0520" lon="108.2020"/>
  <node id="4" lat="16.0530" lon="108.2030"/>
  
  <way id="101">
    <nd ref="1"/>
    <nd ref="2"/>
    <tag k="highway" v="primary"/>
    <tag k="oneway" v="yes"/>
  </way>
  <way id="201">
    <nd ref="2"/>
    <nd ref="3"/>
    <tag k="highway" v="primary"/>
    <tag k="oneway" v="yes"/>
  </way>
  <way id="301">
    <nd ref="3"/>
    <nd ref="4"/>
    <tag k="highway" v="primary"/>
    <tag k="oneway" v="yes"/>
  </way>
  
  <relation id="9001">
    <member type="way" ref="101" role="from"/>
    <member type="way" ref="201" role="via"/>
    <member type="way" ref="301" role="to"/>
    <tag k="type" v="restriction"/>
    <tag k="restriction" v="no_u_turn"/>
  </relation>
</osm>`;

    const importer = new OsmImporter();
    const result = importer.importXml(xml, {
      osmSnapshotTimestamp: '2026-11-04T00:00:00Z',
    });

    // Verification of Strict Routing Gates:
    expect(result.diagnostics.unsupportedRestrictionsCount).toBe(1);
    expect(result.graph.isRestrictionStrictRoutingEligible).toBe(false);
    expect(result.graph.restrictionStrictRoutingReadiness).toBe(
      'NOT_READY_UNRESOLVED_RESTRICTIONS'
    );
    expect(result.graph.canAttemptStrictRouting).toBe(false);
    expect(result.graph.isStrictRoutingEligible).toBe(false);
    expect(result.graph.overallStrictRoutingReadiness).toBe(
      'NOT_READY_UNRESOLVED_RESTRICTIONS'
    );
    expect(result.graph.strictRoutingReadiness).toBe(
      'NOT_READY_UNRESOLVED_RESTRICTIONS'
    );
  });

  describe('Task 2B: Backend Serialization and Bounded Search Tests', () => {
    const validXml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="test">
  <node id="1" lat="16.0500" lon="108.2000"/>
  <node id="2" lat="16.0510" lon="108.2010"/>
  <node id="3" lat="16.0520" lon="108.2020"/>
  <node id="4" lat="16.0530" lon="108.2030"/>
  
  <way id="101">
    <nd ref="1"/>
    <nd ref="2"/>
    <tag k="highway" v="primary"/>
    <tag k="oneway" v="yes"/>
  </way>
  <way id="201">
    <nd ref="2"/>
    <nd ref="3"/>
    <tag k="highway" v="primary"/>
    <tag k="oneway" v="yes"/>
  </way>
  <way id="301">
    <nd ref="3"/>
    <nd ref="4"/>
    <tag k="highway" v="primary"/>
    <tag k="oneway" v="yes"/>
  </way>
  
  <relation id="9001">
    <member type="way" ref="101" role="from"/>
    <member type="way" ref="201" role="via"/>
    <member type="way" ref="301" role="to"/>
    <tag k="type" v="restriction"/>
    <tag k="restriction" v="no_u_turn"/>
  </relation>
</osm>`;

    // 1. Serialize COMPILED restriction
    it('1. Serializes COMPILED restriction with exact fields in graph JSON', () => {
      const importer = new OsmImporter();
      const result = importer.importXml(validXml, {
        osmSnapshotTimestamp: '2026-11-04T00:00:00Z',
      });
      const serialized = JSON.stringify(result.graph);
      const parsedJson = JSON.parse(serialized);

      const rel = parsedJson.turnRestrictions.find(
        (r: any) => r.id === 'rel_osm_9001'
      );
      expect(rel).toBeDefined();
      expect(rel.viaWayCompilationStatus).toBe('COMPILED');
      expect(rel.orderedDirectedEdgeIds).toEqual([
        'edge_w101_n1_n2_F',
        'edge_w201_n2_n3_F',
        'edge_w301_n3_n4_F',
      ]);
      expect(rel.viaWayCompilationError).toBeNull();
      expect(rel.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
    });

    // 2. Serialize UNRESOLVED restriction
    it('2. Serializes UNRESOLVED restriction with empty sequence and error diagnostic in JSON', () => {
      const disconnectedXml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="test">
  <node id="1" lat="16.0500" lon="108.2000"/>
  <node id="2" lat="16.0510" lon="108.2010"/>
  <node id="8" lat="16.0520" lon="108.2020"/>
  <node id="9" lat="16.0530" lon="108.2030"/>
  <node id="10" lat="16.0540" lon="108.2040"/>
  
  <way id="101">
    <nd ref="1"/>
    <nd ref="2"/>
    <tag k="highway" v="primary"/>
  </way>
  <way id="201">
    <nd ref="8"/>
    <nd ref="9"/>
    <tag k="highway" v="primary"/>
  </way>
  <way id="301">
    <nd ref="9"/>
    <nd ref="10"/>
    <tag k="highway" v="primary"/>
  </way>
  
  <relation id="9002">
    <member type="way" ref="101" role="from"/>
    <member type="way" ref="201" role="via"/>
    <member type="way" ref="301" role="to"/>
    <tag k="type" v="restriction"/>
    <tag k="restriction" v="no_u_turn"/>
  </relation>
</osm>`;

      const importer = new OsmImporter();
      const result = importer.importXml(disconnectedXml, {
        osmSnapshotTimestamp: '2026-11-04T00:00:00Z',
      });
      const serialized = JSON.stringify(result.graph);
      const parsedJson = JSON.parse(serialized);

      const rel = parsedJson.turnRestrictions.find(
        (r: any) => r.id === 'rel_osm_9002'
      );
      expect(rel).toBeDefined();
      expect(rel.viaWayCompilationStatus).toBe('UNRESOLVED');
      expect(rel.orderedDirectedEdgeIds).toEqual([]);
      expect(rel.viaWayCompilationError).toContain('Discontinuous topology');
      expect(rel.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
    });

    // 3. Preserve exact edge sequence order
    it('3. Preserves exact sequence order without sorting or alteration during serialization', () => {
      const importer = new OsmImporter();
      const result = importer.importXml(validXml, {
        osmSnapshotTimestamp: '2026-11-04T00:00:00Z',
      });
      const serialized = JSON.stringify(result.graph);
      const parsedJson = JSON.parse(serialized);

      const rel = parsedJson.turnRestrictions.find(
        (r: any) => r.id === 'rel_osm_9001'
      );
      // fromApproach must be index 0, via is index 1, toDeparture is index 2
      expect(rel.orderedDirectedEdgeIds[0]).toBe('edge_w101_n1_n2_F');
      expect(rel.orderedDirectedEdgeIds[1]).toBe('edge_w201_n2_n3_F');
      expect(rel.orderedDirectedEdgeIds[2]).toBe('edge_w301_n3_n4_F');
    });

    // 4. Missing way data remains unresolved
    it('4. Retains UNRESOLVED status and error message when raw OSM way data is missing', () => {
      const rawWaysMap = new Map<number, RawWay>([
        [101, createMockWay(101, [1, 2])],
        [301, createMockWay(301, [3, 4])],
      ]);
      const restriction = createMockRestriction({
        id: 'rel_missing_via',
        fromOsmWayIds: [101],
        viaOsmWayIds: [999], // Way 999 does not exist in rawWaysMap
        toOsmWayIds: [301],
      });

      const res = resolveViaWayEdgeSequence(restriction, rawWaysMap, []);
      expect(res.status).toBe('UNRESOLVED');
      expect(res.orderedDirectedEdgeIds).toEqual([]);
      expect(res.error).toContain('Missing raw OSM way data for via-way 999');
    });

    // 5. Search limit exceeded remains unresolved
    it('5. Marks UNRESOLVED when DFS edge explorations or candidate count exceeds configured limits', () => {
      const rawWaysMap = new Map<number, RawWay>([
        [101, createMockWay(101, [1, 2])],
        [201, createMockWay(201, [2, 10, 11, 12, 3])],
        [301, createMockWay(301, [3, 4])],
      ]);

      const roadEdges: RoadEdge[] = [
        createMockEdge({
          id: 'edge_w101_n1_n2_F',
          osmWayId: 101,
          fromNodeId: 'node_osm_1',
          toNodeId: 'node_osm_2',
        }),
        createMockEdge({
          id: 'edge_w201_n2_n10_F',
          osmWayId: 201,
          fromNodeId: 'node_osm_2',
          toNodeId: 'node_osm_10',
        }),
        createMockEdge({
          id: 'edge_w201_n10_n11_F',
          osmWayId: 201,
          fromNodeId: 'node_osm_10',
          toNodeId: 'node_osm_11',
        }),
        createMockEdge({
          id: 'edge_w201_n11_n12_F',
          osmWayId: 201,
          fromNodeId: 'node_osm_11',
          toNodeId: 'node_osm_12',
        }),
        createMockEdge({
          id: 'edge_w201_n12_n3_F',
          osmWayId: 201,
          fromNodeId: 'node_osm_12',
          toNodeId: 'node_osm_3',
        }),
        createMockEdge({
          id: 'edge_w301_n3_n4_F',
          osmWayId: 301,
          fromNodeId: 'node_osm_3',
          toNodeId: 'node_osm_4',
        }),
      ];

      const restriction = createMockRestriction({
        id: 'rel_limit_test',
        fromOsmWayIds: [101],
        viaOsmWayIds: [201],
        toOsmWayIds: [301],
      });

      // Set maxEdgeExplorations to 2 (while reaching node 3 requires 4 segments)
      const res = resolveViaWayEdgeSequence(restriction, rawWaysMap, roadEdges, {
        maxEdgeExplorations: 2,
      });

      expect(res.status).toBe('UNRESOLVED');
      expect(res.orderedDirectedEdgeIds).toEqual([]);
      expect(res.error).toContain('Search limit exceeded');
      expect(res.error).toContain('maximum edge exploration limit of 2');
    });

    // 6. Sequence diagnostics preserved
    it('6. Preserves detailed diagnostic messages in viaWayCompilationError', () => {
      const rawWaysMap = new Map<number, RawWay>([
        [101, createMockWay(101, [1, 2])],
        [201, createMockWay(201, [5, 6])],
        [301, createMockWay(301, [6, 7])],
      ]);
      const restriction = createMockRestriction({
        id: 'rel_diag_test',
        fromOsmWayIds: [101],
        viaOsmWayIds: [201],
        toOsmWayIds: [301],
      });

      const res = resolveViaWayEdgeSequence(restriction, rawWaysMap, []);
      expect(res.error).toBe(
        'Discontinuous topology: from-way 101 and via-way 201 do not share any common junction node'
      );
    });

    // 7. Compiled restriction keeps FAIL_CLOSED_UNRESOLVED
    it('7. Guarantees compiled via-way restriction remains strictly FAIL_CLOSED_UNRESOLVED in output', () => {
      const importer = new OsmImporter();
      const result = importer.importXml(validXml, {
        osmSnapshotTimestamp: '2026-11-04T00:00:00Z',
      });
      const rel = result.graph.turnRestrictions[0];

      expect(rel.viaWayCompilationStatus).toBe('COMPILED');
      expect(rel.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
      expect(result.graph.isRestrictionStrictRoutingEligible).toBe(false);
      expect(result.graph.canAttemptStrictRouting).toBe(false);
      expect(result.graph.isStrictRoutingEligible).toBe(false);
    });
  });
});

