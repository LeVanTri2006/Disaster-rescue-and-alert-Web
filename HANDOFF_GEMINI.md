# BÀN GIAO TOÀN BỘ DỰ ÁN CHO GEMINI

**Tên dự án:** CẢNH BÁO THIÊN TAI  
**Nền tảng:** Android + Backend  
**Mốc cập nhật tài liệu:** 31/10/2026 (Asia/Ho_Chi_Minh)  
**Mục đích:** Đưa cho Gemini đọc trước khi tiếp tục phát triển, để không phải dựng lại bối cảnh, không làm lại phần đã hoàn thành và không gây regression.

> **Đọc kỹ:** Đây là bản tổng hợp theo lịch sử trao đổi, các báo cáo Antigravity và tài liệu dự án đã được cung cấp. Tôi không được cấp trực tiếp repository đang checkout trong lần tạo tài liệu này, vì vậy những đường dẫn, trạng thái build và chi tiết code phải được Gemini đối chiếu với mã nguồn hiện tại. Khi có xung đột, **mã nguồn hiện tại + báo cáo mới nhất được người dùng xác nhận** là nguồn sự thật; không được dùng trạng thái cũ trong tài liệu bàn giao trước đó để ghi đè trạng thái mới.

---

# 0. HƯỚNG DẪN CHO GEMINI — ĐỌC TRƯỚC KHI LÀM BẤT CỨ VIỆC GÌ

Bạn là AI tiếp nhận dự án giữa chừng. Hãy thực hiện theo thứ tự:

1. Đọc toàn bộ tài liệu này.
2. Không yêu cầu người dùng kể lại các thông tin đã có ở đây.
3. Yêu cầu người dùng mở đúng repository Android và backend trong môi trường phát triển của họ; sau đó **inspect repository thực tế** trước khi đề xuất sửa code.
4. Đọc `git status`, branch hiện tại, `git diff`, cấu trúc thư mục, README, file cấu hình và các file liên quan task đang làm. Không tự checkout, reset, clean, rebase hoặc ghi đè thay đổi chưa commit.
5. Không mặc định các đường dẫn và IP cũ vẫn còn đúng. Xác minh từ máy hiện tại.
6. Không coi một feature là PASS chỉ vì nó có trong code hoặc Antigravity nói đã implement. Phân biệt rõ: **Implemented / Build PASS / Unit test PASS / API test PASS / Real-device PASS**.
7. Người dùng thích chia công việc thành task rất nhỏ, tuần tự, mỗi lần chỉ xử lý một function hoặc một luồng. Antigravity/Gemini không nên nhận một prompt khổng lồ để sửa đồng thời nhiều module.
8. Với mỗi task: Inspect → mô tả nguyên nhân/phạm vi → đề xuất file cần sửa → chỉ implement đúng task → build/test → regression → review diff → báo cáo → dừng.
9. Nếu cần thay đổi backend, database, Prisma, migration, API contract hoặc module ngoài scope Android thì phải báo trước và chờ task cho phép; không tự mở rộng phạm vi.
10. Không tiết lộ hoặc ghi lại secrets. Đọc `.env`/local config trong máy người dùng khi cần, nhưng tuyệt đối không paste API keys, JWT secrets, Firebase service account, R2 credentials, access tokens hoặc mật khẩu thật vào prompt/log/chat.
11. Không tạo dữ liệu thử nghiệm ở production. Phân biệt local/dev/test data và dữ liệu thật.
12. Khi task PASS, dừng. Không tự động làm task kế tiếp.

## Quy tắc phản hồi của Gemini

- Trả lời bằng tiếng Việt, thực tế, hướng dẫn từng bước.
- Prompt cho coding agent cần rõ mục tiêu, allowed files, forbidden scope, acceptance criteria và verification.
- Không tự bịa tên class, API path, role, enum, field hoặc trạng thái; inspect trước.
- Không tự thiết kế lại UI trong task sửa logic.
- Không đánh dấu Real Device PASS khi chỉ chạy emulator hoặc chỉ build.
- Nếu môi trường thiếu JDK/ADB/emulator/backend config thì báo BLOCKED cụ thể, không giả lập kết quả.

---

# 1. TỔNG QUAN SẢN PHẨM

Ứng dụng Android **CẢNH BÁO THIÊN TAI** dùng để cảnh báo và hỗ trợ ứng phó thiên tai, kết nối người dân với lực lượng/tình nguyện viên cứu hộ.

Các nhóm nghiệp vụ chính:

- Người dùng bình thường (Normal User / Resident; tên role thực tế phải xác minh trong source).
- Nhà hoạt động/đội cứu hộ (Rescuer; role thực tế phải xác minh trong source).
- Bản đồ thiên tai và SOS.
- Cảnh báo bão, lũ, khu vực nguy hiểm.
- Gửi tín hiệu SOS khẩn cấp.
- Yêu cầu cứu hộ được liên kết với SOS.
- Lực lượng cứu hộ xem yêu cầu gần vị trí, nhận nhiệm vụ, theo dõi và hoàn thành nhiệm vụ.
- Chat, thông báo, hồ sơ, cài đặt và các flow liên quan theo mức độ triển khai thực tế.

**Phân biệt khái niệm:**

- `SOSEvent`: tín hiệu SOS do người dân gửi, xuất hiện trên bản đồ SOS.
- `RescueRequest`: yêu cầu cứu hộ được backend tạo/liên kết với SOS để đội cứu hộ có thể nhận.
- `RescueMission`: nhiệm vụ được tạo khi đội cứu hộ nhận một `RescueRequest`.

Không được coi ba loại record này là một hoặc tự thay ID giữa chúng. Đặc biệt:

- `sosEventId` dùng để mở SOS Detail (`SOSEvent`).
- `requestId` dùng cho API accept (`RescueRequest`).
- `missionId` dùng cho màn hình/endpoint chi tiết mission.

---

# 2. CÔNG NGHỆ VÀ KIẾN TRÚC

## 2.1 Android

Đã được ghi nhận sử dụng:

- Kotlin.
- Jetpack Compose.
- Material 3.
- MVVM.
- Repository pattern.
- Navigation Compose.
- Firebase Authentication.
- Firebase Realtime Database (RTDB).
- Google Maps.
- Cloudflare R2 cho ảnh SOS.

Luồng kiến trúc tổng quát:

```text
Compose UI
   ↓
ViewModel
   ↓
Repository
   ↓
API Client / Firebase / R2
```

Project Android được ghi nhận ở đường dẫn cũ:

```text
~/AndroidStudioProjects/bai1
```

Đây là đường dẫn lịch sử, cần kiểm tra lại trên máy hiện tại. Không được giả định chắc chắn đây là path còn dùng.

## 2.2 Backend

Đã được ghi nhận sử dụng:

- Node.js.
- NestJS.
- TypeScript.
- Prisma.
- PostgreSQL 17.5.
- PostGIS 3.5.
- Docker.
- Cloudflare R2.
- Firebase RTDB publisher.

Project backend được ghi nhận ở đường dẫn cũ:

```text
~/AndroidStudioProjects/canh-bao-thien-tai-backend-app
```

Backend local cũ:

```text
http://localhost:3000
```

LAN IP cũ từng dùng để truy cập từ điện thoại:

```text
192.168.2.228
```

