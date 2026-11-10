# PHASE 5 – P5-I01: BACKEND HTTP FIXTURE DEMO & ROUTING API SECURITY INTEGRATION TESTS

Ngày báo cáo: 06/11/2026, Asia/Bangkok.
Repository: /home/vantri/AndroidStudioProjects/canh-bao-thien-tai-backend-app.

## 1. Executive Summary

**Đã hoàn thành harness và kiểm thử: 67/67 HTTP E2E tests, 3/3 suites PASS; 1.073/1.073 regression tests, 43/43 suites PASS. Không skip.** Có HTTP server Nest thật, JWT strategy/guards thật, download server loopback và bytes GZIP thực được tải, hash, kiểm tra độ dài và giải nén.

**Final acceptance: FAIL đối với tiêu chí an toàn của P5-I01.** Kiểm thử đã tái hiện hành vi production hiện hữu: API suy readiness từ manifest, không đối chiếu nội dung graph. Một manifest khai READY với summary một cạnh verified khiến API trả `strictRoutingReady=true` và `canAttemptStrictRouting=true`, dù chính file tải về có cạnh UNVERIFIED. Một ca khác cho thấy `canAttemptStrictRouting=true` được sao chép ra response dù `strictRoutingReady=false` và summary còn cạnh UNVERIFIED. Các assertion tái hiện đều PASS vì mô tả chính xác lỗi; không được dùng kết quả xanh đó làm nghiệm thu an toàn.

Theo giới hạn task, không sửa production service/controller/storage/guards. Đã lưu test tái hiện và đề xuất sửa riêng ở mục 15. Qualification Engine vẫn giữ khóa; không mở production routing hay nâng cạnh thật. Chỉ fixture bộ nhớ trong ca tái hiện trả các flags mâu thuẫn. Không thay đổi artifact hoặc dữ liệu production.

Typecheck importer, typecheck production source + HTTP tests riêng và Nest build đều exit 0. Một lần typecheck toàn repository ngoài yêu cầu phát hiện lỗi có sẵn ngoài phạm vi, chi tiết mục 13. Toàn bộ 249 baseline files, gồm 20 artifacts, giữ nguyên SHA-256 và mtime_ns.

## 2. Repository Baseline

Đã đọc hai báo cáo 5C.2D/gap, RoutingController/Service/Storage và specs, RoutingModule, JwtStrategy, JwtAuthGuard, RolesGuard, UsersService.findById, bootstrap/global filter, types graph/manifest 2.1.0, Jest configs và E2E scaffold. Không có AGENTS.md áp dụng tại repository, thư mục cha hoặc cây test được kiểm tra.

Node v26.8.2; TypeScript 6.0.3. Trước thay đổi, pwd/status/diff check đã chạy; diff check exit 0. Baseline targeted routing: **32 tests / 3 suites PASS**, exit 0, 1.243s. Số 1.073/43 trước task lấy từ báo cáo 5C.2D, không chạy lại full baseline trước sửa.

Repository vốn có modified: tools/osm-importer/src/osm-importer.ts, types.ts, test/osm-importer.spec.ts và tsconfig.build.tsbuildinfo; docs và nhiều qualification/via-way sources/tests vốn untracked. Không reset/clean/restore các thay đổi này. Không cài dependency. Không commit/push/deploy.

Đã chụp SHA-256 và mtime_ns dạng chuỗi decimal cho **249 files hiện có** trong src, tools/osm-importer, test và docs; gồm 20 artifacts dưới các output directories. So sánh trước full suite và sau full suite. Build/cache không thuộc cam kết bảo toàn artifacts; tsconfig.build.tsbuildinfo đã dirty trước task.

## 3. Files Created/Modified

Chỉ tạo sáu file thuộc task:

| File | Mục đích |
|---|---|
| test/fixtures/routing/http-harness.ts | Graph/manifest trong memory, external adapters, Nest loopback, JWT factory, download server HMAC và test consumer assertions |
| test/routing-http-auth.e2e-spec.ts | 20 ca authentication/authorization qua HTTP thật |
| test/routing-http-fixture.e2e-spec.ts | 25 ca manifest/error/readiness, gồm tests tái hiện blockers |
| test/routing-http-download.e2e-spec.ts | 22 ca tải bytes và fault/integrity checks |
| test/tsconfig.routing-http.json | Typecheck production source và HTTP tests mới, không kéo migrations/specs cũ vào scope |
| docs/PHASE5_P5I01_BACKEND_HTTP_DEMO_REPORT.md | Báo cáo này và hợp đồng cho task Android tiếp theo |

