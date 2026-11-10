# PHASE 5 – TASK 5C.2C: VERIFICATION CONTRACT HARDENING & INDEPENDENT REVOCATION FOUNDATION

Ngày hoàn tất: 06/11/2026, Asia/Bangkok.
Backend: /home/vantri/AndroidStudioProjects/canh-bao-thien-tai-backend-app.

## 1. Executive Summary

**CONDITIONAL PASS – independent revocation và exemption foundation trong TEST_ONLY. Production qualification vẫn khóa.**

Đã chuyển signed registry sang v2, bắt buộc authorityStatus và keyStatus độc lập; bổ sung effective periods của key và revocation policy/snapshot identity. Không có fallback ACTIVE hoặc migration signed v1 bytes. Cơ quan ACTIVE + khóa REVOKED và cơ quan REVOKED + khóa ACTIVE đều bị từ chối qua orchestrator với reason tương ứng.

Exemption authenticity, authority, identity, applicability và evidence conflict là các quyết định riêng. Tài liệu có chữ ký hợp lệ có thể VERIFIED trong test domain nhưng applicability vẫn INDETERMINATE/NOT_APPLICABLE/CONFLICTING/INVALID/UNAVAILABLE. Không có nhánh trả APPLICABLE_TEST_ONLY khi chưa có verifier cho hồ sơ pháp lý, mô hình công trình và khảo sát.

**85 tests mới (45 revocation + 40 exemption), 925/925 backend tests trên 39 suites PASS**. Typecheck, Nest build và Python golden vectors PASS. Final run không có skipped tests hoặc snapshots.

Theo dõi 71 file baseline: 11 file được phép đã sửa; **60 file còn lại không đổi cả SHA-256 và mtime_ns**, gồm toàn bộ 20 artifacts, năm module engine bị khóa và các tài liệu cũ. Không tạo output artifact mới. Source/test mới không bị full suite sửa.

Bất biến đã kiểm tra trong positive full native chain và negative outcomes:

    purpose = DIAGNOSTIC_ONLY
    trustStatus = UNAVAILABLE
    qualificationStatus = UNVERIFIED
    isProductionApproved = false

Không phát hành sidecar, không tích hợp production, Android/UCS, không commit/push/deploy.

## 2. Repository Baseline

Đã kiểm tra pwd, Git status/diff check, AGENTS.md tại repository/thư mục cha áp dụng, các báo cáo 5C.2B/5C.2A/5C.1R/audit, source và tests liên quan trước thay đổi. Không tìm thấy AGENTS.md áp dụng cho source task; các file trong node_modules không áp dụng.

Node v26.8.2; TypeScript 6.0.3. Jest/ts-jest theo cấu hình hiện có, node environment và runInBand. Không đổi tsconfig/Jest config hoặc cài dependency.

Baseline targeted thực thi: **528/528 cases, 11 suites PASS, Jest 3.548s**: 226 engine + 163 foundation + 139 orchestration. 840/840 là full-run lịch sử của Task 5C.2B; không tuyên bố đã chạy full 840 baseline lần nữa trước sửa.

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
    ?? tools/osm-importer/src/qualification-geometry.ts
    ?? tools/osm-importer/src/qualification-identity-binding.ts
    ?? tools/osm-importer/src/qualification-profile-verifier.ts
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
    ?? tools/osm-importer/test/qualification-fixtures.ts
    ?? tools/osm-importer/test/qualification-geometry-golden.json
    ?? tools/osm-importer/test/qualification-identity-binding.spec.ts
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

Đã lưu 71 baseline entries với SHA-256 và mtime_ns dạng chuỗi decimal, trước mọi test. Có snapshot riêng ngay trước full suite và so sánh sau full suite. Không reset/restore/clean thay đổi cũ.

API cần thay đổi: signed registry v1 chỉ có revocationStatus chung; authorizeTestAuthority không phân biệt key/authority; document inspector chưa nhận expected registry; document verifier trộn schema exemption với metadata applicability; orchestrator chỉ giữ placeholder exemption application. Các phụ thuộc bị tác động được regression ở mục 15 kiểm tra lại.

## 3. Files Modified/Created

Các đường dẫn sau tương đối với Backend.

| File sửa | Lý do contract |
|---|---|
| tools/osm-importer/src/qualification-trust-types.ts | Verification policy mới qualification-verification-5C2C-v2 |
| tools/osm-importer/src/qualification-authority-registry.ts | Registry v2 schema, mandatory independent lifecycle, snapshot/policy metadata, private provenance lookup và authorization delegation |
| tools/osm-importer/src/qualification-crypto-verifier.ts | Document key identity/private policy binding và optional expectedRegistry khi inspect |
| tools/osm-importer/src/qualification-document-verifier.ts | Structural exemption document parsing riêng khỏi legal/physical applicability; expected registry binding |
| tools/osm-importer/src/qualification-verification-orchestrator.ts | Independent revocation steps/facets, final shared-instant checks, exemption policy/conflict steps và final pipeline audit |
| tools/osm-importer/src/qualification-verification-pipeline-types.ts | Typed lifecycle/applicability/final-state observations và exemptionDecisions |
| tools/osm-importer/test/qualification-verification-test-fixtures.ts | Sinh và ký v2 registry bytes mới, không tái sử dụng chữ ký v1 |
| tools/osm-importer/test/qualification-verification-pipeline-fixtures.ts | Thêm signed body context cho exemption test claims |
| tools/osm-importer/test/qualification-crypto-verifier.spec.ts | Thay combined revocation patches bằng authorityStatus có nghĩa tương ứng |
| tools/osm-importer/test/qualification-trust-boundary.spec.ts | Assert verification policy mới |
| tools/osm-importer/test/qualification-verification-pipeline-security.spec.ts | Các scenario authority revoked/unknown dùng field v2; không giảm assertion hoặc case count |