**Các địa chỉ trên có thể thay đổi.** Android trên máy thật thường không thể dùng `localhost` để trỏ đến máy tính đang chạy backend; cần dùng LAN IP hiện tại hoặc tunnel đã cấu hình, và xác minh firewall/network.

## 2.3 Database / local environment

Thông tin cấu hình cũ được ghi nhận:

- Database: `canh_bao_thien_tai`.
- PostgreSQL port: `5432`.
- Host thường là localhost/Docker.
- User cũ: `postgres`.
- Có endpoint `GET /health`.

Health response kỳ vọng:

```json
{
  "status": "ok",
  "database": "connected",
  "postgis": "connected"
}
```

Mật khẩu không được ghi trong tài liệu này. Đọc đúng `.env` cục bộ nếu cần; không đưa giá trị secrets vào Gemini prompt.

---

# 3. AUTHENTICATION VÀ ROLE

## 3.1 Backend auth endpoints đã được ghi nhận

```http
POST /auth/register
POST /auth/login
POST /auth/refresh
GET  /auth/me
POST /auth/google
```

Có access token, refresh token và bcrypt.

## 3.2 Google sign-in flow đã được mô tả là hoạt động

```text
Android Credential Manager
        ↓
Google ID Token
        ↓
FirebaseAuth
        ↓
Firebase ID Token
        ↓
Backend POST /auth/google
        ↓
App JWT
```

SHA-1 Android từng được đăng ký với Firebase.

## 3.3 Quy tắc không được phá

- Không sửa Auth/Google Login khi task không yêu cầu.
- Firebase Auth vẫn được dùng.
- Firebase RTDB vẫn được dùng.
- Firebase Storage không còn được dùng để lưu ảnh SOS.
- Không suy đoán role từ trạng thái SOS/mission.
- Role phải đọc từ nguồn authenticated user/profile chính thức đang có trong app.
- Giá trị role thực tế chưa được xác nhận đầy đủ ở tài liệu này. Có thể gặp `RESCUER`, `RESIDENT`, `USER` hoặc enum/string khác; Gemini phải inspect source/backend auth response trước khi viết điều kiện.

## 3.4 Bottom navigation theo vai trò (định hướng đã xác định)

Normal User:

```text
Trang chủ | Bản đồ | SOS | Thông báo | Cá nhân
```

Rescuer:

```text
Trang chủ | Bản đồ | SOS | Nhiệm vụ | Cá nhân
```

SOS là nút giữa, màu đỏ, nổi bật.

---

# 4. DESIGN SYSTEM VÀ UI/UX ĐÃ XÁC ĐỊNH

Phong cách: modern, clean, minimal, professional, emergency/safety; thông tin quan trọng phải dễ đọc và action khẩn cấp phải nổi bật.

Màu được xác định trong kế hoạch UI:

| Vai trò | Màu |
|---|---|
| Primary | `#1976D2` |
| Dark Blue | `#0D47A1` |
| Emergency Red | `#E53935` |
| Warning Orange | `#FB8C00` |
| Success Green | `#43A047` |
| Background | `#F5F8FC` |
| White | `#FFFFFF` |
| Text | `#1E293B` |
| Secondary text | `#64748B` |

Spacing tham chiếu: `4 / 8 / 12 / 16 / 20 / 24 / 32dp`.  
Corner radius tham chiếu: `8 / 12 / 16 / 20 / 24dp`.  
Button height tham chiếu: `48–52dp`.  
Card radius tham chiếu: `16dp`.

Responsive/accessibility:

- Kiểm tra tối thiểu phone 320dp, 360dp, 375dp, 390dp, 412dp, 430dp.
- Tablet 600dp+ và 800dp+ nếu scope màn hình yêu cầu.
- Không fixed screen size/absolute position cho layout chính.
- Dùng WindowInsets/safe area, LazyColumn/LazyRow/weight/BoxWithConstraints khi phù hợp.
- Text tiếng Việt không được overflow/cắt mất thông tin quan trọng.
- Touch target nên từ 48dp.
- Icon cần contentDescription; không dùng màu là tín hiệu duy nhất để hiểu mức độ nguy hiểm.
- Không tự redesign khi task chỉ sửa logic.

## 4.1 Sơ đồ màn hình sản phẩm / roadmap

Danh sách màn hình đã được xác định trong các brief UI gốc (không đồng nghĩa tất cả đã triển khai hoặc đã kết nối backend):

1. Splash.
2. Onboarding 1–3.
3. Login.
4. Register.
5. Role Selection.
6. Home.
7. Disaster Map.
8. Warning List.
9. Storm Detail.
10. Flood Detail.
11. Volunteer Registration Step 1–3.
12. Rescue Mission List.
13. Rescue Mission Detail.
14. Rescue Chat.
15. SOS.
16. Notification.
17. Profile.
18. Settings.
19. Forgot Password.
20. OTP Verification.
21. About App.

Brief rescue UI còn mô tả: nhóm cứu hộ, group chat, cập nhật trạng thái nhiệm vụ, profile cứu hộ, trạng thái sẵn sàng, search/filter và offline/empty states. Đây là yêu cầu/roadmap; không được ghi tất cả là hoàn thành nếu chưa kiểm tra repository.

## 4.2 SOS UX an toàn

Brief UI ban đầu mô tả press-and-hold + confirmation/countdown, không gửi SOS chỉ vì tap nhầm. Không tự thay đổi behavior SOS này trong task unrelated. Không tự động gọi số khẩn cấp.

---

# 5. FIREBASE VÀ STORAGE — QUYẾT ĐỊNH KIẾN TRÚC QUAN TRỌNG

## 5.1 Firebase được giữ

- Firebase Authentication: CÓ DÙNG.
- Firebase Realtime Database: CÓ DÙNG.
- Google Sign-In/Firebase ID token flow: CÓ DÙNG.

## 5.2 Firebase Storage bị loại khỏi SOS photo flow

**Cloudflare R2 là storage chính thức cho ảnh SOS.**

Đã ghi nhận cleanup:

- Bỏ dependency `firebase-storage`.
- Xóa `FirebaseSosPhotoUploader.kt`.
- Kiểm tra Firebase Storage reference đã được loại khỏi phần ảnh SOS.

Không được:

- Thêm lại Firebase Storage dependency.
- Chuyển ảnh SOS ngược về Firebase Storage.
- Viết flow song song R2 + Firebase Storage nếu không có task được duyệt.

## 5.3 Cloudflare R2

Bucket từng dùng:

```text
canh-bao-thien-tai
```

Region: `auto`.

Đã từng test connectivity, write, delete và presigned PUT.

API tạo upload URL:

```http
POST /sos/photo/upload-url
```

Request:

```json
{
  "contentType": "image/webp"
}
```

Response wrapper đã được ghi nhận:

```json
{
  "success": true,
  "data": {
    "uploadUrl": "<presigned-put-url>",
    "objectKey": "sos/<userId>/<uuid>.webp",
    "expiresIn": 300,
    "contentType": "image/webp"
  }
}
```

Backend cũng tạo presigned GET URL để Android hiển thị ảnh.

**API wrapper quan trọng:** Android API client phải parse `data` thay vì giả định payload luôn ở root. Đây từng là nguyên nhân parse lỗi.

## 5.4 Quy tắc WebP

Ảnh từ camera/gallery đi theo pipeline:

```text
Input image
  ↓
Resize (long side tối đa 1600px)
  ↓
WebP lossy, quality 80
  ↓
Upload R2
  ↓
Lưu objectKey vào backend
```

Các trường hợp camera/gallery, PNG/WebP, object, DB photo reference, presigned GET và detail đã được test trong giai đoạn single-photo.

---

# 6. SOS BACKEND — ENDPOINTS VÀ DATA CONTRACT ĐÃ ĐƯỢC GHI NHẬN

Các endpoint SOS được ghi nhận:

```http
POST   /sos
GET    /sos
GET    /sos/my
GET    /sos/active
GET    /sos/nearby
GET    /sos/:id
POST   /sos/photo/upload-url
PATCH  /sos/:id/resolve
PATCH  /sos/:id/false-alarm
```

Các trường SOS được nhắc đến trong brief/task gồm:

- latitude / longitude.
- severity.
- condition / tình trạng sức khỏe.
- needs / nhu cầu.
- description.
- số người: adults, children, elderly; tổng người cần hỗ trợ.
- photoUrl (legacy/single-photo compatibility).
- photos[] (multi-photo).
- status, timestamp và user/event IDs theo backend contract thực tế.

## 6.1 Duplicate ACTIVE SOS

Backend đã có quy tắc mỗi user tối đa một SOS ACTIVE tại một thời điểm (theo báo cáo cũ). Không tự bỏ hoặc thay đổi guard này.

## 6.2 Realtime SOS

Firebase Realtime Database path được ghi nhận:

```text
sos-events
```

Map dùng REST initial load kết hợp Firebase realtime update.

Đã từng xử lý các vấn đề Firebase publish treo, active SOS không load, marker không hiển thị, count sai và API response wrapper. Một lần `await publishRealtime()` làm flow treo; publisher sau đó được chuyển sang kiểu fire-and-forget kèm timeout theo báo cáo. Không sửa publisher khi không liên quan.

## 6.3 Severity mapping

```text
CRITICAL = KHẨN CẤP
HIGH     = GẦN KHẨN CẤP
MEDIUM   = TRUNG BÌNH
LOW      = THẤP
```

---

# 7. MULTI-PHOTO SOS — ĐÃ LÀM ĐẾN ĐÂU

> **Quan trọng về tài liệu cũ:** Một handover trước đây ghi Phase 4–6 chưa làm. Thông tin đó đã lỗi thời. Những báo cáo sau đó xác nhận Phase 4/5 đã triển khai và người dùng cho biết multi-photo hoạt động trên thiết bị thật. Hãy dùng trạng thái mới dưới đây.

## 7.1 Backend multi-photo

Backend đã hỗ trợ `SOSPhoto` liên kết với `SOSEvent`, cascade delete được ghi nhận.

Contract:

```json
{
  "photos": [
    "sos/<userId>/<uuid1>.webp",
    "sos/<userId>/<uuid2>.webp",
    "sos/<userId>/<uuid3>.webp"
  ]
}
```

Quy tắc:

| Số ảnh | Kết quả |
|---:|---|
| 0 | Không tạo SOSPhoto |
| 1 | 1 SOSPhoto |
| 2 | 2 SOSPhoto |
| 3 | 3 SOSPhoto |
| Trên 3 | HTTP 400 / reject |

Backward compatibility:

- `photoUrl` vẫn được hỗ trợ cho client cũ.
- `photos[]` là source of truth khi được gửi.
- `SOSEvent.photoUrl = photos[0]` để tương thích.
- Nếu gửi cả `photoUrl` và `photos[]`, `photos[]` được ưu tiên.
- Không tạo duplicate SOSPhoto.
- Response `photos[]` được transform thành presigned GET URLs cho các đường find/list/detail đã nêu trong báo cáo; phải xác minh implementation hiện tại trước khi đổi.

## 7.2 PHASE 2 — Android Multi-photo Selection: PASS

Các file đã được ghi nhận:

- `SosFormData.kt`
- `SosRescueRequestViewModel.kt`
- `SosRescueRequestScreen.kt`

State chuyển từ một `photoUri: Uri?` sang `photoUris: List<Uri>`; compatibility có getter `photoUri = photoUris.firstOrNull()`.

Các behavior đã báo PASS:

- 0–3 ảnh.
- `.distinct()` và `.take(3)`.
- Camera: 1/2/3 ảnh, ảnh thứ 4 bị chặn.
- Gallery dùng `ActivityResultContracts.GetMultipleContents()`.
- Nếu chọn hơn 3 ảnh, state giữ tối đa 3.
- Preview từng ảnh và remove từng ảnh.

Ở thời điểm Phase 2 độc lập, submit 2–3 ảnh còn bị block có chủ đích vì chưa nối upload/API. Đây là behavior trung gian cũ; Phase 4 sau đó đã nối flow.

## 7.3 PHASE 3 — Android R2 Multi-image Upload: PASS

File chính:

- `R2SosPhotoUploader.kt`

Function được ghi nhận:

```kotlin
uploadSosPhotos(
    uris: List<Uri>,
    eventId: String
): Result<List<String>>
```

Behavior:

- 0 ảnh → `emptyList()`.
- 1–3 ảnh → trả danh sách objectKey.
- Trên 3 ảnh → reject trước upload.
- Upload tuần tự, không parallel.
- Hàm cũ `uploadSosPhoto(...)` được giữ để tương thích single-photo.
- Pipeline resize/WebP giữ nguyên.

## 7.4 PHASE 4 — Android Create SOS `photos[]`: PASS

Đã cập nhật các model/client/flow cần thiết; các file được ghi nhận:

- `SosApiModels.kt`.
- `SosApiClient.kt`.
- `SosRescueRequestViewModel.kt`.
- Các model/transport mapping liên quan theo report.

Behavior đã triển khai:

- Android gửi JSON `photos` array.
- Parse `photos[]` từ API response.
- Tích hợp upload R2 với create SOS.
- 0/1/2/3 ảnh được hỗ trợ.
- Tối đa 3 ảnh.
- Ảnh đầu tiên vẫn map sang legacy `photoUrl`.
- Nếu upload ảnh thất bại thì dừng create SOS để không tạo SOS thiếu ảnh đã chọn.
- Giữ flow single-photo compatibility.

Các lớp được ghi nhận bổ sung:

- `SosApiModels.kt`: `photos: List<String>?`.
- `SosApiClient.kt`: gửi/parse `photos[]`.
- `SosRescueInfo.kt`: bổ sung `photos`.
- `ApiSosTransport.kt`: map `photos`.
- `SosRescueRequestViewModel.kt`: hỗ trợ 0/1/2/3 ảnh, max 3; `photoUrl` legacy = ảnh đầu.

## 7.5 PHASE 5 — SOS Detail multi-photo gallery: functional PASS, build caveat

`SosDetailScreen.kt` được cập nhật để:

- Hiển thị nhiều ảnh bằng `HorizontalPager` khi có từ 2 ảnh trở lên.
- Fallback về `photoUrl` legacy nếu không có `photos[]` phù hợp.
- Hiển thị placeholder nếu không có ảnh.
- Giữ đúng thứ tự ảnh.

**Caveat:** báo cáo Phase 5 từng ghi Build PASS nhưng thực tế có lần build không chạy được do `JAVA_HOME` thiếu. Vì vậy không coi build phase đó là xác minh độc lập nếu không có log build mới.

