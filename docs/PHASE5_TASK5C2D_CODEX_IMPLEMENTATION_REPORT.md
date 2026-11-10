# PHASE 5 – TASK 5C.2D: AUTHORITATIVE PROOF CONTRACTS, KEY ROTATION & PROVIDER READINESS

Ngày hoàn tất: 06/11/2026, Asia/Bangkok.
Repository: /home/vantri/AndroidStudioProjects/canh-bao-thien-tai-backend-app.

## 1. Executive Summary

**CONDITIONAL PASS – foundation độc lập trong TEST_ONLY. Production qualification và readiness vẫn khóa.**

Đã thêm proof schemas/validators/binding, interval coverage, registry v3 nhiều khóa, snapshot checkpoint contract và chín provider interfaces cùng contract-readiness checker. Không sửa source/test hiện có. Không tự áp dụng proof vào exemption hoặc engine.

**148 tests mới, 1.073/1.073 backend tests trên 43 suites PASS.** Typecheck, Nest build và golden vectors PASS. Zero skipped/snapshots trong final full run. Toàn bộ **76/76 baseline files** giữ nguyên SHA-256 và mtime_ns, gồm 20 artifacts.

Các giới hạn quyết định: chưa có production PKI/provider/dữ liệu pháp lý, hiệu chuẩn hoặc khảo sát thực; checkpoint chỉ bảo vệ trong vòng đời process; historical signing time chưa được xác thực. Các trường hợp phụ thuộc các nguồn này giữ UNVERIFIED/UNAVAILABLE/BLOCKED. Không tạo production trust giả.

Bất biến engine:

    purpose = DIAGNOSTIC_ONLY
    trustStatus = UNAVAILABLE
    qualificationStatus = UNVERIFIED
    isProductionApproved = false

Báo cáo roadmap riêng: docs/PHASE5_PRODUCTION_READINESS_GAP_REPORT.md. Không commit/push/deploy hoặc triển khai 5C.2E.

## 2. Baseline Repository Status

Đã kiểm tra pwd, Git status/diff, AGENTS.md áp dụng, source/contracts/tests/golden và các báo cáo 5C.2C/2B/2A/1R/5B.1. Không tìm thấy AGENTS.md áp dụng tại repository/thư mục cha. Tài liệu lịch sử 5B.1 chứa claims chưa phải bằng chứng thực thi hiện tại; quyết định task dựa trên code và tests hiện hành.

Node v26.8.2; TypeScript 6.0.3. Baseline targeted: **613/613 tests, 13 suites PASS, Jest 5.285s**. 925/39 là full-run lịch sử 5C.2C; không chạy full baseline lần nữa trước sửa.

76 baseline entries: 27 source, 20 test/fixture/oracle, một CLI, tám docs và 20 artifacts. SHA-256/mtime_ns chụp trước mọi test task; timestamp lưu bằng chuỗi decimal, không mất precision qua JavaScript number.

Git status ban đầu:

     M tools/osm-importer/src/osm-importer.ts
     M tools/osm-importer/src/types.ts
     M tools/osm-importer/test/osm-importer.spec.ts
     M tsconfig.build.tsbuildinfo
    ?? docs/
    ?? tools/osm-importer/src/edge-qualifier.ts
    ?? tools/osm-importer/src/qualification-artifact-verifier.ts
    ?? tools/osm-importer/src/qualification-authority-registry.ts
    ?? tools/osm-importer/src/qualification-crypto-verifier.ts
    ?? tools/osm-importer/src/qualification-document-verifier.ts
    ?? tools/osm-importer/src/qualification-evidence.ts
    ?? tools/osm-importer/src/qualification-exemption-policy.ts
    ?? tools/osm-importer/src/qualification-geometry.ts
    ?? tools/osm-importer/src/qualification-identity-binding.ts
    ?? tools/osm-importer/src/qualification-profile-verifier.ts
    ?? tools/osm-importer/src/qualification-revocation-policy.ts
    ?? tools/osm-importer/src/qualification-trust-types.ts
    ?? tools/osm-importer/src/qualification-trusted-clock.ts
    ?? tools/osm-importer/src/qualification-types.ts
    ?? tools/osm-importer/src/qualification-validation.ts
    ?? tools/osm-importer/src/qualification-verification-adapters.ts
    ?? tools/osm-importer/src/qualification-verification-audit.ts
    ?? tools/osm-importer/src/qualification-verification-json.ts
    ?? tools/osm-importer/src/qualification-verification-orchestrator.ts
    ?? tools/osm-importer/src/qualification-verification-pipeline-types.ts
    ?? tools/osm-importer/src/via-way-resolver.ts
    ?? tools/osm-importer/test/edge-qualifier.spec.ts
    ?? tools/osm-importer/test/qualification-artifact-verifier.spec.ts
    ?? tools/osm-importer/test/qualification-crypto-verifier.spec.ts
    ?? tools/osm-importer/test/qualification-exemption-policy.spec.ts
    ?? tools/osm-importer/test/qualification-fixtures.ts
    ?? tools/osm-importer/test/qualification-geometry-golden.json
    ?? tools/osm-importer/test/qualification-identity-binding.spec.ts
    ?? tools/osm-importer/test/qualification-independent-revocation.spec.ts
    ?? tools/osm-importer/test/qualification-profile-document.spec.ts
    ?? tools/osm-importer/test/qualification-remediation.spec.ts
    ?? tools/osm-importer/test/qualification-trust-boundary.spec.ts
    ?? tools/osm-importer/test/qualification-trusted-clock.spec.ts
    ?? tools/osm-importer/test/qualification-verification-fault-injection.spec.ts
    ?? tools/osm-importer/test/qualification-verification-integration.spec.ts
    ?? tools/osm-importer/test/qualification-verification-pipeline-fixtures.ts
    ?? tools/osm-importer/test/qualification-verification-pipeline-security.spec.ts
    ?? tools/osm-importer/test/qualification-verification-test-fixtures.ts
    ?? tools/osm-importer/test/verify-qualification-golden.py
    ?? tools/osm-importer/test/via-way-resolver.spec.ts

