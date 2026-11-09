# PHASE 5 – TASK 5C.1R: CODEX REMEDIATION REPORT

Ngày: 05/11/2026, Asia/Bangkok. Backend: `/home/vantri/AndroidStudioProjects/canh-bao-thien-tai-backend-app`.

## 1. Executive Summary

**CONDITIONAL PASS cho remediation trong phạm vi engine bị khóa. Không nghiệm thu khả năng qualification production và chưa sẵn sàng tích hợp Task 5C.2.**

Các đường false-safe đã tái hiện trong F01–F08 hiện bị chặn. `EdgeQualifier` không có đường trả VERIFIED_COMPATIBLE hay production approval, kể cả đủ 8/8, signature tự khai VERIFIED_TRUSTED, flag true/false/bỏ trống hoặc caller gửi một object “trusted context”. Kết quả luôn mang `purpose=DIAGNOSTIC_ONLY`, `trustStatus=UNAVAILABLE`, `qualificationStatus=UNVERIFIED`, `isProductionApproved=false`. Hai thuộc tính cuối được giới hạn bằng literal types trong contract.

Đây là cơ chế từ chối có chủ đích theo yêu cầu khi thiếu hạ tầng tin cậy, không phải PKI giả. Số đo vẫn được kiểm tra và đánh giá để giữ khả năng chẩn đoán. `untrustedAssessmentState` chứa kết quả kỹ thuật chưa xác thực; nó không phải trạng thái được phép dùng định tuyến. Failure chưa xác thực cũng không được biến thành một confirmed BLOCKED.

Kết quả cuối: **226/226 qualification tests, 100/100 importer tests, 538/538 backend tests trên 28 suites PASS**; typecheck importer và Nest build exit 0. Có **199 regression cases mới** bên cạnh 27 qualification cases cũ đã hiệu chỉnh. Hai vector V1 được bảo tồn; hai vector V2 và sáu vector Half-Even được kiểm chứng độc lập bằng Python.

**20 artifact và 8 source/CLI ngoài phạm vi sửa không đổi cả SHA-256 lẫn mtime_ns** từ baseline trước mọi chỉnh sửa đến sau full suite. Không tạo artifact mới trong các thư mục output được bảo vệ. Không sửa importer/CLI production, Android/UCS/database/env; không tích hợp engine, không commit/push/deploy.

## 2. Baseline Git Status

Đã chạy pwd, git status --short, git diff --check trước chỉnh sửa. Diff check exit 0. Các thay đổi có sẵn:

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

Không tìm thấy AGENTS.md bằng tìm kiếm repository; các thư mục cha đã được kiểm tra trong phiên audit trước. Đọc lại mã và bốn tài liệu yêu cầu; không lấy số dòng cũ làm căn cứ sửa. SHA-256 năm module trước sửa khớp snapshot trong audit trước, gồm qualifier `2bfa96ec634f14436b915ccf5ecb95b2765d32fe70c7613719334aec451ec550`, validation `515438380deebb7e85568388442068e79fa64812152b1d133a2575743fdda4bd`, evidence `89bf07b9374cf03b04edbd48e36179a89b1769545f2094d971b6d1be620d2cbb`. Các lỗi chưa được sửa trước task này.

Không reset/restore/clean thay đổi của người dùng. Hash và mtime_ns artifact được lấy trước khi chạy bất kỳ test nào trong Task 5C.1R; đây là khác biệt quan trọng so với giới hạn baseline trong audit cũ.

## 3. Source Files Modified

Đường dẫn dưới đây tương đối với Backend:

| File | Thay đổi |
|---|---|
| tools/osm-importer/src/qualification-types.ts | Version/policy/binding, input provenance là khai báo, output diagnostic literal types |
| tools/osm-importer/src/qualification-geometry.ts | V2 length prefix, strict direction, Half-Even, reject degenerate sau quantization, legacy oracle |
| tools/osm-importer/src/qualification-validation.ts | Schema, required fields, enums, finite numbers/bounds/thresholds, UTC time, units, spatial scope, binding |
| tools/osm-importer/src/qualification-evidence.ts | Không áp dụng supersession/exemption chưa xác thực; giữ evidence và diagnostics; tách technical assessment |
| tools/osm-importer/src/edge-qualifier.ts | Khóa production mọi mode, validate đầu vào và diagnostic output, không nhận unlock context |
| tools/osm-importer/test/edge-qualifier.spec.ts | Giữ 27 scenario, sửa assertions trái trust contract, 7/8 thực, legacy vector và supersession regression |
| tools/osm-importer/test/osm-importer.spec.ts | Chỉ sửa thiết lập output/readback/cleanup và guard artifact isolation; giữ 100 test nghiệp vụ |
| tools/osm-importer/test/qualification-fixtures.ts | File mới: factories tách ra, IDs xác định, arrays canonical, units và bindings đúng, full 8/8 baseline |
| tools/osm-importer/test/qualification-remediation.spec.ts | File mới: 199 regression cases F01–F12 |
| tools/osm-importer/test/qualification-geometry-golden.json | File mới: hai vector V2 có canonical string và SHA-256 độc lập |
| tools/osm-importer/test/verify-qualification-golden.py | File mới: oracle Decimal/hashlib độc lập, standard library |
| docs/PHASE5_TASK5C1_IMPLEMENTATION_REPORT.md | Hiệu chỉnh các tuyên bố trust/coverage/nghiệm thu cũ |
| docs/PHASE5_TASK5C1R_CODEX_REMEDIATION_REPORT.md | Báo cáo này |

