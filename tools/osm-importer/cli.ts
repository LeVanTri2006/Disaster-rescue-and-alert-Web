import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as crypto from 'crypto';
import { ImportOptions, ImportResult, OsmImporter } from './src/osm-importer';
import { DEFAULT_RESCUE_TRUCK_4X4_PROFILE } from './src/vehicle-profile';
import {
  CliMode,
  DA_NANG_CENTRAL_PRODUCTION_BOUNDING_BOX,
  FIXTURE_BOUNDING_BOX,
  RoutingManifest,
} from './src/types';

export { CliMode };

export interface CliOptions {
  mode?: CliMode;
  inputPath?: string;
  outputDir?: string;
  osmSnapshotTimestamp?: string;
  graphVersion?: string;
}

export function parseCliArgs(args: string[]): CliOptions {
  let mode: CliMode | undefined;
  let inputPath: string | undefined;
  let outputDir: string | undefined;
  let osmSnapshotTimestamp: string | undefined;
  let graphVersion: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--mode=')) {
      mode = parseMode(arg.slice('--mode='.length).trim());
    } else if (arg === '--mode' && i + 1 < args.length) {
      mode = parseMode(args[++i].trim());
    } else if (arg.startsWith('--input=')) {
      inputPath = arg.slice('--input='.length).trim();
    } else if ((arg === '--input' || arg === '-i') && i + 1 < args.length) {
      inputPath = args[++i].trim();
    } else if (arg.startsWith('--output=')) {
      outputDir = arg.slice('--output='.length).trim();
    } else if ((arg === '--output' || arg === '-o') && i + 1 < args.length) {
      outputDir = args[++i].trim();
    } else if (arg.startsWith('--timestamp=') || arg.startsWith('--osmSnapshotTimestamp=')) {
      const idx = arg.indexOf('=');
      osmSnapshotTimestamp = arg.slice(idx + 1).trim();
    } else if (arg === '--timestamp' && i + 1 < args.length) {
      osmSnapshotTimestamp = args[++i].trim();
    } else if (arg.startsWith('--graphVersion=')) {
      graphVersion = arg.slice('--graphVersion='.length).trim();
    } else if (arg === '--graphVersion' && i + 1 < args.length) {
      graphVersion = args[++i].trim();
    } else if (!arg.startsWith('-')) {
      if (!inputPath) {
        inputPath = arg;
      } else if (!outputDir) {
        outputDir = arg;
      }
    }
  }

  return { mode, inputPath, outputDir, osmSnapshotTimestamp, graphVersion };
}

function parseMode(val: string): CliMode {
  const upper = val.toUpperCase();
  if (upper === 'REAL' || upper === 'REAL_OSM_SNAPSHOT') {
    return 'REAL_OSM_SNAPSHOT';
  }
  if (upper === 'FIXTURE') {
    return 'FIXTURE';
  }
  throw new Error(`Invalid CLI mode: "${val}". Supported modes: FIXTURE, REAL_OSM_SNAPSHOT (or --mode=real)`);
}