Không reset/clean/restore. Các thay đổi tracked importer/types/importer test và build cache đã có trước task, không gán cho 5C.2D.

## 3. Files Created/Modified

**Chỉ tạo 16 file mới: 8 source + 4 specs + 2 fixtures + 2 reports. Zero source/test cũ bị sửa.**

| File mới | Vai trò |
|---|---|
| tools/osm-importer/src/qualification-proof-types.ts | Common/legal/inventory/survey/reference/binding contracts |
| tools/osm-importer/src/qualification-proof-validation.ts | Unknown-input schema guards và immutable schema values |
| tools/osm-importer/src/qualification-proof-coverage.ts | Declared observations, interval union/gaps và bottleneck retention |
| tools/osm-importer/src/qualification-proof-binding.ts | Exact document/registry/graph/edge/structure/profile/policy binding và separated assessments |
| tools/osm-importer/src/qualification-registry-checkpoint.ts | Atomic trusted-store interface và process-only isolated test store |
| tools/osm-importer/src/qualification-multikey-registry.ts | Native Ed25519 v3 registry/documents, rotation, lifecycle và provenance |
| tools/osm-importer/src/qualification-provider-contracts.ts | Nine provider interfaces, availability và explicit unconfigured adapters |
| tools/osm-importer/src/qualification-provider-readiness.ts | Contract exercise, provenance-bound observations, production BLOCKED |
| tools/osm-importer/test/qualification-authoritative-proof-validation.spec.ts | 34 schema/coverage cases |
| tools/osm-importer/test/qualification-authoritative-proof-binding.spec.ts | 30 signed-proof/binding/engine-lock cases |
| tools/osm-importer/test/qualification-multikey-rotation.spec.ts | 53 native crypto/rotation/rollback/security cases |
| tools/osm-importer/test/qualification-provider-readiness.spec.ts | 31 provider/availability/readiness cases |
| tools/osm-importer/test/qualification-authoritative-proof-fixtures.ts | Typed legal/inventory/survey claims và verified test graph/profile |
| tools/osm-importer/test/qualification-multikey-test-fixtures.ts | Ephemeral native Ed25519 root/keys, signed v3 snapshots/documents |
| docs/PHASE5_TASK5C2D_CODEX_IMPLEMENTATION_REPORT.md | Báo cáo này |
| docs/PHASE5_PRODUCTION_READINESS_GAP_REPORT.md | Capability matrix, blockers, milestones và roadmap |

Common types/validators được gom để các proof dùng cùng binding và schema rules. Không cần sửa v2 consumers để tạo một protocol v3 độc lập; compatibility được test theo cả hai hướng.

Build tái tạo dist và incremental tsconfig.build.tsbuildinfo vốn đã dirty theo config hiện có. Build/Jest cache không nằm trong cam kết graph/source preservation. Không cài dependency hoặc đổi config.

## 4. Proof Contract Architecture

Proof schema: qualification-authoritative-proof-v1. Các dữ liệu được phân biệt:

    Claimed proof
      -> schema validation (không tạo authority)
      -> raw bytes digest
      -> original v3 document receipt, current snapshot và key permission
      -> full directed-edge/profile/policy binding với existing verified graph
      -> structure/document references và survey coverage diagnostics
      -> BOUND_TEST_ONLY / INVALID / INCOMPLETE / CONFLICTING / UNAVAILABLE

BOUND_TEST_ONLY chỉ nói nội dung test document và tuple nhất quán. Nó không phải authoritative legal applicability, verified survey coverage hoặc physical truth. Không có consumer production nhận state này làm qualification.

Proof assessment là summary không có quyền cấp production. Registry/document receipts dùng private WeakMaps. Không nhận callback verifier, public payload key hoặc object verified=true để mint provenance.

## 5. Legal Basis Contract

LegalBasisProof gồm proof/document IDs, authority/category, legal reference, jurisdiction ID/geometry/edge scope, relevant structure/criterion, effective/revocation reference, raw byte digest, signature locator, registry/snapshot/key references và toàn bộ graph/edge/profile/policy binding.

Các kết quả riêng: documentIntegrity, documentAuthenticity, legalAuthority và legalApplicability. PERMISSION_VERIFIED_TEST_ONLY chỉ là quyền trong signed test registry; không xác nhận năng lực pháp lý của cơ quan thật.

Legal reference thiếu bị schema từ chối. Structure không có trong bound inventory bị INVALID. legalApplicability luôn UNAVAILABLE vì chưa có trusted legal-basis provider. Không gọi signed legal reference là exemption đã được áp dụng.

## 6. Physical Structure Identity

StructureInventoryProof hỗ trợ BRIDGE, TUNNEL, CULVERT, CROSSING, ROAD_STRUCTURE, OTHER_LOAD_BEARING; có inventory/version, graph binding, chainage extent, geometry reference, survey/inspection references, limitations/units/uncertainty, authority, period và conflict status.

Duplicate structure IDs, offsets/spans ngoài edge, limitation units sai và authoritative self-label bị từ chối. Inventory completeness chỉ DECLARED_ONLY. hiddenStructures=UNKNOWN được giữ là chưa xác minh.