| File mới | Vai trò |
|---|---|
| tools/osm-importer/src/qualification-revocation-policy.ts | Independent snapshot lifecycle evaluation, structured facets và reason preservation |
| tools/osm-importer/src/qualification-exemption-policy.ts | Exemption decision contract, proof limitations, structure vetoes và evidence reconciliation |
| tools/osm-importer/test/qualification-independent-revocation.spec.ts | 45 native policy/integration/race/security/audit cases |
| tools/osm-importer/test/qualification-exemption-policy.spec.ts | 40 authenticity/applicability/structure/conflict/integration cases |
| docs/PHASE5_TASK5C2C_CODEX_IMPLEMENTATION_REPORT.md | Báo cáo này |

Không sửa edge-qualifier, qualification-evidence, qualification-geometry, qualification-validation, importer/CLI/types, graph/manifest, profile/artifact/identity/clock foundation, verification adapters/audit helper, Android/UCS, Nest endpoint, database hoặc cloud config. Audit hardening nằm ở typed observations và các step orchestration dùng helper hiện có, không cần sửa helper đó.

Build có tái tạo dist và cập nhật incremental tsconfig.build.tsbuildinfo vốn đã dirty; Jest có cache mặc định. Các file build/cache không nằm trong cam kết artifact bất biến.

## 4. Verification Contract Audit

| Ranh giới | Kiểm chứng/kết quả |
|---|---|
| Object literal/cast/spread | TypeScript structural typing cho phép dựng object có status VERIFIED; runtime consumers kiểm tra private WeakMap, không dùng hình dạng object làm credential |
| Prototype manipulation | Object.create(receipt) không có provenance và bị từ chối |
| JSON round-trip | Không phục hồi document/registry receipt; phải xác minh raw signed bytes lại |
| Result scope | VERIFIED của verifier chỉ TECHNICAL_ONLY/TEST_ONLY; mọi productionAuthoritative/qualificationEligible=false |
| Success factory | Không có public factory nhận claimed booleans/status để cấp production trust |
| Callback injection | Request không nhận verifier callback, clock/root override hoặc receipt context; fault spies chỉ ở tests |
| Metadata | Verified results có policy version, subject, timestamp, trust-source reference và assurance |
| Cross-registry reuse | inspectVerifiedDocument có expectedRegistry; receipt từ registry khác bị từ chối, kể cả dữ liệu giống nhau |
| Lifecycle | Original document receipts reauthorize lại authority/key/document và validity khi inspect |
| Audit/outcome | Summary không có private provenance và không được dùng làm credential |
| Malformed runtime input | Verifier/policy/orchestrator trả failure/diagnostic, không mặc định success |

Verification policy hiện tại: qualification-verification-5C2C-v2. Registry schema và revocation policy có version riêng ở mục 7. Qualification policy của engine vẫn 5C1R-locked-v1; geometry hash V2 và graph contract 2.1.0 không đổi.

Expected-registry check là đối chiếu đúng receipt object trong test process, không phải global live revocation provider. Chế độ inspect cũ không nhận expected registry vẫn kiểm tra signed snapshot gốc; caller cần cung cấp context mới hoặc xác minh lại raw document khi đổi registry.

## 5. Authority Lifecycle Contract

AuthorityEntry v2 bắt buộc authorityStatus:

    ACTIVE | SUSPENDED | REVOKED | EXPIRED | UNKNOWN

validFrom/validUntil là effective period của authority; authorityRevokedAt tùy chọn là sự kiện revocation đã được ký trong test snapshot. Không suy authority ACTIVE từ key ACTIVE.

SUSPENDED/REVOKED đều từ chối, giữ code riêng AUTHORITY_SUSPENDED/AUTHORITY_REVOKED. UNKNOWN trả VERIFIER_UNAVAILABLE với AUTHORITY_STATUS_UNKNOWN. Missing/invalid field bị schema từ chối với AUTHORITY_STATUS_MISSING/INVALID, không default ACTIVE. Period expiry có AUTHORITY_EXPIRED.

Authority được tìm theo authorityId độc lập với key lookup. Khi cơ quan đã biết nhưng caller chọn key ID không có, authority facet vẫn ACTIVE theo signed facts, key facet MISSING và KEY_NOT_REGISTERED; toàn bộ authorization thất bại.

## 6. Signing Key Lifecycle Contract

keyStatus dùng cùng tập trạng thái nhưng là field độc lập. keyValidFrom/keyValidUntil bắt buộc và được kiểm tra riêng. keyRevokedAt là sự kiện đã ký trong test snapshot; certificateValidUntil tiếp tục là test key/certificate metadata expiry, không phải X.509 chain validation.

