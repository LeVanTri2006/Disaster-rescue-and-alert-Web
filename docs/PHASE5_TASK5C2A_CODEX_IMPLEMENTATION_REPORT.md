# PHASE 5 – TASK 5C.2A: TRUSTED VERIFICATION BOUNDARY & ARTIFACT IDENTITY FOUNDATION

Ngày thực hiện: 05/11/2026, Asia/Bangkok. Repository: `/home/vantri/AndroidStudioProjects/canh-bao-thien-tai-backend-app`.

## 1. Executive Summary

**CONDITIONAL PASS cho Task 5C.2A foundation. Không đủ điều kiện cấp qualification production.**

Đã tạo chín module độc lập, sáu test suites mới và một helper fixture test-only. Có xác minh chữ ký Ed25519 bằng primitive thật, xác thực registry trong môi trường test cô lập, hash raw bytes, graph/edge/node/geometry binding, profile configuration digest, document-to-record binding và clock provenance. Không tạo public factory cấp qualification; không nối verification vào engine.

Kết quả: **163 test cases mới**, cùng 226 qualification regression cases cũ thành **389/389 PASS**. Toàn bộ backend **701/701 tests, 34/34 suites PASS**. Typecheck importer và build Nest đều exit 0. Không có test skip được báo trong kết quả cuối.

Toàn bộ **40 file baseline được bảo vệ** giữ nguyên SHA-256 và mtime_ns: 20 artifact, 13 source/CLI và 7 file test/fixture/oracle có sẵn. Năm module engine 5C.1R và các golden vectors không đổi. Không tạo artifact mới trong các thư mục output được bảo vệ.

Bất biến engine vẫn nguyên vẹn:

```text
purpose = DIAGNOSTIC_ONLY
trustStatus = UNAVAILABLE
qualificationStatus = UNVERIFIED
isProductionApproved = false
```

Kết quả VERIFIED của thư viện luôn chỉ có scope TECHNICAL_ONLY hoặc TEST_ONLY, đồng thời `productionAuthoritative=false`, `qualificationEligible=false`. Chúng không phải chứng nhận an toàn đường hay giấy phép định tuyến.

## 2. Baseline Repository Status

Đã kiểm tra pwd, git status --short, git diff --check và tìm AGENTS.md trước chỉnh sửa. Không tìm thấy AGENTS.md trong repository; hướng dẫn thư mục cha đã được kiểm tra trong các task trước. Các thay đổi baseline được giữ nguyên:

```text
 M tools/osm-importer/src/osm-importer.ts
 M tools/osm-importer/src/types.ts
 M tools/osm-importer/test/osm-importer.spec.ts
 M tsconfig.build.tsbuildinfo
?? docs/
?? tools/osm-importer/src/edge-qualifier.ts
?? tools/osm-importer/src/qualification-evidence.ts
?? tools/osm-importer/src/qualification-geometry.ts
?? tools/osm-importer/src/qualification-types.ts
?? tools/osm-importer/src/qualification-validation.ts
?? tools/osm-importer/src/via-way-resolver.ts
?? tools/osm-importer/test/edge-qualifier.spec.ts
?? tools/osm-importer/test/qualification-fixtures.ts
?? tools/osm-importer/test/qualification-geometry-golden.json
?? tools/osm-importer/test/qualification-remediation.spec.ts
?? tools/osm-importer/test/verify-qualification-golden.py
?? tools/osm-importer/test/via-way-resolver.spec.ts
```

Đã lưu hash và timestamp dưới dạng chuỗi nanosecond, trước mọi test của task này, tránh mất precision khi truyền JSON qua JavaScript. Baseline qualification đã chạy độc lập: 226/226 tests trên 2 suites PASS, Jest 0.592s, exit 0. Không chạy full suite baseline mới trước implementation; 538 tests là kết quả lịch sử Task 5C.1R.

Đã đối chiếu các tài liệu audit/5C.1R/implementation/5B.1, mã engine hiện hành, test và graph/manifest contracts. Tài liệu 5B.1 chứa một số giả định lịch sử về production gates; task này không xem những giả định đó là bằng chứng thực thi. Kết quả dưới đây dựa trên mã và test hiện tại. Không reset/restore/clean hoặc ghi đè thay đổi cũ.

## 3. Files Created/Modified

Chỉ tạo file mới. Các đường dẫn dưới đây tương đối với Backend.

