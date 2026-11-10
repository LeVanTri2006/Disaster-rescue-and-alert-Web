# PHASE 5 – P5-I01R: CRITICAL STRICT ROUTING READINESS REMEDIATION

Ngày hoàn tất: 06/11/2026, Asia/Bangkok.
Repository: /home/vantri/AndroidStudioProjects/canh-bao-thien-tai-backend-app.

## 1. Executive Summary

**PASS – remediation hai lỗi API I01-B1a và I01-B1b trong phạm vi P5-I01R. Không nghiệm thu production routing hoặc an toàn hiện trường.**

RoutingService hiện dùng một quyết định download-only bất biến. Không có production-authoritative verifier nên strictRoutingReady=false, canAttemptStrictRouting=false và overallStrictRoutingReadiness=NOT_READY_NO_VERIFIED_EDGES. Các alias/readiness trong response.manifest cũng khóa theo cùng quyết định. Manifest tự khai quyền strict, READY, số cạnh verified hoặc phần trăm safe dương bị từ chối trước khi cấp download URL. Hash đúng hoặc metadata tự nhất quán không cấp thẩm quyền.

Hai reproduction tests P5-I01 đã chuyển thành security acceptance: **cả hai trả HTTP 500, không còn response chứa quyền strict hoặc URL từ manifest khai sai**. Với manifest chưa verified hợp lệ, demo vẫn tải GZIP thật; bytes/artifacts giữ nguyên. Metadata hazard ATTACHED không còn làm liveHazardReady=true khi thiếu xác minh nguồn/freshness.

**80/80 HTTP E2E tests / 3 suites PASS; 1.074/1.074 regression tests / 43 suites PASS. Zero skipped.** Importer typecheck, focused HTTP typecheck, Nest build và diff check exit 0. 20 artifacts nguyên SHA-256/mtime_ns. Trong 255 baseline files, chỉ năm file được phép sửa thay đổi; 250 file còn lại giữ nguyên hash/timestamp. Không có thay đổi ngoài phạm vi implementation; build cache đã dirty từ trước có thể được cập nhật.

Các báo cáo P5-I01 và gap trước đó được bảo toàn như lịch sử. Báo cáo này cập nhật kết luận riêng cho B1a/B1b, không thay bằng chứng của các task cũ.

## 2. Baseline Repository Status

Đã kiểm tra pwd, git status, git diff và git diff --check trước sửa. Không tìm thấy AGENTS.md áp dụng trong repository/cây test hoặc các thư mục cha được kiểm tra. Đã đọc yêu cầu P5-I01R, báo cáo P5-I01/gap, service/controller/storage, routing unit specs, ba HTTP specs và fixture harness.

Node v26.8.2; TypeScript 6.0.3. Baseline routing targeted: **32/32 tests, 3/3 suites PASS**, exit 0, Jest 0.852s. Full baseline 1.073/43 và HTTP baseline 67/3 là kết quả lần chạy P5-I01 đã ghi trong báo cáo trước; không chạy lại full/E2E baseline trước sửa trong task này.

Trạng thái có sẵn: importer source/types/spec và tsconfig.build.tsbuildinfo modified; docs, HTTP harness/tests/config và nhiều qualification sources/tests untracked. Không reset, restore hoặc clean các thay đổi này. Không cài dependency, đọc secret production, sửa môi trường production, commit, push hoặc deploy.

Chụp 255 baseline files thuộc src, tools/osm-importer, test và docs, lưu SHA-256 + mtime_ns dạng chuỗi để không mất độ chính xác nanosecond. Chụp thêm snapshot 255 files sau thay đổi cuối, ngay trước full suite. Không có file nào trong snapshot này đổi trong full suite.

## 3. Root Cause I01-B1a

Trước sửa, service tính strictRoutingReady bằng một biểu thức điều kiện nhưng trả canAttemptStrictRouting trực tiếp từ manifest. Manifest tự khai canAttemptStrictRouting=true trong khi unverifiedEdges=1 tạo response strictRoutingReady=false và canAttemptStrictRouting=true. Các alias bên trong manifest cũng không bị kiểm soát. Consumer đọc một field khác có thể nhận quyết định trái ngược.

