import {
  EdgeCompatibilityStatus,
  VehicleProfile,
} from './types';

export const DEFAULT_RESCUE_TRUCK_4X4_PROFILE: VehicleProfile = {
  profileName: 'RESCUE_TRUCK_4X4',
  dimensions: {
    heightMeters: 3.0,
    widthMeters: 2.2,
    lengthMeters: 6.0,
    actualWeightTons: 5.0,
    maxWeightRatingTons: 5.5,
    axleLoadTons: 3.0,
    weightTons: 5.0,
    safetyMarginMeters: {
      lateralMeters: 0.2, // 20cm lateral clearance required
      verticalMeters: 0.1, // 10cm vertical clearance required
    },
  },
  allowedHighwayTypes: new Set([
    'motorway',
    'motorway_link',
    'trunk',
    'trunk_link',
    'primary',
    'primary_link',
    'secondary',
    'secondary_link',
    'tertiary',
    'tertiary_link',
    'unclassified',
    'residential',
    'living_street',
    'service',
    'track',
  ]),
  emergencyExemptionEnabled: true,
  allowPrivateAccessOverride: false,
  legalExemptionPolicy: {
    allowAccessRestrictionsOverride: true,
    allowLegalWidthSignOverride: true,
    allowLegalHeightSignOverride: false, // Never override height signs without physical verification
    allowLegalWeightRatingSignOverride: false, // Do not override weight rating signs without structural permit
  },
};

export interface ParsedDimensionResult {
  value: number | null;
  unparseable: boolean;
  rawValue?: string;
}

export function parseDimensionMeters(raw: string | undefined): ParsedDimensionResult {
  if (raw === undefined || raw === null || raw.trim().length === 0) {
    return { value: null, unparseable: false };
  }
  const clean = raw.trim().toLowerCase();

  // 1. Metric meters (e.g. "3.5", "3.5m", "3.5 m", "3.5 meters", "3.5 metres")
  const metricMatch = clean.match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:m|meters|metre|metres)?$/);
  if (metricMatch) {
    const val = parseFloat(metricMatch[1]);
    if (Number.isFinite(val) && val > 0) {
      return { value: val, unparseable: false, rawValue: raw };
    }
    return { value: null, unparseable: true, rawValue: raw };
  }

  // 2. Feet and inches (e.g. 14'6", 14' 6", 14ft 6in, 14 ft 6 in, 14ft, 14', 6in, 6")
  // Formats: feet and inches
  const feetInchesMatch = clean.match(
    /^(?:([0-9]+(?:\.[0-9]+)?)\s*(?:'|ft|feet)\s*)?(?:([0-9]+(?:\.[0-9]+)?)\s*(?:"|in|inches))?$/
  );
  if (feetInchesMatch && (feetInchesMatch[1] !== undefined || feetInchesMatch[2] !== undefined)) {
    const feet = feetInchesMatch[1] ? parseFloat(feetInchesMatch[1]) : 0;
    const inches = feetInchesMatch[2] ? parseFloat(feetInchesMatch[2]) : 0;
    if (Number.isFinite(feet) && Number.isFinite(inches) && (feet > 0 || inches > 0)) {
      const meters = feet * 0.3048 + inches * 0.0254;
      if (Number.isFinite(meters) && meters > 0) {
        return { value: Math.round(meters * 1000) / 1000, unparseable: false, rawValue: raw };
      }
    }
  }

  // Shorthand format: 14'6 or 14'6"
  const shorthandMatch = clean.match(/^([0-9]+(?:\.[0-9]+)?)\s*'\s*([0-9]+(?:\.[0-9]+)?)\s*"?$/);
  if (shorthandMatch) {
    const feet = parseFloat(shorthandMatch[1]);
    const inches = parseFloat(shorthandMatch[2]);
    if (Number.isFinite(feet) && Number.isFinite(inches) && (feet > 0 || inches > 0)) {
      const meters = feet * 0.3048 + inches * 0.0254;
      if (Number.isFinite(meters) && meters > 0) {
        return { value: Math.round(meters * 1000) / 1000, unparseable: false, rawValue: raw };
      }
    }
  }

  return { value: null, unparseable: true, rawValue: raw };
}

export interface ParsedWeightResult {
  value: number | null;
  unparseable: boolean;
  rawValue?: string;
}

export function parseWeightTons(raw: string | undefined): ParsedWeightResult {
  if (raw === undefined || raw === null || raw.trim().length === 0) {
    return { value: null, unparseable: false };
  }
  const clean = raw.trim().toLowerCase();

  // 1. Metric tonnes (default OSM metric unit: e.g. "5", "5t", "5 t", "5 tonnes", "5 tonne", "5 metric tons")
  const tonMatch = clean.match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:t|tonne|tonnes|metric\s*tons|metric\s*ton)?$/);
  if (tonMatch) {
    const val = parseFloat(tonMatch[1]);
    if (Number.isFinite(val) && val > 0) {
      return { value: val, unparseable: false, rawValue: raw };
    }
    return { value: null, unparseable: true, rawValue: raw };
  }

  // 2. Kilograms (e.g. "3500kg", "3500 kg", "3500 kilograms")
  const kgMatch = clean.match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:kg|kilograms|kilogram)$/);
  if (kgMatch) {
    const valKg = parseFloat(kgMatch[1]);
    if (Number.isFinite(valKg) && valKg > 0) {
      return { value: Math.round((valKg / 1000.0) * 1000) / 1000, unparseable: false, rawValue: raw };
    }
  }

  // 3. Pounds / lbs (e.g. "10000lbs", "10000 lbs", "10000lb", "10000 lb", "10000 pounds")
  const lbsMatch = clean.match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:lbs|lb|pounds|pound)$/);
  if (lbsMatch) {
    const valLbs = parseFloat(lbsMatch[1]);
    if (Number.isFinite(valLbs) && valLbs > 0) {
      const tons = valLbs * 0.00045359237;
      return { value: Math.round(tons * 1000) / 1000, unparseable: false, rawValue: raw };
    }
  }

  // 4. Short tons (e.g. "5st", "5 st", "5 short tons")
  const stMatch = clean.match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:st|short\s*tons|short\s*ton)$/);
  if (stMatch) {
    const valSt = parseFloat(stMatch[1]);
    if (Number.isFinite(valSt) && valSt > 0) {
      const tons = valSt * 0.90718474;
      return { value: Math.round(tons * 1000) / 1000, unparseable: false, rawValue: raw };
    }
  }

  // Ambiguous unit (e.g. bare "ton" without short/metric distinction) is rejected
  return { value: null, unparseable: true, rawValue: raw };
}

