import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as crypto from 'crypto';
import { OsmImporter, isValidIso8601Timestamp } from '../src/osm-importer';
import {
  DA_NANG_CENTRAL_PRODUCTION_BOUNDING_BOX,
  FIXTURE_BOUNDING_BOX,
  OsmRelationMember,
  VehicleProfile,
} from '../src/types';
import {
  DEFAULT_RESCUE_TRUCK_4X4_PROFILE,
  evaluateWayForProfile,
  parseDimensionMeters,
  parseWeightTons,
  resolveAccessForEmergencyVehicle,
} from '../src/vehicle-profile';
import {
  haversineDistanceMeters,
  calculatePolylineLengthMeters,
} from '../src/haversine';
import {
  parseTurnRestrictionRelation,
  RawOsmRelation,
} from '../src/turn-restriction-parser';
import { runCli, parseCliArgs } from '../cli';

describe('OsmImporter Prototype with Test Fixtures', () => {
  let importer: OsmImporter;
  let fixtureXml: string;

  beforeAll(() => {
    importer = new OsmImporter();
    const fixturePath = path.join(__dirname, '..', 'fixtures', 'test_fixture.osm.xml');
    fixtureXml = fs.readFileSync(fixturePath, 'utf-8');
  });

  it('1. should import test fixture successfully and generate valid BaseRoadGraph', () => {
    const { graph, diagnostics } = importer.importXml(fixtureXml, {
      graphVersion: 'test_v1',
      vehicleProfile: DEFAULT_RESCUE_TRUCK_4X4_PROFILE,
    });

    expect(graph.graphVersion).toBe('test_v1');
    expect(graph.contractVersion).toBe('2.1.0');
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(diagnostics.nodesRead).toBeGreaterThan(0);
    expect(diagnostics.waysRead).toBeGreaterThan(0);
  });

  it('2. Way oneway=yes should only produce FORWARD edges (no reverse traversal)', () => {
    const { graph } = importer.importXml(fixtureXml);

    const edgesWay101 = graph.edges.filter((e) => e.osmWayId === 101);
    expect(edgesWay101.length).toBeGreaterThanOrEqual(1);

    for (const e of edgesWay101) {
      expect(e.wayFlowPolicy).toBe('FORWARD');
      expect(e.isWayForward).toBe(true);
      expect(e.id).toContain('_F');
    }

    // Ensure no reverse edge exists for Way 101
    const reverseEdges = graph.edges.filter((e) => e.osmWayId === 101 && !e.isWayForward);
    expect(reverseEdges.length).toBe(0);
  });

  it('3. Way oneway=-1 should produce REVERSE edges with correctly flipped endpoints and geometry', () => {
    const { graph } = importer.importXml(fixtureXml);

    const edgesWay102 = graph.edges.filter((e) => e.osmWayId === 102);
    expect(edgesWay102.length).toBeGreaterThanOrEqual(1);

    for (const e of edgesWay102) {
      expect(e.wayFlowPolicy).toBe('REVERSE');
      expect(e.isWayForward).toBe(false);
      expect(e.id).toContain('_R');
      // Way 102 runs from node 4 to node 6 in OSM, so REVERSE edge must run from 6 to 4
      expect(e.fromNodeId).toBe('node_osm_6');
      expect(e.toNodeId).toBe('node_osm_4');
      // Geometry must start at node 6 lat (16.0150) and end at node 4 lat (16.0130)
      expect(e.geometry[0].lat).toBeCloseTo(16.0150, 4);
      expect(e.geometry[e.geometry.length - 1].lat).toBeCloseTo(16.0130, 4);
    }
  });

  it('4. Bidirectional ways (oneway=no or missing oneway) should produce exactly two reciprocal directed edges', () => {
    const { graph } = importer.importXml(fixtureXml);

    // Way 103: oneway=no
    const edgesWay103 = graph.edges.filter((e) => e.osmWayId === 103);
    expect(edgesWay103.length).toBe(2);
    const fwd103 = edgesWay103.find((e) => e.isWayForward);
    const rev103 = edgesWay103.find((e) => !e.isWayForward);
    expect(fwd103).toBeDefined();
    expect(rev103).toBeDefined();
    expect(fwd103!.fromNodeId).toBe(rev103!.toNodeId);
    expect(fwd103!.toNodeId).toBe(rev103!.fromNodeId);
    expect(fwd103!.lengthMeters).toBeCloseTo(rev103!.lengthMeters, 2);

    // Way 104: missing oneway tag -> default BIDIRECTIONAL
    const edgesWay104 = graph.edges.filter((e) => e.osmWayId === 104);
    expect(edgesWay104.length).toBe(2);
  });

  it('5. Motorway without oneway tag should default to FORWARD single-direction', () => {
    const { graph } = importer.importXml(fixtureXml);

    const edgesWay105 = graph.edges.filter((e) => e.osmWayId === 105);
    expect(edgesWay105.length).toBe(1);
    expect(edgesWay105[0].wayFlowPolicy).toBe('FORWARD');
    expect(edgesWay105[0].isWayForward).toBe(true);
  });

  it('6. Roundabout without oneway tag should default to FORWARD single-direction circular flow', () => {
    const { graph } = importer.importXml(fixtureXml);

    const edgesWay106 = graph.edges.filter((e) => e.osmWayId === 106);
    expect(edgesWay106.length).toBeGreaterThanOrEqual(1);
    for (const e of edgesWay106) {
      expect(e.wayFlowPolicy).toBe('FORWARD');
      expect(e.isWayForward).toBe(true);
    }
  });

  it('7. Junction=circular should NOT be assumed roundabout/oneway without explicit tag', () => {
    const { graph, diagnostics } = importer.importXml(fixtureXml);

    // Way 107 has junction=circular without oneway -> UNKNOWN -> dropped from static routing
    const edgesWay107 = graph.edges.filter((e) => e.osmWayId === 107);
    expect(edgesWay107.length).toBe(0);

    const dropped = diagnostics.droppedItems.find((d) => d.id === 107);
    expect(dropped).toBeDefined();
    expect(dropped!.reason).toContain('junction=circular lacks explicit oneway tag');
  });

  it('8. Two ways sharing OSM Node 21 must create real intersection and split ways correctly', () => {
    const { graph } = importer.importXml(fixtureXml);

    // Node 21 must be present in roadNodes
    const node21 = graph.nodes.find((n) => n.osmNodeId === 21);
    expect(node21).toBeDefined();

    // Way 108 (20->21->22) must be split at node 21 into 2 segments (4 directed edges total for 2-way)
    const edgesWay108 = graph.edges.filter((e) => e.osmWayId === 108);
    expect(edgesWay108.length).toBe(4);

    // Way 109 (23->21->24) must also be split at node 21 into 2 segments (4 directed edges total for 2-way)
    const edgesWay109 = graph.edges.filter((e) => e.osmWayId === 109);
    expect(edgesWay109.length).toBe(4);
  });

  it('9. Overpass crossing ground street with identical 2D coordinates but different node IDs must NOT create false intersection', () => {
    const { graph } = importer.importXml(fixtureXml);

    const edges110 = graph.edges.filter((e) => e.osmWayId === 110);
    const edges111 = graph.edges.filter((e) => e.osmWayId === 111);

    expect(edges110.length).toBe(2);
    expect(edges111.length).toBe(2);

    expect(graph.nodes.find((n) => n.osmNodeId === 31)).toBeUndefined();
    expect(graph.nodes.find((n) => n.osmNodeId === 34)).toBeUndefined();

    expect(graph.nodes.find((n) => n.osmNodeId === 30)).toBeDefined();
    expect(graph.nodes.find((n) => n.osmNodeId === 32)).toBeDefined();
    expect(graph.nodes.find((n) => n.osmNodeId === 33)).toBeDefined();
    expect(graph.nodes.find((n) => n.osmNodeId === 35)).toBeDefined();
  });

  it('10. Turn restrictions via-node (NO_LEFT_TURN, ONLY_RIGHT_TURN) must be properly evaluated with profile exception', () => {
    const { graph } = importer.importXml(fixtureXml);

    // Rel 1001: NO_LEFT_TURN with except=emergency
    const rel1001 = graph.turnRestrictions.find((r) => r.id === 'rel_osm_1001');
    expect(rel1001).toBeDefined();
    expect(rel1001!.type).toBe('NO_LEFT_TURN');
    expect(rel1001!.fromOsmWayIds).toEqual([108]);
    expect(rel1001!.viaOsmNodeIds).toEqual([21]);
    expect(rel1001!.toOsmWayIds).toEqual([109]);
    expect(rel1001!.exceptModes).toContain('emergency');
    expect(rel1001!.isExemptForProfile).toBe(true);
    expect(rel1001!.supportStatus).toBe('EXEMPT_FOR_PROFILE');

    // Rel 1002: ONLY_RIGHT_TURN without exception
    const rel1002 = graph.turnRestrictions.find((r) => r.id === 'rel_osm_1002');
    expect(rel1002).toBeDefined();
    expect(rel1002!.type).toBe('ONLY_RIGHT_TURN');
    expect(rel1002!.supportStatus).toBe('FULLY_SUPPORTED');
    expect(rel1002!.allowedTransitions).toBeDefined();
    expect(rel1002!.allowedTransitions!.length).toBeGreaterThan(0);
  });

  it('11. NO_ENTRY with multiple from-ways and NO_EXIT with multiple to-ways must be correctly parsed', () => {
    const { graph } = importer.importXml(fixtureXml);

    const rel1003 = graph.turnRestrictions.find((r) => r.id === 'rel_osm_1003');
    expect(rel1003).toBeDefined();
    expect(rel1003!.type).toBe('NO_ENTRY');
    expect(rel1003!.fromOsmWayIds).toEqual([114, 115]);
    expect(rel1003!.toOsmWayIds).toEqual([116]);
    expect(rel1003!.supportStatus).toBe('FULLY_SUPPORTED');
    expect(rel1003!.prohibitedTransitions).toBeDefined();
    expect(rel1003!.prohibitedTransitions!.length).toBeGreaterThan(0);

    const rel1004 = graph.turnRestrictions.find((r) => r.id === 'rel_osm_1004');
    expect(rel1004).toBeDefined();
    expect(rel1004!.type).toBe('NO_EXIT');
    expect(rel1004!.fromOsmWayIds).toEqual([117]);
    expect(rel1004!.toOsmWayIds).toEqual([118, 119]);
    expect(rel1004!.supportStatus).toBe('FULLY_SUPPORTED');
    expect(rel1004!.prohibitedTransitions).toBeDefined();
    expect(rel1004!.prohibitedTransitions!.length).toBeGreaterThan(0);
  });

  it('12. Via-way relations must be marked FAIL_CLOSED_UNRESOLVED and conditional marked FAIL_CLOSED in strict mode', () => {
    // 12a. Strict mode (default)
    const { graph: strictGraph, diagnostics: strictDiag } = importer.importXml(fixtureXml, {
      strictRescueMode: true,
    });

    const rel1005Strict = strictGraph.turnRestrictions.find((r) => r.id === 'rel_osm_1005');
    expect(rel1005Strict).toBeDefined();
    expect(rel1005Strict!.viaOsmWayIds).toEqual([121]);
    expect(rel1005Strict!.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');

    const rel1006Strict = strictGraph.turnRestrictions.find((r) => r.id === 'rel_osm_1006');
    expect(rel1006Strict).toBeDefined();
    expect(rel1006Strict!.conditionalExpression).toBe('no_left_turn @ (Mo-Fr 07:00-09:00)');
    expect(rel1006Strict!.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
    expect(strictDiag.unsupportedRestrictionsCount).toBe(2);

    // 12b. Diagnostic / non-strict mode
    const { graph: diagGraph } = importer.importXml(fixtureXml, {
      strictRescueMode: false,
    });
    const rel1006Diag = diagGraph.turnRestrictions.find((r) => r.id === 'rel_osm_1006');
    expect(rel1006Diag!.supportStatus).toBe('UNVERIFIED_WARNING');
  });

  it('13. Vehicle Profile filters must reject footway, private access, low clearance (even with emergency=yes), and overweight', () => {
    const { graph, diagnostics } = importer.importXml(fixtureXml);

    expect(graph.edges.find((e) => e.osmWayId === 126)).toBeUndefined();
    expect(graph.edges.find((e) => e.osmWayId === 127)).toBeUndefined();

    expect(graph.edges.find((e) => e.osmWayId === 128)).toBeUndefined();
    const droppedHeight = diagnostics.droppedItems.find((d) => d.id === 128);
    expect(droppedHeight).toBeDefined();
    expect(droppedHeight!.reason).toContain('Vehicle height (3m) exceeds maxheight (2.2m)');

    expect(graph.edges.find((e) => e.osmWayId === 129)).toBeUndefined();
    expect(graph.edges.find((e) => e.osmWayId === 130)).toBeUndefined();
  });

  it('14. Edge IDs must be 100% deterministic across multiple runs on identical input', () => {
    const run1 = importer.importXml(fixtureXml);
    const run2 = importer.importXml(fixtureXml);

    const ids1 = run1.graph.edges.map((e) => e.id);
    const ids2 = run2.graph.edges.map((e) => e.id);

    expect(ids1).toEqual(ids2);
  });

  it('15. Geometry and lengthMeters must match Haversine sum of coordinates without dangling references', () => {
    const { graph } = importer.importXml(fixtureXml);

    const nodeIdsSet = new Set(graph.nodes.map((n) => n.id));

    for (const edge of graph.edges) {
      expect(nodeIdsSet.has(edge.fromNodeId)).toBe(true);
      expect(nodeIdsSet.has(edge.toNodeId)).toBe(true);

      const calculatedLength = calculatePolylineLengthMeters(edge.geometry);
      expect(edge.lengthMeters).toBeCloseTo(calculatedLength, 2);

      const fromNode = graph.nodes.find((n) => n.id === edge.fromNodeId)!;
      const toNode = graph.nodes.find((n) => n.id === edge.toNodeId)!;
      expect(edge.geometry[0].lat).toBeCloseTo(fromNode.lat, 4);
      expect(edge.geometry[0].lon).toBeCloseTo(fromNode.lon, 4);
      expect(edge.geometry[edge.geometry.length - 1].lat).toBeCloseTo(toNode.lat, 4);
      expect(edge.geometry[edge.geometry.length - 1].lon).toBeCloseTo(toNode.lon, 4);
    }
  });

  it('16. Boundary crossing way 125 must remain intact because buffer retains all its nodes', () => {
    const { graph } = importer.importXml(fixtureXml);

    const edgesWay125 = graph.edges.filter((e) => e.osmWayId === 125);
    expect(edgesWay125.length).toBe(2);

    const fwdEdge = edgesWay125.find((e) => e.isWayForward)!;
    expect(fwdEdge.fromNodeId).toBe('node_osm_80');
    expect(fwdEdge.toNodeId).toBe('node_osm_82');
    expect(fwdEdge.geometry.length).toBe(3);
    expect(fwdEdge.geometry[1].lat).toBeCloseTo(16.092, 4);
  });

  // =========================================================================
  // NEW TESTS FOR PHASE 2B.1.1 HARDENING & CONTRACT VALIDATION
  // =========================================================================

  it('17. Conditional restriction fail-closed in strict mode & Strict Routing Readiness contract', () => {
    const { graph, diagnostics } = importer.importXml(fixtureXml, {
      strictRescueMode: true,
    });

    const rel1006 = graph.turnRestrictions.find((r) => r.id === 'rel_osm_1006')!;
    expect(rel1006).toBeDefined();
    // Raw expression preserved exactly
    expect(rel1006.conditionalExpression).toBe('no_left_turn @ (Mo-Fr 07:00-09:00)');
    // Must be FAIL_CLOSED_UNRESOLVED in strict mode
    expect(rel1006.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
    expect(rel1006.validationError).toContain('Conditional temporal restriction unresolved');

    // Because there are unresolved restrictions (via-way 1005 & conditional 1006), graph is NOT strict eligible
    expect(diagnostics.unsupportedRestrictionsCount).toBeGreaterThan(0);
    expect(graph.isStrictRoutingEligible).toBe(false);
    expect(graph.strictRoutingReadiness).toBe('NOT_READY_UNRESOLVED_RESTRICTIONS');
  });

  it('18. Via-node restriction topological verification (disconnected ways and directed edge check)', () => {
    // Create a mini XML with an invalid turn restriction where from-way does NOT connect to via-node
    const invalidXml = `
      <osm version="0.6">
        <node id="1" lat="16.01" lon="108.11"/>
        <node id="2" lat="16.02" lon="108.12"/>
        <node id="3" lat="16.03" lon="108.13"/>
        <node id="99" lat="16.05" lon="108.15"/>
        <way id="201">
          <nd ref="1"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
        </way>
        <way id="202">
          <nd ref="2"/><nd ref="3"/>
          <tag k="highway" v="primary"/>
        </way>
        <relation id="3001">
          <tag k="type" v="restriction"/>
          <tag k="restriction" v="no_left_turn"/>
          <!-- Invalid: via node 99 is NOT in way 201 or 202! -->
          <member type="way" ref="201" role="from"/>
          <member type="node" ref="99" role="via"/>
          <member type="way" ref="202" role="to"/>
        </relation>
      </osm>
    `;

    const { graph } = importer.importXml(invalidXml);
    const rel = graph.turnRestrictions.find((r) => r.id === 'rel_osm_3001')!;
    expect(rel).toBeDefined();
    expect(rel.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
    expect(rel.validationError).toContain('does not physically connect to via-node 99');

    // Case B: from-way connects in geometry but runs oneway away from via-node 2
    const onewayIncomingXml = `
      <osm version="0.6">
        <node id="1" lat="16.01" lon="108.11"/>
        <node id="2" lat="16.02" lon="108.12"/>
        <node id="3" lat="16.03" lon="108.13"/>
        <way id="201">
          <nd ref="2"/><nd ref="1"/>
          <tag k="highway" v="primary"/>
          <tag k="oneway" v="yes"/>
        </way>
        <way id="202">
          <nd ref="2"/><nd ref="3"/>
          <tag k="highway" v="primary"/>
        </way>
        <relation id="3002">
          <tag k="type" v="restriction"/>
          <tag k="restriction" v="no_left_turn"/>
          <member type="way" ref="201" role="from"/>
          <member type="node" ref="2" role="via"/>
          <member type="way" ref="202" role="to"/>
        </relation>
      </osm>
    `;
    const resOnewayIn = importer.importXml(onewayIncomingXml);
    const rel3002 = resOnewayIn.graph.turnRestrictions.find((r) => r.id === 'rel_osm_3002')!;
    expect(rel3002.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
    expect(rel3002.validationError).toContain('No incoming directed edges enter via-node 2');

    // Case C: to-way connects in geometry but runs oneway into via-node 2 (cannot depart)
    const onewayOutgoingXml = `
      <osm version="0.6">
        <node id="1" lat="16.01" lon="108.11"/>
        <node id="2" lat="16.02" lon="108.12"/>
        <node id="3" lat="16.03" lon="108.13"/>
        <way id="201">
          <nd ref="1"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
        </way>
        <way id="202">
          <nd ref="3"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
          <tag k="oneway" v="yes"/>
        </way>
        <relation id="3003">
          <tag k="type" v="restriction"/>
          <tag k="restriction" v="no_left_turn"/>
          <member type="way" ref="201" role="from"/>
          <member type="node" ref="2" role="via"/>
          <member type="way" ref="202" role="to"/>
        </relation>
      </osm>
    `;
    const resOnewayOut = importer.importXml(onewayOutgoingXml);
    const rel3003 = resOnewayOut.graph.turnRestrictions.find((r) => r.id === 'rel_osm_3003')!;
    expect(rel3003.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
    expect(rel3003.validationError).toContain('No outgoing directed edges exit via-node 2');
  });

  it('19. Turn restriction cardinality validation (malformed NO_ENTRY and NO_EXIT)', () => {
    const rawNoEntryInvalid: RawOsmRelation = {
      id: 9001,
      tags: { type: 'restriction', restriction: 'no_entry' },
      members: [
        { type: 'way', ref: 101, role: 'from', order: 0 },
        { type: 'node', ref: 21, role: 'via', order: 1 },
        { type: 'way', ref: 102, role: 'to', order: 2 },
        { type: 'way', ref: 103, role: 'to', order: 3 }, // Invalid: 2 to-ways!
      ],
    };

    const parsed = parseTurnRestrictionRelation(rawNoEntryInvalid);
    expect(parsed).toBeDefined();
    expect(parsed!.toOsmWayIds.length).toBe(2);

    // Now test importer verification on this relation
    const xmlWithBadCardinality = `
      <osm version="0.6">
        <node id="1" lat="16.01" lon="108.11"/>
        <node id="2" lat="16.02" lon="108.12"/>
        <node id="3" lat="16.03" lon="108.13"/>
        <node id="4" lat="16.04" lon="108.14"/>
        <way id="201"><nd ref="1"/><nd ref="2"/><tag k="highway" v="primary"/></way>
        <way id="202"><nd ref="2"/><nd ref="3"/><tag k="highway" v="primary"/></way>
        <way id="203"><nd ref="2"/><nd ref="4"/><tag k="highway" v="primary"/></way>
        <relation id="9001">
          <tag k="type" v="restriction"/>
          <tag k="restriction" v="no_entry"/>
          <member type="way" ref="201" role="from"/>
          <member type="node" ref="2" role="via"/>
          <member type="way" ref="202" role="to"/>
          <member type="way" ref="203" role="to"/>
        </relation>
      </osm>
    `;
    const { graph } = importer.importXml(xmlWithBadCardinality);
    const rel = graph.turnRestrictions.find((r) => r.id === 'rel_osm_9001')!;
    expect(rel.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
    expect(rel.validationError).toContain('NO_ENTRY requires >= 1 from-way and exactly 1 to-way');

    // Test NO_EXIT with multiple from-ways (invalid cardinality)
    const xmlNoExitBad = `
      <osm version="0.6">
        <node id="1" lat="16.01" lon="108.11"/><node id="2" lat="16.02" lon="108.12"/>
        <node id="3" lat="16.03" lon="108.13"/><node id="4" lat="16.04" lon="108.14"/>
        <way id="201"><nd ref="1"/><nd ref="2"/><tag k="highway" v="primary"/></way>
        <way id="202"><nd ref="3"/><nd ref="2"/><tag k="highway" v="primary"/></way>
        <way id="203"><nd ref="2"/><nd ref="4"/><tag k="highway" v="primary"/></way>
        <relation id="9002">
          <tag k="type" v="restriction"/>
          <tag k="restriction" v="no_exit"/>
          <member type="way" ref="201" role="from"/>
          <member type="way" ref="202" role="from"/>
          <member type="node" ref="2" role="via"/>
          <member type="way" ref="203" role="to"/>
        </relation>
      </osm>
    `;
    const resNoExit = importer.importXml(xmlNoExitBad);
    const relExit = resNoExit.graph.turnRestrictions.find((r) => r.id === 'rel_osm_9002')!;
    expect(relExit.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
    expect(relExit.validationError).toContain('NO_EXIT requires exactly 1 from-way and >= 1 to-way');

    // Direct parser tests for malformed relations
    expect(parseTurnRestrictionRelation({ id: 1, tags: { type: 'route' }, members: [] })).toBeNull();
    expect(parseTurnRestrictionRelation({ id: 2, tags: { type: 'restriction', restriction: 'unknown_turn' }, members: [] })).toBeNull();
    expect(parseTurnRestrictionRelation({
      id: 3,
      tags: { type: 'restriction', restriction: 'no_left_turn' },
      members: [{ type: 'way', ref: 1, role: 'from', order: 0 }],
    })).toBeNull(); // Missing to and via
    expect(parseTurnRestrictionRelation({
      id: 4,
      tags: { type: 'restriction', restriction: 'no_left_turn' },
      members: [
        { type: 'way', ref: 1, role: 'from', order: 0 },
        { type: 'way', ref: 2, role: 'to', order: 1 },
      ],
    })).toBeNull(); // Missing via
  });

  it('20. Vehicle Profile: Emergency access permissions vs Physical limits', () => {
    // 20.1 Private access without emergency permission -> REJECTED
    const resPrivateNoEmerg = evaluateWayForProfile(
      { highway: 'residential', access: 'private' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resPrivateNoEmerg.allowed).toBe(false);
    expect(resPrivateNoEmerg.reason).toContain('Restricted access');

    // 20.2 Private access with emergency=yes -> ALLOWED
    const resPrivateWithEmerg = evaluateWayForProfile(
      { highway: 'residential', access: 'private', emergency: 'yes' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resPrivateWithEmerg.allowed).toBe(true);

    // 20.3 emergency=yes but maxheight=2.5m (rescue truck is 3.0m) -> REJECTED (physical barrier)
    const resLowHeight = evaluateWayForProfile(
      { highway: 'residential', emergency: 'yes', maxheight: '2.5m' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resLowHeight.allowed).toBe(false);
    expect(resLowHeight.reason).toContain('exceeds maxheight (2.5m)');

    // 20.4 emergency=yes but maxweight=4.0t (rescue truck is 5.0t) -> REJECTED (physical barrier)
    const resOverweight = evaluateWayForProfile(
      { highway: 'residential', emergency: 'yes', maxweight: '4.0t' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resOverweight.allowed).toBe(false);
    expect(resOverweight.reason).toContain('exceeds maxweight (4t)');

    // 20.5 Legal maxwidth vs Physical maxwidth:physical distinction:
    // Case A: legal maxwidth=2.0m with emergency=yes -> Emergency can override legal signpost
    const resLegalWidth = evaluateWayForProfile(
      { highway: 'residential', emergency: 'yes', maxwidth: '2.0m' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resLegalWidth.allowed).toBe(true);
    expect(resLegalWidth.maxWidthMeters).toBe(2.0);

    // Case B: physical maxwidth:physical=2.0m with emergency=yes -> CANNOT override physical barrier!
    const resPhysicalWidth = evaluateWayForProfile(
      { highway: 'residential', emergency: 'yes', 'maxwidth:physical': '2.0m' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resPhysicalWidth.allowed).toBe(false);
    expect(resPhysicalWidth.reason).toContain('exceeds maxwidth:physical (2m)');

    // Case C: road surface width=2.0m (vehicle 2.2m) -> Physical barrier, rejected
    const resRoadWidth = evaluateWayForProfile(
      { highway: 'residential', emergency: 'yes', width: '2.0m' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resRoadWidth.allowed).toBe(false);
    expect(resRoadWidth.reason).toContain('exceeds road width (2m)');

    // Case D: effective width=2.0m -> Physical barrier, rejected
    const resEffWidth = evaluateWayForProfile(
      { highway: 'residential', emergency: 'yes', 'width:effective': '2.0m' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resEffWidth.allowed).toBe(false);
    expect(resEffWidth.reason).toContain('exceeds width:effective (2m)');

    // Case E: track with grade4 (soft mud) is NOT dropped/rejected for flood, but recorded with surfaceSuitability & warning
    const resTrack = evaluateWayForProfile(
      { highway: 'track', tracktype: 'grade4' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resTrack.allowed).toBe(true);
    expect(resTrack.trackGrade).toBe('grade4');
    expect(resTrack.surfaceSuitability).toBe('UNIMPROVED_ROUGH_TRACK');
    expect(resTrack.tagWarnings.some((w) => w.includes('grade4'))).toBe(true);

    // Case F: operational allowPrivateAccessOverride=true allows private without emergency=yes
    const resPrivOverride = evaluateWayForProfile(
      { highway: 'residential', access: 'private' },
      { ...DEFAULT_RESCUE_TRUCK_4X4_PROFILE, allowPrivateAccessOverride: true }
    );
    expect(resPrivOverride.allowed).toBe(true);

    // 20.6 Missing physical limits are tracked and flagged
    const resMissingLimits = evaluateWayForProfile(
      { highway: 'residential' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resMissingLimits.allowed).toBe(true);
    expect(resMissingLimits.isDimensionUnverified).toBe(true);
    expect(resMissingLimits.unverifiedPhysicalDimensions).toContain('maxheight:physical');
    expect(resMissingLimits.unverifiedPhysicalDimensions).toContain('width');
    expect(resMissingLimits.unverifiedLegalRestrictions).toContain('maxweight');
  });

  it('21. Turn restriction exception handling (except=emergency, restriction:emergency, restriction:bus)', () => {
    // 21.1 except=emergency
    const relExcept: RawOsmRelation = {
      id: 5001,
      tags: { type: 'restriction', restriction: 'no_left_turn', except: 'emergency' },
      members: [
        { type: 'way', ref: 10, role: 'from', order: 0 },
        { type: 'node', ref: 2, role: 'via', order: 1 },
        { type: 'way', ref: 20, role: 'to', order: 2 },
      ],
    };
    const parsedExcept = parseTurnRestrictionRelation(relExcept);
    expect(parsedExcept!.isExemptForProfile).toBe(true);
    expect(parsedExcept!.supportStatus).toBe('EXEMPT_FOR_PROFILE');

    // 21.2 restriction:emergency explicitly targets emergency
    const relEmerg: RawOsmRelation = {
      id: 5002,
      tags: { type: 'restriction', 'restriction:emergency': 'no_left_turn' },
      members: [
        { type: 'way', ref: 10, role: 'from', order: 0 },
        { type: 'node', ref: 2, role: 'via', order: 1 },
        { type: 'way', ref: 20, role: 'to', order: 2 },
      ],
    };
    const parsedEmerg = parseTurnRestrictionRelation(relEmerg);
    expect(parsedEmerg!.isExemptForProfile).toBe(false);
    expect(parsedEmerg!.restrictionMode).toBe('emergency');

    // 21.3 restriction:bus is exempt for rescue truck
    const relBus: RawOsmRelation = {
      id: 5003,
      tags: { type: 'restriction', 'restriction:bus': 'no_right_turn' },
      members: [
        { type: 'way', ref: 10, role: 'from', order: 0 },
        { type: 'node', ref: 2, role: 'via', order: 1 },
        { type: 'way', ref: 20, role: 'to', order: 2 },
      ],
    };
    const parsedBus = parseTurnRestrictionRelation(relBus);
    expect(parsedBus!.isExemptForProfile).toBe(true);
    expect(parsedBus!.supportStatus).toBe('EXEMPT_FOR_PROFILE');
  });

  it('22. CLI execution, RoutingManifest & Hazard Snapshot contract verification', () => {
    const { realSha256 } = runCli();
    const outputDir = path.join(__dirname, '..', 'output');

    // Read generated RoutingManifest.json
    const manifestPath = path.join(outputDir, 'RoutingManifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    // Verify Task 5 requirements
    expect(manifest.activeHazardSnapshotVersion).toBeNull();
    expect(manifest.hazardSnapshotStatus).toBe('NOT_INCLUDED');
    expect(manifest.hazardAssessmentPolicy).toBe('HAZARD_DATA_REQUIRED_FOR_LIVE_CONDITIONS');

    // Verify Task 6 requirements
    expect(manifest.osmSnapshotTimestamp).toBe('2024-11-01T00:00:00.000Z');
    expect(manifest.fixtureGeneratedAt).toBe('2026-11-03T16:45:00.000Z');
    expect(manifest.boundingBoxType).toBe('FIXTURE');
    expect(manifest.targetProductionBoundingBox).toBeDefined();
    expect(manifest.targetProductionBoundingBox.minLon).toBe(108.1900);
    expect(manifest.targetProductionBoundingBox.minLat).toBe(16.0350);

    // Verify Task 1 strict readiness
    expect(manifest.isStrictRoutingEligible).toBe(false);
    expect(manifest.strictRoutingReadiness).toBe('NOT_READY_UNRESOLVED_RESTRICTIONS');

    // Verify actual byte-level SHA-256 match
    expect(manifest.bundle.sha256).toBe(realSha256);
  });

  it('23. Output Gzip decompression and checksum integrity check', () => {
    const outputDir = path.join(__dirname, '..', 'output');
    const gzPath = path.join(outputDir, 'BaseRoadGraph.json.gz');
    const jsonPath = path.join(outputDir, 'BaseRoadGraph.json');

    expect(fs.existsSync(gzPath)).toBe(true);
    const gzBytes = fs.readFileSync(gzPath);

    // Gunzip decompression check
    const decompressedBuffer = zlib.gunzipSync(gzBytes);
    const decompressedJson = decompressedBuffer.toString('utf-8');
    const originalJson = fs.readFileSync(jsonPath, 'utf-8');

    expect(JSON.parse(decompressedJson)).toEqual(JSON.parse(originalJson));

    // Recompute SHA-256 from actual Gzip bytes
    const computedHash = crypto.createHash('sha256').update(gzBytes).digest('hex');
    const manifest = JSON.parse(fs.readFileSync(path.join(outputDir, 'RoutingManifest.json'), 'utf-8'));
    expect(computedHash).toBe(manifest.bundle.sha256);
  });

  it('24. Dimension and weight parsing helper functions test coverage', () => {
    // Dimension parsing
    expect(parseDimensionMeters(undefined).value).toBeNull();
    expect(parseDimensionMeters('').value).toBeNull();
    expect(parseDimensionMeters('3.5m').value).toBe(3.5);
    expect(parseDimensionMeters('2').value).toBe(2);
    expect(parseDimensionMeters('invalid').unparseable).toBe(true);

    // Weight parsing
    expect(parseWeightTons(undefined).value).toBeNull();
    expect(parseWeightTons('').value).toBeNull();
    expect(parseWeightTons('5t').value).toBe(5.0);
    expect(parseWeightTons('3500kg').value).toBe(3.5);
    expect(parseWeightTons('invalid').unparseable).toBe(true);
  });

  // =========================================================================
  // TESTS FOR PHASE 2B.1.2 PHYSICAL VS LEGAL CONSTRAINT SEMANTICS
  // =========================================================================

  it('25. maxheight and maxheight:physical are stored separately in edge metadata and evaluation result', () => {
    const res = evaluateWayForProfile(
      {
        highway: 'primary',
        maxheight: '3.5m',
        'maxheight:physical': '3.8m',
      },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );

    expect(res.maxHeightMeters).toBe(3.5);
    expect(res.maxPhysicalHeightMeters).toBe(3.8);
    expect(res.isPhysicalClearanceUnverified).toBe(false);
  });

  it('26. Has maxheight but lacks maxheight:physical must not declare physical clearance is verified', () => {
    const res = evaluateWayForProfile(
      {
        highway: 'primary',
        maxheight: '3.5m',
      },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );

    expect(res.maxHeightMeters).toBe(3.5);
    expect(res.maxPhysicalHeightMeters).toBeNull();
    expect(res.isPhysicalClearanceUnverified).toBe(true);
    expect(res.unverifiedPhysicalDimensions).toContain('maxheight:physical');
  });

  it('27. maxweight and maxweightrating are stored in separate fields and not conflated', () => {
    const res = evaluateWayForProfile(
      {
        highway: 'primary',
        maxweight: '8.0t',
        maxweightrating: '7.5t',
      },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );

    expect(res.maxWeightTons).toBe(8.0);
    expect(res.maxWeightRatingTons).toBe(7.5);
  });

  it('28. Vehicle actual weight and rated weight are compared against correct corresponding fields', () => {
    const customProfile: VehicleProfile = {
      ...DEFAULT_RESCUE_TRUCK_4X4_PROFILE,
      dimensions: {
        ...DEFAULT_RESCUE_TRUCK_4X4_PROFILE.dimensions,
        actualWeightTons: 5.0,
        maxWeightRatingTons: 6.0,
      },
    };

    // Case A: actual weight 5.0t passes maxweight 5.5t, but rated weight 6.0t exceeds maxweightrating 5.5t
    const resRatedFail = evaluateWayForProfile(
      {
        highway: 'primary',
        maxweight: '5.5t',
        maxweightrating: '5.5t',
      },
      customProfile
    );
    expect(resRatedFail.allowed).toBe(false);
    expect(resRatedFail.reason).toContain('exceeds maxweightrating (5.5t)');

    // Case B: rated weight 6.0t <= maxweightrating 7.0t, but actual weight 5.0t > maxweight 4.5t
    const resActualFail = evaluateWayForProfile(
      {
        highway: 'primary',
        maxweight: '4.5t',
        maxweightrating: '7.0t',
      },
      customProfile
    );
    expect(resActualFail.allowed).toBe(false);
    expect(resActualFail.reason).toContain('exceeds maxweight (4.5t)');
  });

  it('29. maxaxleload constraint is retained and evaluated against vehicle axle load', () => {
    const profileWithAxle: VehicleProfile = {
      ...DEFAULT_RESCUE_TRUCK_4X4_PROFILE,
      dimensions: {
        ...DEFAULT_RESCUE_TRUCK_4X4_PROFILE.dimensions,
        axleLoadTons: 3.2,
      },
    };

    // Axle load 3.2t > maxaxleload 2.8t -> REJECTED
    const resAxleFail = evaluateWayForProfile(
      {
        highway: 'secondary',
        bridge: 'yes',
        maxaxleload: '2.8t',
      },
      profileWithAxle
    );
    expect(resAxleFail.allowed).toBe(false);
    expect(resAxleFail.reason).toContain('exceeds maxaxleload (2.8t)');
    expect(resAxleFail.maxAxleLoadTons).toBe(2.8);

    // Axle load 3.2t <= maxaxleload 3.5t -> ALLOWED
    const resAxlePass = evaluateWayForProfile(
      {
        highway: 'secondary',
        bridge: 'yes',
        maxaxleload: '3.5t',
      },
      profileWithAxle
    );
    expect(resAxlePass.allowed).toBe(true);
    expect(resAxlePass.maxAxleLoadTons).toBe(3.5);
  });

  it('30. emergency=yes does NOT automatically bypass physical constraints (height, weight, axle, width)', () => {
    // 30.1 Physical height
    const resHeight = evaluateWayForProfile(
      { highway: 'primary', emergency: 'yes', 'maxheight:physical': '2.8m' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resHeight.allowed).toBe(false);
    expect(resHeight.reason).toContain('Physical barrier');

    // 30.2 Structural weight
    const resWeight = evaluateWayForProfile(
      { highway: 'primary', emergency: 'yes', maxweight: '4.0t' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resWeight.allowed).toBe(false);
    expect(resWeight.reason).toContain('Physical barrier');

    // 30.3 Structural axle load
    const resAxle = evaluateWayForProfile(
      { highway: 'primary', emergency: 'yes', maxaxleload: '2.0t' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resAxle.allowed).toBe(false);
    expect(resAxle.reason).toContain('Physical structural barrier');

    // 30.4 Physical width
    const resWidth = evaluateWayForProfile(
      { highway: 'primary', emergency: 'yes', 'maxwidth:physical': '2.0m' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resWidth.allowed).toBe(false);
    expect(resWidth.reason).toContain('Physical barrier');
  });

  it('31. maxwidth and maxwidth:physical are distinguished (legal signpost vs physical obstacle)', () => {
    const res = evaluateWayForProfile(
      {
        highway: 'primary',
        maxwidth: '2.5m',
        'maxwidth:physical': '2.8m',
      },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );

    expect(res.maxWidthMeters).toBe(2.5);
    expect(res.maxPhysicalWidthMeters).toBe(2.8);
  });

  it('32. width and width:effective maintain distinct semantics', () => {
    const res = evaluateWayForProfile(
      {
        highway: 'primary',
        width: '6.0m',
        'width:effective': '3.5m',
      },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );

    expect(res.widthMeters).toBe(6.0);
    expect(res.effectiveWidthMeters).toBe(3.5);
  });

  it('33. Exact fit dimensions must still evaluate safety margins', () => {
    // Profile width: 2.2m, lateral safety margin: 0.2m -> required clearance: 2.4m
    // Clearance of exactly 2.2m fits without margin, but fails safety barrier with margin
    const resWidthExact = evaluateWayForProfile(
      { highway: 'residential', 'maxwidth:physical': '2.2m' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resWidthExact.allowed).toBe(false);
    expect(resWidthExact.reason).toContain('safety barrier');
    expect(resWidthExact.reason).toContain('lateral safety margin');

    // Profile height: 3.0m, vertical safety margin: 0.1m -> required clearance: 3.1m
    // Clearance of exactly 3.0m fits without margin, but fails safety barrier with margin
    const resHeightExact = evaluateWayForProfile(
      { highway: 'residential', 'maxheight:physical': '3.0m' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resHeightExact.allowed).toBe(false);
    expect(resHeightExact.reason).toContain('safety barrier');
    expect(resHeightExact.reason).toContain('vertical safety margin');

    // If margin is 0, exact fit is allowed
    const profileZeroMargin: VehicleProfile = {
      ...DEFAULT_RESCUE_TRUCK_4X4_PROFILE,
      dimensions: {
        ...DEFAULT_RESCUE_TRUCK_4X4_PROFILE.dimensions,
        safetyMarginMeters: { lateralMeters: 0.0, verticalMeters: 0.0 },
      },
    };
    const resWidthZeroMargin = evaluateWayForProfile(
      { highway: 'residential', 'maxwidth:physical': '2.2m' },
      profileZeroMargin
    );
    expect(resWidthZeroMargin.allowed).toBe(true);
  });

  it('34. Conflicting tags are recorded in diagnostics and handled conservatively', () => {
    // Conflicting width: effective width 4.0m exceeds physical road width 3.5m
    const resConflictWidth = evaluateWayForProfile(
      {
        highway: 'residential',
        width: '3.5m',
        'width:effective': '4.0m',
      },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resConflictWidth.tagConflicts.length).toBeGreaterThan(0);
    expect(resConflictWidth.tagConflicts[0]).toContain('exceeds physical road width');

    // Test XML import with conflicting tags to verify diagnostics count and metadata
    const xmlWithConflict = `
      <osm version="0.6">
        <node id="1" lat="16.01" lon="108.11"/>
        <node id="2" lat="16.02" lon="108.12"/>
        <way id="801">
          <nd ref="1"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
          <tag k="width" v="3.0m"/>
          <tag k="width:effective" v="3.8m"/>
          <tag k="maxheight" v="3.5m"/>
          <tag k="maxheight:physical" v="3.2m"/>
        </way>
      </osm>
    `;
    const { graph, diagnostics } = importer.importXml(xmlWithConflict);
    expect(diagnostics.tagConflictCount).toBeGreaterThan(0);

    const edge = graph.edges.find((e) => e.osmWayId === 801)!;
    expect(edge).toBeDefined();
    expect(edge.metadata.tagConflicts).toBeDefined();
    expect(edge.metadata.tagConflicts!.length).toBeGreaterThanOrEqual(2);
  });

  it('35. Access hierarchy evaluation resolves correctly across emergency, motor_vehicle, vehicle, and access', () => {
    // Case 1: access=no + emergency=yes -> allowed
    const c1 = resolveAccessForEmergencyVehicle(
      { access: 'no', emergency: 'yes' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(c1.allowed).toBe(true);
    expect(c1.resolvedByTag).toBe('emergency');

    // Case 2: access=private + emergency=designated -> allowed
    const c2 = resolveAccessForEmergencyVehicle(
      { access: 'private', emergency: 'designated' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(c2.allowed).toBe(true);
    expect(c2.resolvedByTag).toBe('emergency');

    // Case 3: access=yes + emergency=no -> explicit denial overrides general access
    const c3 = resolveAccessForEmergencyVehicle(
      { access: 'yes', emergency: 'no' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(c3.allowed).toBe(false);
    expect(c3.resolvedByTag).toBe('emergency');
    expect(c3.reason).toContain('emergency=no');

    // Integration check: evaluateWayForProfile marks emergency=no as BLOCKED
    const c3Way = evaluateWayForProfile(
      { highway: 'primary', access: 'yes', emergency: 'no' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(c3Way.allowed).toBe(false);
    expect(c3Way.compatibilityStatus).toBe('BLOCKED');
    expect(c3Way.blockedReason).toContain('emergency=no');

    // Case 4: access=no + motor_vehicle=yes -> allowed
    const c4 = resolveAccessForEmergencyVehicle(
      { access: 'no', motor_vehicle: 'yes' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(c4.allowed).toBe(true);
    expect(c4.resolvedByTag).toBe('motor_vehicle');

    // Case 5: motor_vehicle=no + emergency=yes -> emergency overrides motor_vehicle=no
    const c5 = resolveAccessForEmergencyVehicle(
      { motor_vehicle: 'no', emergency: 'yes' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(c5.allowed).toBe(true);
    expect(c5.resolvedByTag).toBe('emergency');

    // Case 6: access=private + motor_vehicle=no -> motor_vehicle=no blocks access
    const c6 = resolveAccessForEmergencyVehicle(
      { access: 'private', motor_vehicle: 'no' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(c6.allowed).toBe(false);
    expect(c6.resolvedByTag).toBe('motor_vehicle');

    // Case 7: missing access tags -> default allowed for permitted highways
    const c7 = resolveAccessForEmergencyVehicle(
      {},
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(c7.allowed).toBe(true);
    expect(c7.resolvedByTag).toBe('default');

    // Case 8: unrecognized tag values generate warnings
    const cWarn = resolveAccessForEmergencyVehicle(
      { emergency: 'maybe', motor_vehicle: 'maybe', vehicle: 'maybe', access: 'maybe' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(cWarn.tagWarnings.length).toBe(4);
    expect(cWarn.allowed).toBe(true);
  });

  it('36. Dimension and weight unit parsing handles imperial units, fractions, and invalid formats safely', () => {
    // 36.0 Haversine zero distance
    expect(haversineDistanceMeters({ lat: 16.0, lon: 108.0 }, { lat: 16.0, lon: 108.0 })).toBe(0.0);
    // 36.1 Feet and inches
    const dim1 = parseDimensionMeters("14'6\"");
    expect(dim1.unparseable).toBe(false);
    expect(dim1.value).toBeCloseTo(4.42, 2);

    const dim2 = parseDimensionMeters('14ft 6in');
    expect(dim2.unparseable).toBe(false);
    expect(dim2.value).toBeCloseTo(4.42, 2);

    const dim3 = parseDimensionMeters("14'");
    expect(dim3.unparseable).toBe(false);
    expect(dim3.value).toBeCloseTo(4.267, 3);

    const dim4 = parseDimensionMeters('6"');
    expect(dim4.unparseable).toBe(false);
    expect(dim4.value).toBeCloseTo(0.152, 3);

    const dim5 = parseDimensionMeters("14'6");
    expect(dim5.unparseable).toBe(false);
    expect(dim5.value).toBeCloseTo(4.42, 2);

    // 36.2 Dimension rejection
    expect(parseDimensionMeters('-3.5m').unparseable).toBe(true);
    expect(parseDimensionMeters('-3.5m').value).toBeNull();
    expect(parseDimensionMeters('0m').unparseable).toBe(true);
    expect(parseDimensionMeters('0m').value).toBeNull();
    expect(parseDimensionMeters('abc').unparseable).toBe(true);
    expect(parseDimensionMeters('3.5mxyz').unparseable).toBe(true);
    expect(parseDimensionMeters(undefined).unparseable).toBe(false);
    expect(parseDimensionMeters(undefined).value).toBeNull();

    // 36.3 Weight units
    const w1 = parseWeightTons('5t');
    expect(w1.unparseable).toBe(false);
    expect(w1.value).toBe(5.0);

    const w2 = parseWeightTons('5 tonnes');
    expect(w2.unparseable).toBe(false);
    expect(w2.value).toBe(5.0);

    const w3 = parseWeightTons('3500kg');
    expect(w3.unparseable).toBe(false);
    expect(w3.value).toBe(3.5);

    const w4 = parseWeightTons('10000lbs');
    expect(w4.unparseable).toBe(false);
    expect(w4.value).toBeCloseTo(4.536, 3);

    const w5 = parseWeightTons('5st');
    expect(w5.unparseable).toBe(false);
    expect(w5.value).toBeCloseTo(4.536, 3);

    // 36.4 Weight rejection of ambiguous bare "ton"
    const wAmbiguous = parseWeightTons('5 ton');
    expect(wAmbiguous.unparseable).toBe(true);
    expect(wAmbiguous.value).toBeNull();

    expect(parseWeightTons('-5t').unparseable).toBe(true);
    expect(parseWeightTons('0t').unparseable).toBe(true);
    expect(parseWeightTons('heavy').unparseable).toBe(true);
  });

  it('37. Three-state edge compatibility model (VERIFIED_COMPATIBLE, UNVERIFIED, BLOCKED)', () => {
    // 37.1 VERIFIED_COMPATIBLE: Both physical height and physical width known and sufficient
    // Required: height 3.0m + 0.1m = 3.1m; width 2.2m + 0.2m = 2.4m
    const resVerified = evaluateWayForProfile(
      {
        highway: 'primary',
        'maxheight:physical': '3.5m',
        'maxwidth:physical': '2.6m',
      },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resVerified.allowed).toBe(true);
    expect(resVerified.compatibilityStatus).toBe('VERIFIED_COMPATIBLE');
    expect(resVerified.isEligibleForStrictRouting).toBe(true);
    expect(resVerified.blockedReason).toBeNull();

    // 37.2 UNVERIFIED: Missing physical clearance (even if legal maxheight is provided)
    const resUnverifiedHeight = evaluateWayForProfile(
      {
        highway: 'primary',
        maxheight: '3.5m', // Legal only
        'maxwidth:physical': '2.6m',
      },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resUnverifiedHeight.allowed).toBe(true);
    expect(resUnverifiedHeight.compatibilityStatus).toBe('UNVERIFIED');
    expect(resUnverifiedHeight.isEligibleForStrictRouting).toBe(false);

    // 37.3 UNVERIFIED: Missing physical width
    const resUnverifiedWidth = evaluateWayForProfile(
      {
        highway: 'primary',
        'maxheight:physical': '3.5m',
      },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resUnverifiedWidth.allowed).toBe(true);
    expect(resUnverifiedWidth.compatibilityStatus).toBe('UNVERIFIED');
    expect(resUnverifiedWidth.isEligibleForStrictRouting).toBe(false);

    // 37.4 UNVERIFIED: Tag conflict prevents strict routing
    const resConflict = evaluateWayForProfile(
      {
        highway: 'primary',
        'maxheight:physical': '3.5m',
        width: '3.0m',
        'width:effective': '3.6m', // conflict: effective > road width
      },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resConflict.allowed).toBe(true);
    expect(resConflict.compatibilityStatus).toBe('UNVERIFIED');
    expect(resConflict.isEligibleForStrictRouting).toBe(false);
    expect(resConflict.tagConflicts.length).toBeGreaterThan(0);

    // 37.5 BLOCKED: Physical height below vehicle clearance
    const resBlockedHeight = evaluateWayForProfile(
      {
        highway: 'primary',
        'maxheight:physical': '2.8m',
      },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resBlockedHeight.allowed).toBe(false);
    expect(resBlockedHeight.compatibilityStatus).toBe('BLOCKED');
    expect(resBlockedHeight.isEligibleForStrictRouting).toBe(false);
    expect(resBlockedHeight.blockedReason).toContain('maxheight:physical (2.8m)');

    // 37.6 BLOCKED: Forbidden access
    const resBlockedAccess = evaluateWayForProfile(
      {
        highway: 'residential',
        access: 'no',
      },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resBlockedAccess.allowed).toBe(false);
    expect(resBlockedAccess.compatibilityStatus).toBe('BLOCKED');

    // 37.7 width:effective allows bare vehicle (2.2m) but fails lateral safety margin (2.4m)
    const resEffMargin = evaluateWayForProfile(
      {
        highway: 'primary',
        'maxheight:physical': '3.5m',
        'width:effective': '2.3m',
      },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resEffMargin.allowed).toBe(false);
    expect(resEffMargin.blockedReason).toContain('lateral safety margin');
    expect(resEffMargin.blockedReason).toContain('width:effective (2.3m)');

    // 37.8 road width allows bare vehicle (2.2m) but fails lateral safety margin (2.4m)
    const resRoadMargin = evaluateWayForProfile(
      {
        highway: 'primary',
        'maxheight:physical': '3.5m',
        width: '2.3m',
      },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(resRoadMargin.allowed).toBe(false);
    expect(resRoadMargin.blockedReason).toContain('lateral safety margin');
    expect(resRoadMargin.blockedReason).toContain('road width (2.3m)');

    // 37.9 legal maxwidth override disabled
    const resLegalWidthBlocked = evaluateWayForProfile(
      {
        highway: 'primary',
        'maxheight:physical': '3.5m',
        'maxwidth:physical': '3.0m',
        maxwidth: '2.0m',
      },
      {
        ...DEFAULT_RESCUE_TRUCK_4X4_PROFILE,
        legalExemptionPolicy: {
          ...DEFAULT_RESCUE_TRUCK_4X4_PROFILE.legalExemptionPolicy!,
          allowLegalWidthSignOverride: false,
        },
      }
    );
    expect(resLegalWidthBlocked.allowed).toBe(false);
    expect(resLegalWidthBlocked.blockedReason).toContain('legal maxwidth (2m)');
  });

  it('38. Legal bridge weight and registration weight rating are distinct and not treated as conflicting', () => {
    // maxweight (actual structural weight limit on bridge) vs maxweightrating (registered vehicle class)
    const res = evaluateWayForProfile(
      {
        highway: 'primary',
        bridge: 'yes',
        maxweight: '10t',
        maxweightrating: '12t',
      },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );

    expect(res.allowed).toBe(true);
    expect(res.maxWeightTons).toBe(10);
    expect(res.maxWeightRatingTons).toBe(12);
    expect(res.tagConflicts).toHaveLength(0); // Valid distinct concepts, NOT a conflict
  });

  it('39. Track highway tracktype grade 1..5 is decoupled from disaster flood assumptions', () => {
    // Grade 1: paved/compacted
    const g1 = evaluateWayForProfile(
      { highway: 'track', tracktype: 'grade1' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(g1.allowed).toBe(true);
    expect(g1.trackGrade).toBe('grade1');
    expect(g1.surfaceSuitability).toBe('PAVED_OR_COMPACTED_TRACK');

    // Grade 3: unimproved rough
    const g3 = evaluateWayForProfile(
      { highway: 'track', tracktype: 'grade3' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(g3.allowed).toBe(true);
    expect(g3.trackGrade).toBe('grade3');
    expect(g3.surfaceSuitability).toBe('UNIMPROVED_ROUGH_TRACK');

    // Grade 5: very soft/unimproved, allowed for 4x4 rescue truck with warning, NOT discarded as flood
    const g5 = evaluateWayForProfile(
      { highway: 'track', tracktype: 'grade5' },
      DEFAULT_RESCUE_TRUCK_4X4_PROFILE
    );
    expect(g5.allowed).toBe(true);
    expect(g5.trackGrade).toBe('grade5');
    expect(g5.surfaceSuitability).toBe('UNIMPROVED_ROUGH_TRACK');
    expect(g5.tagWarnings.some((w) => w.includes('grade5'))).toBe(true);
  });

  it('40. BaseRoadGraph and RoutingManifest contracts include edge safety summary and separate restriction readiness', () => {
    const { graph } = importer.importXml(fixtureXml);

    // 1. Contract version 2.1.0
    expect(graph.contractVersion).toBe('2.1.0');

    // 2. Edge Safety Summary on graph
    expect(graph.edgeSafetySummary).toBeDefined();
    expect(graph.edgeSafetySummary.totalEdges).toBe(graph.edges.length);
    expect(graph.edgeSafetySummary.verifiedCompatibleEdges).toBeGreaterThanOrEqual(0);
    expect(graph.edgeSafetySummary.unverifiedEdges).toBeGreaterThanOrEqual(0);
    expect(graph.edgeSafetySummary.blockedEdges).toBeGreaterThanOrEqual(0);
    expect(typeof graph.edgeSafetySummary.strictSafeEdgesPercent).toBe('number');

    // 3. Restriction readiness separated from edge safety
    expect(graph.restrictionStrictRoutingReadiness).toBeDefined();
    expect(typeof graph.isRestrictionStrictRoutingEligible).toBe('boolean');

    // 4. Edges have compatibility fields
    for (const edge of graph.edges) {
      expect(['VERIFIED_COMPATIBLE', 'UNVERIFIED', 'BLOCKED']).toContain(edge.compatibilityStatus);
      expect(typeof edge.isEligibleForStrictRouting).toBe('boolean');
    }

    // 5. CLI produces manifest conforming to contract 2.1.0
    const outDir = path.join(__dirname, '..', 'output');
    const manifestPath = path.join(outDir, 'RoutingManifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    expect(manifest.manifestVersion).toBe('2.1.0');
    expect(manifest.edgeSafetySummary).toBeDefined();
    expect(manifest.edgeSafetySummary.totalEdges).toBeGreaterThan(0);
    expect(manifest.restrictionStrictRoutingReadiness).toBeDefined();
    expect(typeof manifest.isRestrictionStrictRoutingEligible).toBe('boolean');
  });

  it('41. Regression 1 & 4 & 5: Blocked way is NOT miscounted as directed edge; subsets share unit and sum to totalEdges', () => {
    const { graph, diagnostics } = importer.importXml(fixtureXml);

    // 1. In default mode, blocked ways are excluded from graph directed edges
    expect(graph.edgeSafetySummary.blockedEdges).toBe(0);
    expect(diagnostics.blockedEdgesCount).toBe(0);

    // 2. Blocked ways are tracked in blockedWays / blockedWaysCount with unit = OSM Ways
    expect(graph.edgeSafetySummary.blockedWays).toBe(4);
    expect(diagnostics.blockedWaysCount).toBe(4);

    // 3. Mathematical unit consistency: total directed edges = verified + unverified + blocked
    const sumDirectedEdges =
      graph.edgeSafetySummary.verifiedCompatibleEdges +
      graph.edgeSafetySummary.unverifiedEdges +
      graph.edgeSafetySummary.blockedEdges;
    expect(graph.edgeSafetySummary.totalEdges).toBe(sumDirectedEdges);
    expect(graph.edgeSafetySummary.totalEdges).toBe(graph.edges.length);

    // 4. Verification that blockedWays is NOT mixed into totalEdges
    expect(graph.edgeSafetySummary.totalEdges).not.toBe(sumDirectedEdges + graph.edgeSafetySummary.blockedWays);
  });

  it('42. Regression 2: Forward and reverse edges of a way have consistent compatibility status, eligibility, and blockedReason', () => {
    const { graph } = importer.importXml(fixtureXml);

    // Group edges by osmWayId
    const wayToEdges = new Map<number, typeof graph.edges>();
    for (const edge of graph.edges) {
      const list = wayToEdges.get(edge.osmWayId) ?? [];
      list.push(edge);
      wayToEdges.set(edge.osmWayId, list);
    }

    // For every bidirectional way with both forward and reverse edges
    for (const [wayId, edges] of wayToEdges.entries()) {
      const fwdEdges = edges.filter((e) => e.isWayForward);
      const revEdges = edges.filter((e) => !e.isWayForward);

      if (fwdEdges.length > 0 && revEdges.length > 0) {
        for (const fwd of fwdEdges) {
          for (const rev of revEdges) {
            expect(fwd.compatibilityStatus).toBe(rev.compatibilityStatus);
            expect(fwd.isEligibleForStrictRouting).toBe(rev.isEligibleForStrictRouting);
            expect(fwd.blockedReason).toBe(rev.blockedReason);
          }
        }
      }
    }
  });

  it('43. Regression 3: When retaining BLOCKED edges, blockedReason must be a non-empty string and isEligibleForStrictRouting is false', () => {
    // Import with retainBlockedEdgesInGraph: true
    const { graph, diagnostics } = importer.importXml(fixtureXml, {
      retainBlockedEdgesInGraph: true,
    });

    // Graph now retains BLOCKED edges
    const blockedEdges = graph.edges.filter((e) => e.compatibilityStatus === 'BLOCKED');
    expect(blockedEdges.length).toBeGreaterThan(0);
    expect(graph.edgeSafetySummary.blockedEdges).toBe(blockedEdges.length);
    expect(diagnostics.blockedEdgesCount).toBe(blockedEdges.length);

    // Every blocked edge must have a valid non-empty blockedReason and isEligibleForStrictRouting=false
    for (const edge of blockedEdges) {
      expect(edge.isEligibleForStrictRouting).toBe(false);
      expect(typeof edge.blockedReason).toBe('string');
      expect(edge.blockedReason!.length).toBeGreaterThan(0);
    }

    // Mathematical consistency still holds: total = verified + unverified + blocked
    const sum =
      graph.edgeSafetySummary.verifiedCompatibleEdges +
      graph.edgeSafetySummary.unverifiedEdges +
      graph.edgeSafetySummary.blockedEdges;
    expect(graph.edgeSafetySummary.totalEdges).toBe(sum);
    expect(graph.edgeSafetySummary.totalEdges).toBe(graph.edges.length);
  });

  it('44. Regression 6: Overall strict routing CANNOT report READY when there are 0 verified edges, even if restrictions are 100% resolved', () => {
    // Construct an OSM XML with no turn restrictions and roads with unverified dimensions
    const xmlNoRestrictionsUnverifiedEdges = `
      <osm version="0.6">
        <node id="1" lat="16.050" lon="108.200"/>
        <node id="2" lat="16.051" lon="108.201"/>
        <way id="901">
          <nd ref="1"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
          <tag k="name" v="Unverified Street"/>
        </way>
      </osm>
    `;

    const { graph, diagnostics } = importer.importXml(xmlNoRestrictionsUnverifiedEdges);

    // 1. Restriction readiness is READY because there are 0 unsupported restrictions
    expect(diagnostics.unsupportedRestrictionsCount).toBe(0);
    expect(graph.isRestrictionStrictRoutingEligible).toBe(true);
    expect(graph.restrictionStrictRoutingReadiness).toBe('READY');

    // 2. But verifiedCompatibleEdges is 0 (missing physical dimensions)
    expect(graph.edgeSafetySummary.verifiedCompatibleEdges).toBe(0);
    expect(graph.edgeSafetySummary.unverifiedEdges).toBe(2); // 2 directed edges (bidirectional)

    // 3. Overall strict routing MUST NOT be READY and MUST NOT be eligible!
    expect(graph.isStrictRoutingEligible).toBe(false);
    expect(graph.strictRoutingReadiness).toBe('NOT_READY_NO_VERIFIED_EDGES');
    expect(graph.overallStrictRoutingReadiness).toBe('NOT_READY_NO_VERIFIED_EDGES');
  });

  it('45. Regression 6 part 2: Overall strict routing reports READY when restrictions resolved AND edges are verified', () => {
    // Construct an OSM XML with no turn restrictions and fully verified edges
    const xmlFullyVerified = `
      <osm version="0.6">
        <node id="1" lat="16.050" lon="108.200"/>
        <node id="2" lat="16.051" lon="108.201"/>
        <way id="902">
          <nd ref="1"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
          <tag k="maxheight:physical" v="3.5m"/>
          <tag k="maxwidth:physical" v="2.8m"/>
          <tag k="name" v="Verified Avenue"/>
        </way>
      </osm>
    `;

    const { graph, diagnostics } = importer.importXml(xmlFullyVerified);

    expect(diagnostics.unsupportedRestrictionsCount).toBe(0);
    expect(graph.isRestrictionStrictRoutingEligible).toBe(true);
    expect(graph.restrictionStrictRoutingReadiness).toBe('READY');

    expect(graph.edgeSafetySummary.verifiedCompatibleEdges).toBe(2);
    expect(graph.edgeSafetySummary.unverifiedEdges).toBe(0);
    expect(graph.edgeSafetySummary.strictSafeEdgesPercent).toBe(100.0);

    // Both restrictions and edges are verified -> READY!
    expect(graph.isStrictRoutingEligible).toBe(true);
    expect(graph.strictRoutingReadiness).toBe('READY');
    expect(graph.overallStrictRoutingReadiness).toBe('READY');
  });

  it('46. Regression 7: RoutingManifest reflects the exact same accounting and readiness metrics as BaseRoadGraph', () => {
    const outDir = path.join(__dirname, '..', 'output');
    const manifestPath = path.join(outDir, 'RoutingManifest.json');
    const graphJsonPath = path.join(outDir, 'BaseRoadGraph.json');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const graph = JSON.parse(fs.readFileSync(graphJsonPath, 'utf-8'));

    // Manifest matches BaseRoadGraph metrics identically
    expect(manifest.edgeSafetySummary.totalEdges).toBe(graph.edgeSafetySummary.totalEdges);
    expect(manifest.edgeSafetySummary.verifiedCompatibleEdges).toBe(graph.edgeSafetySummary.verifiedCompatibleEdges);
    expect(manifest.edgeSafetySummary.unverifiedEdges).toBe(graph.edgeSafetySummary.unverifiedEdges);
    expect(manifest.edgeSafetySummary.blockedEdges).toBe(graph.edgeSafetySummary.blockedEdges);
    expect(manifest.edgeSafetySummary.blockedWays).toBe(graph.edgeSafetySummary.blockedWays);
    expect(manifest.edgeSafetySummary.conflictedEdges).toBe(graph.edgeSafetySummary.conflictedEdges);
    expect(manifest.edgeSafetySummary.strictSafeEdgesPercent).toBe(graph.edgeSafetySummary.strictSafeEdgesPercent);

    expect(manifest.isRestrictionStrictRoutingEligible).toBe(graph.isRestrictionStrictRoutingEligible);
    expect(manifest.restrictionStrictRoutingReadiness).toBe(graph.restrictionStrictRoutingReadiness);
    expect(manifest.canAttemptStrictRouting).toBe(graph.canAttemptStrictRouting);
    expect(manifest.isStrictRoutingEligible).toBe(graph.isStrictRoutingEligible);
    expect(manifest.strictRoutingReadiness).toBe(graph.strictRoutingReadiness);
    expect(manifest.overallStrictRoutingReadiness).toBe(graph.overallStrictRoutingReadiness);
  });

  it('47. Regression 8: strictSafeEdgesPercent formula, denominator, and boundary values', () => {
    // 47.1 0 out of 50 verified -> 0%
    const { graph: gFixture } = importer.importXml(fixtureXml);
    expect(gFixture.edgeSafetySummary.totalEdges).toBe(50);
    expect(gFixture.edgeSafetySummary.verifiedCompatibleEdges).toBe(0);
    expect(gFixture.edgeSafetySummary.strictSafeEdgesPercent).toBe(0.0);

    // 47.2 2 out of 4 verified -> 50%
    const xmlMixed = `
      <osm version="0.6">
        <node id="1" lat="16.050" lon="108.200"/>
        <node id="2" lat="16.051" lon="108.201"/>
        <node id="3" lat="16.052" lon="108.202"/>
        <way id="910">
          <nd ref="1"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
          <tag k="maxheight:physical" v="3.5m"/>
          <tag k="maxwidth:physical" v="2.8m"/>
        </way>
        <way id="911">
          <nd ref="2"/><nd ref="3"/>
          <tag k="highway" v="primary"/>
        </way>
      </osm>
    `;
    const { graph: gMixed } = importer.importXml(xmlMixed);
    expect(gMixed.edgeSafetySummary.totalEdges).toBe(4);
    expect(gMixed.edgeSafetySummary.verifiedCompatibleEdges).toBe(2);
    expect(gMixed.edgeSafetySummary.unverifiedEdges).toBe(2);
    expect(gMixed.edgeSafetySummary.strictSafeEdgesPercent).toBe(50.0);

    // 47.3 Empty XML (0 edges) -> 0% (avoid NaN / division by zero)
    const xmlEmpty = `<osm version="0.6"></osm>`;
    const { graph: gEmpty } = importer.importXml(xmlEmpty);
    expect(gEmpty.edgeSafetySummary.totalEdges).toBe(0);
    expect(gEmpty.edgeSafetySummary.strictSafeEdgesPercent).toBe(0.0);
  });

  it('48. Section E.1: retainBlockedEdgesInGraph=false drops blocked ways, increases droppedWaysCount & excludedBlockedWaysCount', () => {
    const { graph, diagnostics } = importer.importXml(fixtureXml, {
      retainBlockedEdgesInGraph: false,
    });

    expect(diagnostics.blockedWaysCount).toBe(4);
    expect(diagnostics.excludedBlockedWaysCount).toBe(4);
    expect(diagnostics.retainedBlockedWaysCount).toBe(0);
    expect(diagnostics.blockedEdgesCount).toBe(0);
    expect(diagnostics.droppedWaysCount).toBeGreaterThanOrEqual(4);

    // Dropped items contains the 4 blocked ways (126: footway, 127: private, 128: height, 129: weight)
    const blockedWayIds = [126, 127, 128, 129];
    const blockedDropped = diagnostics.droppedItems.filter((d) => blockedWayIds.includes(d.id as number));
    expect(blockedDropped).toHaveLength(4);

    // Edges in graph contain 0 blocked edges
    expect(graph.edges.filter((e) => e.compatibilityStatus === 'BLOCKED')).toHaveLength(0);
  });

  it('49. Section E.2 & E.3: retainBlockedEdgesInGraph=true retains blocked ways; blockedWaysCount & retainedBlockedWaysCount increase, no BLOCKED in droppedItems', () => {
    const { graph, diagnostics } = importer.importXml(fixtureXml, {
      retainBlockedEdgesInGraph: true,
    });

    expect(diagnostics.blockedWaysCount).toBe(4);
    expect(diagnostics.retainedBlockedWaysCount).toBe(4);
    expect(diagnostics.excludedBlockedWaysCount).toBe(0);

    // Blocked ways are NOT dropped due to BLOCKED
    const blockedInDropped = diagnostics.droppedItems.filter(
      (d) => d.reason.includes('exceeds maxheight') || d.reason.includes('exceeds maxweight') || d.reason.includes('Vehicle profile disallow')
    );
    expect(blockedInDropped).toHaveLength(0);

    // Edges in graph now contain directed BLOCKED edges
    const blockedInGraph = graph.edges.filter((e) => e.compatibilityStatus === 'BLOCKED');
    expect(blockedInGraph.length).toBeGreaterThan(0);
    expect(diagnostics.blockedEdgesCount).toBe(blockedInGraph.length);
  });

  it('50. Section E.4 & E.5: Bidirectional BLOCKED way creates exactly two directed BLOCKED edges when retained, and blockedEdgesCount matches', () => {
    const xml = `
      <osm version="0.6">
        <node id="1" lat="16.050" lon="108.200"/>
        <node id="2" lat="16.051" lon="108.201"/>
        <way id="950">
          <nd ref="1"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
          <tag k="maxheight:physical" v="2.5m"/>
        </way>
      </osm>
    `;

    const { graph, diagnostics } = importer.importXml(xml, {
      retainBlockedEdgesInGraph: true,
    });

    expect(diagnostics.blockedWaysCount).toBe(1);
    expect(diagnostics.retainedBlockedWaysCount).toBe(1);
    expect(diagnostics.excludedBlockedWaysCount).toBe(0);
    expect(diagnostics.droppedWaysCount).toBe(0);

    // Exactly 2 directed edges created (forward and reverse)
    expect(graph.edges).toHaveLength(2);
    expect(diagnostics.blockedEdgesCount).toBe(2);
    expect(graph.edgeSafetySummary.blockedEdges).toBe(2);

    const fwd = graph.edges.find((e) => e.isWayForward)!;
    const rev = graph.edges.find((e) => !e.isWayForward)!;
    expect(fwd).toBeDefined();
    expect(rev).toBeDefined();

    expect(fwd.compatibilityStatus).toBe('BLOCKED');
    expect(rev.compatibilityStatus).toBe('BLOCKED');
    expect(fwd.isEligibleForStrictRouting).toBe(false);
    expect(rev.isEligibleForStrictRouting).toBe(false);
    expect(fwd.blockedReason).toContain('maxheight:physical (2.5m)');
    expect(rev.blockedReason).toContain('maxheight:physical (2.5m)');
  });

  it('51. Section E.6: Way evaluated as BLOCKED but having non-routable oneway is dropped with ONEWAY reason, not BLOCKED reason', () => {
    const xml = `
      <osm version="0.6">
        <node id="1" lat="16.050" lon="108.200"/>
        <node id="2" lat="16.051" lon="108.201"/>
        <way id="951">
          <nd ref="1"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
          <tag k="maxheight:physical" v="2.5m"/>
          <tag k="oneway" v="reversible"/>
        </way>
      </osm>
    `;

    const { graph, diagnostics } = importer.importXml(xml, {
      retainBlockedEdgesInGraph: true,
    });

    expect(diagnostics.blockedWaysCount).toBe(1);
    expect(diagnostics.excludedBlockedWaysCount).toBe(1);
    expect(diagnostics.retainedBlockedWaysCount).toBe(0);
    expect(diagnostics.droppedWaysCount).toBe(1);
    expect(diagnostics.blockedEdgesCount).toBe(0);
    expect(graph.edges).toHaveLength(0);

    // Reason must be oneway policy, not BLOCKED profile disallow
    expect(diagnostics.droppedItems).toHaveLength(1);
    expect(diagnostics.droppedItems[0].id).toBe(951);
    expect(diagnostics.droppedItems[0].reason).toContain('Reversible lane cannot be safely routed statically');
  });

  it('52. Section E.7: Graph with VERIFIED + BLOCKED, no UNVERIFIED edges and no unsupported restrictions is READY and canAttemptStrictRouting=true', () => {
    const xml = `
      <osm version="0.6">
        <node id="1" lat="16.050" lon="108.200"/>
        <node id="2" lat="16.051" lon="108.201"/>
        <node id="3" lat="16.052" lon="108.202"/>
        <way id="952">
          <nd ref="1"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
          <tag k="maxheight:physical" v="3.5m"/>
          <tag k="maxwidth:physical" v="2.8m"/>
        </way>
        <way id="953">
          <nd ref="2"/><nd ref="3"/>
          <tag k="highway" v="primary"/>
          <tag k="maxheight:physical" v="2.5m"/>
        </way>
      </osm>
    `;

    const { graph } = importer.importXml(xml, {
      retainBlockedEdgesInGraph: true,
    });

    expect(graph.edgeSafetySummary.verifiedCompatibleEdges).toBe(2);
    expect(graph.edgeSafetySummary.unverifiedEdges).toBe(0);
    expect(graph.edgeSafetySummary.blockedEdges).toBe(2);
    expect(graph.edgeSafetySummary.totalEdges).toBe(4);

    expect(graph.isRestrictionStrictRoutingEligible).toBe(true);
    expect(graph.restrictionStrictRoutingReadiness).toBe('READY');

    // New semantics:
    expect(graph.canAttemptStrictRouting).toBe(true);
    expect(graph.isStrictRoutingEligible).toBe(true);
    expect(graph.overallStrictRoutingReadiness).toBe('READY');
    expect(graph.strictRoutingReadiness).toBe('READY');
  });

  it('53. Section E.8: Graph with VERIFIED + UNVERIFIED + BLOCKED: canAttemptStrictRouting=true but overall readiness=NOT_READY_HAS_UNVERIFIED_EDGES', () => {
    const xml = `
      <osm version="0.6">
        <node id="1" lat="16.050" lon="108.200"/>
        <node id="2" lat="16.051" lon="108.201"/>
        <node id="3" lat="16.052" lon="108.202"/>
        <node id="4" lat="16.053" lon="108.203"/>
        <way id="961">
          <nd ref="1"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
          <tag k="maxheight:physical" v="3.5m"/>
          <tag k="maxwidth:physical" v="2.8m"/>
        </way>
        <way id="962">
          <nd ref="2"/><nd ref="3"/>
          <tag k="highway" v="primary"/>
        </way>
        <way id="963">
          <nd ref="3"/><nd ref="4"/>
          <tag k="highway" v="primary"/>
          <tag k="maxheight:physical" v="2.5m"/>
        </way>
      </osm>
    `;

    const { graph } = importer.importXml(xml, {
      retainBlockedEdgesInGraph: true,
    });

    expect(graph.edgeSafetySummary.verifiedCompatibleEdges).toBe(2);
    expect(graph.edgeSafetySummary.unverifiedEdges).toBe(2);
    expect(graph.edgeSafetySummary.blockedEdges).toBe(2);
    expect(graph.edgeSafetySummary.totalEdges).toBe(6);

    // Can attempt strict routing because there is a non-empty set of verified edges
    expect(graph.canAttemptStrictRouting).toBe(true);
    expect(graph.isStrictRoutingEligible).toBe(true);

    // But whole graph is NOT ready because there are unverified edges
    expect(graph.overallStrictRoutingReadiness).toBe('NOT_READY_HAS_UNVERIFIED_EDGES');
    expect(graph.strictRoutingReadiness).toBe('NOT_READY_HAS_UNVERIFIED_EDGES');
  });

  it('54. Section E.9: Graph with ONLY BLOCKED edges: canAttemptStrictRouting=false and overall readiness=NOT_READY_NO_VERIFIED_EDGES', () => {
    const xml = `
      <osm version="0.6">
        <node id="1" lat="16.050" lon="108.200"/>
        <node id="2" lat="16.051" lon="108.201"/>
        <way id="970">
          <nd ref="1"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
          <tag k="maxheight:physical" v="2.5m"/>
        </way>
      </osm>
    `;

    const { graph } = importer.importXml(xml, {
      retainBlockedEdgesInGraph: true,
    });

    expect(graph.edgeSafetySummary.verifiedCompatibleEdges).toBe(0);
    expect(graph.edgeSafetySummary.unverifiedEdges).toBe(0);
    expect(graph.edgeSafetySummary.blockedEdges).toBe(2);
    expect(graph.edgeSafetySummary.totalEdges).toBe(2);

    expect(graph.canAttemptStrictRouting).toBe(false);
    expect(graph.isStrictRoutingEligible).toBe(false);
    expect(graph.overallStrictRoutingReadiness).toBe('NOT_READY_NO_VERIFIED_EDGES');
    expect(graph.strictRoutingReadiness).toBe('NOT_READY_NO_VERIFIED_EDGES');
  });

  it('55. Section E.10: Manifest reflects exact states of BaseRoadGraph including canAttemptStrictRouting and detailed edge safety summary', () => {
    const outDir = path.join(__dirname, '..', 'output');
    const manifestPath = path.join(outDir, 'RoutingManifest.json');
    const graphJsonPath = path.join(outDir, 'BaseRoadGraph.json');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const graph = JSON.parse(fs.readFileSync(graphJsonPath, 'utf-8'));

    expect(manifest.canAttemptStrictRouting).toBe(graph.canAttemptStrictRouting);
    expect(manifest.isStrictRoutingEligible).toBe(graph.isStrictRoutingEligible);
    expect(manifest.overallStrictRoutingReadiness).toBe(graph.overallStrictRoutingReadiness);
    expect(manifest.strictRoutingReadiness).toBe(graph.strictRoutingReadiness);
    expect(manifest.edgeSafetySummary.blockedWays).toBe(graph.edgeSafetySummary.blockedWays);
    expect(manifest.edgeSafetySummary.excludedBlockedWays).toBe(graph.edgeSafetySummary.excludedBlockedWays);
    expect(manifest.edgeSafetySummary.retainedBlockedWays).toBe(graph.edgeSafetySummary.retainedBlockedWays);
  });

  it('56. Phase 2B.1.3.3: BLOCKED Way with valid geometry increments retainedBlockedWaysCount by 1', () => {
    const xml = `
      <osm version="0.6">
        <node id="1" lat="16.050" lon="108.200"/>
        <node id="2" lat="16.051" lon="108.201"/>
        <way id="980">
          <nd ref="1"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
          <tag k="maxheight:physical" v="2.5m"/>
          <tag k="oneway" v="yes"/>
        </way>
      </osm>
    `;

    const { graph, diagnostics } = importer.importXml(xml, {
      retainBlockedEdgesInGraph: true,
    });

    expect(diagnostics.blockedWaysCount).toBe(1);
    expect(diagnostics.retainedBlockedWaysCount).toBe(1);
    expect(diagnostics.excludedBlockedWaysCount).toBe(0);
    expect(diagnostics.blockedEdgesCount).toBe(1);
    expect(diagnostics.droppedWaysCount).toBe(0);
    expect(graph.edgeSafetySummary.retainedBlockedWays).toBe(1);
    expect(graph.edgeSafetySummary.excludedBlockedWays).toBe(0);
  });

  it('57. Phase 2B.1.3.3: BLOCKED Way where all segments have invalid geometry increments excluded count and records dropped reason', () => {
    const xml = `
      <osm version="0.6">
        <node id="1" lat="16.050" lon="108.200"/>
        <node id="2" lat="16.050" lon="108.200"/>
        <way id="981">
          <nd ref="1"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
          <tag k="maxheight:physical" v="2.5m"/>
        </way>
      </osm>
    `;

    const { graph, diagnostics } = importer.importXml(xml, {
      retainBlockedEdgesInGraph: true,
    });

    expect(diagnostics.blockedWaysCount).toBe(1);
    expect(diagnostics.retainedBlockedWaysCount).toBe(0);
    expect(diagnostics.excludedBlockedWaysCount).toBe(1);
    expect(diagnostics.blockedEdgesCount).toBe(0);
    expect(diagnostics.droppedWaysCount).toBe(1);
    expect(diagnostics.invalidGeometryCount).toBe(1);
    expect(graph.edges).toHaveLength(0);

    const droppedWay = diagnostics.droppedItems.find((d) => d.id === 981);
    expect(droppedWay).toBeDefined();
    expect(droppedWay?.type).toBe('way');
    expect(droppedWay?.reason).toBe('NO_VALID_DIRECTED_EDGES_INVALID_GEOMETRY');
  });

  it('58. Phase 2B.1.3.3: Bidirectional BLOCKED Way with valid geometry increments retained count exactly once despite creating 2 directed edges', () => {
    const xml = `
      <osm version="0.6">
        <node id="1" lat="16.050" lon="108.200"/>
        <node id="2" lat="16.051" lon="108.201"/>
        <way id="982">
          <nd ref="1"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
          <tag k="maxheight:physical" v="2.5m"/>
        </way>
      </osm>
    `;

    const { graph, diagnostics } = importer.importXml(xml, {
      retainBlockedEdgesInGraph: true,
    });

    expect(diagnostics.blockedWaysCount).toBe(1);
    expect(diagnostics.retainedBlockedWaysCount).toBe(1);
    expect(diagnostics.excludedBlockedWaysCount).toBe(0);
    expect(diagnostics.blockedEdgesCount).toBe(2);
    expect(diagnostics.droppedWaysCount).toBe(0);
    expect(graph.edges).toHaveLength(2);
  });

  it('59. Phase 2B.1.3.3: Way with one invalid segment and one valid segment is counted as retained and not excluded', () => {
    const xml = `
      <osm version="0.6">
        <node id="1" lat="16.050" lon="108.200"/>
        <node id="2" lat="16.050" lon="108.200"/>
        <node id="3" lat="16.055" lon="108.205"/>
        <node id="4" lat="16.060" lon="108.210"/>
        <way id="983">
          <nd ref="1"/><nd ref="2"/><nd ref="3"/>
          <tag k="highway" v="primary"/>
          <tag k="maxheight:physical" v="2.5m"/>
        </way>
        <way id="984">
          <nd ref="2"/><nd ref="4"/>
          <tag k="highway" v="primary"/>
        </way>
      </osm>
    `;

    const { graph, diagnostics } = importer.importXml(xml, {
      retainBlockedEdgesInGraph: true,
    });

    // Node 2 is an intersection between way 983 and way 984.
    // Way 983 is split into: [1, 2] (length 0 -> skipped) and [2, 3] (length > 0 -> creates edges).
    expect(diagnostics.invalidGeometryCount).toBeGreaterThanOrEqual(1);

    // Way 983 was BLOCKED and retained because it produced edges for [2, 3]
    const way983Edges = graph.edges.filter((e) => e.osmWayId === 983);
    expect(way983Edges.length).toBeGreaterThan(0);

    // Blocked ways count = 1 (way 983)
    expect(diagnostics.blockedWaysCount).toBe(1);
    expect(diagnostics.retainedBlockedWaysCount).toBe(1);
    expect(diagnostics.excludedBlockedWaysCount).toBe(0);

    // Way 983 is not in droppedItems
    const dropped983 = diagnostics.droppedItems.find((d) => d.id === 983);
    expect(dropped983).toBeUndefined();
  });

  it('60. Phase 2B.1.3.3: Verify droppedItems and droppedWaysCount are consistent without duplicate records', () => {
    const xml = `
      <osm version="0.6">
        <node id="1" lat="16.050" lon="108.200"/>
        <node id="2" lat="16.051" lon="108.201"/>
        <node id="3" lat="16.052" lon="108.202"/>
        <node id="4" lat="16.052" lon="108.202"/>
        <node id="5" lat="16.054" lon="108.204"/>

        <!-- Way 991: missing node ref 9999 -->
        <way id="991">
          <nd ref="1"/><nd ref="9999"/>
          <tag k="highway" v="primary"/>
        </way>

        <!-- Way 992: non-routable oneway -->
        <way id="992">
          <nd ref="1"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
          <tag k="oneway" v="reversible"/>
        </way>

        <!-- Way 993: all segments invalid geometry (identical coords) -->
        <way id="993">
          <nd ref="3"/><nd ref="4"/>
          <tag k="highway" v="primary"/>
        </way>

        <!-- Way 994: valid routable way -->
        <way id="994">
          <nd ref="1"/><nd ref="5"/>
          <tag k="highway" v="primary"/>
        </way>
      </osm>
    `;

    const { graph, diagnostics } = importer.importXml(xml, {
      retainBlockedEdgesInGraph: true,
    });

    const droppedWayItems = diagnostics.droppedItems.filter((d) => d.type === 'way');
    expect(diagnostics.droppedWaysCount).toBe(droppedWayItems.length);

    // Verify all dropped way IDs are unique (no double counting!)
    const droppedWayIds = droppedWayItems.map((d) => d.id);
    const uniqueDroppedWayIds = new Set(droppedWayIds);
    expect(droppedWayIds.length).toBe(uniqueDroppedWayIds.size);

    // Way 994 must NOT be dropped
    expect(uniqueDroppedWayIds.has(994)).toBe(false);
    expect(graph.edges.some((e) => e.osmWayId === 994)).toBe(true);
  });

  it('61. Phase 2B.1.3.3: Verify mathematical invariants hold across both retainBlockedEdgesInGraph modes', () => {
    // Mode A: retainBlockedEdgesInGraph = false
    const resA = importer.importXml(fixtureXml, { retainBlockedEdgesInGraph: false });
    expect(resA.diagnostics.blockedWaysCount).toBe(
      resA.diagnostics.excludedBlockedWaysCount + resA.diagnostics.retainedBlockedWaysCount
    );
    expect(resA.graph.edgeSafetySummary.totalEdges).toBe(
      resA.diagnostics.verifiedCompatibleEdgesCount +
      resA.diagnostics.unverifiedEdgesCount +
      resA.diagnostics.blockedEdgesCount
    );
    expect(resA.diagnostics.retainedBlockedWaysCount).toBe(0);
    expect(resA.diagnostics.blockedEdgesCount).toBe(0);

    // Mode B: retainBlockedEdgesInGraph = true
    const resB = importer.importXml(fixtureXml, { retainBlockedEdgesInGraph: true });
    expect(resB.diagnostics.blockedWaysCount).toBe(
      resB.diagnostics.excludedBlockedWaysCount + resB.diagnostics.retainedBlockedWaysCount
    );
    expect(resB.graph.edgeSafetySummary.totalEdges).toBe(
      resB.diagnostics.verifiedCompatibleEdgesCount +
      resB.diagnostics.unverifiedEdgesCount +
      resB.diagnostics.blockedEdgesCount
    );
    expect(resB.diagnostics.retainedBlockedWaysCount).toBe(4);
    expect(resB.diagnostics.excludedBlockedWaysCount).toBe(0);
  });

  // --- Phase 2B.2.1: Add Real OSM Snapshot Mode to Importer CLI ---

  it('62. Phase 2B.2.1: Calling runCli() without args defaults to FIXTURE mode with fixture outputs and manifest', () => {
    const { manifest, result } = runCli();
    expect(manifest.boundingBoxType).toBe('FIXTURE');
    expect(manifest.fixtureGeneratedAt).toBe('2026-11-03T16:45:00.000Z');
    expect(manifest.osmSnapshotTimestamp).toBe('2024-11-01T00:00:00.000Z');
    expect(manifest.graphVersion).toBe('dn_central_fixture_v2');
    expect(result.graph.graphVersion).toBe('dn_central_fixture_v2');
    expect(result.graph.boundingBox).toEqual(FIXTURE_BOUNDING_BOX);
  });

  it('63. Phase 2B.2.1: REAL_OSM_SNAPSHOT mode uses DA_NANG_CENTRAL_PRODUCTION_BOUNDING_BOX', () => {
    const realFixturePath = path.join(__dirname, '..', 'fixtures', 'test_real_snapshot.osm.xml');
    const realOutputDir = path.join(__dirname, '..', 'output-real');
    const { manifest, result } = runCli({
      mode: 'REAL_OSM_SNAPSHOT',
      inputPath: realFixturePath,
      outputDir: realOutputDir,
    });

    expect(manifest.boundingBoxType).toBe('PRODUCTION');
    expect(manifest.boundingBox).toEqual(DA_NANG_CENTRAL_PRODUCTION_BOUNDING_BOX);
    expect(manifest.targetProductionBoundingBox).toEqual(DA_NANG_CENTRAL_PRODUCTION_BOUNDING_BOX);
    expect(result.graph.boundingBox).toEqual(DA_NANG_CENTRAL_PRODUCTION_BOUNDING_BOX);

    expect(manifest.boundingBox!.minLon).toBe(108.1900);
    expect(manifest.boundingBox!.minLat).toBe(16.0350);
    expect(manifest.boundingBox!.maxLon).toBe(108.2350);
    expect(manifest.boundingBox!.maxLat).toBe(16.0750);
    expect(manifest.boundingBox!.bufferedMeters).toBe(500.0);
  });

  it('64. Phase 2B.2.1: REAL_OSM_SNAPSHOT mode omits fixtureGeneratedAt completely from Graph and Manifest', () => {
    const realFixturePath = path.join(__dirname, '..', 'fixtures', 'test_real_snapshot.osm.xml');
    const realOutputDir = path.join(__dirname, '..', 'output-real');
    const { manifest, result } = runCli({
      mode: 'REAL_OSM_SNAPSHOT',
      inputPath: realFixturePath,
      outputDir: realOutputDir,
    });

    expect(result.graph.fixtureGeneratedAt).toBeUndefined();
    expect(manifest.fixtureGeneratedAt).toBeUndefined();

    // Verify raw file content does NOT contain "fixtureGeneratedAt"
    const graphJson = JSON.parse(fs.readFileSync(path.join(realOutputDir, 'BaseRoadGraph.json'), 'utf-8'));
    const manifestJson = JSON.parse(fs.readFileSync(path.join(realOutputDir, 'RoutingManifest.json'), 'utf-8'));

    expect('fixtureGeneratedAt' in graphJson).toBe(false);
    expect('fixtureGeneratedAt' in manifestJson).toBe(false);
  });

  it('65. Phase 2B.2.1: Importer parses osm_base from Overpass XML meta tag correctly', () => {
    const xml = `
      <osm version="0.6" generator="Overpass API">
        <note>OSM Overpass query result</note>
        <meta osm_base="2026-11-04T12:34:56Z"/>
        <node id="1" lat="16.050" lon="108.200"/>
        <node id="2" lat="16.051" lon="108.201"/>
        <way id="101">
          <nd ref="1"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
        </way>
      </osm>
    `;

    const { graph } = importer.importXml(xml, { mode: 'REAL_OSM_SNAPSHOT' });
    expect(graph.osmSnapshotTimestamp).toBe('2026-11-04T12:34:56Z');
  });

  it('66. Phase 2B.2.1: Explicit osmSnapshotTimestamp takes highest priority over Overpass meta and root timestamp', () => {
    const xml = `
      <osm version="0.6" timestamp="2025-01-01T00:00:00Z">
        <meta osm_base="2026-11-04T12:34:56Z"/>
        <node id="1" lat="16.050" lon="108.200"/>
        <node id="2" lat="16.051" lon="108.201"/>
        <way id="101">
          <nd ref="1"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
        </way>
      </osm>
    `;

    // 1. Explicit timestamp overrides both
    const explicitTimestamp = '2026-12-01T08:00:00.000Z';
    const { graph: gExplicit } = importer.importXml(xml, {
      mode: 'REAL_OSM_SNAPSHOT',
      osmSnapshotTimestamp: explicitTimestamp,
    });
    expect(gExplicit.osmSnapshotTimestamp).toBe(explicitTimestamp);

    // 2. Without explicit, Overpass meta takes priority over root timestamp
    const { graph: gOverpass } = importer.importXml(xml, { mode: 'REAL_OSM_SNAPSHOT' });
    expect(gOverpass.osmSnapshotTimestamp).toBe('2026-11-04T12:34:56Z');
  });

  it('67. Phase 2B.2.1: REAL_OSM_SNAPSHOT fails with descriptive error if XML lacks osm_base and root timestamp', () => {
    const xmlWithoutTimestamp = `
      <osm version="0.6">
        <node id="1" lat="16.050" lon="108.200"/>
        <node id="2" lat="16.051" lon="108.201"/>
        <way id="101">
          <nd ref="1"/><nd ref="2"/>
          <tag k="highway" v="primary"/>
        </way>
      </osm>
    `;

    // Must fail in importXml
    expect(() =>
      importer.importXml(xmlWithoutTimestamp, { mode: 'REAL_OSM_SNAPSHOT' })
    ).toThrow('Missing valid OSM snapshot timestamp in REAL_OSM_SNAPSHOT mode');

    // Also fails if requireValidOsmTimestamp is explicitly set
    expect(() =>
      importer.importXml(xmlWithoutTimestamp, { requireValidOsmTimestamp: true })
    ).toThrow('Missing valid OSM snapshot timestamp in REAL_OSM_SNAPSHOT mode');
  });

  it('68. Phase 2B.2.1: RoutingManifest records boundingBoxType PRODUCTION and targetProductionBoundingBox', () => {
    const realFixturePath = path.join(__dirname, '..', 'fixtures', 'test_real_snapshot.osm.xml');
    const realOutputDir = path.join(__dirname, '..', 'output-real');
    const { manifest } = runCli({
      mode: 'REAL_OSM_SNAPSHOT',
      inputPath: realFixturePath,
      outputDir: realOutputDir,
    });

    expect(manifest.manifestVersion).toBe('2.1.0');
    expect(manifest.boundingBoxType).toBe('PRODUCTION');
    expect(manifest.targetProductionBoundingBox).toEqual(DA_NANG_CENTRAL_PRODUCTION_BOUNDING_BOX);
    expect(manifest.osmSnapshotTimestamp).toBe('2026-11-04T12:34:56Z');
  });

  it('69. Phase 2B.2.1: REAL_OSM_SNAPSHOT output does not overwrite FIXTURE output directory', () => {
    const fixtureOutputDir = path.join(__dirname, '..', 'output');
    const realOutputDir = path.join(__dirname, '..', 'output-real');
    const realFixturePath = path.join(__dirname, '..', 'fixtures', 'test_real_snapshot.osm.xml');

    // 1. Run FIXTURE
    runCli();
    expect(fs.existsSync(path.join(fixtureOutputDir, 'RoutingManifest.json'))).toBe(true);
    const fixtureManifest = JSON.parse(fs.readFileSync(path.join(fixtureOutputDir, 'RoutingManifest.json'), 'utf-8'));
    expect(fixtureManifest.boundingBoxType).toBe('FIXTURE');
    expect(fixtureManifest.fixtureGeneratedAt).toBe('2026-11-03T16:45:00.000Z');

    // 2. Run REAL_OSM_SNAPSHOT
    runCli({
      mode: 'REAL_OSM_SNAPSHOT',
      inputPath: realFixturePath,
      outputDir: realOutputDir,
    });
    expect(fs.existsSync(path.join(realOutputDir, 'RoutingManifest.json'))).toBe(true);
    const realManifest = JSON.parse(fs.readFileSync(path.join(realOutputDir, 'RoutingManifest.json'), 'utf-8'));
    expect(realManifest.boundingBoxType).toBe('PRODUCTION');
    expect(realManifest.fixtureGeneratedAt).toBeUndefined();

    // 3. Verify FIXTURE manifest is preserved intact and untouched
    const fixtureManifestAfter = JSON.parse(fs.readFileSync(path.join(fixtureOutputDir, 'RoutingManifest.json'), 'utf-8'));
    expect(fixtureManifestAfter.boundingBoxType).toBe('FIXTURE');
    expect(fixtureManifestAfter.fixtureGeneratedAt).toBe('2026-11-03T16:45:00.000Z');
  });

  it('70. Phase 2B.2.1: Backward compatibility of runCli with custom string paths and CLI argument parsing', () => {
    const fixturePath = path.join(__dirname, '..', 'fixtures', 'test_fixture.osm.xml');
    const customOut = path.join(__dirname, '..', 'output-custom-test');

    // String argument legacy signature
    const { manifest } = runCli(fixturePath, customOut);
    expect(manifest.boundingBoxType).toBe('FIXTURE');
    expect(fs.existsSync(path.join(customOut, 'BaseRoadGraph.json'))).toBe(true);

    // Clean up temporary test output dir
    fs.rmSync(customOut, { recursive: true, force: true });

    // parseCliArgs tests
    const args1 = parseCliArgs(['--mode=real', '--input=input.xml', '--output=out-dir']);
    expect(args1.mode).toBe('REAL_OSM_SNAPSHOT');
    expect(args1.inputPath).toBe('input.xml');
    expect(args1.outputDir).toBe('out-dir');

    const args2 = parseCliArgs(['--mode=fixture']);
    expect(args2.mode).toBe('FIXTURE');

    const args3 = parseCliArgs([]);
    expect(args3.mode).toBeUndefined();

    // Invalid mode error
    expect(() => parseCliArgs(['--mode=unknown_mode'])).toThrow('Invalid CLI mode: "unknown_mode"');

    // Missing input file error
    expect(() => runCli({ mode: 'REAL_OSM_SNAPSHOT', inputPath: 'non_existent_file.xml' })).toThrow('Input file not found');
  });

  it('71. Phase 2B.2.1: Graph version and snapshot timestamp are recorded consistently between Graph and Manifest', () => {
    const realFixturePath = path.join(__dirname, '..', 'fixtures', 'test_real_snapshot.osm.xml');
    const realOutputDir = path.join(__dirname, '..', 'output-real');
    const { manifest, result } = runCli({
      mode: 'REAL_OSM_SNAPSHOT',
      inputPath: realFixturePath,
      outputDir: realOutputDir,
      graphVersion: 'dn_central_custom_v99',
    });

    expect(manifest.graphVersion).toBe('dn_central_custom_v99');
    expect(result.graph.graphVersion).toBe('dn_central_custom_v99');
    expect(manifest.osmSnapshotTimestamp).toBe('2026-11-04T12:34:56Z');
    expect(result.graph.osmSnapshotTimestamp).toBe('2026-11-04T12:34:56Z');
  });

  // --- Phase 2B.2.1.1: Validate OSM Snapshot Timestamps ---

  it('72. Phase 2B.2.1.1: Accepts valid RFC 3339 timestamp with Z', () => {
    const validTs = '2026-11-04T12:34:56Z';
    expect(isValidIso8601Timestamp(validTs)).toBe(true);

    const xml = `
      <osm version="0.6">
        <meta osm_base="${validTs}"/>
        <node id="1" lat="16.0" lon="108.0"/>
      </osm>
    `;
    const { graph } = importer.importXml(xml, { mode: 'REAL_OSM_SNAPSHOT' });
    expect(graph.osmSnapshotTimestamp).toBe(validTs);
  });

  it('73. Phase 2B.2.1.1: Accepts valid timestamp with fractional milliseconds', () => {
    const validTs = '2026-11-04T12:34:56.123Z';
    expect(isValidIso8601Timestamp(validTs)).toBe(true);

    const xml = `
      <osm version="0.6">
        <meta osm_base="${validTs}"/>
        <node id="1" lat="16.0" lon="108.0"/>
      </osm>
    `;
    const { graph } = importer.importXml(xml, { mode: 'REAL_OSM_SNAPSHOT' });
    expect(graph.osmSnapshotTimestamp).toBe(validTs);
  });

  it('74. Phase 2B.2.1.1: Accepts valid timestamp with positive and negative timezone offsets', () => {
    const plusOffset = '2026-11-04T19:34:56+07:00';
    const minusOffset = '2026-11-04T07:34:56-05:00';

    expect(isValidIso8601Timestamp(plusOffset)).toBe(true);
    expect(isValidIso8601Timestamp(minusOffset)).toBe(true);

    const xml = `
      <osm version="0.6">
        <meta osm_base="${plusOffset}"/>
        <node id="1" lat="16.0" lon="108.0"/>
      </osm>
    `;
    const { graph } = importer.importXml(xml, { mode: 'REAL_OSM_SNAPSHOT' });
    expect(graph.osmSnapshotTimestamp).toBe(plusOffset);
  });

  it('75. Phase 2B.2.1.1: Rejects explicit timestamp with invalid format even if XML has valid osm_base', () => {
    const xml = `
      <osm version="0.6">
        <meta osm_base="2026-11-04T12:34:56Z"/>
        <node id="1" lat="16.0" lon="108.0"/>
      </osm>
    `;

    expect(() =>
      importer.importXml(xml, {
        mode: 'REAL_OSM_SNAPSHOT',
        osmSnapshotTimestamp: 'invalid-explicit-timestamp',
      })
    ).toThrow('Explicit osmSnapshotTimestamp "invalid-explicit-timestamp" is invalid');
  });

  it('76. Phase 2B.2.1.1: Falls back to valid root timestamp when osm_base is invalid', () => {
    const xml = `
      <osm version="0.6" timestamp="2026-11-04T10:00:00Z">
        <meta osm_base="invalid-meta-osm-base"/>
        <node id="1" lat="16.0" lon="108.0"/>
      </osm>
    `;

    const { graph } = importer.importXml(xml, { mode: 'REAL_OSM_SNAPSHOT' });
    expect(graph.osmSnapshotTimestamp).toBe('2026-11-04T10:00:00Z');
  });

  it('77. Phase 2B.2.1.1: Fails in REAL mode when both root timestamp and osm_base are invalid', () => {
    const xml = `
      <osm version="0.6" timestamp="bad-root-time">
        <meta osm_base="bad-meta-time"/>
        <node id="1" lat="16.0" lon="108.0"/>
      </osm>
    `;

    expect(() =>
      importer.importXml(xml, { mode: 'REAL_OSM_SNAPSHOT' })
    ).toThrow('Missing valid OSM snapshot timestamp in REAL_OSM_SNAPSHOT mode');
  });

  it('78. Phase 2B.2.1.1: Rejects impossible calendar dates (non-leap year Feb 29, Feb 30, April 31)', () => {
    expect(isValidIso8601Timestamp('2026-02-30T12:00:00Z')).toBe(false);
    expect(isValidIso8601Timestamp('2026-02-29T12:00:00Z')).toBe(false); // 2026 is not a leap year
    expect(isValidIso8601Timestamp('2024-02-29T12:00:00Z')).toBe(true);  // 2024 is a leap year
    expect(isValidIso8601Timestamp('2026-04-31T12:00:00Z')).toBe(false); // April has 30 days
    expect(isValidIso8601Timestamp('2026-06-31T12:00:00Z')).toBe(false); // June has 30 days
    expect(isValidIso8601Timestamp('2026-09-31T12:00:00Z')).toBe(false); // September has 30 days
    expect(isValidIso8601Timestamp('2026-11-31T12:00:00Z')).toBe(false); // November has 30 days

    expect(() =>
      importer.importXml('<osm version="0.6"><node id="1" lat="16.0" lon="108.0"/></osm>', {
        mode: 'REAL_OSM_SNAPSHOT',
        osmSnapshotTimestamp: '2026-02-30T12:00:00Z',
      })
    ).toThrow('Explicit osmSnapshotTimestamp "2026-02-30T12:00:00Z" is invalid');
  });

  it('79. Phase 2B.2.1.1: Rejects out-of-range month 13 or month 00', () => {
    expect(isValidIso8601Timestamp('2026-13-01T12:00:00Z')).toBe(false);
    expect(isValidIso8601Timestamp('2026-00-01T12:00:00Z')).toBe(false);

    expect(() =>
      importer.importXml('<osm version="0.6"><node id="1" lat="16.0" lon="108.0"/></osm>', {
        mode: 'REAL_OSM_SNAPSHOT',
        osmSnapshotTimestamp: '2026-13-01T12:00:00Z',
      })
    ).toThrow('Explicit osmSnapshotTimestamp "2026-13-01T12:00:00Z" is invalid');
  });

  it('80. Phase 2B.2.1.1: Rejects out-of-range hour 25:00, minute 60, second 60, or invalid timezone offset', () => {
    expect(isValidIso8601Timestamp('2026-11-04T25:00:00Z')).toBe(false);
    expect(isValidIso8601Timestamp('2026-11-04T12:60:00Z')).toBe(false);
    expect(isValidIso8601Timestamp('2026-11-04T12:34:60Z')).toBe(false);
    expect(isValidIso8601Timestamp('2026-11-04T12:34:56+25:00')).toBe(false);
    expect(isValidIso8601Timestamp('2026-11-04T12:34:56+07:60')).toBe(false);

    expect(() =>
      importer.importXml('<osm version="0.6"><node id="1" lat="16.0" lon="108.0"/></osm>', {
        mode: 'REAL_OSM_SNAPSHOT',
        osmSnapshotTimestamp: '2026-11-04T25:00:00Z',
      })
    ).toThrow('Explicit osmSnapshotTimestamp "2026-11-04T25:00:00Z" is invalid');
  });

  it('81. Phase 2B.2.1.1: Rejects empty strings, plain text, and timestamps missing timezone', () => {
    expect(isValidIso8601Timestamp('')).toBe(false);
    expect(isValidIso8601Timestamp('   ')).toBe(false);
    expect(isValidIso8601Timestamp('not-a-timestamp')).toBe(false);
    expect(isValidIso8601Timestamp('2026-11-04T12:34:56')).toBe(false); // Missing Z or offset
    expect(isValidIso8601Timestamp('2026-11-04 12:34:56Z')).toBe(false); // Space instead of T
    expect(isValidIso8601Timestamp(null)).toBe(false);
    expect(isValidIso8601Timestamp(undefined)).toBe(false);
    expect(isValidIso8601Timestamp(123456789)).toBe(false);

    expect(() =>
      importer.importXml('<osm version="0.6"><node id="1" lat="16.0" lon="108.0"/></osm>', {
        mode: 'REAL_OSM_SNAPSHOT',
        osmSnapshotTimestamp: '2026-11-04T12:34:56',
      })
    ).toThrow('Explicit osmSnapshotTimestamp "2026-11-04T12:34:56" is invalid');
  });

  it('82. Phase 2B.2.1.1: FIXTURE mode remains compatible with default fixture timestamp', () => {
    const { graph } = importer.importXml(fixtureXml);
    expect(isValidIso8601Timestamp(graph.osmSnapshotTimestamp!)).toBe(true);
    expect(graph.osmSnapshotTimestamp).toBe('2024-11-01T00:00:00.000Z');
  });

  it('83. Parse relation 20658849: inline conditional restriction parses as NO_LEFT_TURN, FAIL_CLOSED_UNRESOLVED in strict mode', () => {
    const rawRelation: RawOsmRelation = {
      id: 20658849,
      tags: {
        type: 'restriction',
        restriction: 'no_left_turn @ (6:30-8:30,16:00-19:00)',
      },
      members: [
        { type: 'way', ref: 101, role: 'from', order: 0 },
        { type: 'node', ref: 201, role: 'via', order: 1 },
        { type: 'way', ref: 102, role: 'to', order: 2 },
      ],
    };

    const parsed = parseTurnRestrictionRelation(rawRelation);
    expect(parsed).not.toBeNull();
    expect(parsed!.id).toBe('rel_osm_20658849');
    expect(parsed!.type).toBe('NO_LEFT_TURN');
    expect(parsed!.conditionalExpression).toBe('no_left_turn @ (6:30-8:30,16:00-19:00)');
    expect(parsed!.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
    expect(parsed!.isExemptForProfile).toBe(false);
  });

  it('84. Parse relation 20682307: inline conditional restriction parses as NO_LEFT_TURN, FAIL_CLOSED_UNRESOLVED in strict mode', () => {
    const rawRelation: RawOsmRelation = {
      id: 20682307,
      tags: {
        type: 'restriction',
        restriction: 'no_left_turn @ (06:30-08:00,16:00-19:00)',
      },
      members: [
        { type: 'way', ref: 301, role: 'from', order: 0 },
        { type: 'node', ref: 401, role: 'via', order: 1 },
        { type: 'way', ref: 302, role: 'to', order: 2 },
      ],
    };

    const parsed = parseTurnRestrictionRelation(rawRelation);
    expect(parsed).not.toBeNull();
    expect(parsed!.id).toBe('rel_osm_20682307');
    expect(parsed!.type).toBe('NO_LEFT_TURN');
    expect(parsed!.conditionalExpression).toBe('no_left_turn @ (06:30-08:00,16:00-19:00)');
    expect(parsed!.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
    expect(parsed!.isExemptForProfile).toBe(false);
  });

  it('85. Inline conditional restriction in non-strict mode sets UNVERIFIED_WARNING', () => {
    const rawRelation: RawOsmRelation = {
      id: 20658849,
      tags: {
        type: 'restriction',
        restriction: 'no_left_turn @ (6:30-8:30,16:00-19:00)',
      },
      members: [
        { type: 'way', ref: 101, role: 'from', order: 0 },
        { type: 'node', ref: 201, role: 'via', order: 1 },
        { type: 'way', ref: 102, role: 'to', order: 2 },
      ],
    };

    const parsed = parseTurnRestrictionRelation(rawRelation, { strictRescueMode: false });
    expect(parsed).not.toBeNull();
    expect(parsed!.supportStatus).toBe('UNVERIFIED_WARNING');
  });

  it('86. Standard restriction:conditional tag priority is preserved over regular restriction tag', () => {
    const rawRelation: RawOsmRelation = {
      id: 9991,
      tags: {
        type: 'restriction',
        restriction: 'no_left_turn',
        'restriction:conditional': 'no_left_turn @ (Mo-Fr 07:00-09:00)',
      },
      members: [
        { type: 'way', ref: 101, role: 'from', order: 0 },
        { type: 'node', ref: 201, role: 'via', order: 1 },
        { type: 'way', ref: 102, role: 'to', order: 2 },
      ],
    };

    const parsed = parseTurnRestrictionRelation(rawRelation);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('NO_LEFT_TURN');
    expect(parsed!.conditionalExpression).toBe('no_left_turn @ (Mo-Fr 07:00-09:00)');
    expect(parsed!.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
  });

  it('87. Regular unconditional restriction maintains FULLY_SUPPORTED and conditionalExpression is null', () => {
    const rawRelation: RawOsmRelation = {
      id: 9992,
      tags: {
        type: 'restriction',
        restriction: 'no_left_turn',
      },
      members: [
        { type: 'way', ref: 101, role: 'from', order: 0 },
        { type: 'node', ref: 201, role: 'via', order: 1 },
        { type: 'way', ref: 102, role: 'to', order: 2 },
      ],
    };

    const parsed = parseTurnRestrictionRelation(rawRelation);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('NO_LEFT_TURN');
    expect(parsed!.conditionalExpression).toBeNull();
    expect(parsed!.supportStatus).toBe('FULLY_SUPPORTED');
  });

  it('88. Malformed inline conditional restrictions return null', () => {
    const members: OsmRelationMember[] = [
      { type: 'way', ref: 101, role: 'from', order: 0 },
      { type: 'node', ref: 201, role: 'via', order: 1 },
      { type: 'way', ref: 102, role: 'to', order: 2 },
    ];

    // Missing condition after @
    expect(
      parseTurnRestrictionRelation({
        id: 1001,
        tags: { type: 'restriction', restriction: 'no_left_turn @' },
        members,
      })
    ).toBeNull();

    // Whitespace only after @
    expect(
      parseTurnRestrictionRelation({
        id: 1002,
        tags: { type: 'restriction', restriction: 'no_left_turn @   ' },
        members,
      })
    ).toBeNull();

    // Missing token before @
    expect(
      parseTurnRestrictionRelation({
        id: 1003,
        tags: { type: 'restriction', restriction: '@ (06:30-08:00)' },
        members,
      })
    ).toBeNull();

    // Unknown token before @
    expect(
      parseTurnRestrictionRelation({
        id: 1004,
        tags: { type: 'restriction', restriction: 'unknown_restriction @ (06:30-08:00)' },
        members,
      })
    ).toBeNull();

    // Not a valid restriction string at all
    expect(
      parseTurnRestrictionRelation({
        id: 1005,
        tags: { type: 'restriction', restriction: 'not_a_valid_restriction' },
        members,
      })
    ).toBeNull();

    // Mode-scoped malformed inline conditional
    expect(
      parseTurnRestrictionRelation({
        id: 1006,
        tags: { type: 'restriction', 'restriction:motorcar': 'no_left_turn @' },
        members,
      })
    ).toBeNull();

    // Mode-scoped unknown restriction
    expect(
      parseTurnRestrictionRelation({
        id: 1007,
        tags: { type: 'restriction', 'restriction:motorcar': 'unknown_turn' },
        members,
      })
    ).toBeNull();
  });

  it('89. Integration: importXml handles relations 20658849 and 20682307 with FAIL_CLOSED_UNRESOLVED and increments diagnostics', () => {
    const testXml = `
      <osm version="0.6">
        <node id="1001" lat="16.050" lon="108.200"/>
        <node id="1002" lat="16.051" lon="108.201"/>
        <node id="1003" lat="16.052" lon="108.202"/>
        <node id="1004" lat="16.053" lon="108.203"/>
        <way id="2001">
          <nd ref="1001"/><nd ref="1002"/>
          <tag k="highway" v="primary"/>
        </way>
        <way id="2002">
          <nd ref="1002"/><nd ref="1003"/>
          <tag k="highway" v="primary"/>
        </way>
        <way id="2003">
          <nd ref="1002"/><nd ref="1004"/>
          <tag k="highway" v="primary"/>
        </way>
        <relation id="20658849">
          <tag k="type" v="restriction"/>
          <tag k="restriction" v="no_left_turn @ (6:30-8:30,16:00-19:00)"/>
          <member type="way" ref="2001" role="from"/>
          <member type="node" ref="1002" role="via"/>
          <member type="way" ref="2002" role="to"/>
        </relation>
        <relation id="20682307">
          <tag k="type" v="restriction"/>
          <tag k="restriction" v="no_left_turn @ (06:30-08:00,16:00-19:00)"/>
          <member type="way" ref="2001" role="from"/>
          <member type="node" ref="1002" role="via"/>
          <member type="way" ref="2003" role="to"/>
        </relation>
      </osm>
    `;

    const { graph, diagnostics } = importer.importXml(testXml);
    expect(diagnostics.turnRestrictionsRead).toBe(2);
    expect(diagnostics.unsupportedRestrictionsCount).toBe(2);
    expect(graph.turnRestrictions.length).toBe(2);

    const rel1 = graph.turnRestrictions.find((r) => r.id === 'rel_osm_20658849');
    expect(rel1).toBeDefined();
    expect(rel1!.type).toBe('NO_LEFT_TURN');
    expect(rel1!.conditionalExpression).toBe('no_left_turn @ (6:30-8:30,16:00-19:00)');
    expect(rel1!.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');

    const rel2 = graph.turnRestrictions.find((r) => r.id === 'rel_osm_20682307');
    expect(rel2).toBeDefined();
    expect(rel2!.type).toBe('NO_LEFT_TURN');
    expect(rel2!.conditionalExpression).toBe('no_left_turn @ (06:30-08:00,16:00-19:00)');
    expect(rel2!.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
  });

  it('90. Mode-scoped restriction with inline conditional parses type, restrictionMode, and conditionalExpression', () => {
    const rawRelation: RawOsmRelation = {
      id: 9993,
      tags: {
        type: 'restriction',
        'restriction:motorcar': 'no_left_turn @ (07:00-09:00)',
      },
      members: [
        { type: 'way', ref: 101, role: 'from', order: 0 },
        { type: 'node', ref: 201, role: 'via', order: 1 },
        { type: 'way', ref: 102, role: 'to', order: 2 },
      ],
    };

    const parsed = parseTurnRestrictionRelation(rawRelation);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('NO_LEFT_TURN');
    expect(parsed!.restrictionMode).toBe('motorcar');
    expect(parsed!.conditionalExpression).toBe('no_left_turn @ (07:00-09:00)');
    expect(parsed!.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
  });

  it('91. Task 91 Case A: Valid restriction:conditional with inline malformed restriction parses as NO_RIGHT_TURN and FAIL_CLOSED_UNRESOLVED', () => {
    const rawRelation: RawOsmRelation = {
      id: 9101,
      tags: {
        type: 'restriction',
        restriction: 'no_left_turn @',
        'restriction:conditional': 'no_right_turn @ (Mo-Fr 07:00-09:00)',
      },
      members: [
        { type: 'way', ref: 101, role: 'from', order: 0 },
        { type: 'node', ref: 201, role: 'via', order: 1 },
        { type: 'way', ref: 102, role: 'to', order: 2 },
      ],
    };

    const parsed = parseTurnRestrictionRelation(rawRelation);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('NO_RIGHT_TURN');
    expect(parsed!.conditionalExpression).toBe('no_right_turn @ (Mo-Fr 07:00-09:00)');
    expect(parsed!.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
  });

  it('92. Task 91 Case B: Valid restriction:conditional with inline restriction having unrecognized token prioritizes standard conditional', () => {
    const rawRelation: RawOsmRelation = {
      id: 9102,
      tags: {
        type: 'restriction',
        restriction: 'unknown_restriction @ (07:00-09:00)',
        'restriction:conditional': 'no_right_turn @ (Mo-Fr 07:00-09:00)',
      },
      members: [
        { type: 'way', ref: 101, role: 'from', order: 0 },
        { type: 'node', ref: 201, role: 'via', order: 1 },
        { type: 'way', ref: 102, role: 'to', order: 2 },
      ],
    };

    const parsed = parseTurnRestrictionRelation(rawRelation);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('NO_RIGHT_TURN');
    expect(parsed!.conditionalExpression).toBe('no_right_turn @ (Mo-Fr 07:00-09:00)');
    expect(parsed!.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
  });

  it('93. Task 91 Case C: Valid restriction:conditional with different restriction type preserves token and expression of standard conditional', () => {
    // Unconditional different token
    const rawRelation1: RawOsmRelation = {
      id: 9103,
      tags: {
        type: 'restriction',
        restriction: 'no_left_turn',
        'restriction:conditional': 'no_right_turn @ (Mo-Fr 07:00-09:00)',
      },
      members: [
        { type: 'way', ref: 101, role: 'from', order: 0 },
        { type: 'node', ref: 201, role: 'via', order: 1 },
        { type: 'way', ref: 102, role: 'to', order: 2 },
      ],
    };

    const parsed1 = parseTurnRestrictionRelation(rawRelation1);
    expect(parsed1).not.toBeNull();
    expect(parsed1!.type).toBe('NO_RIGHT_TURN');
    expect(parsed1!.conditionalExpression).toBe('no_right_turn @ (Mo-Fr 07:00-09:00)');
    expect(parsed1!.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');

    // Inline conditional different token
    const rawRelation2: RawOsmRelation = {
      id: 9104,
      tags: {
        type: 'restriction',
        restriction: 'only_straight_on @ (08:00-10:00)',
        'restriction:conditional': 'no_right_turn @ (Mo-Fr 07:00-09:00)',
      },
      members: [
        { type: 'way', ref: 101, role: 'from', order: 0 },
        { type: 'node', ref: 201, role: 'via', order: 1 },
        { type: 'way', ref: 102, role: 'to', order: 2 },
      ],
    };

    const parsed2 = parseTurnRestrictionRelation(rawRelation2);
    expect(parsed2).not.toBeNull();
    expect(parsed2!.type).toBe('NO_RIGHT_TURN');
    expect(parsed2!.conditionalExpression).toBe('no_right_turn @ (Mo-Fr 07:00-09:00)');
    expect(parsed2!.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
  });

  it('94. Task 91 Case D: When restriction:conditional is absent, valid inline conditionals work and malformed inline conditionals return null', () => {
    const members: OsmRelationMember[] = [
      { type: 'way', ref: 101, role: 'from', order: 0 },
      { type: 'node', ref: 201, role: 'via', order: 1 },
      { type: 'way', ref: 102, role: 'to', order: 2 },
    ];

    // D.1: Valid inline conditional works
    const parsedValid = parseTurnRestrictionRelation({
      id: 9105,
      tags: { type: 'restriction', restriction: 'no_left_turn @ (06:30-08:00)' },
      members,
    });
    expect(parsedValid).not.toBeNull();
    expect(parsedValid!.type).toBe('NO_LEFT_TURN');
    expect(parsedValid!.conditionalExpression).toBe('no_left_turn @ (06:30-08:00)');
    expect(parsedValid!.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');

    // D.2: Malformed inline conditional returns null
    expect(
      parseTurnRestrictionRelation({
        id: 9106,
        tags: { type: 'restriction', restriction: 'no_left_turn @' },
        members,
      })
    ).toBeNull();

    expect(
      parseTurnRestrictionRelation({
        id: 9107,
        tags: { type: 'restriction', restriction: 'unknown_token @ (07:00)' },
        members,
      })
    ).toBeNull();
  });

  it('95. Task 91: Malformed restriction:conditional tags return null safely', () => {
    const members: OsmRelationMember[] = [
      { type: 'way', ref: 101, role: 'from', order: 0 },
      { type: 'node', ref: 201, role: 'via', order: 1 },
      { type: 'way', ref: 102, role: 'to', order: 2 },
    ];

    // Missing condition after @
    expect(
      parseTurnRestrictionRelation({
        id: 9108,
        tags: { type: 'restriction', 'restriction:conditional': 'no_right_turn @' },
        members,
      })
    ).toBeNull();

    // Missing token before @
    expect(
      parseTurnRestrictionRelation({
        id: 9109,
        tags: { type: 'restriction', 'restriction:conditional': '@ (Mo-Fr 07:00)' },
        members,
      })
    ).toBeNull();

    // Unknown restriction token
    expect(
      parseTurnRestrictionRelation({
        id: 9110,
        tags: { type: 'restriction', 'restriction:conditional': 'unknown_token @ (Mo-Fr 07:00)' },
        members,
      })
    ).toBeNull();

    // Not a conditional format (missing @)
    expect(
      parseTurnRestrictionRelation({
        id: 9111,
        tags: { type: 'restriction', 'restriction:conditional': 'not_a_conditional' },
        members,
      })
    ).toBeNull();
  });

  it('96. Task 91 Integration: importXml handles relation with valid restriction:conditional and malformed restriction tag', () => {
    const testXml = `
      <osm version="0.6">
        <node id="1001" lat="16.050" lon="108.200"/>
        <node id="1002" lat="16.051" lon="108.201"/>
        <node id="1003" lat="16.052" lon="108.202"/>
        <way id="2001">
          <nd ref="1001"/><nd ref="1002"/>
          <tag k="highway" v="primary"/>
        </way>
        <way id="2002">
          <nd ref="1002"/><nd ref="1003"/>
          <tag k="highway" v="primary"/>
        </way>
        <relation id="99991">
          <tag k="type" v="restriction"/>
          <tag k="restriction" v="no_left_turn @"/>
          <tag k="restriction:conditional" v="no_right_turn @ (Mo-Fr 07:00-09:00)"/>
          <member type="way" ref="2001" role="from"/>
          <member type="node" ref="1002" role="via"/>
          <member type="way" ref="2002" role="to"/>
        </relation>
      </osm>
    `;

    const { graph, diagnostics } = importer.importXml(testXml);
    expect(diagnostics.turnRestrictionsRead).toBe(1);
    expect(diagnostics.unsupportedRestrictionsCount).toBe(1);
    expect(graph.turnRestrictions.length).toBe(1);

    const rel = graph.turnRestrictions[0];
    expect(rel.id).toBe('rel_osm_99991');
    expect(rel.type).toBe('NO_RIGHT_TURN');
    expect(rel.conditionalExpression).toBe('no_right_turn @ (Mo-Fr 07:00-09:00)');
    expect(rel.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
  });

  it('97. Task 97 Case A & B: restriction:conditional with empty string or whitespace returns null and does not fallback to restriction', () => {
    const members: OsmRelationMember[] = [
      { type: 'way', ref: 101, role: 'from', order: 0 },
      { type: 'node', ref: 201, role: 'via', order: 1 },
      { type: 'way', ref: 102, role: 'to', order: 2 },
    ];

    // Case A: empty string
    const relEmpty: RawOsmRelation = {
      id: 9701,
      tags: {
        type: 'restriction',
        restriction: 'no_left_turn',
        'restriction:conditional': '',
      },
      members,
    };
    expect(parseTurnRestrictionRelation(relEmpty)).toBeNull();

    // Case B: whitespace only
    const relWhitespace: RawOsmRelation = {
      id: 9702,
      tags: {
        type: 'restriction',
        restriction: 'no_left_turn',
        'restriction:conditional': '   ',
      },
      members,
    };
    expect(parseTurnRestrictionRelation(relWhitespace)).toBeNull();
  });

  it('98. Task 97 Case C: When key restriction:conditional is absent, regular restriction=no_left_turn parses as FULLY_SUPPORTED', () => {
    const members: OsmRelationMember[] = [
      { type: 'way', ref: 101, role: 'from', order: 0 },
      { type: 'node', ref: 201, role: 'via', order: 1 },
      { type: 'way', ref: 102, role: 'to', order: 2 },
    ];

    const relAbsent: RawOsmRelation = {
      id: 9703,
      tags: {
        type: 'restriction',
        restriction: 'no_left_turn',
      },
      members,
    };

    const parsed = parseTurnRestrictionRelation(relAbsent);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('NO_LEFT_TURN');
    expect(parsed!.conditionalExpression).toBeNull();
    expect(parsed!.supportStatus).toBe('FULLY_SUPPORTED');
  });

  it('99. Task 97 Case D: Valid restriction:conditional preserves precedence over restriction and sets FAIL_CLOSED_UNRESOLVED in strict mode', () => {
    const members: OsmRelationMember[] = [
      { type: 'way', ref: 101, role: 'from', order: 0 },
      { type: 'node', ref: 201, role: 'via', order: 1 },
      { type: 'way', ref: 102, role: 'to', order: 2 },
    ];

    const relValid: RawOsmRelation = {
      id: 9704,
      tags: {
        type: 'restriction',
        restriction: 'no_left_turn',
        'restriction:conditional': 'no_right_turn @ (Mo-Fr 07:00-09:00)',
      },
      members,
    };

    const parsed = parseTurnRestrictionRelation(relValid);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('NO_RIGHT_TURN');
    expect(parsed!.conditionalExpression).toBe('no_right_turn @ (Mo-Fr 07:00-09:00)');
    expect(parsed!.supportStatus).toBe('FAIL_CLOSED_UNRESOLVED');
  });

  it('100. Task 97 Integration: importXml drops relation with empty or whitespace restriction:conditional as invalid relation', () => {
    const testXml = `
      <osm version="0.6">
        <node id="1001" lat="16.050" lon="108.200"/>
        <node id="1002" lat="16.051" lon="108.201"/>
        <node id="1003" lat="16.052" lon="108.202"/>
        <way id="2001">
          <nd ref="1001"/><nd ref="1002"/>
          <tag k="highway" v="primary"/>
        </way>
        <way id="2002">
          <nd ref="1002"/><nd ref="1003"/>
          <tag k="highway" v="primary"/>
        </way>
        <relation id="9705">
          <tag k="type" v="restriction"/>
          <tag k="restriction" v="no_left_turn"/>
          <tag k="restriction:conditional" v="   "/>
          <member type="way" ref="2001" role="from"/>
          <member type="node" ref="1002" role="via"/>
          <member type="way" ref="2002" role="to"/>
        </relation>
      </osm>
    `;

    const { graph, diagnostics } = importer.importXml(testXml);
    expect(diagnostics.turnRestrictionsRead).toBe(1);
    expect(diagnostics.invalidRelationsCount).toBe(1);
    expect(graph.turnRestrictions.length).toBe(0);
  });
});
