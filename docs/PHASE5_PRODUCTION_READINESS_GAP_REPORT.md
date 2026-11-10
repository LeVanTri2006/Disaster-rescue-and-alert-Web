# PHASE 5 – PRODUCTION READINESS GAP REPORT

Ngày đánh giá: 06/11/2026, Asia/Bangkok. Mốc source: sau Task 5C.2D.

## 1. Kết luận và phạm vi bằng chứng

**Foundation 5C.2D: CONDITIONAL PASS trong TEST_ONLY. Demo Android–Backend: NEEDS_VERIFICATION. Hỗ trợ định tuyến cứu hộ thực tế: BLOCKED.**

Báo cáo này là kế hoạch nghiệm thu, không phải chứng nhận an toàn hoặc quyết định phát hành. Chỉ Backend repository được đọc và thay đổi trong task. Android, môi trường triển khai, cấu hình bí mật, dịch vụ cloud và dữ liệu cơ quan bên ngoài chưa được kiểm tra; trạng thái tương ứng là NEEDS_VERIFICATION. Các vai trò dưới đây là đề xuất trách nhiệm, không khẳng định cá nhân hoặc đơn vị nào đã nhận việc.

Bằng chứng thực thi: 148 tests mới; full backend 1.073/1.073 tests, 43/43 suites PASS, không skip; importer TypeScript typecheck, Nest build và golden oracle PASS. Chi tiết lệnh, phạm vi và SHA-256/mtime_ns của 76 file baseline có trong [implementation report](PHASE5_TASK5C2D_CODEX_IMPLEMENTATION_REPORT.md). Các kết quả đó chứng minh hành vi kiểm thử trong repository, không chứng minh dữ liệu vật lý hoặc PKI production.

Không sửa engine, importer, production endpoints, Android hoặc artifact graph. Bốn bất biến engine được giữ:

```text
purpose = DIAGNOSTIC_ONLY
trustStatus = UNAVAILABLE
qualificationStatus = UNVERIFIED
isProductionApproved = false
```

## 2. Những gì đã kiểm tra và giới hạn suy luận

| Bằng chứng repository | Kết quả đã xác nhận | Điều chưa được chứng minh |
|---|---|---|
| tools/osm-importer/src/edge-qualifier.ts và safety regressions | Engine diagnostic, production qualification khóa | Khả năng định tuyến cứu hộ thực tế |
| Foundation 2A, orchestration 2B, revocation/exemption 2C và tests | Native chữ ký test, graph/profile binding, provenance receipts, fail-closed và revocation độc lập | Production roots, thẩm quyền pháp lý, quyết định applicability |
| Tám module source mới 2D và bốn specs mới | Proof validation/binding, declared interval coverage, registry v3 nhiều khóa, provider contracts/readiness | Dữ liệu cơ quan thật, authoritative coverage, physical truth |
| src/routing/routing.controller.ts | GET /routing/current; JWT/Roles guards; RESCUER, ADMIN, MODERATOR | Token/role thực đi qua HTTP và Android |
| src/routing/routing.service.ts | Contract manifest 2.1.0; kết quả manifest/download/readiness; điều kiện strict readiness | Runtime graph đang phát hành; qualification modules mới chưa được nối vào endpoint |
| src/routing/storage/routing-storage.service.ts | R2/S3 adapter; manifest read; HeadObject kiểm tra compressed length; URL hết hạn 900 giây | Cấu hình R2 thực, tải byte thật và digest thực; HeadObject length không chứng minh hash |
| Routing controller/service/storage specs | Kiểm thử unit với mocks; controller gọi trực tiếp và guards được override trong test | HTTP authentication E2E hoặc kết nối cloud thật |
| test/app.e2e-spec.ts | Có scaffold GET / của ứng dụng | Không phải routing E2E; không chạy trong task này |
| output-dryrun-task3b/BaseRoadGraph.json.gz | Local graph dn_central_real_v1, contract 2.1.0; 16.651 cạnh đều UNVERIFIED; canAttemptStrictRouting=false | Không chứng minh artifact này đang được deploy hoặc dữ liệu hiện trường đúng |