Không sửa source/test/docs có trước task. Nest build có thể cập nhật build cache đã dirty; đó không phải thay đổi implementation. Fixture không ghi file vào output, output-real, output-danang hoặc output-dryrun.

## 4. HTTP Test Harness Architecture

Mỗi suite khởi tạo Nest application bằng TestingModule, listen trên **127.0.0.1, port 0** để hệ điều hành chọn cổng. Native fetch gửi request qua TCP HTTP thật, không gọi controller trực tiếp hoặc dùng adapter inject không mở server.

Giữ production RoutingController, RoutingService, JwtStrategy, JwtAuthGuard và RolesGuard. Không override guards hoặc mock chữ ký thành công. Đăng ký PassportModule với jwt strategy thật. Global ValidationPipe whitelist/transform và AllExceptionsFilter giống bootstrap; không import AppModule để tránh khởi tạo database/Firebase/mail/cloud. Các biến môi trường bắt buộc của bootstrap không được giả làm cấu hình production.

Chỉ thay external boundaries:

- UsersService bằng Map lookup trong memory, có hồ sơ vai trò/status/rescue approval rõ ràng. Không tạo PrismaService/database connection. Đây không phải kiểm thử database hoặc schema enforcement của Prisma.
- RoutingStorageService bằng FixtureStorage. Production RoutingService vẫn chạy validation thật. Adapter mô phỏng missing/unavailable/size mismatch với HttpExceptions; không tuyên bố đã kiểm thử R2 qua mạng.

JWT secret sinh ngẫu nhiên riêng mỗi harness, chỉ đặt JWT_ACCESS_SECRET trước khi tạo strategy và khôi phục giá trị cũ khi teardown. Không đọc hoặc in production secret. JWT ký bằng JwtService/HS256; test chữ ký sai dùng secret khác. Fixture download URL dùng HMAC-SHA256 riêng, không phải AWS SigV4 hoặc production trust root.

Download server thứ hai chỉ listen loopback/random port. URL bind path + expiry; TTL 900 giây. Graph, JSON/GZIP, bytes và người dùng hoàn toàn trong memory. Fixture graph có một cạnh synthetic UNVERIFIED, isEligibleForStrictRouting=false, graph canAttemptStrictRouting=false. Không sao chép dữ liệu Đà Nẵng vào nơi ghi fixture.

Teardown đóng Nest app, đóng mọi connection của download server và khôi phục JWT env. Reset mỗi test chỉ reset dữ liệu thuộc adapter. Test consumer chỉ cho phép download origin của server fixture, timeout/redirect rejection và giới hạn gunzip output; không có đường cấp production approval. Đây là consumer assertions cho demo, không phải implementation Android hoặc verifier production.

Lần chạy sandbox đầu không mở được loopback (listen EPERM). Đã chạy lại đúng các HTTP tests với quyền cho phép local listener và thành công; không thay bằng mock HTTP. Không có automatic approval rejection, không truy cập Internet hoặc cloud production.

## 5. Authentication Results

| Ca HTTP | Status | Body/hành vi đã assert |
|---|---:|---|
| Không JWT, malformed JWT, unsigned alg=none | 401 | success=false; error.statusCode=401; message=Unauthorized; không đọc storage |
| Sai chữ ký, expired, future nbf | 401 | Passport từ chối; không đọc storage |
| Thiếu sub, numeric sub, object sub, subject không tồn tại | 401 | User not found tại adapter lookup; không đọc storage |
| User BANNED hoặc INACTIVE | 401 | User is not active từ strategy thật |
| Không có role trong JWT, subject có hồ sơ hợp lệ | 200 | JWT role không phải nguồn cấp quyền; stored user role được dùng |
| role claim là object nhưng subject là admin hợp lệ | 200 | Claim role bị bỏ qua; không tuyên bố strategy có claim-schema validator đầy đủ |

