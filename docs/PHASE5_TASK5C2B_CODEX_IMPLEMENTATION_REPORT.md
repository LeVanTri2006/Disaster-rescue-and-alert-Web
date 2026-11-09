# PHASE 5 – TASK 5C.2B: TRUSTED VERIFICATION ORCHESTRATION & TEST-ONLY INTEGRATION

Ngày hoàn tất: 06/11/2026, Asia/Bangkok. Repository: /home/vantri/AndroidStudioProjects/canh-bao-thien-tai-backend-app.

## 1. Executive Summary

**CONDITIONAL PASS cho orchestration test-only. Production qualification tiếp tục khóa.**

Đã triển khai một orchestrator thuần trong bộ nhớ, gọi các verifier hiện có để xác minh signed test registry, manifest, graph raw bytes, directed edge/node/geometry, profile approval/configuration và tám signed criterion evidence. Full-chain fixture trả VERIFIED_TEST_ONLY cho cả JSON và JSON.GZ. Tám đánh giá số đo của fixture đều PASS_CERTAIN, nhưng Qualification Engine vẫn trả:

    purpose = DIAGNOSTIC_ONLY
    trustStatus = UNAVAILABLE
    qualificationStatus = UNVERIFIED
    isProductionApproved = false

Có **139 test cases mới trên 3 suites**. Regression engine/foundation **389/389 PASS**, toàn backend **840/840 tests trên 37 suites PASS**. Typecheck importer và NestJS build exit 0. Không có test.skip/test.todo trong tests mới; final full run không có skipped tests.

**62/62 file baseline giữ nguyên SHA-256 và mtime_ns**, gồm 20 artifact, 21 source, một CLI, 14 test/fixture/oracle và sáu tài liệu cũ. Chỉ thêm bốn source, ba specs, một fixture và báo cáo này. Không sửa module cũ hoặc importer test.

Phần có điều kiện: xác minh tài liệu exemption đã chạy, nhưng áp dụng exemption thay thế evidence được giữ INCOMPLETE và không xóa failure. API registry cũ gộp authority/key vào một entry, nên chưa thể kiểm chứng hai trạng thái revocation độc lập. Không sửa API ngoài phạm vi để che các giới hạn đó.

## 2. Repository Baseline

Đã kiểm tra pwd, Git status, diff check, AGENTS.md, Node/TypeScript, Jest/tsconfig và importer isolation trước implementation. Không tìm thấy AGENTS.md áp dụng tại repository hoặc thư mục cha đã kiểm tra; các bản trong node_modules không áp dụng cho mã task.

Node.js v26.8.2; TypeScript 6.0.3. Jest 30, ts-jest, node environment, testRegex *.spec.ts, chạy runInBand. Importer tsconfig dùng CommonJS/ES2021, strictNullChecks/noImplicitAny, include source/test/CLI. Không đổi config hoặc cài dependency.

Repository dirty từ baseline. Danh sách trạng thái ban đầu đã lưu và giữ nguyên:

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
    ?? tools/osm-importer/src/qualification-verification-json.ts
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
    ?? tools/osm-importer/test/qualification-verification-test-fixtures.ts
    ?? tools/osm-importer/test/verify-qualification-golden.py
    ?? tools/osm-importer/test/via-way-resolver.spec.ts

Đã lưu hash và mtime_ns trước test; timestamp truyền/lưu dạng chuỗi decimal, không làm tròn qua JavaScript number. Baseline có 62 file, không bao gồm dist/cache. Có snapshot thứ hai ngay trước full suite cuối cùng. Báo cáo 5C.2A/5C.1R/audit và mã verifier/engine/test fixtures đã được đối chiếu với API thực tế.

## 3. Files Created/Modified

Tất cả đường dẫn trong bảng tương đối với repository.