SHA-256 của local gzip trên: `1b7f64a965a763624e0a6c2cd866352fc3ef5f106214907866d0c6dcb49c25b4`. Các fixture lịch sử trong output-real không được dùng làm bằng chứng production deployment.

Trong routing service, liveHazardReady dựa trên trạng thái ATTACHED và hazard version của manifest. Đây chưa phải kiểm chứng nguồn hazard trực tiếp, độ mới hoặc độ đúng tại hiện trường. Normal backend Jest run không chạy file .e2e-spec.ts thuộc cấu hình E2E riêng.

## 3. Capability matrix

Quy ước: P0 là điều kiện chặn an toàn hoặc bước cần ngay để xác định demo; P1 là bước tích hợp tiếp theo; P2 là công việc hỗ trợ sau khi chốt phạm vi. “Tested” nêu đúng cấp bằng chứng, không đồng nghĩa production verified.

| Capability | Implemented | Tested | Production Verified | Missing Dependency | Proposed Responsible Role | Acceptance Evidence | Priority |
|---|---|---|---|---|---|---|---|
| Diagnostic qualification và safety lock | Có | Regression engine và full suite PASS | Không; chủ động khóa | Chính sách và toàn bộ chuỗi chứng cứ thực trước mọi thay đổi khóa | Backend developer; Independent safety auditor | Bốn bất biến giữ nguyên trong mọi lỗi/provider outage | P0 |
| Canonical geometry V2 và graph/profile binding | Có trong foundation | Golden SHA-256, decimal HalfEven, wrong graph/direction/profile tests | Không | Kotlin parity hiện hành; nguồn graph được quản trị | Backend developer; Android developer | Cùng vectors TS/Kotlin, từ chối V1 hoặc mismatch | P0 demo |
| Legal proof contract | Có schema và binding TEST_ONLY | Thiếu reference, sai issuer/structure/criterion, hết hạn/thu hồi | Không | Legal-basis provider và căn cứ thẩm quyền/phạm vi thật | Road infrastructure data custodian; Security/PKI administrator | Hồ sơ có nguồn, bytes/chữ ký và thẩm quyền/applicability được nghiệm thu độc lập | P0 thực địa |
| Physical structure inventory | Có contract, identity/span checks | Duplicate identity, wrong structure, bridge=false có culvert, conflict | Không | Inventory cầu/cống/hầm và inspection đầy đủ theo hành lang | Road infrastructure data custodian | Đối soát graph/chainage, công trình ẩn, thời hạn và hồ sơ inspection | P0 thực địa |
| Survey provenance và coverage | Có validation và interval union | Point không full-edge; gaps, invalid span, uncertainty/unit/calibration reference, supersession | Không | Phép đo, thiết bị, hiệu chuẩn, surveyor và coverage policy thực | Survey contractor; Road infrastructure data custodian | Đo kiểm độc lập; coverage đủ từng tiêu chí; không mất bottleneck | P0 thực địa |
| Survey spatial binding | Có chainage + geographic bounding envelope | Ngoài envelope/edge và sai length bị từ chối | Không | Polyline projection, sai số vị trí, chính sách địa hình/công trình | Backend developer; Survey contractor | Cases đường cong/song song, GNSS uncertainty và đối soát thực địa | P0 thực địa |
| Multi-key registry v3 | Có đường TEST_ONLY độc lập | 53 lifecycle/security cases, native Ed25519 | Không | Root provisioning, registry/revocation authority thực | Security/PKI administrator | Nguồn registry đã duyệt, rotation/revocation drill và audit trail | P0 thực địa |
| Historical signing | Có fail-closed khi phụ thuộc thời điểm ký | Claimed signing time không cấp quyền; khóa hết quyền bị chặn | Không | Authenticated timestamp và chính sách lịch sử | Security/PKI administrator | Timestamp được xác thực; compromise cutoff và revoked-key cases được duyệt | P0 nếu cần historical acceptance |
| Snapshot anti-rollback | Có CAS/checkpoint interface và memory implementation | Rollback/equivocation/replay/fault tests | Không; PROCESS_ONLY | Durable trusted state, recovery/backup và restart policy | Backend developer; Security/PKI administrator | Crash/restart/restore/concurrent writers không giảm high-water mark | P0 thực địa |
| Nine provider interfaces/readiness | Có | 31 contract/security tests | Không; overall BLOCKED | Chín adapter thực và trust/data/config/audit evidence | Backend developer; Security/PKI administrator | Semantic verification và integration độc lập từng provider | P0 thực địa |
| Proof/orchestrator integration | Chưa cho v3 | 2D proof tests và v2 orchestration tests riêng đều PASS | Không | Adapter v3/proof vào TEST_ONLY orchestration | Backend developer | End-to-end test receipts, final-time revalidation, lỗi giữa các bước | P1 Phase 5 |
| Routing manifest/download API | Có controller/service/storage | Unit mocks PASS | NEEDS_VERIFICATION | HTTP harness, auth tokens/roles, fixture storage, runtime config | Backend developer | HTTP status/body/auth/URL/bytes/hash checks qua server thật trong test | P0 demo |
| Android consumer/offline/UI | NEEDS_VERIFICATION | Không kiểm tra Android trong task | NEEDS_VERIFICATION | Phạm vi Android riêng, loader và emulator/device harness | Android developer | Download/cache/digest/version/offline rejection, nhãn UNVERIFIED và parity | P0 demo |
| Hazard data freshness và outage behavior | Có manifest metadata checks | Chưa có bằng chứng feed thực trong task | Không | Feed có nguồn, freshness policy và operational fallback | Backend developer; Road infrastructure data custodian | Feed outage/stale/conflict drills; cảnh báo đúng trên thiết bị | P0 thực địa |
| Vehicle approval và eligibility | Có contract/provider interface | Binding/profile và provider contract tests | Không | Hồ sơ cấu hình xe được phê duyệt, tiêu chí vận hành | Vehicle approval authority | Profile đúng xe/cấu hình hiện hành, policy được ký duyệt | P0 thực địa |
| Field acceptance và release governance | Chưa được chứng minh | Chưa thực hiện trong task | Không | Hành lang thử nghiệm, quy trình và kiểm toán độc lập | Survey contractor; Independent safety auditor | Biên bản field trial, risk closure, quyết định go/no-go | P0 thực địa |