JwtStrategy hiện chuyển payload.sub vào UsersService.findById và không tự validate claim schema. Các ca sub không hợp lệ chứng minh hành vi của HTTP pipeline + memory lookup, **không chứng minh production database nhận undefined/object sẽ trả cùng 401**. Cần task hardening riêng nếu yêu cầu schema rejection rõ ràng trước lookup; không tự sửa strategy trong task này.

## 6. Authorization Results

| Stored user | JWT role claim | Status |
|---|---|---:|
| RESCUER + rescueProfile.verificationStatus=APPROVED | Không cần | 200 |
| ADMIN | Không cần | 200 |
| MODERATOR | Không cần | 200 |
| USER | ADMIN tự khai, dù JWT ký hợp lệ | 403 |
| RESCUER + PENDING verification | ADMIN tự khai | 403 |
| Hồ sơ không có role | ADMIN tự khai | 403 |

403 body chính xác: `{"success":false,"error":{"statusCode":403,"message":"Forbidden resource"}}`. Denied requests không truy cập fixture storage. Policy thực tế có điều kiện APPROVED cho RESCUER; không nới RolesGuard để khớp mô tả đơn giản trong prompt.

## 7. Routing Manifest HTTP Results

Valid response qua GET /routing/current có bảy top-level fields: manifest, download, downloadAvailable, strictRoutingReady, liveHazardReady, canAttemptStrictRouting, overallStrictRoutingReadiness. Version nằm tại manifest.manifestVersion=2.1.0. Fixture bình thường trả downloadAvailable=true, strictRoutingReady=false, canAttemptStrictRouting=false, liveHazardReady=false và NOT_READY_NO_VERIFIED_EDGES.

16 ca invalid manifest trả HTTP 500 qua production service/global filter: null, array, string không phải object, thiếu fields, version unsupported, graph identity sai cú pháp, thiếu bundle, sai fileName, compressed length zero/fractional, digest sai định dạng, timestamp invalid, thiếu edgeSafetySummary, thiếu strict gate, hazard UNKNOWN và ATTACHED thiếu version. Assert status/body message và không có download/readiness trong error body. Expected 500 logs chỉ được capture trong các ca tương ứng; không thay global filter.

Adapter exceptions qua HTTP: missing manifest 404, missing artifact 404, unavailable 503, size mismatch 409. Đây là status propagation của external adapter, không phải xác minh AWS SDK/network R2.

Giới hạn thực tế được tái hiện:

- Timestamp cũ nhưng parse hợp lệ vẫn trả 200. Không có freshness/max-age policy trong production validator. Test consumer dùng **policy demo một giờ**, từ chối STALE_MANIFEST; policy đó chưa tồn tại trong API hoặc Android.
- Digest gồm 64 hex nhưng sai nội dung vẫn trả 200, download consumer phát hiện SHA256_MISMATCH.
- Graph version đúng cú pháp nhưng khác nội dung file không bị API phát hiện, consumer phát hiện GRAPH_VERSION_MISMATCH.
- Manifest 2.1.0 không có field top-level qualificationStatus. Tình trạng cạnh ở graph.edges[].compatibilityStatus; readiness summary trong manifest. Không thêm field tưởng tượng để làm test xanh.
- ATTACHED + hazard version làm liveHazardReady=true trong API; đây là metadata readiness, không chứng minh nguồn hazard/freshness thật hoặc qualification approval.

“Malformed response string” ở đây là unknown value do storage adapter trả vào validator. Không gọi đó là kiểm thử wire JSON parse của production S3 GetObject; boundary đó vẫn chỉ có unit tests cũ.

## 8. Download Byte-Integrity Results

Happy path thực thi toàn chuỗi: HTTP lấy manifest → đọc response.download.url → HTTP lấy GZIP bytes → tính SHA-256 trên bytes nén → so sánh compressed length → gunzip → so sánh uncompressed length → parse JSON → đối chiếu graph contractVersion/graphVersion/vehicleProfile → kiểm tra cạnh UNVERIFIED.

22 download cases PASS. Chứng minh bytes nhận được bằng chính fixture bytes và graph giải nén bằng fixture graph. Không chỉ mock HeadObject hoặc chỉ kiểm tra URL tồn tại.