Inventory ghi CULVERT trong khi osmBridgeTag=NO được giữ đầy đủ và phát CROSSING_INVENTORY_OVERRIDES_OSM_ABSENCE_CLAIM. OSM tag không xóa inventory hoặc chứng minh không có công trình.

Inspection reference presence/identity được kiểm tra; referenced inspection bytes và field truth chưa có provider. Geometry reference là reference được ký, chưa tự chứng minh hình học công trình thực tế.

## 7. Survey Evidence Contract

SurveyProof có measurement IDs/criterion/value/unit/uncertainty, method, instrument/calibration references, surveyor/authority, collection time/location, extent, provenance/source-document, disposition, bottleneck finding, supersession và reinspection policy.

Missing method/calibration/provenance/surveyor/instrument có reason riêng. Finite bounds, uncertainty dương, unit đúng criterion, WGS84 location, valid UTC và reinspection/future/age checks được thực thi.

Các tầng riêng: recorded, authenticated, chainage/geographic-envelope consistency, geometric coverage, authoritative coverage và physical truth. Calibration chỉ REFERENCE_ONLY_NOT_VERIFIED. Chữ ký không xác minh thiết bị, người đo hoặc độ đúng vật lý.

Geographic check hiện là bounding envelope của directed edge, không phải geodetic projection hoặc proof rằng point nằm đúng polyline. measurementSpatialBinding được ghi CHAINAGE_AND_ENVELOPE_ONLY, không tuyên bố đầy đủ geospatial verification.

## 8. Spatial Coverage Validation

evaluateDeclaredSurveyCoverage thực hiện interval union/gap detection trên chainage hữu hạn. Hỗ trợ point, span, nhiều spans/observations; bound structure coverage được kiểm tra riêng theo structure ID/extent.

Point không thành full-edge. FULL_EDGE string không thay observations. Whole-edge declaration thiếu measurements hoặc có gaps giữ INCOMPLETE. Overlap/touching spans được merge kỹ thuật; thứ tự observations không làm đổi output.

Output phân biệt DECLARED_COVERAGE, GEOMETRIC_COVERAGE_VALID/INCOMPLETE và AUTHORITATIVE_COVERAGE_UNVERIFIED. physicalTruth luôn UNVERIFIED.

Invalid/revoked observations không đóng gaps nhưng vẫn giữ references và bottleneck IDs. Supersession không tự xóa old bottleneck. Không có threshold chiều dài cho phép bỏ coverage.

## 9. Proof Binding Verification

Dùng verifyEdgeIdentity/inspectVerifiedGraph hiện có để tái kiểm tra signed graph/profile receipts, node/endpoints, direction, V2 geometry, raw graph digest/version, profile configuration và policy. Proof edge length phải khớp actual verified edge length.

Proof document phải khớp native receipt digest, subject, authority/key, category/criterion, registry/snapshot, effective period và canonical signed body. Signed body bỏ đúng document.sha256 để tránh self-referential digest; caller digest được so lại với raw document bytes.

Legal/survey proof phải trỏ đúng bound inventory structure; survey sourceDocumentId/survey authority/inspection/calibration references được kiểm tra. Requested criterion được truyền riêng và phải khớp, không chỉ tin issuer permission.

Wrong graph/edge/direction/profile/configuration, structure/criterion, source document, expired/revoked/unknown proof, missing coverage và conflicting surveys có reason cụ thể. Không migrate geometry V1 sang V2.

## 10. Multi-Key Registry

Protocol mới: qualification-test-registry-v3; policy qualification-multikey-test-v1. Authority identity duy nhất chứa nhiều key records. Keys có ID/version/Ed25519 public identity, activation/end-of-signing, independent lifecycle, signed revocation event, replacement relationship và permissions.

Native SPKI fingerprint phải khớp claimed publicKeySha256. Duplicate key IDs, duplicate versions, same signing identity dưới alias IDs, cross-authority substitution và quyền key vượt authority đều bị từ chối.

Không sửa nghĩa signed v2. Existing v2 loader/orchestrator tiếp tục v2; v3 loader không nhận v2 dù bytes được ký đúng bằng v3 root. V2 loader cũng từ chối v3. Chưa tích hợp v3 vào orchestrator 5C.2C; đây là boundary được giữ có chủ đích, không phải silent fallback.

## 11. Key Rotation Policy

ALLOW_EXPLICIT_OVERLAP cho phép hai key ACTIVE của một authority khi mỗi key đủ status/window/permissions. Key cũ hết hạn hoặc revoked không làm key mới ACTIVE mất quyền, và ngược lại; tests assert cả key được chấp nhận lẫn key bị từ chối.

Independent authority revocation vẫn phủ mọi keys. UNKNOWN/SUSPENDED/REVOKED/not-activated/expired đều fail-closed với reasons riêng. Signature đúng toán học nhưng key không còn quyền ký mới bị từ chối.

Replacement phải trỏ key trước trong cùng authority, version/activation hợp lệ. History checkpoint ngăn thay public identity/authority dưới keyId cũ, kéo dài signing window ngầm, alias historical identity, xóa revocation đã công bố hoặc reactivation key revoked.

## 12. Historical Signature Handling

Phân biệt claimed signing time, verification time và signed revocation event. signingTime của verified test receipt vẫn UNAUTHENTICATED.

Không có timestamp-authority/archival signature-time provider. Key hết vai trò ký mới bị từ chối kể cả native signature đúng và claimed time nằm trước expiry. Reasons gồm KEY_NOT_AUTHORIZED_FOR_NEW_SIGNATURES và AUTHENTICATED_SIGNING_TIME_REQUIRED.