| File mới | Vai trò |
|---|---|
| tools/osm-importer/src/qualification-verification-pipeline-types.ts | Claimed request, out-of-band test context, states, completeness và outcome không phải credential |
| tools/osm-importer/src/qualification-verification-orchestrator.ts | Dependency gating, receipts cục bộ, lifecycle revalidation và diagnostic comparison |
| tools/osm-importer/src/qualification-verification-adapters.ts | Runtime guards, byte/JSON snapshots, deterministic record order và projection cho engine |
| tools/osm-importer/src/qualification-verification-audit.ts | Structured summaries, hashed references và explicit state aggregation |
| tools/osm-importer/test/qualification-verification-pipeline-fixtures.ts | Native ephemeral Ed25519 keys/registry/documents, full eight-criterion dossier |
| tools/osm-importer/test/qualification-verification-integration.spec.ts | 8 positive/isolation/determinism cases |
| tools/osm-importer/test/qualification-verification-pipeline-security.spec.ts | 97 registry/binding/evidence/time/security cases |
| tools/osm-importer/test/qualification-verification-fault-injection.spec.ts | 34 malformed input/exception/snapshot/provenance cases |
| docs/PHASE5_TASK5C2B_CODEX_IMPLEMENTATION_REPORT.md | Báo cáo này |

Không sửa năm module engine, chín module foundation, test cũ, importer/CLI/types, artifact, Nest endpoint, Prisma, Android/UCS hoặc cloud config. Formatter chỉ chạy trên file mới. Build tái tạo dist và incremental tsconfig.build.tsbuildinfo theo cấu hình deleteOutDir hiện có; cache này đã dirty ở baseline. Jest có cache mặc định. Không coi dist/cache là artifact graph bất biến.

## 4. Verification Pipeline Architecture

API chính: createTestOnlyVerificationOrchestrator(context).verify(request).

Context là cấu hình TEST_ONLY ngoài payload: public test root, root reference và clock provider. Request chỉ chứa claimed registry bytes/signature, detached documents, raw graph bytes/representation, binding, profile và record/document pairs. Không nhận receipt, callback verifier, clock hay trust root từ request.

Luồng phụ thuộc:

    clock + request + evaluation time
      -> signed registry
      -> manifest signature       + approval signature
      -> graph byte verification  + profile/configuration verification
      -> directed edge/node/V2/profile/policy identity
      -> evidence/exemption signatures, integrity, authenticity, signed tuple
      -> unique IDs + eight-criterion completeness
      -> final registry/identity/documents + one shared evaluation instant
      -> locked diagnostic engine
      -> final clock observation + immutable audit summary

Manifest và approval độc lập nên lỗi ở cả hai được giữ. Bước bị chặn có status BLOCKED và dependency references; không chạy verifier như thể upstream thành công. Các receipt chỉ ở local variables và luôn đi qua API provenance của foundation.

Không có filesystem/network/database logging hoặc write side effect trong source mới. Adapter giải nén/đọc JSON từ bytes trong bộ nhớ đã xác minh; không phải production graph loader.

## 5. Orchestration State Machine

| Trạng thái | Ý nghĩa |
|---|---|
| NOT_STARTED / VERIFYING | Trạng thái mô hình; verify hiện đồng bộ, không phát intermediate response |
| VERIFIED_TEST_ONLY | Các gate bắt buộc hoàn tất trong isolated test trust domain |
| REJECTED | INVALID, EXPIRED, REVOKED hoặc UNTRUSTED_ISSUER tại bất kỳ bước nào |
| VERIFIER_UNAVAILABLE | Có phụ thuộc xác minh/clock unavailable và chưa có rejection cụ thể |
| INCOMPLETE | Missing/malformed claim, UNVERIFIED, BLOCKED hoặc thiếu criterion/coverage declaration |

Ưu tiên được viết thành điều kiện rõ ràng: rejection, unavailable, incomplete, rồi test-only success. Không so thứ tự enum. Không có trạng thái production-approved. Outcome luôn productionAuthoritative=false, qualificationEligible=false và auditIsCredential=false.

## 6. Trusted Registry Flow

Registry bytes/signature được copy từ request; rootPublicKey/rootReference chỉ lấy từ cấu hình host test đã truyền khi tạo orchestrator. Registry loader thực hiện native Ed25519 và canonical schema/entry/validity/freshness checks. Root trong payload, payload public key, certificateChain hoặc receipt bị strict allowlist từ chối.

Đây là test-root provisioning rõ ràng, không phải root chính phủ hoặc PKI production. TEST_ONLY context không cho phép chuyển scope. Fixture keys sinh trong bộ nhớ bởi fixture 5C.2A, không ghi private keys ra filesystem.