Không suy key ACTIVE từ authority ACTIVE. KEY_REVOKED, KEY_SUSPENDED, KEY_STATUS_UNKNOWN và KEY_EXPIRED có reasons riêng. Missing keyStatus không tạo registry receipt. Nếu key đã REVOKED đồng thời certificate metadata hết hạn, key facet vẫn REVOKED và giữ cả code expiry; không ghi đè revocation bằng một trạng thái thuận lợi hơn.

Registry hiện vẫn có một key trên mỗi authority entry và không cho duplicate authority/key IDs. Đây chưa phải key rotation/history service nhiều khóa của production.

## 7. Registry Schema Versioning

Schema mới: qualification-test-registry-v2.

Các field mới bắt buộc trên registry:

    revocationPolicyVersion = qualification-test-revocation-v1
    revocationSnapshotId
    revocationSourceStatus = AVAILABLE | UNAVAILABLE

revocationCheckedAt, registry effective period, revokedDocumentIds và signed authority entries tiếp tục tồn tại. Entry bắt buộc authorityStatus, keyStatus, keyValidFrom/keyValidUntil; combined revocationStatus bị từ chối.

Chữ ký Ed25519 được kiểm tra trên EXACT original bytes trước canonical JSON/schema validation. Không sửa/migrate payload rồi dùng lại signature. Signed v1/v3 registry trả REGISTRY_SCHEMA_VERSION_UNSUPPORTED; policy sai trả REVOCATION_POLICY_MISMATCH. Public test root vẫn là cấu hình ngoài payload, không phải production CA.

Fixtures được tạo thành canonical v2 bytes rồi ký mới bằng ephemeral test keys; đây là thay đổi contract test có chủ đích, không phải loader fallback.

## 8. Revocation Policy Evaluation

evaluateTestRevocation nhận original verified registry receipt, reading, authority/key/subject identities. Nguồn lifecycle chỉ lấy qua private registry WeakMap lookup; status object, clone, prototype hoặc JSON receipt không tạo được nguồn revocation.

Kết quả có bốn facets: registry, authority, key, document. Mỗi facet ghi lifecycle status, verificationStatus và diagnosticCodes. Result còn giữ snapshot ID/hash/policy để truy vết. Snapshot authenticity là chữ ký của toàn bộ test registry bao gồm các facts revocation; không có CRL/OCSP giả.

Kiểm tra độc lập registry/authority/key periods, authority/key status, key certificate metadata, document revoked IDs, subject, policy, source availability và snapshot freshness. Freshness vẫn là test policy một giờ. Có cả REVOCATION_SNAPSHOT_STALE và code cũ REGISTRY_REVOCATION_SNAPSHOT_STALE để giữ diagnostic compatibility.

Không chỉ lấy lỗi đầu tiên: authority suspended, key revoked và document revoked cùng lúc giữ đủ ba reasons. Stale snapshot và scheduled key/authority revocation ở final instant cũng giữ cả hai. Khi source chưa xác thực/unavailable thì không trả VERIFIED.

## 9. Revocation Race Tests

Đã thực thi:

- Authority ACTIVE/key REVOKED và authority REVOKED/key ACTIVE qua orchestrator thật.
- Authority/key SUSPENDED, UNKNOWN, EXPIRED và missing mandatory states.
- Key/authority period và certificate metadata expiry độc lập.
- Key trở nên REVOKED sau một native document signature verification.
- Authority trở nên REVOKED sau profile approval verification, trước edge binding.
- Key/authority revocation cùng stale snapshot đúng tại shared final instant.
- Old receipt inspect dưới expected registry khác, kể cả mới ký snapshot revoked hoặc thay public key.
- Forged clock/status/registry receipt, duplicate keys, tampered bytes/signature và malformed JSON.

authorityRevokedAt/keyRevokedAt là các sự kiện đã nằm trong signed snapshot; clock tiến qua timestamp giúp kiểm chứng revalidation thật. Đây không phải thao tác cập nhật registry sống sau snapshot. Trường hợp snapshot mới được ký riêng phải truyền context mới hoặc xác minh lại document; old immutable snapshot không tự biết một sự kiện mới ngoài dữ liệu đã ký.

Spies ở race tests chỉ quan sát kết quả hàm crypto thật và đổi test clock cho lần đọc sau; không trả forged cryptographic success. Snapshot mới revoked từ chối receipt cũ khi đối chiếu expected registry và từ chối verify lại raw document.

## 10. Exemption Authenticity

verifyEvidenceDocument tách structural exemption schema khỏi applicability. parseExemptionDocumentRecord kiểm tra IDs, criterion/category enum, hashes, versions, validity declaration, required provenance/technical strings và status fields; không dùng bridge/tunnel/highway để kết luận chữ ký sai.

Document authenticity vẫn cần exact signed envelope/record projection, original receipt provenance, authority permissions, byte digest, validity/revocation và expected registry. Một signed bridge=true exemption có thể authenticity VERIFIED trong TEST_ONLY, trong khi applicability bị phủ nhận. Nonexemptible criterion không làm phép toán chữ ký tự trở thành đúng về pháp lý.

Parser là schema adapter, không cấp trust. Signature declarations trong payload không thay thế crypto verifier. Evidence schema diagnostics cũ vẫn được giữ; không đổi qualification-validation bị khóa.

## 11. Exemption Applicability

Contract ExemptionDecision phân biệt authenticity, authority, identity, applicability và evidenceConflict; có criterion/category, legal basis reference, physical structure identity, full graph/edge/profile/policy binding, source document, authority verification reference, period và reasons.

