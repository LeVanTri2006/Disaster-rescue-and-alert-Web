# PHASE 5 – TASK 5C.1: CODEX INDEPENDENT AUDIT

Ngày kiểm toán: 05/11/2026, Asia/Bangkok. Phạm vi: đọc mã, chạy build/test có sẵn, gọi hàm trong bộ nhớ để tái hiện; không sửa TypeScript/Kotlin hoặc unit test. Báo cáo này là file duy nhất do kiểm toán chủ động tạo.

## 1. Executive Summary

**Quyết định: FAIL. Chưa đủ điều kiện tích hợp Task 5C.2.**

Build thành công; 27 suites / 339 tests và riêng qualification 27 tests đều PASS. Tuy nhiên đã tái hiện nhiều đường false-safe ngay cả khi `requireProductionApproved: true`: evidence chữ ký INVALID, profile hết hạn/bị thu hồi, graph hash không hợp lệ, thời điểm đánh giá không hợp lệ, thiếu coverage, exemption giả và supersession bằng bản ghi bị thu hồi vẫn có thể cho `VERIFIED_COMPATIBLE`.

Phân loại 14 phát hiện: **8 CRITICAL, 1 HIGH, 4 MEDIUM, 1 LOW**. Severity phản ánh khả năng engine cấp qualification sai theo định nghĩa của yêu cầu; chưa có bằng chứng các nhánh này đang được gọi bởi hệ thống production. Không đồng nhất false-safe trong engine với việc router thực tế đã được mở khóa.

Đồ thị được yêu cầu tại `tools/osm-importer/output-dryrun-task3b/BaseRoadGraph.json.gz` khớp SHA-256 và chứa 16.651 cạnh UNVERIFIED. Các module mới chưa được import vào importer/CLI/backend runtime trong các nguồn đã tìm kiếm. Việc cô lập này không đủ để nghiệm thu engine có lỗi nghiêm trọng.

**Giới hạn quy trình:** lệnh toàn bộ test có sẵn đã gọi CLI ghi artifact vào `output/` và `output-real/`. Đây là tác dụng phụ không được phát hiện trước khi chạy; không thể xác nhận mọi graph/manifest bất biến trong toàn phiên vì không có hash trước test. Không khôi phục/xóa/reset các file đó. Xem mục 10–11 và F13.

## 2. Repository & Git Status

Backend: `/home/vantri/AndroidStudioProjects/canh-bao-thien-tai-backend-app`. Thư mục `docs/` tồn tại trước khi ghi. Không tìm thấy AGENTS.md trong repository qua `rg --files` và tại các thư mục cha đã kiểm tra.

Trạng thái ban đầu, trước build/test:

```text
 M tools/osm-importer/src/osm-importer.ts
 M tools/osm-importer/src/types.ts
 M tsconfig.build.tsbuildinfo
?? docs/
?? tools/osm-importer/src/edge-qualifier.ts
?? tools/osm-importer/src/qualification-evidence.ts
?? tools/osm-importer/src/qualification-geometry.ts
?? tools/osm-importer/src/qualification-types.ts
?? tools/osm-importer/src/qualification-validation.ts
?? tools/osm-importer/src/via-way-resolver.ts
?? tools/osm-importer/test/edge-qualifier.spec.ts
?? tools/osm-importer/test/via-way-resolver.spec.ts
```

`git diff --check` đầu phiên và sau chạy test đều exit 0. Không có căn cứ gán các thay đổi có sẵn cho Task 5C.1: diff importer/types liên quan via-way compilation/RawWay và đã tồn tại khi bắt đầu. `vehicle-profile.ts`, `cli.ts` không có diff tracked. `docs/` và sáu file mục tiêu đều tồn tại; ba tài liệu yêu cầu đều tồn tại và đã được đọc.

## 3. Source Files Inspected

Đã đọc toàn bộ năm module mới, toàn bộ `test/edge-qualifier.spec.ts`, ba tài liệu 5B.1/5C.1 được chỉ định; đọc types, vehicle-profile, CLI và các đoạn importer có liên quan, diff tracked, Jest/TypeScript/Nest config; kiểm tra các đoạn test importer gọi CLI.

Số dòng thực tế: types 331; geometry 155; validation 370; evidence 496; qualifier 256; spec 959. Tìm kiếm tham chiếu module mới trong `src/` và `tools/` chỉ thấy nội bộ năm module và spec qualification. Không thấy ghi file/network/database trong năm module.

Android chỉ đọc các phần liên quan tại `bai1/app/src/main/java/com/example/bai1/rescue/routing/`: `model/RescueRoutingContext.kt`, `model/RoadGraph.kt`, `algorithm/UniformCostSearchRouter.kt`. Đường dẫn Android trong tài liệu cũ khác cây hiện tại. Không build/chạy lại Android và không sửa Kotlin.

## 4. Contract Types Audit

| Hạng mục | Kết quả độc lập |
|---|---|
| 8 QualificationCriterion | Đủ, khớp danh sách yêu cầu |
| 8 CriterionEvaluationState | Đủ |
| 3 EvidenceMeasurementDecision | Đủ |
| `any` | Không có kiểu any trong năm module; comment không tính là kiểu |
| JSON collection | Interface dùng readonly string[], không Set; Set nội bộ resolver không tự nó vi phạm JSON |
| Unique/sorted | Không có validator/serializer chuẩn hóa; `evidenceIdsUsed` giữ thứ tự đầu vào, có thể trùng |
| Integrity/authenticity | Có trường hash/chữ ký riêng; thực thi chỉ kiểm tra format hash/nhãn chữ ký, chưa xác thực nguồn |
| Graph/profile identity | Output chứa tên/hash/version nhưng không đối chiếu artifact hoặc provenance version |
| Policy version | Không có `qualificationPolicyVersion` trong input/output và không có kiểm tra |
| Runtime required fields | Chỉ kiểm tra một phần; `unknown as Partial<T>` không phải schema/type guard đầy đủ |

Profile không kiểm tra đầy đủ status, finite numbers, ground clearance/gradient và các năng lực còn lại; arrays không kiểm tra phần tử, thứ tự hoặc trùng. Provenance bỏ qua nhiều trường bắt buộc: title/reference/officer/registry/version/method enum và trạng thái ACTIVE. Evidence bỏ qua evaluatedAt, sourceDocumentRef, enum revocation/signature, units theo criterion, bounds offsets. Exemption còn bỏ qua evidenceId/edge/hash tại validator, justification/details và whitelist authority. Engine có lọc edge/hash exemption ở tầng ngoài nhưng không khắc phục authenticity.