Payload signingTimeEvidence hoặc public key override bị từ chối. Claimed time trước activation/sau verification time không tạo credential. Không sử dụng caller backdating để phục hồi key; owner evaluation time có guard CLOCK_ROLLBACK.

Current-only document protocol ký cả registryId/snapshotId. Sau refresh, raw document cũ không được tự migrate sang snapshot mới; cần signed current-snapshot document, hoặc một future historical policy được xác minh riêng. Đây là giới hạn bảo thủ, chưa phải archival PKI lifecycle.

## 13. Revocation Snapshot Refresh

Snapshot gồm IDs/version, original signed bytes, created/effective/expiry/freshness, policy, previous digest, authority/key lifecycle và revoked documents. Root identity/domain/registry phân tách checkpoint scopes.

TrustedRegistryCheckpointStore yêu cầu atomic compare-and-advance cho high-water mark và historical key/revocation identities. Loader kiểm tra version tăng đúng, previous hash, no same-version equivocation, snapshot time/ID progression, immutable key identities/windows và non-removal revocations. Commit được đọc lại và so toàn bộ checkpoint; fake COMMITTED không đủ cấp receipt.

Original receipts bị superseded khi head đổi; document receipt từ registry/context khác không revalidate được. Final use kiểm tra lại clock, head, authority/key/document state và validity. Native failure diagnostics có provenance riêng để giữ reason gốc mà không tạo success credential.

**Store thực thi chỉ PROCESS_ONLY.** requireDurableCheckpoint=true bị chặn TRUSTED_DURABLE_STATE_UNAVAILABLE; EXTERNAL_DURABLE mới là interface cho task khác. Restart mất memory không được tuyên bố có persistent rollback protection. Refresh không có trusted bootstrap state bị từ chối; genesis cho một isolated process là test bootstrap, không phải production recovery.

Chưa có signed snapshot push/CRL/OCSP/live refresh service. Sự kiện ngoài snapshot không tự xuất hiện; đây không phải live monitoring.

## 14. Provider Contracts

Có chín interfaces: authority registry, roots, revocation, trusted time, graph artifact, legal evidence, structure inventory, survey evidence và vehicle approval.

Descriptor có provider identity, supported contracts/policies, trust establishment method, provenance/freshness, integrity requirements, fail-closed revocation/missing-data behavior và audit references. Reply phân biệt NOT_CONFIGURED, CONFIGURED_UNVERIFIED, TEST_ONLY, UNAVAILABLE, INVALID, PRODUCTION_VERIFIED dự kiến.

unconfiguredProofProvider trả NOT_CONFIGURED, không đọc environment/network/storage. PRODUCTION_VERIFIED có trong type nhưng contract runner luôn từ chối self-claim. Không có provider production giả.

## 15. Provider Readiness Checker

runProviderContractTest kiểm tra interface/descriptor, availability semantics, raw digest/signature encoding, artifact freshness, original test-clock provenance hoặc public-root object shape. Nó **không** xác minh semantic signature/authority integration của từng provider.

Do đó có ba mức riêng: interfaceImplemented, testOnlyContractVerified và testOnlyIntegrationVerified=false. Test contract roundtrip không được đổi thành domain integration hay production trust.

Root verification, real authority/field evidence, revocation services, authenticated external time, production integration và independent audit đều chưa có acceptance evidence nên false. evaluateProviderReadiness chỉ nhận original contract observations qua private WeakMap; clones/self-claims bị từ chối.

Ngay cả cả chín interfaces và raw contract fixtures PASS, overallProductionReadiness vẫn BLOCKED. Checker không được gọi để mở Qualification Engine.

## 16. Security Regression Tests

| Nhóm cuối | Cases | Kết quả |
|---|---:|---|
| Proof schema/interval coverage mới | 34 | PASS |
| Native signed proof binding/engine isolation mới | 30 | PASS |
| Multi-key lifecycle/rotation/rollback mới | 53 | PASS |
| Provider contracts/readiness mới | 31 | PASS |
| Tổng mới, 4 suites | 148 | PASS, 1.194s |
| Qualification engine cũ, 2 suites | 226 | PASS, 0.560s |
| Foundation/orchestration/revocation cũ, 11 suites | 387 | PASS, 4.997s |

Tất cả 925 scenarios cũ vẫn nguyên source/expectations. Không sửa tests cũ để giữ count xanh. Native Ed25519 keys chỉ sinh trong memory test; không mock crypto success.

Tests kiểm tra states và reason codes cho missing legal/calibration/provenance, wrong tuple/structure/criterion, partial coverage, expired/revoked document, signed-but-not-physical truth, culvert/OSM conflict, contradictory surveys và retained bottleneck.

## 17. Fault Injection Results

Đã kiểm tra invalid signatures/actual signer, malformed JSON có native root signature, duplicate IDs/key aliases/fingerprints, unsupported v2/v4 schema, missing snapshot/status/source, stale/expired snapshot, rollback/equivocation/previous-chain mismatch, cross-domain/prototype/JSON/spread receipts và cross-document/key misuse.

Checkpoint unavailable không được hiểu là empty; fake COMMITTED không phát hành receipt. Durable-state requirement không bị process store tự nhận đủ điều kiện. Authority/key/document revocations không được xóa qua newer signed snapshot.

Provider exceptions trả code cố định, không log exception text; malformed/stale data, fake clock và production self-claims không thành ready. No-dependency provider trả NOT_CONFIGURED. Các fault suites 5C.2B/2C vẫn PASS.