export function runCli(
  inputOrOptions?: string | CliOptions,
  outputDirArg?: string
): { result: ImportResult; realSha256: string; manifest: RoutingManifest } {
  let mode: CliMode = 'FIXTURE';
  let inputPath: string | undefined;
  let outputDir: string | undefined;
  let explicitTimestamp: string | undefined;
  let customGraphVersion: string | undefined;

  if (typeof inputOrOptions === 'string') {
    inputPath = inputOrOptions;
    outputDir = outputDirArg;
    mode = 'FIXTURE';
  } else if (typeof inputOrOptions === 'object' && inputOrOptions !== null) {
    mode = inputOrOptions.mode ?? 'FIXTURE';
    inputPath = inputOrOptions.inputPath;
    outputDir = inputOrOptions.outputDir ?? outputDirArg;
    explicitTimestamp = inputOrOptions.osmSnapshotTimestamp;
    customGraphVersion = inputOrOptions.graphVersion;
  }

  if (mode !== 'FIXTURE' && mode !== 'REAL_OSM_SNAPSHOT') {
    throw new Error(`Invalid CLI mode: "${mode}". Supported modes: FIXTURE, REAL_OSM_SNAPSHOT (or --mode=real)`);
  }

  const isReal = mode === 'REAL_OSM_SNAPSHOT';
  const xmlPath =
    inputPath ??
    (isReal
      ? path.join(__dirname, 'input', 'danang_central.osm.xml')
      : path.join(__dirname, 'fixtures', 'test_fixture.osm.xml'));
  const targetDir =
    outputDir ??
    (isReal
      ? path.join(__dirname, 'output-real')
      : path.join(__dirname, 'output'));

  const boundingBox = isReal
    ? DA_NANG_CENTRAL_PRODUCTION_BOUNDING_BOX
    : FIXTURE_BOUNDING_BOX;
  const boundingBoxType: 'FIXTURE' | 'PRODUCTION' = isReal ? 'PRODUCTION' : 'FIXTURE';
  const graphVersion = customGraphVersion ?? (isReal ? 'dn_central_real_v1' : 'dn_central_fixture_v2');

  if (!fs.existsSync(xmlPath)) {
    const errorMsg = `Input file not found: ${xmlPath}`;
    console.error(`[OSM Importer] Error: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log(`[OSM Importer] Mode: ${mode}`);
  console.log(`[OSM Importer] Input File: ${xmlPath}`);
  console.log(`[OSM Importer] Bounding Box Type: ${boundingBoxType}`);

  const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
  const importer = new OsmImporter();
  const startTime = Date.now();

  const importOptions: ImportOptions = {
    mode,
    graphVersion,
    vehicleProfile: DEFAULT_RESCUE_TRUCK_4X4_PROFILE,
    boundingBox,
    boundingBoxType,
    strictRescueMode: true,
    ...(explicitTimestamp ? { osmSnapshotTimestamp: explicitTimestamp } : {}),
    ...(!isReal
      ? {
          fixtureGeneratedAt: '2026-11-03T16:45:00.000Z',
          ...(!explicitTimestamp ? { osmSnapshotTimestamp: '2024-11-01T00:00:00.000Z' } : {}),
        }
      : {}),
  };

  const result = importer.importXml(xmlContent, importOptions);
  const elapsedMs = Date.now() - startTime;

  // 1. Write BaseRoadGraph JSON
  const graphJson = JSON.stringify(result.graph, null, 2);
  const graphJsonPath = path.join(targetDir, 'BaseRoadGraph.json');
  fs.writeFileSync(graphJsonPath, graphJson, 'utf-8');

  // 2. Write Diagnostics JSON
  const diagJson = JSON.stringify(result.diagnostics, null, 2);
  const diagJsonPath = path.join(targetDir, 'ImportDiagnostics.json');
  fs.writeFileSync(diagJsonPath, diagJson, 'utf-8');

  // 3. Compress BaseRoadGraph to .gz and compute real byte-level SHA-256
  const gzippedBytes = zlib.gzipSync(Buffer.from(graphJson, 'utf-8'));
  const gzippedPath = path.join(targetDir, 'BaseRoadGraph.json.gz');
  fs.writeFileSync(gzippedPath, gzippedBytes);

  const realSha256 = crypto.createHash('sha256').update(gzippedBytes).digest('hex');

  // 4. Write RoutingManifest
  const manifest: RoutingManifest = {
    $schema: 'https://emergency-rescue.vn/schemas/v2/routing-manifest.json',
    manifestVersion: '2.1.0',
    generatedAt: new Date().toISOString(),
    graphVersion: result.graph.graphVersion,
    osmSnapshotTimestamp: result.graph.osmSnapshotTimestamp ?? (isReal ? '' : '2024-11-01T00:00:00.000Z'),
    ...(result.graph.fixtureGeneratedAt ? { fixtureGeneratedAt: result.graph.fixtureGeneratedAt } : {}),
    importerVersion: 'osm-importer-v2.3-prototype',
    vehicleProfile: result.graph.vehicleProfile,
    boundingBoxType,
    boundingBox: result.graph.boundingBox,
    targetProductionBoundingBox: DA_NANG_CENTRAL_PRODUCTION_BOUNDING_BOX,
    bundle: {
      fileName: 'BaseRoadGraph.json.gz',
      compressedSizeBytes: gzippedBytes.length,
      uncompressedSizeBytes: Buffer.byteLength(graphJson, 'utf-8'),
      sha256: realSha256,
    },
    activeHazardSnapshotVersion: null,
    hazardSnapshotStatus: 'NOT_INCLUDED',
    hazardAssessmentPolicy: 'HAZARD_DATA_REQUIRED_FOR_LIVE_CONDITIONS',
    isRestrictionStrictRoutingEligible: result.graph.isRestrictionStrictRoutingEligible,
    restrictionStrictRoutingReadiness: result.graph.restrictionStrictRoutingReadiness,
    unsupportedRestrictionsSummary: {
      totalCount: result.diagnostics.unsupportedRestrictionsCount,
      enforcementPolicy: 'FAIL_CLOSED_IN_STRICT_MODE',
    },
    canAttemptStrictRouting: result.graph.canAttemptStrictRouting,
    isStrictRoutingEligible: result.graph.isStrictRoutingEligible,
    strictRoutingReadiness: result.graph.strictRoutingReadiness,
    overallStrictRoutingReadiness: result.graph.overallStrictRoutingReadiness,
    edgeSafetySummary: result.graph.edgeSafetySummary,
  };

  const manifestPath = path.join(targetDir, 'RoutingManifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`[OSM Importer] Import completed in ${elapsedMs}ms!`);
  console.log(` - Mode: ${mode}`);
  console.log(` - Input File: ${xmlPath}`);
  console.log(` - Bounding Box Type: ${boundingBoxType}`);
  console.log(` - OSM Snapshot Timestamp: ${result.graph.osmSnapshotTimestamp}`);
  console.log(` - Nodes Read: ${result.diagnostics.nodesRead}, Nodes Created: ${result.diagnostics.nodesCreated}`);
  console.log(` - Ways Read: ${result.diagnostics.waysRead}, Directed Edges Created: ${result.diagnostics.directedEdgesCreated}`);
  console.log(` - Turn Restrictions: ${result.diagnostics.turnRestrictionsRead} (Supported: ${result.diagnostics.supportedRestrictionsCount}, Unsupported: ${result.diagnostics.unsupportedRestrictionsCount}, Exempt: ${result.diagnostics.exemptRestrictionsCount})`);
  console.log(` - Restriction Readiness: ${result.graph.restrictionStrictRoutingReadiness} (Eligible: ${result.graph.isRestrictionStrictRoutingEligible})`);
  console.log(` - Overall Strict Readiness: ${result.graph.overallStrictRoutingReadiness} (Can Attempt Strict Routing: ${result.graph.canAttemptStrictRouting})`);
  console.log(` - Directed Edges in Graph: ${result.graph.edgeSafetySummary.totalEdges} (Verified: ${result.graph.edgeSafetySummary.verifiedCompatibleEdges}, Unverified: ${result.graph.edgeSafetySummary.unverifiedEdges}, Blocked: ${result.graph.edgeSafetySummary.blockedEdges} | ${result.graph.edgeSafetySummary.strictSafeEdgesPercent}% verified)`);
  console.log(` - Blocked OSM Ways: ${result.diagnostics.blockedWaysCount} (Excluded: ${result.diagnostics.excludedBlockedWaysCount}, Retained: ${result.diagnostics.retainedBlockedWaysCount})`);
  console.log(` - Output written to: ${targetDir}`);
  console.log(` - Real Gzip Checksum SHA-256: ${realSha256}`);

  return { result, realSha256, manifest };
}

if (require.main === module || (process.argv[1] && process.argv[1].endsWith('cli.ts'))) {
  try {
    const options = parseCliArgs(process.argv.slice(2));
    runCli(options);
  } catch (err: any) {
    console.error(`[OSM Importer] Error: ${err.message}`);
    process.exit(1);
  }
}