`approvalStatus = AUTHORITATIVE_APPROVED` không phải field của contract thực tế; tương đương cần kiểm toán là `status = ACTIVE_APPROVED` và `digitalSignatureStatus = VERIFIED_TRUSTED`. Không báo thiếu field tưởng tượng như một lỗi riêng.

## 5. Canonical Geometry Hash Audit

Đã tính độc lập Python hashlib trên đúng UTF-8, không newline; test production helper cũng khớp:

| Vector | Bytes | SHA-256 |
|---|---:|---|
| 01 | 70 | `ec4e64d4bb52b82cea9f823977467113476764cb436e1d334eba79bd7264ad6b` |
| 02 | 71 | `4fbd28765fcf2475ff508fb3c68d2cf3d60bda1907dde43fd5eec28d26253a06` |

Corrective report ghi 71/72 bytes là sai, nhưng hash đúng.

`buildCanonicalGeometryString` giữ thứ tự geometry; importer đã reverse sẵn (`osm-importer.ts:486` và các dòng kế tiếp); không double reverse. `crypto.createHash('sha256').update(...,'utf8')` là băm thực. Geometry không tự gắn graph identity; việc này cần kiểm chứng ở tầng engine/artifact, hiện còn thiếu.

Đã kiểm tra: NaN/±Infinity/latitude 90.1 bị từ chối; ±90 hợp lệ qua test hiện có; longitude có giới hạn ±180 trong mã. -0 và số âm gần 0 được chuẩn hóa. Hai đỉnh giống hệt bị từ chối; hai đỉnh khác nhau dưới precision (`(0,0)` và `(1e-9,1e-9)`) vẫn tạo canonical có hai đỉnh đều `0.0000000,0.0000000`. Đỉnh trùng kề nhau trong polyline không phải luôn geometry zero-length; không có kiểm tra topology/endpoint với node registry.

Đảo geometry nhưng giữ N1/N2 được chấp nhận, tạo hash khác; vì input không có node registry nên không xác nhận tọa độ đầu/cuối thuộc đúng node. `isWayForward: undefined` bị ép thành false. Các node ID chứa delimiter có collision canonical (F09).

### Phân biệt thuật toán làm tròn

| Input number | production toFixed(7) | Math.round(x*1e7)/1e7 | Decimal HALF_EVEN chính xác |
|---|---|---|---|
| 0.00000005 | 0.0000000 | 0.0000001 | 0.0000000 |
| 1.00000005 | 1.0000000 | 1.0000001 | 1.0000000 |
| 0.00390625 | 0.0039063 | 0.0039063 | 0.0039062 |
| -0.00390625 | -0.0039063 | -0.0039062 | -0.0039062 |

Toàn bộ các giá trị toFixed, Math.round và Decimal HALF_EVEN trong bảng đã chạy độc lập; không coi chúng tương đương. 0.00390625 là số nhị phân biểu diễn chính xác, nên đây là phản ví dụ trực tiếp với hợp đồng Half-Even, không chỉ do nhiễu decimal input.

Không có Java/jshell trong PATH đã kiểm tra; không chạy Kotlin/BigDecimal. Python Decimal chứng minh khác biệt toán học với Half-Even, không chứng minh output Kotlin hiện tại. `BigDecimal` còn phụ thuộc cách dựng từ string hay binary double và RoundingMode; không thể suy đồng nhất với toFixed hoặc Math.round. Chưa thực hiện cross-validation 10.000 tọa độ.

## 6. Runtime Validation Audit

Authority chỉ được so tên với bảng hardcoded (`validation.ts:56–64`, `258–273`), không kiểm tra nguồn phát hành. Đổi `TEST_AUTH` thành whitelist làm mất marker synthetic; không có chứng cứ PKI đi kèm để chống giả mạo. Profile signature chỉ cảnh báo trừ cổng ngoài kiểm tra nhãn; evidence/exemption signature không được dùng để từ chối.

Không có verifier X.509/chain/CRL/OCSP hoặc đọc document bytes để xác nhận documentSha256. Hash canonical ràng buộc hình học có giá trị integrity giới hạn; một chuỗi 64 hex do attacker cung cấp không chứng minh authenticity. Khi PKI chưa có, production phải khóa cấp verified từ dữ liệu tự khai; hiện không khóa được.

Miễn trừ không tự được áp dụng khi không có record (điểm đúng), và mandatory criterion/bridge=true bị từ chối (điểm đúng). Nhưng thiếu metadata, bridge=false hoặc hồ sơ exemption không thẩm quyền vẫn có thể qua; exemption còn được trả về trước khi xem evidence FAIL. Chính sách terrain chỉ cấm track/path/footway và kiểm tra justification khi metadata tồn tại, không chứng minh thiết kế/hoàn công/địa hình thực.

## 7. Evidence Resolution Audit

Các kết quả sau đã gọi trực tiếp resolver production trong bộ nhớ, không thêm file test. Profile fixture cần height 3.10m; scope và value ghi rõ dưới đây; ngày đánh giá 2026-06-01 UTC.

| Tình huống bắt buộc | Kết quả quan sát |
|---|---|
| 1. Một PASS full edge, 4.5±0.05m | SATISFIED |
| 2. Một FAIL, 2.1±0.02m | FAILED |
| 3. Giao ngưỡng, 3.1±0.02m | INDETERMINATE |
| 4. Cùng nhóm full edge 3.20±0.05 / 3.22±0.05 | SATISFIED, effective 3.15 |
| 5. Cùng offset 10m, 2.1±0.02 / 4.5±0.02 | CONFLICTING |
| 6. Khác điểm, có bottleneck | FAILED |
| 7. Nhóm CONFLICTING tại 10m + FAIL tại 20m | FAILED, không còn diagnostic conflict |
| 8. Nhóm CONFLICTING tại 10m + INDETERMINATE tại 20m | CONFLICTING |
| 9. Toàn expired | EXPIRED |
| 10. Toàn invalid uncertainty=0 | INVALID |
| 11. Expired + invalid | INVALID |
| 12. Không evidence | MISSING |
| 13. Một điểm PASS / cạnh 120m | MISSING; cạnh 40m với point ngoài cạnh vẫn có thể SATISFIED |
| 14. Toàn revoked | MISSING, lý do NO_ACTIVE_EVIDENCE |
| 15. Có supersedesEvidenceId | Bản cũ bị bỏ trước validation |
| 16. FAIL cũ bị bản mới thuận lợi thay thế không đúng điều kiện | SATISFIED; khi bảy tiêu chí khác đủ thì VERIFIED_COMPATIBLE |