| Tình huống | Kết quả test consumer/HTTP |
|---|---|
| Byte corruption cùng chiều dài | SHA256_MISMATCH |
| Body kết thúc bình thường nhưng thiếu bytes | COMPRESSED_LENGTH |
| Digest 64 hex sai trong manifest | SHA256_MISMATCH |
| Graph contract version unsupported | GRAPH_CONTRACT_VERSION |
| Graph version mismatch | GRAPH_VERSION_MISMATCH |
| Vehicle profile mismatch | GRAPH_PROFILE_MISMATCH |
| Thiếu edge compatibilityStatus | EDGE_QUALIFICATION |
| Graph schema là array | GRAPH_SCHEMA |
| GZIP hợp lệ chứa JSON sai | GRAPH_JSON |
| Bytes không phải GZIP nhưng digest/length khớp | INVALID_GZIP |
| Độ dài giải nén không khớp | UNCOMPRESSED_LENGTH |

Các graph/schema/GZIP fault fixtures được cập nhật digest/length phù hợp khi cần để vượt integrity boundary và thực sự kiểm tra semantic/decode boundary. Không để một hash mismatch che khuất test version hoặc JSON parse.

## 9. Error/Fault Injection Results

Sau khi manifest GET trả 200, download endpoint có thể trả 404, 503, 500; consumer nhận các code DOWNLOAD_HTTP tương ứng. Sai Content-Type text/html → DOWNLOAD_CONTENT_TYPE. Server flush headers và ghi nửa body rồi destroy connection → DOWNLOAD_TRANSPORT. Đây là TCP interruption thực trên loopback.

Expiry dùng clock của fixture storage, không sleep 900 giây và không đổi thời gian xác thực JWT. URL tại đúng expiry bị 403 EXPIRED_FIXTURE_URL. Sửa signature/path/expiry hoặc thiếu signature bị 403 INVALID_FIXTURE_SIGNATURE. Consumer cũng từ chối HTTP 403. URL signing này chỉ kiểm tra semantics của fixture, không chứng minh R2 presigner/SigV4 hoạt động thực.

Lần chạy phát triển đầu tiên sau khi được mở loopback có 65/66 tests PASS: fixture malformed graph là array quá ngắn, gzip lớn hơn JSON và bị manifest validator chặn trước boundary mong muốn. Đã sửa fixture thành array có padding để giữ manifest hợp lệ và kiểm tra đúng GRAPH_SCHEMA. Không sửa production validation. Sau thêm test gate inconsistency, final run có 67/67 PASS.

## 10. Strict Routing Safety Results

Fixture bình thường, thiếu summary/gate, hazard UNKNOWN, stale metadata, graph mismatch, storage/download failures và invalid digest không tạo qualification approval trong test consumer. Errors không biến thành downloaded graph hợp lệ. Test consumer luôn trả UNVERIFIED/canAttemptStrictRouting=false khi kiểm tra thành công; nó không đại diện cho trạng thái consumer Android hiện hành.

**Hai vấn đề hiện hữu được ghi nhận riêng, không che bằng test consumer:**

1. Chỉ đổi manifest.canAttemptStrictRouting=true khi summary vẫn unverifiedEdges=1: API trả strictRoutingReady=false nhưng canAttemptStrictRouting=true. Có rủi ro consumer chỉ đọc trường canAttemptStrictRouting.
2. Đổi manifest readiness/summary thành READY/verified=1/unverified=0, giữ nguyên GZIP chứa cạnh UNVERIFIED và digest đúng: API trả strictRoutingReady=true, canAttemptStrictRouting=true. Tải và giải nén qua HTTP xác nhận cạnh thực tế vẫn UNVERIFIED. RoutingService không tải graph để kiểm chứng summary; production storage HEAD chỉ kiểm tra kích thước.

Test tái hiện ở cuối test/routing-http-fixture.e2e-spec.ts. Đây là giới hạn trust/integrity giữa manifest và graph, không phải bypass JWT và không phải thay đổi Qualification Engine. Không có bằng chứng artifact production hiện tại đang khai sai; finding dựa trên fixture tái hiện có kiểm soát.

Bốn bất biến Qualification Engine vẫn giữ qua source preservation và regression tests:

```text
purpose = DIAGNOSTIC_ONLY
trustStatus = UNAVAILABLE
qualificationStatus = UNVERIFIED
isProductionApproved = false
```