States:

    APPLICABLE_TEST_ONLY (reserved, chưa có success branch)
    NOT_APPLICABLE
    INDETERMINATE
    INVALID
    CONFLICTING
    UNAVAILABLE

applicability luôn NOT_ESTABLISHED trong implementation này. APPLICABLE_TEST_ONLY không phải NOT_APPLICABLE của Qualification Engine và không có đường áp dụng vào engine.

Bridge/tunnel true, track/path/footway, complex incline, culvert/hidden-structure claims và criterion/category không phù hợp có veto/reasons riêng. bridge=false chỉ thêm OSM_BRIDGE_FALSE_IS_NOT_NO_STRUCTURE_PROOF. Highway classification hoặc design reference tự khai không thay verified design/survey proof.

Signed exemptionContext có thể cung cấp legal/structure references nhưng các references vẫn là signed claims. Fixture có đủ các field “proof test-only” vẫn INDETERMINATE với CLAIMED_PROOF_IS_NOT_VERIFIED_PROOF, VERIFIED_LEGAL_BASIS_PROOF_UNAVAILABLE, VERIFIED_PHYSICAL_STRUCTURE_PROOF_UNAVAILABLE và TRUSTED_SURVEY_COVERAGE_UNAVAILABLE. Không dựng positive applicability giả khi chưa có proof verifier/model.

**Blocker có chủ đích:** chưa có pháp lý/công trình/khảo sát được xác minh độc lập, nên không thể thực hiện positive APPLICABLE_TEST_ONLY an toàn. Positive full-chain verification vẫn chạy, nhưng positive legal applicability chưa được nghiệm thu.

## 12. Evidence Conflict Reconciliation

Exemption policy đánh giá các evidence liên quan trước quyết định cuối. Raw record/document không bị sửa, loại bỏ hoặc supersede. Evidence references giữ cả invalid record có ID để không mất dấu input; references không phải authentication proof.

Evidence phải có original document receipt, đúng registry/graph/edge/profile/policy, valid period/status và schema. Vehicle configuration phải trùng digest của verified profile; thay đổi mass/height dưới cùng profile ID không được dùng để thay đổi bottleneck assessment.

evaluateEvidenceMeasurement chỉ cung cấp toán học kỹ thuật. FAIL_CERTAIN trên test-authenticated measurement là veto UNRESOLVED_TEST_MEASUREMENT_FAILURE; chưa phải confirmed physical/legal fact. Hai measurements mâu thuẫn giữ EVIDENCE_CONFLICT_UNRESOLVED. Evidence expired/revoked/invalid/indeterminate hoặc coverage thiếu không thành bằng chứng an toàn.

Tests kiểm tra FAILED, SATISFIED, INDETERMINATE, CONFLICTING, EXPIRED, REVOKED, INVALID; assert decision/reasons và input không đổi. untrustedAssessmentState của caller không được dùng làm confirmed legal decision.

confirmedPhysicalFailure luôn NOT_ESTABLISHED vì chưa có physical-truth verifier. Không tuyên bố đã tạo “confirmed failure” thật. Bất kỳ confirmed failure tương lai cũng không thể bị implementation này xóa: không có nhánh áp dụng exemption; suspected bottleneck trong engine vẫn FAILED theo technical assessment và output vẫn UNVERIFIED.

## 13. Orchestrator Integration

API vẫn createTestOnlyVerificationOrchestrator(context).verify(request). Request không có nhánh production; context chỉ test root/clock ngoài payload. Orchestration dùng v2 raw signed bytes và không nhận legacy receipt làm fallback.

Bổ sung revocation steps/facets cho manifest, approval, evidence và exemption, cùng các lần kiểm tra cuối. Final shared reading đánh giá lại registry, toàn bộ lifecycle/document statuses, graph/profile identity và document validity. Các kiểm tra độc lập vẫn thu thập reasons khi một dependency thất bại; không mặc định downstream là verified.

ExemptionDecisions được trả riêng, không cấp vào engine. Policy cần graph manifest và profile approval receipts phù hợp với current registry, cùng profile/configuration binding. Applicability/conflict có audit riêng, được chạy sau khi đã thu thập toàn bộ evidence, rồi re-evaluate tại final shared instant khi có thể.

Không xóa gate tám criteria hoặc spatial declaration. Engine chỉ nhận diagnostic projection hiện có; không nhận test receipts để unlock. Không sửa importer, endpoint hoặc các consumer production.

## 14. Audit Trail Verification

Audit tiếp tục giữ step ID/type, subject identity, status/scope/policy/time, codes, input/dependency/result references. Các typed observation mới: lifecycleStatus, exemptionDecision và pipelineState.

Có các step riêng cho registry, authority lifecycle, key lifecycle, document revocation; signature/document authenticity; exemption applicability; evidence conflict và pipeline-final. Authority ACTIVE + key REVOKED được ghi thành hai observations, tổng pipeline REJECTED. REVOKED không bị certificate expiry hoặc ACTIVE ở facet khác ghi đè.

Facets là facts của signed test snapshot tại evaluation time; VERIFIED authority facet không thay thế aggregate failure do key/registry/document. Audit cuối giữ tất cả reasons quan sát độc lập được, bao gồm thời điểm có revocation cùng snapshot stale.