Entry authorization được foundation kiểm tra lại khi xác minh/inspect document: authority ID, key ID, category, criterion, periods, revocation và revokedDocumentIds. Snapshot freshness một giờ là policy test có sẵn, không phải policy production mới.

## 7. Crypto & Document Verification Flow

Orchestrator gọi verifySignedDocument trên exact copied bytes, sau đó verifyEvidenceDocument cho integrity và signed-record authenticity. Không tin digitalSignatureStatus tự khai; trường đó chỉ là schema declaration của engine cũ.

Phân biệt bốn lớp:

| Nhãn | Điều có thể kết luận |
|---|---|
| TECHNICAL_ONLY | Phép toán chữ ký/hash; không tự xác thực issuer |
| VERIFIED với scope TEST_ONLY | Receipt do verifier tạo trong registry/clock test; không có production authority |
| VERIFIED_TEST_ONLY | Summary của orchestration đã đi qua các gate test |
| UNVERIFIED của Qualification Engine | Không có production qualification, kể cả mọi technical document check đã PASS |

Receipt spread/JSON round-trip không còn WeakMap provenance. Orchestrator không xuất receipt cache; audit/outcome không được nhận ngược vào foundation như document/graph/profile credential.

## 8. Graph Artifact Verification Flow

verifyGraphArtifact nhận raw JSON hoặc JSON.GZ bytes và receipt manifest gốc. Expected digest lấy từ signed manifest, không từ claimedDigest. Representation, graph version và optional caller digest/version đều đi qua verifier hiện hành.

Test tampered raw bytes, signed manifest digest/version mismatch, malformed JSON, invalid UTF-8, truncated GZIP và duplicate node/edge IDs đã thực thi. Digest có thể khớp một artifact lỗi cấu trúc; parsing/schema vẫn phải từ chối.

Graph snapshot được foundation copy/freeze. Adapter chỉ lấy metadata của edge từ cùng authenticated byte snapshot để kiểm tra exemption schema; không dùng metadata của caller làm nguồn xác thực độc lập.

## 9. Edge Identity Binding

verifyEdgeIdentity kiểm tra tuple đầy đủ: graph version/raw digest, edge ID, osmWayId, from/to node IDs, direction, geometry hash version/V2 digest, profile ID/version/configuration digest và qualification policy.

Node membership và raw geometry endpoint equality dùng implementation 5C.2A. Signed manifest qualificationIdentity phải khớp profile và policy. Test missing node, endpoint mismatch, missing edge, wrong direction/hash/version/profile/configuration đã chạy. Không nâng graph contractVersion 2.1.0 hoặc sửa geometry algorithm.

## 10. Vehicle Profile Binding

Signed approval được xác minh qua registry trước verifyProfileProvenance. Foundation kiểm tra profile schema/status, approval bytes hash, subject/profile version, canonical configuration digest và provenance/validity.

Profile claim ID/version/height thay đổi, revoked status và signed approval expired đều không thể đạt test-only success. inspectVerifiedProfile và verifyEdgeIdentity được dùng lại ở lifecycle checkpoints.

Không cấp chứng nhận phương tiện thật từ test profile. Dữ liệu authority/officer trong fixture chỉ là claim trong domain test.

## 11. Evidence Completeness

Mỗi evidence/exemption envelope bổ sung body.binding được ký, chứa toàn bộ EdgeIdentityBinding. Đây là điều kiện của orchestration mới, không thay schema/module cũ. body.record tiếp tục được document verifier so toàn bộ projection hiện hành. Vì vậy một record có cùng edge ID nhưng khác graph/profile/configuration/policy không đủ để pass.

Mỗi criterion có recordCount, authenticatedRecordCount, declaredFullEdgeCoverage, actualSurveyCoverage=UNVERIFIED và physicalTruth=UNVERIFIED. Chỉ đếm schema-valid evidence; chỉ tính declaration coverage khi document/record/tuple đều hợp lệ. Point hoặc section không được tự nâng thành full-edge coverage. Thiếu bất kỳ criterion nào trả INCOMPLETE.