export interface AccessEvaluationResult {
  allowed: boolean;
  reason?: string;
  resolvedByTag?: string;
  tagWarnings: string[];
}

export function resolveAccessForEmergencyVehicle(
  tags: Record<string, string>,
  profile: VehicleProfile
): AccessEvaluationResult {
  const tagWarnings: string[] = [];

  const emergencyTag = tags['emergency']?.trim().toLowerCase();
  const motorVehicleTag = tags['motor_vehicle']?.trim().toLowerCase();
  const vehicleTag = tags['vehicle']?.trim().toLowerCase();
  const accessTag = tags['access']?.trim().toLowerCase();

  const allowPrivate = profile.allowPrivateAccessOverride;

  // 1. Highest priority in hierarchy: 'emergency' tag
  if (emergencyTag !== undefined) {
    if (['yes', 'designated', 'official'].includes(emergencyTag)) {
      return { allowed: true, resolvedByTag: 'emergency', tagWarnings };
    }
    if (emergencyTag === 'no') {
      return {
        allowed: false,
        reason: 'Explicit emergency access restriction: emergency=no',
        resolvedByTag: 'emergency',
        tagWarnings,
      };
    }
    if (emergencyTag === 'private') {
      if (allowPrivate) {
        return { allowed: true, resolvedByTag: 'emergency', tagWarnings };
      }
      return {
        allowed: false,
        reason: 'Restricted access: emergency=private',
        resolvedByTag: 'emergency',
        tagWarnings,
      };
    }
    tagWarnings.push(`Unrecognized emergency tag value: emergency=${emergencyTag}`);
  }

  // 2. Second priority: 'motor_vehicle' tag
  if (motorVehicleTag !== undefined) {
    if (['yes', 'permissive', 'destination', 'delivery', 'agricultural', 'forestry'].includes(motorVehicleTag)) {
      return { allowed: true, resolvedByTag: 'motor_vehicle', tagWarnings };
    }
    if (motorVehicleTag === 'no') {
      return {
        allowed: false,
        reason: 'Restricted access: motor_vehicle=no',
        resolvedByTag: 'motor_vehicle',
        tagWarnings,
      };
    }
    if (motorVehicleTag === 'private') {
      if (allowPrivate) {
        return { allowed: true, resolvedByTag: 'motor_vehicle', tagWarnings };
      }
      return {
        allowed: false,
        reason: 'Restricted access: motor_vehicle=private',
        resolvedByTag: 'motor_vehicle',
        tagWarnings,
      };
    }
    tagWarnings.push(`Unrecognized motor_vehicle tag value: motor_vehicle=${motorVehicleTag}`);
  }

  // 3. Third priority: 'vehicle' tag
  if (vehicleTag !== undefined) {
    if (['yes', 'permissive', 'destination', 'delivery'].includes(vehicleTag)) {
      return { allowed: true, resolvedByTag: 'vehicle', tagWarnings };
    }
    if (vehicleTag === 'no') {
      return {
        allowed: false,
        reason: 'Restricted access: vehicle=no',
        resolvedByTag: 'vehicle',
        tagWarnings,
      };
    }
    if (vehicleTag === 'private') {
      if (allowPrivate) {
        return { allowed: true, resolvedByTag: 'vehicle', tagWarnings };
      }
      return {
        allowed: false,
        reason: 'Restricted access: vehicle=private',
        resolvedByTag: 'vehicle',
        tagWarnings,
      };
    }
    tagWarnings.push(`Unrecognized vehicle tag value: vehicle=${vehicleTag}`);
  }

  // 4. Fourth priority: general 'access' tag
  if (accessTag !== undefined) {
    if (['yes', 'permissive', 'public'].includes(accessTag)) {
      return { allowed: true, resolvedByTag: 'access', tagWarnings };
    }
    if (accessTag === 'no') {
      return {
        allowed: false,
        reason: 'Restricted access: access=no',
        resolvedByTag: 'access',
        tagWarnings,
      };
    }
    if (accessTag === 'private') {
      if (allowPrivate) {
        return { allowed: true, resolvedByTag: 'access', tagWarnings };
      }
      return {
        allowed: false,
        reason: 'Restricted access: access=private',
        resolvedByTag: 'access',
        tagWarnings,
      };
    }
    tagWarnings.push(`Unrecognized access tag value: access=${accessTag}`);
  }

  // 5. Default on allowed highways: public access
  return { allowed: true, resolvedByTag: 'default', tagWarnings };
}

