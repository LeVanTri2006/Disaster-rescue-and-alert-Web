import { XMLParser } from 'fast-xml-parser';
import {
  BaseRoadGraph,
  BoundingBox,
  CliMode,
  EdgeMetadata,
  EdgeSafetySummary,
  EdgeTransition,
  GeoPoint,
  ImportDiagnostics,
  RoadEdge,
  RoadNode,
  StrictRoutingReadiness,
  TurnRestriction,
  VehicleProfile,
} from './types';
import { calculatePolylineLengthMeters } from './haversine';
import {
  DEFAULT_RESCUE_TRUCK_4X4_PROFILE,
  evaluateWayForProfile,
} from './vehicle-profile';
import { resolveOnewayPolicy } from './oneway-resolver';
import {
  parseTurnRestrictionRelation,
  RawOsmRelation,
} from './turn-restriction-parser';

export interface ImportOptions {
  mode?: CliMode;
  graphVersion?: string;
  vehicleProfile?: VehicleProfile;
  boundingBox?: BoundingBox;
  boundingBoxType?: 'FIXTURE' | 'PRODUCTION';
  osmSnapshotTimestamp?: string;
  fixtureGeneratedAt?: string;
  strictRescueMode?: boolean;
  retainBlockedEdgesInGraph?: boolean;
  requireValidOsmTimestamp?: boolean;
}

export interface ImportResult {
  graph: BaseRoadGraph;
  diagnostics: ImportDiagnostics;
}

/**
 * Strict ISO 8601 / RFC 3339 timestamp validation.
 * Requires explicit timezone (Z or [+-]HH:MM).
 * Enforces calendar month/day boundaries, leap years, and 24h ranges.
 */
export function isValidIso8601Timestamp(timestamp: unknown): boolean {
  if (typeof timestamp !== 'string') return false;
  const trimmed = timestamp.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/.exec(trimmed);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);
  const second = parseInt(match[6], 10);

  if (month < 1 || month > 12) return false;

  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonths = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysInMonths[month - 1]) return false;

  if (hour < 0 || hour > 23) return false;
  if (minute < 0 || minute > 59) return false;
  if (second < 0 || second > 59) return false;

  if (match[8] !== undefined && match[9] !== undefined) {
    const tzHour = parseInt(match[8], 10);
    const tzMin = parseInt(match[9], 10);
    if (tzHour < 0 || tzHour > 23) return false;
    if (tzMin < 0 || tzMin > 59) return false;
  }

  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return false;

  return true;
}

interface RawNode {
  id: number;
  lat: number;
  lon: number;
}

interface RawWay {
  id: number;
  nodeRefs: number[];
  tags: Record<string, string>;
}

