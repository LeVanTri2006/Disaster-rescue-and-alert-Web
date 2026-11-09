/** Pure, synchronous TEST_ONLY orchestration. No I/O, production provider or
 * exported receipt cache. Returned summaries have no verifier provenance. */
import { EdgeQualifier } from './edge-qualifier';
import {
  evaluateTestExemption,
  ExemptionDecision,
} from './qualification-exemption-policy';
import { evaluateTestRevocation } from './qualification-revocation-policy';
import { DetachedDocumentInput } from './qualification-crypto-verifier';
import { loadIsolatedTestRegistry } from './qualification-authority-registry';
import {
  inspectVerifiedDocument,
  verifySignedDocument,
} from './qualification-crypto-verifier';
import {
  inspectVerifiedGraph,
  verifyGraphArtifact,
  GraphEdgeIdentity,
} from './qualification-artifact-verifier';
import {
  inspectVerifiedProfile,
  verifyProfileProvenance,
} from './qualification-profile-verifier';
import { verifyEdgeIdentity } from './qualification-identity-binding';
import {
  verifyEvidenceDocument,
  parseExemptionDocumentRecord,
} from './qualification-document-verifier';
import {
  ClockReading,
  inspectClock,
  verifyValidity,
} from './qualification-trusted-clock';
import {
  failure,
  metadata,
  VerificationResult,
} from './qualification-trust-types';
import {
  ALL_QUALIFICATION_CRITERIA,
  CriterionEvidenceRecord,
  NotApplicableEvidenceRecord,
} from './qualification-types';
import {
  isObject,
  isValidIsoTimestamp,
  validateCriterionEvidence,
} from './qualification-validation';
import {
  canonicalJson,
  immutableJson,
} from './qualification-verification-json';
import {
  diagnosticInput,
  documentClaim,
  graphEdgeMetadata,
  jsonSnapshot,
  onlyKeys,
  recordClaims,
} from './qualification-verification-adapters';
import {
  auditStep,
  finalState,
  receiptAudit,
} from './qualification-verification-audit';
import {
  ClaimedRecordDocument,
  CriterionCompleteness,
  TestVerificationContext,
  VerificationAuditStep,
  VerificationPipelineOutcome,
} from './qualification-verification-pipeline-types';

const consumedClockReadings = new WeakSet<object>();
/** Context is an OUT-OF-BAND, explicitly isolated test configuration. Request
 * payloads cannot select a root, clock, receipt, callback or production scope. */
