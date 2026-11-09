# PHASE 5 – TASK 5C.1: BÁO CÁO TRIỂN KHAI ĐÃ HIỆU CHỈNH

Cập nhật theo Task 5C.1R ngày 05/11/2026. Tài liệu này thay thế các kết luận nghiệm thu và tuyên bố coverage của bản triển khai 5C.1 trước đây. [Kiểm toán Codex gốc](PHASE5_TASK5C1_CODEX_INDEPENDENT_AUDIT.md) được giữ nguyên để truy vết; kết quả bàn giao hiện tại nằm trong [báo cáo remediation](PHASE5_TASK5C1R_CODEX_REMEDIATION_REPORT.md).

## Trạng thái thực tế

5C.1 ban đầu có 27 qualification tests và 339 backend tests PASS, nhưng vẫn có các lỗi false-safe F01–F08, lỗi canonical identity F09 và các hạn chế F10–F14. Kết quả test cũ không chứng minh production trust. Tuyên bố đã hiện thực đầy đủ 20 acceptance specs và có thể nghiệm thu PASS đã bị rút lại.

## Đã triển khai trong 5C.1R

- `EdgeQualifier` là API **DIAGNOSTIC_ONLY**: mọi đường trả `qualificationStatus=UNVERIFIED`, `isProductionApproved=false`, `trustStatus=UNAVAILABLE`. Không có API tạo hoặc nhận context cho phép caller mở khóa production.
- Kiểm tra schema bắt buộc, finite numbers/thresholds, UTC timestamps, status/version, SI units, chainage/spans và graph/policy/hash-version binding. Validation chỉ xác nhận cấu trúc và tính nhất quán, không chứng minh nguồn phát hành.
- Supersession không được áp dụng khi thiếu trusted verifier; không loại bỏ record cũ chỉ vì có `supersedesEvidenceId`. Exemption được kiểm tra nhưng không áp dụng khi chưa xác thực nguồn và cấu trúc công trình.
- Kết quả toán học chưa xác thực giữ trong `untrustedAssessmentState` và `measurementDecision`; `state` không nâng SATISFIED/FAILED/NOT_APPLICABLE từ payload tự khai. Không tạo BLOCKED từ một failure chưa được xác thực.
- Hash hình học V2 dùng length prefix cho node IDs ASCII và decimal Half-Even; version `edge-geometry-v2-decimal-half-even`. Input number mang nghĩa giá trị thập phân chính xác của `Number.toString()`. Hai vector V1 được giữ làm legacy regression fixtures; engine không chấp nhận evidence hash-version cũ.
- Test importer dùng output tạm riêng từng test và chỉ cleanup đường dẫn do chính test tạo. Không đổi importer/CLI production.

## Đã kiểm thử

Chi tiết lệnh, số test và exit code được ghi trong báo cáo 5C.1R. Bộ regression dùng baseline đủ 8/8 tiêu chí để cô lập từng lỗi trust/profile/graph/time/unit, ngoài các test thuần về validation, resolution và geometry. Golden vectors được kiểm tra bằng cả TypeScript và Python standard library độc lập.

Các assertions cũ khẳng định fixtures có thể nhận production approval đã được sửa theo hợp đồng fail-closed, đồng thời bổ sung assertion riêng về nguyên nhân bị từ chối và kết quả toán học. Không coi thay đổi expected status là bằng chứng duy nhất đã sửa lỗi.

## Chưa kiểm thử / chưa triển khai

- PKI công vụ, trust registry, CRL/OCSP thực tế: **chưa có**.
- Trusted artifact loader, xác minh node endpoints và authoritative survey coverage: **chưa có trong module**.
- Trusted clock để chống caller backdating: **chưa có**.
- Dữ liệu khảo sát thực địa: **chưa có căn cứ trong task này để cấp chứng nhận**.
- Kotlin parity và cross-validation 10.000 tọa độ: **chưa chạy**, không suy tương đương BigDecimal/Math.round/toFixed.
- Android legacy loader/router, sidecar byte checksum, offline revocation 72 giờ và bounded corridor UCS: **DEFERRED_TO_INTEGRATION**. Không tính những phần này là unit tests đã PASS.
- Không tích hợp engine vào importer/CLI/Android, không phát hành sidecar, không mở strict routing và không triển khai Task 5C.2.

## Xác minh production

Chỉ xác minh local artifact/hash/mtime và tham chiếu nguồn trong phạm vi kiểm tra; không xác minh deployment hoặc storage từ xa. Việc graph local được khóa không chứng minh mọi cổng production remote đã hoạt động. Phải đọc kết quả so sánh artifact trước/sau trong báo cáo 5C.1R; không tái sử dụng tuyên bố “mọi file không thay đổi” từ bản báo cáo cũ.

Nghiệm thu remediation có điều kiện khác với việc sẵn sàng vận hành qualification: cổng production hiện được giữ khóa có chủ đích cho đến khi các thành phần tin cậy được triển khai và kiểm toán riêng.