## 7.6 PHASE 6 — Full Multi-photo E2E: trạng thái chưa hoàn toàn được chứng minh bằng ma trận chính thức

- Ban đầu task/report bị PARTIAL do thiếu JDK, emulator/device và backend JWT secret/config.
- Sau đó người dùng báo chức năng multi-photo đã hoạt động bình thường trên thiết bị thật.
- Tuy nhiên không có xác nhận rằng toàn bộ ma trận 0/1/2/3/>3, DB rows, R2 objects, realtime và detail đã được Antigravity chạy lại chính thức trong một lượt end-to-end đầy đủ.

Kết luận an toàn:

- Multi-photo selection/upload/create/detail đã được triển khai.
- Người dùng xác nhận thực tế tính năng hoạt động.
- Formal full E2E matrix chưa được ghi nhận hoàn tất đầy đủ; không tự tuyên bố tất cả test case PASS nếu chưa chạy lại.

---

# 8. RESCUE MISSION — NGHIỆP VỤ VÀ LUỒNG THIẾT KẾ

Mục tiêu người dùng đã mô tả:

```text
Resident gửi SOS
        ↓
SOS xuất hiện trên bản đồ
        ↓
SOS đó xuất hiện trong tài khoản RESCUER
        ↓
Nhiệm vụ → Gần đây
        ↓
Rescuer xem khoảng cách từ GPS hiện tại đến SOS
        ↓
Chọn SOS → mở đúng SOS Detail
        ↓
NHẬN NHIỆM VỤ
        ↓
Nhiệm vụ xuất hiện trong Nhiệm vụ của tôi
        ↓
HOÀN THÀNH NHIỆM VỤ
        ↓
Tab Hoàn thành
```

Yêu cầu cốt lõi: **“Gần đây” phải hiển thị chính SOS thực tế do người dân gửi, không phải một record RescueRequest rời rạc, không liên quan SOS.**

Các tab đã được báo cáo trong Android:

- `Gần đây`.
- `Nhiệm vụ của tôi`.
- `Hoàn thành`.

Một báo cáo UI cũ có thứ tự tab khác, do đó cần giữ theo UI hiện tại và yêu cầu người dùng, không tự reorder trong task unrelated.

---

# 9. RESCUE REQUEST — VẤN ĐỀ KIẾN TRÚC ĐÃ PHÁT HIỆN VÀ ĐÃ BRIDGE

## 9.1 Vấn đề ban đầu

Người dùng thấy bản đồ có 19 SOS marker nhưng danh sách `Gần đây` chỉ có một item không liên quan.

Tracing cho thấy:

- Map dùng `GET /sos/active` cho SOS.
- Map có logic lấy `GET /rescue-requests/nearby` và lọc request với `status == PENDING`.
- Rescuer Nearby dùng `GET /rescue-requests/nearby?lat={lat}&lon={lon}&radius={radius}`.
- Radius Android được ghi nhận là `50000` (50 km).
- Vị trí rescuer lấy từ `CurrentLocationViewModel`.
- Distance được tính từ backend/PostGIS.

## 9.2 Record cũ không liên quan SOS (dữ liệu debug lịch sử)

Một record từng hiển thị ở Nearby:

- RescueRequest ID: `317c93ce-7878-41a7-9c35-15993b44977d`.
- Mission ID: `6a9908e5-d9d8-4242-8d45-dec8d007145d`.
- Requester ID: `f16abed5-ae5e-40fe-adf0-4e47544427e8`.
- Status: `ASSIGNED`.
- Coords: latitude `16.0544`, longitude `108.2022`.
- Không có relation đến SOS Event.

Map loại record này vì filter `PENDING`. Đây là dữ liệu legacy/test, không được giả định còn tồn tại ở DB hiện tại.

## 9.3 Trước bridge, hai luồng tạo record riêng biệt

- `POST /sos` chỉ tạo `SOSEvent` + `SOSPhoto`.
- `POST /rescue-requests` là flow độc lập, không được Android SOS gọi.
- Không có relation giữa `SOSEvent` và `RescueRequest`.
- RescueRequest lẻ có thể được tạo qua Postman/Swagger/test tool.

## 9.4 Quyết định bridge đã thực hiện — OPTION A

Tự động tạo một RescueRequest trong transaction khi `POST /sos` tạo SOSEvent.

Đã thêm relation ở Prisma:

```prisma
RescueRequest.sosEventId String? @unique
```

- Relation optional để giữ legacy RescueRequest cũ.
- 1:1 relation với `SOSEvent`.
- Migration được ghi nhận: `bridge_sos_event_rescue_request_2`.
- Legacy RescueRequest cũ giữ `sosEventId = null`.

## 9.5 Backend POST /sos auto-create RescueRequest: PASS

File được ghi nhận:

- `src/sos/sos.service.ts`.
- `src/prisma/contract.prisma`.
- Migration directory tương ứng.

Trong transaction của `POST /sos`:

1. Tạo SOSEvent.
2. Tạo SOSPhoto(s) nếu có.
3. Tạo một RescueRequest liên kết đến event qua `sosEventId`.

Mapping được ghi nhận:

- `requesterId` lấy từ SOSEvent userId.
- Location lấy từ SOS coordinates.
- `peopleCount = adults + children + elderly`.
- Urgency/message được map từ severity/needs/description theo logic đã triển khai.
- RescueRequest initial status = `PENDING`.
- Không tạo RescueMission ngay ở thời điểm gửi SOS.
- Duplicate ACTIVE SOS rule được giữ.
- POST /sos response contract được giữ nguyên theo report.
- Multi-photo không bị thay đổi.

## 9.6 Nearby API expose sosEventId: PASS

File được ghi nhận:

- `src/rescue-requests/rescue-requests.service.ts`.

`GET /rescue-requests/nearby` trả thêm `sosEventId` để Android điều hướng đúng về SOS Detail.

Distance vẫn do PostGIS tính; latitude dùng `ST_Y`, longitude dùng `ST_X` theo report.

Legacy request không liên quan SOS có `sosEventId = null` và vẫn phải được xử lý an toàn.

---

# 10. ANDROID RESCUER NEARBY / NAVIGATION / ACCEPT

## 10.1 Nearby list

- Nearby lấy location qua `CurrentLocationViewModel`.
- Gọi nearby API với lat/lon/radius.
- Sau khi có bug record ASSIGNED không liên quan, Android filter `status == PENDING`.
- File được ghi nhận thay đổi: `RescueMissionViewModel.kt`.
- Distance được hiển thị theo response backend; ví dụ UX mong muốn `1.8 km`.

## 10.2 Navigation từ Nearby đến SOS Detail

Các file được ghi nhận:

- `RescueMissionModels.kt`.
- API client/repository liên quan.
- `AppNavGraph.kt`.

Android model `RescueMissionRequestInfo` có `sosEventId: String?` và parser đọc trường JSON này.

Click behavior:

```kotlin
req.sosEventId?.let { onNavigateToRequestDetail(it) }
```

Navigation route mở:

```text
Routes.sosDetail(eventId)
```

**Không dùng `requestId` làm `eventId` khi mở SOS Detail.**

## 10.3 Accept mission behavior đã tích hợp