## 4. Giới hạn kỹ thuật phải giữ rõ

- Signature/hash hợp lệ chỉ chứng minh phần tương ứng của chuỗi xác thực. Legal applicability luôn UNAVAILABLE trong đường 2D; authoritative coverage và physical truth vẫn UNVERIFIED.
- Inspection/calibration/legal references mới là references. Task không tải và xác thực đầy đủ bytes hồ sơ tham chiếu, chứng nhận hiệu chuẩn hoặc danh tính surveyor thật.
- Spatial binding chỉ kiểm tra chainage và bounding envelope; không khẳng định point nằm chính xác trên polyline hay đúng công trình. Đây là blocker cho nghiệm thu hiện trường.
- Survey cũ/bottleneck không bị xóa nhờ supersession tự khai; xung đột được giữ. Chưa có cơ chế nghiệm thu thay thế chứng cứ thật.
- Registry v3 không tự migrate v2, không thay ý nghĩa signed v2 bytes và chưa nối vào orchestrator v2. Sau refresh, tài liệu gắn snapshot cũ không tự được chuyển sang snapshot mới.
- Historical signing chưa có nguồn timestamp xác thực. Chữ ký toán học đúng và timestamp trong payload không đủ để chấp nhận khóa đã hết quyền.
- Checkpoint memory chỉ bảo vệ trong process. Process mới mất high-water mark; có thể khởi tạo genesis test cũ trong state rỗng. Không coi đó là rollback protection qua restart. Factory từ chối yêu cầu durable hoặc claim external durable vì chưa có implementation được kiểm chứng.
- Provider contract runner kiểm tra cấu trúc, digest/freshness và encoding/type liên quan; không thay semantic signature verification của adapter từng nguồn. testOnlyContractVerified có thể true, nhưng testOnlyIntegrationVerified vẫn false; production flags vẫn false. Caller tự khai PRODUCTION_VERIFIED không được cấp trust.

## 5. Ba nhóm blockers và cách xử lý

### GROUP A – CODEX CÓ THỂ TRIỂN KHAI