Trong development đã sửa narrowing/fixture issues và giữ expired document reason qua private failure provenance. Final run không còn failure hoặc skip; không dùng case count làm bằng chứng vật lý.

## 18. TypeScript Typecheck

    npx --no-install tsc --project tools/osm-importer/tsconfig.json --noEmit

**PASS, exit 0 sau thay đổi cuối.** Không dùng any hoặc assertion để bỏ qua trust boundary trong source mới. Unknown inputs được guards/typed reconstruction; original receipts kiểm tra runtime provenance.

## 19. NestJS Build

    npx --no-install nest build

**PASS, exit 0.** Không thay config hoặc endpoint. SourceRoot hiện tại không wire các module proof/v3/provider vào API production; source search importer/CLI/Nest không có import chúng.

## 20. Golden Vector Tests

    python3 tools/osm-importer/test/verify-qualification-golden.py

**PASS, exit 0: 2 V2 SHA-256 vectors và 6 decimal Half-Even vectors.** Geometry module và golden artifacts không thay đổi. Chưa chạy Kotlin/JVM parity trong task Backend-only; không suy từ Python PASS rằng Android đã tương thích.

## 21. Full Backend Tests

    npm test -- --runInBand

**1.073/1.073 tests, 43/43 suites PASS, Jest 19.553s, exit 0.**
Zero skipped; zero snapshots. 1.073 = 925 cũ + 148 mới.

Thứ tự cuối: new targeted -> 226 engine -> 387 foundation/orchestration/revocation -> typecheck -> build -> golden -> isolation/snapshot -> full suite -> preservation/Git checks.

Experimental VM Modules và SosService mock Firebase warning/debug xuất hiện như các task trước; suite tương ứng PASS. Full Jest run không phải Android/backend E2E hoặc kiểm thử field/deployment.

## 22. Artifact Preservation

76/76 baseline entries giữ nguyên SHA-256 và mtime_ns, gồm 20 artifacts, 27 source, 20 tests/fixtures/oracle, CLI và tám docs. Zero changed entries trong snapshot ngay trước/sau full suite, kể cả 14 source/test mới. Zero new output artifacts.

Importer isolation vẫn dùng mkdtemp owned roots, output overrides và afterAll guard; không sửa hoặc dùng output-real làm nơi ghi test mới.

Local graph output-dryrun-task3b vẫn contract 2.1.0, graphVersion dn_central_real_v1, **16.651/16.651 edges UNVERIFIED**, canAttemptStrictRouting=false. Gzip SHA-256: 1b7f64a965a763624e0a6c2cd866352fc3ef5f106214907866d0c6dcb49c25b4. Đây là đọc local, không xác nhận remote deployment.

Phụ lục có baseline hash/timestamp đầy đủ. Build/cache không thuộc cam kết artifact preservation.

## 23. Production Qualification Isolation

Không sửa/import module mới vào edge-qualifier, evidence resolver, geometry/validation, importer/CLI, Nest endpoints, Android hoặc UCS. Không cấp proof cho exemption policy hiện tại.

Full schema/native crypto/binding positives vẫn chỉ BOUND_TEST_ONLY, VERIFIED_TEST_ONLY hoặc TEST_ONLY contract observation. Mọi readiness production BLOCKED và mọi engine outcome giữ bốn literal invariants.

Không có runtime success callback do caller cấu hình, public payload root hoặc provider trusted=true để phát production trust. Registry/clock nguồn test không được gọi là nguồn xác thực bên ngoài thực.

## 24. Remaining Blockers

- Trusted legal/structure/survey/calibration/vehicle/authority providers và actual signed field data chưa có integration.
- Geospatial check chỉ chainage và bounding envelope; chưa xác minh stationing/projection/location accuracy thực.
- Authoritative references có ID/digest/role nhưng chưa tải và xác minh independent referenced evidence; inspection/calibration/jurisdiction applicability còn UNVERIFIED.
- V3 current-snapshot protocol không có authenticated historical signing time; expired/old snapshot documents không tự được cấp lại.
- Checkpoint PROCESS_ONLY không bảo vệ sau restart/lost state; cần durable, authenticated, atomic high-water/history store và bootstrap/recovery policy được nghiệm thu.
- V3 chưa wire vào 5C.2C orchestration; v2/v3 compatibility boundaries được test nhưng không tuyên bố migrated integration.
- Provider contract runner chưa là semantic/native verifier của từng provider; testOnlyIntegrationVerified vẫn false.
- Production PKI/X.509/CRL/OCSP/time/algorithm policy và proof formats thực chưa cấu hình.
- Android–Backend HTTP/device E2E, Kotlin parity, operational rules và independent field acceptance còn NEEDS_VERIFICATION.

Chi tiết dependency/owner role/DoD/go-no-go tại gap report. Các blocker không được che bằng schema flags hoặc bằng thêm unit tests.

## 25. Final Acceptance Decision

**CONDITIONAL PASS – Task 5C.2D foundation.**

Đạt trong phạm vi test: typed proof validation, source/binding checks, coverage negatives, native multi-key signatures, independent lifecycle, version isolation, rollback/freshness/historical-time rejection, provider contracts/readiness và đủ hai báo cáo.

Có positive native chain và negative reason assertions; old tests/source/artifacts giữ nguyên. Không phát hiện false-safe trong các đường kiểm thử. Không tuyên bố authoritative physical truth, durable production lifecycle hoặc completed product demo chỉ từ tests PASS.

Provider thực, verified field/legal evidence, persistence, Android integration và operational acceptance là điều kiện còn thiếu; vì vậy không nghiệm thu production hoặc tuyên bố readiness field pilot.

