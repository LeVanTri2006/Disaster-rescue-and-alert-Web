import {
  OsmRelationMember,
  RestrictionSupportStatus,
  TurnRestriction,
  TurnRestrictionType,
} from './types';

const TYPE_MAP: Record<string, TurnRestrictionType> = {
  no_left_turn: 'NO_LEFT_TURN',
  no_right_turn: 'NO_RIGHT_TURN',
  no_straight_on: 'NO_STRAIGHT_ON',
  no_u_turn: 'NO_U_TURN',
  no_entry: 'NO_ENTRY',
  no_exit: 'NO_EXIT',
  only_left_turn: 'ONLY_LEFT_TURN',
  only_right_turn: 'ONLY_RIGHT_TURN',
  only_straight_on: 'ONLY_STRAIGHT_ON',
  only_u_turn: 'ONLY_U_TURN',
};

export interface RawOsmRelation {
  id: number;
  tags: Record<string, string>;
  members: OsmRelationMember[];
}

export interface TurnRestrictionParseOptions {
  strictRescueMode?: boolean;
}

export function parseTurnRestrictionRelation(
  relation: RawOsmRelation,
  options?: TurnRestrictionParseOptions
): TurnRestriction | null {
  const strictMode = options?.strictRescueMode !== false; // Default: true for rescue routing

  const typeTag = relation.tags['type'];
  if (typeTag !== 'restriction') {
    return null;
  }

  // Extract restriction type, mode, and conditional expression
  let rawRestriction: string | null = null;
  let restrictionMode: string | null = null;
  let conditionalExpression: string | null = null;

  // 1. Standard restriction:conditional tag priority
  const rawConditionalTag = relation.tags['restriction:conditional'];
  if (rawConditionalTag !== undefined) {
    if (typeof rawConditionalTag !== 'string' || rawConditionalTag.trim().length === 0) {
      // Key exists but value is empty or whitespace only -> malformed, do not fallback
      return null;
    }
    const standardConditionalTag = rawConditionalTag.trim();
    if (standardConditionalTag.includes('@')) {
      const match = standardConditionalTag.match(/^([a-z_]+)\s*@\s*(.+)$/i);
      if (!match) {
        return null;
      }
      const token = match[1].toLowerCase();
      const conditionPart = match[2].trim();
      if (!TYPE_MAP[token] || conditionPart.length === 0) {
        return null;
      }
      rawRestriction = token;
      conditionalExpression = standardConditionalTag;
    } else {
      return null;
    }
  }

  // 2. restriction tag (processed only if standard restriction:conditional did not establish a valid restriction)
  if (!rawRestriction) {
    const restrictionTag = relation.tags['restriction']?.trim();
    if (restrictionTag) {
      if (restrictionTag.includes('@')) {
        const match = restrictionTag.match(/^([a-z_]+)\s*@\s*(.+)$/i);
        if (!match) {
          // Malformed inline conditional (e.g. "@ (cond)" or "no_left_turn @")
          return null;
        }
        const token = match[1].toLowerCase();
        const conditionPart = match[2].trim();
        if (!TYPE_MAP[token] || conditionPart.length === 0) {
          // Token not in TYPE_MAP or condition is empty
          return null;
        }
        rawRestriction = token;
        conditionalExpression = restrictionTag;
      } else {
        const token = restrictionTag.toLowerCase();
        if (TYPE_MAP[token]) {
          rawRestriction = token;
        }
      }
    }
  }

  // 3. Mode-scoped restriction tags (e.g. restriction:motorcar or restriction:motor_vehicle)
  if (!rawRestriction) {
    for (const [k, v] of Object.entries(relation.tags)) {
      if (k.startsWith('restriction:') && k !== 'restriction:conditional') {
        const mode = k.substring('restriction:'.length).trim().toLowerCase();
        const val = v.trim();
        if (val.includes('@')) {
          const match = val.match(/^([a-z_]+)\s*@\s*(.+)$/i);
          if (match && TYPE_MAP[match[1].toLowerCase()] && match[2].trim().length > 0) {
            restrictionMode = mode;
            rawRestriction = match[1].toLowerCase();
            if (!conditionalExpression) {
              conditionalExpression = val;
            }
            break;
          } else {
            return null;
          }
        } else {
          const token = val.toLowerCase();
          if (TYPE_MAP[token]) {
            restrictionMode = mode;
            rawRestriction = token;
            break;
          } else {
            return null;
          }
        }
      }
    }
  }

  if (!rawRestriction || !TYPE_MAP[rawRestriction]) {
    return null;
  }

  const restrictionType = TYPE_MAP[rawRestriction];

  // Extract members
  const fromOsmWayIds: number[] = [];
  const viaOsmNodeIds: number[] = [];
  const viaOsmWayIds: number[] = [];
  const toOsmWayIds: number[] = [];

  for (const m of relation.members) {
    if (m.role === 'from' && m.type === 'way') {
      fromOsmWayIds.push(m.ref);
    } else if (m.role === 'via') {
      if (m.type === 'node') {
        viaOsmNodeIds.push(m.ref);
      } else if (m.type === 'way') {
        viaOsmWayIds.push(m.ref);
      }
    } else if (m.role === 'to' && m.type === 'way') {
      toOsmWayIds.push(m.ref);
    }
  }

  // Basic membership presence check
  if (fromOsmWayIds.length === 0 || toOsmWayIds.length === 0) {
    return null;
  }
  if (viaOsmNodeIds.length === 0 && viaOsmWayIds.length === 0) {
    return null;
  }

  // Parse except modes
  const exceptTag = relation.tags['except'];
  const exceptModes = exceptTag
    ? exceptTag
        .split(';')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];

  // Determine profile exemption:
  // 1. except=emergency exempts rescue vehicle
  // 2. restriction scoped to other vehicle types (e.g. restriction:bus, restriction:bicycle) exempts rescue truck
  let isExemptForProfile = false;
  if (exceptModes.includes('emergency')) {
    isExemptForProfile = true;
  } else if (
    restrictionMode &&
    ['bus', 'psv', 'bicycle', 'motorcycle', 'foot'].includes(restrictionMode)
  ) {
    isExemptForProfile = true;
  }

  // Determine initial support status
  let supportStatus: RestrictionSupportStatus;

  if (isExemptForProfile) {
    supportStatus = 'EXEMPT_FOR_PROFILE';
  } else if (viaOsmWayIds.length > 0) {
    supportStatus = 'FAIL_CLOSED_UNRESOLVED';
  } else if (conditionalExpression) {
    // In strict rescue mode: conditional restrictions without dynamic temporal solver MUST fail closed
    supportStatus = strictMode ? 'FAIL_CLOSED_UNRESOLVED' : 'UNVERIFIED_WARNING';
  } else {
    supportStatus = 'FULLY_SUPPORTED';
  }

  return {
    id: `rel_osm_${relation.id}`,
    type: restrictionType,
    members: relation.members,
    fromOsmWayIds,
    viaOsmNodeIds,
    viaOsmWayIds,
    toOsmWayIds,
    restrictionMode,
    exceptModes,
    conditionalExpression,
    supportStatus,
    isExemptForProfile,
  };
}