Thứ tự quan trọng **được triển khai đúng cho số đo numeric trong cùng nhóm**: phát hiện conflict trước xét fail; do đó FAIL_CERTAIN ở một record cùng vị trí có interval mâu thuẫn không bị kết luận FAILED. Sau đó FAIL ở nhóm độc lập ưu tiên conflict ở nhóm khác, đúng bước 9 của đặc tả. Không báo thứ tự này thành lỗi. Tuy nhiên diagnostic conflict/invalid bị mất khi có nhóm quyết định khác.

Khoảng tương thích dùng min(lower) / max(upper) toàn record, không dùng cận của intersection như ví dụ 5B.1. Đây là cách bảo thủ hơn, có thể mất khả năng SATISFIED chứ chưa chứng minh false-safe; tài liệu có cả ví dụ min(lower) nên cần thống nhất.

Boolean criteria vẫn bị so khoảng measuredValue giả trước khi xét boolean: true và false với cùng measuredValue 4.5 cho FAILED, không CONFLICTING. Cần chính sách conflict riêng định tính (F11). Group offset làm tròn 0.1m; span chỉ nhóm khi hai đầu giống nhau, không xử lý overlap giữa point/span/full edge.

## 8. Edge Qualification Engine Audit

Không thấy I/O hoặc mutation graph/evidence/profile. Các lời gọi kiểm tra cho thấy JSON đầu vào trước/sau không đổi; đây là kiểm chứng các đường đã chạy, không chứng minh mọi object/proxy đầu vào. Tính xác định output chưa hoàn chỉnh vì thứ tự input ảnh hưởng evidenceIdsUsed/representative conflict và diagnostics.

| Cổng | Đánh giá |
|---|---|
| Geometry | Tính hash thực, lọc evidence theo edge.id/hash; mismatch bị cảnh báo và thành MISSING |
| Graph SHA/version | Chỉ chép input ra output, không validate/đối chiếu artifact |
| Vehicle ID/version | Chỉ chép profile vào output; không so provenance.profileVersion |
| Profile validity/revocation | Có bắt REVOKED_SAFETY_NOTICE, không đủ với status REVOKED và thời hạn |
| Evidence expiry/revocation | Bắt thời hạn hợp lệ thông thường và REVOKED, nhưng evaluatedAt NaN và supersession phá điều kiện |
| Production/test | Mặc định requireProductionApproved=false; không có môi trường/packaging boundary đáng tin cậy |
| 8/8 | Có allPassed qua toàn bộ tám criterion; probe 7/8 giữ UNVERIFIED |
| Valid failure | Trả BLOCKED; dữ liệu INVALID thông thường không tạo BLOCKED, nhưng units/signature invalid chưa bị đánh dấu invalid |
| Diagnostics | Có lý do từng criterion nhưng không giữ toàn bộ invalid/conflict bị lọc |
| Live hazard | Không phải input của static engine; verified của module này không được hiểu là live routing authorization |

## 9. Unit Test Quality Review

27 test thực sự gọi production helper/qualifier; không thấy mock thay logic engine. Không có test chỉ compile interface. Tuy nhiên nhiều assertion chỉ kiểm tra một field, không kiểm tra trust, identity, diagnostics hay router thực tế. Fixtures tự khai authority và VERIFIED_TRUSTED; measured unit mặc định m ngay cả load/gradient, che lỗi unit validation. `Math.random()` tạo evidenceId làm fixture không tái lập hoàn toàn.

| Spec 5B.1 | Test thực tế | Đánh giá |
|---|---|---|
| 01–06 | 01–06 | Có hành vi numeric cơ bản; không bao phủ tổ hợp nhiều nhóm/boolean |
| 07 | 07 | Chỉ uncertainty=0; không kiểm tra document bytes/hash tamper |
| 08 | 08 | Có expiry |
| 09 | 09 dòng 560 | Dùng evidence=[]; không phải 7/8 như spec |
| 10 | 10 | Chỉ state exemption; không đủ chứng minh pháp lý |
| 11 bridge | 12 | Có bridge=true, số ID khác spec |
| 12 highway terrain exemption | Không có | Thiếu positive case và chứng minh hoàn công |
| 13 steep track | 13 | Chỉ state; fixture dùng justification không đúng terrain, nên chưa cô lập lý do track |
| 14–16 | 14–16 | Hash forward/reverse/negative zero thực chất; chưa cross-language |
| 17 legacy routing | 27 gần nhất | Không gọi router/loader/contract gate; không hiện thực spec |
| 18 sidecar checksum | Không có | Test mang ID18 chỉ geometry mismatch; không phải sidecar tamper |
| 19 offline revocation 72h | Không có | ID19 hiện là profile revoke với evidence rỗng |
| 20 bounded corridor UCS | Không có | ID20 hiện là prefix synthetic evidence |

Test 17 hiện là geometry boundary, không legacy gate. Test 19 và 21 dùng evidence rỗng nên status UNVERIFIED không chứng minh cổng production hoạt động khi tám criterion đủ. Test 24 mong SATISFIED dù hai record có cùng evaluatedAt và không kiểm tra signed supersession; đang củng cố lỗi F02. Test 25 chỉ kiểm tra hai field của một edge, không whole-graph readiness. Test 26 cho fixture mặc định `isProductionApproved=true` khi không yêu cầu production. Test 27 chỉ kiểm tra fixture UNVERIFIED và sidecar record edge/hash; không kiểm tra version, loader, Android hay UCS.

Kết luận: tuyên bố hiện thực đủ 20 spec + 7 test không được chứng minh. Các spec tích hợp có thể được hoãn do phạm vi 5C.1, nhưng phải ghi rõ hoãn thay vì tuyên bố hoàn tất.

## 10. Build & Test Execution Results

| Lệnh thực thi | Kết quả | Thời gian | Exit |
|---|---|---|---:|
| `npx --no-install nest build` | Thành công | Không đo tổng thời gian riêng | 0 |
| `npm test -- --runInBand` | 27/27 suites, 339/339 tests PASS | Jest 13.131s | 0 |
| `npm test -- --runInBand --runTestsByPath tools/osm-importer/test/edge-qualifier.spec.ts` | 1/1 suite, 27/27 tests PASS | Jest 0.166s | 0 |