Không đưa test receipts vào API. Không có production approval branch mới. Tuy nhiên không thể tuyên bố mọi response API luôn khóa chỉ dựa trên engine lock: hai ca trên chứng minh phạm vi đó khác nhau.

## 11. Unit Regression Results

```bash
npm test -- --runInBand --json --outputFile=/tmp/p5i01-unit-results.json
```

Exit **0**; **43/43 suites, 1.073/1.073 tests PASS**, Jest 20.865s; skipped/pending=0, snapshots=0. Không cộng 32 baseline targeted tests thành tests mới. Các suites hiện hành gồm cả importer/qualification regression, không chỉ unit Nest đơn lẻ.

Trước full suite đã đọc lại importer isolation: mỗi test sở hữu mkdtemp root, CLI output overrides và cleanup đúng root; afterAll kiểm tra protected artifacts. Snapshot 249 files không đổi trước full suite. Full suite không ghi đè shared output directories. Experimental VM Modules và SosService mock Firebase warning/debug xuất hiện; không phải cloud Firebase request thật từ harness.

## 12. E2E Test Results

Lệnh tái lập, dùng dependencies đã có:

```bash
npm run test:e2e -- --runInBand --runTestsByPath test/routing-http-auth.e2e-spec.ts test/routing-http-fixture.e2e-spec.ts test/routing-http-download.e2e-spec.ts
```

Final run thêm `--json --outputFile=/tmp/p5i01-e2e-results.json` để ghi số đếm máy đọc được. Exit **0**, Jest 2.791s:

| Suite | Cases | Result |
|---|---:|---|
| routing-http-auth.e2e-spec.ts | 20 | PASS |
| routing-http-fixture.e2e-spec.ts | 25 | PASS, gồm assertions tái hiện defects |
| routing-http-download.e2e-spec.ts | 22 | PASS |
| Tổng HTTP E2E mới | 67 | 3 suites, không skip/pending/snapshots |

Hai lần chạy lặp/development không tính thành cases mới. Tổng hai final commands: **1.140 distinct tests trên 46 suites PASS** = 1.073 regression + 67 E2E. Số này không phải kết quả một lệnh npm test duy nhất: default Jest chỉ match .spec.ts, E2E config match .e2e-spec.ts.

Không chạy test/app.e2e-spec.ts: scaffold import AppModule không phải routing fixture integration và có dependencies bên ngoài phạm vi. Không kiểm thử Android, production database, production R2 hoặc mạng Internet/TLS. Các đường HTTP trong ba suites mới đều chạy được qua loopback, không bỏ qua vì môi trường.

## 13. Typecheck/Build Results

| Lệnh | Exit | Kết quả |
|---|---:|---|
| npx --no-install tsc --project tools/osm-importer/tsconfig.json --noEmit | 0 | PASS |
| npx --no-install tsc --project test/tsconfig.routing-http.json --pretty false | 0 | PASS production source và HTTP tests mới, gồm type dependencies |
| npx --no-install nest build | 0 | PASS |
| git diff --check | 0 | PASS |

Đã thử thêm `npx --no-install tsc --noEmit --incremental false --pretty false` trên root config: **exit 2**. Root config gom migrations và specs cũ; có lỗi CommonJS/import attributes/import.meta và migration operation shape, cùng errors trong admin/auth/firebase/routing/users specs và cli type re-export. Lần đó cũng tìm thấy hai optional timestamp types ở fixture mới; đã sửa fixture và focused typecheck PASS. Những lỗi ngoài task không được sửa hoặc che bằng thay root config. Không tuyên bố root toàn repository typecheck PASS.

Không thay canonical geometry; golden oracle không chạy lại trong P5-I01 vì không thuộc thay đổi task này. Kết quả golden trong báo cáo 5C.2D là bằng chứng lần chạy trước, không tính thành lần chạy mới.

## 14. Artifact Preservation

Sau final full suite: **249/249 baseline files nguyên SHA-256 và mtime_ns**, gồm toàn bộ production source trong src, source/tests/fixtures importer và docs/test có trước task. Không thêm artifact trong output directories. Không sửa endpoint, JWT/roles policy, graph contract hoặc Qualification Engine.