| File mới | Vai trò |
|---|---|
| tools/osm-importer/src/qualification-trust-types.ts | Discriminated verification results, policy version, metadata và failure constructor |
| tools/osm-importer/src/qualification-crypto-verifier.ts | Detached Ed25519 mathematics, signed envelope, document receipts và revalidation |
| tools/osm-importer/src/qualification-authority-registry.ts | Signed test registry, authority/key/category/criterion/period/revocation checks; production unavailable |
| tools/osm-importer/src/qualification-artifact-verifier.ts | Raw byte digest, JSON/JSON.GZ representation, signed expected digest và immutable graph identity snapshot |
| tools/osm-importer/src/qualification-identity-binding.ts | Graph/edge/node/direction/V2/profile/configuration/policy binding |
| tools/osm-importer/src/qualification-trusted-clock.ts | System diagnostic clock, unavailable external clock, isolated test clock, validity checking |
| tools/osm-importer/src/qualification-profile-verifier.ts | Versioned canonical configuration digest và approval-document binding |
| tools/osm-importer/src/qualification-document-verifier.ts | Evidence/exemption integrity tách biệt authenticity và signed record binding |
| tools/osm-importer/src/qualification-verification-json.ts | Canonical JSON cho envelope/profile, exact bytes, strict base64 và immutable snapshots |
| tools/osm-importer/test/qualification-crypto-verifier.spec.ts | Native signature và signed authority registry negatives |
| tools/osm-importer/test/qualification-artifact-verifier.spec.ts | Byte-integrity, representation, malformed/truncated artifact và provenance negatives |
| tools/osm-importer/test/qualification-identity-binding.spec.ts | Graph/edge/node/profile mismatch và endpoint checks |
| tools/osm-importer/test/qualification-profile-document.spec.ts | Configuration và evidence/exemption document binding |
| tools/osm-importer/test/qualification-trusted-clock.spec.ts | Time provenance, UTC, expiry, collection time và revocation availability |
| tools/osm-importer/test/qualification-trust-boundary.spec.ts | Engine isolation, forged results, malformed requests và canonical serialization faults |
| tools/osm-importer/test/qualification-verification-test-fixtures.ts | Ephemeral in-memory test keys, signed fixtures và complete technical test chain |
| docs/PHASE5_TASK5C2A_CODEX_IMPLEMENTATION_REPORT.md | Báo cáo này |

Không sửa file source/test có sẵn, kể cả phần test isolation của importer. Formatter chỉ chạy trên 16 file TypeScript mới. Không cài dependency. Build có tái tạo `dist/` và cập nhật `tsconfig.build.tsbuildinfo` theo cấu hình hiện có; file cache này đã dirty ở baseline. Jest có thể ghi cache mặc định. Không sửa production config, tsconfig hoặc artifact để làm test PASS.

## 4. Trust Boundary Design

Policy verification mới: `qualification-verification-5C2A-v1`. Nó khác với qualification policy `5C1R-locked-v1`; hai vai trò không được nhập nhằng.

| Lớp kết quả | Điều thực sự đã chứng minh | Điều chưa được suy ra |
|---|---|---|
| Runtime schema valid | Field/type/enum/format nhất quán theo schema hiện có | Người phát hành hoặc số đo là thật |
| SIGNATURE_MATHEMATICS | Chữ ký khớp exact bytes với public key được đưa vào primitive | Public key thuộc cơ quan có thẩm quyền |
| TEST_REGISTRY_AUTHENTICITY | Registry được ký bằng out-of-band test root; entry có quyền trong test policy | Registry hoặc authority production đã được xác thực |
| TEST_DOCUMENT_AUTHENTICITY | Chữ ký/envelope/body khớp issuer/key/permission và signed test registry | PKI chính phủ, tính đúng của khảo sát, đủ điều kiện qualification |
| TEST_BYTE_INTEGRITY | Raw bytes khớp expected digest từ signed test document | Toàn bộ graph đúng về nghiệp vụ/routing hoặc artifact được phép production |
| TEST_IDENTITY_BINDING | Tuple danh tính và nội dung đã khớp các test receipts | Cạnh đã đủ tám tiêu chí an toàn thực địa |
| TEST_VALIDITY | Window hợp lệ tại test clock, theo test revocation snapshot | Thời gian được một dịch vụ bên ngoài xác thực |

Các trạng thái riêng: VERIFIED, UNVERIFIED, INVALID, EXPIRED, REVOKED, UNTRUSTED_ISSUER, VERIFIER_UNAVAILABLE. VERIFIED bắt buộc có assurance, details, timestamp, trust source và scope phù hợp trong discriminated union. Metadata còn có verification type, subject, artifact identity, policy version, method và key identifier nếu liên quan. Trường không áp dụng/không biết của failure không được bịa thành một căn cứ tin cậy.

TypeScript là structural typing, nên caller vẫn có thể viết một object giống result. Vì vậy các module nhận receipts kiểm tra **private module-scoped WeakMap**, không chỉ đọc status/boolean. Object spread, JSON round-trip, cast hoặc object tự dựng bị từ chối. Các snapshot được copy và deep-freeze; buffers của caller không được giữ làm mutable source of truth.

Không có success factory công khai để tùy ý mint issuer/graph/profile receipt. Public failure helper chỉ trả trạng thái thất bại, kể cả runtime cast cố truyền VERIFIED; luôn ép các cờ production/qualification về false. Public test registry/clock factories có thể tạo ngữ cảnh test nhưng không thể tạo scope production. Engine hiện tại không nhận bất kỳ receipt nào để mở khóa.

WeakMap là provenance trong một tiến trình chạy module không bị sửa, không phải sandbox chống code độc hại có toàn quyền trong cùng process. Receipts không dùng làm credentials bền vững; sau restart/deserialize phải xác minh lại dữ liệu gốc. Không tuyên bố rằng một object JSON mang chữ VERIFIED có giá trị chứng thực.

## 5. Cryptographic Verification