Sau sửa, manifest khai quyền true bị từ chối với thông báo cố định trước createGraphDownloadUrl. Response thành công chỉ lấy các gates từ DOWNLOAD_ONLY_READINESS, không sao chép quyền từ storage. Test B1a tại test/routing-http-fixture.e2e-spec.ts:236 xác nhận HTTP 500 và error envelope chính xác, đồng thời vẫn tải fixture UNVERIFIED qua URL của lần lấy metadata hợp lệ trước đó.

## 4. Root Cause I01-B1b

Trước sửa, READY + verifiedCompatibleEdges>0 + unverifiedEdges=0 được coi đủ để strictRoutingReady=true. RoutingService không có authoritative verifier, không kiểm tra provenance của qualification và không đối chiếu bytes graph. HeadObject/size trong storage không kiểm tra nội dung hoặc thẩm quyền.

Ca tái hiện giữ nguyên GZIP/hash có cạnh UNVERIFIED, chỉ đổi manifest thành READY/verified=1. Biểu thức cũ trả true dù bytes không đổi. Sau sửa, không tồn tại nhánh cấp readiness từ metadata. Manifest đó bị HTTP 500 ngay cả khi tự nhất quán về định dạng và digest đúng.

Test B1b tại test/routing-http-fixture.e2e-spec.ts:245: lấy một response download-only hợp lệ trước, giữ URL/hash, đổi các claims, xác nhận rejection, rồi tải/giải nén GZIP qua HTTP để chứng minh cạnh vẫn UNVERIFIED. Không mock chữ ký, graph membership hoặc authority để tạo một positive production case.

## 5. Readiness Trust Boundary

```text
Storage JSON (không phải safety authority)
  -> validateManifest (schema boundary)
  -> downloadOnlyManifest (chặn claims; tạo response view khóa)
  -> storage URL generation (download availability)
  -> response + một DOWNLOAD_ONLY_READINESS bất biến
```

DOWNLOAD_ONLY_READINESS là const nội bộ Object.freeze, không export hoặc nhận cấu hình. Không có environment flag, JWT role, caller context, TEST_ONLY receipt/provider hoặc callback để đổi sang true. Hai method getCurrentRouting/getRoutingStatus đều qua cùng boundary. validateManifest vẫn chỉ là schema parser, không phải hàm cấp qualification.

downloadAvailable=true nghĩa là tạo được URL sau schema/storage checks, không nghĩa là client đã tải hoặc hash thành công. liveHazardReady=false vì metadata ATTACHED không chứng minh nguồn và freshness. Hazard status/version vẫn được giữ như metadata, không biến thành production readiness.

## 6. Files Modified

| File | Thay đổi |
|---|---|
| src/routing/routing.service.ts | Bỏ quyết định từ manifest counts/READY; thêm quyết định khóa bất biến, claim rejection và response projection tách khỏi storage |
| src/routing/routing.service.spec.ts | Giữ 14 cases cũ, cập nhật các hành vi cấp quyền không còn hợp lệ; thêm một case frozen storage/deep clone/alias method |
| test/routing-http-fixture.e2e-spec.ts | Đổi hai reproduction cases thành acceptance; bổ sung claims/aliases/proof injection/repeated requests/future metadata/raw JSON tests |
| test/routing-http-auth.e2e-spec.ts | Cả ba role được phép phải nhận đầy đủ nested/top-level gates khóa |
| test/fixtures/routing/http-harness.ts | statusOf kiểm tra toàn bộ quyết định API trong mọi successful download/fixture test, không dựa vào khóa hardcode của demo consumer |

File mới duy nhất: docs/PHASE5_P5I01R_STRICT_READINESS_REMEDIATION_REPORT.md.

Không sửa controller, JWT strategy/guards, storage, importer/CLI, graph/types contract, qualification engine, Prisma hoặc Android. Download E2E spec/config giữ nguyên; chạy lại toàn bộ. Các assertions cũ được cập nhật vì policy bảo mật thay đổi, không giảm case count hoặc đổi expectation để chấp nhận false-safe.

## 7. Exact Remediation Behavior