Build có ghi lại `dist/` và incremental `tsconfig.build.tsbuildinfo` như hành vi công cụ có sẵn; tsbuildinfo đã dirty từ baseline. Jest có thể ghi cache mặc định. Không sửa cấu hình build hoặc chủ động xóa cache/artifact của người dùng. Báo cáo audit Codex cũ giữ nguyên.

## 4. F01–F14 Remediation Matrix

Quy ước: các file source trong bảng nằm dưới `tools/osm-importer/src/`, test trong `tools/osm-importer/test/`. FIXED nghĩa là lỗ hổng đã xác nhận bị đóng trong phạm vi hiện tại, không có nghĩa đã triển khai PKI hoặc cấp phép vận hành. Các test name là tên/pattern trong Jest đã chạy.

| ID | File/function | Root cause | Correction | Regression test name / evidence | Kết quả | Remaining risk | Status |
|---|---|---|---|---|---|---|---|
| F01 | edge-qualifier.ts / qualifyEdge; validators | Tin enum/name của payload và default test mode | Không có đường unlock; literal diagnostic result; kiểm tra signature khai báo nhất quán nhưng không dùng làm authenticity | `8/8 with requireProductionApproved=%s stays diagnostic`; `evidence signature %s cannot mint trust`; `renaming %s to whitelist never authenticates survey`; caller-created context | PASS | Chưa có PKI; gate giữ khóa | FIXED |
| F02 | qualification-evidence.ts / resolveCriterionEvidence | Bỏ OLD trước xác thực NEW | Không áp dụng mọi supersession khi chưa có verifier; giữ OLD; ghi self/cycle/target/time diagnostics | `%s replacement leaves old failure diagnostic`; `revoked invalid replacement cannot erase OLD...`; `%s reference cannot remove any record` | PASS | Chưa hỗ trợ supersession có thẩm quyền thực; từ chối thay thế thay vì giả lập | FIXED |
| F03 | validation/evidence / validateNotApplicableEvidence, resolver | Exemption giả early-return trước FAIL | Validate identity/binding/policy/authority/justification/time/metadata; không áp dụng exemption chưa xác thực | `untrusted exemption %j does not hide a load failure`; `metadata %j cannot establish no-bridge exemption`; terrain highway schema | PASS | Chưa có verified structure metadata/PKI; không có NOT_APPLICABLE production | FIXED |
| F04 | validation/evidence / validateSpatialScope, resolver | Ngưỡng 50m và scope không bounds | Length/offset/span finite và bounds; cả tám criterion yêu cầu declared full coverage; trust coverage vẫn khóa | `length %s never exempts point coverage`; `scope %j is invalid`; `discontinuous spans...`; `full-edge labels...` | PASS | Nhãn full-edge không được chứng nhận; contiguous spans chưa dùng để cấp qualification | FIXED |
| F05 | validation / isValidIsoTimestamp; qualifier/resolver | Date.parse(NaN) làm mọi so sánh false | UTC format chặt, date round-trip, closed validity interval; không có trusted clock thì không cấp approval | `invalid time %s...`; `closed validity interval...`; `backdating cannot turn expired evidence...` | PASS | Caller time chỉ phục vụ diagnostic; chưa có trusted clock | FIXED |
| F06 | validation / validateVehicleProfile | Không bắt status REVOKED/time/version và thiếu required fields | Kiểm tra toàn bộ profile/provenance schema, ACTIVE requirement, version/time/status/finite capabilities | `profile status %s with full 8/8...`; `provenance %s mismatch...`; `missing provenance %s...`; finite profile fields | PASS | Approved configuration và legal approval thực cần verifier tương lai; status không tạo trust | FIXED |
| F07 | qualifier/types/validation / qualifyEdge, commonEvidence | Graph identity chỉ được copy | Kiểm tra format và binding graph/hash/policy/profile; context/artifact trust không có thì từ chối production | graph hash/version/policy tests; evidence binding mismatch; wrong direction reuse; profile provenance mismatch | PASS | Chưa có trusted loader/graph membership; output là diagnostic, không certificate | FIXED |
| F08 | validation/evidence / validators, evaluateEvidenceMeasurement | Infinity/NaN/units và overflow lọt so sánh | Finite numbers cho mọi trường bắt buộc, bounds/threshold overflow; units theo criterion; boolean logic riêng | invalid value/uncertainty/unit; `computed interval overflow...`; `finite dimensions with overflowing threshold...` | PASS | Không tự chuyển đổi cm/kg; domain policy chi tiết có thể cần mở rộng trước production | FIXED |
| F09 | geometry / validateIdentity, canonical builder | Delimiter collision và Boolean(undefined) | ASCII node grammar, length prefix V2, boolean thực, version binding; old hash-version bị từ chối | delimiter ID/direction/OSM grammar tests, V1/V2 golden, wrong-way reuse | PASS phần canonical | Endpoint-node registry chưa có; trusted graph gate khóa nên không tạo false-safe | PARTIAL |
| F10 | geometry / formatCoordinate | toFixed không Half-Even; spec mâu thuẫn | Exact decimal của Number.toString(), BigInt scale và Half-Even; version hóa hành vi | Half-Even/tie/negative zero/WGS84 tests; Python 2 hash + 6 rounding vectors | PASS TypeScript/Python | Kotlin parity/10.000 tọa độ chưa chạy | PARTIAL |
| F11 | validators/resolver/qualifier | Partial cast thay schema, arrays/duplicates/conflict/diagnostics thiếu | Object guards + exhaustive field checks trước trả typed value; reject arrays không canonical; sorted unique diagnostics/IDs; boolean conflict; giữ lý do độc lập; degenerate quantized | required fields, arrays, duplicate IDs, boolean contradiction, multi-group diagnostics, permutation/freeze, malformed runtime input | PASS | Chỉ chứng minh các schema/đường đã kiểm tra; không khẳng định toàn bộ dữ liệu thế giới thật đúng | FIXED |
| F12 | qualification tests | Tests rỗng/thiếu cổng, acceptance IDs lệch | Baseline 8/8, 199 regression cases; sửa 27 case cũ theo trust contract; integration được hoãn rõ | 226/226 qualification cases PASS; assertions về nguyên nhân và technical assessment | PASS unit scope | Android/sidecar/UCS acceptance DEFERRED_TO_INTEGRATION | PARTIAL |
| F13 | osm-importer.spec.ts / hooks, fixtureOutput | CLI test dùng shared output và phụ thuộc thứ tự | mkdtemp riêng từng test, output override, readback tự tạo fixture, cleanup chỉ owned root; before/after artifact guard | 100 importer cases PASS; hooks guard; so 20 artifact hash+mtime trước/sau full suite | PASS | Không kiểm chứng literal no-argument default output path bằng ghi file; giữ default mode coverage qua output override | FIXED |
| F14 | docs implementation report | PASS/20 specs/production claims vượt chứng cứ | Viết lại báo cáo theo trạng thái thực, phân biệt triển khai/test/production/deferred | Đối chiếu báo cáo với lệnh, số test, source và hash baseline/final | Đã kiểm chứng tài liệu | Không biến tài liệu lịch sử 5B.1 thành bằng chứng thực thi | FIXED |