Build dùng Nest đã cài sẵn, thêm `--no-install` để không tải dependency; không thay đổi cấu hình. `tsconfig.build.json` include src và rootDir src: build Nest không tự chứng minh typecheck các module tools. Jest dùng ts-jest/isolatedModules nên test pass cũng không tương đương kiểm tra kiểu toàn chương trình.

Jest tổng không báo skip: 339 passed/339 total; riêng 27 passed/27 total; snapshots 0. Warning tổng: Node ExperimentalWarning VM Modules; SosService cảnh báo Firebase projection failed cho `sos-1` và debug firebase unavailable. Không có warning trong output build/qualification riêng. Không cài dependency hoặc chạy auto-fix.

Build tái tạo `dist/` theo Nest `deleteOutDir:true`, ghi incremental `tsconfig.build.tsbuildinfo` (file này đã dirty trước phiên). Jest có thể ghi cache mặc định; không có inventory/hash cache đầy đủ, không xóa cache. Test importer ghi graph JSON/GZ, diagnostics, manifest trong `tools/osm-importer/output/` và `output-real/`, có test tạo rồi tự xóa customOut. Kiểm toán không tự chạy cleanup.

Các probe là đoạn Node chạy từ stdin, transpile TypeScript trong bộ nhớ bằng dependency sẵn có; lấy phần factory trước describe từ spec, không chạy/sửa test hoặc ghi source. Python tính hash/Decimal từ stdin. Không tính các probe này vào 339 tests.

## 11. Production Isolation Verification

Năm module không import vào importer/CLI/backend runtime theo tìm kiếm nguồn; không ghi BaseRoadGraph/RoutingManifest. Reverse geometry importer phù hợp. `osm-importer.ts` và `types.ts` có diff có sẵn liên quan via-way; không thể xác nhận tuyên bố lịch sử “Task 5C.1 không sửa chúng” chỉ từ cây dirty. Không có sửa production source do kiểm toán.

Artifact quan sát sau test:

| Thư mục dưới tools/osm-importer | SHA-256 BaseRoadGraph.json.gz | Đếm status | Manifest canAttemptStrictRouting |
|---|---|---|---|
| output-dryrun-task3b | `1b7f64a965a763624e0a6c2cd866352fc3ef5f106214907866d0c6dcb49c25b4` | 16.651 UNVERIFIED | false |
| output-danang-261103 | `9c0166f9d1fa0ad45aef4163a258d5d3d9310d3d2eb0c99e169669e77537ac5d` | 16.651 UNVERIFIED | false |
| output-danang-261103-task97 | `9792dce0abb089a230bcb79e71b2a8ff83301879d417f4fd399711ce4c3a037b` | 16.651 UNVERIFIED | false |
| output | `3fe5f4acb1e88d7785de7efa7e57ba08994b7d6e419933a940b76b0725493b46` | 50 UNVERIFIED | false |
| output-real | `89b451800767e0edc0c184389b10567e50df5f479314b77f92558e5b9f4c13b2` | 2 VERIFIED_COMPATIBLE, 2 UNVERIFIED | true |

`output-real` vừa được test 71 importer ghi bằng fixture `test_real_snapshot.osm.xml`, graphVersion `dn_central_custom_v99`, PRODUCTION bbox; không được coi là đồ thị Đà Nẵng thật hoặc bằng chứng engine mới chạy production. Không đủ snapshot đầu phiên để nói artifact này trước test đã giống hay khác. Readiness của nó vẫn NOT_READY_HAS_UNVERIFIED_EDGES; canAttempt=true không tự chứng minh router được phép chạy.

Đồ thị dryrun khớp hash yêu cầu; manifest false; hazard NOT_INCLUDED, activeHazardSnapshotVersion null. Android `RescueRoutingContext.kt:164–180,269–282` có cổng manifest/graph và zero/unverified edges; UCS `UniformCostSearchRouter.kt:253,419` có cổng readiness và chỉ nhận verified. Vì vậy strict routing trên đồ thị dryrun hiện vẫn bị khóa theo mã và artifact đã kiểm tra; không chạy Android để xác minh end-to-end.

Không thấy `require(contractVersion == "2.1.0")` trong `RoadGraph.kt` hiện tại qua đọc/tìm kiếm; field default 2.1.0 không phải validation. Không khẳng định toàn hệ thống thiếu gate vì gate có thể nằm loader ngoài phạm vi đã đọc. Đây là NEEDS_VERIFICATION, trái với việc tài liệu cũ chỉ đúng vị trí constructor.

Một snapshot SHA-256 các file importer source/test/CLI và output được lấy **sau full suite** để đối chiếu cuối phiên: **36/36 file không đổi, không có file mới trong tập đường dẫn này**. Snapshot này không thay thế baseline trước test. Hash khớp một graph không chứng minh mọi artifact hoặc production remote bất biến. Không kiểm tra storage remote/deployment/database và không thay đổi chúng. Git status cuối giữ các mục dirty/untracked ban đầu, thêm báo cáo trong docs; git diff --check cuối exit 0.

## 12. Security Findings

Quy ước đường dẫn dưới đây tương đối với Backend, source prefix `tools/osm-importer/src/`. Số dòng căn cứ cây mã đang kiểm toán; không suy đoán lịch sử commit. Các kết quả VERIFIED bên dưới là record trong bộ nhớ, không ghi ngược graph.

### F01 — CRITICAL — Tự khai trust vượt cổng production

- File/dòng/hàm: `qualification-validation.ts:56–64,179–183,258–273`, `edge-qualifier.ts:156–175,193–197`; validateCriterionEvidence/validateVehicleProfile/qualifyEdge.
- Evidence/tái hiện: lấy profile và 8 evidence PASS từ factories hiện có, `requireProductionApproved:true`. Không có document hoặc chứng thư thật. Trả VERIFIED_COMPATIBLE, isProductionApproved=true. Đổi mọi evidence.digitalSignatureStatus thành INVALID_SIGNATURE vẫn có đúng kết quả đó, errors/warnings rỗng.
- Actual: authority whitelist và profile signature enum do input cung cấp được xem như trust; evidence signature bị bỏ qua.
- Expected: khi PKI/trust verifier chưa cấu hình, production giữ UNVERIFIED; nhãn input không được tạo trust.
- Safety impact: dữ liệu test/giả mạo có thể được engine xác nhận production-ready. Đổi TEST_* thành tên whitelist vượt marker synthetic.
- Recommended correction: tách dữ liệu khai báo và kết quả xác thực do verifier tin cậy cấp; gắn chữ ký với payload/issuer/thu hồi; cổng fail-closed khi chưa có verifier. Tách test mode và cấm output test được production-approved.
- Nhánh bổ sung đã tái hiện: bỏ requireProductionApproved, profile PROVISIONAL + TEST_AUTH + UNVERIFIED_NOT_CONFIGURED và toàn bộ evidence TEST_AUTH vẫn trả VERIFIED_COMPATIBLE (isProductionApproved=false). API default không an toàn cho consumer chỉ đọc status.