- Với RESCUER, nếu RescueRequest status `PENDING` thì hiện nút `NHẬN NHIỆM VỤ`.
- Khi đã `ASSIGNED`/đã được nhận hoặc trạng thái không còn PENDING, không được nhận lại.
- Loading và snackbar/feedback đã được thêm.
- Xử lý HTTP 409 duplicate accept.
- Repository refresh missions sau khi accept.
- List refresh khi resume đã được ghi nhận.
- `SosDetailViewModel.kt` từng được cập nhật để xác định role hiện tại và tìm RescueRequest bằng cách lấy nearby list rồi match `sosEventId`.
- Build PASS trong các report trước đây; real-device chưa được ghi nhận riêng trong task này.

Cần inspect implementation hiện tại trước khi thay đổi. Không tự viết lại accept feature.

---

# 11. ACCEPT MISSION API — LỖI HTTP 500 VÀ FIX ĐÃ PASS

## 11.1 Endpoint

```http
POST /rescue-missions/accept/:requestId
```

Đây là `requestId` của RescueRequest, **không phải** sosEventId và không phải missionId.

## 11.2 Lỗi lịch sử

Người dùng test thiết bị thật và nhận HTTP 500 khi nhấn `NHẬN NHIỆM VỤ`.

Backend log cho biết:

```text
PostgreSQL SQLSTATE 42704
 type "public.RescueRequestStatus" does not exist
```

Stack trace chỉ tới:

```text
src/rescue-missions/rescue-missions.service.ts
RescueMissionsService.acceptRequest(...)
```

Raw SQL đã cast status như enum physical DB:

```sql
'IN_PROGRESS'::"public"."RescueRequestStatus"
```

Nhưng cột physical DB thực tế là TEXT; Prisma enum ở application schema không đồng nghĩa DB đã có enum type này.

## 11.3 TASK 12.2 — ACCEPT MISSION HTTP 500 FIX: PASS

Báo cáo mới nhất người dùng cung cấp xác nhận:

- Đã bỏ invalid cast `::"public"."RescueRequestStatus"`.
- Raw SQL dùng status string không cast enum, phù hợp cột TEXT.
- Giữ atomic update với điều kiện request đang `PENDING`.
- `PENDING → IN_PROGRESS`: PASS.
- Mission creation: PASS.
- Duplicate accept: PASS.
- Invalid request: PASS.
- Already accepted: PASS.
- Accept API: PASS.
- Backend build: PASS.
- Backend tests: PASS.
- Chỉ file thay đổi: `src/rescue-missions/rescue-missions.service.ts`.
- Không đổi schema, migration, Android hoặc map.

**Không revert lại enum cast.** Đây là fix đã PASS.

## 11.4 Rescue profile authorization

Theo tracing trước đó, tài khoản rescuer có thể bị HTTP 403 nếu rescue profile chưa ở trạng thái APPROVED. Khi debug 403, hãy xác minh profile verification state trước khi sửa API hoặc auth. Không bỏ qua authorization.

## 11.5 Log lưu kèm

Có file diagnostics lịch sử trong gói:

```text
diagnostics/accept-mission-http500-before-fix.txt
```

Đây là log trước khi fix nên còn hiển thị lỗi 500. Không nhầm log lịch sử này là lỗi còn tồn tại sau TASK 12.2.

---

# 12. COMPLETE MISSION FLOW

Một task trước đó đã triển khai flow hoàn thành mission.

Endpoint được ghi nhận:

```http
PATCH /rescue-missions/:id
Content-Type: application/json

{
  "status": "COMPLETED"
}
```

Behavior báo cáo:

- Mission trước khi complete có thể ở `ASSIGNED`, `IN_ROUTE` hoặc `IN_PROGRESS` theo trạng thái thực tế.
- Mission sau complete: `COMPLETED`.
- RescueRequest liên quan sau complete: `RESOLVED`.
- SOSEvent chưa được update theo endpoint này; status của SOSEvent vẫn `ACTIVE` theo report tại thời điểm đó.
- Android mission detail update state, ẩn nút hoàn thành sau thành công, refresh list và ngăn double-click.
- Backend/Android build report: PASS.
- Real device test riêng: chưa được ghi nhận.

**Lưu ý nghiệp vụ còn mở:** SOSEvent có thể vẫn ACTIVE sau khi RescueRequest đã RESOLVED/Mission COMPLETED. Đây là sự thật theo report, không tự sửa trong task role-based UI. Nếu người dùng muốn đóng SOS đồng thời hoàn thành mission, cần task nghiệp vụ/backend riêng và xác định quy tắc với user.

---

# 13. MAP VÀ CÁC VẤN ĐỀ LIÊN QUAN

Đã được tracing:

- Map lấy SOS bằng `GET /sos/active`.
- Map cũng từng lấy `GET /rescue-requests/nearby` và filter `status == PENDING`.
- Rescue nearby list dùng endpoint gần tương tự nhưng có GPS/radius.
- Có lần Map hiển thị 19 SOS event nhưng không xuất hiện 19 rescue requests do ban đầu SOSEvent và RescueRequest không liên kết.
- Sau bridge, cùng một SOSEvent sẽ có RescueRequest link tương ứng.

**Potential duplicate-marker risk cần nhớ:** Nếu map vẫn vẽ cả `SOSEvent` và `RescueRequest` cho cùng một event sau bridge, có thể bị duplicate marker. Chưa có xác nhận rõ trong dữ liệu đã tổng hợp rằng việc dedupe marker sau bridge đã hoàn tất. Không tự sửa map trong task khác; khi có yêu cầu map, kiểm tra dedup bằng `sosEventId`.

Một lỗi regression cũ đã xảy ra:

```text
mission fetch fail
    ↓
SOS count cũng không chạy
```

Sau đó logic fetch SOS được tách độc lập. Không gom các request không liên quan vào một failure path, tránh mission failure làm SOS marker/count biến mất.

---

# 14. HIỆN TRẠNG UI SOS DETAIL — VẤN ĐỀ MỚI NHẤT, TASK KẾ TIẾP

Người dùng vừa báo một lỗi UI theo role:

- Tài khoản người dùng bình thường không nên thấy giao diện nhận nhiệm vụ.
- Chỉ tài khoản đội cứu hộ mới có giao diện để nhận nhiệm vụ.
- Hiện tài khoản người dùng bình thường đang hiển thị nhầm màn hình “Chi tiết yêu cầu cứu hộ” có nút “NHẬN NHIỆM VỤ”.
- Người dùng muốn account bình thường hiển thị giao diện “Chi tiết SOS” như ảnh reference thứ hai; account RESCUER tiếp tục có giao diện cứu hộ/nhận nhiệm vụ khi đủ điều kiện.

## 14.1 Hai ảnh reference kèm trong gói

**Ảnh A — giao diện rescue detail đang bị hiển thị nhầm cho user thường:**

`assets/sos-detail-rescuer-current.png`

Nội dung nhìn thấy:

- Header: “Chi tiết yêu cầu cứu hộ”.
- Severity badge `HIGH`.
- Latitude/longitude.
- Thời gian.
- Khoảng cách tới bạn: `Không rõ`.
- Số người cần cứu: `4 người`.
- Tình trạng: `ASSIGNED`.
- Nhu cầu/mô tả: `Flood is rising very fast, need boat`.
- Hình ảnh đính kèm placeholder.
- CTA dưới cùng: `NHẬN NHIỆM VỤ`.