Không đánh dấu FIXED phần endpoint verification, Kotlin hoặc integration chưa thực thi. Không có PKI/loader/clock thật được tạo giả trong task này.

## 5. Confirmed Root Causes

Gốc vấn đề là nhập nhằng giữa dữ liệu khai báo và kết quả xác minh, cộng với việc cho phép test mode phát ra cùng trạng thái VERIFIED_COMPATIBLE. Bảng authority chỉ là policy về tên, hash đúng format chỉ là chuỗi, enum chữ ký chỉ là lời khai. Không yếu tố nào trong ba yếu tố đó tự chứng minh bên phát hành hoặc artifact.

Supersession được xử lý trước validation; exemption trả về trước đọc failure; timestamp NaN làm mất expiry; profile/version/graph thiếu kiểm tra; coverage dựa vào ngưỡng chiều dài; numeric validators thiếu finite/unit. Canonical string không injective trên miền ID được chấp nhận, và toFixed lệch Half-Even. Suite cũ thiếu negative tests đủ 8/8 nên không phát hiện các vấn đề này.

## 6. Exact Fixes Applied

Thứ tự triển khai ưu tiên đóng cổng trust/time/profile/graph/numeric, rồi xử lý evidence và deterministic contract. Không thêm tính năng tích hợp mới.

### Trust boundary và output

- `ProductionTrustRequirements` chỉ mô tả các phụ thuộc tương lai: PKI, artifact/endpoint verification, authoritative coverage, trusted clock. Nó không phải credential, không có factory mint credential, không phải input của qualifier.
- `requireProductionApproved` chỉ giữ tương thích chữ ký API cũ; mọi giá trị đều không mở cổng. Không có test seam cho phép mint VERIFIED.
- Bốn lý do luôn có: PRODUCTION_TRUST_UNAVAILABLE, TRUSTED_GRAPH_CONTEXT_UNAVAILABLE, TRUSTED_CLOCK_UNAVAILABLE, AUTHORITATIVE_SURVEY_COVERAGE_UNAVAILABLE.
- Tách `state` khỏi `untrustedAssessmentState`. Technical PASS/FAIL giữ measurementDecision và lý do, nhưng state vẫn INDETERMINATE; không có SATISFIED/NOT_APPLICABLE/FAILED được xác nhận từ payload chưa chứng thực.
- Vì chưa có nguồn nào được module xác thực, hiện không có confirmed failure để phát BLOCKED. Điểm nghẽn nghi ngờ vẫn giữ `untrustedAssessmentState=FAILED`, không bị evidence mới tự xóa và edge vẫn UNVERIFIED.

### Schema, validity và binding