export class OsmImporter {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      isArray: (name) =>
        ['node', 'way', 'relation', 'tag', 'nd', 'member'].includes(name),
    });
  }

  public importXml(xmlContent: string, options?: ImportOptions): ImportResult {
    const profile = options?.vehicleProfile ?? DEFAULT_RESCUE_TRUCK_4X4_PROFILE;
    const graphVersion = options?.graphVersion ?? 'v1.0';
    const strictRescueMode = options?.strictRescueMode !== false;

    const parsed = this.parser.parse(xmlContent);
    const osmRoot = parsed.osm ?? parsed;

    // 1. Check explicit options.osmSnapshotTimestamp (Priority 1)
    let osmSnapshotTimestamp: string | undefined;
    if (options?.osmSnapshotTimestamp !== undefined) {
      if (!isValidIso8601Timestamp(options.osmSnapshotTimestamp)) {
        throw new Error(
          `Explicit osmSnapshotTimestamp "${options.osmSnapshotTimestamp}" is invalid: must be a valid ISO 8601/RFC 3339 timestamp with explicit timezone (e.g. 2026-11-04T12:34:56Z).`
        );
      }
      osmSnapshotTimestamp = options.osmSnapshotTimestamp.trim();
    }

    // 2. Detect Overpass API <meta osm_base="..."/> (Priority 2)
    if (!osmSnapshotTimestamp) {
      let overpassCandidate: string | undefined;
      if (osmRoot.meta) {
        if (typeof osmRoot.meta.osm_base === 'string') {
          overpassCandidate = osmRoot.meta.osm_base;
        } else if (Array.isArray(osmRoot.meta)) {
          for (const m of osmRoot.meta) {
            if (typeof m?.osm_base === 'string') {
              overpassCandidate = m.osm_base;
              break;
            }
          }
        }
      }
      if (overpassCandidate && isValidIso8601Timestamp(overpassCandidate)) {
        osmSnapshotTimestamp = overpassCandidate.trim();
      }
    }

    // 3. Detect root timestamp <osm timestamp="..."> or @_timestamp (Priority 3)
    if (!osmSnapshotTimestamp) {
      const rootTimestampCandidate = osmRoot['timestamp'] ?? osmRoot['@_timestamp'];
      if (rootTimestampCandidate && isValidIso8601Timestamp(rootTimestampCandidate)) {
        osmSnapshotTimestamp = String(rootTimestampCandidate).trim();
      }
    }

    // 4. Mode evaluation and fallback
    const isRealSnapshotMode =
      options?.mode === 'REAL_OSM_SNAPSHOT' || options?.requireValidOsmTimestamp === true;

    if (isRealSnapshotMode) {
      if (!osmSnapshotTimestamp) {
        throw new Error(
          'Missing valid OSM snapshot timestamp in REAL_OSM_SNAPSHOT mode: XML contains no valid Overpass <meta osm_base="..."/> or root timestamp, and no valid explicit osmSnapshotTimestamp was provided.'
        );
      }
    } else {
      if (!osmSnapshotTimestamp) {
        osmSnapshotTimestamp = '2024-11-01T00:00:00.000Z';
      }
    }

    const rawNodesMap = new Map<number, RawNode>();
    const rawWaysMap = new Map<number, RawWay>();
    const rawWays: RawWay[] = [];
    const rawRelations: RawOsmRelation[] = [];

    // 1. Read Nodes
    const xmlNodes = osmRoot.node ?? [];
    for (const n of xmlNodes) {
      const id = parseInt(n.id, 10);
      const lat = parseFloat(n.lat);
      const lon = parseFloat(n.lon);
      if (isFinite(id) && isFinite(lat) && isFinite(lon)) {
        rawNodesMap.set(id, { id, lat, lon });
      }
    }

    // 2. Read Ways
    const xmlWays = osmRoot.way ?? [];
    for (const w of xmlWays) {
      const id = parseInt(w.id, 10);
      const nodeRefs: number[] = [];
      const nds = w.nd ?? [];
      for (const nd of nds) {
        const ref = parseInt(nd.ref, 10);
        if (isFinite(ref)) {
          nodeRefs.push(ref);
        }
      }

      const tags: Record<string, string> = {};
      const xmlTags = w.tag ?? [];
      for (const t of xmlTags) {
        if (t.k && t.v !== undefined) {
          tags[t.k] = String(t.v);
        }
      }

      if (isFinite(id) && nodeRefs.length >= 2) {
        const rawWay: RawWay = { id, nodeRefs, tags };
        rawWays.push(rawWay);
        rawWaysMap.set(id, rawWay);
      }
    }

    // 3. Read Relations
    const xmlRelations = osmRoot.relation ?? [];
    for (const r of xmlRelations) {
      const id = parseInt(r.id, 10);
      const tags: Record<string, string> = {};
      const xmlTags = r.tag ?? [];
      for (const t of xmlTags) {
        if (t.k && t.v !== undefined) {
          tags[t.k] = String(t.v);
        }
      }

      const members: RawOsmRelation['members'] = [];
      const xmlMembers = r.member ?? [];
      let order = 0;
      for (const m of xmlMembers) {
        const ref = parseInt(m.ref, 10);
        if (isFinite(ref) && m.type && m.role) {
          members.push({
            type: m.type as 'node' | 'way' | 'relation',
            ref,
            role: m.role,
            order: order++,
          });
        }
      }

      if (isFinite(id)) {
        rawRelations.push({ id, tags, members });
      }
    }

    // Initialize diagnostics
    const diagnostics: ImportDiagnostics = {
      nodesRead: rawNodesMap.size,
      waysRead: rawWays.length,
      relationsRead: rawRelations.length,
      nodesCreated: 0,
      directedEdgesCreated: 0,
      onewayForwardCount: 0,
      onewayReverseCount: 0,
      bidirectionalWayCount: 0,
      roundaboutCount: 0,
      turnRestrictionsRead: 0,
      supportedRestrictionsCount: 0,
      unsupportedRestrictionsCount: 0,
      exemptRestrictionsCount: 0,
      invalidRelationsCount: 0,
      invalidGeometryCount: 0,
      missingNodeReferencesCount: 0,
      droppedWaysCount: 0,
      droppedEdgesCount: 0,
      verifiedCompatibleEdgesCount: 0,
      unverifiedEdgesCount: 0,
      blockedEdgesCount: 0,
      blockedWaysCount: 0,
      excludedBlockedWaysCount: 0,
      retainedBlockedWaysCount: 0,
      unverifiedDimensionsCount: 0,
      tagConflictCount: 0,
      tagWarningCount: 0,
      droppedItems: [],
    };

    // Filter ways for vehicle profile & oneway routability
    const routableWays: RawWay[] = [];

    for (const way of rawWays) {
      // Check vehicle profile
      const profileCheck = evaluateWayForProfile(way.tags, profile);
      if (profileCheck.tagConflicts.length > 0) {
        diagnostics.tagConflictCount += profileCheck.tagConflicts.length;
      }
      if (profileCheck.tagWarnings.length > 0) {
        diagnostics.tagWarningCount += profileCheck.tagWarnings.length;
      }

      const isBlocked = profileCheck.compatibilityStatus === 'BLOCKED';
      if (isBlocked) {
        diagnostics.blockedWaysCount++;
      }

      // If way is BLOCKED and retainBlockedEdgesInGraph is FALSE (default mode):
      // The way is excluded/dropped right here because of BLOCKED status.
      if (isBlocked && !options?.retainBlockedEdgesInGraph) {
        diagnostics.excludedBlockedWaysCount++;
        diagnostics.droppedWaysCount++;
        diagnostics.droppedItems.push({
          type: 'way',
          id: way.id,
          reason: profileCheck.blockedReason ?? 'Vehicle profile disallow',
        });
        continue;
      }

      // Check oneway routability
      const onewayResult = resolveOnewayPolicy(way.tags);
      if (!onewayResult.createForwardEdge && !onewayResult.createReverseEdge) {
        if (isBlocked) {
          diagnostics.excludedBlockedWaysCount++;
        }
        diagnostics.droppedWaysCount++;
        diagnostics.droppedItems.push({
          type: 'way',
          id: way.id,
          reason: onewayResult.reason ?? `Non-routable oneway policy: ${onewayResult.policy}`,
        });
        continue;
      }

      // Verify node references exist
      let missingRef = false;
      for (const ref of way.nodeRefs) {
        if (!rawNodesMap.has(ref)) {
          missingRef = true;
          break;
        }
      }
      if (missingRef) {
        if (isBlocked) {
          diagnostics.excludedBlockedWaysCount++;
        }
        diagnostics.missingNodeReferencesCount++;
        diagnostics.droppedWaysCount++;
        diagnostics.droppedItems.push({
          type: 'way',
          id: way.id,
          reason: 'Way references nodes that do not exist in input OSM dataset',
        });
        continue;
      }

      routableWays.push(way);
    }

    // Count usage to determine intersection nodes
    const nodeUsageCount = new Map<number, number>();
    for (const way of routableWays) {
      for (const ref of way.nodeRefs) {
        nodeUsageCount.set(ref, (nodeUsageCount.get(ref) ?? 0) + 1);
      }
    }

    // Determine intersection nodes (starts, ends, or shared by multiple ways/loops)
    const intersectionNodeIds = new Set<number>();
    for (const way of routableWays) {
      intersectionNodeIds.add(way.nodeRefs[0]);
      intersectionNodeIds.add(way.nodeRefs[way.nodeRefs.length - 1]);
      for (let i = 1; i < way.nodeRefs.length - 1; i++) {
        const ref = way.nodeRefs[i];
        if ((nodeUsageCount.get(ref) ?? 0) > 1) {
          intersectionNodeIds.add(ref);
        }
      }
    }

    // Build RoadNodes
    const roadNodesMap = new Map<string, RoadNode>();
    for (const nodeId of intersectionNodeIds) {
      const rawNode = rawNodesMap.get(nodeId);
      if (rawNode) {
        const id = `node_osm_${nodeId}`;
        roadNodesMap.set(id, {
          id,
          osmNodeId: nodeId,
          lat: rawNode.lat,
          lon: rawNode.lon,
          isSynthetic: false,
        });
      }
    }
    diagnostics.nodesCreated = roadNodesMap.size;

    // Build RoadEdges
    const roadEdges: RoadEdge[] = [];

    for (const way of routableWays) {
      let createdEdgesForThisWay = 0;
      const onewayResult = resolveOnewayPolicy(way.tags);
      const isRoundabout = way.tags['junction'] === 'roundabout';
      if (isRoundabout) diagnostics.roundaboutCount++;

      if (onewayResult.policy === 'FORWARD') diagnostics.onewayForwardCount++;
      else if (onewayResult.policy === 'REVERSE') diagnostics.onewayReverseCount++;
      else if (onewayResult.policy === 'BIDIRECTIONAL') diagnostics.bidirectionalWayCount++;

      // Segment splitting
      let segStartIndex = 0;
      for (let i = 1; i < way.nodeRefs.length; i++) {
        const ref = way.nodeRefs[i];
        if (intersectionNodeIds.has(ref) || i === way.nodeRefs.length - 1) {
          const segRefs = way.nodeRefs.slice(segStartIndex, i + 1);
          segStartIndex = i;

          if (segRefs.length < 2) continue;

          const startNodeId = segRefs[0];
          const endNodeId = segRefs[segRefs.length - 1];

          const forwardGeometry: GeoPoint[] = segRefs.map((r) => {
            const rn = rawNodesMap.get(r)!;
            return { lat: rn.lat, lon: rn.lon };
          });

          const lengthMeters = calculatePolylineLengthMeters(forwardGeometry);
          if (lengthMeters <= 0.0 || !isFinite(lengthMeters)) {
            diagnostics.invalidGeometryCount++;
            continue;
          }

          const profileCheck = evaluateWayForProfile(way.tags, profile);
          if (profileCheck.isDimensionUnverified) {
            diagnostics.unverifiedDimensionsCount++;
          }

          const metadata: EdgeMetadata = {
            name: way.tags['name'] ?? '',
            highwayType: way.tags['highway'] ?? '',
            surface: way.tags['surface'] ?? '',
            smoothness: way.tags['smoothness'] ?? '',
            trackGrade: profileCheck.trackGrade,
            surfaceSuitability: profileCheck.surfaceSuitability,
            widthMeters: profileCheck.widthMeters,
            effectiveWidthMeters: profileCheck.effectiveWidthMeters,
            maxWidthMeters: profileCheck.maxWidthMeters,
            maxPhysicalWidthMeters: profileCheck.maxPhysicalWidthMeters,
            maxHeightMeters: profileCheck.maxHeightMeters,
            maxPhysicalHeightMeters: profileCheck.maxPhysicalHeightMeters,
            maxWeightTons: profileCheck.maxWeightTons,
            maxWeightRatingTons: profileCheck.maxWeightRatingTons,
            maxAxleLoadTons: profileCheck.maxAxleLoadTons,
            maxSpeedKmH: way.tags['maxspeed'] ? parseFloat(way.tags['maxspeed']) || null : null,
            bridge: way.tags['bridge'] === 'yes' || way.tags['bridge'] === 'true',
            tunnel: way.tags['tunnel'] === 'yes' || way.tags['tunnel'] === 'true',
            layer: way.tags['layer'] ? parseInt(way.tags['layer'], 10) || 0 : 0,
            rawTags: { ...way.tags },
            isDimensionUnverified: profileCheck.isDimensionUnverified,
            isPhysicalClearanceUnverified: profileCheck.isPhysicalClearanceUnverified,
            unverifiedPhysicalDimensions: profileCheck.unverifiedPhysicalDimensions,
            unverifiedLegalRestrictions: profileCheck.unverifiedLegalRestrictions,
            tagConflicts: profileCheck.tagConflicts,
            tagWarnings: profileCheck.tagWarnings,
          };

          // Forward Edge
          if (onewayResult.createForwardEdge) {
            const edgeId = `edge_w${way.id}_n${startNodeId}_n${endNodeId}_F`;
            roadEdges.push({
              id: edgeId,
              osmWayId: way.id,
              fromNodeId: `node_osm_${startNodeId}`,
              toNodeId: `node_osm_${endNodeId}`,
              isWayForward: true,
              lengthMeters,
              geometry: forwardGeometry,
              wayFlowPolicy: onewayResult.policy,
              metadata,
              compatibilityStatus: profileCheck.compatibilityStatus,
              isEligibleForStrictRouting: profileCheck.isEligibleForStrictRouting,
              blockedReason: profileCheck.blockedReason,
            });
            diagnostics.directedEdgesCreated++;
            createdEdgesForThisWay++;
            if (profileCheck.compatibilityStatus === 'VERIFIED_COMPATIBLE') {
              diagnostics.verifiedCompatibleEdgesCount++;
            } else if (profileCheck.compatibilityStatus === 'UNVERIFIED') {
              diagnostics.unverifiedEdgesCount++;
            } else if (profileCheck.compatibilityStatus === 'BLOCKED') {
              diagnostics.blockedEdgesCount++;
            }
          }

          // Reverse Edge
          if (onewayResult.createReverseEdge) {
            const edgeId = `edge_w${way.id}_n${endNodeId}_n${startNodeId}_R`;
            const reverseGeometry = [...forwardGeometry].reverse();
            roadEdges.push({
              id: edgeId,
              osmWayId: way.id,
              fromNodeId: `node_osm_${endNodeId}`,
              toNodeId: `node_osm_${startNodeId}`,
              isWayForward: false,
              lengthMeters,
              geometry: reverseGeometry,
              wayFlowPolicy: onewayResult.policy,
              metadata,
              compatibilityStatus: profileCheck.compatibilityStatus,
              isEligibleForStrictRouting: profileCheck.isEligibleForStrictRouting,
              blockedReason: profileCheck.blockedReason,
            });
            diagnostics.directedEdgesCreated++;
            createdEdgesForThisWay++;
            if (profileCheck.compatibilityStatus === 'VERIFIED_COMPATIBLE') {
              diagnostics.verifiedCompatibleEdgesCount++;
            } else if (profileCheck.compatibilityStatus === 'UNVERIFIED') {
              diagnostics.unverifiedEdgesCount++;
            } else if (profileCheck.compatibilityStatus === 'BLOCKED') {
              diagnostics.blockedEdgesCount++;
            }
          }
        }
      }

      const profileCheck = evaluateWayForProfile(way.tags, profile);
      const isBlocked = profileCheck.compatibilityStatus === 'BLOCKED';

      if (createdEdgesForThisWay === 0) {
        diagnostics.droppedWaysCount++;
        diagnostics.droppedItems.push({
          type: 'way',
          id: way.id,
          reason: 'NO_VALID_DIRECTED_EDGES_INVALID_GEOMETRY',
        });
        if (isBlocked) {
          diagnostics.excludedBlockedWaysCount++;
        }
      } else {
        if (isBlocked) {
          diagnostics.retainedBlockedWaysCount++;
        }
      }
    }

    // 4. Parse & Validate Turn Restrictions
    const turnRestrictions: TurnRestriction[] = [];
    for (const rel of rawRelations) {
      if (rel.tags['type'] === 'restriction') {
        diagnostics.turnRestrictionsRead++;
        const parsed = parseTurnRestrictionRelation(rel, {
          strictRescueMode,
        });

        if (!parsed) {
          diagnostics.invalidRelationsCount++;
          diagnostics.droppedItems.push({
            type: 'relation',
            id: rel.id,
            reason: 'Malformed turn restriction relation missing from/via/to members or recognized type',
          });
          continue;
        }

        // Validate via-way restrictions
        if (parsed.viaOsmWayIds.length > 0) {
          parsed.supportStatus = 'FAIL_CLOSED_UNRESOLVED';
          parsed.validationError = 'Via-way restrictions require multi-hop state machine not yet implemented';
          turnRestrictions.push(parsed);
          diagnostics.unsupportedRestrictionsCount++;
          continue;
        }

        // Validate via-node restrictions
        const viaNodeId = parsed.viaOsmNodeIds[0];
        if (!viaNodeId) {
          parsed.supportStatus = 'FAIL_CLOSED_UNRESOLVED';
          parsed.validationError = 'Via-node restriction missing via-node member';
          turnRestrictions.push(parsed);
          diagnostics.unsupportedRestrictionsCount++;
          continue;
        }

        // Cardinality checks
        let cardinalityValid = true;
        if (parsed.type === 'NO_ENTRY') {
          if (parsed.fromOsmWayIds.length < 1 || parsed.toOsmWayIds.length !== 1) {
            cardinalityValid = false;
            parsed.validationError = 'NO_ENTRY requires >= 1 from-way and exactly 1 to-way';
          }
        } else if (parsed.type === 'NO_EXIT') {
          if (parsed.fromOsmWayIds.length !== 1 || parsed.toOsmWayIds.length < 1) {
            cardinalityValid = false;
            parsed.validationError = 'NO_EXIT requires exactly 1 from-way and >= 1 to-way';
          }
        } else {
          // Standard NO_* and ONLY_*
          if (parsed.fromOsmWayIds.length !== 1 || parsed.toOsmWayIds.length !== 1) {
            cardinalityValid = false;
            parsed.validationError = `${parsed.type} requires exactly 1 from-way and 1 to-way`;
          }
        }

        if (!cardinalityValid) {
          parsed.supportStatus = 'FAIL_CLOSED_UNRESOLVED';
          turnRestrictions.push(parsed);
          diagnostics.unsupportedRestrictionsCount++;
          continue;
        }

        // Topological connectivity check: do from-ways and to-ways actually connect to via-node?
        let connectivityValid = true;
        for (const fromId of parsed.fromOsmWayIds) {
          const rawWay = rawWaysMap.get(fromId);
          if (!rawWay || !rawWay.nodeRefs.includes(viaNodeId)) {
            connectivityValid = false;
            parsed.validationError = `from-way ${fromId} does not physically connect to via-node ${viaNodeId}`;
            break;
          }
        }
        if (connectivityValid) {
          for (const toId of parsed.toOsmWayIds) {
            const rawWay = rawWaysMap.get(toId);
            if (!rawWay || !rawWay.nodeRefs.includes(viaNodeId)) {
              connectivityValid = false;
              parsed.validationError = `to-way ${toId} does not physically connect to via-node ${viaNodeId}`;
              break;
            }
          }
        }

        if (!connectivityValid) {
          parsed.supportStatus = 'FAIL_CLOSED_UNRESOLVED';
          turnRestrictions.push(parsed);
          diagnostics.unsupportedRestrictionsCount++;
          continue;
        }

        // Directed edge semantics check: are there directed edges entering and exiting via-node?
        const viaRoadNodeKey = `node_osm_${viaNodeId}`;
        const incomingEdges = roadEdges.filter(
          (e) => parsed.fromOsmWayIds.includes(e.osmWayId) && e.toNodeId === viaRoadNodeKey
        );
        const outgoingEdges = roadEdges.filter(
          (e) => parsed.toOsmWayIds.includes(e.osmWayId) && e.fromNodeId === viaRoadNodeKey
        );

        if (incomingEdges.length === 0) {
          parsed.supportStatus = 'FAIL_CLOSED_UNRESOLVED';
          parsed.validationError = `No incoming directed edges enter via-node ${viaNodeId} on specified from-way(s)`;
          turnRestrictions.push(parsed);
          diagnostics.unsupportedRestrictionsCount++;
          continue;
        }

        if (outgoingEdges.length === 0) {
          parsed.supportStatus = 'FAIL_CLOSED_UNRESOLVED';
          parsed.validationError = `No outgoing directed edges exit via-node ${viaNodeId} onto specified to-way(s)`;
          turnRestrictions.push(parsed);
          diagnostics.unsupportedRestrictionsCount++;
          continue;
        }

        // Restriction resolution for valid topology
        if (parsed.isExemptForProfile) {
          parsed.supportStatus = 'EXEMPT_FOR_PROFILE';
          turnRestrictions.push(parsed);
          diagnostics.exemptRestrictionsCount++;
          continue;
        }

        if (parsed.conditionalExpression && strictRescueMode) {
          parsed.supportStatus = 'FAIL_CLOSED_UNRESOLVED';
          parsed.validationError = 'Conditional temporal restriction unresolved; fail-closed in strict mode';
          turnRestrictions.push(parsed);
          diagnostics.unsupportedRestrictionsCount++;
          continue;
        }

        // Compile prohibited and allowed transitions
        const prohibited: EdgeTransition[] = [];
        const allowed: EdgeTransition[] = [];

        if (parsed.type.startsWith('ONLY_')) {
          // ONLY restriction: all incoming edges from from-ways can ONLY transition to specified to-ways
          for (const inc of incomingEdges) {
            for (const out of outgoingEdges) {
              allowed.push({
                fromEdgeId: inc.id,
                toEdgeId: out.id,
                viaNodeId: viaRoadNodeKey,
              });
            }
          }
          // Any other outgoing edge at via-node is prohibited
          const otherOutgoing = roadEdges.filter(
            (e) => e.fromNodeId === viaRoadNodeKey && !parsed.toOsmWayIds.includes(e.osmWayId)
          );
          for (const inc of incomingEdges) {
            for (const other of otherOutgoing) {
              prohibited.push({
                fromEdgeId: inc.id,
                toEdgeId: other.id,
                viaNodeId: viaRoadNodeKey,
              });
            }
          }
        } else {
          // NO_* restrictions (NO_LEFT_TURN, NO_ENTRY, NO_EXIT, etc.)
          for (const inc of incomingEdges) {
            for (const out of outgoingEdges) {
              prohibited.push({
                fromEdgeId: inc.id,
                toEdgeId: out.id,
                viaNodeId: viaRoadNodeKey,
              });
            }
          }
        }

        parsed.prohibitedTransitions = prohibited;
        if (allowed.length > 0) {
          parsed.allowedTransitions = allowed;
        }

        if (parsed.conditionalExpression) {
          parsed.supportStatus = 'UNVERIFIED_WARNING';
          diagnostics.unsupportedRestrictionsCount++;
        } else {
          parsed.supportStatus = 'FULLY_SUPPORTED';
          diagnostics.supportedRestrictionsCount++;
        }
        turnRestrictions.push(parsed);
      }
    }

    // 5. Edge Safety Summary
    const totalEdges = roadEdges.length;
    const verifiedCompatibleEdges = diagnostics.verifiedCompatibleEdgesCount;
    const unverifiedEdges = diagnostics.unverifiedEdgesCount;
    const blockedEdges = diagnostics.blockedEdgesCount;
    const blockedWays = diagnostics.blockedWaysCount;
    const conflictedEdges = roadEdges.filter((e) => (e.metadata.tagConflicts?.length ?? 0) > 0).length;
    const strictSafeEdgesPercent = totalEdges > 0 ? (verifiedCompatibleEdges / totalEdges) * 100 : 0.0;

    const edgeSafetySummary: EdgeSafetySummary = {
      totalEdges,
      verifiedCompatibleEdges,
      unverifiedEdges,
      blockedEdges,
      conflictedEdges,
      strictSafeEdgesPercent: Math.round(strictSafeEdgesPercent * 100) / 100,
      blockedWays,
      excludedBlockedWays: diagnostics.excludedBlockedWaysCount,
      retainedBlockedWays: diagnostics.retainedBlockedWaysCount,
    };

    // 6. Turn restriction readiness
    const isRestrictionStrictRoutingEligible = diagnostics.unsupportedRestrictionsCount === 0;
    const restrictionStrictRoutingReadiness: StrictRoutingReadiness = isRestrictionStrictRoutingEligible
      ? 'READY'
      : 'NOT_READY_UNRESOLVED_RESTRICTIONS';

    // 7. Strict routing execution eligibility on verified edges:
    // Indicates the importer has a non-empty set of VERIFIED edges with 100% resolved turn restrictions
    const canAttemptStrictRouting =
      isRestrictionStrictRoutingEligible && edgeSafetySummary.verifiedCompatibleEdges > 0;
    const isStrictRoutingEligible = canAttemptStrictRouting; // Backward-compatible alias

    // 8. Overall graph data completeness readiness:
    let overallStrictRoutingReadiness: StrictRoutingReadiness;

    if (!isRestrictionStrictRoutingEligible) {
      overallStrictRoutingReadiness = 'NOT_READY_UNRESOLVED_RESTRICTIONS';
    } else if (edgeSafetySummary.verifiedCompatibleEdges === 0) {
      overallStrictRoutingReadiness = 'NOT_READY_NO_VERIFIED_EDGES';
    } else if (edgeSafetySummary.unverifiedEdges > 0) {
      overallStrictRoutingReadiness = 'NOT_READY_HAS_UNVERIFIED_EDGES';
    } else {
      overallStrictRoutingReadiness = 'READY';
    }

    const strictRoutingReadiness = overallStrictRoutingReadiness; // Backward-compatible alias

    const baseRoadGraph: BaseRoadGraph = {
      $schema: 'https://emergency-rescue.vn/schemas/v2/road-graph-bundle.json',
      contractVersion: '2.1.0',
      graphVersion,
      vehicleProfile: profile.profileName,
      ...(options?.boundingBoxType ? { boundingBoxType: options.boundingBoxType } : {}),
      boundingBox: options?.boundingBox,
      isRestrictionStrictRoutingEligible,
      restrictionStrictRoutingReadiness,
      canAttemptStrictRouting,
      isStrictRoutingEligible,
      strictRoutingReadiness,
      overallStrictRoutingReadiness,
      edgeSafetySummary,
      osmSnapshotTimestamp,
      ...(options?.fixtureGeneratedAt ? { fixtureGeneratedAt: options.fixtureGeneratedAt } : {}),
      generatedAt: new Date().toISOString(),
      nodes: Array.from(roadNodesMap.values()),
      edges: roadEdges,
      turnRestrictions,
    };

    return { graph: baseRoadGraph, diagnostics };
  }
}