Không cần dữ liệu production: HTTP fixture harness cho /routing/current; contract/fault tests; tải byte/hash/expired URL tests; sidecar schema validation test-only; proof/v3 orchestrator adapter; durable-store contract fault harness trước khi chọn implementation. Tất cả tiếp tục giữ khóa.

Kotlin/TypeScript parity, Android legacy loader, offline rejection và UI status checks là việc kỹ thuật có thể làm với dữ liệu mô phỏng, nhưng cần task Android được cho phép riêng. Không thực hiện trong phạm vi Backend-only của 5C.2D. Việc A có thể bắt đầu ngay sau khi giao task tương ứng, không cần giả lập thẩm quyền cơ quan thật.

### GROUP B – CẦN NGUỒN DỮ LIỆU/HẠ TẦNG BÊN NGOÀI

Cần xác lập đầu mối và quyền sử dụng dữ liệu cho: authority registry có thẩm quyền; trust roots/fingerprints qua kênh xác thực; revocation/status service; authenticated time và timestamp nếu chấp nhận historical signing; hồ sơ công trình/inspection; cấu hình phương tiện được phê duyệt; khảo sát có phương pháp, calibration và uncertainty; nguồn graph/hazard có provenance và freshness. Cần durable checkpoint infrastructure cùng quyền vận hành và khôi phục được duyệt.

Tài liệu cần có định dạng/version, issuer, phạm vi quyền hạn, effective period, chữ ký/bytes/digest, revocation reference, lịch cập nhật và người chịu trách nhiệm. Không thay những nguồn này bằng test keys hoặc OSM tags. Thiếu nguồn thì nhánh tương ứng giữ BLOCKED.

### GROUP C – CẦN NGHIỆM THU/QUYẾT ĐỊNH VẬN HÀNH

Cần phê duyệt policy eligibility của xe, từng tiêu chí vật lý/pháp lý, thời hạn evidence/reinspection, coverage và xử lý xung đột; quy trình phát hành/thu hồi/khôi phục khóa và proof; quy trình duyệt dữ liệu; hành vi mất mạng/nguồn trạng thái; đào tạo người vận hành; field trial có giới hạn; safety audit độc lập và quyết định go/no-go có trách nhiệm rõ ràng.

Nhóm B/C không thể hoàn thành chỉ bằng thêm TypeScript. Có thể chuẩn bị mẫu hồ sơ/checklist kỹ thuật song song, nhưng không tự điền kết luận thẩm quyền hoặc nghiệm thu.

## 6. MILESTONE A – DEMO / TECHNICAL PILOT

Mục tiêu là trình diễn luồng Backend–Android bằng fixture có kiểm soát và nhãn dữ liệu mô phỏng/chưa kiểm định. Không dùng làm chỉ dẫn cứu hộ thực tế. **Chưa tuyên bố đạt mốc A.**

Đã có: graph/manifest contract 2.1.0, local graph, API/storage abstraction, unit tests, diagnostic engine, test-only trust foundations. Còn thiếu bằng chứng HTTP thực, download bytes, Android loader/UI/offline và parity trên phiên bản Android hiện hành.

Acceptance checklist cho demo:

- [ ] Khởi động Backend test với fixture storage, không cần cloud production; HTTP GET /routing/current đúng schema, MIME/error semantics và trạng thái UNVERIFIED.
- [ ] Test HTTP 401/403/allowed role bằng auth harness phù hợp; không override guards rồi coi là đã kiểm tra authentication.
- [ ] Tải fixture qua download URL trong harness; kiểm tra digest/length, corruption/truncation, URL hết hạn, missing object và stale/mismatched manifest.
- [ ] Android hiện hành parse đúng graph/manifest 2.1.0; cache/update atomic; reject mismatch/unsupported version; offline không tự nâng readiness.
- [ ] TS/Kotlin canonical geometry/hash golden parity PASS, gồm direction và decimal HalfEven.
- [ ] UI hiển thị dữ liệu mô phỏng/chưa kiểm định; strict qualification vẫn khóa khi unverified/missing/stale/conflicting; screenshot/log/device test làm bằng chứng.
- [ ] Một kịch bản demo tái lập từ fixture, phiên bản source, lệnh chạy và log assertions; không phụ thuộc dữ liệu bí mật hoặc endpoint production.

