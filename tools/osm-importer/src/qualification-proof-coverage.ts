import { parseSurveyExtent } from './qualification-proof-validation';
import {
  isFiniteNumber,
  isObject,
  isNonEmptyString,
} from './qualification-validation';
import { immutableJson } from './qualification-verification-json';
/** Interval arithmetic only. No source, survey, calibration or physical-truth authority. */
export function evaluateDeclaredSurveyCoverage(
  edgeLength: unknown,
  observations: unknown,
) {
  const codes: string[] = [
    'DECLARED_COVERAGE',
    'AUTHORITATIVE_COVERAGE_UNVERIFIED',
  ];
  const retainedObservationIds: string[] = [],
    bottleneckIds: string[] = [],
    intervals: { from: number; to: number }[] = [];
  try {
    if (!isFiniteNumber(edgeLength) || edgeLength <= 0)
      throw new Error('COVERAGE_EDGE_LENGTH_INVALID');
    if (!Array.isArray(observations))
      throw new Error('COVERAGE_OBSERVATIONS_REQUIRED');
    const ids = new Set<string>();
    for (const item of observations) {
      if (!isObject(item) || !isNonEmptyString(item.measurementId))
        throw new Error('COVERAGE_OBSERVATION_INVALID');
      if (ids.has(item.measurementId))
        throw new Error('COVERAGE_DUPLICATE_OBSERVATION_ID');
      ids.add(item.measurementId);
      retainedObservationIds.push(item.measurementId);
      const extent = parseSurveyExtent(item.extent, edgeLength);
      if (item.finding === 'SUSPECTED_BOTTLENECK')
        bottleneckIds.push(item.measurementId);
      if (
        item.supersedesMeasurementId !== null &&
        item.supersedesMeasurementId !== undefined
      )
        codes.push('SUPERSESSION_NOT_APPLIED');
      if (item.disposition !== 'ACTIVE') {
        codes.push('INELIGIBLE_OBSERVATION_RETAINED_NOT_USED_FOR_COVERAGE');
        continue;
      }
      if (extent.kind === 'SPAN')
        intervals.push({ from: extent.from, to: extent.to });
      else codes.push('POINT_IS_NOT_FULL_EDGE_COVERAGE');
    }
    intervals.sort((a, b) => a.from - b.from || a.to - b.to);
    const gaps: { from: number; to: number }[] = [];
    let end = 0;
    for (const interval of intervals) {
      if (interval.from > end) gaps.push({ from: end, to: interval.from });
      end = Math.max(end, interval.to);
    }
    if (end < edgeLength) gaps.push({ from: end, to: edgeLength });
    const complete = gaps.length === 0 && intervals.length > 0;
    codes.push(
      complete ? 'GEOMETRIC_COVERAGE_VALID' : 'GEOMETRIC_COVERAGE_INCOMPLETE',
    );
    return immutableJson({
      state: complete
        ? ('GEOMETRIC_COVERAGE_VALID' as const)
        : ('INCOMPLETE' as const),
      authoritativeCoverage: 'UNVERIFIED' as const,
      physicalTruth: 'UNVERIFIED' as const,
      gaps,
      retainedObservationIds: retainedObservationIds.sort(),
      bottleneckIds: bottleneckIds.sort(),
      diagnosticCodes: [...new Set(codes)].sort(),
    });
  } catch (err: unknown) {
    return immutableJson({
      state: 'INVALID' as const,
      authoritativeCoverage: 'UNVERIFIED' as const,
      physicalTruth: 'UNVERIFIED' as const,
      gaps: [],
      retainedObservationIds: retainedObservationIds.sort(),
      bottleneckIds: bottleneckIds.sort(),
      diagnosticCodes: [
        ...new Set([
          ...codes,
          err instanceof Error && /^(COVERAGE_|SURVEY_)/.test(err.message)
            ? err.message
            : 'COVERAGE_VALIDATION_ERROR',
        ]),
      ].sort(),
    });
  }
}
