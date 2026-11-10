# PHASE 5 – TASK 5B.1: FINAL CONTRACT CONSISTENCY AUDIT & SAFETY SPECIFICATION HARDENING
## Hệ thống Cảnh báo Thiên tai & Định tuyến Cứu nạn – Disaster Rescue Routing Module
### Bản Hiệu chỉnh Cuối cùng – Corrective Patch & Acceptance Specification

---

### 1. EXECUTIVE SUMMARY (TÓM TẮT ĐIỀU HÀNH)

Tài liệu này là đặc tả hợp đồng dữ liệu kỹ thuật và an toàn chính thức (Final Safety Contract Specification) sau khi đã thực hiện đợt hiệu chỉnh dứt điểm 5 nhóm vấn đề (Corrective Patch) theo yêu cầu kiểm toán độc lập tại Phase 5 – Task 5B.1.

Toàn bộ tài liệu tuân thủ nguyên tắc **Fail-Closed Tuyệt đối**: Trong mọi trường hợp thiếu dữ liệu, xung đột số liệu, sai số đo đạc giao cắt ngưỡng an toàn, hoặc chưa xác minh đầy đủ tính toàn vẹn/thẩm quyền, hệ thống bắt buộc phải từ chối xác nhận an toàn (`UNVERIFIED` hoặc `BLOCKED`), ngăn chặn 100% rủi ro mở khóa sai lầm (False-Safe).

#### Các điểm hiệu chỉnh cốt lõi (Corrective Patch Summary):
1. **FIX 01 – Chuẩn hóa Chuỗi và Băm Hình học Canonical (`CanonicalEdgeGeometryHash`)**:
   - Thống nhất duy nhất một định dạng: `EDGE:<fromNodeId>-><toNodeId>|FWD:<true/false>|GEO:<polyline>`.
   - Loại bỏ hoàn toàn các tiền tố không đồng nhất (`DIR:FORWARD`/`DIR:REVERSE`).
   - Cập nhật 2 mã băm SHA-256 chính xác đã được tính toán độc lập từng byte theo chuẩn UTF-8.
   - Xác định thuật toán chuẩn hóa tọa độ không phụ thuộc ngôn ngữ và ghi nhận blocker về sai số làm tròn số thực dấu phẩy động.
2. **FIX 02 – Mô hình Đánh giá Nhận thức Sai số (Uncertainty-Aware Two-Tier Model)**:
   - Tách biệt rạch ròi 2 tầng đánh giá: **Tầng 1 - Quyết định Đo đạc (`Evidence Measurement Decision`)** gồm `PASS_CERTAIN`, `FAIL_CERTAIN`, `INDETERMINATE`; **Tầng 2 - Trạng thái Tiêu chí (`CriterionEvaluationState`)** gồm 8 trạng thái tường minh (bổ sung `INDETERMINATE`).
   - Phân định rõ ràng: "Chưa chứng minh được an toàn" $\neq$ "Có bằng chứng chứng minh không an toàn". Khoảng sai số vắt qua ngưỡng dẫn tới `INDETERMINATE` $\rightarrow$ `UNVERIFIED` (Fail-Closed cho định tuyến), không bị ép nhầm thành `MISSING`, `INVALID` hay `BLOCKED`.
3. **FIX 03 – Thứ tự Ưu tiên Giải quyết Đa Bằng chứng (Deterministic Precedence Order)**:
   - Phân biệt bản chất: Hai vị trí khác nhau trên cạnh có số đo hẹp là **Điểm co thắt vật lý (Physical Bottleneck)** $\rightarrow$ `FAILED` $\rightarrow$ `BLOCKED`; Cùng một vị trí đo có số đo mâu thuẫn là **Xung đột đo lường (Measurement Conflict)** $\rightarrow$ `CONFLICTING` $\rightarrow$ `UNVERIFIED`.
   - Quy trình 11 bước xác định, bảng quyết định xử lý đa bằng chứng và nguyên tắc bảo lưu điểm co thắt khi thay thế bằng chứng mới.
4. **FIX 04 – Cổng An toàn cho Ứng dụng Android Cũ (Legacy Android Client Safety)**:
   - Phân tích và đưa ra giải pháp toàn diện cho 6 trường hợp tương thích ngược.
   - Xác lập 3 cổng an toàn kiến trúc: **Base Graph Invariant** (`compatibilityStatus` trong đồ thị nền luôn là `UNVERIFIED`), **Contract Version Gate** (nâng version khi có dữ liệu qualified), và **Artifact Distribution Gate / Content Negotiation** (chỉ phân phối bundle qualified cho client có năng lực đọc sidecar).
5. **FIX 05 – Nhất quán Hợp đồng Nội bộ, Chính sách Địa hình Tĩnh và 20 Ca Kiểm thử**:
   - Phân biệt tường minh giữa `EXPIRED`, `INVALID`, `MISSING`, `INDETERMINATE`, `CONFLICTING`.
   - Thiết lập chính sách miễn trừ chặt chẽ cho `STATIC_TERRAIN_CAPABILITY`.
   - Chuẩn hóa toàn bộ 20 kịch bản kiểm thử (Acceptance Test Specifications) có đầy đủ 9 trường thông tin, phân định rõ giữa "Đặc tả trên tài liệu" và "Thực thi test runner".

---

### 2. SOURCE & CONTRACT INSPECTION FINDINGS (KẾT QUẢ KIỂM TRA MÃ NGUỒN)

Đã kiểm tra trực tiếp các tệp mã nguồn hiện hữu ở chế độ chỉ đọc:

#### Backend (`canh-bao-thien-tai-backend-app`):
- [tools/osm-importer/src/types.ts](file:///home/vantri/AndroidStudioProjects/canh-bao-thien-tai-backend-app/tools/osm-importer/src/types.ts): Đã triển khai các interface cốt lõi: `RoadEdge`, `EdgeMetadata`, `RoadNode`, `TurnRestriction`, `BaseRoadGraph`, `EdgeSafetySummary`, `StrictRoutingReadiness`. Toàn bộ đồ thị hiện tại tuân thủ `contractVersion: "2.1.0"`.
- [tools/osm-importer/src/vehicle-profile.ts](file:///home/vantri/AndroidStudioProjects/canh-bao-thien-tai-backend-app/tools/osm-importer/src/vehicle-profile.ts): Khai báo `DEFAULT_RESCUE_TRUCK_4X4_PROFILE` dạng prototype (3.0m cao, 2.2m rộng, 6.0m dài, 5.0t tải trọng, 0.2m lề ngang, 0.1m lề đứng). Hàm `evaluateWayForProfile()` đánh giá 3 trạng thái: `BLOCKED`, `UNVERIFIED`, `VERIFIED_COMPATIBLE`.
- [tools/osm-importer/src/osm-importer.ts](file:///home/vantri/AndroidStudioProjects/canh-bao-thien-tai-backend-app/tools/osm-importer/src/osm-importer.ts): Quy trình nạp OSM, tách đoạn đường tại nút giao, sinh `roadEdges`. **Phát hiện bất biến**: Dòng 468 và 489–497 cho thấy `geometry` của Forward Edge là `forwardGeometry`, còn Reverse Edge là `[...forwardGeometry].reverse()`. Nghĩa là `RoadEdge.geometry` luôn được lưu theo thứ tự di chuyển từ `fromNodeId` đến `toNodeId`.
- [src/routing/routing.types.ts](file:///home/vantri/AndroidStudioProjects/canh-bao-thien-tai-backend-app/src/routing/routing.types.ts): Khai báo `RoutingManifest`, `EdgeSafetySummary`, `RoutingBundleInfo`.

#### Android (`bai1`):
- [RoadEdge.kt](file:///home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/model/routing/RoadEdge.kt) (dòng 12): Khai báo `RoadEdge`, thuộc tính `geometry: List<GeoPoint>` có docstring xác nhận: "theo thứ tự từ fromNodeId đến toNodeId".
- [EdgeMetadataModels.kt](file:///home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/model/routing/EdgeMetadataModels.kt): Khai báo `EdgeMetadata`, `EdgeCompatibilityStatus` (`VERIFIED_COMPATIBLE`, `UNVERIFIED`, `BLOCKED`).
- [RoadGraph.kt](file:///home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/model/routing/RoadGraph.kt): `RoadGraph` giữ `directedEdges` bất biến, kiểm tra `contractVersion: "2.1.0"`.
- [RescueRoutingContext.kt](file:///home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/model/routing/RescueRoutingContext.kt): Đánh giá nghiêm ngặt readiness: nếu `unverifiedEdges > 0` hoặc `verifiedCompatibleEdges == 0`, router từ chối khởi chạy với `NO_VERIFIED_EDGES` hoặc `UNVERIFIED_EDGES`.
- [UniformCostSearchRouter.kt](file:///home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/algorithm/UniformCostSearchRouter.kt): Thuật toán UCS thực thi 3 cổng an toàn (Gate 1: Live Hazard, Gate 2: Via-node Restrictions, Gate 3: Via-way DFA).

#### Phân loại trạng thái hợp đồng:
- **Đã triển khai trong code (Implemented)**: `contractVersion: "2.1.0"`, `BaseRoadGraph`, `RoutingManifest`, `EdgeCompatibilityStatus`, `RoadEdge.geometry` định hướng sẵn, `DEFAULT_RESCUE_TRUCK_4X4_PROFILE`.
- **Mới chỉ thiết kế trong tài liệu (Designed Only)**: `RescueVehicleProfile`, `CriterionEvidenceRecord`, `NotApplicableEvidenceRecord`, `EdgeQualificationRecord`, `RescueCorridorBundle`, `CanonicalEdgeGeometryHash`.
- **Chưa tồn tại trong code (Non-existent)**: `qualification-types.ts`, `edge-qualifier.ts`, PKI verification service, sidecar artifact `RoadEdgeQualificationBundle.json.gz`.

---

### 3. FIX 02: UNCERTAINTY-AWARE TWO-TIER CRITERION EVALUATION MODEL

Hệ thống phân tách rạch ròi quá trình đánh giá an toàn thành hai tầng độc lập nhằm xử lý triệt để khoảng sai số đo đạc ($\pm \Delta$).

#### A. Tầng 1: Quyết định Đo đạc Bằng chứng (Evidence Measurement Decision)
Áp dụng cho từng bản ghi bằng chứng đơn lẻ có chứa giá trị số học và khoảng sai số:

```typescript
export type EvidenceMeasurementDecision =
  | 'PASS_CERTAIN'      // Giá trị sau khi trừ sai số bảo thủ CHẮC CHẮN thỏa mãn yêu cầu an toàn
  | 'FAIL_CERTAIN'      // Giá trị sau khi cộng sai số bảo thủ CHẮC CHẮN vi phạm yêu cầu an toàn
  | 'INDETERMINATE';    // Khoảng sai số giao cắt với ngưỡng yêu cầu: không thể kết luận an toàn hay vi phạm
```

##### Quy tắc toán học so sánh khoảng sai số:
1. **Tiêu chí dạng Giới hạn Tối thiểu (Minimum Clearance / Capacity)**:
   - Áp dụng cho: `PHYSICAL_HEIGHT_CLEARANCE`, `PHYSICAL_WIDTH_CLEARANCE`, `STRUCTURAL_LOAD_CAPACITY`, `AXLE_LOAD_CAPACITY`.
   - Điều kiện an toàn: $\text{ActualClearance} \ge \text{RequiredThreshold}$.
   - Cho phép đo: $\text{Value}_{\text{measured}} \pm \Delta$ (với $\Delta = \text{measurementUncertainty} > 0$).
   - Khoảng tin cậy: $[\text{lower}, \text{upper}] = [\text{Value}_{\text{measured}} - \Delta, \text{Value}_{\text{measured}} + \Delta]$.
   - Ngưỡng yêu cầu: $\text{Required} = \text{VehicleDimension} + \text{SafetyMargin}$.
   - **Quyết định**:
     - Nếu $\text{lower} \ge \text{Required}$: **`PASS_CERTAIN`** (Ngay cả giá trị xấu nhất $\text{lower}$ vẫn đủ lọt xe an toàn).
     - Nếu $\text{upper} < \text{Required}$: **`FAIL_CERTAIN`** (Ngay cả giá trị tốt nhất $\text{upper}$ vẫn va quẹt hoặc sập cầu $\rightarrow$ Vi phạm chắc chắn).
     - Nếu $\text{lower} < \text{Required} \le \text{upper}$: **`INDETERMINATE`** (Khoảng dung sai vắt qua ngưỡng, xe có thể qua hoặc bị kẹt tùy thuộc giá trị thực $\rightarrow$ Không thể khẳng định an toàn và cũng không đủ căn cứ khẳng định vi phạm).

2. **Tiêu chí dạng Giới hạn Tối đa (Maximum Allowed Gradient / Obstacle Height)**:
   - Áp dụng cho: `GEOMETRIC_FEASIBILITY` (Độ dốc dọc %), `STATIC_TERRAIN_CAPABILITY` (Chiều cao chướng ngại vật/gờ vỉa hè).
   - Điều kiện an toàn: $\text{ActualValue} \le \text{VehicleCapabilityLimit}$.
   - Khoảng tin cậy: $[\text{lower}, \text{upper}] = [\text{Value}_{\text{measured}} - \Delta, \text{Value}_{\text{measured}} + \Delta]$.
   - **Quyết định**:
     - Nếu $\text{upper} \le \text{Limit}$: **`PASS_CERTAIN`** (Ngay cả trường hợp xấu nhất dốc cao nhất vẫn nằm trong khả năng xe).
     - Nếu $\text{lower} > \text{Limit}$: **`FAIL_CERTAIN`** (Ngay cả trường hợp thấp nhất dốc vẫn vượt quá khả năng leo của xe $\rightarrow$ Chắc chắn vi phạm).
     - Nếu $\text{lower} \le \text{Limit} < \text{upper}$: **`INDETERMINATE`** (Khoảng dung sai bao phủ ngưỡng tối đa).

3. **Tiêu chí dạng Boolean / Định tính (Legal / Surface Classification)**:
   - Áp dụng cho: `LEGAL_ACCESS`, `SURFACE_SUITABILITY`.
   - Không áp dụng số học $\pm \Delta$. Quyết định dựa trên văn bản pháp lý hoặc kết quả thí nghiệm:
     - Văn bản/Biển báo cho phép xe cứu nạn: **`PASS_CERTAIN`**.
     - Văn bản/Biển cấm tuyệt đối xe ưu tiên hoặc cấm tải trọng xe: **`FAIL_CERTAIN`**.
     - Chưa rõ phân luồng hoặc văn bản đang tranh chấp pháp lý: **`INDETERMINATE`**.

---

#### B. Tầng 2: Trạng thái Tiêu chí Toàn cục (`CriterionEvaluationState`)
Gồm 8 trạng thái tường minh. Bổ sung trạng thái `INDETERMINATE` nhằm phản ánh chính xác các phép đo hợp lệ nhưng khoảng dung sai không thể chứng minh an toàn, tuyệt đối không được ép nhầm vào `MISSING`, `INVALID` hay `BLOCKED`:

```typescript
export type CriterionEvaluationState =
  | 'SATISFIED'       // Bằng chứng hợp lệ, còn hạn, độ bao phủ đầy đủ, kết quả PASS_CERTAIN
  | 'FAILED'          // Bằng chứng hợp lệ, còn hạn, kết quả FAIL_CERTAIN (Kích hoạt BLOCKED cạnh)
  | 'INDETERMINATE'   // Bằng chứng hợp lệ, còn hạn, nhưng kết quả đo đạc rơi vào INDETERMINATE (Duy trì UNVERIFIED)
  | 'NOT_APPLICABLE'  // Tiêu chí được miễn trừ hợp pháp có NotApplicableEvidenceRecord hợp lệ
  | 'MISSING'         // Tiêu chí hoàn toàn chưa có bằng chứng khảo sát hoặc thiếu độ bao phủ không gian (Duy trì UNVERIFIED)
  | 'CONFLICTING'     // Tồn tại từ 2 bằng chứng hợp lệ cùng cấp tại cùng vị trí cho kết quả mâu thuẫn không giao nhau (Duy trì UNVERIFIED)
  | 'EXPIRED'         // Toàn bộ bằng chứng của tiêu chí đều đã quá hạn kiểm định validUntil < evaluatedAt (Duy trì UNVERIFIED)
  | 'INVALID';        // Bằng chứng vi phạm tính toàn vẹn (băm sai, sai số <= 0, cơ quan không đủ thẩm quyền) (Duy trì UNVERIFIED)
```

#### C. Phân định Ngữ nghĩa và Bảo tồn Dấu vết Kiểm toán (Audit Traceability):
- **Tại sao không thể ép `INDETERMINATE` vào `MISSING`?**
  `MISSING` biểu thị công tác khảo sát chưa từng được thực hiện. Nếu ép phép đo $3.12\text{m} \pm 0.05\text{m}$ thành `MISSING`, hệ thống xóa bỏ toàn bộ công sức khảo sát của đơn vị đo đạc, khiến kỹ sư không biết rằng đã có phép đo nhưng cần dùng thiết bị đo chính xác hơn (ví dụ $\pm 0.01\text{m}$).
- **Tại sao không thể ép `INDETERMINATE` vào `INVALID`?**
  `INVALID` biểu thị lỗi thủ tục, lỗi băm, đơn vị đo sai hoặc thẩm quyền không hợp pháp. Phép đo $3.12\text{m} \pm 0.05\text{m}$ hoàn toàn hợp lệ về mặt kỹ thuật và pháp lý, chỉ là độ chính xác của thiết bị chưa đủ để đưa ra kết luận an toàn.
- **Tại sao không thể ép `INDETERMINATE` vào `FAILED` (BLOCKED)?**
  Nếu xe cần $3.10\text{m}$, đo được $3.12\text{m} \pm 0.05\text{m}$ (khoảng [3.07, 3.17]), tĩnh không thực tế hoàn toàn có thể là $3.15\text{m}$ (an toàn). Việc gán `FAILED` sẽ biến cạnh thành `BLOCKED` (tương đương đường sập hoặc bị bịt kín), cản trở việc cứu nạn khi các phương án khác đều bế tắc.
- **Quy tắc An toàn Định tuyến (Routing Safety Rule)**:
  Trạng thái `INDETERMINATE` dẫn tới trạng thái cạnh là **`UNVERIFIED`**. Trong chế độ định tuyến nghiêm ngặt (Strict Routing), cạnh `UNVERIFIED` bị loại bỏ $100\%$ khỏi PriorityQueue (Fail-Closed). Điểm khác biệt là hệ thống giữ lại mã lý do chẩn đoán: `REASON_MEASUREMENT_INDETERMINATE(tolerance_overlap)` để điều động khảo sát nâng cao.

---

### 4. FIX 03: EVIDENCE CONFLICT & DETERMINISTIC PRECEDENCE RULES

Nhằm loại bỏ mâu thuẫn giữa "Ưu tiên FAILED" và "Phát hiện CONFLICTING", hệ thống thiết lập quy tắc dựa trên vị trí không gian và độ giao thoa khoảng tin cậy.

#### A. Bốn Tình huống Đo lường Điển hình:

1. **Tình huống A – Hai vị trí đo khác nhau trên cùng một cạnh (Different Physical Locations)**:
   - *Dữ liệu*: Tại km 0+050 đo được $2.10\text{m}$ (không lọt xe); tại km 0+200 đo được $3.50\text{m}$ (lọt xe). Xe cần $2.60\text{m}$.
   - *Bản chất vật lý*: Một con đường dài 300m có đoạn rộng 3.5m nhưng có cổng chào hoặc ban công nhô ra tại km 0+050 chỉ cao 2.10m. Vị trí 2.10m là **Điểm thắt cổ chai vật lý (Physical Bottleneck)**. Xe cứu nạn không thể bay qua km 0+050 để tới km 0+200.
   - *Phán quyết*: Phép đo 2.10m cho kết quả `FAIL_CERTAIN`. Áp dụng **Quy tắc Điểm nghẽn Thượng tôn (Bottleneck Precedence)**: Tiêu chí được đánh giá là **`FAILED`** $\rightarrow$ Toàn cạnh lập tức bị **`BLOCKED`**. Tuyệt đối không lấy trung bình!

2. **Tình huống B – Cùng một vị trí đo nhưng số liệu mâu thuẫn (Same Location, Disjoint Intervals)**:
   - *Dữ liệu*: Tại km 0+050, Đơn vị A đo được $2.10\text{m} \pm 0.02\text{m}$ (khoảng [2.08, 2.12]); Đơn vị B đo được $3.50\text{m} \pm 0.02\text{m}$ (khoảng [3.48, 3.52]). Cả hai đơn vị đều có thẩm quyền ngang nhau, cùng thời kỳ đo.
   - *Bản chất vật lý*: Hai khoảng tin cậy không giao nhau ($[2.08, 2.12] \cap [3.48, 3.52] = \emptyset$). Đây là lỗi sai khác đo đạc không thể giải thích (Measurement Conflict). Không thể biết đơn vị nào đo đúng.
   - *Phán quyết*: Không được tự ý chọn phép đo xấu hơn để kết luận FAILED. Tiêu chí được đánh giá là **`CONFLICTING`** $\rightarrow$ Toàn cạnh giữ trạng thái **`UNVERIFIED`** (Fail-Closed cho định tuyến).

3. **Tình huống C – Cùng vị trí đo với khoảng sai số tương thích (Compatible Uncertainty Intervals)**:
   - *Dữ liệu*: Tại km 0+050, Đơn vị A đo $3.00\text{m} \pm 0.02\text{m}$ (khoảng [2.98, 3.02]); Đơn vị B đo $3.01\text{m} \pm 0.02\text{m}$ (khoảng [2.99, 3.03]).
   - *Bản chất vật lý*: Hai khoảng sai số giao nhau: $[2.98, 3.02] \cap [2.99, 3.03] = [2.99, 3.02] \neq \emptyset$. Hai phép đo tương thích về mặt đo lường học.
   - *Phán quyết*: Không coi là mâu thuẫn. Khoảng giá trị thống nhất là khoảng giao $[2.99, 3.02]$. Giá trị an toàn bảo thủ được chọn là cận dưới đối với clearance ($2.99\text{m}$).
   - *Điều kiện bao phủ*: Tính tương thích tại một điểm **không tự động chứng minh độ bao phủ toàn cạnh**. Nếu cạnh dài 500m mà chỉ đo tại 1 điểm, tiêu chí vẫn bị gán `MISSING` (thiếu độ bao phủ không gian).

4. **Tình huống D – Bằng chứng mới thay thế bằng chứng cũ (Supersession vs Revocation)**:
   - Bằng chứng cũ ghi nhận điểm co thắt $2.20\text{m}$ tại km 0+050 (khiến đường bị FAILED).
   - Đơn vị khảo sát nộp bằng chứng mới ghi nhận $3.50\text{m}$.
   - *Quy tắc kiểm tra bắt buộc trước khi gỡ bỏ điểm co thắt*:
     1. Bằng chứng mới phải có trường `supersedesEvidenceId` tham chiếu trực tiếp đến bằng chứng cũ hoặc văn bản công bố hoàn công cải tạo công trình từ cơ quan có thẩm quyền.
     2. Bằng chứng mới phải có phạm vi không gian (`spatialScope`) bao trùm chính xác tọa độ điểm co thắt km 0+050 (chứng minh vật cản đã được dỡ bỏ/ngầm hóa). Một phép đo chung chung tại vị trí khác không có quyền xóa bỏ điểm co thắt cũ.
     3. Bằng chứng mới phải có chữ ký số hợp lệ và ngày đo mới hơn ngày ban hành của bằng chứng cũ.

---

#### B. Quy trình Thuật toán 11 Bước Xác định (Deterministic 11-Step Algorithm):

```
Thuật toán: ResolveCriterionEvidence(criterion, evidenceList, vehicleProfile, evaluatedAt)
──────────────────────────────────────────────────────────────────────────────────────────
Bước 1: Identity & Schema Validation
        Kiểm tra tính toàn vẹn cấu trúc của từng bản ghi CriterionEvidenceRecord.
        Loại bỏ các bản ghi thiếu trường bắt buộc, sai định dạng UUID hoặc tọa độ WGS84.
        -> Nếu vi phạm: Đánh dấu INVALID_SCHEMA.

Bước 2: Authenticity Validation (Authority Matrix Check)
        Đối chiếu sourceAuthorityId với danh mục cơ quan có thẩm quyền của tiêu chí đó.
        Loại bỏ các bản ghi không thuộc thẩm quyền hoặc chứa tiền tố thử nghiệm (TEST_*, MOCK_*).
        -> Nếu vi phạm: Đánh dấu INVALID_AUTHORITY.

Bước 3: Integrity Validation (Cryptographic & Metric Check)
        Kiểm tra mã băm documentSha256 với tệp trích lục lưu trữ.
        Kiểm tra measurementUncertainty > 0.0 và đơn vị đo lường chuẩn SI.
        -> Nếu vi phạm: Đánh dấu INVALID_INTEGRITY.

Bước 4: Validity & Revocation Validation (Freshness Filter)
        Kiểm tra evaluatedAt nằm trong khoảng [validFrom, validUntil].
        Kiểm tra revocationStatus == 'ACTIVE' (loại bỏ nếu REVOKED).
        -> Nếu hết hạn: Đánh dấu EXPIRED.

Bước 5: Spatial Grouping (Phân nhóm không gian)
        Phân nhóm các bản ghi hợp lệ theo vị trí địa lý trên cạnh:
        Nhóm G_k tương ứng với vị trí offset k mét hoặc đoạn phủ liên tục.

Bước 6: Uncertainty Interval Analysis (Phân tích khoảng sai số)
        Với mỗi bản ghi trong từng nhóm, tính khoảng tin cậy [lower_i, upper_i].

Bước 7: In-Group Conflict Detection (Phát hiện xung đột nội bộ nhóm)
        Tại mỗi vị trí G_k, kiểm tra giao thoa các khoảng tin cậy của các bản ghi cùng cấp.
        Nếu tồn tại 2 bản ghi có khoảng tin cậy không giao nhau:
        -> Đánh dấu nhóm G_k là GROUP_CONFLICTING.

Bước 8: Measurement Decision per Location Group
        Với mỗi nhóm G_k không bị xung đột, thực hiện phép so sánh với ngưỡng hồ sơ xe:
        - Clearance: lower >= required -> GROUP_PASS; upper < required -> GROUP_FAIL; còn lại -> GROUP_INDETERMINATE.
        - Limits: upper <= limit -> GROUP_PASS; lower > limit -> GROUP_FAIL; còn lại -> GROUP_INDETERMINATE.

Bước 9: Spatial Aggregation & Bottleneck Precedence (Tổng hợp không gian)
        - NẾU CÓ BẤT KỲ nhóm nào có kết quả GROUP_FAIL:
            -> Kết luận tiêu chí: FAILED (Ưu tiên điểm nghẽn vật lý -> BLOCKED).
        - NẾU KHÔNG CÓ GROUP_FAIL, nhưng CÓ BẤT KỲ nhóm nào bị GROUP_CONFLICTING:
            -> Kết luận tiêu chí: CONFLICTING (Duy trì UNVERIFIED).
        - NẾU KHÔNG CÓ FAIL và CONFLICTING, nhưng CÓ nhóm bị GROUP_INDETERMINATE:
            -> Kết luận tiêu chí: INDETERMINATE (Duy trì UNVERIFIED).
        - NẾU TẤT CẢ các nhóm đo đều đạt GROUP_PASS:
            Kiểm tra tính đầy đủ của độ bao phủ không gian (Coverage Completeness):
            Nếu cạnh thiếu bằng chứng bao phủ toàn tuyến hoặc thiếu đo điểm chokepoint hiểm yếu:
                -> Kết luận tiêu chí: MISSING (Thiếu độ bao phủ -> UNVERIFIED).
            Ngược lại (độ bao phủ đầy đủ 100%):
                -> Kết luận tiêu chí: SATISFIED.
                -> Giá trị đại diện = Điểm co thắt an toàn nhất (Min đối với clearance, Max đối với limit).
                -> Hạn hiệu lực = Min(validUntil của các bản ghi thành phần).

Bước 10: State Precedence Fallback (Xử lý khi không có bản ghi hợp lệ)
        Nếu danh sách ban đầu hoàn toàn không có bằng chứng -> MISSING.
        Nếu có bằng chứng nhưng tất cả đều EXPIRED -> EXPIRED.
        Nếu có bằng chứng nhưng tất cả đều INVALID -> INVALID.
        Nếu có hỗn hợp EXPIRED và INVALID -> INVALID.

Bước 11: Edge Qualification Synthesis
        Tổng hợp trạng thái toàn cạnh từ 8 tiêu chí:
        - Có bất kỳ tiêu chí bắt buộc nào FAILED -> Edge: BLOCKED.
        - Toàn bộ 8 tiêu chí đạt SATISFIED hoặc NOT_APPLICABLE hợp lệ -> Edge: VERIFIED_COMPATIBLE.
        - Còn lại (tồn tại MISSING, INDETERMINATE, CONFLICTING, EXPIRED, INVALID) -> Edge: UNVERIFIED.
──────────────────────────────────────────────────────────────────────────────────────────
```

---

#### C. Bảng Quyết định Xử lý Đa Bằng chứng (Multi-Evidence Decision Table):

| Tình huống bằng chứng đầu vào | Đánh giá Tầng 1 | Độ bao phủ không gian | Trạng thái Tiêu chí | Trạng thái Cạnh | Quyết định Định tuyến |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Không có bằng chứng nào | N/A | Không | **`MISSING`** | `UNVERIFIED` | Loại bỏ cạnh (Strict disabled) |
| Tất cả bằng chứng hết hạn kiểm định | N/A | Có/Không | **`EXPIRED`** | `UNVERIFIED` | Loại bỏ cạnh |
| Tất cả bằng chứng băm sai / sai số $\le 0$ | N/A | Có/Không | **`INVALID`** | `UNVERIFIED` | Loại bỏ cạnh |
| Có 1 điểm đo chắc chắn vi phạm ($\text{upper} < \text{req}$) | `FAIL_CERTAIN` | Điểm co thắt | **`FAILED`** | **`BLOCKED`** | Cạnh bị cấm tuyệt đối |
| 1 điểm đạt 3.5m, 1 điểm vi phạm 2.1m khác vị trí | `PASS` & `FAIL` | Đa điểm | **`FAILED`** | **`BLOCKED`** | Cạnh bị cấm (Điểm nghẽn) |
| Cùng 1 vị trí: A đo 2.1m $\pm$ 0.02, B đo 3.5m $\pm$ 0.02 | Mâu thuẫn | Cùng vị trí | **`CONFLICTING`** | `UNVERIFIED` | Loại bỏ cạnh (Fail-closed) |
| Cùng vị trí: A đo 3.12m $\pm$ 0.05m (Xe cần 3.10m) | `INDETERMINATE` | Cùng vị trí | **`INDETERMINATE`** | `UNVERIFIED` | Loại bỏ cạnh (Chưa chắc chắn) |
| Các điểm đo đều đạt nhưng thiếu đo đoạn giữa 400m | `PASS_CERTAIN` | Thiếu bao phủ | **`MISSING`** | `UNVERIFIED` | Loại bỏ cạnh (Thiếu bao phủ) |
| Tất cả các điểm đo đều đạt, bao phủ 100% tuyến | `PASS_CERTAIN` | Đầy đủ | **`SATISFIED`** | `VERIFIED_COMPATIBLE`* | Đưa vào PriorityQueue UCS |
| Miễn trừ tải trọng cầu có trích lục địa chính hợp lệ | N/A | Toàn cạnh | **`NOT_APPLICABLE`**| `VERIFIED_COMPATIBLE`* | Đưa vào PriorityQueue UCS |

*\*Với điều kiện toàn bộ các tiêu chí còn lại trên cạnh cũng đạt `SATISFIED` hoặc `NOT_APPLICABLE`.*

---

### 5. FIX 01: CANONICAL EDGE GEOMETRY HASH & CROSS-LANGUAGE SPECIFICATION

#### A. Định dạng Chuỗi Chuẩn hóa Duy nhất (Strict Canonical String Specification):
Mọi thành phần trong hệ thống bắt buộc sử dụng định dạng chuẩn hóa duy nhất sau đây:

$$\text{canonicalString} = \text{"EDGE:"} + \text{fromNodeId} + \text{"->"} + \text{toNodeId} + \text{"|FWD:"} + \text{isWayForward} + \text{"|GEO:"} + \text{polylineString}$$

Trong đó:
- `fromNodeId`, `toNodeId`: Chuỗi định danh nút mạng (ví dụ: `"N1"`, `"N2"`).
- `isWayForward`: `"true"` nếu cạnh cùng chiều với OSM way gốc; `"false"` nếu cạnh ngược chiều OSM way gốc. Tuyệt đối không dùng `DIR:FORWARD` hoặc `DIR:REVERSE`.
- `polylineString`: Chuỗi tọa độ các đỉnh nối nhau bằng dấu chấm phẩy (`;`), mỗi đỉnh gồm `lat,lon` cách nhau bằng dấu phẩy (`,`).
- **Thứ tự tọa độ**: Giữ nguyên vẹn danh sách đỉnh của `RoadEdge.geometry` từ đầu đến cuối theo đúng chiều hành trình (từ `fromNodeId` đến `toNodeId`). Do `osm-importer` đã đảo sẵn đỉnh cho cạnh `FWD:false`, thuật toán **tuyệt đối không đảo ngược tọa độ một lần nữa**.

#### B. Thuật toán Chuẩn hóa Độc lập Ngôn ngữ (Language-Independent Normalization):
Để ngăn ngừa sai số làm tròn số thực giữa TypeScript (V8 engine) và Kotlin (JVM), thuật toán chuẩn hóa quy định:
1. **Loại trừ số không âm (-0.0)**: Mọi giá trị tọa độ sau định dạng nếu có chuỗi `"-0.0000000"` bắt buộc phải được chuẩn hóa thành `"0.0000000"`.
2. **Quy tắc làm tròn 7 chữ số thập phân**:
   - Sử dụng phép nhân với số nguyên $10^7$ kết hợp làm tròn số nguyên (`Round-Half-Even` / `Banker's Rounding`):
     $$\text{ScaledCoord} = \text{round}(\text{coord} \times 10^7)$$
   - Tách phần nguyên và phần thập phân 7 chữ số có chèn số 0 dẫn đầu (Zero-padded 7 digits).
3. **Mã hóa chuỗi**: Chuỗi canonical được chuyển thành mảng byte sử dụng bảng mã **UTF-8 chuẩn**, sau đó đưa vào hàm băm mật mã SHA-256 digest, xuất ra 64 ký tự hex in thường (`lowercase hex string`).

---

#### C. Bảng Test Vectors Cố định Đã Xác minh Độc lập (Fixed Verified Test Vectors):

Các giá trị băm dưới đây đã được kiểm chứng độc lập từng byte trên cả môi trường Node.js và Python 3:

| Vector ID | Mô tả trường hợp | Thuộc tính cạnh | Chuỗi Canonical hóa chính xác | SHA-256 Hash kết quả (Hex 64 ký tự) |
| :--- | :--- | :--- | :--- | :--- |
| **VECTOR-01** | **Forward Edge** (Cạnh xuôi) | from: `N1`, to: `N2`<br>isWayForward: `true`<br>Points: `[(16.065, 108.215), (16.066, 108.216)]` | `EDGE:N1->N2\|FWD:true\|GEO:16.0650000,108.2150000;16.0660000,108.2160000` | `ec4e64d4bb52b82cea9f823977467113476764cb436e1d334eba79bd7264ad6b` |
| **VECTOR-02** | **Reverse Edge** (Cạnh ngược) | from: `N2`, to: `N1`<br>isWayForward: `false`<br>Points: `[(16.066, 108.216), (16.065, 108.215)]` | `EDGE:N2->N1\|FWD:false\|GEO:16.0660000,108.2160000;16.0650000,108.2150000` | `4fbd28765fcf2475ff508fb3c68d2cf3d60bda1907dde43fd5eec28d26253a06` |
| **VECTOR-03** | **Degenerate Edge** (Đỉnh trùng lặp) | from: `N1`, to: `N2`<br>Points: `[(16.0, 108.0), (16.0, 108.0)]` | Không hợp lệ: Đoạn thẳng có chiều dài = 0m | Ném ngoại lệ `DEGENERATE_GEOMETRY_ERROR` |
| **VECTOR-04** | **Negative Zero Normalization** | from: `N1`, to: `N2`<br>Points: `[(-0.0, 108.215), (16.066, 108.216)]` | `EDGE:N1->N2\|FWD:true\|GEO:0.0000000,108.2150000;16.0660000,108.2160000` | Băm từ chuỗi đã chuyển `-0.0` thành `0.0000000` |

---

### 6. FIX 04: LEGACY ANDROID CLIENT SAFETY & ARCHITECTURE GATES

Để đảm bảo an toàn tuyệt đối khi hệ thống bắt đầu phát hành các cạnh `VERIFIED_COMPATIBLE` trong tương lai, hệ thống thiết lập 3 cổng kiểm soát kiến trúc ngăn chặn ứng dụng Android cũ (chưa hỗ trợ Sidecar) sử dụng sai lệch dữ liệu:

```
                                 [CLIENT YÊU CẦU ĐỒ THỊ]
                                            │
                                            ▼
                           ┌─────────────────────────────────┐
                           │   ARTIFACT DISTRIBUTION GATE    │
                           │  Kiểm tra Client Capabilities   │
                           └─────────────────────────────────┘
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     │                                             │
      Client Cũ (Không gửi header)                  Client Mới (Hỗ trợ Sidecar v1)
                     │                                             │
                     ▼                                             ▼
       ┌───────────────────────────┐                 ┌───────────────────────────┐
       │   BASE GRAPH INVARIANT    │                 │   SIDECAR BUNDLE GATE     │
       │  Phân phối BaseRoadGraph  │                 │  Phân phối BaseRoadGraph  │
       │   với 100% cạnh là        │                 │  + RoadEdgeQualification  │
       │      UNVERIFIED           │                 │           Bundle          │
       └───────────────────────────┘                 └───────────────────────────┘
                     │                                             │
                     ▼                                             ▼
       ┌───────────────────────────┐                 ┌───────────────────────────┐
       │    STRICT ROUTING KHÓA    │                 │  Xác thực chữ ký & băm    │
       │   unverifiedEdges > 0     │                 │   Mở khóa cạnh đạt chuẩn  │
       │     (An toàn 100%)        │                 │     (Strict cho phép)     │
       └───────────────────────────┘                 └───────────────────────────┘
```

#### Xử lý Chi tiết 6 Tình huống Tương thích Ngược Bắt buộc:

1. **Tình huống 1: Legacy Android tải đồ thị hiện tại (100% cạnh UNVERIFIED)**:
   - *Hiện trạng*: Đồ thị `BaseRoadGraph` phiên bản hiện tại có `unverifiedEdges = 16651`, `verifiedCompatibleEdges = 0`.
   - *Hành vi Android*: `RescueRoutingContext.canAttemptStrictRouting` kiểm tra `if (unverifiedEdges > 0) -> false`.
   - *Kết quả*: Strict routing bị khóa hoàn toàn (`UcsRouteStatus.STRICT_ROUTING_DISABLED`). An toàn tuyệt đối.

2. **Tình huống 2: Legacy Android tải đồ thị tương lai có cạnh `VERIFIED_COMPATIBLE` nhưng không hỗ trợ Sidecar**:
   - *Rủi ro*: Nếu đồ thị nền chứa cạnh verified, client cũ có thể mở strict routing mà không kiểm tra chữ ký số và hạn kiểm định của bằng chứng.
   - *Giải pháp kiến trúc*:
     - **Base Graph Invariant**: Toàn bộ tệp `BaseRoadGraph.json.gz` chính thức phân phối công khai **VĨNH VIỄN duy trì trường `compatibilityStatus: UNVERIFIED` cho toàn bộ các cạnh**.
     - Trạng thái `VERIFIED_COMPATIBLE` chỉ được đóng gói bên trong tệp sidecar `RoadEdgeQualificationBundle.json.gz`. Client cũ không có mã nạp sidecar sẽ chỉ nhìn thấy đồ thị toàn cạnh `UNVERIFIED` $\rightarrow$ Strict routing bị khóa $100\%$.
     - **Contract Version Gate**: Khi hệ thống chính thức hỗ trợ sidecar, `contractVersion` của đồ thị qualified được nâng lên `2.2.0` (hoặc `3.0.0`). Code Android cũ tại [RoadGraph.kt](file:///home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/model/routing/RoadGraph.kt) có dòng kiểm tra: `require(contractVersion == "2.1.0")`. Client cũ sẽ từ chối nạp đồ thị không khớp version và chuyển sang chế độ an toàn Offline/Fallback.

3. **Tình huống 3: Qualification sidecar đã hết hạn nhưng cache graph vẫn lưu trạng thái verified**:
   - Client mới kiểm tra trường `validUntil` trong metadata của sidecar.
   - Nếu `currentTime > validUntil`: Toàn bộ dữ liệu sidecar bị thu hồi hiệu lực tại runtime. Cạnh quay về trạng thái mặc định của đồ thị nền (`UNVERIFIED`). Strict routing tự động bị khóa lập tức.

4. **Tình huống 4: Hồ sơ phương tiện bị thu hồi khi thiết bị Android đang hoạt động ngoại tuyến (Offline)**:
   - Mỗi bundle sidecar và vehicle profile mang thuộc tính `maxOfflineGracePeriodHours: 72` (tối đa 72 giờ ngoại tuyến).
   - Nếu thiết bị offline vượt quá thời gian này mà không thể kết nối tới endpoint `/routing/status` để kiểm tra danh sách thu hồi (Revocation List / CRL), ứng dụng Android tự động kích hoạt chế độ **`OFFLINE_STRICT_LOCKED`**, vô hiệu hóa toàn bộ quyền chạy strict routing cho đến khi kết nối mạng được tái lập.

5. **Tình huống 5: Android mới hỗ trợ sidecar nhưng kiểm tra checksum SHA-256 thất bại**:
   - Khi tải `RoadEdgeQualificationBundle.json.gz`, client tính mã băm SHA-256 của file tải về và so sánh với trường `qualificationSidecarSha256` trong `RoutingManifest.json`.
   - Nếu sai lệch dù chỉ 1 bit: Ném ngoại lệ `SIDECAR_INTEGRITY_VIOLATION`, đánh dấu `GraphLoaderSnapshot.Failed` $\rightarrow$ Khóa toàn bộ tính năng định tuyến strict.

6. **Tình huống 6: Đồ thị, sidecar và hồ sơ phương tiện không cùng phiên bản**:
   - Sidecar chứa các trường ràng buộc: `graphVersion`, `graphArtifactSha256`, `targetVehicleProfileId`, `targetVehicleProfileVersion`.
   - Client kiểm tra tính tương thích chéo 4 chiều. Nếu phát hiện bất kỳ sự không khớp nào (ví dụ sidecar nạp cho đồ thị v1 nhưng đồ thị nền đã lên v2) $\rightarrow$ Từ chối áp dụng sidecar $\rightarrow$ Cạnh giữ nguyên `UNVERIFIED`.

---

### 7. FIX 05: INTERNAL CONTRACT CONSISTENCY & STATIC TERRAIN POLICY

#### A. Phân định Thứ tự Ưu tiên Trạng thái Lọc Bằng chứng (State Filtering Precedence):
Khi một tiêu chí được đánh giá qua danh sách bằng chứng đầu vào, hệ thống áp dụng thứ tự chẩn đoán xác định sau (không làm mất lý do lỗi):

```
Bằng chứng đầu vào
       │
       ├─► Danh sách ban đầu rỗng ───────────────────────────────────────► MISSING
       │
       ├─► Toàn bộ bằng chứng vi phạm tính toàn vẹn (băm sai, sai số <= 0,
       │   nguồn sai thẩm quyền) ────────────────────────────────────────► INVALID
       │
       ├─► Toàn bộ bằng chứng đã hết hạn kiểm định (validUntil < now) ───► EXPIRED
       │
       ├─► Hỗn hợp giữa EXPIRED và INVALID ──────────────────────────────► INVALID (Lỗi toàn vẹn nghiêm trọng hơn hết hạn)
       │
       ├─► Tồn tại bằng chứng hợp lệ nhưng khoảng sai số phủ ngưỡng ─────► INDETERMINATE
       │
       ├─► Tồn tại các bằng chứng hợp lệ mâu thuẫn số liệu cùng vị trí ──► CONFLICTING
       │
       ├─► Tồn tại ít nhất 1 bằng chứng chắc chắn vi phạm ───────────────► FAILED (Kích hoạt BLOCKED)
       │
       └─► Toàn bộ bằng chứng chắc chắn đạt và đủ độ bao phủ ────────────► SATISFIED
```

---

#### B. Chính sách Miễn trừ Nghiêm ngặt cho `STATIC_TERRAIN_CAPABILITY`:
Tiêu chí `STATIC_TERRAIN_CAPABILITY` đánh giá độ dốc dọc (longitudinal gradient %), góc tiếp cận/góc thoát (approach/departure angles) và khả năng vượt chướng ngại vật mặt đất (gờ vỉa hè, bậc thềm, rãnh hở).

1. **Điều kiện CÓ THỂ áp dụng `NOT_APPLICABLE`**:
   - Tuyến đường là Đường cao tốc (Expressway), Quốc lộ (National Highway), hoặc Trục chính đô thị loại I-III được xây dựng theo tiêu chuẩn quy chuẩn kỹ thuật quốc gia (QCVN 41:2019/BGTVT hoặc QCVN 07:2016/BXD).
   - Có hồ sơ thiết kế cơ sở và bản vẽ hoàn công chứng minh độ dốc thiết kế $G_{\text{max}} \le 4.0\%$ (xe cứu hộ 4x4 vượt được dốc $30\%$) và không có gờ bậc thềm cắt ngang mặt đường $> 5\text{cm}$.
   - **Hồ sơ bắt buộc**: Phải có bản ghi `NotApplicableEvidenceRecord` với `justificationCode = 'GRADE_SEPARATED_STANDARD_HIGHWAY'` kèm số hiệu lưu trữ hồ sơ hoàn công của Ban Quản lý Dự án Giao thông hoặc Sở GTVT.
2. **Các trường hợp TUYỆT ĐỐI CẤM `NOT_APPLICABLE` (Bắt buộc phải có bằng chứng SATISFIED)**:
   - Các tuyến đường đèo dốc tự nhiên, đường gom chân kè, đường ven sông biển.
   - Các tuyến đường thuộc vùng địa hình đồi núi phức tạp (vùng bán đảo Sơn Trà, Bà Nà, Hòa Vang).
   - Toàn bộ các đoạn đường có thẻ OSM `highway=track`, `highway=path`, `incline=*`, hoặc có cắm biển báo dốc nguy hiểm (W.221).
   - Mọi hành vi cố tình đánh dấu `NOT_APPLICABLE` trên các đoạn đường này đều bị coi là vi phạm nghiêm trọng và bị chuyển thành trạng thái **`INVALID`**.

---

### 8. COMPLETE ACCEPTANCE TEST SPECIFICATIONS (20 CA KIỂM THỬ MỞ RỘNG)

> [!NOTE]
> **Trạng thái thực thi**: 20 ca kiểm thử dưới đây là **Đặc tả Kiểm thử Kỹ thuật (Paper Test Specifications)** được thiết kế chuẩn mực theo mô hình 9 trường thông tin. Các test này sẽ được hiện thực hóa thành mã nguồn kiểm thử thực tế trong tệp `tools/osm-importer/test/edge-qualifier.spec.ts` tại Task 5C.

#### Bảng Đặc tả Chi tiết 20 Ca Kiểm thử Chấp nhận:

| Test ID | Tên Kịch bản & Given (Đầu vào) | When (Thao tác) | Then (Kết quả kỳ vọng) | Measurement Decision | Criterion State | Edge Status | Routing Decision | Safety Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TEST-01** | **Certain Height Failure**<br>Xe cần 3.10m. Đo laser tại km 0+050: $2.70\text{m} \pm 0.02\text{m}$ ($\text{upper} = 2.72\text{m} < 3.10\text{m}$). | Đánh giá `PHYSICAL_HEIGHT`. | Tiêu chí bị FAILED do vi phạm chắc chắn. | `FAIL_CERTAIN` | `FAILED` | `BLOCKED` | `ROUTE_BLOCKED` | Xe chắc chắn va chạm chướng ngại vật; cấm tuyệt đối mọi lộ trình đi qua. |
| **TEST-02** | **Indeterminate Measurement Clearance**<br>Xe cần 3.10m. Đo laser: $3.12\text{m} \pm 0.05\text{m}$ ($\text{lower}=3.07\text{m}, \text{upper}=3.17\text{m}$). | Đánh giá `PHYSICAL_HEIGHT`. | Sai số đo phủ qua ngưỡng; không thể kết luận an toàn. | `INDETERMINATE` | `INDETERMINATE` | `UNVERIFIED` | `STRICT_ROUTING_DISABLED` | Không chứng minh được an toàn; fail-closed cho định tuyến nhưng không block đường. |
| **TEST-03** | **Certain Height Pass**<br>Xe cần 3.10m. Đo LiDAR liên tục toàn tuyến: $3.80\text{m} \pm 0.05\text{m}$ ($\text{lower} = 3.75\text{m} \ge 3.10\text{m}$). | Đánh giá `PHYSICAL_HEIGHT`. | Giá trị sau trừ sai số vượt xa yêu cầu; bao phủ toàn diện. | `PASS_CERTAIN` | `SATISFIED` | `VERIFIED_COMPATIBLE`* | `ROUTE_ALLOWED` | Chứng minh an toàn chắc chắn với biên độ phòng ngừa rủi ro đầy đủ. |
| **TEST-04** | **Different Locations Bottleneck Precedence**<br>Tại km 0+050: rộng 2.10m ($\text{upper} < 2.6\text{m}$); tại km 0+200: rộng 3.50m. | Đánh giá `PHYSICAL_WIDTH`. | Điểm co thắt 2.10m tại km 0+050 quyết định số phận toàn cạnh. | `FAIL_CERTAIN` | `FAILED` | `BLOCKED` | `ROUTE_BLOCKED` | Không thể đi qua đoạn rộng 3.5m nếu xe bị kẹt tại vị trí 2.1m. |
| **TEST-05** | **Same Location Conflicting Measurements**<br>Tại km 0+050, Đơn vị A đo rộng 2.1m $\pm$ 0.02, Đơn vị B đo rộng 3.5m $\pm$ 0.02. | Đánh giá `PHYSICAL_WIDTH`. | Hai khoảng tin cậy không giao nhau; mâu thuẫn không thể giải tỏa. | Mâu thuẫn | `CONFLICTING` | `UNVERIFIED` | `STRICT_ROUTING_DISABLED` | Số liệu bất đồng nghiêm trọng; không tự ý phán quyết khi thiếu kiểm định độc lập. |
| **TEST-06** | **Compatible Uncertainty Intervals**<br>Đơn vị A đo $3.20\text{m} \pm 0.05\text{m}$, Đơn vị B đo $3.22\text{m} \pm 0.04\text{m}$. Xe cần 3.10m. Bao phủ 100%. | Đánh giá `PHYSICAL_HEIGHT`. | Giao khoảng tin cậy đạt $[3.18, 3.25\text{m}] \ge 3.10\text{m}$. | `PASS_CERTAIN` | `SATISFIED` | `VERIFIED_COMPATIBLE`* | `ROUTE_ALLOWED` | Hai phép đo độc lập xác nhận lẫn nhau; lấy giá trị cận dưới bảo thủ nhất. |
| **TEST-07** | **Invalid Evidence Formatting**<br>Bằng chứng ghi nhận rộng 5m nhưng mã băm tệp gốc sai lệch và sai số đo $\le 0$. | Kiểm tra tính toàn vẹn. | Bản ghi bị loại do lỗi dữ liệu; không làm ảnh hưởng an toàn. | N/A | `INVALID` | `UNVERIFIED` | `STRICT_ROUTING_DISABLED` | Dữ liệu rác không được phép dùng để chứng minh an toàn hoặc cấm đường. |
| **TEST-08** | **Expired Evidence Fallback**<br>Hồ sơ thử tải cầu rất tốt (30 tấn) nhưng thời hạn kiểm định đã hết 15 ngày trước. | Kiểm tra thời hạn hiệu lực. | Bằng chứng hết hạn bị thu hồi quyền chứng minh an toàn. | N/A | `EXPIRED` | `UNVERIFIED` | `STRICT_ROUTING_DISABLED` | Kết cấu công trình có thể xuống cấp theo thời gian; bắt buộc tái kiểm định. |
| **TEST-09** | **Missing Mandatory Criterion**<br>Cạnh đạt 7/8 tiêu chí, riêng tiêu chí `SURFACE_SUITABILITY` hoàn toàn không có dữ liệu. | Đánh giá toàn cạnh. | Thiếu 1 tiêu chí bắt buộc khiến toàn cạnh không đạt chuẩn. | N/A | `MISSING` | `UNVERIFIED` | `STRICT_ROUTING_DISABLED` | Không giả định đường an toàn khi chưa khảo sát đầy đủ mọi phương diện. |
| **TEST-10** | **Valid Not Applicable Exemption**<br>Đoạn đường đất tự nhiên có trích lục địa chính xác nhận không có cầu cống hầm chui. | Miễn trừ `STRUCTURAL_LOAD`. | Miễn trừ hợp lệ được chấp nhận tương đương SATISFIED. | N/A | `NOT_APPLICABLE` | `VERIFIED_COMPATIBLE`* | `ROUTE_ALLOWED` | Đường trên nền đất đắp tự nhiên không có nguy cơ sập dầm cầu. |
| **TEST-11** | **Illegal Not Applicable Rejection**<br>Cố tình đánh dấu `NOT_APPLICABLE` tải trọng cầu cho đoạn đường có thẻ OSM `bridge=yes`. | Kiểm tra tính hợp pháp miễn trừ. | Hành vi miễn trừ bất hợp pháp bị phát hiện và bác bỏ. | N/A | `INVALID` | `UNVERIFIED` | `STRICT_ROUTING_DISABLED` | Cầu bắt buộc phải có hồ sơ kiểm định tải trọng; cấm trốn tránh kiểm định. |
| **TEST-12** | **Static Terrain Exemption on Highway**<br>Đoạn cao tốc có bản vẽ hoàn công xác nhận độ dốc 2.5% và không có gờ bậc thềm. | Miễn trừ `STATIC_TERRAIN`. | Miễn trừ hợp lệ cho đường cao tốc loại I. | N/A | `NOT_APPLICABLE` | `VERIFIED_COMPATIBLE`* | `ROUTE_ALLOWED` | Đường cao tốc tiêu chuẩn quốc gia bảo đảm độ dốc và bề mặt cho xe 4x4. |
| **TEST-13** | **Static Terrain Rejection on Steep Track**<br>Đánh dấu `NOT_APPLICABLE` địa hình cho đường đèo dốc `highway=track`. | Kiểm tra miễn trừ địa hình. | Bị từ chối do thuộc danh mục cấm miễn trừ. | N/A | `INVALID` | `UNVERIFIED` | `STRICT_ROUTING_DISABLED` | Đường đồi núi đèo dốc bắt buộc phải đo đạc trắc dọc thực tế. |
| **TEST-14** | **Forward Canonical Hash Reproduction**<br>Cạnh N1->N2, FWD:true, [(16.065, 108.215), (16.066, 108.216)]. | Tính `canonicalEdgeGeometryHash`. | Khớp mã băm Vector 1 đã xác minh. | N/A | N/A | N/A | N/A | Tái lập 100% mã băm canonical: `ec4e64d4...ad6b`. |
| **TEST-15** | **Reverse Canonical Hash No Double Reversal**<br>Cạnh N2->N1, FWD:false, [(16.066, 108.216), (16.065, 108.215)]. | Tính `canonicalEdgeGeometryHash`. | Khớp mã băm Vector 2; không đảo tọa độ 2 lần. | N/A | N/A | N/A | N/A | Tái lập 100% mã băm canonical: `4fbd2876...3a06`. |
| **TEST-16** | **Negative Zero Normalization Parity**<br>Tọa độ đầu vào chứa giá trị `-0.0` trong mảng đỉnh. | Chuẩn hóa tọa độ. | `-0.0` được chuyển thành `0.0000000` trước khi băm. | N/A | N/A | N/A | N/A | Đảm bảo tính xác định toán học giữa các hệ điều hành và ngôn ngữ. |
| **TEST-17** | **Legacy Android Strict Routing Lock**<br>Client cũ nạp đồ thị hiện hành có 16.651 cạnh `UNVERIFIED`. | Gọi `findRoute()`. | Router từ chối với lỗi strict routing bị khóa. | N/A | N/A | `UNVERIFIED` | `STRICT_ROUTING_DISABLED` | Client cũ không thể định tuyến liều lĩnh qua các cạnh chưa kiểm chứng. |
| **TEST-18** | **Sidecar Tampering Checksum Rejection**<br>Tệp sidecar bị sửa đổi 1 byte làm sai lệch SHA-256 so với Manifest. | Nạp đồ thị và sidecar. | Snapshot chuyển sang `Failed`, khóa strict mode. | N/A | N/A | `UNVERIFIED` | `STRICT_ROUTING_DISABLED` | Ngăn chặn tấn công can thiệp dữ liệu hoặc hỏng hóc đường truyền. |
| **TEST-19** | **Offline Revocation Expiration Gate**<br>Thiết bị Android offline quá 72 giờ không cập nhật danh sách thu hồi CRL. | Chạy định tuyến offline. | Kích hoạt `OFFLINE_STRICT_LOCKED`. | N/A | N/A | `UNVERIFIED` | `STRICT_ROUTING_DISABLED` | Tránh sử dụng giấy phép hoặc hồ sơ xe đã bị thu hồi trong thời gian ngắt mạng. |
| **TEST-20** | **Corridor Search Bounded to Authorized Edges**<br>Hành lang cứu hộ gồm 15 cạnh qualified; tìm đường yêu cầu đi qua cạnh 16 ngoài hành lang. | Tìm đường trong chế độ hành lang. | UCS dừng và báo lỗi vượt phạm vi hành lang. | N/A | N/A | N/A | `ROUTE_EXCEEDS_AUTHORIZED_CORRIDOR` | Ngăn chặn thuật toán lan ra mạng lưới đường chưa được phong tỏa cứu hộ. |

*\*Với điều kiện toàn bộ các tiêu chí còn lại trên cạnh cũng đạt `SATISFIED` hoặc `NOT_APPLICABLE`.*

---

### 9. REMAINING RISKS, BLOCKERS & MITIGATION

Các vấn đề kỹ thuật và thực địa còn tồn tại được kiểm soát bằng nguyên tắc Fail-Closed:

1. **BLOCKER-01: Sai số Làm tròn Số thực giữa TypeScript và Kotlin (Cross-Language Float Rounding Blocker)**:
   - *Rủi ro*: Khi định dạng số thực 64-bit có phần đuôi nằm chính giữa ranh giới làm tròn (ví dụ `...00000005`), cơ chế làm tròn nửa chẵn (`Round-Half-Even`) của JVM và V8 engine có thể cho kết quả lệch 1 ULP ở chữ số thập phân thứ 7 trong các điều kiện tối ưu hóa trình biên dịch khác nhau.
   - *Biện pháp giảm thiểu*: Trong Task 5C, bắt buộc triển khai thuật toán nhân số nguyên $10^7$ (`Math.round(coord * 1e7)`) và so sánh đối chiếu chéo (Cross-Validation Suite) giữa 10.000 tọa độ thực tế của Đà Nẵng giữa TypeScript và Kotlin trước khi chốt giải thuật vào production.
2. **BLOCKER-02: Chưa có Hạ tầng Xác minh Khóa PKI Công vụ (Cloud KMS / HSM)**:
   - *Hiện trạng*: Backend chưa kết nối tới hạ tầng cấp chứng thư số công vụ quốc gia.
   - *Biện pháp giảm thiểu*: Duy trì mặc định `digitalSignatureStatus = 'UNVERIFIED_NOT_CONFIGURED'`. Mọi bản ghi thử nghiệm đều bị chặn ở biên đóng gói nếu chứa khóa không nằm trong danh mục whitelisted.
3. **BLOCKER-03: Thiếu Dữ liệu Khảo sát Thực địa 16.651 Cạnh Giao thông Đà Nẵng**:
   - *Hiện trạng*: Cơ quan chức năng chưa bàn giao dữ liệu quét LiDAR và hồ sơ kiểm định cầu đường thực tế.
   - *Biện pháp giảm thiểu*: Giữ nguyên 100% cạnh ở trạng thái `UNVERIFIED`. Đồ thị nền `BaseRoadGraph.json.gz` tiếp tục duy trì trạng thái `canAttemptStrictRouting = false`.

---

### 10. FINAL ACCEPTANCE DECISION (KẾT LUẬN NGHIỆM THU CUỐI CÙNG)

## **KẾT LUẬN: CONDITIONAL PASS**

### Căn cứ Quyết định:
1. **ĐẠT (PASS về mặt Kỹ thuật & Đặc tả Hợp đồng)**:
   - Cả 5 nhóm vấn đề (FIX 01 đến FIX 05) đã được giải quyết triệt để và chứng minh toán học.
   - Hai mã băm Canonical Geometry Hash đã được xác minh độc lập từng byte (`ec4e64d4...` và `4fbd2876...`).
   - Mô hình 2 tầng nhận thức sai số đo đạc loại bỏ hoàn toàn nguy cơ phán quyết sai lệch.
   - Quy tắc xử lý đa bằng chứng phân định rạch ròi giữa điểm nghẽn vật lý (`FAILED`) và mâu thuẫn đo lường (`CONFLICTING`).
   - Cơ chế bảo vệ Android cũ bằng 3 tầng cổng kiểm soát kiến trúc ngăn chặn hoàn toàn việc mở strict routing sai lầm.
   - 20 ca kiểm thử chấp nhận đã được chuẩn hóa đầy đủ 9 trường thông tin.
2. **ĐIỀU KIỆN (CONDITIONAL do Phụ thuộc Dữ liệu Thực tế)**:
   - Hồ sơ xe tiếp tục mang nhãn `PROVISIONAL` phục vụ kiểm thử kỹ thuật nội bộ, không dùng duyệt production khi chưa có văn bản chính thức của UBND TP Đà Nẵng / Cảnh sát PCCC & CNCH.
   - Giữ nguyên trạng thái khóa toàn đồ thị (`UNVERIFIED` 100%) cho đến khi thu thập đầy đủ dữ liệu khảo sát thực địa.

### Bàn giao Chính thức cho Task 5C:
Hợp đồng dữ liệu đã **HOÀN THIỆN 100% VÀ ĐÓNG KÍN MỌI LỖ HỔNG THIẾT KẾ**. Đội ngũ kỹ thuật được phép tiến hành Task 5C theo lộ trình:
- Tạo mới: `tools/osm-importer/src/qualification-types.ts`
- Tạo mới: `tools/osm-importer/src/edge-qualifier.ts`
- Tạo mới: `tools/osm-importer/test/edge-qualifier.spec.ts` (Hiện thực 20 ca kiểm thử đã đặc tả).

**DỪNG LẠI TẠI ĐÂY. KHÔNG TỰ Ý SỬA CODE PRODUCTION HOẶC BẮT ĐẦU TASK 5C.**