Subject/artifact references dùng hashes hoặc stable IDs; không đưa raw signed documents, PEM material, approval/officer contents hoặc exception text vào audit. Exemption output có references cần thiết theo contract, không có raw proof/document body. Summary không có WeakMap credential provenance.

Evidence permutations, repeated pipeline execution và policy execution cho output deterministic; nested output được freeze. Không ghi audit vào database hoặc production logger.

## 15. Regression Tests

| Nhóm cuối cùng | Suites | Cases | Kết quả |
|---|---:|---:|---|
| Independent revocation mới | 1 | 45 | PASS |
| Exemption policy mới | 1 | 40 | PASS |
| Tổng mới | 2 | 85 | PASS, 1.334s |
| Qualification engine cũ | 2 | 226 | PASS, 0.574s |
| Foundation + orchestration cũ | 9 | 163 + 139 = 302 | PASS, 3.824s |

Tất cả 840 scenarios cũ vẫn có trong full suite; không xóa, skip hoặc giảm count. Năm file fixture/spec cũ được sửa vì contract mới, không phải chỉ đổi kỳ vọng để xanh:

- Registry fixtures ký schema v2 mới với hai trạng thái bắt buộc.
- Crypto authority revoked/unknown scenarios dùng authorityStatus; giữ expected denial statuses.
- Orchestration authority scenarios đổi label/field cho chính xác; key cases độc lập bổ sung trong matrix mới.
- Boundary test yêu cầu verification policy mới.
- Signed record helper thêm body context để test applicability claims, không thêm receipt success seam.

Năm module engine và 226 engine tests/fixtures/oracle bị khóa không đổi. Golden oracle Python: **2 V2 SHA-256 vectors + 6 decimal Half-Even vectors PASS**. Không tuyên bố Kotlin parity.

## 16. Security/Fault Injection Tests

45 revocation cases bao phủ lifecycle matrix, missing fields, independent periods, signed v1/v3/policy mismatch, unavailable source, legacy combined field, registry bytes/signature/schema faults, duplicate keys, provenance forgery, prototype/JSON/spread, cross-registry/key replacement, scheduled races, simultaneous reasons và audit facets.

40 exemption cases bao phủ missing legal/physical proof, complete proof claims không đủ trust, permissions, full signed tuple mismatches, bridge/tunnel/culvert/hidden structures, terrain/highway/track/path, expired/revoked exemption, receipt/proof swap, forged receipts, evidence state matrix, conflict, incomplete coverage, vehicle configuration tamper, determinism và native engine integration.

Tests assert decision và reason codes; không chỉ production UNVERIFIED. Exemption có parallel load failure giữ CONFLICTING và engine untrustedAssessmentState=FAILED với bridge false hoặc true.

Unexpected revocation evaluator exception được fault-inject trong test, trả UNEXPECTED_VERIFIER_EXCEPTION và không lộ private exception text. Các fault-injection suites 5C.2B tiếp tục kiểm tra các verifier exceptions khác; không dùng mock để giả thành công crypto.

Trong development có failures ở code UNKNOWN naming, audit mất lý do race, fixture/type guards và test swap khác-registry; đã xử lý contract hoặc sửa fixture để kiểm tra đúng trường hợp. Final run không có test đỏ/skip. Không dùng số lần chạy lặp làm số case mới.

## 17. TypeScript Typecheck

Lệnh:

    npx --no-install tsc --project tools/osm-importer/tsconfig.json --noEmit

**PASS, exit 0 sau thay đổi cuối.** Không có any hoặc cast để bypass receipt provenance trong logic mới. Registry schema casts còn lại chỉ sau exhaustive field/enum/period/key validation, không mint credential từ caller object. Không đổi compiler options.

## 18. NestJS Build

Lệnh:

    npx --no-install nest build

**PASS, exit 0 sau thay đổi cuối.** Không thay sourceRoot/config hoặc endpoint. Tìm kiếm import trong Nest source/importer/CLI không thấy wiring của revocation/exemption/orchestration mới.

Build tái tạo dist/cache như cấu hình hiện có; không suy từ build PASS rằng có production integration. Python golden verification cũng exit 0; output ở mục 15.

## 19. Full Backend Test Results

Lệnh:

    npm test -- --runInBand

**925/925 tests, 39/39 suites PASS, Jest 18.748s, exit 0.**
Zero skipped tests; zero snapshots. 925 = 840 cũ + 85 mới; 39 = 37 cũ + 2 mới.

Thứ tự cuối: targeted mới -> 226 regression engine -> 302 foundation/orchestration -> typecheck -> Nest build/golden -> kiểm tra isolation/snapshot -> full backend -> artifact/hash/mtime và Git checks.

Warning Experimental VM Modules và SosService mock Firebase projection warning/debug là output đã có của suite; suite tương ứng PASS. Không gọi deploy hoặc thay runtime cloud configuration.

## 20. Artifact Preservation

Đã kiểm tra lại importer isolation: mọi runCli fixture/real/custom ghi vào mkdtemp của test dưới /tmp, cleanup chỉ owned root, afterAll có artifact guard. Không sửa test importer, CLI hoặc output-real.

71 baseline entries gồm 20 artifact, các source/test/CLI và bảy docs cũ. **11 thay đổi đều đúng allowlist; 60 entries ngoài thay đổi giữ nguyên SHA-256 lẫn mtime_ns** từ đầu task đến sau full suite. Snapshot ngay trước/sau full suite gồm cả file mới: zero changed entries. Zero new output artifacts.