Go cho demo chỉ khi checklist hoàn thành và người phụ trách chấp nhận phạm vi mô phỏng. No-go nếu UI thể hiện an toàn thật, consumer bỏ qua hash/status, hoặc offline fallback tự mở strict routing. Điểm dừng hợp lý: demo luồng tải/kiểm tra/hiển thị trạng thái và từ chối dữ liệu lỗi; chưa cần thêm mô phỏng production trust để đạt mốc này.

## 7. MILESTONE B – REAL-WORLD RESCUE SUPPORT

Mốc B **BLOCKED**. Phạm vi đầu tiên nên là một hành lang và cấu hình phương tiện được duyệt rõ ràng; không suy rộng toàn thành phố.

Điều kiện nghiệm thu bắt buộc:

- Có nguồn thật đã kiểm chứng cho registry/root/revocation/time/graph/legal/inventory/survey/vehicle; provider adapters xác minh semantic signatures, provenance, freshness và quyền hạn. Có timestamp policy nếu dùng tài liệu lịch sử.
- Mỗi tiêu chí áp dụng của contract/profile có chứng cứ hợp lệ và coverage đủ; công trình ẩn được đối soát; khoảng trống/xung đột được giải quyết có dấu vết. Đủ reference không thay cho đủ hồ sơ đã xác thực.
- Durable anti-rollback vượt crash/restart/backup restore/concurrency drills; revocation outage/stale/clock rollback/cross-domain replay giữ fail-closed; quy trình emergency revoke được diễn tập.
- Android–Backend E2E kiểm tra chính dữ liệu và cấu hình triển khai, offline/cached evidence và hazard freshness; không bỏ qua readiness khi lỗi.
- Field validation độc lập kiểm tra geometry/chainage/công trình, phép đo/uncertainty/calibration, giới hạn xe, hazard và hành vi vận hành trên hành lang thử nghiệm; lưu sai lệch và cách đóng sai lệch.
- Policy và quy trình nhóm C được phê duyệt; có training, giám sát, phản hồi sự cố, khả năng ngừng sử dụng và đầu mối chịu trách nhiệm.
- Safety audit độc lập đóng mọi finding chặn an toàn; có biên bản quyết định go/no-go với phạm vi, điều kiện và giới hạn cụ thể.

Go chỉ sau khi toàn bộ điều kiện áp dụng có bằng chứng nghiệm thu. Thiếu một nguồn thẩm quyền, thời gian/revocation không đáng tin, coverage chưa đủ, xung đột chưa giải quyết, audit chưa đạt hoặc người chịu trách nhiệm chưa phê duyệt đều là no-go. Việc thiết kế/thay đổi production approval phải là task riêng được ủy quyền và review; không nằm trong 5C.2D. Unit tests PASS không cho phép bỏ qua các gates này.

## 8. Remaining task roadmap

Các ID sau là đề xuất lập kế hoạch, không phải task đã tự triển khai và không tự khởi động 5C.2E. Thứ tự là theo phụ thuộc, không phải ngày phát hành.