- Validator nhận unknown, dùng object/primitive guards; không dùng `Partial<T>` như schema. Typed value chỉ xuất hiện khi toàn bộ schema liên quan đã qua kiểm tra; kiểm tra cấu trúc này không tạo trust.
- Profile có required dimensions/mass/capabilities, booleans, sorted unique string arrays, provenance fields, status/version/validity và computed-threshold overflow checks.
- Evidence có required IDs/document/time/scope/status, strict units (`m`, `t`, `%`, `boolean`, `enum`), finite value/uncertainty/bounds và valid measurement time. Boolean/categorical conflicts được xét riêng, không dùng khoảng numeric giả.
- Timestamp nhận UTC Z với không có fraction hoặc đúng ba chữ số millisecond; reject date-only, thiếu zone, zone offset, ngày không tồn tại, 24:00. Khoảng validity là đóng `[from, until]`; đúng validUntil chỉ còn giá trị diagnostic nếu chưa có trust.
- Input binding mới: graphVersion, graphArtifactSha256, geometryHashVersion, qualificationPolicyVersion. Provenance.profileVersion phải khớp profileVersion; profile ID/version đi vào output diagnostic, không cho output được coi certificate của configuration khác.
- Policy hiện tại là `5C1R-locked-v1`. Không nâng graph contract/artifact production. Input policy bị bỏ trống chỉ dùng policy khóa hiện tại cho diagnostics; không được suy thành một approved policy.
- Evidence IDs là opaque non-empty archive identifiers; comment cũ ghi UUID đã được hiệu chỉnh để phù hợp contract thực tế và các fixture EVID-*.

### Evidence và diagnostics

- Không loại bỏ bất kỳ record nào vì supersedesEvidenceId khi thiếu verifier. Link tự tham chiếu/vòng lặp/không có target/không mới hơn có lý do riêng. Record không hợp lệ/bị thu hồi không có quyền thay đổi record cũ.
- Exemption được kiểm tra đầy đủ hơn nhưng không áp dụng dù schema đúng và bridge=false. Có failure song song thì failure kỹ thuật vẫn được giữ.
- Offset/span phải hữu hạn, không âm, không vượt cạnh; full-edge không được kèm offset mâu thuẫn. Point/spans không tự chứng minh bao phủ. Bỏ cơ chế miễn coverage vì length<=50 cho toàn bộ tám tiêu chí.
- Conflict được phát hiện trong từng nhóm trước tổng hợp. Failure ở nhóm độc lập ưu tiên conflict như đặc tả, nhưng diagnostics của cả hai vẫn còn. Không lấy trung bình để xóa bottleneck.
- Các mảng output diagnostics/IDs được sort/dedup; input arrays không canonical bị từ chối thay vì âm thầm sửa payload. Không mutate graph/profile/evidence.

## 7. Regression Tests Added

File `qualification-remediation.spec.ts` có 199 Jest cases sau khai triển test.each. Các nhóm bao gồm F01/F07 trust và identity; F05/F06 time/profile; F08/F11 numbers/units/schema; F02 supersession; F03 exemption; F04 coverage; F09/F10 geometry/rounding; F11/F12 diagnostics/determinism/immutability.

Baseline `createCompleteInput()` có đúng tám criterion với geometry đúng, profile schema phù hợp, graph hash format hợp lệ, policy/hash-version đúng, SI units đúng, thời hạn hợp lệ và declared full-edge coverage. Đây là fixture kỹ thuật, không phải trust context. Negative cases giữ baseline và thay điều kiện được kiểm tra; các ca reproduction tổ hợp được ghi rõ như revoked replacement + independent PASS hoặc expired evidence + invalid time.

27 case cũ không bị loại bỏ để giảm failure: đã sửa các kỳ vọng trái trust contract và bổ sung kiểm tra technical assessment. Case 09 dùng bảy criterion thực thay vì evidence=[]; case 24 giữ điểm OLD và yêu cầu failure diagnostic không bị xóa. Các test profile mới luôn dùng 8/8; không dùng status UNVERIFIED từ evidence rỗng làm bằng chứng cổng hoạt động.

Acceptance specs 5B.1 17–20 (legacy Android routing, sidecar byte tampering, offline revocation 72h, bounded corridor UCS) được đánh dấu **DEFERRED_TO_INTEGRATION** trong test source và báo cáo triển khai; không tạo test.skip hoặc test giả để tính chúng là PASS. Positive terrain exemption chỉ được kiểm tra schema và việc không áp dụng khi thiếu trust.

## 8. Independent Reproduction Results Before/After

“Before” lấy từ audit Codex đã thực thi trên cùng SHA-256 source trước task, không phải một full-suite baseline mới: task này không chạy full suite trước khi sửa F13. Sau sửa, ngoài regression tests còn có 11 lời gọi Node từ stdin, transpile source trong bộ nhớ bằng TypeScript đã cài, không mock engine hoặc ghi artifact.