Toàn bộ graph JSON/GZIP, RoutingManifest và ImportDiagnostics giữ nguyên. Graph gzip Đà Nẵng output-dryrun-task3b vẫn SHA-256 1b7f64a965a763624e0a6c2cd866352fc3ef5f106214907866d0c6dcb49c25b4. Không nâng contract 2.1.0 hoặc edge qualification. Không suy local preservation là bằng chứng remote deployment.

Phụ lục ghi hash/mtime_ns đầy đủ cho 60 stable files và before/after của 11 file được sửa. Timestamp là chuỗi nanosecond, không qua JavaScript number.

## 21. Remaining Blockers

- Chưa có independently verified legal basis, physical structure/crossing model hoặc trusted survey coverage. APPLICABLE_TEST_ONLY chỉ là reserved contract state; không phát hành decision giả cho “proof đầy đủ” tự khai.
- Chưa có confirmed physical failure provider hoặc positive legal applicability fixture đủ provenance. Test-authenticated numeric failure được bảo toàn như veto, không nâng thành confirmed legal fact.
- Signed snapshot không phải live revocation monitoring. Các sự kiện mới chưa có trong signed bytes không thể được old immutable receipt biết tức thời; cần nguồn/context mới và re-verification.
- Test registry có một key trên mỗi authority entry, chưa mô hình hóa production key rotation/history.
- Chưa có production PKI/root provisioning, X.509/CRL/OCSP, authoritative registry, authenticated external time hoặc production loader. Certificate checks hiện là signed test metadata.
- WeakMap bảo vệ provenance trong module/process chưa bị sửa, không chống code có toàn quyền monkey-patch cùng process. Test spies không phải production provider.
- Kotlin/configuration-digest cross-language parity và actual field/legal documents chưa được kiểm chứng.

Không blocker nào được xử lý bằng ACTIVE fallback, bỏ verifier, sửa engine hoặc mở production branch. Exemption giữ INCOMPLETE/denial; production giữ khóa.

## 22. Final Acceptance Decision

**CONDITIONAL PASS – Task 5C.2C test-only foundation.**

| Câu hỏi nghiệm thu | Trả lời theo bằng chứng |
|---|---|
| Authority và key được kiểm tra độc lập chưa? | Có, mandatory statuses/periods, matrix và hai negative end-to-end bắt buộc đều PASS |
| Registry cũ bị từ chối đúng cách không? | Có, native signed v1 không được migrate/fallback; unsupported schema có code riêng |
| Còn revocation bypass không? | Không phát hiện trong matrix/race/provenance tests đã chạy; không tuyên bố live detection cho sự kiện ngoài signed snapshot |
| Exemption có xóa failure không? | Không có nhánh áp dụng; original evidence không đổi, technical failure/conflict được giữ |
| Có positive test-only không? | Có full native chain cả JSON/GZIP, eight-criterion PASS, pipeline VERIFIED_TEST_ONLY và engine vẫn khóa |
| Có positive exemption applicability không? | Chưa; thiếu proof verifier/model nên test complete claims vẫn INDETERMINATE, không giả APPLICABLE |
| Có negative end-to-end không? | Có authority/key combinations, lifecycle races, stale final instant, exemption/failure và existing security suites |
| Production engine có đổi không? | Không; năm module bị khóa và regression engine không đổi hash/mtime |
| Artifact có đổi không? | Không; toàn bộ 20 artifact hash/mtime_ns giữ nguyên |

Independent revocation gate đạt trong TEST_ONLY. Exemption foundation phân tách đúng các quyết định và giữ fail-closed, nhưng chưa có chứng cứ pháp lý/công trình thực để nghiệm thu applicability. Tests xanh không thay thế những chứng cứ còn thiếu.

## 23. Next Task Recommendation

Có thể tiến sang một task được ủy quyền riêng để chốt proof schemas/provenance cho legal basis, structure identity, crossing/culvert inventory và survey coverage, thiết kế snapshot refresh/key rotation contracts, cùng independent review cho policy mới.

Phạm vi tiếp theo vẫn test-only và thiết kế provider contracts; chưa đủ điều kiện production qualification, sidecar/importer/API/Android/UCS hoặc strict routing. Chưa có pháp lý thật hay PKI production được xác minh.

Dừng tại 5C.2C. Không tự triển khai 5C.2D; không commit/push/deploy, không đổi dữ liệu Đà Nẵng hoặc phát hành sidecar.

## Phụ lục A — 60 file giữ nguyên

SHA-256 và mtime_ns dưới đây trước = pre-full = sau. Bao gồm cả 20 artifact và các file ngoài thay đổi được cho phép; không gồm build/cache.