**Rejection trước URL generation:** canAttemptStrictRouting khác false; isStrictRoutingEligible hiện diện mà khác false; overallStrictRoutingReadiness=READY; optional strictRoutingReadiness sai enum hoặc READY; verifiedCompatibleEdges>0; strictSafeEdgesPercent>0. Schema errors bắt buộc vẫn do validator cũ từ chối trước đó.

HTTP 500 dùng error envelope production hiện có:

```json
{
  "success": false,
  "error": {
    "statusCode": 500,
    "message": "Production strict routing verification is unavailable; manifest readiness claims cannot be accepted"
  }
}
```

Không chứa download/manifest/readiness grants trong rejection. Chọn 500 vì published metadata không đủ điều kiện cung cấp contract an toàn; không thêm status enum/schema version mới.

**Successful download-only response:**

| Field | Giá trị |
|---|---|
| response.strictRoutingReady | false |
| response.canAttemptStrictRouting | false |
| response.overallStrictRoutingReadiness | NOT_READY_NO_VERIFIED_EDGES |
| response.liveHazardReady | false |
| response.manifest.canAttemptStrictRouting | false |
| response.manifest.isStrictRoutingEligible | false |
| response.manifest.overallStrictRoutingReadiness | NOT_READY_NO_VERIFIED_EDGES |
| response.manifest.strictRoutingReadiness | NOT_READY_NO_VERIFIED_EDGES |
| response.manifest.isRestrictionStrictRoutingEligible | false |
| response.manifest.restrictionStrictRoutingReadiness | NOT_READY_NO_VERIFIED_EDGES |

Restriction eligibility cũng được hạ về quyết định API bảo thủ; không chuyển technical restriction READY tự khai thành quyền production. Chi tiết unsupportedRestrictionsSummary còn được giữ để chẩn đoán. NO_VERIFIED_EDGES ở response nghĩa là API chưa có cạnh được xác minh có thẩm quyền; không phải kết quả một phép khảo sát graph mới.

Response được dựng theo các trường contract đã biết, không spread toàn bộ raw manifest. Các unknown approval/provider/receipt claims ở cấp manifest và unknown fields trong các nested objects được liệt kê không được forward. Sau projection dùng structuredClone, nên metadata response không alias stored manifest. Giữ identity/version/digest/length và metadata phục vụ download; không viết lại bytes/hash hoặc stored readiness.

Case unit dùng Object.freeze cho stored manifest/bundle/summary. Tạo response không mutate; sửa bundle/summary của response rồi gọi alias method không làm đổi storage hoặc response tiếp theo. Case HTTP repeated requests xác nhận stored restriction READY vẫn nguyên, trong khi API view luôn khóa.

## 8. Response Contract Compatibility

Giữ RoutingStatusResponse shape, manifestVersion=2.1.0, graph contractVersion=2.1.0, existing readiness enum và URL TTL/storage semantics. Không thêm production verification fields hoặc giả provider mới. Optional legacy aliases có thể được điền giá trị khóa trong response dù không có trong stored manifest.

Thay đổi hành vi có chủ đích: manifest khai production READY/verified count sẽ nhận 500; trước đây có thể nhận 200/true. Manifest có zero verified claims và gates chưa sẵn sàng vẫn nhận 200 + URL tải. Các reason/alias trong response là quyết định API bảo thủ, không còn bản sao byte-for-byte của stored manifest. liveHazardReady không còn suy từ ATTACHED.

Contract chỉ hỗ trợ bundle fileName=BaseRoadGraph.json.gz. Raw JSON bundle không phải biến thể tải được hỗ trợ và bị 500 trước URL. JSON bên trong GZIP được parse trong download tests. Không thay graph/manifest artifact hoặc đổi contract sang version mới.

Digest/length và semantic graph validation sau download vẫn là trách nhiệm consumer được kiểm thử riêng; API không giả vờ đã làm bước đó. Production R2/error headers, Android parser và cache compatibility chưa được nghiệm thu trong task Backend-only.

## 9. Backend Call-Site Audit

Đã tìm toàn Backend source/test helpers với các chuỗi strictRoutingReady, canAttemptStrictRouting, overallStrictRoutingReadiness, edgeSafetySummary, VERIFIED_COMPATIBLE; loại node_modules/dist/generated artifacts khỏi source audit. Tests và docs được phân biệt khỏi runtime producer. Không tìm thấy Nest runtime consumer khác ngoài luồng controller/service dưới đây.