Chữ ký không chứng minh số đo hoặc khảo sát ngoài thực địa. Một signed measurement FAIL vẫn có thể có hồ sơ tài liệu VERIFIED_TEST_ONLY; kết quả số đo được giữ riêng trong untrustedAssessmentState=FAILED của engine, không biến thành chứng nhận đường an toàn.

Exemption có thể xác minh authenticity/integrity/binding nhưng luôn thêm EXEMPTION_APPLICATION_UNAVAILABLE_NOT_APPLIED. Không thay evidence hoặc xóa suspected bottleneck. Nhánh này không đạt VERIFIED_TEST_ONLY; không có logic áp dụng legal exemption mới.

## 12. Time & Revocation Checks

Mọi bước dùng reading mới từ provider; inspectClock kiểm tra provenance. System clock, fake reading, reused reading, clock exception và thời gian lùi bị từ chối. WeakSet chỉ ghi nhận việc dùng reading trong tiến trình, không biến test clock thành authenticated external service.

evaluatedAt phải là UTC hợp lệ và trùng instant của test clock ban đầu. Caller backdating hoặc timestamp không hợp lệ không được dùng làm thời gian quyết định. Sau snapshot, callback thay đổi caller buffers/profile/records không thay dữ liệu đang xác minh.

Registry/authority-key entry/certificate metadata/document/profile/evidence validity/revocation được foundation kiểm tra. Các receipt gốc được inspect lại; registry được reload từ copied signed bytes. Cuối pipeline, TẤT CẢ receipt và evidence được kiểm tra tại cùng một final reading. Nếu clock tiến thêm sau final validation thì summary giữ UNVERIFIED/INCOMPLETE thay vì success.

Đã tái hiện và sửa lỗi trong bản orchestrator mới: kiểm tra từng document ở các thời điểm khác nhau còn để lọt evidence hết hạn trước mốc tổng kết. Test cuối cùng làm tất cả evidence hết hạn đúng giữa per-document checks và shared final instant; bản đầu FAIL, bản sửa PASS. Không sửa foundation để xử lý lỗi này.

Giới hạn: API cũ không cung cấp authority và key revocation độc lập; chỉ có trạng thái của entry authority+key. Hai khía cạnh được kiểm tra qua cùng entry, không tuyên bố đã có hai nguồn CRL/OCSP riêng. Registry không có live update subscription; mọi kết quả chỉ là snapshot tại test time, không có giá trị tái sử dụng vô hạn.

## 13. Diagnostic Engine Comparison

Mỗi verify outcome đều gọi EdgeQualifier thật; không đưa receipt/context vào engine, không mock engine thành công. Projection sử dụng graph identity snapshot và records hợp schema. Khi thiếu profile/edge, projection rỗng có chủ đích không đạt schema, để engine vẫn trả locked diagnostics.

RoadEdge projection luôn UNVERIFIED, strict routing=false, flow UNKNOWN; metadata mặc định bảo thủ chỉ phục vụ diagnostics. Nó không được xuất thành routing graph. Exemption không được engine áp dụng.

Các test true/false/omitted production flag đều giữ bốn invariant. Flag true hoặc mode/context production bị từ chối rõ ràng. Với false/bỏ trống và full native chain, pipeline có thể VERIFIED_TEST_ONLY nhưng engine vẫn UNVERIFIED/false/DIAGNOSTIC_ONLY/UNAVAILABLE.

## 14. Audit Trail Structure

Mỗi step có stepId, verificationType, subjectIdentity, status, scope, policyVersion, timestamp, diagnosticCodes, inputReference, dependencyReferences và resultReference.

Subject của receipt dùng SHA-256 reference; artifact/document digest được dùng làm input reference khi có. Các bước logic dùng stable step references và dependency IDs. Không đưa raw document, private/public PEM hoặc nội dung approval/officer vào audit. Không log exception.message; unexpected exception chỉ phát code cố định.

Order của evidence/exemptions dựa trên canonical record/document identity và bytes, độc lập với caller array order. Diagnostic codes sorted/unique. Repeated execution, reversed/rotated evidence và duplicate-ID permutations cho output bằng nhau. Outcome và nested arrays/objects được freeze.

Audit là summary, không phải receipt; không có factory success cho verifier và không bypass private WeakMap.

## 15. Positive Integration Tests