## 26. Next Task Recommendation

Giá trị thực tế cao nhất tiếp theo là **demo integration bằng fixture qua HTTP**, kiểm tra manifest/download bytes/error states/auth roles, song song với task được cho phép riêng để rà soát Android loader/legacy/offline gates và chạy parity. Không cần đợi cơ quan bên ngoài để kiểm thử demo contract này.

Data-custodian/PKI/survey/vehicle/operational prerequisites có thể chuẩn bị song song bởi vai trò được đề xuất, nhưng chưa có cam kết bên ngoài nào được xác minh. Roadmap không gán ngày phát hành hoặc phần trăm hoàn thành.

Dừng tại 5C.2D. Không thực hiện 5C.2E, deploy, commit/push hoặc bất kỳ production integration nào.

## Phụ lục — 76 baseline files giữ nguyên

SHA-256 và mtime_ns trước = pre-full = sau; timestamp là chuỗi nanosecond.

| File | SHA-256 không đổi | mtime_ns không đổi |
|---|---|---|
| docs/PHASE5_TASK5B1_FINAL_CONTRACT_AUDIT.md | ad8525e320048cce5c3b428dd7954b9987b6d3b2f34264e560fa2948d196402b | 1793890135064394386 |
| docs/PHASE5_TASK5B1_FINAL_CORRECTIVE_PATCH_REPORT.md | 70896f5478270e1a732c96c6bcd7cf88303dcad865dabb4b8a9d069a10007710 | 1793890120871393623 |
| docs/PHASE5_TASK5C1R_CODEX_REMEDIATION_REPORT.md | 5d97544b34b4dce58ed472a8e670387b8468d01adf5f6590ebde7480f9e166fd | 1793894452376830963 |
| docs/PHASE5_TASK5C1_CODEX_INDEPENDENT_AUDIT.md | 86602b1dc8691440da765bf941d65484403bb5ca7ce5ce10d2468945ecbec570 | 1793892535079894667 |
| docs/PHASE5_TASK5C1_IMPLEMENTATION_REPORT.md | 2de07aeaf706abf43a91764caad9a6e4d869fd6ea192fee51ed852463515bd4e | 1793894181902680560 |
| docs/PHASE5_TASK5C2A_CODEX_IMPLEMENTATION_REPORT.md | 963cb6b339e5a53269a11e8462bf7c31587c58096a47ba45deb281b4160ac4e1 | 1793897418017355405 |
| docs/PHASE5_TASK5C2B_CODEX_IMPLEMENTATION_REPORT.md | b7f9e3b0e6ecbab7d72de080b705852833d76aeabd4a71ee1cd268ca6b9305b1 | 1793899080938815581 |
| docs/PHASE5_TASK5C2C_CODEX_IMPLEMENTATION_REPORT.md | 8ef90c7e06765824661966c5494aabbd7f81c699b051d53101752e60a153119a | 1793901730694840415 |
| tools/osm-importer/cli.ts | 25f72442def5352fe81629a7903a70fd72abc7857483807d0096d53ef5292401 | 1793786695664590745 |
| tools/osm-importer/output/BaseRoadGraph.json | 1bc5c849f7bba20274521930d43069c84c50d664ed6867a518ae02425bd52a62 | 1793892167806777263 |
| tools/osm-importer/output/BaseRoadGraph.json.gz | 3fe5f4acb1e88d7785de7efa7e57ba08994b7d6e419933a940b76b0725493b46 | 1793892167807777263 |
| tools/osm-importer/output/ImportDiagnostics.json | a7314d615d9944df42d161d5170d52c606762d322c63eb7666beb6bcc00e0b23 | 1793892167806777263 |
| tools/osm-importer/output/RoutingManifest.json | ec4e85dedd7e5041c0770a47695cecc92aa363042136a5eec1c28ac70e2adbe1 | 1793892167807777263 |
| tools/osm-importer/output-danang-261103/BaseRoadGraph.json | bae0a78e9069f96e128624758a6828e0ba10195af3687557609849af66d60a5d | 1793791971878996797 |
| tools/osm-importer/output-danang-261103/BaseRoadGraph.json.gz | 9c0166f9d1fa0ad45aef4163a258d5d3d9310d3d2eb0c99e169669e77537ac5d | 1793791972076993362 |
| tools/osm-importer/output-danang-261103/ImportDiagnostics.json | 4d95fe3db4a6df20cc8037801f5fba9b8f42702d07f5d8292c1296c7f9d48e31 | 1793791971890996589 |
| tools/osm-importer/output-danang-261103/RoutingManifest.json | ac10c58382a1325fdafe7ef730162dd5e3ae9516c123ecf99e1384ae49349999 | 1793791972084993223 |
| tools/osm-importer/output-danang-261103-task97/BaseRoadGraph.json | 419cf4695f735e234038da6ef14076c22ef6121bbd3dbc566eccb516ff8ccd80 | 1793795090193010010 |
| tools/osm-importer/output-danang-261103-task97/BaseRoadGraph.json.gz | 9792dce0abb089a230bcb79e71b2a8ff83301879d417f4fd399711ce4c3a037b | 1793795090388006437 |
| tools/osm-importer/output-danang-261103-task97/ImportDiagnostics.json | b379ddee5a99cd4054827a7b34097808c96419e8d2e447c9fd95a6abb84807ff | 1793795090204009808 |
| tools/osm-importer/output-danang-261103-task97/RoutingManifest.json | ec046a84a14cc35dbf498034e019850224c8facab2989f98f9733fced89222aa | 1793795090396006290 |
| tools/osm-importer/output-dryrun-task3b/BaseRoadGraph.json | b9dd0caf51c722ddb432b837d1c1ad4602c03f258eca23089215145bd9c86dfa | 1793816785873038184 |
| tools/osm-importer/output-dryrun-task3b/BaseRoadGraph.json.gz | 1b7f64a965a763624e0a6c2cd866352fc3ef5f106214907866d0c6dcb49c25b4 | 1793816786066038779 |
| tools/osm-importer/output-dryrun-task3b/ImportDiagnostics.json | b379ddee5a99cd4054827a7b34097808c96419e8d2e447c9fd95a6abb84807ff | 1793816785882038211 |
| tools/osm-importer/output-dryrun-task3b/RoutingManifest.json | 7765d94d288e279bf3607b692d5466f5e9efe53db16c0ea944e5d9b08f3183ad | 1793816786074038803 |
| tools/osm-importer/output-real/BaseRoadGraph.json | d5ea87e086e00386b4f64df983844c0488ffbadb419f964101da26ef7650e585 | 1793892167826777269 |
| tools/osm-importer/output-real/BaseRoadGraph.json.gz | 89b451800767e0edc0c184389b10567e50df5f479314b77f92558e5b9f4c13b2 | 1793892167827777269 |
| tools/osm-importer/output-real/ImportDiagnostics.json | 357564ca77ec4d158b29238f7b06738387c935e2a8df105b2a976517fdded4eb | 1793892167826777269 |
| tools/osm-importer/output-real/RoutingManifest.json | 26e04b90adacdac18672f646707ded470c7c402a4cc6c8129973f656d815028f | 1793892167827777269 |
| tools/osm-importer/src/edge-qualifier.ts | 4936c935e5af2de9175947356ae3298c108c68d23bb9791b8ef49875cca97501 | 1793893886150771341 |
| tools/osm-importer/src/haversine.ts | 0960a2d0fd5810b39f10565dfbe368da303c2ca9fb5ca3f7cc655e65c7357f79 | 1793724305750102828 |
| tools/osm-importer/src/oneway-resolver.ts | a3d65a9330075e1d0a4cd4966bd17040b1f1465174ba92d0b7a07569b1d83ce7 | 1793724305749660525 |
| tools/osm-importer/src/osm-importer.ts | e85eb6fe891002a4b81b57a7e5e33ce362994b406471535d47f9dc76c197a71d | 1793815518206310039 |
| tools/osm-importer/src/qualification-artifact-verifier.ts | 7fc6e792226d9350d2b1e2528b4fc749b93988d9a4d848b3d85881f9f0bb0bfd | 1793896692118952761 |
| tools/osm-importer/src/qualification-authority-registry.ts | 291eb2450d8df578b9369f9ba2ac29cad30286117f5d6faf4c49a479da2618ce | 1793901353860679185 |
| tools/osm-importer/src/qualification-crypto-verifier.ts | 11d1a0ca4296326fdfa6490ab271f4779b445f58704d9fea53b0d05c166417d7 | 1793901353903856138 |
| tools/osm-importer/src/qualification-document-verifier.ts | 36d44369ec7a5537da66d10b2ccb4ddcbcabe0f4f31d21ebd07efdecb12d2a3f | 1793901353939230349 |
| tools/osm-importer/src/qualification-evidence.ts | 51f4421abe7e8460fc2a528f49d30ca90be1542a568c8b57008a9d896336cec8 | 1793893886150883218 |
| tools/osm-importer/src/qualification-exemption-policy.ts | e24b094c7e095b918bf35c3869fd2659687109d71c21d89a1c1f1737cd18a4f1 | 1793901481267733697 |
| tools/osm-importer/src/qualification-geometry.ts | be0980fb447f6002d913c5013ab581b483fb79b5fdcaad2b0fb316272e136864 | 1793894049079841089 |
| tools/osm-importer/src/qualification-identity-binding.ts | c7c2e53187a77d3e9cea7ab850e2ea959233af6f6bf13bdf8fc846d4a80d343e | 1793896564956056311 |
| tools/osm-importer/src/qualification-profile-verifier.ts | 0cf9ba0f83e497d94f6393bcd01f43b2616cf8c2cbe4020189dc4511b25f95ed | 1793896796744139854 |
| tools/osm-importer/src/qualification-revocation-policy.ts | f06edb6a7f1b7a7f1e769f13ea2b1b34e4b229126e5c1656ed4d9452fec8f03b | 1793901411101703676 |
| tools/osm-importer/src/qualification-trust-types.ts | 46fd71571b47bed42055b1fd7602f41d4f63fda2d1c7ae127696a5fd2b3e8519 | 1793900645393672912 |
| tools/osm-importer/src/qualification-trusted-clock.ts | 1145bbc567b5fd8ea08bbe152c62251be69438995068c43e7deea7d62447d454 | 1793896796619139811 |
| tools/osm-importer/src/qualification-types.ts | ad6d802bbc5f566e22e44a6eb2ba2c6d913de716d990d45d59c1057fe66f3f1b | 1793894049079723173 |
| tools/osm-importer/src/qualification-validation.ts | ec70c975cbd986c271794ddec7bdcf600590d45b153e40e0f1816d40f81a28f4 | 1793893886150640629 |
| tools/osm-importer/src/qualification-verification-adapters.ts | 536e141bb41f509ba51629b891f779409f57403f60ace8ba7ba9dcbef56d24bf | 1793898626776660988 |
| tools/osm-importer/src/qualification-verification-audit.ts | ac4aef39a2ac802e7bd830d26c2e6fc9a99d5ea273d2f4b93ebf4c48b507761a | 1793898626788225653 |
| tools/osm-importer/src/qualification-verification-json.ts | b624ab1ffd963cc09a325fcc39f0529ae6e93acfc33b4670b666fa2bccc2f363 | 1793896692008038165 |
| tools/osm-importer/src/qualification-verification-orchestrator.ts | 191a7ad09e4181b97a95d703ec5832f06f9975a2ff9c33848534f6e5c4badf6a | 1793901458892287840 |
| tools/osm-importer/src/qualification-verification-pipeline-types.ts | 33cf20922c191b1405d0fc88a56d398b27ed0ddbc7e6bb58604f3b49892abc88 | 1793901354026323988 |
| tools/osm-importer/src/turn-restriction-parser.ts | dbf80b9c2f5e8b8b3d257cd16f80165660681c7cd0a1538efe21ba9dc7219cf9 | 1793794905677395467 |
| tools/osm-importer/src/types.ts | e5fa58371295405beb1444924821be3f2178d20f1f6fa10dff375820e660603f | 1793814244473402428 |
| tools/osm-importer/src/vehicle-profile.ts | 3efc8a2692bd464ca71127520e0aed2fe60311acb15d4915d26c9540769d34b7 | 1793729013271380586 |
| tools/osm-importer/src/via-way-resolver.ts | 4e1874200575a81be956ab8682f544961e06cf05db65439d2b05ef0c54819d7b | 1793815518262830641 |
| tools/osm-importer/test/edge-qualifier.spec.ts | 6afe8f1a00fbe4409cab22d88eef172cb24eb59a9ac9b13237f0d0ba42a560df | 1793894049079509686 |
| tools/osm-importer/test/osm-importer.spec.ts | f4de0646b6d1b6280295487452a06b0c51b671db4228813ba23712060516b3f4 | 1793893600313985800 |
| tools/osm-importer/test/qualification-artifact-verifier.spec.ts | 3faa38d8ed9b1f102c69b227ca1454fdc0a11c8ed36f866f3b9532ab0e7e74ba | 1793896565038056349 |
| tools/osm-importer/test/qualification-crypto-verifier.spec.ts | 10582a03eb788776e41f20d71ff05badaa5a24a4e05fa56ff2c1b73b7570b649 | 1793900645393977369 |
| tools/osm-importer/test/qualification-exemption-policy.spec.ts | ce185ecc26443f27a246d4332a27020df0479e730b53269f9fb27198ddfe875c | 1793901458892453010 |
| tools/osm-importer/test/qualification-fixtures.ts | 9b379604ec8838b08c9e41c633e8c143b6cac9999cb4881e9e47049bd44afa20 | 1793893574235828677 |
| tools/osm-importer/test/qualification-geometry-golden.json | 835a4aa48ac5360ba49881408cbaf905f483331410a80bdde98f58f9488b581d | 1793893939819474027 |
| tools/osm-importer/test/qualification-identity-binding.spec.ts | 66d558dfb62562dac03353aa9566007c4a9986068d9fe66e7851f4fdea62c1a8 | 1793896565053056357 |
| tools/osm-importer/test/qualification-independent-revocation.spec.ts | bae2384f054e9bbfa1eecfcb8e4fdb12f3e28e540e1211ae37a177ab45e1a4b7 | 1793901411174052885 |
| tools/osm-importer/test/qualification-profile-document.spec.ts | 590f91220d6f2f0c64656ecbb68d23702108973e8a6ef95b3c4fb0ef0358b36a | 1793896565079056369 |
| tools/osm-importer/test/qualification-remediation.spec.ts | f097b601fd1c61262d1ab00dfeda65bcb0e9f05efa7f5ce60e3b1f98d951c5a0 | 1793894049079176268 |
| tools/osm-importer/test/qualification-trust-boundary.spec.ts | 2df9cf4931668588e8768a20f3c9bae3df64eaa23e6bd9c3470bc210cf27b34d | 1793900645394255517 |
| tools/osm-importer/test/qualification-trusted-clock.spec.ts | 4f319f43d393fe15bb656ebc7c3a29e46798633bc5410092bdb6c7b82e0f21d7 | 1793896565089023979 |
| tools/osm-importer/test/qualification-verification-fault-injection.spec.ts | afa7932a91b98afb574cb00bc2725623676bdfdd7f3df0d4f188d63b17db47c4 | 1793898626901661017 |
| tools/osm-importer/test/qualification-verification-integration.spec.ts | d96f0e2036ebf420b04b251a19e7705a92bdb4bb861be7c4930ee080f720efbb | 1793898626821693961 |
| tools/osm-importer/test/qualification-verification-pipeline-fixtures.ts | 941b06c1726e5b467883ccf09b531c4b5202e3646b19cb20c196f4221e71c9cc | 1793901052597465930 |
| tools/osm-importer/test/qualification-verification-pipeline-security.spec.ts | 1bb2f25bf90a069ec0f1745587e506daa0ca570663255d294bc56030bdf14416 | 1793900645394140779 |
| tools/osm-importer/test/qualification-verification-test-fixtures.ts | 6d80533047560782e16cd489d2cd765fea6d3c4dc84e755401576d64142650b8 | 1793900645393819156 |
| tools/osm-importer/test/verify-qualification-golden.py | 2085deea55f7bdc4f694fd7ac1aa1ffee3e28d66c3b445f2a03ed7697ceb5ef6 | 1793893939826545948 |
| tools/osm-importer/test/via-way-resolver.spec.ts | e79e2288418695c1d9850e18b156f73accf757efba112bbe706343448af90bd6 | 1793815518335537502 |