| File/dòng hiện hành | Producer/consumer | Trust boundary và kết luận |
|---|---|---|
| src/routing/routing.controller.ts:18 | Consumer của service, producer HTTP | Forward service response sau JWT/Roles guards; không tự cấp readiness; source giữ nguyên |
| src/routing/routing.service.ts:19 | Producer của quyết định API | DOWNLOAD_ONLY_READINESS nội bộ bất biến; mọi success response dùng cùng policy |
| src/routing/routing.service.ts:46 | Consumer của storage JSON, producer metadata/download | Validate → policy projection/rejection → URL; raw gates không xuất thành quyền |
| src/routing/routing.service.ts:67 | Boundary của unverified claims | Rejection không phụ thuộc hash hoặc claimed verified count làm bằng chứng; count dương là lý do từ chối |
| src/routing/routing.service.ts:148 | Alias method | Gọi lại cùng getCurrentRouting, không có đường tính readiness thứ hai |
| src/routing/routing.service.ts:157 | Schema parser | Public validateManifest không phải approval API; tìm call sites không có production consumer dùng nó để cấp quyền |
| src/routing/routing.types.ts:62 và :80 | Typed contracts | Boolean/enum không tự tạo provenance; file giữ nguyên |
| src/routing/storage/routing-storage.service.ts:121 | Storage consumer, producer raw manifest | Parse JSON, chưa phải trusted qualification; source giữ nguyên |
| src/routing/storage/routing-storage.service.ts:258 và :273 | HEAD/URL producer | Length check và presigned URL không chứng minh graph contents/authority; không thay storage |
| tools/osm-importer/src/vehicle-profile.ts:645 và :648 | Legacy compatibility/eligibility producer | **Blocker ngoài phạm vi:** OSM tag-based physical width/height checks vẫn có thể sinh VERIFIED_COMPATIBLE và eligibility. Không tương đương authoritative qualification. Không sửa theo giới hạn task. |
| tools/osm-importer/src/osm-importer.ts:472, :501 | Consumer của legacy classification | Copy profileCheck compatibility/eligibility vào cạnh; diagnostics đếm từ classifications, không phải proof chain |
| tools/osm-importer/src/osm-importer.ts:754, :774, :788 | Summary/graph readiness producer | Có thể sinh raw canAttemptStrictRouting/READY từ counts/restrictions. Đây là raw artifact metadata, không được consumer coi production approved. Endpoint mới từ chối claims này. |
| tools/osm-importer/cli.ts:203, :206, :207 | Raw graph consumer, manifest producer | Copy graph readiness/summary vào artifact và logs; source giữ nguyên; direct artifact consumers cần audit riêng |
| tools/osm-importer/src/types.ts:48, :208, :329 | Legacy graph/manifest contracts | Có vocabulary VERIFIED_COMPATIBLE và readiness aliases; type không phải proof of authority |
| tools/osm-importer/src/edge-qualifier.ts:92 và :97 | Diagnostic qualification producer | Literal DIAGNOSTIC_ONLY/UNAVAILABLE/UNVERIFIED/isProductionApproved=false; source và regressions giữ nguyên |
| tools/osm-importer/src/qualification-provider-readiness.ts:61 và :275 | TEST_ONLY readiness producer | productionReady=false, overallProductionReadiness=BLOCKED; không tích hợp để cấp API trust |
| test/fixtures/routing/http-harness.ts:413 | Test consumer | Kiểm tra trực tiếp đầy đủ response gates. Consumer trả UNVERIFIED riêng không được dùng che API bug. |

Các controller unit tests còn có mock service trả true để kiểm tra forwarding. Đó không phải runtime source hoặc bằng chứng safety; HTTP tests chạy RoutingService/JWT/guards thật mới xác nhận boundary hiện tại.

**Giới hạn quan trọng:** bản sửa không viết lại fields bên trong GZIP hoặc raw artifact tải trực tiếp. Legacy importer/CLI vẫn là blocker cho consumer tin raw graph eligibility. Không tuyên bố toàn bộ pipeline raw graph đã được remediation. P5-A01 phải rà các nơi Android đọc raw graph/manifest flags; hiện Android NEEDS_VERIFICATION.