8 cases của integration suite kiểm tra JSON/JSON.GZ full chain, repeated/permuted input, production flag true/false/omitted, audit/outcome giả làm receipt và nội dung audit không lộ tài liệu/keys/profile details.

Fixture gồm ba authority entries trong test keyspace để phù hợp whitelist schema cũ của tám criterion; mỗi entry có keyId riêng. Registry được ký bằng native Ed25519 test root, documents ký bằng ephemeral test signer, clock được tạo từ isolatedTestClock. Không mock chữ ký hoặc verifier ở positive full chain.

Assert các gate registry/manifest/approval/graph/profile/identity và tám signatures/tám final revalidations thực sự VERIFIED TEST_ONLY. Cả tám measurementDecision PASS_CERTAIN và untrustedAssessmentState SATISFIED; engine state vẫn INDETERMINATE, qualificationStatus UNVERIFIED.

## 16. Negative Security Tests

97 cases trong security suite gồm registry signature, quyền category/criterion, revoked/unknown entry, key ID không đăng ký, authority/certificate expiry, stale/future/expired registry, duplicate registry entry và document revocation; manifest/approval signatures; payload key/chain/context/receipt injection; configured root mismatch; previous-run receipt reuse.

Graph/profile cases kiểm tra toàn bộ tuple, signed manifest mismatch, byte tamper, missing nodes, endpoints, profile ID/version/configuration/revoked/expired approval. Evidence cases gồm signed wrong edge/graph/hash/criterion, expiry/revocation/future collection, changed bytes/signature/record, wrong signed profile binding, duplicate ID, thiếu từng criterion, partial spatial declarations và invalid offsets.

Exemption signed đúng và authority không đăng ký đều không xóa load failure. Clock cases gồm backdating/invalid UTC, unavailable/system/fake clock, replayed reading, time moving backwards/forwards, freshness hết hạn sau 8 documents và evidence expiry ngay tại final shared instant. Mọi negative helper đều kiểm tra production lock, không chỉ empty fixture.

## 17. Fault Injection Results

34 cases trong fault suite: authenticated malformed JSON/UTF-8/null graph, truncated GZIP có signed matching digest, duplicate node/edge IDs, valid signature trên malformed/noncanonical/BOM/duplicate-key/null documents, missing dependencies, nonobject requests, NaN/Infinity, callback mutation, copied runtime receipt và clock callback exception.

Jest spies chỉ nằm trong tests, fault-inject exception vào registry/signature/graph/profile/evidence verifier. Pipeline giữ UNEXPECTED_VERIFIER_EXCEPTION, không log secret exception text, không mặc định VERIFIED. Không có production callback seam để mint receipt.

Trong quá trình phát triển có test đỏ phát hiện lỗi final-time nêu mục 12 và lỗi phân loại unavailable/TypeScript typing của fixture; đã sửa trong file mới. Một lệnh chẩn đoán dùng -t chỉ chạy test tái hiện nên Jest lọc 96 case; không có test.skip lâu dài. Final run chạy đủ toàn bộ tests.

## 18. TypeScript Typecheck

Lệnh: npx --no-install tsc --project tools/osm-importer/tsconfig.json --noEmit.

**PASS, exit 0** sau thay đổi cuối cùng. Không có any hoặc type assertion để mint/bypass receipt trong source mới; as const duy nhất giữ literal tuple của danh sách gate. Các schema value lấy từ validator hiện có; non-null assertions cho claim chỉ dùng sau dependency gate đã pass. Không sửa tsconfig.

## 19. NestJS Build

Lệnh: npx --no-install nest build.

**PASS, exit 0** sau thay đổi cuối. Build không phải bằng chứng pipeline đã tích hợp runtime: sourceRoot vẫn src và tìm kiếm import cho thấy Nest/importer/CLI không tham chiếu orchestrator mới. Không có endpoint hoặc production wiring.

## 20. Full Test Results

Thứ tự thực thi cuối: 139 test mới -> 389 regression -> importer typecheck -> Nest build -> kiểm tra isolation/snapshot -> full suite -> đối chiếu preservation/Git.