20 artifacts được chụp trước mọi thay đổi và đối chiếu sau targeted/full suites; bảng cuối báo cáo ghi digest và mtime_ns trước=sau. Snapshot kiểm tra ns bằng chuỗi, không chuyển qua JavaScript number. File snapshot/raw Jest JSON nằm trong /tmp phục vụ phiên chạy; bằng chứng artifacts được lưu trong báo cáo để không phụ thuộc /tmp lâu dài.

Build/cache đã dirty không được coi là source hoặc graph artifact. Không suy local artifact bằng remote deployment. Local graph output-dryrun-task3b được giữ nguyên như baseline 5C.2D; không nâng 16.651 cạnh UNVERIFIED.

## 15. Remaining Blockers

| ID | Finding và ảnh hưởng | Bằng chứng/đề xuất riêng |
|---|---|---|
| I01-B1, P0 | Manifest-only readiness có thể quảng bá READY khi bytes graph vẫn UNVERIFIED | Hai HTTP reproduction tests cuối fixture suite. Đề xuất task remediation riêng: chốt một strict decision nhất quán; ràng buộc manifest–artifact đã kiểm chứng; giữ fail-closed với mismatch/không có bằng chứng. Khi engine vẫn diagnostic, không cho metadata đơn thuần cấp strict approval. Cần negative HTTP regression trước/sau; không sửa trong task này. |
| I01-B2, P1 | Manifest timestamp được parse nhưng không kiểm tra max age/future freshness; hazard ATTACHED chỉ là metadata | Test stale trả 200. Cần policy freshness/version/clock được duyệt và task riêng cho Backend/consumer. Demo một giờ chỉ là assertion policy của harness. |
| I01-B3, P1 | API không hash/decode downloaded graph; URL/HEAD length không chứng minh artifact integrity | Digest mismatch/version mismatch tests: HTTP metadata 200, consumer phát hiện lỗi sau download. Cần quyết định publication verification + consumer contract; Android phải được kiểm tra độc lập. |
| I01-B4, P1 | JwtStrategy không validate claim schema trước user lookup | Invalid sub cases được Map trả null. Đề xuất validation subject/claims trước DB và kiểm tra behavior lỗi production lookup trong task auth riêng; chưa kết luận DB hiện tại an toàn với malformed sub. |
| I01-B5 | Production R2/config/SigV4, database và Android chưa được kiểm tra | NEEDS_VERIFICATION. Harness cô lập cố ý thay external providers; không chứng minh real infrastructure integration. |
| I01-B6 | Root aggregate typecheck còn lỗi ngoài phạm vi | Mục 13; focused typecheck và required build/importer checks PASS. Không tự sửa migration/specs cũ. |

P0 phải được xử lý và nghiệm thu trước tuyên bố demo strict gate an toàn. Không dùng việc test consumer hardcode khóa để coi lỗi API đã được sửa. Task này hoàn thành phần test/report được ủy quyền và dừng nhánh sửa production theo yêu cầu.

## 16. Android Integration Contract

Đây là contract đọc từ Backend và kiểm thử fixture; **Android hiện hành NEEDS_VERIFICATION**, không được đọc/sửa/chạy trong P5-I01.