### F02 — CRITICAL — Supersession chưa xác thực xóa bottleneck

- File/dòng/hàm: `qualification-evidence.ts:185–205`, resolveCriterionEvidence.
- Evidence/tái hiện: height OLD=2m tại offset 10m làm edge BLOCKED khi bảy tiêu chí khác PASS. Thêm NEW=4.5m full edge, supersedesEvidenceId=OLD, evaluatedAt=2025-01-01 (cũ hơn OLD=2026-05-01) làm edge VERIFIED_COMPATIBLE/prod=true. Hoặc giữ một evidence PASS full edge độc lập và thêm NEW revoked, authority ATTACKER: OLD vẫn bị bỏ và toàn cạnh VERIFIED_COMPATIBLE.
- Actual: xây Set superseded IDs trước validation, chữ ký, ngày, scope và revocation; bản REVOKED/invalid cũng có quyền xóa bản cũ.
- Expected: chỉ chấp nhận thay thế có thẩm quyền/chữ ký hợp lệ, mới hơn, bao trùm đúng bottleneck; record không hợp lệ không được tác động tập evidence.
- Safety impact: xóa thất bại thực tế mà không có chứng cứ đã xử lý vật cản.
- Recommended correction: xác thực quan hệ supersession sau validation, kiểm tra thời gian/scope/issuer, chu kỳ/self-reference, bảo toàn lịch sử và lý do loại.

### F03 — CRITICAL — Exemption giả ghi đè failure

- File/dòng/hàm: `qualification-validation.ts:286–362`, `qualification-evidence.ts:144–159`, validateNotApplicableEvidence/resolveCriterionEvidence.
- Evidence/tái hiện: load evidence 1t±0.05 (xe yêu cầu 5.25t), thêm exemption cùng edge/hash, authority ATTACKER, justification NONSENSE, digitalSignatureStatus INVALID_SIGNATURE, cadastre string và hash 64 hex. Metadata bridge=false/tunnel=false. Trả NOT_APPLICABLE và toàn cạnh VERIFIED_COMPATIBLE/prod=true. Metadata undefined vẫn được chấp nhận.
- Actual: không whitelist/xác thực exemption, không kiểm tra justification cho load, early return bỏ qua FAIL.
- Expected: chưa chứng minh không có công trình thì UNVERIFIED; không dùng exemption giả để xóa verified failure; record phải đúng policy và nguồn được xác thực.
- Safety impact: bỏ kiểm định tải trọng cầu/công trình chỉ bằng tự khai.
- Recommended correction: proof có thẩm quyền theo criterion, schema/identity/validity đầy đủ; reconcile exemption với failure và kiểm tra công trình độc lập OSM bridge=false. Terrain cũng cần proof thiết kế/hoàn công.

### F04 — CRITICAL — Thiếu coverage vẫn SATISFIED

- File/dòng/hàm: `qualification-evidence.ts:259–270,427–449`, resolveCriterionEvidence.
- Evidence/tái hiện: edge.lengthMeters=40, cả 8 record PASS chỉ POINT_CHOKEPOINT offset=9999m. Geometry/hash giữ nguyên. Production mode trả VERIFIED_COMPATIBLE/prod=true.
- Actual: chỉ bắt thiếu full-edge cho height/width/surface khi length>50; không validate offset; các criterion khác bỏ coverage.
- Expected: không đủ bao phủ đúng phạm vi vật lý phải MISSING/UNVERIFIED, không miễn coverage vì cạnh ngắn.
- Safety impact: một phép đo ngoài cạnh chứng minh sai toàn cạnh.
- Recommended correction: validate length/offset/span finite và bounds; policy coverage từng criterion, các chokepoint bắt buộc; không dựa duy nhất vào nhãn full-edge tự khai.

### F05 — CRITICAL — evaluatedAt không hợp lệ vô hiệu expiry

- File/dòng/hàm: `edge-qualifier.ts:42–52`, `qualification-evidence.ts:139,216–225`; qualifyEdge/resolveCriterionEvidence.
- Evidence/tái hiện: 8 records PASS có validUntil=2026-01-02 đã hết hạn; evaluatedAt='garbage'. Production mode vẫn VERIFIED_COMPATIBLE/prod=true.
- Actual: Date.parse trả NaN, cả hai so sánh trước validFrom/sau validUntil đều false, record trở thành active.
- Expected: timestamp đánh giá sai phải lỗi và UNVERIFIED trước khi xét evidence.
- Safety impact: sử dụng bằng chứng hết hạn hoặc chưa có hiệu lực.
- Recommended correction: validate UTC timestamp/date hữu hiệu, finite epoch, nguồn clock tin cậy; không cho caller tự lùi ngày trong đường production.

### F06 — CRITICAL — Profile revoked/hết hạn/sai version vẫn verified

- File/dòng/hàm: `qualification-validation.ts:90–92,130–183`, `edge-qualifier.ts:156–175`; validateVehicleProfile/qualifyEdge.
- Evidence/tái hiện: profile.status=REVOKED, provenance.revocationStatus=ACTIVE, provenance.profileVersion=99.0.0 khác profileVersion=1.0.0, effectiveUntil=2026-01-02; ngày đánh giá 2026-06-01, 8 records PASS. Trả VERIFIED_COMPATIBLE, errors=[], isProductionApproved=false. Consumer dùng qualificationStatus vẫn nhận verified.
- Actual: chỉ bắt REVOKED_SAFETY_NOTICE; chỉ so effectiveFrom<=effectiveUntil, không so với thời điểm đánh giá hoặc version.
- Expected: ACTIVE_APPROVED + provenance hợp lệ cùng version + còn hiệu lực, nếu không UNVERIFIED.
- Safety impact: qualification gắn với cấu hình phương tiện chưa được phê duyệt/đã hết hiệu lực.
- Recommended correction: xác thực mọi status enum, trạng thái nhất quán, trust/version/time binding trước đánh giá.