| Nhóm | Suites | Tests | Kết quả |
|---|---:|---:|---|
| Integration mới | 1 | 8 | PASS |
| Security mới | 1 | 97 | PASS |
| Fault injection mới | 1 | 34 | PASS |
| Toàn bộ mới | 3 | 139 | PASS, Jest 2.500s |
| Engine 5C.1R + foundation 5C.2A | 8 | 226 + 163 = 389 | PASS, Jest 1.371s |
| Toàn bộ backend cuối cùng | 37 | 840 | PASS, Jest 16.595s |

Final full run: zero skipped, zero snapshots, exit 0. Full run trước khi thêm regression final-time có 839 tests; số nghiệm thu cuối là 840, không cộng số lần chạy lặp để phóng đại case count.

Warning Experimental VM Modules và warning/debug Firebase projection mock của SosService xuất hiện trong full suite; suite tương ứng vẫn PASS. Không có thao tác deploy/database/cloud từ task.

## 21. Artifact Preservation

Importer test isolation đã kiểm tra trước full suite: mọi runCli ghi fixture/real/custom vào mkdtemp thuộc /tmp, cleanup chỉ root của test và có afterAll artifact guard. Không sửa isolation code hoặc output-real.

Đã đối chiếu SHA-256 và mtime_ns ba mốc: baseline đầu task, ngay trước full suite cuối, và sau full suite. **62/62 baseline file không thay đổi**, không có artifact mới trong output*. Cả 20 artifact graph/manifest/diagnostics giữ nguyên. Các file source/test mới cũng không bị full suite sửa.

Graph gzip Đà Nẵng tại output-dryrun-task3b tiếp tục có SHA-256 1b7f64a965a763624e0a6c2cd866352fc3ef5f106214907866d0c6dcb49c25b4. Không suy diễn local hash xác nhận artifact remote đang deploy. Các output/output-real có fixture lịch sử từ audit cũ vẫn giữ nguyên; không khôi phục/xóa chúng.

Bảng hash/timestamp đầy đủ ở phụ lục; timestamp là chuỗi nanosecond, trước = pre-full = sau.

## 22. Remaining Blockers

- Áp dụng legal exemption để thay criterion còn unavailable. Document verification/binding chạy thật, nhưng application giữ fail-closed. Không có nhánh thay thế evidence hoặc xóa failure.
- Foundation dùng một revocationStatus cho entry authority+key. Chưa có API thể hiện độc lập authority ACTIVE nhưng key REVOKED; không tạo trạng thái giả hoặc sửa module ngoài phạm vi để tuyên bố đã kiểm chứng.
- Production PKI/root provisioning, registry/role policy thực, CRL/OCSP, authenticated external clock và production graph loader chưa được cấu hình. Public test clock có thể chọn ngày tùy ý; so evaluatedAt chỉ ngăn payload backdating so với context test, không xác thực thời gian thế giới thật.
- Signed declarations không chứng minh spatial survey/physical truth. Eight-criterion numeric PASS không đủ kết luận đường/xe an toàn.
- Kotlin/configuration-digest cross-language parity, actual field documents và production routing acceptance chưa kiểm chứng trong task.
- In-process WeakMap provenance không chống code có toàn quyền sửa module/Jest mock trong cùng process; fault spies chỉ là tests, không phải runtime provider.
- Pipeline synchronous và có giới hạn 32 MiB artifact theo verifier cũ; chưa thiết kế service throughput/async provider. Không đưa test API vào production.

Không blocker nào cho phép nâng scope/trust hoặc nới engine lock. Phần phụ thuộc API thiếu được ghi rõ và giữ INCOMPLETE.

## 23. Final Acceptance Decision

**CONDITIONAL PASS – Task 5C.2B test-only orchestration.**

Full-chain đủ tám evidence đã thực thi bằng native crypto và verifier thật, cross-domain bindings được kiểm tra, negative/fault/regression/build/typecheck đều PASS và artifact được bảo toàn. Production invariant giữ nguyên, kể cả đủ 8/8 technical PASS.

Không tuyên bố full exemption application hoặc independent authority/key revocation coverage khi API hiện có chưa thể biểu đạt. Đây là điều kiện nghiệm thu còn lại, không dùng tests xanh để che thiếu API. Không tạo production qualification hoặc bất kỳ đường unlock mới nào.