| Hạng mục | Contract/hành vi thực tế và yêu cầu đối chiếu |
|---|---|
| Endpoint path | GET /routing/current; bootstrap hiện không đặt global prefix |
| Authentication | Authorization: Bearer JWT; JwtStrategy dùng JWT_ACCESS_SECRET, kiểm tra chữ ký/expiry; payload.sub dùng tìm user hiện tại |
| Required roles | Stored ADMIN, MODERATOR hoặc RESCUER có rescueProfile.verificationStatus=APPROVED; USER bị 403; BANNED/INACTIVE bị 401 |
| Response schema/version | RoutingStatusResponse có manifest + download + năm lifecycle/readiness fields; manifest.manifestVersion=2.1.0; graph.contractVersion=2.1.0; graphVersion/profile cần khớp giữa manifest và bytes |
| Download URL semantics | URL tại response.download.url, không phải field trong manifest; response.download.expiresIn=900 giây; production là presigned object URL; fixture là HMAC loopback URL, không phải SigV4 |
| SHA-256 fields | manifest.bundle.sha256 là 64 lowercase hex, hash của GZIP bytes; bundle.compressedSizeBytes và uncompressedSizeBytes cần đối chiếu riêng; digest không phải chứng nhận an toàn thực địa |
| GZIP handling | Tải raw bytes, kiểm tra compressed length/hash, giải nén rồi parse JSON và kiểm tra version/identity. Production presigner yêu cầu application/gzip; test server không dùng Content-Encoding:gzip để tránh tự giải nén trước hash. Hành vi HTTP client Android/remote headers NEEDS_VERIFICATION. |
| Expiry handling | URL có TTL; không cache URL như quyền truy cập vĩnh viễn. Khi hết hạn cần xử lý lỗi và lấy metadata/URL mới qua authenticated API. Fixture expiry trả 403; production storage error body cụ thể chưa được kiểm chứng. |
| Offline/cached graph assumptions | Task không chứng minh Android có cache hoặc policy offline. Không suy cached graph an toàn vì đã tải trước đây. Cần kiểm tra integrity/version/evidence freshness, atomic replacement và explicit unavailable/unverified UI; cached URL không thay cached validated bytes. |
| Readiness/UNVERIFIED | manifest.edgeSafetySummary, manifest.canAttemptStrictRouting, overallStrictRoutingReadiness; response strictRoutingReady/liveHazardReady/downloadAvailable/canAttemptStrictRouting; graph.edges[].compatibilityStatus và isEligibleForStrictRouting. Manifest không có qualificationStatus tổng. Flags hiện có finding B1: không dùng một true field làm chứng nhận strict readiness. |
| API errors | Production global filter: {success:false,error:{statusCode,message}}; HTTP 401 authentication/user inactive, 403 roles, 404 missing object, 409 size mismatch, 500 malformed/invalid manifest, 503 storage unavailable. Fixture adapter messages là test messages; không ràng buộc Android vào chuỗi test. |
| Download errors | URL có thể trả body khác API envelope; cần xử lý status, timeout/connection abort, wrong Content-Type, truncation/hash/GZIP/JSON/version/profile mismatch. 403 expiry/signature trong fixture không chứng minh exact production error shape. |
| Demo boundary | Graph synthetic UNVERIFIED; chỉ trình diễn tải/kiểm tra/hiển thị và từ chối lỗi. Không cấp production qualification hoặc cứu hộ thực tế. |

## 17. Final Acceptance Decision

**FAIL theo safety acceptance criterion của P5-I01**, do ca fixture chứng minh strictRoutingReady có thể true với file graph UNVERIFIED. Không ghi CONDITIONAL PASS để làm nhẹ finding mà prompt đã liệt kê là FAIL. Đây là lỗi có sẵn được phát hiện, không phải engine bị mở bởi implementation task.

**Phần harness/verification: hoàn thành, tất cả final tests PASS.** Auth thật qua HTTP, role authorization, manifest validation, byte download/hash/length/GZIP, faults, isolation và regression đều có bằng chứng. Tests tái hiện hành vi lỗi có expected assertions nên PASS; safety acceptance là quyết định riêng.

Repository/artifacts được bảo toàn; không có thay đổi production ngoài phạm vi. Muốn nghiệm thu an toàn cần task sửa riêng được ủy quyền và rerun HTTP negative matrix, đặc biệt B1. Không mở qualification hoặc deploy để vượt blocker.

## 18. Recommendation for P5-A01

Có thể dùng contract/harness này làm đầu vào cho task Android riêng: rà soát loader manifest/download/raw-GZIP hashing, cache/offline/expiry/error handling, version/profile binding, UI UNVERIFIED và tất cả nơi đọc canAttemptStrictRouting/strictRoutingReady. Cần chạy emulator/device HTTP E2E và Kotlin/TypeScript parity; không suy tính tương thích từ Backend PASS.

Ưu tiên thêm task Backend remediation cho I01-B1 trước nghiệm thu demo safety. Android review có thể chạy song song để tìm consumer nào tin một readiness flag; task đó không được che lỗi API bằng UI. P5-I01 dừng tại test/report. Không tự làm P5-A01, 5C.2E, production provider, sidecar, commit/push/deploy.

## Phụ lục – Protected artifact baseline

SHA-256 và mtime_ns trước = sau final full regression; không có artifact thay đổi.

| Artifact | SHA-256 trước = sau | mtime_ns trước = sau |
|---|---|---|
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