| Reproduction | Before audit | After runtime probe |
|---|---|---|
| Full 8/8, self-claimed trusted profile/evidence | VERIFIED_COMPATIBLE / production=true | UNVERIFIED / false; technical PASS tách riêng |
| Evidence INVALID_SIGNATURE | VERIFIED_COMPATIBLE / true | UNVERIFIED / false; criterion INVALID |
| Caller flag false | Có thể VERIFIED_COMPATIBLE | UNVERIFIED / false |
| OLD failure + revoked replacement + independent PASS | VERIFIED_COMPATIBLE / true | UNVERIFIED / false; OLD technical FAILED còn |
| Fake exemption over failed load | VERIFIED_COMPATIBLE / true | UNVERIFIED / false; load technical FAILED còn |
| Short edge 40m + point offset9999 | VERIFIED_COMPATIBLE / true | UNVERIFIED / false; scope INVALID |
| Invalid evaluatedAt + expired records | VERIFIED_COMPATIBLE / true | UNVERIFIED / false; INVALID |
| Profile REVOKED | Có thể VERIFIED_COMPATIBLE | UNVERIFIED / false; INVALID |
| Graph empty version / NOT_A_HASH | VERIFIED_COMPATIBLE / true | UNVERIFIED / false; INVALID |
| Height Infinity | VERIFIED_COMPATIBLE / true | UNVERIFIED / false; INVALID |
| Height unit cm treated as m | Không từ chối đơn vị | UNVERIFIED / false; INVALID |

Runtime probe sau sửa exit 0. Một lần thử probe bằng ts-node trước đó exit 1 do TS5011/rootDir với TypeScript 6; không sửa tsconfig hoặc bỏ qua lỗi typecheck. Chuyển riêng probe sang transpileModule in-memory; lệnh typecheck chính thức chạy độc lập vẫn PASS.

## 9. Production Trust Gate Verification

Đã test flag true/false/omitted, tám criterion đủ, profile tự khai trusted, invalid signature/issuer/certificate, TEST/MOCK/SYNTH đổi thành whitelist và object context caller tự dựng. Không có ca nào tạo approval. Gate không dựa vào boolean hoặc enum do caller cấp; implementation trả literal UNVERIFIED/false và không có phương thức cấp trust.

`validate...valid=true` chỉ có nghĩa schema nhất quán. Tên authority được whitelist vẫn chưa chứng minh người phát hành; nhãn full-edge vẫn chưa chứng minh đã khảo sát. Các lời khai này chỉ giúp chẩn đoán, không điều khiển cổng production.

## 10. Evidence Supersession & Exemption Verification

Supersession bị từ chối áp dụng với REVOKED, invalid signature, ATTACKER, ngày cũ/bằng nhau, khác criterion/edge/vị trí, self-reference, cycle và schema đúng nhưng thiếu verifier. Bằng chứng cũ không bị xóa khỏi input hoặc khỏi tập đánh giá bởi link thay thế. Hai record cùng vị trí mâu thuẫn có thể cho CONFLICTING; đây vẫn là UNVERIFIED, không phải xác nhận đã sửa bottleneck.

Exemption ATTACKER/INVALID_SIGNATURE/thiếu graph binding/justification sai, metadata undefined hoặc bridge=false/true/tunnel=true đều không thể tạo NOT_APPLICABLE production. Một exemption schema đúng cho motorway cũng không được áp dụng nếu chưa xác thực nguồn. Failure kỹ thuật song song được bảo tồn. Chưa thực hiện lawful supersession/exemption acceptance vì không có hạ tầng chứng thực đủ điều kiện; không giả lập một nhánh thành công.

## 11. Canonical Hash & Rounding Verification

V2 format:

```text
edge-geometry-v2-decimal-half-even|EDGE:<ascii-length>:<from>-><ascii-length>:<to>|FWD:<boolean>|GEO:<fixed7-coordinates>
```

IDs chỉ nhận `[A-Za-z0-9_]+`; delimiter không nằm trong grammar. Length prefix được version hóa; ASCII length tương ứng UTF-8 byte length. `node_osm_123` của importer được test. Từ chối direction undefined/number/string, không ép Boolean. Geometry giữ thứ tự lưu, không đảo reverse thêm lần nữa. Mọi đỉnh được kiểm tra WGS84/finite; geometry co về một điểm sau quantization bị từ chối.

| Vector | Hash |
|---|---|
| V1 forward legacy | `ec4e64d4bb52b82cea9f823977467113476764cb436e1d334eba79bd7264ad6b` |
| V1 reverse legacy | `4fbd28765fcf2475ff508fb3c68d2cf3d60bda1907dde43fd5eec28d26253a06` |
| V2 forward | `8f19eaa5fc2d11584bdb48be8bd3b38da80aba6805d6a6610c7da43298eea357` |
| V2 reverse | `9730833f82e5f86abb5766169c8a7e19db99e7a83781643efd88b580e7c75488` |

V1 chỉ dùng compatibility oracle/golden fixtures, không được engine dùng để chấp nhận evidence. V2 evidence phải khai đúng geometryHashVersion. Không chuyển đổi hoặc nâng bất kỳ artifact production nào.

Rounding duy nhất trong V2: lấy decimal chính xác của `Number.toString()`, parse mantissa/exponent thành BigInt, scale 7 chữ số, tie về chẵn, sau cùng chuẩn hóa negative zero. Không dùng Math.round(x*1e7) hoặc toFixed trong V2. Legacy oracle giữ toFixed riêng để bảo tồn hai vector lịch sử.

Ví dụ ±0.00390625 => ±0.0039062; ±0.00390635 => ±0.0039064; ±0.00000005 => 0.0000000. Golden JSON chứa canonical và hash đã tính độc lập. Lệnh `python3 tools/osm-importer/test/verify-qualification-golden.py` dùng Decimal ROUND_HALF_EVEN/hashlib, không import TypeScript: **2 hash vectors + 6 rounding vectors PASS**.