Đây là UI dành cho rescuer/request workflow và KHÔNG được hiển thị cho normal user.

**Ảnh B — giao diện SOS detail thường mà user muốn:**

`assets/sos-detail-normal-user-reference.png`

Nội dung nhìn thấy:

- Header màu xanh: “Chi tiết SOS”.
- Banner đỏ nhạt: “SOS ĐANG HOẠT ĐỘNG”, hiển thị severity `MEDIUM`.
- Mô tả cần hỗ trợ khẩn cấp.
- Card “Thời gian gửi”.
- Card “Người cần hỗ trợ” có số người lớn, trẻ em, cao tuổi và tổng số.
- Phần tình trạng y tế.
- Bottom actions: `CHỈ ĐƯỜNG`, `NHẮN TIN`, `GỌI ĐIỆN`.

Đây là giao diện normal SOS detail mong muốn cho USER/RESIDENT.

## 14.2 Expected role behavior

| Current authenticated role | Expected screen | Mission action |
|---|---|---|
| Normal user / resident | Normal “Chi tiết SOS” như ảnh B | Không được có `NHẬN NHIỆM VỤ` |
| Rescuer | Rescue-oriented detail như ảnh A hoặc rescue UI phù hợp hiện tại | Có `NHẬN NHIỆM VỤ` khi RescueRequest `PENDING` |
| Rescuer, request đã nhận | Rescue detail / accepted state | Không cho nhận lại |

Role names cụ thể phải lấy từ source/auth profile; không hardcode giả định `USER` nếu code đang dùng `RESIDENT`, hoặc ngược lại.

## 14.3 TASK 12.3 — Android Accept Mission E2E Regression

Đã từng tạo prompt cho task kiểm thử:

- Xác nhận Android gọi `POST /rescue-missions/accept/:requestId`.
- Phân biệt `requestId` với `sosEventId`.
- Test PENDING → accept → HTTP 200 → mission created → My Missions refresh.
- Test 409, 401/403, network error.
- Build/test/regression/diff.

**Tình trạng:** Có prompt task, nhưng trong lịch sử hiện có chưa nhận được final report PASS/FAIL từ người dùng cho toàn bộ Android real-device E2E. Không đánh dấu đã hoàn thành.

## 14.4 TASK 12.4 — ROLE-BASED SOS DETAIL UI — CURRENT NEXT TASK

Đã tạo prompt task, nhưng chưa nhận báo cáo implement/test. Đây là task gần nhất người dùng đã yêu cầu chuẩn bị.

Mục tiêu duy nhất:

- Inspect role source hiện tại (auth/user/profile) trong Android.
- Xác định giá trị role thực tế.
- Tìm vì sao normal user bị render rescue detail.
- Dùng role của current authenticated user để quyết định UI/navigation.
- USER/RESIDENT: giữ normal SOS Detail như ảnh B; không hiển thị nút `NHẬN NHIỆM VỤ`, không gọi accept API, không hiển thị rescue mission action.
- RESCUER: giữ rescue-oriented detail/accept flow hiện tại; PENDING thì có nút nhận; đã nhận thì không nhận lại.
- Không dùng status, có/không RescueRequest, có/không mission, GPS hay tọa độ làm proxy để đoán role.
- Ưu tiên dùng một SOS Detail screen với role-based rendering nếu kiến trúc hợp lý; không nhân bản screen khi không cần.
- Bảo toàn accept flow đã sửa ở TASK 12.2.

Allowed scope: Android role-based SOS Detail rendering/navigation và state cần trực tiếp cho yêu cầu đó.

Forbidden unless explicitly approved:

- Backend.
- Database/Prisma/Migration.
- API contract.
- SOS creation.
- RescueRequest creation.
- Accept API implementation.
- Complete mission API.
- Map.
- Multi-photo upload/detail behavior ngoài phần đảm bảo không regression.
- Chat/auth refactor.

Inspect các file đã được nhắc đến trong task:

- `SosDetailScreen.kt`.
- `SosDetailViewModel.kt`.
- `AppNavGraph.kt`.
- `RescueMissionRepository.kt`.
- Auth/User/Profile Repository hoặc ViewModel hiện có.

Không đoán package/path; dùng ripgrep/find và inspect repo thật.

Acceptance criteria:

1. Normal user mở SOS → đúng normal “Chi tiết SOS”.
2. Normal user không thấy `NHẬN NHIỆM VỤ` hay rescue mission CTA.
3. Normal user không trigger `POST /rescue-missions/accept/:requestId`.
4. Rescuer mở SOS PENDING → rescue detail và có nút nhận.
5. Rescuer đã nhận → không thể accept lần nữa.
6. Navigation vẫn đúng `sosEventId` cho SOS Detail.
7. Accept flow vẫn dùng `requestId` cho API.
8. Không regression multi-photo gallery, call/chat/directions hiện hữu.
9. Build/test và git diff được báo rõ.
10. Real-device test chỉ PASS khi chạy thật trên máy.

Nếu role không thể xác định rõ từ current authenticated user/profile hiện có: STOP và báo thiếu field/source nào. Không tạo role mới.

---

# 15. TASK HISTORY — CÁC MỐC CỨU HỘ ĐÃ ĐI QUA

Đây là timeline rút ra từ các lần inspect/implement. Một số task là investigation và không nhất thiết thay đổi code.

| Task | Nội dung | Trạng thái theo báo cáo mới nhất |
|---|---|---|
| 1 | Truy nguồn SOS Map: `GET /sos/active` và `GET /rescue-requests/nearby`, filter request `PENDING` | Investigation hoàn tất |
| 2 | Truy nguồn Rescuer Nearby, GPS, radius, nearby API | Investigation hoàn tất |
| 3 | Trace record RescueRequest lẻ ID `317c...`, không có SOSEvent relation, status ASSIGNED | Investigation hoàn tất |
| 4 | Android Nearby chỉ hiển thị `PENDING` | PASS, `RescueMissionViewModel.kt` |
| 5 | Giải thích Map 19 SOS vs 1 Nearby: dữ liệu SOS và request chưa được link | Investigation hoàn tất |
| 6 | Trace creation: `POST /sos` không tạo RescueRequest; `POST /rescue-requests` là luồng độc lập | Investigation hoàn tất |
| 7 | Chọn bridge OPTION A: auto-create RescueRequest trong transaction của POST /sos; thêm 1:1 relation | Design decision hoàn tất |
| 8 | Prisma `sosEventId String? @unique` + relation + migration `bridge_sos_event_rescue_request_2` | Report PASS; schema/migration đã thêm |
| 9 | Backend auto-create RescueRequest trong `src/sos/sos.service.ts` | Backend build PASS, behavior report PASS |
| 10 | Nearby API trả `sosEventId`, giữ PostGIS distance | PASS, service/test được cập nhật |
| 11 | Android parse `sosEventId` và điều hướng đến `Routes.sosDetail(eventId)` | Android build PASS; real device chưa ghi nhận |
| 12 | Accept mission integration trên SOS Detail | Được triển khai; sau đó phát hiện HTTP 500 khi chạy thiết bị |
| 12.1 | Điều tra HTTP 500, xác định PostgreSQL 42704 do cast enum sai | Root cause xác định |
| 12.2 | Bỏ cast `::"public"."RescueRequestStatus"` trong raw SQL | **PASS**: API, state transition, mission creation, duplicate/error cases, backend build/tests |
| 12.3 | Android accept mission real E2E regression (task prompt đã tạo) | **CHƯA CÓ FINAL REPORT** |
| 12.4 | Role-based SOS Detail UI (task prompt đã tạo) | **NEXT TASK / CHƯA IMPLEMENT CONFIRMED** |
| 13 | Complete mission flow, PATCH mission status COMPLETED; request RESOLVED; Android refresh/hide button | Build/report PASS; real device chưa ghi nhận |
| 14 | Full real-device E2E attempt | BLOCKED trong lần đó do không có ADB device/emulator |
| 15 | ADB-only verification suggestion | Đã được đề xuất; không có bằng chứng hoàn thành chính thức |