export interface WayProfileCheckResult {
  allowed: boolean; // Routable in graph (not BLOCKED)
  compatibilityStatus: EdgeCompatibilityStatus;
  isEligibleForStrictRouting: boolean;
  blockedReason?: string | null;
  reason?: string; // Backwards-compatible alias for blockedReason

  isDimensionUnverified: boolean;
  isPhysicalClearanceUnverified: boolean;
  unverifiedPhysicalDimensions: string[];
  unverifiedLegalRestrictions: string[];
  tagConflicts: string[];
  tagWarnings: string[];

  trackGrade: string | null;
  surfaceSuitability: string | null;

  widthMeters: number | null;
  effectiveWidthMeters: number | null;
  maxWidthMeters: number | null;
  maxPhysicalWidthMeters: number | null;

  maxHeightMeters: number | null;
  maxPhysicalHeightMeters: number | null;

  maxWeightTons: number | null;
  maxWeightRatingTons: number | null;
  maxAxleLoadTons: number | null;
}

export function evaluateWayForProfile(
  tags: Record<string, string>,
  profile: VehicleProfile
): WayProfileCheckResult {
  const highway = tags['highway'];
  if (!highway || !profile.allowedHighwayTypes.has(highway)) {
    const blockedReason = `Highway type '${highway ?? 'undefined'}' not permitted for profile ${profile.profileName}`;
    return {
      allowed: false,
      compatibilityStatus: 'BLOCKED',
      isEligibleForStrictRouting: false,
      blockedReason,
      reason: blockedReason,
      isDimensionUnverified: false,
      isPhysicalClearanceUnverified: false,
      unverifiedPhysicalDimensions: [],
      unverifiedLegalRestrictions: [],
      tagConflicts: [],
      tagWarnings: [],
      trackGrade: null,
      surfaceSuitability: null,
      widthMeters: null,
      effectiveWidthMeters: null,
      maxWidthMeters: null,
      maxPhysicalWidthMeters: null,
      maxHeightMeters: null,
      maxPhysicalHeightMeters: null,
      maxWeightTons: null,
      maxWeightRatingTons: null,
      maxAxleLoadTons: null,
    };
  }

  // Surface & Track quality evaluation (without assuming disaster/flood condition)
  let trackGrade: string | null = null;
  let surfaceSuitability: string | null = null;
  const tagWarnings: string[] = [];

  if (highway === 'track') {
    const rawTracktype = tags['tracktype'];
    if (rawTracktype) {
      trackGrade = rawTracktype.trim().toLowerCase();
      if (['grade3', 'grade4', 'grade5'].includes(trackGrade)) {
        surfaceSuitability = 'UNIMPROVED_ROUGH_TRACK';
        tagWarnings.push(
          `Track has unimproved surface grade (${trackGrade}); requires rugged 4x4 capability`
        );
      } else {
        surfaceSuitability = 'PAVED_OR_COMPACTED_TRACK';
      }
    }
  }

  // 1. Parse dimension and weight tags distinguishing physical vs legal
  const heightLegal = parseDimensionMeters(tags['maxheight']);
  const heightPhysical = parseDimensionMeters(tags['maxheight:physical']);

  const widthRoad = parseDimensionMeters(tags['width'] ?? tags['est_width']);
  const widthEffective = parseDimensionMeters(tags['width:effective']);
  const widthLegal = parseDimensionMeters(tags['maxwidth']);
  const widthPhysical = parseDimensionMeters(tags['maxwidth:physical']);

  const weightActual = parseWeightTons(tags['maxweight']);
  const weightRating = parseWeightTons(tags['maxweightrating']);
  const weightAxle = parseWeightTons(tags['maxaxleload']);

  // 2. Real semantic tag conflict detection
  const tagConflicts: string[] = [];
  if (
    widthRoad.value !== null &&
    widthEffective.value !== null &&
    widthEffective.value > widthRoad.value
  ) {
    tagConflicts.push(
      `Conflicting width: width:effective (${widthEffective.value}m) exceeds physical road width (${widthRoad.value}m)`
    );
  }
  if (
    widthRoad.value !== null &&
    widthPhysical.value !== null &&
    widthPhysical.value > widthRoad.value
  ) {
    tagConflicts.push(
      `Conflicting width: maxwidth:physical (${widthPhysical.value}m) exceeds physical road width (${widthRoad.value}m)`
    );
  }
  if (
    heightLegal.value !== null &&
    heightPhysical.value !== null &&
    heightPhysical.value < heightLegal.value
  ) {
    tagConflicts.push(
      `Conflicting height: maxheight:physical (${heightPhysical.value}m) is lower than legal maxheight sign (${heightLegal.value}m)`
    );
  }

  // 3. Track unverified physical dimensions vs unverified legal restrictions
  const unverifiedPhysicalDimensions: string[] = [];
  if (heightPhysical.value === null) {
    unverifiedPhysicalDimensions.push('maxheight:physical');
  }
  if (
    widthPhysical.value === null &&
    widthEffective.value === null &&
    widthRoad.value === null
  ) {
    unverifiedPhysicalDimensions.push('width');
    unverifiedPhysicalDimensions.push('width:physical');
  }

  const unverifiedLegalRestrictions: string[] = [];
  if (heightLegal.value === null) {
    unverifiedLegalRestrictions.push('maxheight');
  }
  if (widthLegal.value === null) {
    unverifiedLegalRestrictions.push('maxwidth');
  }
  if (weightActual.value === null) {
    unverifiedLegalRestrictions.push('maxweight');
  }
  if (weightRating.value === null) {
    unverifiedLegalRestrictions.push('maxweightrating');
  }
  if (weightAxle.value === null) {
    unverifiedLegalRestrictions.push('maxaxleload');
  }

  const isPhysicalClearanceUnverified = heightPhysical.value === null;

  const isSyntaxUnparseable =
    heightLegal.unparseable ||
    heightPhysical.unparseable ||
    widthRoad.unparseable ||
    widthEffective.unparseable ||
    widthLegal.unparseable ||
    widthPhysical.unparseable ||
    weightActual.unparseable ||
    weightRating.unparseable ||
    weightAxle.unparseable;

  const isDimensionUnverified = isSyntaxUnparseable || unverifiedPhysicalDimensions.length > 0;

  // 4. Vehicle safety margins & dimensions
  const latMargin = profile.dimensions.safetyMarginMeters?.lateralMeters ?? 0.0;
  const vertMargin = profile.dimensions.safetyMarginMeters?.verticalMeters ?? 0.0;

  const vehicleWidth = profile.dimensions.widthMeters;
  const vehicleHeight = profile.dimensions.heightMeters;
  const requiredWidth = vehicleWidth !== undefined ? vehicleWidth + latMargin : undefined;
  const requiredHeight = vehicleHeight !== undefined ? vehicleHeight + vertMargin : undefined;

  const vehicleActualWeight = profile.dimensions.actualWeightTons ?? profile.dimensions.weightTons;
  const vehicleRatedWeight = profile.dimensions.maxWeightRatingTons ?? vehicleActualWeight;
  const vehicleAxleLoad = profile.dimensions.axleLoadTons;

  // 5. Access Hierarchy Evaluation
  const accessResult = resolveAccessForEmergencyVehicle(tags, profile);
  tagWarnings.push(...accessResult.tagWarnings);

  const baseResultData = {
    isDimensionUnverified,
    isPhysicalClearanceUnverified,
    unverifiedPhysicalDimensions,
    unverifiedLegalRestrictions,
    tagConflicts,
    tagWarnings,
    trackGrade,
    surfaceSuitability,
    widthMeters: widthRoad.value,
    effectiveWidthMeters: widthEffective.value,
    maxWidthMeters: widthLegal.value,
    maxPhysicalWidthMeters: widthPhysical.value,
    maxHeightMeters: heightLegal.value,
    maxPhysicalHeightMeters: heightPhysical.value,
    maxWeightTons: weightActual.value,
    maxWeightRatingTons: weightRating.value,
    maxAxleLoadTons: weightAxle.value,
  };

  const block = (reason: string): WayProfileCheckResult => ({
    ...baseResultData,
    allowed: false,
    compatibilityStatus: 'BLOCKED',
    isEligibleForStrictRouting: false,
    blockedReason: reason,
    reason,
  });

  // If access is forbidden by hierarchy
  if (!accessResult.allowed) {
    return block(accessResult.reason ?? 'Restricted access');
  }

  // 6. PHYSICAL HEIGHT CONSTRAINT: Emergency cannot bypass physical barriers
  if (heightPhysical.value !== null) {
    if (requiredHeight !== undefined && requiredHeight > heightPhysical.value) {
      if (vehicleHeight !== undefined && vehicleHeight <= heightPhysical.value) {
        return block(
          `Physical safety barrier: Vehicle height (${vehicleHeight}m) with vertical safety margin (${vertMargin}m) exceeds maxheight:physical (${heightPhysical.value}m)`
        );
      }
      return block(
        `Physical barrier: Vehicle height (${vehicleHeight}m) exceeds maxheight:physical (${heightPhysical.value}m)`
      );
    }
  }

  // Legal height sign: If physical clearance is unverified, legal sign applies unless exempted by jurisdiction policy
  if (heightPhysical.value === null && heightLegal.value !== null) {
    const allowLegalHeightOverride =
      accessResult.allowed &&
      profile.emergencyExemptionEnabled &&
      profile.legalExemptionPolicy?.allowLegalHeightSignOverride === true;
    if (!allowLegalHeightOverride) {
      if (vehicleHeight !== undefined && vehicleHeight > heightLegal.value) {
        return block(
          `Physical barrier: Vehicle height (${vehicleHeight}m) exceeds maxheight (${heightLegal.value}m)`
        );
      }
    }
  }

  // 7. WEIGHT CONSTRAINTS: Actual loaded weight vs Rated GVWR vs Axle Load
  // Actual structural load: emergency access CANNOT bypass actual physical capacity!
  if (weightActual.value !== null) {
    if (vehicleActualWeight !== undefined && vehicleActualWeight > weightActual.value) {
      return block(
        `Physical barrier: Vehicle weight (${vehicleActualWeight}t) exceeds maxweight (${weightActual.value}t)`
      );
    }
  }

  // Rated weight (GVWR): compared against vehicle maxWeightRatingTons
  if (weightRating.value !== null) {
    if (vehicleRatedWeight !== undefined && vehicleRatedWeight > weightRating.value) {
      const allowRatingOverride =
        profile.emergencyExemptionEnabled &&
        profile.legalExemptionPolicy?.allowLegalWeightRatingSignOverride === true;
      if (!allowRatingOverride) {
        return block(
          `Legal weight rating barrier: Vehicle rated weight (${vehicleRatedWeight}t) exceeds maxweightrating (${weightRating.value}t)`
        );
      }
    }
  }

  // Axle load constraint: structural bridge/road limit
  if (weightAxle.value !== null) {
    if (vehicleAxleLoad !== undefined && vehicleAxleLoad > weightAxle.value) {
      return block(
        `Physical structural barrier: Vehicle axle load (${vehicleAxleLoad}t) exceeds maxaxleload (${weightAxle.value}t)`
      );
    }
  }

  // 8. PHYSICAL WIDTH CONSTRAINTS & SAFETY MARGIN
  // Chokepoint physical clearance (maxwidth:physical)
  if (widthPhysical.value !== null) {
    if (requiredWidth !== undefined && requiredWidth > widthPhysical.value) {
      if (vehicleWidth !== undefined && vehicleWidth <= widthPhysical.value) {
        return block(
          `Physical safety barrier: Vehicle width (${vehicleWidth}m) with lateral safety margin (${latMargin}m) exceeds maxwidth:physical (${widthPhysical.value}m)`
        );
      }
      return block(
        `Physical barrier: Vehicle width (${vehicleWidth}m) exceeds maxwidth:physical (${widthPhysical.value}m)`
      );
    }
  }

  // Usable travel width (width:effective)
  if (widthEffective.value !== null) {
    if (requiredWidth !== undefined && requiredWidth > widthEffective.value) {
      if (vehicleWidth !== undefined && vehicleWidth <= widthEffective.value) {
        return block(
          `Physical safety barrier: Vehicle width (${vehicleWidth}m) with lateral safety margin (${latMargin}m) exceeds width:effective (${widthEffective.value}m)`
        );
      }
      return block(
        `Physical barrier: Vehicle width (${vehicleWidth}m) exceeds width:effective (${widthEffective.value}m)`
      );
    }
  }

  // Physical road surface width (width)
  if (widthRoad.value !== null) {
    if (requiredWidth !== undefined && requiredWidth > widthRoad.value) {
      if (vehicleWidth !== undefined && vehicleWidth <= widthRoad.value) {
        return block(
          `Physical safety barrier: Vehicle width (${vehicleWidth}m) with lateral safety margin (${latMargin}m) exceeds road width (${widthRoad.value}m)`
        );
      }
      return block(
        `Physical barrier: Vehicle width (${vehicleWidth}m) exceeds road width (${widthRoad.value}m)`
      );
    }
  }

  // Legal maxwidth limit sign
  if (widthLegal.value !== null) {
    if (vehicleWidth !== undefined && vehicleWidth > widthLegal.value) {
      const allowLegalWidth =
        profile.emergencyExemptionEnabled &&
        profile.legalExemptionPolicy?.allowLegalWidthSignOverride === true;
      if (!allowLegalWidth) {
        return block(
          `Legal barrier: Vehicle width (${vehicleWidth}m) exceeds legal maxwidth (${widthLegal.value}m)`
        );
      }
    }
  }

  // 9. THREE-STATE COMPATIBILITY CLASSIFICATION:
  // If not blocked, determine if VERIFIED_COMPATIBLE vs UNVERIFIED
  // VERIFIED_COMPATIBLE requires:
  // - Physical clearance known and satisfies vehicle required height
  // - At least one physical width parameter known and satisfies vehicle required width
  // - No unparseable syntax or severe tag conflicts
  const hasVerifiedPhysicalClearance = heightPhysical.value !== null;
  const hasVerifiedPhysicalWidth =
    widthPhysical.value !== null || widthEffective.value !== null || widthRoad.value !== null;

  let compatibilityStatus: EdgeCompatibilityStatus;
  if (!hasVerifiedPhysicalClearance || !hasVerifiedPhysicalWidth || isSyntaxUnparseable || tagConflicts.length > 0) {
    compatibilityStatus = 'UNVERIFIED';
  } else {
    compatibilityStatus = 'VERIFIED_COMPATIBLE';
  }

  const isEligibleForStrictRouting = compatibilityStatus === 'VERIFIED_COMPATIBLE';

  return {
    ...baseResultData,
    allowed: true, // Routable (not BLOCKED)
    compatibilityStatus,
    isEligibleForStrictRouting,
    blockedReason: null,
  };
}