Chưa chạy Kotlin/BigDecimal hoặc cross-validation 10.000 tọa độ; chưa khẳng định parity. Endpoint đúng node/graph membership phải được trusted loader tương lai kiểm chứng; hiện gate thiếu loader bị khóa.

## 12. Artifact Isolation Verification

Trước sửa đã lưu danh sách, SHA-256 và mtime_ns của toàn bộ 20 file dưới năm thư mục output hiện có. Không xóa/ghi đè artifact để chuẩn bị test.

Trong importer spec:

- beforeEach tạo `mkdtemp` dưới `os.tmpdir()` cho riêng test đó.
- Mọi runCli có output override tới owned fixture/real/custom directory; test lỗi input cũng có temp output path.
- Các test readback tự tạo fixture trong temp nếu cần, không dùng sản phẩm test khác hoặc output cũ.
- afterEach chỉ remove owned temp root. Không cleanup repository output.
- afterAll so hash+mtime artifact được bảo vệ với snapshot đầu suite.
- Không sửa cli.ts để đạt isolation. Case default CLI mode được kiểm tra qua output override; không kiểm tra bằng cách cho literal runCli() ghi thư mục mặc định dùng chung.

Đã chạy riêng importer 100/100 trước full suite, rồi so hash/mtime không đổi. Chỉ sau khi xác nhận này mới chạy toàn bộ backend. So sánh cuối phiên tiếp tục cho **20/20 artifact không đổi hash lẫn mtime_ns, không có artifact mới**; thêm **8/8 source/CLI ngoài phạm vi không đổi**. Danh sách chi tiết và hash trước/sau nằm ở phụ lục cuối báo cáo.

Đồ thị dryrun Đà Nẵng vẫn khớp hash yêu cầu `1b7f64a965a763624e0a6c2cd866352fc3ef5f106214907866d0c6dcb49c25b4`. Các artifact khác có hash khác được giữ nguyên, không tự xem `output-real` fixture là dữ liệu thực địa. Task này không khôi phục tác dụng phụ của audit trước vì không có baseline trước audit đó và không được sửa artifact.

## 13. TypeScript Build Results

| Kiểm tra cuối | Kết quả | Exit |
|---|---|---:|
| `npx --no-install tsc --project tools/osm-importer/tsconfig.json --noEmit` | PASS, gồm source/tools tests/CLI theo config thực tế | 0 |
| `npx --no-install nest build` | PASS | 0 |
| `git diff --check` | PASS, không output lỗi | 0 |

`--no-install` chỉ buộc dùng dependency có sẵn. Không cài gói hay sửa tsconfig. Build Nest tự nó không typecheck tools; vì vậy đã chạy typecheck importer riêng. Không đo thời gian build/typecheck riêng bằng đồng hồ; không suy ra thời gian từ một lần tool yield.

Trong quá trình sửa, typecheck từng bắt lỗi Object.hasOwn không thuộc ES2021 và inference Record rỗng; đã sửa implementation theo target hiện có, không nâng target để che lỗi. Nó cũng bắt lỗi test.each arrays; bảng test được sửa để truyền cả array và geometry thay vì nhầm chúng thành các tham số rời.

## 14. Full Test Results

| Lần kiểm tra | Suites / cases | Thời gian Jest | Exit |
|---|---|---|---:|
| Baseline lịch sử audit trước | 27 suites / 339 tests PASS, qualification 27 | 13.131s full; 0.166s riêng | 0 |
| Qualification sau sửa cuối | 2 suites / 226 tests PASS | 0.818s | 0 |
| Importer isolation riêng | 1 suite / 100 tests PASS | 1.387s | 0 |
| Full backend sau xác minh F13 | 28 suites / 538 tests PASS | 13.508s | 0 |

Lệnh qualification: `npm test -- --runInBand --runTestsByPath tools/osm-importer/test/edge-qualifier.spec.ts tools/osm-importer/test/qualification-remediation.spec.ts`.

Lệnh importer: `npm test -- --runInBand --runTestsByPath tools/osm-importer/test/osm-importer.spec.ts`.

Lệnh full: `npm test -- --runInBand`.

Không có skipped tests được Jest báo trong các kết quả cuối; snapshots 0. Full suite vẫn có ExperimentalWarning VM Modules và cảnh báo mock Firebase projection failed cho sos-1/debug firebase unavailable, như audit trước. Importer riêng có log CLI và expected error non_existent_file.xml, không phải một test failure. Không gọi Firebase/R2 production để xác minh trust.

Các lần chạy trung gian đã có failure và được giữ nguyên ý nghĩa: test expiry cũ vừa expired vừa measurement-after-expiry nên INVALID theo schema mới (fixture được chỉnh để cô lập expiry); geometry mismatch nay INVALID thay vì MISSING; callback test malformed-input vô tình return object thay vì void được sửa. Những sửa này không thay production logic để ép PASS. Cuối cùng assertions kiểm tra cả nguyên nhân lỗi, field diagnostic và failure cũ được giữ, ngoài status không được verified.