---

# 16. CÁC LỖI LỊCH SỬ VÀ CÁCH KHÔNG ĐƯỢC TÁI TẠO

## 16.1 Firebase Storage 404

Ảnh SOS từng chuyển sang Cloudflare R2. Không quay lại Firebase Storage.

## 16.2 API response wrapper

Backend thường trả:

```json
{
  "success": true,
  "data": { }
}
```

Khi parse, inspect response thực tế và lấy data đúng chỗ.

## 16.3 PostgreSQL enum cast sai

Không cast raw string thành physical enum type nếu DB column đang là TEXT.

Đã fix trong accept endpoint bằng cách bỏ:

```sql
::"public"."RescueRequestStatus"
```

Không revert fix TASK 12.2.

## 16.4 Firebase publish treo

Không đưa `await publishRealtime()` vào critical path nếu code hiện tại đã tách fire-and-forget/timeout. Inspect trước khi thay đổi.

## 16.5 SOS count phụ thuộc mission fetch

Không để mission fetch fail làm SOS list/count fail theo dây chuyền.

## 16.6 Dữ liệu RescueRequest không liên quan SOS

Legacy request có thể có `sosEventId = null`. Không giả định mọi RescueRequest đều mở được SOS Detail. Nếu tap legacy record, xử lý fallback/không navigate theo contract hiện tại, không ghép nhầm ID.

## 16.7 GPS/distance không xác định

Nếu vị trí rescuer chưa có hoặc permission/location fail, distance có thể là `Không rõ`. Không fake giá trị distance.

---

# 17. TRẠNG THÁI KIỂM THỬ — PHÂN BIỆT RÕ

| Hạng mục | Trạng thái được biết | Caveat |
|---|---|---|
| Auth / Google login | Đã được xác nhận hoạt động trong handover cũ | Không có log build mới kèm tài liệu này |
| SOS single photo | Đã chạy thực tế | Giữ backward compatibility |
| R2 / WebP single photo | PASS theo report | Config credentials nằm ở local env |
| Multi-photo Phase 2 | PASS | Selection/preview/remove |
| Multi-photo Phase 3 | PASS | Upload tuần tự |
| Multi-photo Phase 4 | PASS theo report | Android create `photos[]` |
| Multi-photo Phase 5 | Functional PASS | Build từng bị block do `JAVA_HOME` thiếu; cần build hiện tại nếu muốn xác nhận lại |
| Multi-photo full E2E | Người dùng nói chạy bình thường trên thiết bị thật | Chưa có formal matrix được report đầy đủ |
| Backend SOS→RescueRequest bridge | PASS theo reports | Verify against current DB/schema before new changes |
| Android Nearby `PENDING` filter | Build PASS | Real device not separately logged |
| Android nearby→SOS detail navigation | Build PASS | Real device not separately logged |
| Accept endpoint TASK 12.2 | Backend build/tests/API behavior PASS | Real-device Android E2E is separate and not confirmed |
| Android accept full E2E TASK 12.3 | Chưa có report | Không được tự đánh dấu PASS |
| Complete mission | Backend/Android build report PASS | Real device not separately logged |
| Role-based SOS Detail TASK 12.4 | Chưa implement confirmed | Next immediate task |
| Full rescue E2E | Previously BLOCKED | ADB/device unavailable at that time |

---

# 18. HẠNG MỤC ROADMAP / CHƯA ĐƯỢC PHÉP COI LÀ ĐÃ HOÀN THÀNH

Các hạng mục sau đã xuất hiện trong product/UI scope, nhưng trạng thái triển khai backend/UI end-to-end chưa thể kết luận từ thông tin hiện có. Gemini phải inspect repository và hỏi task cụ thể trước khi sửa:

- Hoàn thiện Warning UI/backend integration.
- Disaster Map đầy đủ, including dedupe sau SOS↔RescueRequest bridge.
- Full rescue flow end-to-end.
- Chat cá nhân và group chat.
- Notifications.
- Profile / rescue profile.
- Settings.
- Forgot Password / OTP.
- Volunteer Registration.
- About App.
- Offline/cache and robust connectivity handling.
- Dark mode polish.
- Full responsive/adaptive audit.
- Full regression toàn app.
- Release build/APK.

Danh sách 25 màn hình trong brief là roadmap, không phải bằng chứng 25 màn hình đã hoàn thành.

---

# 19. CÁCH LÀM VIỆC CHI TIẾT CHO MỌI TASK TIẾP THEO

Mọi task đều theo khuôn sau:

## A. Inspect trước

1. `pwd`, `git status --short --branch`.
2. Đọc README và cấu trúc module.
3. Tìm class/function/API thực tế bằng IDE search/grep.
4. Đọc code caller + callee + model + repository + ViewModel + navigation liên quan.
5. Xác định data contract thực tế, role thực tế, status thực tế.
6. Liệt kê file dự kiến sửa và lý do.

## B. Scope guard

- Nếu task Android mà cần backend/DB/API change: STOP và báo.
- Nếu task backend mà cần migration/schema change ngoài scope: STOP và báo.
- Không chạy destructive DB commands.
- Không xóa test data trước khi xác định ownership.
- Không tự chỉnh `.env`, keystore, Firebase, R2 config.

## C. Implement một thay đổi nhỏ

- Một feature/function/flow duy nhất.
- Không refactor để “đẹp hơn”.
- Không đổi naming/API contract tùy ý.
- Không sửa file ngoài danh sách đã xác định nếu không có lý do và phải báo lại.

## D. Verify

- Build đúng module.
- Unit test/API test phù hợp.
- Regression phần đã PASS có liên quan.
- Nếu có device, test trên device và ghi rõ model/Android/build.
- Kiểm tra logcat/backend logs nếu có lỗi.
- Kiểm tra `git diff --check`, `git diff --stat`, `git diff`.

## E. Final report bắt buộc

```text
TASK: ...
STATUS: PASS / FAIL / PARTIAL / BLOCKED
ROOT CAUSE: ...
FILES CHANGED:
- ...
IMPLEMENTATION:
- ...
BUILD: PASS / FAIL / NOT RUN (reason)
UNIT TEST: PASS / FAIL / NOT RUN
API TEST: PASS / FAIL / NOT RUN
EMULATOR: PASS / FAIL / BLOCKED / NOT RUN
REAL DEVICE: PASS / FAIL / BLOCKED / NOT RUN
REGRESSION:
- ...
GIT DIFF:
- ...
OUT-OF-SCOPE CHANGES: NONE / list
NEXT: STOP (do not begin next task)
```