## 24. Next Task Recommendation

Có thể chuẩn bị một task được ủy quyền riêng để kiểm toán API orchestration/audit, chốt semantics exemption và independent key/authority lifecycle, rồi xây fixture/provider contract test tiếp theo. Phạm vi được phép tiếp tục hiện chỉ là isolated test integration; chưa đủ điều kiện phát hành sidecar, nối API production/importer/Android/UCS hoặc mở strict routing.

Dừng tại Task 5C.2B. Không triển khai 5C.2C, PKI/loader production, không đổi contractVersion hoặc dữ liệu Đà Nẵng; không commit, push hoặc deploy.

## Phụ lục — Preservation snapshot

Mỗi entry dưới đây có SHA-256 và mtime_ns trước = ngay trước full suite cuối = sau full suite. Đây là snapshot file local, không gồm build/cache hoặc remote state.

| File | SHA-256 không đổi | mtime_ns không đổi |
|---|---|---|
| docs/PHASE5_TASK5B1_FINAL_CONTRACT_AUDIT.md | ad8525e320048cce5c3b428dd7954b9987b6d3b2f34264e560fa2948d196402b | 1793890135064394386 |
| docs/PHASE5_TASK5B1_FINAL_CORRECTIVE_PATCH_REPORT.md | 70896f5478270e1a732c96c6bcd7cf88303dcad865dabb4b8a9d069a10007710 | 1793890120871393623 |
| docs/PHASE5_TASK5C1R_CODEX_REMEDIATION_REPORT.md | 5d97544b34b4dce58ed472a8e670387b8468d01adf5f6590ebde7480f9e166fd | 1793894452376830963 |
| docs/PHASE5_TASK5C1_CODEX_INDEPENDENT_AUDIT.md | 86602b1dc8691440da765bf941d65484403bb5ca7ce5ce10d2468945ecbec570 | 1793892535079894667 |
| docs/PHASE5_TASK5C1_IMPLEMENTATION_REPORT.md | 2de07aeaf706abf43a91764caad9a6e4d869fd6ea192fee51ed852463515bd4e | 1793894181902680560 |
| docs/PHASE5_TASK5C2A_CODEX_IMPLEMENTATION_REPORT.md | 963cb6b339e5a53269a11e8462bf7c31587c58096a47ba45deb281b4160ac4e1 | 1793897418017355405 |
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
| tools/osm-importer/src/qualification-authority-registry.ts | 5408e19153dfeb8b3290ec751574c875f7cbd51e6a52b9859ed7d2da868acd1a | 1793896796669139828 |
| tools/osm-importer/src/qualification-crypto-verifier.ts | 50d5086d241a3268df7d880f715217847812f35ad2c5cadb86fe117ff4edea4e | 1793896796697302959 |
| tools/osm-importer/src/qualification-document-verifier.ts | 61c85e36c450f0ac0cac59528d5cf614d457dd48fe19ae1f32dfa463bb801559 | 1793896796764139861 |
| tools/osm-importer/src/qualification-evidence.ts | 51f4421abe7e8460fc2a528f49d30ca90be1542a568c8b57008a9d896336cec8 | 1793893886150883218 |
| tools/osm-importer/src/qualification-geometry.ts | be0980fb447f6002d913c5013ab581b483fb79b5fdcaad2b0fb316272e136864 | 1793894049079841089 |
| tools/osm-importer/src/qualification-identity-binding.ts | c7c2e53187a77d3e9cea7ab850e2ea959233af6f6bf13bdf8fc846d4a80d343e | 1793896564956056311 |
| tools/osm-importer/src/qualification-profile-verifier.ts | 0cf9ba0f83e497d94f6393bcd01f43b2616cf8c2cbe4020189dc4511b25f95ed | 1793896796744139854 |
| tools/osm-importer/src/qualification-trust-types.ts | bb60a6d474b169606558a5e2bbfd191083ce5731a61ba9727acd0c1a6624641f | 1793896564749056212 |
| tools/osm-importer/src/qualification-trusted-clock.ts | 1145bbc567b5fd8ea08bbe152c62251be69438995068c43e7deea7d62447d454 | 1793896796619139811 |
| tools/osm-importer/src/qualification-types.ts | ad6d802bbc5f566e22e44a6eb2ba2c6d913de716d990d45d59c1057fe66f3f1b | 1793894049079723173 |
| tools/osm-importer/src/qualification-validation.ts | ec70c975cbd986c271794ddec7bdcf600590d45b153e40e0f1816d40f81a28f4 | 1793893886150640629 |
| tools/osm-importer/src/qualification-verification-json.ts | b624ab1ffd963cc09a325fcc39f0529ae6e93acfc33b4670b666fa2bccc2f363 | 1793896692008038165 |
| tools/osm-importer/src/turn-restriction-parser.ts | dbf80b9c2f5e8b8b3d257cd16f80165660681c7cd0a1538efe21ba9dc7219cf9 | 1793794905677395467 |
| tools/osm-importer/src/types.ts | e5fa58371295405beb1444924821be3f2178d20f1f6fa10dff375820e660603f | 1793814244473402428 |
| tools/osm-importer/src/vehicle-profile.ts | 3efc8a2692bd464ca71127520e0aed2fe60311acb15d4915d26c9540769d34b7 | 1793729013271380586 |
| tools/osm-importer/src/via-way-resolver.ts | 4e1874200575a81be956ab8682f544961e06cf05db65439d2b05ef0c54819d7b | 1793815518262830641 |
| tools/osm-importer/test/edge-qualifier.spec.ts | 6afe8f1a00fbe4409cab22d88eef172cb24eb59a9ac9b13237f0d0ba42a560df | 1793894049079509686 |
| tools/osm-importer/test/osm-importer.spec.ts | f4de0646b6d1b6280295487452a06b0c51b671db4228813ba23712060516b3f4 | 1793893600313985800 |
| tools/osm-importer/test/qualification-artifact-verifier.spec.ts | 3faa38d8ed9b1f102c69b227ca1454fdc0a11c8ed36f866f3b9532ab0e7e74ba | 1793896565038056349 |
| tools/osm-importer/test/qualification-crypto-verifier.spec.ts | a8332fa815d345b2d082ca54eac779fde705dbf8f274fc07ce1abdc604b5cc6a | 1793896692175103574 |
| tools/osm-importer/test/qualification-fixtures.ts | 9b379604ec8838b08c9e41c633e8c143b6cac9999cb4881e9e47049bd44afa20 | 1793893574235828677 |
| tools/osm-importer/test/qualification-geometry-golden.json | 835a4aa48ac5360ba49881408cbaf905f483331410a80bdde98f58f9488b581d | 1793893939819474027 |
| tools/osm-importer/test/qualification-identity-binding.spec.ts | 66d558dfb62562dac03353aa9566007c4a9986068d9fe66e7851f4fdea62c1a8 | 1793896565053056357 |
| tools/osm-importer/test/qualification-profile-document.spec.ts | 590f91220d6f2f0c64656ecbb68d23702108973e8a6ef95b3c4fb0ef0358b36a | 1793896565079056369 |
| tools/osm-importer/test/qualification-remediation.spec.ts | f097b601fd1c61262d1ab00dfeda65bcb0e9f05efa7f5ce60e3b1f98d951c5a0 | 1793894049079176268 |
| tools/osm-importer/test/qualification-trust-boundary.spec.ts | 3cd5c2e422a63fd3e917fd98e1bce905f17842d5af3199d1557495ccdf956741 | 1793896796947139925 |
| tools/osm-importer/test/qualification-trusted-clock.spec.ts | 4f319f43d393fe15bb656ebc7c3a29e46798633bc5410092bdb6c7b82e0f21d7 | 1793896565089023979 |
| tools/osm-importer/test/qualification-verification-test-fixtures.ts | d546b28169c70ec1fd205adbb100e47ed2256cfc339caa43621dc179b1c14b8b | 1793896564987056325 |
| tools/osm-importer/test/verify-qualification-golden.py | 2085deea55f7bdc4f694fd7ac1aa1ffee3e28d66c3b445f2a03ed7697ceb5ef6 | 1793893939826545948 |
| tools/osm-importer/test/via-way-resolver.spec.ts | e79e2288418695c1d9850e18b156f73accf757efba112bbe706343448af90bd6 | 1793815518335537502 |