## 15. Remaining Risks

1. PKI/trust registry/chứng cứ khảo sát/metadata công trình/trusted loader/trusted clock chưa có. Sản phẩm không cấp qualification; muốn mở lại phải thay contract, bổ sung verification thực và kiểm toán độc lập.
2. F09 endpoint verification còn thiếu; F10 Kotlin parity và 10.000 tọa độ chưa chạy; F12 integration acceptance còn deferred. Các giới hạn này không có đường mở status production trong API hiện tại.
3. Static diagnostic này không phải quyết định live routing. Hazard snapshot và safety gates Android phải giữ độc lập; task không xác minh lại toàn bộ runtime Android hoặc remote deployment.
4. Coverage policy hiện bảo thủ: chỉ declared full-edge mới có technical pass; ngay cả declared full-edge cũng không có verified state. Chưa dùng phép hợp spans để cấp chứng nhận.
5. Các khả năng xe ngoài các phép so sánh kỹ thuật hiện có như turning radius, chiều dài, bridge/tunnel allowance chưa được chứng minh đầy đủ trên graph thực. Schema kiểm tra chúng không đồng nghĩa geometry feasibility đã được xác minh. Gate vẫn khóa.
6. Không có baseline trước audit cũ để phục hồi output/output-real của phiên đó. Task hiện bảo toàn chính xác baseline hiện tại, không sửa lịch sử artifact.
7. Test hữu hạn và kiểm tra local không chứng minh mọi hệ thống bên ngoài an toàn. Không dùng lời khẳng định “100% an toàn” hoặc “đóng kín mọi lỗ hổng”.

## 16. Production Isolation Confirmation

Năm module qualification vẫn chỉ tham chiếu nội bộ và qua test; không thêm import vào Nest runtime/importer/CLI/Android. Các file importer/types có diff ban đầu nhưng giữ nguyên hash+mtime trong task. `vehicle-profile.ts`, cli.ts, oneway/haversine/turn-restriction-parser/via-way-resolver đều giữ nguyên snapshot.

Không sửa Kotlin/UCS hoặc database/Prisma, không thay env/config production/cloud, không mở strict routing. Graph/manifest/diagnostics được bảo vệ không đổi. Chỉ test artifacts trong thư mục temp do test tạo mới được tạo và cleanup; build/cache tạo file theo hành vi công cụ được nêu rõ ở mục 3. Không commit/push/deploy hoặc triển khai Task 5C.2.

## 17. Final Acceptance Decision

**CONDITIONAL PASS — remediation fail-closed.** Tất cả đường false-safe đã xác nhận có regression tương ứng và bị chặn; canonical delimiter/direction đã sửa; test isolation đã chứng minh bằng hash+mtime; không có source production ngoài phạm vi bị thay đổi.

Điều kiện còn lại là hạ tầng tin cậy và kiểm thử tích hợp, không phải một cờ cho phép caller bỏ qua. Không nâng quyết định này thành PASS cho production qualification khi PKI/loader/clock/survey còn thiếu. F09/F10/F12 được đánh dấu PARTIAL minh bạch theo phần chưa thực thi.

## 18. Task 5C.2 Readiness

**Chưa đủ điều kiện tích hợp hoặc phát hành qualification production.** Phải thiết kế và kiểm toán trusted verification boundary thực, endpoint membership, authoritative survey/coverage, clock và Kotlin golden parity; triển khai integration tests được hoãn bằng task được cho phép riêng. Không tự động thực hiện các công việc đó trong phiên này.

Đã dừng sau sửa lỗi, regression testing và báo cáo. Không bàn giao implementation cho Antigravity hoặc công cụ AI khác.

## Phụ lục — Artifact SHA-256 và timestamp baseline/final

Các bảng sau ghi snapshot lấy trước chỉnh sửa và so với sau full suite; dấu `=` nghĩa là cả hash và mtime_ns cuối khớp nguyên giá trị đầu. Timestamp dùng nanosecond epoch để tránh mất precision. Không suy rằng các artifact test khác cùng nội dung với đồ thị Đà Nẵng.