### F07 — CRITICAL — Graph identity chỉ là nhãn output

- File/dòng/hàm: `edge-qualifier.ts:27–35,199–205`, qualification-types.ts EdgeQualificationRecord; qualifyEdge.
- Evidence/tái hiện: giữ 8 record PASS, đặt graphVersion='' và graphArtifactSha256='NOT_A_HASH'. Production mode trả VERIFIED_COMPATIBLE/prod=true, chép nguyên hai chuỗi vào output.
- Actual: không validate hash/version, không tính/so với artifact tin cậy; evidence không có graph/profile/policy version binding.
- Expected: chỉ verified khi graph identity đã được kiểm chứng; policy/profile phải gắn với nguồn chứng cứ/qualification phù hợp.
- Safety impact: phát hành qualification dưới danh tính graph sai hoặc chưa kiểm chứng.
- Recommended correction: trusted graph context từ loader xác minh byte hash/version, ràng buộc output với artifact; thêm policy version và validation tại biên. Hàm thuần có thể nhận context đã xác thực thay vì tự I/O.

### F08 — CRITICAL — Numeric/unit validation cho phép phép đo vô nghĩa PASS

- File/dòng/hàm: `qualification-validation.ts:94–119,229–249`, `qualification-evidence.ts:43–54`; validators/evaluateEvidenceMeasurement.
- Evidence/tái hiện: height evidence measuredValue=Infinity, uncertainty=0.05 được valid và lower>=required nên PASS. Dùng cả 8 record, production mode trả VERIFIED_COMPATIBLE/prod=true. Thử unit='cm' cũng được chấp nhận; không có conversion sang m. Validator profile với overallHeightMeters=NaN cũng báo valid.
- Actual: measuredValue chỉ reject NaN, uncertainty không reject Infinity; profile dùng <=0/<0 không bắt NaN; units chỉ cần string.
- Expected: tất cả numeric và intermediate bounds finite, đúng miền/đơn vị theo criterion. Dữ liệu invalid không được dùng PASS hay BLOCKED.
- Safety impact: false-safe từ Infinity/đơn vị sai; Infinity không đi qua JSON chuẩn nhưng API in-memory nhận number này trực tiếp, unit sai đi qua JSON bình thường.
- Recommended correction: Number.isFinite cho toàn bộ giá trị/threshold; typed unit/schema mỗi criterion, conversion được kiểm chứng; loại invalid trước đo lường.

### F09 — HIGH — Canonical identity có collision delimiter

- File/dòng/hàm: `qualification-geometry.ts:122–145`, buildCanonicalGeometryString.
- Evidence/tái hiện: cùng geometry/FWD, from='A->B',to='C' và from='A',to='B->C' tạo chuỗi giống hệt, nên cùng hash. Undefined FWD bị ép false. Geometry đảo endpoint vẫn được chấp nhận khi N1/N2 không đổi.
- Actual: chỉ yêu cầu ID non-empty, không escape/length-prefix, không validate boolean/node geometry.
- Expected: canonical encoding injective trên miền ID hợp lệ, hướng boolean bắt buộc; kiểm tra node endpoints tại trusted graph boundary.
- Safety impact: hash không phân biệt danh tính node ở miền ID đang được API chấp nhận. Chưa chứng minh wrong-way reuse xảy ra với ID OSM chuẩn và graph tin cậy.
- Recommended correction: giới hạn grammar node ID hoặc encoding không nhập nhằng; validate direction/edge.id/node registry. Không coi thay SHA-256 là cách sửa serialization collision.

### F10 — MEDIUM — Rounding lệch hợp đồng Half-Even

- File/dòng/hàm: `qualification-geometry.ts:69`, formatCoordinate.
- Evidence/tái hiện: ±0.00390625 cho ±0.0039063; Decimal HALF_EVEN phải ±0.0039062. Math.round khác toFixed tại 5e-8 và 1.00000005.
- Actual: toFixed(7), trong khi hợp đồng 5B.1 mục 5B chỉ Half-Even và phần blocker còn nhắc Math.round (tài liệu tự mâu thuẫn).
- Expected: một thuật toán/representation/tie rule duy nhất, có vector chung TypeScript/Kotlin.
- Safety impact: hash khác cross-language dẫn tới từ chối evidence hoặc identity không nhất quán; chưa chứng minh false-safe riêng từ rounding.
- Recommended correction: chốt decimal/binary input semantics và rounding, golden vectors/tie signs/negative zero, cross-validation yêu cầu. Không coi String.format, BigDecimal, toFixed tương đương.

### F11 — MEDIUM — Schema, serialization và diagnostics chưa đầy đủ

- File/dòng/hàm: `qualification-validation.ts:47–50,84,122–128,207,248–250,298`; `qualification-evidence.ts:265,291–305,374–404,454–476`; validators/resolver.
- Evidence/tái hiện: validateVehicleProfile với allowedHighwayTypes=[7,7], disallowedSurfaceTypes=[null], height=NaN trả valid=true; isValidIsoTimestamp('2026')=true. Hai record LEGAL_ACCESS true/false với cùng numeric payload cho FAILED, không conflict. Không có sort/dedup khi xuất evidenceIdsUsed; fail+conflict khác nhóm trả chỉ bottleneck reason.
- Actual: dùng cast Partial thay full schema; arrays/enum/ISO không đủ, numeric conflict áp dụng cả boolean, diagnostic bị mất.
- Expected: required fields được validate, collection deterministic/unique, conflict định tính riêng; bảo toàn lý do invalid/conflicting/revoked đã gặp.
- Safety impact: khó truy vết, JSON không ổn định, sai phân loại; các đường false-safe cụ thể đã tách F01–F08.
- Recommended correction: strict schema, type guards, serialization canonical, giữ diagnostic toàn tập, policy boolean/categorical conflict. Kiểm tra degenerate sau quantization và geometry malformed để trả lỗi có cấu trúc.

### F12 — MEDIUM — Test foundation chưa chứng minh acceptance