| Task ID | Task name | Goal | Dependencies | Scope | Definition of Done | Blocking condition | Suggested order |
|---|---|---|---|---|---|---|---|
| P5-I01 | Backend HTTP fixture demo | Chứng minh API/download/auth qua HTTP | Backend hiện hành, fixture storage | Phase 5 integration testing, Backend | HTTP role/error/schema tests; tải bytes/hash; expiry/corruption/stale tests; hướng dẫn tái lập | Không có harness hoặc fixture xác định | 1; song song P5-A01 |
| P5-A01 | Android consumer contract review | Xác định loader/cache/UI/offline gaps | Task Android được cho phép, source Android hiện hành | Android integration review | Danh sách mismatch có vị trí source; emulator smoke; offline/UNVERIFIED behavior có bằng chứng | Backend-only scope chưa được mở cho task riêng | 1; song song P5-I01 |
| P5-P01 | TS/Kotlin golden parity | Chốt canonical identity liên nền tảng | P5-A01, golden vectors V2 | Phase 5 + Android | Cùng vectors/hash/rounding/direction; negative V1 và mismatch cases PASS | Chưa kiểm tra Android hoặc khác thuật toán | 2 |
| P5-I02 | Demo E2E và offline fault drill | Đạt Milestone A | P5-I01, P5-A01, P5-P01 | Integration testing + Android | Toàn bộ checklist A PASS; log/device evidence; demo labels và strict lock | Consumer/auth/download/cache failures chưa đóng | 3; điểm dừng demo |
| P5-V01 | Proof/v3 TEST_ONLY orchestration adapter | Nối foundation thành luồng kiểm thử | Contracts 2A–2D; task được giao riêng | Phase 5, Backend TEST_ONLY | Native crypto path; final shared-time revalidation; snapshot refresh/fault tests; v2 compatibility; engine giữ khóa | Bất kỳ provenance/lock regression | Sau demo hoặc song song khi đủ nguồn lực |
| P5-R01 | Durable checkpoint design và contract harness | Chuẩn bị state chống rollback qua restart | Threat model, owner/recovery policy | Phase 5 security foundation | CAS/concurrency/crash/restore test contract và lựa chọn storage được review; chưa giả production verified | Thiếu durability/recovery semantics | Song song P5-V01 và EXT-01 |
| EXT-01 | Registry/PKI/time onboarding | Có nguồn thẩm quyền và vòng đời khóa thật | Đơn vị cung cấp và quyền truy cập được xác lập | External data/infrastructure | Root fingerprint xác thực; signed registry/status; SLA freshness/revoke; timestamp và key ceremony records | Chưa có issuer/root/status/time được chấp nhận | Bắt đầu liên hệ song song mốc A |
| EXT-02 | Corridor/vehicle/survey evidence package | Có chứng cứ cho phạm vi thử nghiệm | Data custodians, vehicle authority, survey scope | Real data + field preparation | Inventory/inspection/legal/vehicle/survey/calibration signed evidence; criteria coverage matrix; data rights | Thiếu hồ sơ hoặc coverage/uncertainty không đạt | Song song EXT-01 và OPS-01 |
| OPS-01 | Safety/evidence operating policy | Chốt cách quyết định và trách nhiệm | Vai trò có thẩm quyền, scope hành lang/xe | Operational approval | Policy phiên bản hóa, signed approval, conflict/supersession/reinspection/outage/revocation procedures | Chưa có người có quyền quyết định hoặc policy chưa duyệt | Khởi động song song EXT-01/02 |
| INT-REAL01 | Verified provider adapters và durable state | Tích hợp nguồn thật theo policy | EXT-01/02, OPS-01, P5-V01/R01 | Backend security integration; Android consumer tests riêng | Chín adapter có semantic validation; durable restart/fault evidence; staging E2E; không tự unlock engine | Nguồn/permission/freshness thiếu; checkpoint chưa đáng tin | Sau dependencies; có thể làm từng adapter |
| FIELD-01 | Bounded corridor field trial | Đối soát tính đúng và vận hành | INT-REAL01, OPS-01; kế hoạch thử nghiệm được duyệt | Real data + Android + field acceptance | Biên bản đối soát đo/công trình/xe/hazard; outage drill; sai lệch chặn đã đóng | Không đủ điều kiện thử nghiệm an toàn hoặc thiếu evidence | Sau staging acceptance |
| AUD-01 | Independent safety audit | Kiểm tra độc lập chuỗi an toàn | Code/policy/data/field evidence ổn định | Independent audit | Threat model và findings được đánh giá; mọi finding chặn có bằng chứng đóng | Auditor/đầu vào chưa sẵn sàng hoặc còn finding chặn | Review sớm; nghiệm thu sau FIELD-01 |
| REL-01 | Scoped go/no-go | Quyết định có trách nhiệm cho Milestone B | Tất cả gates B, AUD-01 và phê duyệt có thẩm quyền | Operational release decision, task riêng | Biên bản scope/limits/monitoring/stop plan và quyết định hợp lệ; thay đổi production qua review riêng | Bất kỳ gate thiếu hoặc chưa có người phê duyệt | Cuối cùng; không tự deploy |