| Artifact | SHA-256 trước = sau | mtime_ns trước = sau | So sánh |
|---|---|---:|---|
| tools/osm-importer/output-danang-261103-task97/BaseRoadGraph.json | `419cf4695f735e234038da6ef14076c22ef6121bbd3dbc566eccb516ff8ccd80` | 1793795090193010010 | = |
| tools/osm-importer/output-danang-261103-task97/BaseRoadGraph.json.gz | `9792dce0abb089a230bcb79e71b2a8ff83301879d417f4fd399711ce4c3a037b` | 1793795090388006437 | = |
| tools/osm-importer/output-danang-261103-task97/ImportDiagnostics.json | `b379ddee5a99cd4054827a7b34097808c96419e8d2e447c9fd95a6abb84807ff` | 1793795090204009808 | = |
| tools/osm-importer/output-danang-261103-task97/RoutingManifest.json | `ec046a84a14cc35dbf498034e019850224c8facab2989f98f9733fced89222aa` | 1793795090396006290 | = |
| tools/osm-importer/output-danang-261103/BaseRoadGraph.json | `bae0a78e9069f96e128624758a6828e0ba10195af3687557609849af66d60a5d` | 1793791971878996797 | = |
| tools/osm-importer/output-danang-261103/BaseRoadGraph.json.gz | `9c0166f9d1fa0ad45aef4163a258d5d3d9310d3d2eb0c99e169669e77537ac5d` | 1793791972076993362 | = |
| tools/osm-importer/output-danang-261103/ImportDiagnostics.json | `4d95fe3db4a6df20cc8037801f5fba9b8f42702d07f5d8292c1296c7f9d48e31` | 1793791971890996589 | = |
| tools/osm-importer/output-danang-261103/RoutingManifest.json | `ac10c58382a1325fdafe7ef730162dd5e3ae9516c123ecf99e1384ae49349999` | 1793791972084993223 | = |
| tools/osm-importer/output-dryrun-task3b/BaseRoadGraph.json | `b9dd0caf51c722ddb432b837d1c1ad4602c03f258eca23089215145bd9c86dfa` | 1793816785873038184 | = |
| tools/osm-importer/output-dryrun-task3b/BaseRoadGraph.json.gz | `1b7f64a965a763624e0a6c2cd866352fc3ef5f106214907866d0c6dcb49c25b4` | 1793816786066038779 | = |
| tools/osm-importer/output-dryrun-task3b/ImportDiagnostics.json | `b379ddee5a99cd4054827a7b34097808c96419e8d2e447c9fd95a6abb84807ff` | 1793816785882038211 | = |
| tools/osm-importer/output-dryrun-task3b/RoutingManifest.json | `7765d94d288e279bf3607b692d5466f5e9efe53db16c0ea944e5d9b08f3183ad` | 1793816786074038803 | = |
| tools/osm-importer/output-real/BaseRoadGraph.json | `d5ea87e086e00386b4f64df983844c0488ffbadb419f964101da26ef7650e585` | 1793892167826777269 | = |
| tools/osm-importer/output-real/BaseRoadGraph.json.gz | `89b451800767e0edc0c184389b10567e50df5f479314b77f92558e5b9f4c13b2` | 1793892167827777269 | = |
| tools/osm-importer/output-real/ImportDiagnostics.json | `357564ca77ec4d158b29238f7b06738387c935e2a8df105b2a976517fdded4eb` | 1793892167826777269 | = |
| tools/osm-importer/output-real/RoutingManifest.json | `26e04b90adacdac18672f646707ded470c7c402a4cc6c8129973f656d815028f` | 1793892167827777269 | = |
| tools/osm-importer/output/BaseRoadGraph.json | `1bc5c849f7bba20274521930d43069c84c50d664ed6867a518ae02425bd52a62` | 1793892167806777263 | = |
| tools/osm-importer/output/BaseRoadGraph.json.gz | `3fe5f4acb1e88d7785de7efa7e57ba08994b7d6e419933a940b76b0725493b46` | 1793892167807777263 | = |
| tools/osm-importer/output/ImportDiagnostics.json | `a7314d615d9944df42d161d5170d52c606762d322c63eb7666beb6bcc00e0b23` | 1793892167806777263 | = |
| tools/osm-importer/output/RoutingManifest.json | `ec4e85dedd7e5041c0770a47695cecc92aa363042136a5eec1c28ac70e2adbe1` | 1793892167807777263 | = |

### Source/CLI ngoài phạm vi sửa

| File | SHA-256 trước = sau | mtime_ns trước = sau |
|---|---|---:|
| tools/osm-importer/cli.ts | `25f72442def5352fe81629a7903a70fd72abc7857483807d0096d53ef5292401` | 1793786695664590745 |
| tools/osm-importer/src/haversine.ts | `0960a2d0fd5810b39f10565dfbe368da303c2ca9fb5ca3f7cc655e65c7357f79` | 1793724305750102828 |
| tools/osm-importer/src/oneway-resolver.ts | `a3d65a9330075e1d0a4cd4966bd17040b1f1465174ba92d0b7a07569b1d83ce7` | 1793724305749660525 |
| tools/osm-importer/src/osm-importer.ts | `e85eb6fe891002a4b81b57a7e5e33ce362994b406471535d47f9dc76c197a71d` | 1793815518206310039 |
| tools/osm-importer/src/turn-restriction-parser.ts | `dbf80b9c2f5e8b8b3d257cd16f80165660681c7cd0a1538efe21ba9dc7219cf9` | 1793794905677395467 |
| tools/osm-importer/src/types.ts | `e5fa58371295405beb1444924821be3f2178d20f1f6fa10dff375820e660603f` | 1793814244473402428 |
| tools/osm-importer/src/vehicle-profile.ts | `3efc8a2692bd464ca71127520e0aed2fe60311acb15d4915d26c9540769d34b7` | 1793729013271380586 |
| tools/osm-importer/src/via-way-resolver.ts | `4e1874200575a81be956ab8682f544961e06cf05db65439d2b05ef0c54819d7b` | 1793815518262830641 |

Đã đối chiếu lại 28 timestamp nanosecond chính xác bằng chuỗi số, với giá trị gốc ghi ở output baseline, để tránh giới hạn integer của JavaScript. Kết quả 28/28 khớp; guard Jest còn so mtimeMs độc lập. Không dùng mtime thay thế SHA-256.