- File/dòng/hàm: `test/edge-qualifier.spec.ts:560,650,705,755,833,866,901,930`; các test 09/13/19/21/24–27.
- Evidence/tái hiện: chạy 27 tests PASS nhưng các probe F01–F08 vẫn VERIFIED; test09 dùng 0/8, test24 không mới hơn, test27 không gọi router/version gate.
- Actual: thiếu test quan trọng, tên test lớn hơn điều được assert; spec 5B.1 12 và 17–20 chưa hiện thực đúng.
- Expected: kiểm tra production với đầy đủ baseline 8/8 để cô lập từng cổng, kiểm tra toàn bộ output và negative cases.
- Safety impact: suite xanh tạo niềm tin sai vào qualification.
- Recommended correction: bổ sung corrective tests mục 15; đổi tên/ghi hoãn integration spec; không mock trust thành VERIFIED_TRUSTED rồi coi đó là kiểm chứng PKI.

### F13 — MEDIUM — Full suite ghi graph artifact vào thư mục dùng chung

- File/dòng/hàm: `test/osm-importer.spec.ts:639,1961,1973,1994,2156`, `tools/osm-importer/cli.ts` runCli (các lệnh fs.writeFileSync); importer CLI tests/runCli.
- Evidence/tái hiện: `npm test -- --runInBand` chạy các test gọi runCli với output mặc định/output-real. Manifest output-real generatedAt 2026-11-05T15:22:47.828Z, graphVersion dn_central_custom_v99, fixture 4 cạnh nhưng PRODUCTION bbox.
- Actual: test ghi output graph/manifest thật trên filesystem thay vì thư mục temp riêng; build/test cũng ghi cache/dist.
- Expected: kiểm thử không đè artifact dùng chung; audit cần hash trước mọi test có I/O hoặc cô lập đường ghi.
- Safety impact: nhầm fixture với dữ liệu thật hoặc mất artifact cũ; không có bằng chứng deployment remote bị tác động. Đây là thiếu sót test có sẵn và thiếu sót preflight của phiên audit.
- Recommended correction: corrective patch dùng temp directory/test fixtures và cleanup chỉ file thuộc test; hiện không tự khôi phục vì thiếu baseline và cấm thay dữ liệu người dùng.

### F14 — LOW — Báo cáo triển khai khẳng định vượt bằng chứng

- File/dòng/hàm: `docs/PHASE5_TASK5C1_IMPLEMENTATION_REPORT.md`, mục 1,3,4,11,14; tài liệu, không có function.
- Evidence/tái hiện: so số dòng thực tế, git status ban đầu, bảng map 20 specs và các probe ở báo cáo này. Corrective report vector byte count sai 1 byte mỗi vector.
- Actual: khẳng định đủ 20 specs, chỉ file mới, khóa cứng SemVer và runtime nghiêm ngặt; chưa có chứng minh tương ứng.
- Expected: phân biệt thiết kế, triển khai, thực thi và giới hạn; không dùng PASS tests thay trust verification.
- Safety impact: sai quyết định nghiệm thu/tích hợp.
- Recommended correction: cập nhật báo cáo dựa trên kết quả thực tế, scope có baseline, và đánh dấu integration gates chưa kiểm chứng.

### Threat-model coverage

| Threat | Căn cứ/kết luận |
|---|---|
| Forged authority / approval / signature | F01, F03, F06 đã tái hiện |
| Tampered geometry | Hash mismatch bị cảnh báo/lọc; canonical identity còn F09/F10 |
| Wrong-way reuse | Vector reverse khác forward; direct mismatch bị lọc; chưa kiểm chứng endpoint/node trust toàn graph |
| Expired / revoked | Ca thông thường fail-closed; F02/F05/F06 bypass |
| Insufficient coverage | F04 tái hiện |
| Synthetic leakage / test-mode bypass | F01; prefix không chứng minh provenance; F13 artifact fixture |
| Profile version mismatch | F06 |
| Graph mismatch | F07 |
| Missing live hazard | Artifact NOT_INCLUDED; engine static không có hazard input; cần giữ cổng Android riêng |
| Unsafe defaults | requireProductionApproved=false, Boolean(undefined), F01/F09 |

## 13. Confirmed Bugs

F01–F11 có căn cứ source và/hoặc probe trực tiếp được mô tả; F12 là thiếu coverage đã đối chiếu assertion/spec; F13 là tác dụng phụ test quan sát và source; F14 là sai lệch tài liệu. Không coi mọi hạn chế là false-safe: F09 chưa chứng minh exploitation trên OSM ID chuẩn, F10 chủ yếu interoperability, F11 có các sai lệch bảo thủ/diagnostic. Không xác nhận router production đã bị unlock.

### Cách tái hiện chung không ghi file

Để tái hiện F01–F08, dùng Node stdin với TypeScript dependency đã cài để transpile source trong bộ nhớ. Nạp phần fixture factories trước `describe('Phase 5` trong spec, export bốn factory; không thực thi describe/it. Nạp trực tiếp EdgeQualifier và computeCanonicalEdgeGeometryHash. Baseline:

1. `edge=createMockEdge()`, `profile=createMockRescueTruckProfile()`.
2. Tạo mỗi criterion một evidence từ createMockEvidence, cùng edge.id và hash tính thực. IDs E0..E7. Giá trị theo thứ tự ALL_QUALIFICATION_CRITERIA: `[1,4.5,4,20,10,1,5,0.1]`; boolean=true mặc định. Các trường còn lại giữ factory.
3. graphVersion='dn_central_real_v1', graphArtifactSha256 bằng hash yêu cầu, evaluatedAt='2026-06-01T00:00:00Z', requireProductionApproved=true.
4. Gọi `new EdgeQualifier().qualifyEdge(input)`; baseline trả VERIFIED_COMPATIBLE/prod=true dù chỉ có fixtures tự khai. Lặp lại với mỗi thay đổi đã mô tả riêng ở từng finding, không ghi kết quả vào edge/artifact.

Để cô lập lỗi unit ngoài Infinity: dùng cùng baseline, height.measuredValue=4.5 và unit='cm' thay vì m. Validator không đối chiếu unit, công thức vẫn dùng 4.5 như m; sai đơn vị không được phát hiện. Để test diagnostics, gọi resolveCriterionEvidence trực tiếp với các records/mốc/scope ở mục 7.

## 14. Potential Risks / Needs Verification