## 10. HTTP Regression Results

Final command:

```bash
npm run test:e2e -- --runInBand --runTestsByPath test/routing-http-auth.e2e-spec.ts test/routing-http-fixture.e2e-spec.ts test/routing-http-download.e2e-spec.ts --json --outputFile=/tmp/p5i01r-e2e-results.json
```

**Exit 0; 80/80 tests, 3/3 suites PASS; Jest 3.016s; zero skipped/pending/snapshots.** Chạy loopback/random ports với quyền local listener như P5-I01, không gọi cloud/Internet, không override guards hoặc JWT validation. Không có automatic approval rejection.

| Suite | Cases | Bằng chứng |
|---|---:|---|
| HTTP auth | 20 | 401/403 và approved RESCUER/ADMIN/MODERATOR thật; ba role được phép đều nhận mọi strict alias khóa |
| HTTP fixture/manifest | 38 | Hai B1 acceptance, malformed/missing fields, claims/counters/aliases, provider/receipt injection, repeated requests, stale/future metadata, hazard, raw JSON unsupported |
| HTTP download | 22 | Bytes thật/hash/length/GZIP, version/profile/schema mismatch, corruption/truncation, 404/500/503/403, expiry/signature/Content-Type/TCP abort |

Giữ đủ 67 cases có trước task; thêm 13 cases. Không tính lần chạy lặp 78 cases trong development thành test mới. statusOf hiện assert cả top-level và nested readiness trước mọi successful fixture/download case; do đó lỗi download không được dùng để bỏ qua API gate assertions.

Matrix bắt buộc: canAttempt true + unverified=1 → 500; READY + verified=1 + raw GZIP UNVERIFIED → 500; READY + verified=0 → 500; missing summary → 500 schema error; self-inconsistent aliases/count claims → 500; đúng digest nhưng thiếu authority → không được cấp quyền; valid UNVERIFIED GZIP → 200 download-only; unavailable/storage failures → lỗi HTTP không có quyền strict; hazard UNKNOWN → 500; hazard ATTACHED → liveHazardReady=false + strict lock; missing provider/proof → lock; invalid timestamp → 500, stale/future parseable timestamp → download-only + consumer freshness rejection.

JSON/GZIP handling vẫn theo contract: .json.gz được hỗ trợ; raw .json bundle bị từ chối. Response errors chỉ có error envelope, không có raw readiness grants. Repeated HTTP requests giữ cùng quyết định và không mutate stored manifest.

## 11. Unit Regression Results

Final targeted routing: **33/33 tests, 3/3 suites PASS**, exit 0, Jest 1.270s. Tăng từ 32 do thêm frozen storage/deep clone case. Service cases 6/7/8 không còn chấp nhận claims cấp quyền; case 10 không còn cấp live hazard readiness từ metadata.

```bash
npm test -- --runInBand --json --outputFile=/tmp/p5i01r-unit-results.json
```

**Exit 0; 1.074/1.074 tests, 43/43 suites PASS; Jest 19.324s; zero skipped/pending/snapshots.** Toàn bộ engine/foundation/crypto/revocation/proof/provider/importer safety regressions vẫn chạy. Experimental VM Modules và SosService mock Firebase warning/debug là output của suites cũ, không phải kết nối provider production.

Full default Jest không tự chạy .e2e-spec.ts. Tổng distinct cases trong hai final commands: **1.154 trên 46 suites** = 1.074 regression + 80 HTTP E2E; không cộng targeted reruns thêm lần nữa.

## 12. Typecheck/Build

| Lệnh | Exit | Kết quả |
|---|---:|---|
| npx --no-install tsc --project tools/osm-importer/tsconfig.json --noEmit | 0 | PASS |
| npx --no-install tsc --project test/tsconfig.routing-http.json --pretty false | 0 | PASS production source và focused HTTP tests |
| npx --no-install nest build | 0 | PASS |
| git diff --check | 0 | PASS |

Các checks thực hiện sau thay đổi implementation cuối. Không thêm dependency, mock production verification hoặc thay config để bỏ checks. Root aggregate typecheck không chạy lại và không được tuyên bố PASS: P5-I01 đã ghi lỗi migrations/specs/CLI ngoài phạm vi; task này không sửa chúng. Không chạy lại golden oracle vì geometry/contracts không đổi; không tính kết quả task trước thành lần chạy mới.