| File | SHA-256 không đổi | mtime_ns không đổi |
|---|---|---|
| docs/PHASE5_TASK5B1_FINAL_CONTRACT_AUDIT.md | ad8525e320048cce5c3b428dd7954b9987b6d3b2f34264e560fa2948d196402b | 1793890135064394386 |
| docs/PHASE5_TASK5B1_FINAL_CORRECTIVE_PATCH_REPORT.md | 70896f5478270e1a732c96c6bcd7cf88303dcad865dabb4b8a9d069a10007710 | 1793890120871393623 |
| docs/PHASE5_TASK5C1R_CODEX_REMEDIATION_REPORT.md | 5d97544b34b4dce58ed472a8e670387b8468d01adf5f6590ebde7480f9e166fd | 1793894452376830963 |
| docs/PHASE5_TASK5C1_CODEX_INDEPENDENT_AUDIT.md | 86602b1dc8691440da765bf941d65484403bb5ca7ce5ce10d2468945ecbec570 | 1793892535079894667 |
| docs/PHASE5_TASK5C1_IMPLEMENTATION_REPORT.md | 2de07aeaf706abf43a91764caad9a6e4d869fd6ea192fee51ed852463515bd4e | 1793894181902680560 |
| docs/PHASE5_TASK5C2A_CODEX_IMPLEMENTATION_REPORT.md | 963cb6b339e5a53269a11e8462bf7c31587c58096a47ba45deb281b4160ac4e1 | 1793897418017355405 |
| docs/PHASE5_TASK5C2B_CODEX_IMPLEMENTATION_REPORT.md | b7f9e3b0e6ecbab7d72de080b705852833d76aeabd4a71ee1cd268ca6b9305b1 | 1793899080938815581 |
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
| tools/osm-importer/src/qualification-evidence.ts | 51f4421abe7e8460fc2a528f49d30ca90be1542a568c8b57008a9d896336cec8 | 1793893886150883218 |
| tools/osm-importer/src/qualification-geometry.ts | be0980fb447f6002d913c5013ab581b483fb79b5fdcaad2b0fb316272e136864 | 1793894049079841089 |
| tools/osm-importer/src/qualification-identity-binding.ts | c7c2e53187a77d3e9cea7ab850e2ea959233af6f6bf13bdf8fc846d4a80d343e | 1793896564956056311 |
| tools/osm-importer/src/qualification-profile-verifier.ts | 0cf9ba0f83e497d94f6393bcd01f43b2616cf8c2cbe4020189dc4511b25f95ed | 1793896796744139854 |
| tools/osm-importer/src/qualification-trusted-clock.ts | 1145bbc567b5fd8ea08bbe152c62251be69438995068c43e7deea7d62447d454 | 1793896796619139811 |
| tools/osm-importer/src/qualification-types.ts | ad6d802bbc5f566e22e44a6eb2ba2c6d913de716d990d45d59c1057fe66f3f1b | 1793894049079723173 |
| tools/osm-importer/src/qualification-validation.ts | ec70c975cbd986c271794ddec7bdcf600590d45b153e40e0f1816d40f81a28f4 | 1793893886150640629 |
| tools/osm-importer/src/qualification-verification-adapters.ts | 536e141bb41f509ba51629b891f779409f57403f60ace8ba7ba9dcbef56d24bf | 1793898626776660988 |
| tools/osm-importer/src/qualification-verification-audit.ts | ac4aef39a2ac802e7bd830d26c2e6fc9a99d5ea273d2f4b93ebf4c48b507761a | 1793898626788225653 |
| tools/osm-importer/src/qualification-verification-json.ts | b624ab1ffd963cc09a325fcc39f0529ae6e93acfc33b4670b666fa2bccc2f363 | 1793896692008038165 |
| tools/osm-importer/src/turn-restriction-parser.ts | dbf80b9c2f5e8b8b3d257cd16f80165660681c7cd0a1538efe21ba9dc7219cf9 | 1793794905677395467 |
| tools/osm-importer/src/types.ts | e5fa58371295405beb1444924821be3f2178d20f1f6fa10dff375820e660603f | 1793814244473402428 |
| tools/osm-importer/src/vehicle-profile.ts | 3efc8a2692bd464ca71127520e0aed2fe60311acb15d4915d26c9540769d34b7 | 1793729013271380586 |
| tools/osm-importer/src/via-way-resolver.ts | 4e1874200575a81be956ab8682f544961e06cf05db65439d2b05ef0c54819d7b | 1793815518262830641 |
| tools/osm-importer/test/edge-qualifier.spec.ts | 6afe8f1a00fbe4409cab22d88eef172cb24eb59a9ac9b13237f0d0ba42a560df | 1793894049079509686 |
| tools/osm-importer/test/osm-importer.spec.ts | f4de0646b6d1b6280295487452a06b0c51b671db4228813ba23712060516b3f4 | 1793893600313985800 |
| tools/osm-importer/test/qualification-artifact-verifier.spec.ts | 3faa38d8ed9b1f102c69b227ca1454fdc0a11c8ed36f866f3b9532ab0e7e74ba | 1793896565038056349 |
| tools/osm-importer/test/qualification-fixtures.ts | 9b379604ec8838b08c9e41c633e8c143b6cac9999cb4881e9e47049bd44afa20 | 1793893574235828677 |
| tools/osm-importer/test/qualification-geometry-golden.json | 835a4aa48ac5360ba49881408cbaf905f483331410a80bdde98f58f9488b581d | 1793893939819474027 |
| tools/osm-importer/test/qualification-identity-binding.spec.ts | 66d558dfb62562dac03353aa9566007c4a9986068d9fe66e7851f4fdea62c1a8 | 1793896565053056357 |
| tools/osm-importer/test/qualification-profile-document.spec.ts | 590f91220d6f2f0c64656ecbb68d23702108973e8a6ef95b3c4fb0ef0358b36a | 1793896565079056369 |
| tools/osm-importer/test/qualification-remediation.spec.ts | f097b601fd1c61262d1ab00dfeda65bcb0e9f05efa7f5ce60e3b1f98d951c5a0 | 1793894049079176268 |
| tools/osm-importer/test/qualification-trusted-clock.spec.ts | 4f319f43d393fe15bb656ebc7c3a29e46798633bc5410092bdb6c7b82e0f21d7 | 1793896565089023979 |
| tools/osm-importer/test/qualification-verification-fault-injection.spec.ts | afa7932a91b98afb574cb00bc2725623676bdfdd7f3df0d4f188d63b17db47c4 | 1793898626901661017 |
| tools/osm-importer/test/qualification-verification-integration.spec.ts | d96f0e2036ebf420b04b251a19e7705a92bdb4bb861be7c4930ee080f720efbb | 1793898626821693961 |
| tools/osm-importer/test/verify-qualification-golden.py | 2085deea55f7bdc4f694fd7ac1aa1ffee3e28d66c3b445f2a03ed7697ceb5ef6 | 1793893939826545948 |
| tools/osm-importer/test/via-way-resolver.spec.ts | e79e2288418695c1d9850e18b156f73accf757efba112bbe706343448af90bd6 | 1793815518335537502 |