Đường ngắn tới demo: P5-I01 + P5-A01 → P5-P01 → P5-I02. Có thể dừng ở A để trình diễn và lấy phản hồi. Đường tới B cần cả kỹ thuật, dữ liệu và nghiệm thu; không có tỷ lệ hoàn thành tổng dự án hoặc ngày phát hành chắc chắn vì chưa có backlog và cam kết nguồn lực đầy đủ.

## 9. Trả lời tám câu hỏi kết luận

**1. Đến Task 5C.2D, hệ thống đã có những gì?**

Có graph/manifest contract, diagnostic engine giữ khóa, test-only verification foundation/orchestration, independent revocation, exemption foundation, proof contracts/binding/declared coverage, v3 multi-key registry và chín provider interfaces/readiness. Backend API manifest/download tồn tại với unit tests. 1.073 tests PASS là bằng chứng repository; chưa có bằng chứng production trust hoặc an toàn hiện trường.

**2. Các module nào đã hoàn thiện nhưng chưa tích hợp?**

2A/2B/2C đã có hành vi và tests theo phạm vi TEST_ONLY; chưa thành nguồn trust production. Tám source modules mới 2D hoạt động độc lập, v3 chưa nối orchestrator v2; proof chưa áp dụng vào exemption/engine/importer/API. Provider interfaces chưa có verified real adapters. “Hoàn thiện” ở đây chỉ là foundation theo phạm vi task, không phải hoàn tất sản phẩm.

**3. Cần làm thêm những Task kỹ thuật nào để có bản demo?**

HTTP fixture/auth/download harness, Android loader/cache/UI/offline review, TS/Kotlin parity và demo E2E/fault tests theo P5-I01/A01/P01/I02. Xác minh consumer luôn hiển thị UNVERIFIED và không tự mở strict routing.

**4. Các Task nào Codex có thể làm ngay mà không cần dữ liệu từ cơ quan bên ngoài?**

Backend HTTP fixture/contract/fault harness, test-only sidecar validation, proof/v3 adapter và durable-store contract tests. Android parity/loader/offline cũng không cần dữ liệu cơ quan nhưng cần task Android riêng được ủy quyền. Không cần tạo thêm production-trust simulation để chứng minh demo.

**5. Những dữ liệu hoặc giấy tờ nào phải xin từ bên ngoài?**

Authority registry và hồ sơ quyền hạn; trust-root provisioning/fingerprints, revocation/time/timestamp service policy; legal/inspection/inventory cầu/cống/hầm/công trình ẩn; hồ sơ phê duyệt cấu hình xe; survey có phương pháp/surveyor/calibration/uncertainty/coverage; graph/hazard provenance và quyền sử dụng. Cần cả quy trình cập nhật, thu hồi, SLA và nghiệm thu, không chỉ bản scan hoặc hash tự khai.

**6. Có thể kiểm thử Android–Backend end-to-end trong môi trường demo chưa?**

Có thể bắt đầu chuẩn bị Backend fixture harness ngay. Chưa có đủ bằng chứng để khẳng định chạy E2E thành công: Android source hiện hành/emulator, URL/network/auth, loader/cache và harness là NEEDS_VERIFICATION. Controller unit tests hiện có không phải HTTP E2E; task này chưa chạy Android hoặc E2E scaffold.

**7. Điều kiện nào bắt buộc trước khi dùng hỗ trợ cứu hộ thực tế?**

Đủ nguồn và chứng cứ thật đã xác minh theo từng tiêu chí/xe/hành lang; PKI/revocation/time/durable anti-rollback đáng tin; coverage và physical validation độc lập; Android–Backend/outage tests; policy và vận hành được duyệt; field acceptance, safety audit và quyết định go/no-go. Mọi gate thiếu giữ BLOCKED; test key/chữ ký/hash/unit tests không thay các điều kiện này.

**8. Task kế tiếp đem lại giá trị thực tế cao nhất là gì?**

P5-I01: kiểm thử HTTP fixture cho manifest/download/auth và trạng thái khóa. Song song, giao task P5-A01 kiểm tra Android consumer nếu được cho phép. Hai việc này kiểm chứng trực tiếp đường tới demo và tìm mismatch sản phẩm trước khi đầu tư thêm mô phỏng trust. Đây chỉ là đề xuất; 5C.2D dừng sau hai báo cáo, không tự triển khai task tiếp theo.