## 13. Artifact Preservation

255 files chụp đầu task: năm thay đổi đúng allowlist nêu mục 6; **250/250 files còn lại nguyên SHA-256 và mtime_ns**, gồm cả docs trước, controller/auth/storage, importer/CLI/qualification sources/tests và 20 artifacts. Snapshot ngay trước/sau full suite: **255/255 không đổi trong khi test chạy**.

Importer isolation được đọc lại trước full suite: mkdtemp owned root, output overrides, cleanup đúng thư mục sở hữu và afterAll artifact guard. HTTP fixtures trong memory/loopback; không ghi output directories. Không thêm graph artifact mới.

Baseline artifact table cuối báo cáo lưu 20 digest/ns trước=sau. Five authorized files có bảng before/after riêng để phân biệt remediation với mutation do test. Build cache tsconfig.build.tsbuildinfo đã dirty trước task, không thuộc protected source/artifact promise. Không reset cache hoặc dữ liệu người dùng.

Local output-dryrun-task3b vẫn 16.651 cạnh UNVERIFIED và graph canAttemptStrictRouting=false theo dữ liệu được bảo toàn. Không suy từ local snapshot rằng remote deployment đã được kiểm tra. Không đổi graph/manifest bytes, contract 2.1.0 hoặc nâng cạnh.

## 14. Remaining Blockers

- **Ngoài API scope:** legacy classifier vehicle-profile.ts:645/648 và importer.ts:774/788 vẫn có đường sinh VERIFIED/READY từ tag/count metadata. Không sửa vì user cấm sửa importer. API mới từ chối claims đó; direct artifact consumers vẫn cần remediation/review riêng. Không phát hành lại artifact để che blocker.
- Chưa có production-authoritative graph/qualification/hazard verifier hoặc providers được tích hợp. API chủ động không có nhánh production unlock. PKI, legal/inventory/survey/calibration/vehicle, durable checkpoint/time và acceptance vẫn theo gap report.
- Chưa bổ sung freshness policy production cho timestamp cũ/future; schema parse hợp lệ có thể tải demo nhưng không được cấp readiness. Demo consumer freshness policy không phải production policy.
- API vẫn không tải/hash/decode graph; đó là download consumer/publication verification boundary. Hash/HEAD length không phải authority proof. R2/SigV4/runtime credentials không được kiểm tra trong task.
- JWT claim-schema validation trước production DB lookup và root aggregate typecheck errors đã được ghi ở P5-I01, chưa sửa trong phạm vi này. HTTP auth/roles behavior giữ nguyên.
- Android loader/raw graph gates, offline cache, UI và Kotlin parity chưa đọc/chạy: NEEDS_VERIFICATION. Các response được khóa không tự sửa cached/raw artifact behavior của Android.

## 15. Final Safety Acceptance

**PASS cho P5-I01R – hai false-safe API cases đã bị chặn.**

1. I01-B1a không còn trả canAttemptStrictRouting=true từ manifest khi summary có cạnh UNVERIFIED: HTTP 500 trước URL generation.
2. I01-B1b không còn trả strictRoutingReady=true từ READY/verified-count claims dù digest khớp GZIP có cạnh UNVERIFIED: HTTP 500 trước URL generation.
3. Mọi successful RoutingService response dùng quyết định khóa chung; top-level/nested strict fields và aliases không có true/READY. liveHazardReady cũng false khi chưa có nguồn được xác thực. downloadAvailable có thể true, chỉ phản ánh download lifecycle.
4. Không có config/role/hash/TEST_ONLY/self-claimed provider để đổi production readiness. Unknown approval fields không được forward theo response projection. Rejected response không có raw manifest grants.
5. Auth/roles, HTTP faults, full safety regression, focused typechecks/build và artifact preservation PASS; không sửa source production ngoài service được cho phép.

Quyết định này áp dụng cho metadata API boundary, không khẳng định raw graph/importer hoặc consumer Android đã an toàn production. Bốn bất biến engine vẫn DIAGNOSTIC_ONLY/UNAVAILABLE/UNVERIFIED/isProductionApproved=false; source giữ nguyên. Production routing vẫn bị khóa và chưa được nghiệm thu sử dụng cứu hộ thực tế.