## Phụ lục B — 11 file sửa trong phạm vi

Không dùng Git dirty status làm bằng chứng thay đổi của task. Các hash/timestamp sau so với baseline đầu task; pre-full = sau full suite cho mọi entry.

| File | SHA-256 trước | SHA-256 sau | mtime_ns trước | mtime_ns sau |
|---|---|---|---|---|
| tools/osm-importer/src/qualification-authority-registry.ts | 5408e19153dfeb8b3290ec751574c875f7cbd51e6a52b9859ed7d2da868acd1a | 291eb2450d8df578b9369f9ba2ac29cad30286117f5d6faf4c49a479da2618ce | 1793896796669139828 | 1793901353860679185 |
| tools/osm-importer/src/qualification-crypto-verifier.ts | 50d5086d241a3268df7d880f715217847812f35ad2c5cadb86fe117ff4edea4e | 11d1a0ca4296326fdfa6490ab271f4779b445f58704d9fea53b0d05c166417d7 | 1793896796697302959 | 1793901353903856138 |
| tools/osm-importer/src/qualification-document-verifier.ts | 61c85e36c450f0ac0cac59528d5cf614d457dd48fe19ae1f32dfa463bb801559 | 36d44369ec7a5537da66d10b2ccb4ddcbcabe0f4f31d21ebd07efdecb12d2a3f | 1793896796764139861 | 1793901353939230349 |
| tools/osm-importer/src/qualification-trust-types.ts | bb60a6d474b169606558a5e2bbfd191083ce5731a61ba9727acd0c1a6624641f | 46fd71571b47bed42055b1fd7602f41d4f63fda2d1c7ae127696a5fd2b3e8519 | 1793896564749056212 | 1793900645393672912 |
| tools/osm-importer/src/qualification-verification-orchestrator.ts | b61cc6fc06ad1fd2911d4e9ecff6322d52870b6efd41adf441153831ae41ecaa | 191a7ad09e4181b97a95d703ec5832f06f9975a2ff9c33848534f6e5c4badf6a | 1793898841837733132 | 1793901458892287840 |
| tools/osm-importer/src/qualification-verification-pipeline-types.ts | f0e679b0be1e02859a1eeddf0ded54b8813a065f44837a1a1c268fa7f5f437a2 | 33cf20922c191b1405d0fc88a56d398b27ed0ddbc7e6bb58604f3b49892abc88 | 1793898626752660982 | 1793901354026323988 |
| tools/osm-importer/test/qualification-crypto-verifier.spec.ts | a8332fa815d345b2d082ca54eac779fde705dbf8f274fc07ce1abdc604b5cc6a | 10582a03eb788776e41f20d71ff05badaa5a24a4e05fa56ff2c1b73b7570b649 | 1793896692175103574 | 1793900645393977369 |
| tools/osm-importer/test/qualification-trust-boundary.spec.ts | 3cd5c2e422a63fd3e917fd98e1bce905f17842d5af3199d1557495ccdf956741 | 2df9cf4931668588e8768a20f3c9bae3df64eaa23e6bd9c3470bc210cf27b34d | 1793896796947139925 | 1793900645394255517 |
| tools/osm-importer/test/qualification-verification-pipeline-fixtures.ts | 70b50fc2c1882d68eea661717252125e3ba0b7344e28c694d5d8a69dd4428428 | 941b06c1726e5b467883ccf09b531c4b5202e3646b19cb20c196f4221e71c9cc | 1793898626808035148 | 1793901052597465930 |
| tools/osm-importer/test/qualification-verification-pipeline-security.spec.ts | 718c5e78d0bac4e54b4c1b93d9a8e31dd01b37c23a6729a97563261d04624086 | 1bb2f25bf90a069ec0f1745587e506daa0ca570663255d294bc56030bdf14416 | 1793898841910245097 | 1793900645394140779 |
| tools/osm-importer/test/qualification-verification-test-fixtures.ts | d546b28169c70ec1fd205adbb100e47ed2256cfc339caa43621dc179b1c14b8b | 6d80533047560782e16cd489d2cd765fea6d3c4dc84e755401576d64142650b8 | 1793896564987056325 | 1793900645393819156 |