- **NEEDS_VERIFICATION:** deployment đang phân phối artifact nào; không đọc remote/prod env hoặc thay cấu hình. Hash local không xác minh storage đang phục vụ client.
- **NEEDS_VERIFICATION:** cổng version trong Android loader ngoài RoadGraph; tài liệu nói constructor require nhưng mã hiện tại không cho thấy điều đó.
- **NEEDS_VERIFICATION:** Kotlin BigDecimal/formatter và 10.000 tọa độ; không có runtime JVM trong PATH, không cài thêm dependency.
- **NEEDS_VERIFICATION:** trạng thái output-real/output trước full suite và toàn bộ filesystem/cache trước build; thiếu baseline nên không tuyên bố không đổi.
- **NEEDS_VERIFICATION:** handling conflict khác scope overlap, authority rank, duplicate IDs, supersession cycle và timestamp tương lai; chưa chạy mọi tổ hợp. Không kết luận an toàn từ các probe hữu hạn.
- `turningRadiusMeters`, overallLength, allowsBridges/Tunnels, allowedHighwayTypes và approach/departure không được evaluator sử dụng đầy đủ. Task 5B.1 có chỗ định nghĩa geometric là gradient, chỗ yêu cầu nhiều năng lực: cần chốt semantics, tránh coi 8 nhãn criterion là đủ mọi năng lực xe.
- Hợp đồng Half-Even và đề xuất Math.round của chính tài liệu mâu thuẫn; phải giải quyết đặc tả trước khi chứng minh đồng nhất ngôn ngữ.

## 15. Missing Tests

Danh sách đề nghị cho corrective patch; **không thêm/sửa test trong đợt audit**:

1. Production 8/8 baseline khi PKI không cấu hình; forged profile signature và evidence INVALID_SIGNATURE/UNTRUSTED/expired/revoked certificate; đổi TEST/MOCK/SYNTH authority thành whitelist vẫn không thể tạo trust.
2. Bỏ flag/default false, synthetic profile/evidence và consumer production: không được nhận output production-approved hoặc status bị hiểu sai là production authorization.
3. Profile status REVOKED độc lập provenance, expired/not-yet-effective, unknown enum, mismatch profileVersion, missing registry/reference/officer; tất cả full 8/8.
4. evaluatedAt invalid/NaN/date-only/timezone sai, thời gian biên bằng validUntil, caller backdating; future evidence và validFrom.
5. Graph artifact invalid/mismatch, graph version/profile/policy version mismatch, geometry tamper/reverse reuse và endpoint-node mismatch.
6. Supersession invalid/revoked/expired/unsigned/older/equal timestamp/wrong point/wrong criterion/self/cycle/duplicate ID; tồn tại PASS độc lập cũng không được xóa FAIL cũ bằng record không hợp lệ.
7. Exemption authority bất kỳ, signature invalid, missing identity/details, justification sai, bridge metadata thiếu/false, bridge=true/tunnel=true, existing valid FAIL; terrain có incline/mountainous và positive highway proof.
8. Coverage cạnh 0/negative/NaN/40/50/50.1m, point ngoài bounds, spans thiếu/overlap/gaps; cả tám criterion; full-edge statement mâu thuẫn chokepoint.
9. Numeric ±Infinity/NaN, overflow bounds, negative/zero uncertainty, units cm/kg/t/% sai criterion, boolean/categorical contradictions, profile dimensions/capabilities invalid.
10. FAIL+CONFLICT và INDETERMINATE+CONFLICT đa nhóm, conflict cùng nhóm có FAIL_CERTAIN; giữ mọi diagnostic invalid/revoked/expired/conflict.
11. 7/8 thật với bảy SATISFIED và một MISSING; không dùng evidence=[] thay thế.
12. Half-even exact tie ±0.00390625, decimal tie, ±0, subprecision collapse, delimiter ID collision, malformed geometry/FWD; cross-language golden vectors và 10.000 tọa độ.
13. Serialize collection unsorted/duplicates/non-string; thứ tự evidence hoán vị, IDs trùng, earliest expiry, toàn bộ output và deep immutability.
14. Các spec tích hợp 5B.1 17–20: router legacy thực, sidecar byte tamper, offline revocation >72h, bounded corridor UCS; ghi rõ ngoài scope nếu hoãn.
15. Test CLI luôn ghi temp riêng; không đè BaseRoadGraph/Manifest dùng chung; không dùng fixture PRODUCTION làm artifact phân phối.

## 16. Final Acceptance Decision

**FAIL.** Có các đường production approval bypass/false-safe được xác nhận. Test PASS không đáp ứng tiêu chí nghiệm thu khi các cổng trust, graph identity, thời hạn, supersession và coverage chưa đóng. Production isolation của module đã được kiểm tra ở mức tham chiếu source, nhưng artifact bất biến toàn phiên không được chứng minh do tác dụng phụ full suite.

Phân biệt bằng chứng:

- **Đã kiểm chứng độc lập:** số suites/tests/exit, hash vectors, hash/count/status local sau test, source gates, các kết quả probe và hiện trạng Git ban đầu.
- **Chỉ trong báo cáo Antigravity hoặc bị bằng chứng hiện tại bác bỏ:** đầy đủ 20 specs, sorted unique serialization được cưỡng chế, khóa SemVer, mọi artifact bất biến, runtime trust đủ, kết luận PASS.
- **Chưa thể xác minh:** remote production, PKI/khảo sát thật, cross-language Kotlin, loader version gate end-to-end, lịch sử ai sửa file dirty, artifact trước full test.

## 17. Task 5C.2 Readiness

**KHÔNG ĐỦ ĐIỀU KIỆN.** Không đề xuất tích hợp Qualification Engine vào importer/Android hoặc phát hành sidecar trước corrective patch xử lý F01–F09 và kiểm toán lại. Không nâng cạnh thật lên VERIFIED_COMPATIBLE; giữ cổng strict routing và hazard độc lập.

## 18. Recommended Corrective Actions

Ưu tiên đóng production trust fail-closed khi thiếu verifier; sửa supersession/exemption để không xóa confirmed failure; xác thực profile/graph/time/finite units và coverage trước kết luận. Sau đó chốt canonical identity/rounding/policy version, bổ sung tests hành vi độc lập và cập nhật tài liệu đúng thực tế. Cô lập test CLI khỏi artifact dùng chung trước lần full-suite audit tiếp theo.

Kiểm toán không sửa production source, không chỉnh unit tests, không tự sửa lỗi, không thay database/env, không commit/push, không triển khai Task 5C.2. Chỉ tạo báo cáo Markdown này; build/test đã có các tác dụng phụ filesystem được khai báo ở mục 10–11, không tự xóa/reset/khôi phục.