## 16. Android Consumer Implications

Backend endpoint vẫn GET /routing/current, Bearer JWT; stored ADMIN/MODERATOR hoặc RESCUER APPROVED. Response shape/version, bundle digest/length/GZIP và URL TTL không đổi. Android cần xử lý 500 cho metadata khai READY/verified khi thiếu authority, không retry vô hạn hoặc dùng cached true để vượt lỗi.

Không coi response.manifest là bản sao stored artifact: readiness là view đã khóa. Không dùng raw graph.canAttemptStrictRouting, graph.isStrictRoutingEligible, graph.compatibilityStatus hoặc restriction READY để vượt quyết định API. Raw artifacts không được viết lại trong remediation này và legacy producer vẫn cần audit.

ATTACHED/hazard version chỉ là metadata; liveHazardReady=false không được UI đổi thành live-safe vì thấy ATTACHED. Các giá trị NOT_READY_NO_VERIFIED_EDGES và alias false phải được hiển thị phù hợp với demo chưa kiểm định. Download success/integrity không phải chứng nhận physical truth.

Chưa có bằng chứng Android hiện hành đáp ứng các yêu cầu trên. Không đọc, sửa hoặc chạy repository Android trong task này; cached/offline assumptions đều NEEDS_VERIFICATION.

## 17. Recommendation for P5-A01

Giao task riêng kiểm tra Android consumer bằng response/fixture contract hiện hành: tìm mọi strict gate và alias, graph/raw artifact bypass, cached readiness khi API 500/offline, hazard UI, hash/length/GZIP/identity/version validation và expired URL behavior. Chạy device/emulator HTTP E2E và Kotlin/TypeScript golden parity trong phạm vi được ủy quyền.

Ưu tiên kiểm tra các nơi tin legacy VERIFIED_COMPATIBLE/tag-derived readiness và đề xuất task producer remediation riêng nếu cần. Không tự sửa Android hoặc importer ở đây. P5-I01R dừng sau report; không P5-A01/5C.2E, production provider, deploy, commit hoặc push.

## Phụ lục A – Protected artifacts

SHA-256 và mtime_ns trước = sau full regression:

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

## Phụ lục B – Five authorized file changes

SHA-256/mtime_ns trước task và sau implementation; sau implementation = pre-full = post-full.

| File | SHA-256 trước | SHA-256 sau | mtime_ns trước | mtime_ns sau |
|---|---|---|---|---|
| src/routing/routing.service.spec.ts | 071c1f704b91421d148a0c1606defe1ae31a9d65b7a5f33477a2e17894306f4c | 5a1a3935954bc87390d5ae4213842f71a6f3be2d9a918bd10b19286efd1c716d | 1793802553615275633 | 1793973031440102903 |
| src/routing/routing.service.ts | ebd52441cfc005589eb8877d79624fea79277cb78c8aa6197510bec11be4d560 | b8c4b7583f6658740b00cd25c3b1cb7a6abd2358760e5b4e90fc09b4a7e9e656 | 1793802553615371966 | 1793973104263184504 |
| test/fixtures/routing/http-harness.ts | 9a1d9f60b8006d0d026c8863dfcac07209aa646f1a49813498cfba783188dfe2 | a465556cfe01ea8d1d94a38e076f8b81397ebe8a00b69bdbbd9abf9668549f3c | 1793970125405663004 | 1793972963562026843 |
| test/routing-http-auth.e2e-spec.ts | 50e1f394e3d6b5629eeb0eb08b8d4a97ba85d1b81695ecc00fb4db24fdb02780 | 2b5c5e15f2911a096dc3ff4ac1277c5f1a791ddf6763c9c16bd4fac1cf0839de | 1793970125440663067 | 1793972963604026890 |
| test/routing-http-fixture.e2e-spec.ts | 42520b31c994a4c6761fa58f27e54a6a589f0493fd415ca8ee8330a8cf0a01d7 | de2336275ef79bb13ea53ab0d6103320d382871fdc44238245557b69983d2b0c | 1793970156922719049 | 1793973104321184569 |