export function createTestOnlyVerificationOrchestrator(
  context: TestVerificationContext,
) {
  const rootPublicKey = context.rootPublicKey,
    rootReference = context.rootReference,
    readClock = context.clock.read.bind(context.clock),
    scope = context.scope;
  return Object.freeze({
    verify(request: unknown): VerificationPipelineOutcome {
      const audit: VerificationAuditStep[] = [],
        completeness: CriterionCompleteness[] = [],
        evidence: CriterionEvidenceRecord[] = [],
        exemptions: NotApplicableEvidenceRecord[] = [],
        exemptionDecisions: ExemptionDecision[] = [];
      let at: string | null = null,
        lastEpoch = -Infinity,
        clockFailed = false;
      let profile: unknown,
        edge: GraphEdgeIdentity | undefined,
        graphVersion = '',
        graphDigest = '',
        flag: boolean | undefined;
      const add = (
        id: string,
        status: VerificationAuditStep['status'],
        codes: readonly string[],
        deps: readonly string[] = [],
      ) => audit.push(auditStep(id, status, codes, at, deps));
      function tick(): ClockReading | undefined {
        try {
          const candidate = readClock(),
            reading = inspectClock(candidate);
          if (
            !reading ||
            reading.kind !== 'TEST_ONLY' ||
            !isValidIsoTimestamp(reading.timestamp) ||
            consumedClockReadings.has(candidate)
          ) {
            clockFailed = true;
            return undefined;
          }
          consumedClockReadings.add(candidate);
          const epoch = Date.parse(reading.timestamp);
          if (epoch < lastEpoch) {
            clockFailed = true;
            return undefined;
          }
          lastEpoch = epoch;
          at = reading.timestamp;
          return clockFailed ? undefined : reading;
        } catch {
          clockFailed = true;
          return undefined;
        }
      }
      function step<T>(
        id: string,
        deps: readonly string[],
        invoke: (reading: ClockReading) => VerificationResult<T>,
      ): VerificationResult<T> {
        const reading = tick();
        let result: VerificationResult<T>;
        if (!reading)
          result = failure(metadata(id, id), 'VERIFIER_UNAVAILABLE', [
            'CLOCK_UNAVAILABLE_FORGED_REPLAYED_OR_BACKWARDS',
          ]);
        else if (
          deps.some(
            (d) =>
              !audit.some(
                (s) =>
                  s.stepId === d &&
                  (s.status === 'VERIFIED' || s.status === 'PASSED_TEST_ONLY'),
              ),
          )
        ) {
          add(id, 'BLOCKED', ['DEPENDENCY_NOT_VERIFIED'], deps);
          return failure(metadata(id, id, at), 'UNVERIFIED', [
            'DEPENDENCY_NOT_VERIFIED',
          ]);
        } else {
          try {
            result = invoke(reading);
          } catch {
            result = failure(metadata(id, id, at), 'INVALID', [
              'UNEXPECTED_VERIFIER_EXCEPTION',
            ]);
          }
        }
        audit.push(receiptAudit(id, result, deps));
        return result;
      }
      function revocationStep(
        id: string,
        claim: DetachedDocumentInput | undefined,
        registry: unknown,
        deps: readonly string[],
      ) {
        const result = step(`${id}:revocation`, deps, (reading) =>
          evaluateTestRevocation(
            registry,
            reading,
            claim!.authorityId,
            claim!.keyId,
            claim!.subjectId,
          ),
        );
        if (result.details)
          for (const name of [
            'registry',
            'authority',
            'key',
            'document',
          ] as const) {
            const facet = result.details[name];
            audit.push({
              ...auditStep(
                `${id}:revocation:${name}`,
                facet.verificationStatus,
                facet.diagnosticCodes,
                result.verificationTimestamp,
                [`${id}:revocation`],
                `${name.toUpperCase()}_LIFECYCLE`,
              ),
              lifecycleStatus: facet.status,
            });
          }
        return result;
      }
      try {
        const first = tick();
        add(
          'clock',
          first ? 'PASSED_TEST_ONLY' : 'VERIFIER_UNAVAILABLE',
          first
            ? ['ISOLATED_TEST_CLOCK_ONLY']
            : ['CLOCK_UNAVAILABLE_FORGED_REPLAYED_OR_BACKWARDS'],
        );
        if (!isObject(request)) {
          add('request', 'INCOMPLETE', ['REQUEST_REQUIRED']);
        } else {
          flag =
            typeof request.requireProductionApproved === 'boolean'
              ? request.requireProductionApproved
              : undefined;
          const allowed = [
            'mode',
            'evaluatedAt',
            'registry',
            'manifest',
            'graph',
            'profile',
            'approval',
            'binding',
            'evidence',
            'exemptions',
            'requireProductionApproved',
          ];
          const forbidden =
            !onlyKeys(request, allowed) ||
            scope !== 'TEST_ONLY' ||
            request.mode !== 'TEST_ONLY' ||
            flag === true ||
            (request.requireProductionApproved !== undefined &&
              typeof request.requireProductionApproved !== 'boolean');
          add(
            'request',
            forbidden ? 'INVALID' : 'PASSED_TEST_ONLY',
            forbidden
              ? ['PRODUCTION_MODE_OR_PAYLOAD_CONTEXT_REFUSED']
              : ['CLAIMED_INPUT_ONLY'],
          );
          const evaluationOK =
            isValidIsoTimestamp(request.evaluatedAt) &&
            first?.timestamp &&
            Date.parse(request.evaluatedAt) === Date.parse(first.timestamp);
          add(
            'evaluation-time',
            evaluationOK ? 'PASSED_TEST_ONLY' : first ? 'INVALID' : 'BLOCKED',
            evaluationOK
              ? ['EVALUATION_MATCHES_TEST_CLOCK']
              : ['CALLER_TIME_INVALID_OR_BACKDATED'],
            ['clock'],
          );
          // Snapshot all data and bytes before invoking any verifier or later clock callback.
          profile =
            request.profile === undefined
              ? undefined
              : jsonSnapshot(request.profile);
          const binding =
            request.binding === undefined
              ? undefined
              : jsonSnapshot(request.binding);
          const manifest = documentClaim(request.manifest, 'GRAPH_MANIFEST'),
            approval = documentClaim(request.approval, 'PROFILE_APPROVAL');
          const records = recordClaims(request.evidence, 'EVIDENCE'),
            exceptionRecords = recordClaims(
              request.exemptions ?? [],
              'EXEMPTION',
            );
          const registryClaim =
            isObject(request.registry) &&
            onlyKeys(request.registry, ['bytes', 'signatureBase64']) &&
            request.registry.bytes instanceof Uint8Array &&
            typeof request.registry.signatureBase64 === 'string'
              ? {
                  bytes: Buffer.from(request.registry.bytes),
                  signatureBase64: request.registry.signatureBase64,
                }
              : undefined;
          const g = request.graph;
          const graph =
            isObject(g) &&
            onlyKeys(g, [
              'bytes',
              'representation',
              'claimedDigest',
              'claimedVersion',
            ]) &&
            g.bytes instanceof Uint8Array &&
            (g.representation === 'JSON' || g.representation === 'JSON.GZ') &&
            (g.claimedDigest === undefined ||
              typeof g.claimedDigest === 'string') &&
            (g.claimedVersion === undefined ||
              typeof g.claimedVersion === 'string')
              ? {
                  bytes: Buffer.from(g.bytes),
                  representation: g.representation,
                  claimedDigest: g.claimedDigest,
                  claimedVersion: g.claimedVersion,
                }
              : undefined;
          const base = ['clock', 'request', 'evaluation-time'];
          for (const [id, exists] of [
            ['registry-input', !!registryClaim],
            ['manifest-input', !!manifest],
            ['approval-input', !!approval],
            ['graph-input', !!graph],
            ['profile-input', profile !== undefined],
            ['binding-input', binding !== undefined],
            ['evidence-input', !!records],
            ['exemptions-input', !!exceptionRecords],
          ] as const)
            add(
              id,
              exists ? 'PASSED_TEST_ONLY' : 'INCOMPLETE',
              exists
                ? ['CLAIM_SNAPSHOTTED']
                : ['CLAIM_MISSING_MALFORMED_OR_PAYLOAD_TRUST_INJECTION'],
            );
          const registry = step(
            'registry',
            [...base, 'registry-input'],
            (reading) =>
              loadIsolatedTestRegistry(
                {
                  bytes: registryClaim!.bytes,
                  signatureBase64: registryClaim!.signatureBase64,
                  rootPublicKey,
                  rootReference,
                },
                reading,
              ),
          );
          revocationStep('manifest', manifest, registry, [
            'registry',
            'manifest-input',
          ]);
          revocationStep('approval', approval, registry, [
            'registry',
            'approval-input',
          ]);
          const manifestReceipt = step(
            'manifest',
            ['registry', 'manifest-input', 'manifest:revocation'],
            (reading) => verifySignedDocument(manifest!, registry, reading),
          );
          const approvalReceipt = step(
            'approval',
            ['registry', 'approval-input', 'approval:revocation'],
            (reading) => verifySignedDocument(approval!, registry, reading),
          );
          const graphReceipt = step(
            'graph',
            ['manifest', 'graph-input'],
            (reading) =>
              verifyGraphArtifact(
                {
                  ...graph!,
                  representation:
                    graph!.representation === 'JSON.GZ' ? 'JSON.GZ' : 'JSON',
                  manifestVerification: manifestReceipt,
                },
                reading,
              ),
          );
          const profileReceipt = step(
            'profile',
            ['approval', 'profile-input'],
            (reading) =>
              verifyProfileProvenance(
                {
                  profile,
                  documentBytes: approval?.bytes,
                  documentVerification: approvalReceipt,
                },
                reading,
              ),
          );
          const identity = step(
            'identity',
            ['graph', 'profile', 'binding-input'],
            (reading) =>
              verifyEdgeIdentity(
                {
                  binding,
                  graphVerification: graphReceipt,
                  profileVerification: profileReceipt,
                },
                reading,
              ),
          );
          let edgeMetadata: unknown;
          const identityReading = tick();
          if (identity.status === 'VERIFIED' && identityReading) {
            const snapshot = inspectVerifiedGraph(
              graphReceipt,
              identityReading,
            );
            edge = snapshot?.graph.edges.find(
              (e) => e.id === identity.details.edgeId,
            );
            if (snapshot && edge && graph) {
              graphVersion = snapshot.graph.graphVersion;
              graphDigest = snapshot.details.computedDigest;
              edgeMetadata = graphEdgeMetadata(
                graph.bytes,
                graph.representation === 'JSON.GZ' ? 'JSON.GZ' : 'JSON',
                edge.id,
              );
            } else add('snapshot', 'INVALID', ['RECEIPT_REVALIDATION_FAILED']);
          }
          const authenticated: CriterionEvidenceRecord[] = [];
          const documentReceipts: {
            id: string;
            claim: ClaimedRecordDocument;
            receipt: VerificationResult<unknown>;
            category: 'EVIDENCE' | 'EXEMPTION';
          }[] = [];
          function documents(
            items: readonly ClaimedRecordDocument[],
            category: 'EVIDENCE' | 'EXEMPTION',
          ) {
            items.forEach((claim, i) => {
              const id = `${category.toLowerCase()}:${String(i).padStart(4, '0')}`;
              revocationStep(id, claim.document, registry, ['registry']);
              const signed = step(
                `${id}:signature`,
                ['identity', 'registry', `${id}:revocation`],
                (reading) =>
                  verifySignedDocument(claim.document, registry, reading),
              );
              documentReceipts.push({ id, claim, receipt: signed, category });
              step(
                `${id}:integrity`,
                [`${id}:signature`],
                (reading) =>
                  verifyEvidenceDocument(
                    {
                      category,
                      record: claim.record,
                      documentBytes: claim.document.bytes,
                      documentVerification: signed,
                      edgeMetadata,
                    },
                    reading,
                  ).integrity,
              );
              const auth = step(
                `${id}:authenticity`,
                [`${id}:signature`],
                (reading) =>
                  verifyEvidenceDocument(
                    {
                      category,
                      record: claim.record,
                      documentBytes: claim.document.bytes,
                      documentVerification: signed,
                      edgeMetadata,
                    },
                    reading,
                  ).authenticity,
              );
              const reading = tick();
              const doc = reading
                ? inspectVerifiedDocument(signed, category, reading)
                : undefined;
              const crossBound =
                identity.status === 'VERIFIED' &&
                doc &&
                isObject(doc.envelope.body.binding) &&
                canonicalJson(doc.envelope.body.binding) ===
                  canonicalJson(identity.details);
              const options = {
                binding:
                  identity.status === 'VERIFIED' ? identity.details : undefined,
                evaluatedAt: reading?.timestamp ?? undefined,
                edgeLengthMeters: edge?.lengthMeters,
              };
              const val =
                category === 'EVIDENCE'
                  ? validateCriterionEvidence(claim.record, options)
                  : (() => {
                      const ex = parseExemptionDocumentRecord(claim.record);
                      const matches =
                        !!ex &&
                        identity.status === 'VERIFIED' &&
                        (
                          [
                            'graphVersion',
                            'graphArtifactSha256',
                            'edgeId',
                            'canonicalGeometryHash',
                            'geometryHashVersion',
                            'qualificationPolicyVersion',
                          ] as const
                        ).every((k) => ex[k] === identity.details[k]);
                      return {
                        valid: matches,
                        errors: matches
                          ? []
                          : ['EXEMPTION_RECORD_TUPLE_MISMATCH'],
                      };
                    })();
              const bindingOK =
                !!crossBound && val.valid && auth.status === 'VERIFIED';
              add(
                `${id}:binding`,
                !reading
                  ? 'VERIFIER_UNAVAILABLE'
                  : identity.status !== 'VERIFIED' || auth.status !== 'VERIFIED'
                    ? 'BLOCKED'
                    : bindingOK
                      ? 'PASSED_TEST_ONLY'
                      : 'INVALID',
                bindingOK
                  ? ['FULL_SIGNED_TUPLE_BOUND']
                  : [
                      'SIGNED_RECORD_GRAPH_EDGE_PROFILE_POLICY_BINDING_FAILED',
                      ...val.errors,
                    ],
                [`${id}:authenticity`, 'identity'],
              );
              if (category === 'EVIDENCE') {
                const schema = validateCriterionEvidence(claim.record).value;
                if (schema) {
                  evidence.push(schema);
                  if (bindingOK) authenticated.push(schema);
                }
              } else {
                const schema = parseExemptionDocumentRecord(claim.record);
                if (schema) exemptions.push(schema);
              }
            });
          }
          documents(records ?? [], 'EVIDENCE');
          documents(exceptionRecords ?? [], 'EXEMPTION');
          function exemptionChecks(
            phase: string,
            reading: ClockReading | undefined,
          ) {
            exemptionDecisions.length = 0;
            for (const item of documentReceipts.filter(
              (d) => d.category === 'EXEMPTION',
            )) {
              const decision = evaluateTestExemption(
                {
                  registry,
                  record: item.claim.record,
                  document: item.claim.document,
                  documentBytes: item.claim.document.bytes,
                  documentVerification: item.receipt,
                  binding,
                  graphVerification: graphReceipt,
                  profileVerification: profileReceipt,
                  profileApprovalVerification: approvalReceipt,
                  profile,
                  edgeMetadata,
                  evidenceDocuments: documentReceipts
                    .filter((d) => d.category === 'EVIDENCE')
                    .map((d) => ({
                      record: d.claim.record,
                      documentBytes: d.claim.document.bytes,
                      documentVerification: d.receipt,
                    })),
                },
                reading,
              );
              exemptionDecisions.push(decision);
              const id = `${phase}${item.id}:application`;
              const status =
                decision.state === 'INVALID'
                  ? 'INVALID'
                  : decision.state === 'UNAVAILABLE'
                    ? 'VERIFIER_UNAVAILABLE'
                    : 'UNVERIFIED';
              audit.push({
                ...auditStep(
                  id,
                  status,
                  [
                    ...decision.diagnosticCodes,
                    'EXEMPTION_APPLICATION_UNAVAILABLE_NOT_APPLIED',
                  ],
                  reading?.timestamp ?? null,
                  [`${item.id}:authenticity`],
                  'EXEMPTION_APPLICABILITY',
                ),
                exemptionDecision: decision.state,
              });
              audit.push(
                auditStep(
                  `${id}:conflict`,
                  decision.evidenceConflict === 'NONE_OBSERVED'
                    ? 'PASSED_TEST_ONLY'
                    : 'UNVERIFIED',
                  decision.diagnosticCodes.filter((c) =>
                    /EVIDENCE_|FAILURE|CONFLICT/.test(c),
                  ),
                  reading?.timestamp ?? null,
                  [id],
                  'EXEMPTION_EVIDENCE_CONFLICT',
                ),
              );
            }
          }
          if (documentReceipts.some((d) => d.category === 'EXEMPTION'))
            exemptionChecks('', tick());

          const ids = [...(records ?? []), ...(exceptionRecords ?? [])].map(
            (r) => (isObject(r.record) ? r.record.evidenceId : undefined),
          );
          const duplicates = ids.some(
            (id, i) => typeof id === 'string' && ids.indexOf(id) !== i,
          );
          add(
            'unique-evidence-ids',
            duplicates ? 'INVALID' : 'PASSED_TEST_ONLY',
            duplicates ? ['DUPLICATE_EVIDENCE_ID'] : ['UNIQUE_EVIDENCE_IDS'],
          );
          for (const criterion of ALL_QUALIFICATION_CRITERIA) {
            const matches = evidence.filter((r) => r.criterion === criterion),
              auth = authenticated.filter((r) => r.criterion === criterion);
            const full = auth.some(
              (r) => r.spatialScope.scopeType === 'CONTINUOUS_FULL_EDGE',
            );
            completeness.push({
              criterion,
              recordCount: matches.length,
              authenticatedRecordCount: auth.length,
              declaredFullEdgeCoverage: full,
              actualSurveyCoverage: 'UNVERIFIED',
              physicalTruth: 'UNVERIFIED',
            });
            add(
              `completeness:${criterion}`,
              !matches.length || !full ? 'INCOMPLETE' : 'PASSED_TEST_ONLY',
              !matches.length
                ? ['CRITERION_MISSING']
                : !full
                  ? ['DECLARED_FULL_EDGE_COVERAGE_MISSING']
                  : [
                      'SIGNED_DECLARATION_ONLY_SURVEY_AND_PHYSICAL_TRUTH_UNVERIFIED',
                    ],
              ['identity'],
            );
          }
          revocationStep('final:manifest', manifest, registry, [
            'registry',
            'manifest-input',
          ]);
          revocationStep('final:approval', approval, registry, [
            'registry',
            'approval-input',
          ]);
          for (const item of documentReceipts)
            revocationStep(`final:${item.id}`, item.claim.document, registry, [
              'registry',
            ]);
          // End-of-run revalidation uses NEW readings and private provenance APIs.
          step('final:registry', ['registry'], (reading) =>
            loadIsolatedTestRegistry(
              {
                bytes: registryClaim!.bytes,
                signatureBase64: registryClaim!.signatureBase64,
                rootPublicKey,
                rootReference,
              },
              reading,
            ),
          );
          step('final:identity', ['identity', 'final:registry'], (reading) =>
            verifyEdgeIdentity(
              {
                binding,
                graphVerification: graphReceipt,
                profileVerification: profileReceipt,
              },
              reading,
            ),
          );
          for (const item of documentReceipts) {
            step(
              `${item.id}:final`,
              ['final:identity', `${item.id}:binding`],
              (reading) => {
                if (
                  !inspectVerifiedDocument(
                    item.receipt,
                    item.category,
                    reading,
                  ) ||
                  !inspectVerifiedProfile(profileReceipt, reading) ||
                  !inspectVerifiedGraph(graphReceipt, reading)
                )
                  return failure(
                    metadata('FINAL_REVALIDATION', item.id, reading.timestamp),
                    'UNVERIFIED',
                    ['RECEIPT_REVALIDATION_FAILED'],
                  );
                return verifyEvidenceDocument(
                  {
                    category: item.category,
                    record: item.claim.record,
                    documentBytes: item.claim.document.bytes,
                    documentVerification: item.receipt,
                    edgeMetadata,
                  },
                  reading,
                ).authenticity;
              },
            );
          }
          step('final:time', ['registry'], (reading) => {
            // Every receipt must still be valid at ONE final evaluation instant,
            // not merely at different instants earlier in this synchronous run.
            const registryNow = loadIsolatedTestRegistry(
              {
                bytes: registryClaim!.bytes,
                signatureBase64: registryClaim!.signatureBase64,
                rootPublicKey,
                rootReference,
              },
              reading,
            );
            const revocations = [
              manifest,
              approval,
              ...documentReceipts.map((d) => d.claim.document),
            ]
              .filter(
                (claim): claim is DetachedDocumentInput => claim !== undefined,
              )
              .map((claim, index) => {
                const result = evaluateTestRevocation(
                  registry,
                  reading,
                  claim.authorityId,
                  claim.keyId,
                  claim.subjectId,
                );
                const id = `shared:${index}:revocation`;
                audit.push(receiptAudit(id, result, ['registry']));
                if (result.details)
                  for (const name of [
                    'registry',
                    'authority',
                    'key',
                    'document',
                  ] as const) {
                    const facet = result.details[name];
                    audit.push({
                      ...auditStep(
                        `${id}:${name}`,
                        facet.verificationStatus,
                        facet.diagnosticCodes,
                        reading.timestamp,
                        [id],
                        `${name.toUpperCase()}_LIFECYCLE`,
                      ),
                      lifecycleStatus: facet.status,
                    });
                  }
                return result;
              });
            if (documentReceipts.some((d) => d.category === 'EXEMPTION'))
              exemptionChecks('shared:', reading);
            const identityNow = verifyEdgeIdentity(
              {
                binding,
                graphVerification: graphReceipt,
                profileVerification: profileReceipt,
              },
              reading,
            );
            const finalResults: VerificationResult<unknown>[] = [
              registryNow,
              identityNow,
              ...revocations,
            ];
            for (const item of documentReceipts) {
              const current = verifyEvidenceDocument(
                {
                  category: item.category,
                  record: item.claim.record,
                  documentBytes: item.claim.document.bytes,
                  documentVerification: item.receipt,
                  edgeMetadata,
                },
                reading,
              ).authenticity;
              finalResults.push(current);
              audit.push(
                receiptAudit(`shared:${item.id}:document`, current, [
                  `${item.id}:signature`,
                ]),
              );
            }
            // Preserve every independently observable denial at this same
            // instant, including revocation when the registry is stale.
            for (const rejected of [
              'INVALID',
              'REVOKED',
              'EXPIRED',
              'UNTRUSTED_ISSUER',
              'VERIFIER_UNAVAILABLE',
              'UNVERIFIED',
            ] as const)
              if (finalResults.some((r) => r.status === rejected))
                return failure(
                  metadata('FINAL_REVALIDATION', 'dossier', reading.timestamp),
                  rejected,
                  finalResults.flatMap((r) => r.diagnosticCodes),
                );
            if (
              !audit.some(
                (s) => s.stepId === 'final:identity' && s.status === 'VERIFIED',
              )
            )
              return failure(
                metadata('FINAL_REVALIDATION', 'identity', reading.timestamp),
                'UNVERIFIED',
                ['FINAL_IDENTITY_NOT_VERIFIED'],
              );

            return verifyValidity(
              {
                validFrom: first?.timestamp,
                validUntil: reading.timestamp,
                revocationStatus: 'ACTIVE',
              },
              reading,
            );
          });
        }
      } catch {
        add('pipeline-exception', 'INVALID', ['UNEXPECTED_PIPELINE_EXCEPTION']);
      }
      // Deliberately pass no receipt/context to the engine. Even rejected or
      // incomplete requests are compared using the same locked diagnostic API.
      const diagnosticQualification = new EdgeQualifier().qualifyEdge(
        diagnosticInput(
          edge,
          profile,
          evidence,
          exemptions,
          at ?? '',
          graphVersion,
          graphDigest,
          flag,
        ),
      );
      add(
        'diagnostic-engine',
        diagnosticQualification.purpose === 'DIAGNOSTIC_ONLY' &&
          diagnosticQualification.trustStatus === 'UNAVAILABLE' &&
          diagnosticQualification.qualificationStatus === 'UNVERIFIED' &&
          diagnosticQualification.isProductionApproved === false
          ? 'PASSED_TEST_ONLY'
          : 'INVALID',
        ['QUALIFICATION_PRODUCTION_LOCK_CHECK'],
      );
      // Final clock observation closes the time-of-check window around diagnostics.
      const finish = tick();
      if (!finish)
        add('clock-final', 'VERIFIER_UNAVAILABLE', [
          'CLOCK_UNAVAILABLE_FORGED_REPLAYED_OR_BACKWARDS',
        ]);
      else if (
        at &&
        audit.some((s) => s.stepId === 'final:time' && s.timestamp !== at)
      )
        add('clock-final', 'UNVERIFIED', [
          'CLOCK_ADVANCED_AFTER_FINAL_VALIDATION',
        ]);
      else add('clock-final', 'PASSED_TEST_ONLY', ['FINAL_CLOCK_OBSERVED']);
      const pipelineState = finalState(audit);
      audit.push({
        ...auditStep(
          'pipeline-final',
          pipelineState === 'VERIFIED_TEST_ONLY'
            ? 'PASSED_TEST_ONLY'
            : pipelineState === 'REJECTED'
              ? 'INVALID'
              : pipelineState === 'VERIFIER_UNAVAILABLE'
                ? 'VERIFIER_UNAVAILABLE'
                : 'UNVERIFIED',
          ['PIPELINE_RESULT_IS_NOT_A_CREDENTIAL'],
          at,
          audit.map((s) => s.stepId),
          'PIPELINE_FINAL',
        ),
        pipelineState,
      });
      return immutableJson({
        state: finalState(audit),
        scope: 'TEST_ONLY',
        productionAuthoritative: false,
        qualificationEligible: false,
        auditIsCredential: false,
        audit,
        completeness,
        diagnosticQualification,
        exemptionDecisions,
        diagnosticCodes: [
          ...new Set(audit.flatMap((s) => s.diagnosticCodes)),
        ].sort(),
      });
    },
  });
}