---

# 20. TASK HIỆN TẠI GIAO CHO GEMINI

## TASK 12.4 — ROLE-BASED SOS DETAIL UI

**Không bắt đầu bằng việc viết code ngay.** Bắt đầu bằng inspect role source và luồng navigation/render.

### Mục tiêu nghiệp vụ

- Normal user/resident chỉ xem normal SOS Detail như ảnh B.
- Rescuer xem rescue-oriented detail và có thể nhận nhiệm vụ nếu request đang PENDING.
- Cùng một SOSEvent có thể có RescueRequest liên kết, nhưng việc có RescueRequest không biến current user thành Rescuer.

### Chẩn đoán bắt buộc

Tìm nguồn current authenticated user/profile/role. Kiểm tra:

- Auth state object.
- `/auth/me` response model nếu đang dùng.
- User/Profile repository.
- Role enum/serializer.
- App-level state/ViewModel.
- `SosDetailViewModel.kt`.
- `SosDetailScreen.kt`.
- `AppNavGraph.kt`.

Xác định vì sao normal user vào nhầm rescue detail:

- route dùng sai screen?
- shared detail screen không role-gated?
- role state không load/không propagate?
- fallback role sai?
- ViewModel đang phân loại dựa vào RescueRequest thay vì current user?

Không suy đoán. Viết kết luận ngắn trước khi sửa.

### Acceptance criteria

| Case | Expected |
|---|---|
| Normal user mở SOS từ map/list | Normal SOS Detail giống ảnh B |
| Normal user detail | Không có nút/CTA `NHẬN NHIỆM VỤ` |
| Normal user detail | Không gọi accept endpoint |
| Rescuer mở SOS PENDING | Rescue detail + nút nhận |
| Rescuer mở request đã nhận | Không cho nhận lại |
| Rescuer accept | Vẫn gọi `POST /rescue-missions/accept/:requestId` |
| Navigation | Dùng `sosEventId` mở SOS detail; dùng `requestId` cho accept |
| Multi-photo | Không làm mất gallery đã triển khai |
| Existing user actions | Không làm hỏng directions/call/chat |

### Scope

Chỉ Android role-based rendering/navigation cho SOS Detail. Không backend, database, Prisma, migration, API contract, map, SOS create, multi-photo redesign, accept API rewrite, complete mission rewrite.

### Nếu không tìm được role

Dừng và báo chính xác trường/source còn thiếu. Không tạo role mới. Không dùng status của RescueRequest làm role.

### Sau khi PASS

Dừng. Không tự động tiếp tục TASK 12.3 hoặc task khác, trừ khi người dùng yêu cầu thứ tự khác. Ghi rõ nếu Android real-device test bị BLOCKED.

---

# 21. FILES VÀ ASSETS KÈM THEO GÓI

```text
Gemini_Handoff_Canh_Bao_Thien_Tai/
├── HANDOFF_GEMINI.md
├── assets/
│   ├── sos-detail-rescuer-current.png
│   └── sos-detail-normal-user-reference.png
└── diagnostics/
    └── accept-mission-http500-before-fix.txt
```

Ảnh A là giao diện rescuer đang bị hiển thị nhầm cho normal user. Ảnh B là normal SOS Detail người dùng mong muốn.

Log trong `diagnostics/` là log lỗi trước TASK 12.2. TASK 12.2 đã PASS và fix lỗi enum cast, nên Gemini không được kết luận HTTP 500 đó hiện còn xảy ra chỉ dựa vào log cũ.

---

# 22. THÔNG TIN CÒN THIẾU — PHẢI XÁC MINH TỪ REPOSITORY, KHÔNG ĐƯỢC TỰ BỊA

1. Git remote/repository URL của Android và backend: không có trong tài liệu lịch sử hiện có.
2. Branch hiện tại, commit hash và các thay đổi chưa commit.
3. Package name / module names / source-set chính xác của Android.
4. Giá trị role chính thức và source of truth của role.
5. API base URL hiện tại, LAN IP hiện tại, tunnel hiện tại.
6. `.env`/Firebase/R2/Google Maps credentials (chỉ đọc local; không copy secrets vào chat).
7. Phiên bản JDK/Gradle/Android Gradle Plugin hiện tại và khả năng build trên máy hiện tại.
8. Thiết bị Android/ADB/emulator hiện có.
9. Migration đã được apply trên DB hiện tại chưa và status Prisma migration.
10. Data hiện tại trong DB — không dùng UUID test lịch sử làm bằng chứng record còn tồn tại.
11. Map dedupe sau khi auto-create RescueRequest đã được xử lý chưa.
12. SOS event có được resolve đồng bộ khi mission complete hay vẫn giữ ACTIVE như report cũ.
13. Full Android accept flow TASK 12.3 đã được test trên device sau TASK 12.2 chưa.
14. Build Phase 5 gallery cần xác minh lại vì từng có JAVA_HOME issue.

---

# 23. TÓM TẮT TRẠNG THÁI CUỐI

```text
PROJECT: CẢNH BÁO THIÊN TAI

ANDROID:
- Kotlin + Jetpack Compose + Material 3
- MVVM + Repository
- Firebase Auth + Firebase RTDB
- Google Maps
- Cloudflare R2 for SOS photos

BACKEND:
- NestJS + TypeScript
- PostgreSQL + PostGIS
- Prisma + Docker
- Cloudflare R2
- Firebase RTDB publisher

CONFIRMED COMPLETED / REPORTED PASS:
- Auth / Google login
- SOS single photo
- R2/WebP image flow
- Multi-photo Phase 2: selection
- Multi-photo Phase 3: sequential R2 upload
- Multi-photo Phase 4: create SOS photos[]
- Multi-photo Phase 5: detail gallery functionally
- Backend SOS -> auto-create linked RescueRequest
- Prisma SOSEvent <-> RescueRequest optional 1:1 sosEventId relation
- Nearby API returns sosEventId
- Android Nearby filters PENDING
- Android nearby -> SOS detail navigation
- Backend accept mission TASK 12.2 SQL cast fix
- Complete mission implementation/build report

NOT FULLY VERIFIED / OPEN:
- Formal complete multi-photo E2E test matrix
- Android accept E2E after TASK 12.2 (TASK 12.3)
- Real-device complete mission test
- Map duplicate marker audit after bridge
- SOS status synchronization when mission is completed
- Current build environment / device availability

NEXT TASK:
TASK 12.4 — Role-based SOS Detail UI
- Normal USER/RESIDENT sees normal SOS detail (reference image B)
- RESCUER sees rescue detail and accepts PENDING request
- Never show accept mission UI to normal user
- Inspect actual role source before changing code

ABSOLUTE RULES:
- One small task at a time
- Inspect before coding
- No unrelated refactor
- No backend/DB/API changes unless explicitly approved
- Preserve PASS behavior
- Build/test/regression/diff/report
- Do not claim tests not run
- Stop after PASS
```

**Hết bản bàn giao.** Gemini hãy xác nhận đã đọc tài liệu, sau đó inspect repository thực tế và tiếp tục đúng TASK 12.4. Không bắt đầu task khác trước khi task này được xử lý hoặc người dùng đổi yêu cầu.