Triển khai bằng `node:crypto`, dùng Ed25519 với `verify(null, exactBytes, publicKey, signatureBytes)`; không tự viết mật mã. Đối chiếu API chính thức tại [Node.js crypto.verify](https://nodejs.org/download/release/v26.7.0/docs/api/crypto.html). Môi trường thực thi được kiểm tra là Node v26.8.2.

Contract detached signature:

- Dữ liệu ký là **toàn bộ raw document bytes**, không phải claimed digest hoặc JSON đã parse rồi serialize lại.
- Chữ ký là 64 bytes Ed25519, biểu diễn canonical padded base64. Sai encoding/length hoặc verify không khớp trả INVALID.
- Policy chỉ cho phép đúng chuỗi `Ed25519` và key type `ed25519`, public KeyObject. `none`, HMAC, SHA1, Ed448 và các selector không đúng policy đều bị từ chối; không có fallback algorithm.
- Primitive `verifySignatureMathematics` cho phép caller key để làm phép toán kỹ thuật, nhưng chỉ trả TECHNICAL_ONLY / ISSUER_NOT_AUTHENTICATED. Kết quả đó không được document receipt inspector chấp nhận.
- Hàm xác thực issuer chọn public key từ registry receipt; `publicKey` hoặc `certificateChain` từ payload bị từ chối làm trust anchor.
- Signed envelope dùng schema `qualification-signed-document-v1`, có subjectId, authorityId, category, criterion, validFrom, validUntil và body. Metadata selector ngoài chữ ký phải khớp metadata trong signed bytes. Evidence/exemption bắt buộc có criterion; profile/graph manifest bắt buộc criterion=null.
- Envelope/registry dùng canonical UTF-8 JSON của policy mới. Duplicate keys, BOM, byte serialization không canonical, malformed UTF-8/JSON bị từ chối; không âm thầm normalize rồi coi chữ ký trên bản khác là hợp lệ.
- Exceptions có diagnostic failure; không catch rồi trả VERIFIED mặc định.

Test keys được sinh tạm trong bộ nhớ dưới file test, không hardcode private key, không ghi ra disk, không tạo certificate hoặc trust root production. Không dùng HMAC. Không có X.509 chain builder, CRL/OCSP hoặc government CA root thật trong task này. Certificate expiry test hiện kiểm tra **metadata certificate của signed test registry**, không chứng minh đã xác minh một certificate chain X.509 thật.

## 6. Authority Registry Validation

Production registry mặc định trả VERIFIER_UNAVAILABLE với `PRODUCTION_REGISTRY_AND_TRUST_ROOTS_NOT_CONFIGURED`.

Registry test phải có chữ ký Ed25519 hợp lệ từ root KeyObject cấu hình riêng ngoài signed registry bytes. Có kiểm tra registry schema/version/authenticity/period, IDs trùng, authority name/role, allowed criteria/categories, key ID/public key algorithm, validity, certificate metadata expiry, revocation status và revoked document IDs. Test role là `TEST_AUTHORITY`, không phải tuyên bố một vai trò chính phủ đã được chứng nhận.

Registry revocation snapshot phải không nằm trong tương lai và không quá một giờ so với test clock. UNKNOWN revocation, snapshot cũ, issuer/key không có trong registry hoặc không có quyền đối với category/criterion đều fail-closed. Cùng một tên authority trong whitelist cũ không bỏ qua các kiểm tra này.

Các authority IDs giống contract/fixture cũ chỉ là **claimed identifiers trong test keyspace**. Một kết quả TEST_ONLY không cấp giấy chứng nhận cho cơ quan có tên đó. Toàn bộ quyền ở đây bắt nguồn từ signed isolated registry, không từ hardcoded whitelist name. Chưa có registry production được xác thực, chưa có trust roots thật được cấu hình.

Receipts recheck registry validity, document/key revocation theo snapshot và freshness khi được dùng lại. Snapshot là immutable và không phải live revocation service; một thay đổi thu hồi mới bên ngoài chưa được tải về không thể được phát hiện tức thì. Khoảng freshness một giờ là policy thử nghiệm, không phải SLA production.

## 7. Graph Artifact Byte Integrity

`verifyGraphArtifact` copy supplied bytes, tính SHA-256 raw bytes, phân biệt JSON và JSON.GZ. Gzip được giải nén sau bước hash để đọc identity, không dùng decompressed/reformatted JSON làm raw artifact digest. Không có streaming implementation hoặc ghi lại artifact. Giới hạn mỗi input và output giải nén là 32 MiB cho foundation này.

Expected digest được lấy từ `body.bundle.sha256` trong một GRAPH_MANIFEST receipt có runtime provenance hợp lệ. Manifest body tái sử dụng cấu trúc graphVersion/bundle của contract hiện có. Caller đưa claimed hash đúng format hoặc tự dựng expected/VERIFIED object vẫn chỉ nhận UNVERIFIED; hash mismatch trả INVALID. Tên file chỉ kiểm tra representation nhất quán, không thay thế byte identity.

Kết quả phân biệt computedDigest, claimedDigest, trustedExpectedDigest, actualVersion và representation. Khi version chưa đọc được, nó không được giả định từ một selector ngoài bytes. Đã test JSON/GZ cùng nội dung nhưng digest khác, JSON pretty-print làm raw digest khác, expected digest sai, truncated/tampered bytes, malformed JSON/gzip và version mismatch.

Module tạo **immutable test graph identity snapshot**, đọc các trường identity cần thiết của contract BaseRoadGraph. Nó không chứng nhận mọi routing/turn-restriction/readiness field trong graph. Chưa có production trusted graph loader được cấu hình hay nối với storage/runtime.

## 8. Edge Identity Binding

`verifyEdgeIdentity` yêu cầu original graph receipt và original profile receipt còn hiệu lực tại clock được module nhận diện. Kiểm tra:

1. Graph version và computed raw artifact SHA-256.
2. Edge ID thực sự có trong snapshot từ verified test bytes, cùng OSM way ID, from/to node ID và direction.
3. From/to node tồn tại trong registry của graph; duplicate IDs hoặc malformed IDs bị từ chối ở bước tạo snapshot.
4. Geometry endpoints bằng raw WGS84 coordinates của node tương ứng, với +0/-0 được coi bằng nhau theo equality số. Không suy node identity từ một chuỗi hash.
5. V2 geometry hash và version khớp; không đảo geometry lần hai.
6. Profile ID/version/configuration SHA-256 khớp verified test profile và `qualificationIdentity` được ký trong test manifest, cùng qualification policy version.

`qualificationIdentity` là field của signed fixture manifest foundation; không thêm field này vào manifest production hiện có. Missing tuple hoặc tuple khác bị từ chối, không tự suy từ profile name.

Endpoint check cố ý chặt hơn việc so tọa độ đã lượng tử hóa. Test thay node coordinate 1e-9 trong khi giữ geometry cho thấy endpoint mismatch bị bắt dù V2 quantization có thể giống nhau. Đây là identity boundary mới, không thay thuật toán geometry V2 hoặc tạo V3.

Đã test edge/node vắng, geometry sai thứ tự, interior geometry bị thay, forward evidence dùng cho reverse, legacy V1 hash-version, graph/profile/policy/configuration mismatch và sidecar-style tuple không nhất quán. Các ca đó không được trả VERIFIED identity.

## 9. Vehicle Configuration Binding

Version digest: `rescue-vehicle-configuration-v1`.

Configuration được tạo từ danh sách field rõ ràng của RescueVehicleProfile hiện tại: ID/name/version/status, dimensions, mass, axle weight, ground clearance, fording depth, turning radius, climb/approach/departure capabilities, margins, load safety factor, highway/surface collections và bridge/tunnel flags. Profile phải qua runtime schema; arrays đã canonical theo contract cũ. Sau đó serialize canonical JSON với sorted object keys và finite numbers. Không dùng JSON.stringify trực tiếp trên một object chưa chuẩn hóa làm bằng chứng cấu hình.

SHA-256 của canonical bytes, digest version, profile ID/version và provenance được ràng buộc với body của PROFILE_APPROVAL document có chữ ký test hợp lệ. Hash tài liệu thật phải khớp profile provenance và original document receipt. Provenance fields được so với signed approval body; documentSha256 và nhãn digitalSignatureStatus bị loại khỏi projection để tránh self-reference và không biến lời khai chữ ký thành chứng thực.

Đã test object field order khác vẫn cùng digest; thay height/width/gross weight/axle load/fording/clearance/turning radius nhưng giữ profile version làm digest khác và approval cũ bị từ chối. Provenance version mismatch, đổi reference/ID, expiry/revocation, missing/truncated bytes hoặc forged receipt đều fail-closed. ACTIVE_APPROVED một mình không đủ.

Digest này là contract version mới cho configuration, không phải phiên bản geometry hash mới. Nếu profile contract bổ sung năng lực vật lý mới trong tương lai, phải cập nhật/bump configuration digest policy và các binding tests; không tự suy rằng version hiện tại đã bao phủ mọi field tương lai. Chưa kiểm chứng Kotlin serialization parity.

## 10. Evidence Document Verification

`verifyEvidenceDocument` trả hai kết quả riêng: integrity và authenticity.

- Chỉ có claimed hash mà không có bytes: không verified.
- Bytes khớp claimed hash nhưng không có trusted document reference: UNVERIFIED / CLAIMED_DIGEST_MATCH_ONLY, không được gọi là issuer authentication.
- Bytes khớp original signed test document receipt: có thể xác nhận TEST_BYTE_INTEGRITY.
- Để authenticity được xác nhận trong test scope, còn phải khớp subject/evidence ID, authority, category, criterion, validity và toàn bộ projected record body. Các graph/geometry/policy fields, value/unit/scope và revocation declaration của record nằm trong signed projection.
- Đổi measurement hoặc graph/evidence binding mà giữ nguyên document bytes có thể giữ byte integrity VERIFIED, nhưng authenticity binding phải INVALID. Có test kiểm tra chính sự phân biệt này.

Document hash và nhãn digitalSignatureStatus được loại khỏi signed-record projection để tránh self-reference; nhãn đó không được dùng thay chữ ký thực. Expiry, future collection time, revocation UNKNOWN/REVOKED hoặc clock không có provenance không tạo kết quả đủ điều kiện sử dụng.

Evidence và exemption test documents đều được kiểm tra, nhưng chữ ký đúng không chứng minh sự thật vật lý của phép đo, bao phủ khảo sát hoặc tính hợp pháp miễn trừ cầu/cống. Module không áp dụng exemption vào engine, không supersede record và không nâng trạng thái cạnh.

Chưa có xác minh evidence/profile end-to-end trên dữ liệu thật hoặc một pipeline production nối đủ crypto + graph + khảo sát + live hazards. Chỉ có chuỗi kiểm thử kỹ thuật trong môi trường isolated test keys.

## 11. Trusted Clock Abstraction

ClockProvider và ClockReading phân biệt:

| Nguồn | Hành vi |
|---|---|
| Caller timestamp/object tự dựng | Không có runtime provenance; không được dùng như clock đáng tin |
| systemDiagnosticClock | Date hệ thống phục vụ diagnostic, không tự nhận externally verified |
| unavailableTrustedClock | EXTERNAL_TIME_NOT_CONFIGURED; VERIFIER_UNAVAILABLE |
| isolatedTestClock | Chỉ TEST_ONLY, không phải timestamp authority |

Validity dùng UTC Z format chặt và calendar round-trip của validator hiện có, khoảng đóng `[validFrom, validUntil]`. Đúng validUntil còn trong window; quá 1 ms là EXPIRED. Không parse dữ liệu ngày tùy tiện rồi so NaN. Future collectedAt, interval đảo chiều và revocation check unavailable có diagnostic riêng.

Verification timestamp là lúc kiểm tra theo ClockReading; evidence collectedAt/evaluatedAt và effective dates vẫn là dữ liệu riêng cần đối chiếu. System clock hợp lệ về format không đủ nâng verification window thành trusted external time. Factory test có thể chọn ngày tùy ý để kiểm thử nhưng scope vẫn TEST_ONLY và không thể cấp production approval.

Chưa có external trusted time source, NTP authentication hay PKI timestamp authority; task không dựng một dịch vụ giả cho các thành phần này.

## 12. Security Negative Tests

| Nhóm | Hành vi đã kiểm thử |
|---|---|
| Crypto | Chữ ký thật với test key; corrupted/truncated/tampered bytes; algorithm downgrade; private/missing/wrong key; public key/chain trong payload; missing registry/root/verifier |
| Registry/authority | Thiếu/sai root signature; registry bị sửa; duplicate authority/key IDs; issuer giả; criterion/category không được phép; registry/key/certificate metadata hết hạn; revoked/unknown revocation; stale/future snapshot |
| Artifacts | Raw digest, JSON vs GZ, pretty-print khác bytes, self-claimed expected hash, trusted expected mismatch, malformed JSON/gzip, truncation, version/representation mismatch |
| Identity | Missing edge/node, duplicate IDs, malformed node ID, endpoint lệch dưới precision V2, reversed order/direction, changed geometry, V1, profile/configuration/policy và sidecar-style binding mismatch |
| Profile/documents | Deterministic field order, đổi thông số cấu hình, provenance/reference/version mismatch, expired/revoked approval, missing/truncated bytes, integrity không đồng nghĩa authenticity |
| Clock | Caller backdating/fake receipt, invalid UTC/date, future collection, expiry boundary, missing clock, system vs test scope, missing revocation |
| Boundary | Copy/cast/JSON VERIFIED không có provenance; snapshots frozen; malformed API inputs không default VERIFIED; helper failure không mint VERIFIED; engine khóa với cả true/false/omitted flag |

Các test tích cực dùng chữ ký thật từ Node crypto, không mock verify để bỏ qua thuật toán. Engine invariant tests yêu cầu registry, document, profile, artifact và identity đều đạt VERIFIED trong TEST_ONLY trước khi xác nhận engine vẫn UNVERIFIED; không chỉ đưa evidence rỗng rồi kết luận gate hoạt động.

Các lỗi trong implementation đã được test/typecheck phát hiện và sửa: validation public PEM ban đầu quá chặt với newline hợp lệ; generic failure result typing và fixture assignment vào readonly property; runtime input không hợp lệ; phân biệt canonical raw bytes có BOM. Không sửa assertion của 226 cases cũ để che lỗi. Không có lỗi test cuối chưa xử lý.

## 13. Qualification Engine Isolation

Năm file 5C.1R và toàn bộ regression source/golden fixtures giữ nguyên hash/mtime baseline. Không thêm import verifier vào EdgeQualifier, importer, CLI, Nest runtime hoặc Android. Tìm kiếm source không thấy các reference tích hợp ngoài các module mới và test.

Verified receipts hoặc object tự khai trusted được thêm vào input trong test không có đường tác động đến engine hiện tại. Kết quả vẫn DIAGNOSTIC_ONLY / UNAVAILABLE / UNVERIFIED / false. Không phát hành sidecar, không sửa contractVersion 2.1.0 của production, không nâng cạnh Đà Nẵng hoặc mở strict routing.

## 14. Typecheck Results

| Lệnh | Kết quả cuối | Exit |
|---|---|---:|
| npx --no-install tsc --project tools/osm-importer/tsconfig.json --noEmit | PASS, dùng config importer hiện có | 0 |
| npx --no-install nest build | PASS | 0 |
| python3 tools/osm-importer/test/verify-qualification-golden.py | Hai V2 SHA-256 vectors và sáu Half-Even vectors PASS | 0 |
| git diff --check | Không báo lỗi | 0 |

Không sửa production config, không nâng compiler target và không cài dependency để chạy các kiểm tra. Typecheck/build có các lần bắt lỗi trung gian đã nêu ở mục 12; không bỏ qua diagnostic cuối. Không đo riêng tổng thời gian build/typecheck nên không suy thời gian từ tool yield.

## 15. Full Test Results

| Lần chạy | Suites | Tests | Thời gian Jest | Exit |
|---|---:|---:|---|---:|
| Baseline qualification trước sửa | 2 PASS | 226 PASS | 0.592s | 0 |
| Test mới + qualification regression cuối | 8 PASS | 389 PASS | 1.500s | 0 |
| Full backend cuối | 34 PASS | 701 PASS | 14.482s | 0 |

Test mới gồm sáu suites = 163 cases; 226 qualification cases cũ không đổi. Baseline full 538 cases là kết quả lịch sử 5C.1R, không phải một full run mới trước sửa. Số tăng thêm khớp 538 + 163 = 701.

Lệnh targeted dùng `npm test -- --runInBand --runTestsByPath` với sáu spec mới và hai qualification specs cũ. Sau đó chạy typecheck, Nest build. Đã đọc lại hooks/output paths của `osm-importer.spec.ts`: vẫn mkdtemp riêng từng test, readback tự tạo fixture và cleanup chỉ owned temp root. So snapshot trước full cho 40/40 file cũ không đổi rồi mới chạy `npm test -- --runInBand`.

Kết quả cuối không báo skipped tests; snapshots 0. Warnings còn như suite hiện có: Node ExperimentalWarning VM Modules, mock SosService Firebase projection failed cho sos-1 và debug firebase unavailable. Không có bằng chứng các warning đó là lời gọi Firebase production. Không truy cập R2/Firebase/cloud để cấu hình verifier.

Lần targeted đầu trong quá trình phát triển có 72 failures chủ yếu do PEM registry validation khiến dependent verifiers unavailable; đã sửa nguyên nhân schema, giữ các expectation bảo mật, chạy lại toàn bộ targeted và full suite. Không lấy một lần PASS riêng lẻ thay cho negative testing và preservation checks.

## 16. Artifact Preservation Evidence

Baseline và sau full suite đều lưu SHA-256 cùng mtime_ns chính xác bằng chuỗi. Kết quả: **40/40 file baseline không đổi**, gồm **20/20 artifact**, **13/13 source/CLI** và **7/7 test/fixture/oracle**. Không có artifact mới trong output directories. Chỉ xuất hiện 16 TypeScript files mới được liệt kê ở mục 3 và báo cáo Markdown này.

Các thư mục bảo vệ: output, output-real, output-danang-261103, output-danang-261103-task97, output-dryrun-task3b. Không tự xóa/reset/restore artifact; không sửa BaseRoadGraph hoặc RoutingManifest. Đồ thị dryrun giữ hash yêu cầu `1b7f64a965a763624e0a6c2cd866352fc3ef5f106214907866d0c6dcb49c25b4`.

Chỉ đọc hash/stat của artifact hiện có; verifier tests dùng synthetic bytes trong bộ nhớ. Không kết luận local hash chứng minh deployment/storage remote không đổi. Build/cache side effects được công khai ở mục 3, không được tính là sửa source production. Phụ lục cuối ghi từng artifact và hash các file cũ được bảo vệ.

## 17. Remaining Blockers

| Câu hỏi bắt buộc | Trạng thái thực tế |
|---|---|
| Trusted authority registry production đã có chưa? | **Chưa.** Chỉ isolated signed test registry; production factory trả VERIFIER_UNAVAILABLE. |
| PKI verifier với trust roots thật đã cấu hình chưa? | **Chưa.** Native signature primitive hoạt động; chưa có real government roots, chain validation, CRL/OCSP. |
| Trusted graph loader đã có chưa? | **Chưa có production loader.** Có byte verifier và immutable identity snapshot trong test trust domain; chưa nối storage/runtime hoặc toàn bộ BaseRoadGraph semantics. |
| Trusted external time source đã có chưa? | **Chưa.** System time chỉ diagnostic; test time chỉ TEST_ONLY. |
| Evidence/profile xác minh end-to-end chưa? | **Chỉ chuỗi kỹ thuật bằng fixtures/test keys.** Chưa xác minh khảo sát, authority hoặc approval production thật; chưa có qualification pipeline end-to-end. |
| Kotlin cross-validation đã chạy chưa? | **Chưa.** Không thay V2, giữ golden vectors, chạy lại Python oracle; không tuyên bố Kotlin parity. |
| Qualification Engine còn khóa không? | **Có.** Năm module cũ không đổi; 226 regression cases và invariant tests mới đều PASS. |

Các giới hạn khác: Ed25519 là algorithm duy nhất được hỗ trợ; các scheme thực tế khác cần policy version và kiểm toán riêng. Registry revocation freshness một giờ chỉ là test policy, không thay thế live revocation. Endpoint equality hiện strict raw coordinates; chưa định nghĩa tolerance/migration cho nguồn thực địa. Profile configuration digest cần golden cross-language tests trước consumer khác. Receipts không có giá trị sau serialization/module restart. Không xác nhận độ đúng của measurements hoặc legal exemption chỉ từ chữ ký.

## 18. Final Acceptance Decision

**CONDITIONAL PASS – verification foundation độc lập, production bị khóa.**

Phần đã thực thi có chứng cứ: native crypto operations, signed test registry, exact-byte integrity, runtime receipt provenance, graph/edge/node/profile binding, deterministic configuration, validity diagnostics, negative tests, regression và artifact preservation. Không có đường được kiểm tra nào biến lời khai input thành authoritative production trust hoặc mở qualification.

Không dùng cụm “100% an toàn” hoặc coi 701 test PASS là bằng chứng duy nhất. Các provider production và Kotlin/integration chưa có được đánh dấu thiếu rõ ràng, không được thay bằng enum/boolean thuận lợi. Không sửa nguồn ngoài phạm vi hoặc làm suy yếu 5C.1R để đạt kết quả này.

## 19. Task 5C.2B Readiness

Có thể bắt đầu một task được cho phép riêng cho **orchestration/test-only integration và thiết kế provider adapters**, sử dụng các contract tách lớp hiện tại. Chưa đủ điều kiện mở production qualification, phát hành sidecar hoặc áp dụng kết quả vào graph/Android/UCS.

Trước một bước production cần cung cấp và kiểm toán trust-root provisioning, authenticated registry/role policy thực, X.509 chain/revocation services, trusted external time, production graph loader và complete document/identity/survey checks. Kotlin parity và integration acceptance còn phải thực thi độc lập. Không tự động triển khai các phần này trong Task 5C.2A.

Đã dừng sau implementation, test và báo cáo. Không commit/push/deploy, không tích hợp vào engine/importer/CLI/Android/UCS, không sửa database/env/cloud hoặc artifact production.

## Phụ lục — Baseline và sau full suite

SHA-256 và mtime_ns của mỗi artifact dưới đây trước = sau. Timestamp được giữ bằng chuỗi số nanosecond để đối chiếu chính xác.

| Artifact | SHA-256 trước = sau | mtime_ns trước = sau |
|---|---|---|
| tools/osm-importer/output-danang-261103-task97/BaseRoadGraph.json | `419cf4695f735e234038da6ef14076c22ef6121bbd3dbc566eccb516ff8ccd80` | 1793795090193010010 |
| tools/osm-importer/output-danang-261103-task97/BaseRoadGraph.json.gz | `9792dce0abb089a230bcb79e71b2a8ff83301879d417f4fd399711ce4c3a037b` | 1793795090388006437 |
| tools/osm-importer/output-danang-261103-task97/ImportDiagnostics.json | `b379ddee5a99cd4054827a7b34097808c96419e8d2e447c9fd95a6abb84807ff` | 1793795090204009808 |
| tools/osm-importer/output-danang-261103-task97/RoutingManifest.json | `ec046a84a14cc35dbf498034e019850224c8facab2989f98f9733fced89222aa` | 1793795090396006290 |
| tools/osm-importer/output-danang-261103/BaseRoadGraph.json | `bae0a78e9069f96e128624758a6828e0ba10195af3687557609849af66d60a5d` | 1793791971878996797 |
| tools/osm-importer/output-danang-261103/BaseRoadGraph.json.gz | `9c0166f9d1fa0ad45aef4163a258d5d3d9310d3d2eb0c99e169669e77537ac5d` | 1793791972076993362 |
| tools/osm-importer/output-danang-261103/ImportDiagnostics.json | `4d95fe3db4a6df20cc8037801f5fba9b8f42702d07f5d8292c1296c7f9d48e31` | 1793791971890996589 |
| tools/osm-importer/output-danang-261103/RoutingManifest.json | `ac10c58382a1325fdafe7ef730162dd5e3ae9516c123ecf99e1384ae49349999` | 1793791972084993223 |
| tools/osm-importer/output-dryrun-task3b/BaseRoadGraph.json | `b9dd0caf51c722ddb432b837d1c1ad4602c03f258eca23089215145bd9c86dfa` | 1793816785873038184 |
| tools/osm-importer/output-dryrun-task3b/BaseRoadGraph.json.gz | `1b7f64a965a763624e0a6c2cd866352fc3ef5f106214907866d0c6dcb49c25b4` | 1793816786066038779 |
| tools/osm-importer/output-dryrun-task3b/ImportDiagnostics.json | `b379ddee5a99cd4054827a7b34097808c96419e8d2e447c9fd95a6abb84807ff` | 1793816785882038211 |
| tools/osm-importer/output-dryrun-task3b/RoutingManifest.json | `7765d94d288e279bf3607b692d5466f5e9efe53db16c0ea944e5d9b08f3183ad` | 1793816786074038803 |
| tools/osm-importer/output-real/BaseRoadGraph.json | `d5ea87e086e00386b4f64df983844c0488ffbadb419f964101da26ef7650e585` | 1793892167826777269 |
| tools/osm-importer/output-real/BaseRoadGraph.json.gz | `89b451800767e0edc0c184389b10567e50df5f479314b77f92558e5b9f4c13b2` | 1793892167827777269 |
| tools/osm-importer/output-real/ImportDiagnostics.json | `357564ca77ec4d158b29238f7b06738387c935e2a8df105b2a976517fdded4eb` | 1793892167826777269 |
| tools/osm-importer/output-real/RoutingManifest.json | `26e04b90adacdac18672f646707ded470c7c402a4cc6c8129973f656d815028f` | 1793892167827777269 |
| tools/osm-importer/output/BaseRoadGraph.json | `1bc5c849f7bba20274521930d43069c84c50d664ed6867a518ae02425bd52a62` | 1793892167806777263 |
| tools/osm-importer/output/BaseRoadGraph.json.gz | `3fe5f4acb1e88d7785de7efa7e57ba08994b7d6e419933a940b76b0725493b46` | 1793892167807777263 |
| tools/osm-importer/output/ImportDiagnostics.json | `a7314d615d9944df42d161d5170d52c606762d322c63eb7666beb6bcc00e0b23` | 1793892167806777263 |
| tools/osm-importer/output/RoutingManifest.json | `ec4e85dedd7e5041c0770a47695cecc92aa363042136a5eec1c28ac70e2adbe1` | 1793892167807777263 |

### Các source/CLI/test có sẵn không thay đổi

Cả hash lẫn mtime_ns của 20 file sau khớp baseline; không dùng việc Git đang dirty làm bằng chứng chúng bị sửa trong task này.

| File | SHA-256 trước = sau | mtime_ns trước = sau |
|---|---|---|
| tools/osm-importer/cli.ts | `25f72442def5352fe81629a7903a70fd72abc7857483807d0096d53ef5292401` | 1793786695664590745 |
| tools/osm-importer/src/edge-qualifier.ts | `4936c935e5af2de9175947356ae3298c108c68d23bb9791b8ef49875cca97501` | 1793893886150771341 |
| tools/osm-importer/src/haversine.ts | `0960a2d0fd5810b39f10565dfbe368da303c2ca9fb5ca3f7cc655e65c7357f79` | 1793724305750102828 |
| tools/osm-importer/src/oneway-resolver.ts | `a3d65a9330075e1d0a4cd4966bd17040b1f1465174ba92d0b7a07569b1d83ce7` | 1793724305749660525 |
| tools/osm-importer/src/osm-importer.ts | `e85eb6fe891002a4b81b57a7e5e33ce362994b406471535d47f9dc76c197a71d` | 1793815518206310039 |
| tools/osm-importer/src/qualification-evidence.ts | `51f4421abe7e8460fc2a528f49d30ca90be1542a568c8b57008a9d896336cec8` | 1793893886150883218 |
| tools/osm-importer/src/qualification-geometry.ts | `be0980fb447f6002d913c5013ab581b483fb79b5fdcaad2b0fb316272e136864` | 1793894049079841089 |
| tools/osm-importer/src/qualification-types.ts | `ad6d802bbc5f566e22e44a6eb2ba2c6d913de716d990d45d59c1057fe66f3f1b` | 1793894049079723173 |
| tools/osm-importer/src/qualification-validation.ts | `ec70c975cbd986c271794ddec7bdcf600590d45b153e40e0f1816d40f81a28f4` | 1793893886150640629 |
| tools/osm-importer/src/turn-restriction-parser.ts | `dbf80b9c2f5e8b8b3d257cd16f80165660681c7cd0a1538efe21ba9dc7219cf9` | 1793794905677395467 |
| tools/osm-importer/src/types.ts | `e5fa58371295405beb1444924821be3f2178d20f1f6fa10dff375820e660603f` | 1793814244473402428 |
| tools/osm-importer/src/vehicle-profile.ts | `3efc8a2692bd464ca71127520e0aed2fe60311acb15d4915d26c9540769d34b7` | 1793729013271380586 |
| tools/osm-importer/src/via-way-resolver.ts | `4e1874200575a81be956ab8682f544961e06cf05db65439d2b05ef0c54819d7b` | 1793815518262830641 |
| tools/osm-importer/test/edge-qualifier.spec.ts | `6afe8f1a00fbe4409cab22d88eef172cb24eb59a9ac9b13237f0d0ba42a560df` | 1793894049079509686 |
| tools/osm-importer/test/osm-importer.spec.ts | `f4de0646b6d1b6280295487452a06b0c51b671db4228813ba23712060516b3f4` | 1793893600313985800 |
| tools/osm-importer/test/qualification-fixtures.ts | `9b379604ec8838b08c9e41c633e8c143b6cac9999cb4881e9e47049bd44afa20` | 1793893574235828677 |
| tools/osm-importer/test/qualification-geometry-golden.json | `835a4aa48ac5360ba49881408cbaf905f483331410a80bdde98f58f9488b581d` | 1793893939819474027 |
| tools/osm-importer/test/qualification-remediation.spec.ts | `f097b601fd1c61262d1ab00dfeda65bcb0e9f05efa7f5ce60e3b1f98d951c5a0` | 1793894049079176268 |
| tools/osm-importer/test/verify-qualification-golden.py | `2085deea55f7bdc4f694fd7ac1aa1ffee3e28d66c3b445f2a03ed7697ceb5ef6` | 1793893939826545948 |
| tools/osm-importer/test/via-way-resolver.spec.ts | `e79e2288418695c1d9850e18b156f73accf757efba112bbe706343448af90bd6` | 1793815518335537502 |

Đối chiếu tự động: 40/40 baseline entries khớp; zero changed entries; zero new output artifacts. Không dùng snapshot này để khẳng định bất biến của remote production hoặc mọi file cache/build trên máy.

