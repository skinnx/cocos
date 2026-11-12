# EMBERHOLD — SPEC v2.0 "Hold bền vững"

> **Tên tạm:** *Emberhold* (cần kiểm tra trademark trước khi phát hành).
> **Thể loại:** Squad-action + xây căn cứ tự do + thủ thành theo đêm, trên **một căn cứ tồn tại lâu dài**.
> **Nền tảng:** Mobile 100% (màn dọc, một ngón cái). **Engine:** COCOS 4 + TypeScript.
> **Người đọc tài liệu này:** một AI coding agent chạy tự chủ. Mọi thứ cần để làm xong game nằm ở đây.
> **Khác v1:** v1 chia game thành các "run" 10 đêm rồi làm lại từ đầu. v2 bỏ run: người chơi có **một Hold duy nhất, không bao giờ bị xóa**, chơi nối tiếp ngày này qua ngày khác. Yếu tố roguelite được dời vào các chuyến Viễn chinh ngắn và Phước lành tạm thời (§11.6, §11.7).

---

## 0. Cách đọc và thi hành tài liệu này

1. **Thứ tự ưu tiên khi có mâu thuẫn:** §15 Definition of Done → §14 Milestones → bảng số liệu (§17) → phần mô tả. Nếu SPEC thiếu một chi tiết, tự chọn phương án phục vụ tốt nhất §1 (Trụ cột), ghi quyết định vào `docs/DECISIONS.md` (1 dòng/quyết định) rồi làm tiếp. **Không dừng lại để hỏi.**
2. **MUST / SHOULD / COULD.** MUST là bắt buộc để coi là xong. SHOULD làm sau khi mọi MUST đã qua kiểm chứng. COULD chỉ làm nếu còn dư sức. Mục không ghi nhãn = MUST.
3. **Số liệu cân bằng là điểm khởi đầu, không phải hợp đồng.** Được phép chỉnh số để qua các cổng ở §13.6. Luật chơi và danh sách nội dung thì không được cắt. Mọi thay đổi số phải ghi vào `docs/DECISIONS.md` kèm lý do.
4. **Cấm làm cho xong.** Những thứ sau bị coi là *chưa làm*:
   - Thực thể gameplay vẽ bằng hình khối đơn sắc (`Graphics`, ô vuông, hình tròn, emoji, chữ cái) thay cho sprite pixel-art qua pipeline §9.
   - Hệ thống chỉ có dữ liệu/UI mà không có hành vi (nút không làm gì, tháp không bắn, phước lành không có hiệu lực).
   - `TODO`, `placeholder`, `stub`, hàm rỗng trong phần MUST.
   - Báo "đã xong" mà chưa chạy `npm run verify` và chưa tự xem ảnh chụp màn hình.
5. **IP gốc.** Game lấy cảm hứng *thể loại* từ các game squad-RPG và thủ-thành-xây-tường trên mobile. Không dùng tên, nhân vật, hình ảnh, màn chơi, âm thanh của bất kỳ game nào có sẵn. Mọi asset tự sinh trong repo.
6. **Đã có codebase v1.** Repo đã có lõi mô phỏng, art, audio, lớp view Cocos, bản xem trước web và bộ test theo SPEC v1. v2 là **nâng cấp trên nền đó**, không viết lại: §13.8 nói phần nào giữ, phần nào đổi; §14 là lộ trình di trú.

---

## 1. Tầm nhìn

**Một câu:** Bạn giữ một ngọn lửa giữa vùng đất bị bóng tối nuốt dần. Mỗi ngày dẫn tiểu đội đi gom tài nguyên và mở đất, mỗi đêm bóng tối (*the Gloom*) tràn về thử pháo đài bạn tự tay xếp từng ô. Ngôi làng quanh Lò Lửa (*the Hearth*) lớn dần theo năm tháng và là của bạn mãi.

### 1.1 Trụ cột thiết kế (mọi quyết định phải phục vụ ít nhất một trụ cột)

| # | Trụ cột | Nghĩa là |
|---|---|---|
| P1 | **Xây tự do, có hậu quả** | Đặt tường/tháp/bẫy/nhà trên lưới ô tự do, kéo ngón tay để "sơn" tường. Quái tìm đường theo đúng những gì bạn xây. |
| P2 | **Ánh sáng là lãnh thổ** | Chỉ xây được trong vùng sáng. Tháp chỉ thấy quái trong vùng sáng. Mở rộng lửa = mở rộng đất, nhưng thêm thứ phải bảo vệ. |
| P3 | **Một ngón cái** | Màn dọc. Kéo để đi, tiểu đội tự đánh. Mọi thao tác chạm được bằng ngón cái tay cầm máy. |
| P4 | **Mỗi đêm một câu đố mới** | Biết trước đêm nay quái gì đến, tuần trăng đổi luật mỗi đêm, tự chọn mức cược, mỗi bình minh chọn 1 trong 3 quà. |
| P5 | **Nhìn là muốn chơi** | Pixel-art 16px có outline, bóng đổ, ánh lửa, hiệu ứng "juice" đầy đủ. |
| P6 | **Luôn có việc đáng làm tiếp** | Ở bất kỳ thời điểm nào người chơi cũng thấy ít nhất 3 mục tiêu cách mình 1 phiên, 1 ngày và 1 tuần. Rời game luôn để lại một thứ đang chạy dở để quay lại nhận. |
| P7 | **Tiến lên, không mất trắng** | Thua một đêm là lùi một bước nhỏ, không bao giờ xóa tiến trình. Không có gì xấu xảy ra khi người chơi vắng mặt. |

### 1.2 Khác gì so với cảm hứng gốc
- Squad-RPG gốc: xây làng chỉ là menu nâng cấp → ở đây làng là **vật thể trên bản đồ**, tự xếp từng ô, có dân làng đi lại, và bị tấn công thật.
- Thủ-thành gốc: mỗi màn xây lại từ đầu → ở đây **một pháo đài duy nhất lớn dần**, mỗi quyết định bố cục theo người chơi lâu dài.
- Mới: ánh sáng là lãnh thổ (P2), quái phá tường theo chi phí đường đi (§7.4), tự đặt cược độ khó mỗi đêm (§8.3), hero vừa ra trận vừa đồn trú trên tháp (§11.5).

### 1.3 Chuẩn mobile 2027 và nguyên tắc giữ chân lành mạnh
- Phiên chơi 5–10 phút, chơi offline, 60 fps trên máy tầm trung, tự lưu liên tục, thoát giữa chừng không mất gì.
- Không quảng cáo ép, không IAP, không bán sức mạnh, không năng lượng chặn chơi.
- **Kéo người chơi quay lại bằng phần thưởng đang chờ, không bằng hình phạt khi vắng.** Cụ thể: không có tấn công khi offline, không mất chuỗi đăng nhập, không có vật phẩm sức mạnh chỉ lấy được trong một khoảng thời gian giới hạn. Sự kiện luôn lặp lại.
- Có rung (haptics), chế độ chữ to, chỉ báo không phụ thuộc màu sắc.

---

## 2. Cấu trúc chơi liên tục

### 2.1 Ba nhịp lồng nhau

```
NHỊP PHÚT   : PEACE (ngày) → DUSK (chuẩn bị) → NIGHT (thủ) → DAWN (nhận quà) → PEACE …   không có điểm kết thúc
NHỊP PHIÊN  : mở game → nhận hàng lúc vắng → tiêu/xây/nâng cấp → 1 chuyến Viễn chinh hoặc 1–2 đêm → cử hero đi Thám báo → thoát
NHỊP DÀI    : mỗi ngày (Bounty, Đường Mới, Lữ khách) · mỗi 7 đêm (Trăng Máu) · mỗi tuần (Biên niên) · mỗi vài tuần (phong ấn một Vùng, nâng bậc Hearth)
```

Không có "run", không có màn Victory/Defeat kết thúc game. Bộ đếm duy nhất là **Đêm thứ N của Hold**, tăng mãi.

### 2.2 Máy trạng thái của Hold

| Pha | Thời lượng | Người chơi làm gì | Kết thúc khi |
|---|---|---|---|
| **PEACE** | 150 s thời gian *trong thế giới* (dừng khi mở menu; **dừng hẳn khi ở Build mode**) | Dẫn đội đi gom tài nguyên, dọn ổ quái, mở sương mù; xây và sắp xếp làng; vào menu Hero, Rèn, Nghiên cứu; ra Bến tàu đi Viễn chinh (thời gian ở nhà đứng yên trong lúc đi). | Hết giờ, hoặc bấm **Chuông Hoàng Hôn** (+10% chiến lợi phẩm đêm nếu còn ≥ 60 s). |
| **DUSK** | Tạm dừng | Camera về Hearth, tự vào Build mode. Xem **Điềm báo** (quái gì, từ khe nào, pha trăng, biến cố). Chọn **mức Hải đăng** (độ khó ↔ phần thưởng, §8.3). Sắp hero đồn trú. Trừ nhiên liệu brazier. | Bấm **Bắt đầu đêm**. |
| **NIGHT** | ~50–90 s | Quái sinh theo nhịp từ các khe nứt. Lái tiểu đội, bấm Tù và, mở Build mode (0.25×) để vá tường. Dân làng trốn trong nhà. | Hết quái, hoặc Hearth về 0 HP (§2.4). |
| **DAWN** | Tạm dừng | Bảng tổng kết → chọn **1 trong 3 quà bình minh** (§11.7) → hero gục hồi sinh, bẫy nạp lại, cây đá mọc lại theo §4.4, dân làng ăn và đi làm, tự lưu. | Chọn quà xong → PEACE. |

Thoát game ở bất kỳ pha nào đều an toàn: PEACE/DUSK/DAWN lưu nguyên trạng; thoát giữa NIGHT thì lần sau mở lại ở DUSK của chính đêm đó, không bị tính thua.

### 2.3 Khi vắng mặt
- Thời gian trong thế giới **đứng yên**. Không có đêm nào diễn ra khi người chơi không có mặt.
- Chỉ ba thứ chạy theo đồng hồ thật: sản xuất của dân làng (25% tốc độ, tới khi đầy kho, tối đa 8 giờ), các chuyến Thám báo (§11.5), và các mốc theo ngày (§11.10).
- Khi mở lại game: bảng **"Trong lúc bạn đi vắng"** liệt kê tài nguyên thu được, chuyến Thám báo đã về, Bounty mới, Lữ khách đang ghé. Một nút "Nhận tất cả".

### 2.4 Thua một đêm (không mất trắng)
Hearth về 0 HP → đêm dừng ngay, màn **"Lửa lụi"**:
- Quái tan biến. Hearth tự cháy lại với 50% HP lúc DAWN.
- Công trình đã vỡ trong đêm thành **đống đổ nát** giữ nguyên vị trí và cấp: dựng lại tốn 50% giá gốc (một chạm "Dựng lại tất cả" nếu đủ tài nguyên).
- Mất 20% mỗi loại tài nguyên **vượt trên mức Hầm bảo vệ** (§11.3). Không mất hero, trang bị, nghiên cứu, bậc Hearth.
- Chỉ số Hiểm họa giảm 2 (§8.2) và 2 đêm kế tiếp tự đặt Hải đăng ở mức Lặng → người chơi luôn có đường hồi phục.
- Không có quà bình minh, nhưng vẫn nhận 50% vàng từ quái đã hạ.

### 2.5 Bảng lý do quay lại (P6)

| Quãng | Thứ đang chờ | Hệ thống |
|---|---|---|
| 15 phút – 8 giờ | Chuyến Thám báo về, kho đầy dần | §11.5, §11.3 |
| Mỗi lần mở game | Bảng "Trong lúc bạn đi vắng", Phước lành còn mấy đêm | §2.3, §11.7 |
| Mỗi ngày | 3 Bounty mới, 3 Đường Mới cho Viễn chinh, 3 hòn đảo mới, Hơi ấm Lò Lửa +1 | §11.10, §11.6 |
| Mỗi 3 bình minh | Lữ khách ghé chợ với 4 món đổi chác | §11.10 |
| Mỗi 7 đêm | Đêm Trăng Máu: vây hãm lớn, phần thưởng hiếm | §8.4 |
| Mỗi tuần | Biên niên 7 mốc, mốc cuối là vật trang trí | §11.10 |
| Vài tuần | Phong ấn Tim Khe Nứt để mở Vùng mới, quái mới, công trình mới; nâng bậc Hearth | §11.1, §11.2 |
| Dài hạn | Sưu tập hero lên 5 sao, Sách Gloom, thành tựu, trang trí, Di sản | §11.4, §11.11, §11.12 |

Mọi màn hình chính (HUD ở PEACE và màn Hold) phải hiện **"Mục tiêu kế tiếp"**: một dòng cho mục tiêu gần nhất của ba quãng phiên/ngày/tuần, chạm vào thì dẫn tới nơi thực hiện.

### 2.6 Một phiên mẫu (7 phút) để kiểm tra thiết kế
1. Mở game → "Trong lúc bạn đi vắng": +180 gỗ, +90 đá, Wren về từ Thám báo mang 6 mảnh hero và 1 trang Tri thức. *(20 s)*
2. Đủ đá nâng tháp cung lên cấp 2, sơn thêm một đoạn tường quanh nhà mới, gán 2 dân làng vào mỏ đá. *(60 s)*
3. Ra Bến tàu, chọn đảo "Bờ Rêu — nhiều sắt, quái nhanh +20%", chơi Viễn chinh 3 phút, rút lui kịp với 2/3 hòm. *(190 s)*
4. Về nhà, bấm Chuông Hoàng Hôn. Điềm báo: nhiều Spitter, trăng khuyết (tầm tháp −1). Chọn Hải đăng mức Dữ. Chuyển Ilka lên đồn trú tháp cạnh cổng. *(40 s)*
5. Thủ đêm 80 s, thắng. Bình minh: chọn Phước lành "Tro Nóng" (3 đêm). Hoàn thành Bounty "Thắng một đêm mức Dữ". *(110 s)*
6. Cử Wren đi Thám báo 4 giờ, thoát. *(15 s)*

### 2.7 Ba phiên đầu tiên (onboarding kéo dài, mỗi phiên mở một thứ)
- **Phiên 1 (≈8 phút):** hướng dẫn 5 bước (§10.3) → đêm 1 → bình minh đầu tiên → dựng Nhà đầu tiên, dân làng xuất hiện → đêm 2 → giải cứu hero thứ hai ở lồng gần nhà. Kết phiên: gợi ý nâng Hearth bậc 2.
- **Phiên 2:** bảng "Trong lúc bạn đi vắng" lần đầu → Hearth bậc 2 → mở Bến tàu, chuyến Viễn chinh đầu tiên có dẫn dắt → mở Bounty.
- **Phiên 3:** Hearth bậc 3 → Trạm Thám báo và Đồn trú → Trăng Máu đầu tiên (đêm 7) → mở Biên niên.
Không hệ thống nào ngoài danh sách trên được hiện ra trước thời điểm của nó (nút bị ẩn, không phải bị khóa mờ).

---

## 3. Điều khiển và camera

- **Màn dọc**, design resolution 720×1280, fit width, tôn trọng safe-area (tai thỏ, thanh home). Máy cao hơn 16:9 thấy thêm thế giới theo chiều dọc.
- **Pixel-perfect:** 1 pixel art = số nguyên pixel thiết bị. Tính lúc chạy: `n = max(2, round(deviceWidthPx / 180))`, scale thế giới sao cho 1 art px = n device px (≈ 11 ô ngang màn hình). Mọi texture dùng filter NEAREST, không mipmap. Vị trí sprite làm tròn về art px khi render.
- **Action mode (mặc định):**
  - Chạm-kéo ở bất kỳ đâu trong 65% dưới màn hình → joystick ảo hiện tại điểm chạm. Trưởng nhóm đi theo hướng kéo, tốc độ tỉ lệ độ lệch (dead-zone 12%).
  - Hero tự tấn công mục tiêu gần nhất trong tầm, tự dùng skill khi hồi xong.
  - Nút **Tù và** (phải-dưới, 96 px): nạp bằng số quái hạ (40 điểm), kích hoạt: hero + tháp +50% tốc đánh trong 6 s.
  - Nút **Búa** (phải-dưới, cạnh Tù và): vào Build mode.
  - Camera bám trưởng nhóm, look-ahead 1.5 ô theo hướng đi, làm mượt 0.15 s.
- **Build mode:** xem §6.2. Trong PEACE và DUSK thời gian dừng hẳn; trong NIGHT chạy 0.25×.
- Chạm 2 ngón: pan. Pinch: zoom 3 nấc số nguyên (n−1, n, n+1 device px/art px). Mọi vùng chạm ≥ 88×88 design px.

---

## 4. Thế giới

### 4.1 Lưới và bản đồ
- Lưới ô vuông, 1 ô = 16×16 art px. Bản đồ **96×96 ô**, một hòn đảo lớn sinh thủ tục từ `seed` của Hold (RNG tất định mulberry32). Bản đồ **không bao giờ sinh lại**: mọi thay đổi (cây đã chặt, công trình, sương mù đã mở) được lưu.
- Hearth 2×2 ở tâm. Quanh Hearth bán kính 6 ô luôn là cỏ trống.
- Đảo chia thành **5 Vùng** theo khoảng cách tới tâm và góc (ranh giới uốn lượn bằng nhiễu, không phải vòng tròn hoàn hảo):

| Vùng | Tên | Vị trí | Địa hình chủ đạo | Tài nguyên riêng |
|---|---|---|---|---|
| 1 | Đồng Cỏ Lửa | bán kính 0–16 quanh tâm | `meadow`, ít `forest` | gỗ, đá, ít sắt |
| 2 | Rừng Thông Thẫm | cung phía bắc và tây, bán kính 16–30 | `forest` dày | gỗ nhiều, **nhựa thông** |
| 3 | Cánh Đồng Đá | cung phía đông, bán kính 16–30 | `quarry`, `ruins` | đá, sắt nhiều, **trang Tri thức** |
| 4 | Biên Băng | vành bắc, bán kính 30–44 | `snow` (tuyết, băng, thông phủ tuyết) | **tinh thể băng** |
| 5 | Đất Tro | vành nam, bán kính 30–44 | `ash` (đất cháy, dung nham nguội, cây khô) | **than lõi** |

- Rìa ngoài cùng là `shore` rồi `water`. Chuyển tiếp biome dùng sprite viền phủ (§9.4), không được để ô vuông cắt cụt.
- Cổng kiểm tra sinh map (unit test, 100 seed): luôn có đường đi bộ từ mọi khe nứt tới Hearth; Vùng 1 có ≥ 40 cây và ≥ 20 đá; mỗi Vùng có đủ POI theo §4.3; không POI nào bị nước/vật cản bao kín.

### 4.2 Sương mù và Bức Màn Gloom
- **Sương mù:** ô chưa từng nằm trong tầm nhìn (bán kính 5 ô quanh trưởng nhóm, hoặc trong vùng sáng tĩnh) hiển thị tối hoàn toàn. Ô đã khám phá hiển thị bình thường vào ban ngày và **được nhớ mãi**.
- **Bức Màn:** Vùng chưa mở bị một bức màn tím đặc che kín (sprite sương cuộn 4 khung ở ranh giới). Hero bước vào Bức Màn mất 5% HP/giây và bị đẩy ra. Phong ấn Tim Khe Nứt của Vùng hiện tại (§11.2) thì Bức Màn của Vùng kế tiếp tan với một màn hoạt cảnh 3 s.

### 4.3 Điểm tương tác (POI)

| POI | Số lượng | Hành vi |
|---|---|---|
| Cây (pine, oak, thông tuyết, cây khô) | theo biome | Cho gỗ. Chặt xong còn gốc cây. Chặn đường đi và chặn xây. |
| Đá (nhỏ/vừa/lớn) | theo biome | Cho đá. Đá lớn chặn đường và chặn xây; đá nhỏ và vừa đi qua được nhưng chặn xây cho tới khi đập hết. |
| Mạch quặng sắt | 4–6 mỗi Vùng | Cho **sắt**. Chặn xây. |
| Node đặc sản (nhựa thông, tinh thể băng, than lõi) | 6–8 ở Vùng tương ứng | Cho nguyên liệu Vùng, dùng cho rèn và nghiên cứu. |
| Ổ Gloom (camp) | 4 mỗi Vùng đã mở | 4–8 quái canh giữ, mạnh theo Vùng. Dọn sạch → rương: vàng + tinh chất + 30% cơ hội mảnh hero. **Mọc lại sau 3 đêm** ở cùng vị trí. |
| Lồng hero | 1 ở Vùng 1 (hướng dẫn), sau đó xuất hiện ngẫu nhiên: 10% mỗi bình minh, tối đa 1 trên bản đồ | Phá lồng (HP 40) → hero mới (nếu còn hero chưa có) hoặc 10 mảnh của một hero đang có. |
| Điện thờ | 2 mỗi Vùng | Chạm 1 lần, hồi lại sau 5 đêm: buff tới hết đêm kế (ngẫu nhiên: +20% sát thương hero / +25% tốc tháp / hồi đầy máu Hearth). |
| Phế tích cổ | 3 ở Vùng 3, 1 ở mỗi Vùng khác | Hero đứng trong 4 s để lục: 1–3 trang Tri thức. Hồi lại sau 6 đêm. |
| Khe nứt (rift) | 2 ở rìa mỗi Vùng đã mở, cách Hearth ≥ 14 ô | Nơi quái sinh ban đêm. Số khe hoạt động mỗi đêm theo §8.2. Luôn hiện trên minimap. |
| Rễ khe nứt | 1 cạnh mỗi khe sẽ hoạt động đêm nay, mọc lại mỗi PEACE | HP 150, có 3–5 quái canh. Phá trong PEACE → khe đó −30% ngân sách quái đêm nay. |
| Tim Khe Nứt | 1 mỗi Vùng, ở điểm xa Hearth nhất của Vùng | Mục tiêu vây hãm để mở Vùng kế tiếp (§11.2). |
| Bến tàu | 1, do người chơi xây ở ô `shore` | Cửa đi Viễn chinh (§11.6). |

### 4.4 Thu hoạch và mọc lại
- Hero đứng trong 1.2 ô quanh node và không có quái trong tầm sẽ tự thu hoạch, mỗi hero 1 nhát/0.6 s. Cây: 3 nhát, +2 gỗ/nhát. Đá nhỏ 2 nhát (+2 đá/nhát), vừa 4, lớn 7. Quặng: 5 nhát, +2 sắt/nhát. Node đặc sản: 4 nhát, +1/nhát. Tài nguyên bay thành icon về HUD.
- **Mọc lại theo số đêm** (không theo đồng hồ thật): gốc cây thành cây sau 2 đêm; đá mọc lại sau 4 đêm; quặng và node đặc sản sau 6 đêm. Node nằm trong vùng sáng tĩnh **không mọc lại** → mở rộng làng thì phải đi xa hơn để gom, hoặc dựa vào dân làng (§11.3).
- Thu hoạch bằng tay là nguồn chính trong 10 đêm đầu; về sau dân làng lo tài nguyên cơ bản, hero đi gom thứ hiếm.

### 4.5 Đảo Viễn chinh
Bản đồ riêng 40×40 sinh từ `seed = ngày + chỉ số đảo`, không lưu lại sau chuyến đi. Luật ở §11.6.

---

## 5. Ánh sáng (cơ chế chữ ký)

- **Nguồn sáng tĩnh:** Hearth (bán kính 7 → 16 ô theo 10 bậc, §11.1), Brazier (4 ô; nâng cấp 5.5 ô; 7 ô với nghiên cứu), Pháo Sáng của Sable (tạm thời). **Nguồn sáng động:** đèn của trưởng nhóm (3 ô).
- Mỗi ô có trạng thái: `lit` (trong bán kính), `dim` (trong bán kính + 1.5), `dark`.
- **Luật 1 — Lãnh thổ:** chỉ đặt công trình lên ô `lit` bởi nguồn sáng **tĩnh** (ngày cũng như đêm). Brazier phải đặt trên ô `lit` hoặc `dim` → nối chuỗi brazier để mở đất.
- **Luật 2 — Tầm nhìn tháp:** ban đêm tháp chỉ nhắm quái ở ô `lit`/`dim`. Quái ở ô `dark` là "ẩn": chỉ vẽ đôi mắt phát sáng, +25% tốc độ. Hero thấy mọi thứ trong tầm đánh của mình.
- **Luật 3 — Nhiên liệu:** đầu mỗi đêm mỗi brazier tự trừ 1 gỗ; thiếu gỗ thì brazier đó tắt đêm nay (ưu tiên giữ brazier gần Hearth).
- **Luật 4 — Bị dập:** brazier bị Snuffer hoặc boss dập sẽ tắt; hero đứng cạnh 2 s để thắp lại. Công trình trên ô mất sáng vẫn tồn tại nhưng tháp ở đó không nhắm được quái ngoài vùng sáng.
- **Hiển thị:** lớp phủ bóng tối là một texture độ phân giải thấp (1 texel = 4×4 art px) cập nhật mỗi khung từ CPU, 3 mức alpha rời rạc (lit 0 / dim 0.45 / dark 0.85 ban đêm; ban ngày chỉ dùng cho sương mù), màu `#1b1b2f`, filter NEAREST → mép sáng bậc thang kiểu pixel. Ánh lửa rung ±0.25 ô theo sin + nhiễu. Chuyển ngày→đêm nội suy alpha trong 3 s. Có vòng màu cam ấm rất nhạt (alpha 0.08) trong vùng `lit` ban đêm.

- **Luật 5 — Làng trong ánh sáng:** Nhà và mọi công trình sản xuất chỉ hoạt động khi toàn bộ footprint đang `lit`. Brazier nuôi sáng cho chúng bị dập thì đêm đó dân trong nhà hoảng sợ: sáng hôm sau sản xuất −25%.
- Pha trăng (§8.4) cộng/trừ vào mọi bán kính sáng trong đêm đó.

---

## 6. Xây dựng tự do

### 6.1 Luật đặt
- Mỗi công trình chiếm footprint w×h ô. Hợp lệ khi: mọi ô `lit` tĩnh (§5), không nước, không cây/đá/quặng/POI (đập hết đá nhỏ và vừa thì xây được), không công trình khác hay đống đổ nát, không có hero đứng trong (quái đứng trong thì vẫn cho đặt bẫy, không cho đặt vật cản).
- **Được phép bịt kín hoàn toàn.** Quái sẽ phá tường theo §7.4. Không có luật "phải chừa đường".
- Hero đi xuyên **Gate**; mọi vật cản khác chặn hero. Bẫy không chặn ai.
- Xây xong tức thì, có hiệu ứng nảy + bụi. Công trình mới đặt trong NIGHT có 1.5 s "đang dựng" (50% HP, chưa hoạt động); dựng xong hồi lại phần HP còn thiếu, trừ sát thương đã nhận.
- **Nâng cấp** (chạm công trình → vòng menu: Nâng cấp / Sửa / Bán): tối đa cấp 3. Sửa: 1 gỗ (hoặc 1 đá với đồ đá) cho mỗi 15 HP; Hearth không sửa được bằng tài nguyên (§11.1). Bán: hoàn 60% (100% trong DUSK hoặc khi Undo ngay trong cùng phiên Build).

### 6.2 UX Build mode
- Vào bằng nút Búa. Thời gian dừng hẳn trong PEACE và DUSK, 0.25× trong NIGHT. Viền màn hình có họa tiết bản vẽ, lưới ô hiện mờ trong vùng xây được, vùng không xây được phủ sọc chéo.
- **Ngăn kéo đáy** 4 tab: Phòng thủ / Ánh sáng / Bẫy / Kinh tế. Mỗi thẻ: sprite thật của công trình, tên, giá, khóa nếu chưa mở.
- Chọn thẻ rồi:
  - Công trình 1×1 "sơn được" (tường, bẫy): chạm-kéo để sơn một đường; khóa trục ngang/dọc theo hướng kéo ban đầu, kéo chéo thì vẽ đường Bresenham 4-liên thông. Bóng ma xanh/đỏ từng ô, hiện tổng giá ngay trên ngón tay, thả tay mới trừ tiền và đặt (đặt được bao nhiêu ô đủ tiền).
  - Công trình khác: chạm để đặt bóng ma, kéo để dời, nút ✓ xác nhận / ✕ hủy nổi cạnh bóng ma. Hiện vòng tầm bắn và các đường nối synergy (§6.4) trong lúc kéo.
- Không chọn thẻ: 1 ngón pan camera; chạm công trình mở vòng menu.
- Kéo sát mép màn hình thì camera tự cuộn. Nút Undo (hoàn tác thao tác đặt gần nhất, tối đa 20 bước trong phiên). Nút thoát Build mode.
- Tường tự nối hình (auto-tile theo 4 hướng lân cận, 16 biến thể).

### 6.3 Danh mục công trình

Giá viết `gỗ/đá/vàng`. Thời điểm mở từng công trình theo bậc Hearth ở §11.1 (cột Nhãn chỉ mức ưu tiên làm). Cấp 2 và 3: giá ×1.6 và ×2.5 so với cấp 1; chỉ số tăng ghi ở cột cuối.

| id | Tên | Ô | Giá | HP | Chức năng (cấp 1) | Nâng cấp | Nhãn |
|---|---|---|---|---|---|---|---|
| `hearth` | Lò Lửa | 2×2 | — | 500 | Lõi. Sáng 7 ô. Tự bắn tia lửa yếu (tầm 4, 5 sát thương/s, +1 sát thương mỗi bậc). | 10 bậc, xem §11.1 | MUST |
| `wall_wood` | Tường gỗ | 1×1 | 4/0/0 | 60 | Vật cản. Sơn được. | → `wall_stone` | MUST |
| `wall_stone` | Tường đá | 1×1 | 0/6/0 | 160 | Vật cản. Sơn được. | C2: HP 260 | MUST |
| `gate` | Cổng | 1×1 | 10/0/0 | 90 | Hero đi xuyên, quái coi như tường. | C2: HP 200 (0/12/0) | MUST |
| `brazier` | Lò than | 1×1 | 12/4/0 | 40 | Sáng 4 ô. Nhiên liệu 1 gỗ/đêm. | C2: sáng 5.5, HP 80 | MUST |
| `tower_arrow` | Tháp cung | 1×1 | 20/10/0 | 120 | Tầm 5, 8 `pierce`, 1.0 phát/s, đơn mục tiêu, bắn được quái bay. | +40% sát thương/cấp, C3 tầm 6 | MUST |
| `tower_ballista` | Nỏ lớn | 2×2 | 30/40/0 | 200 | Tầm 8, 30 `impact`, 0.4 phát/s, xuyên thẳng tối đa 4 quái. Không bắn quái bay. | +40%/cấp, C3 xuyên 6 | MUST |
| `tower_frost` | Tháp băng | 1×1 | 0/25/30 | 100 | Hào quang 3 ô: làm chậm 40%, 2 `frost`/s. | C2 chậm 50%, C3 tầm 4 (sát thương không tăng theo cấp) | MUST |
| `tower_mortar` | Cối | 2×2 | 0/50/40 | 180 | Tầm 4–9 (có tầm tối thiểu), 24 `impact` nổ bán kính 1.5, 0.33 phát/s. Không bắn quái bay. | +40%/cấp, C3 nổ 2.0 | MUST |
| `trap_spikes` | Chông | 1×1 | 8/4/0 | — | 10 sát thương mỗi quái bước lên, 6 lần rồi cụp; nạp lại lúc DAWN. | C2: 18 sát thương, 9 lần | MUST |
| `trap_tar` | Hắc ín | 1×1 | 6/0/0 | — | Làm chậm 50%. Dính lửa → cháy 4 s, 6 `fire`/s cho quái đứng trên; cháy xong mất. | — | MUST |
| `lumber_camp` | Trại gỗ | 2×2 | 25/0/10 | 150 | Cần ≥ 3 cây trong 4 ô. Sản lượng theo dân làng (§11.3). | Chỗ làm 2/3/4 | MUST |
| `quarry` | Mỏ đá | 2×2 | 30/0/15 | 150 | Cần ≥ 2 đá hoặc quặng trong 4 ô. Sản lượng theo dân làng (§11.3). | Chỗ làm 2/3/4 | MUST |
| `tower_spark` | Tháp sét | 1×1 | 0/30/60 | 100 | Tầm 4.5, 10 `spark`, nảy 3 mục tiêu, 0.7 phát/s, bắn được quái bay. | +40%/cấp, C3 nảy 5 | MUST |
| `barracks` | Trại lính | 2×2 | 40/20/40 | 220 | Mỗi đêm sinh 2 dân binh (HP 50, 6 sát thương) canh trong 5 ô. | +1 lính/cấp | MUST |
| `workshop` | Xưởng | 2×2 | 40/40/30 | 180 | Ban đêm tự sửa công trình trong 5 ô, 4 HP/s (không tốn tài nguyên). | 6 / 9 HP/s | MUST |
| `tavern` | Quán trọ | 2×2 | 30/20/60 | 180 | Mỗi DAWN có một lữ khách hero ghé qua, xem §6.5. | — | MUST |

### 6.4 Synergy kề nhau (chiều sâu của P1)

| Điều kiện | Hiệu ứng | Hiển thị |
|---|---|---|
| `tower_arrow`/`tower_ballista` trong 2 ô quanh brazier đang cháy | **Tên lửa:** đòn gây thêm cháy 3 `fire`/s trong 3 s, châm được hắc ín | Đầu tháp có đốm lửa; đường nối cam khi đặt |
| Quái đang bị làm chậm bởi băng nhận đòn `impact` | **Vỡ băng:** +50% sát thương | Số sát thương màu xanh băng, to hơn |
| Tháp có ≥ 2 cạnh kề tường/cổng ("âm tường") | +1 tầm | Viền đá dưới chân tháp |
| Tháp trong 3 ô quanh trưởng nhóm | **Hiệu triệu:** +25% tốc bắn | Cờ nhỏ phất trên tháp |
| Hắc ín kề chông | Quái bị chậm chịu chông ×2 | Icon liên kết khi đặt |

Mỗi synergy phải có unit test và phải nhìn thấy được trên màn hình.

### 6.5 Công trình của Hold bền vững (bổ sung cho §6.3)

Giá viết `gỗ/đá/vàng`, thêm `+N sắt` khi cần. Mở theo bậc Hearth (§11.1). Cấp 2 và 3 theo cùng hệ số ×1.6 và ×2.5.

| id | Tên | Ô | Giá | HP | Chức năng | Nhãn |
|---|---|---|---|---|---|---|
| `house` | Nhà | 2×2 | 20/0/0 | 120 | Chứa 2/3/4 dân làng (§11.3). | MUST |
| `storehouse` | Kho | 2×2 | 30/10/0 | 160 | +400 sức chứa mỗi cấp. | MUST |
| `farm` | Ruộng | 2×2 | 15/0/0 | 60 | 2/3/4 chỗ làm, ra lương thực. Không chặn hero, chặn quái như bẫy (đi qua được). | MUST |
| `dock` | Bến tàu | 2×2 | 40/10/0 | 200 | Đặt trên ô `shore` trong vùng sáng tĩnh. Cửa đi Viễn chinh. Chỉ xây 1. | MUST |
| `scout_lodge` | Trạm Thám báo | 2×2 | 50/30/20 | 180 | 1/2/3 chuyến Thám báo cùng lúc. Chỉ xây 1. | MUST |
| `forge` | Lò rèn | 2×2 | 40/60/30 | 220 | Rèn trang bị (§11.9). Chỉ xây 1. | MUST |
| `study` | Thư viện | 2×2 | 60/80/50 +20 sắt | 200 | Nghiên cứu (§11.8). Chỉ xây 1. | MUST |
| `market` | Chợ | 2×2 | 60/40/40 | 180 | Lữ khách ghé; +5% vàng đêm mỗi dân làm việc. Chỉ xây 1. | MUST |
| `vault` | Hầm | 2×2 | 0/120/60 +30 sắt | 400 | Bảo vệ 150 × cấp mỗi loại tài nguyên khi thua. Chỉ xây 1. | MUST |
| `wall_ember` | Tường lõi than | 1×1 | 0/10/0 +2 sắt | 420 | Vật cản. Sơn được. Quái chạm vào chịu 2 `fire`/s. | SHOULD |
| `watchtower` | Tháp canh | 1×1 | 30/40/0 +10 sắt | 150 | Không bắn. Soi sáng mức `dim` trong 7 ô (tháp khác nhắm được quái ở đó, nhưng không xây được ở đó). | SHOULD |
| `dawn_shrine` | Đền Bình Minh | 2×2 | 0/200/150 +60 sắt | 300 | Mỗi DAWN được đổi lại 1 lần cả ba lựa chọn quà. Chỉ xây 1. | SHOULD |
| `decor_*` | Vật trang trí (6 loại) | 1×1 hoặc 2×2 | theo §11.11 | 40 | Không chức năng. Dân làng thỉnh thoảng dừng lại cạnh. | SHOULD |

Thay đổi so với §6.3 trong Hold bền vững:
- `hearth`: 10 bậc theo §11.1 (thay cho 3 cấp). Không sửa, không bán.
- `lumber_camp`, `quarry`: sản lượng theo dân làng được gán (§11.3), không còn tự chạy.
- `tavern` (Quán trọ): mỗi DAWN có **một** hero ngẫu nhiên chưa sở hữu ghé qua (hoặc gói 8 mảnh của hero đang có nếu đã đủ bộ); chiêu mộ/mua bằng vàng. Người chơi không chọn giữa hai hero.
- `barracks`, `workshop`, `tower_spark`: mở theo bậc Hearth, không còn mua bản vẽ bằng Ember.

### 6.6 Đổ nát, di dời, quản lý pháo đài lớn
- **Đổ nát:** công trình vỡ để lại ô đổ nát (sprite gạch vụn theo kích thước, không chặn đường, chặn xây thứ khác). Chạm → "Dựng lại" (50% giá của cấp hiện tại, giữ nguyên cấp, module và hero đồn trú) hoặc "Dọn" (miễn phí, mất hẳn). Nút **Dựng lại tất cả** trong Build mode hiện tổng giá.
- **Di dời:** trong PEACE và DUSK, giữ 0.4 s lên một công trình rồi kéo để dời sang ô hợp lệ khác, miễn phí. Hearth không dời được. Đây là ngoại lệ duy nhất của quy tắc "không có thao tác giữ lâu bắt buộc" vì luôn có lối khác: bán 100% trong DUSK rồi xây lại.
- **Sơn hàng loạt:** kéo công cụ **Nâng cấp** hoặc **Sửa** qua nhiều công trình để áp dụng cho tất cả, hiện tổng giá trước khi thả tay.
- **Bản thiết kế bố cục** (SHOULD): lưu 3 bố cục pháo đài (vị trí và loại công trình). Áp dụng một bố cục trong DUSK: game tự di dời những gì đã có và liệt kê phần còn thiếu.
- Giới hạn công trình: 150 → **400** (tường tính 1/4). Lõi vẫn phải giữ ngân sách hiệu năng ở §13.3.

---

## 7. Chiến đấu

### 7.1 Hero (6 nhân vật đầu; thêm 4 ở §7.6)

Mọi hero: tự đánh, 1 skill tự kích hoạt theo hồi chiêu. Chỉ số trong bảng là ở cấp 1, 1★; cấp, sao, lựa chọn kỹ năng và trang bị theo §11.4. Đội tối đa 4 (1 trưởng nhóm + 3 theo sau theo đội hình chữ V, dùng steering bám slot, không đi xuyên vật cản).

| id | Tên, vai trò | HP | Đòn thường | Skill (hồi chiêu) | Nội tại | Có từ |
|---|---|---|---|---|---|---|
| `knight` | **Brann**, đỡ đòn | 120 | Cận chiến, 10 `impact`, 1.2/s | *Khiên Đập* (8 s): choáng 1 s hình nón 2 ô | Quái trong 2 ô ưu tiên đánh Brann | Đầu game |
| `ranger` | **Wren**, bắn xa | 70 | Tầm 5, 7 `pierce`, 1.5/s, bắn được quái bay | *Mưa Tên* (10 s): 5 mũi tên hình quạt | +25% sát thương lên quái ở ô `dark` | Lồng ở phiên 1 |
| `pyro` | **Ilka**, diện rộng | 60 | Tầm 4, cầu lửa nổ 1.2 ô, 14 `fire`, 0.6/s | *Tường Lửa* (14 s): vệt lửa 4 ô, 8 `fire`/s trong 4 s | Thắp lại brazier tức thì trong 3 ô; đòn châm hắc ín | 30 mảnh |
| `tinker` | **Tobi**, thợ | 80 | Cận chiến, 6 `impact`, 1.0/s | *Tháp Mini* (16 s): đặt ụ súng 8 s (5 `pierce`, 2/s) | Sửa công trình trong 3 ô 8 HP/s; giá xây −10% | 30 mảnh |
| `cleric` | **Mira**, hồi máu | 75 | Tầm 3, 4 `spark`, 1.0/s | *Thánh Địa* (18 s): vùng 2.5 ô trong 5 s, hồi 10 HP/s, quái bên trong −20% sát thương | Hồi 6 HP/s cho đồng đội thấp máu nhất trong 4 ô | 30 mảnh |
| `rogue` | **Vex**, sát thủ | 65 | Cận chiến, 6 `pierce`, 2.5/s, chí mạng 25% ×2.5 | *Bước Bóng* (9 s): dịch chuyển tới quái nhiều máu nhất trong 6 ô, đòn kế ×3 | +30% tốc chạy cho cả đội khi không giao tranh | 30 mảnh |

### 7.2 Loại sát thương và nhãn quái

| Loại | `armored` | `swarm` | `flying` | Ghi chú |
|---|---|---|---|---|
| `pierce` | ×0.5 | ×1 | ×1 | Cung, Wren, Vex |
| `impact` | ×1.25 | ×1 | cận chiến và cối/nỏ **không trúng** quái bay | Brann, nỏ, cối |
| `fire` | ×1 | ×1.5 | ×1 | Cháy cộng dồn thời gian tới trần 12 s, không cộng dồn DPS |
| `frost` | ×1 | ×1 | ×1 | Kèm làm chậm |
| `spark` | ×1 | ×1 | ×1.5 | Tháp sét, Mira |

`sát thương cuối = max(1, round(gốc × (1 + Σbonus) × hệ số loại × hệ số synergy))`.

### 7.3 Quái (the Gloom)

Tông tím–chàm, mắt vàng phát sáng. Tốc độ tính bằng ô/s. "Giá" là chi phí trong ngân sách đêm (§8.2). HP và sát thương trong bảng là giá trị gốc, nhân với `M(TR)`.

| id | Tên | HP | Tốc | Sát thương | Nhãn | Hành vi | Giá | Từ TR |
|---|---|---|---|---|---|---|---|---|
| `gloomling` | Gloomling | 20 | 1.6 | 4 cận chiến, 1/s | — | Đi theo flow field tới Hearth | 4 | 1 |
| `skitter` | Skitter | 12 | 2.8 | 3, 1.5/s | swarm | Đi bầy 5 con, len qua khe | 3 | 2 |
| `spitter` | Spitter | 30 | 1.3 | 6 tầm 4, 0.8/s | — | Dừng ở tầm bắn, ưu tiên tháp rồi hero | 9 | 3 |
| `brute` | Brute | 120 | 0.9 | 18, 0.7/s; ×2 lên công trình | armored | Dùng flow field "kẻ phá tường" (§7.4) | 22 | 4 |
| `wisp` | Wisp | 18 | 1.8 | 5, 1/s | flying | Bay thẳng tới Hearth, bỏ qua tường và bẫy | 7 | 6 |
| `bomber` | Bomber | 25 | 2.0 | Nổ 1.5 ô: 60 lên công trình, 15 lên hero | — | Lao vào công trình gần nhất trên đường rồi nổ. Bị hạ trước khi tới: chỉ nổ hình ảnh | 10 | 7 |
| `snuffer` | Snuffer | 60 | 1.2 | 8, 1/s | — | Flow field tới brazier đang cháy gần nhất, chạm 1.5 s → dập. Hết brazier → Hearth | 16 | 8 |

**Biến thể tinh nhuệ** (từ TR 9, tối đa 15% ngân sách ở đêm thường): ×2.5 HP, ×1.3 sát thương, to 125%, viền sáng; giá ×2.5.

**Boss:**

| Boss | Vây hãm | HP | Hành vi |
|---|---|---|---|
| **Mossback** — rùa đá khổng lồ cõng phế tích | Vùng 1 | 1500 | Tốc 0.5, `armored`. Đi **đường thẳng** tới Hearth, nghiền công trình trên đường (40 sát thương/s). Mỗi 8 s rụt vào mai 3 s: nhả 6 gloomling, trong lúc đó miễn sát thương từ tháp nhưng nhận ×2 từ hero. Dưới 30% HP: tốc 0.8. |
| **The Unlit** — vị vua không đèn | Vùng 5 | 12000 | Tốc 0.7, lơ lửng (đi theo flow field, không tính là `flying`). Mỗi 12 s phát xung: dập mọi brazier trong 8 ô trong 6 s và thu bán kính sáng Hearth còn 60% trong 6 s. Mỗi 10 s gọi 4 wisp. Ở 66% và 33% HP: dịch chuyển sang khe nứt khác, hồi 5% HP, gọi 1 brute tinh nhuệ. |

Boss có thanh máu lớn trên đỉnh màn hình, màn giới thiệu 1.5 s (tên + rung màn hình), nhạc riêng.

### 7.4 Tìm đường (phục vụ P1)

Flow field Dijkstra trên lưới 56×56, 8 hướng, không cắt góc qua vật cản. Nguồn = các ô kề Hearth.

- Chi phí bước: ô trống 1 (chéo 1.414); hắc ín +1.5; chông +0.5; cây/đá lớn/nước: không qua.
- **Công trình cản đường là ô đi qua được với chi phí cao:** `1 + HP_hiện_tại / BREACH_DIV`. Quái đi theo gradient; nếu ô kế tiếp có công trình thì đứng lại đánh công trình đó tới khi vỡ. Nhờ vậy bịt kín vẫn hợp lệ, quái tự chọn giữa đi vòng và phá chỗ tường yếu nhất, và sửa/nâng cấp tường thay đổi đường đi của quái.
- Ba field, tính lại khi công trình thay đổi hoặc HP công trình đổi ≥ 20% (gộp, tối đa 5 lần/s):
  - `default`: `BREACH_DIV = 8` (gloomling, skitter, spitter, bomber, The Unlit).
  - `breacher`: `BREACH_DIV = 20` (brute — thích phá hơn đi vòng).
  - `snuff`: nguồn = mọi brazier đang cháy; nếu không còn thì dùng `default`.
- Quái bay và Mossback không dùng field (đi thẳng).
- Tách đàn: lực đẩy giữa các quái qua spatial hash (ô 1×1), để quái không chồng lên nhau và dồn ứ tự nhiên ở nút cổ chai.
- Quái nhắm hero khi hero trong 2.5 ô và có đường nhìn; bỏ đuổi khi xa quá 4 ô, quay lại field.
- Tháp chọn mục tiêu: quái có "quãng đường còn lại tới Hearth" nhỏ nhất trong tầm và trong vùng sáng. Đạn có thời gian bay; đạn cung bám mục tiêu, nỏ bắn thẳng, cối rơi tại điểm dự đoán.

### 7.5 Trạng thái
`burn` (DPS theo nguồn mạnh nhất, thời lượng cộng dồn tới trần 12 s), `slow` (lấy mức mạnh nhất), `stun`, `veiled` (ở ô tối). Mỗi trạng thái có icon/hiệu ứng trên đầu quái.

### 7.6 Bốn hero mới (cùng định dạng §7.1; mở bằng 30 mảnh, §11.4)

| id | Tên, vai trò | HP | Đòn thường | Skill (hồi chiêu) | Nội tại |
|---|---|---|---|---|---|
| `beast` | **Fenn**, người nuôi sói | 85 | Tầm 3, phóng lao 8 `pierce`, 1.0/s | *Gọi Bầy* (15 s): thêm 2 sói trong 8 s | Luôn có 1 sói đi cùng (HP 60, 7 `impact`, 1.4/s), sói chết thì hồi sau 12 s |
| `warden` | **Orla**, hộ vệ tháp | 110 | Cận chiến, búa 12 `impact`, 0.8/s, đẩy lùi 0.5 ô | *Lệnh Giữ Thành* (16 s): công trình trong 4 ô nhận −50% sát thương trong 5 s | Tháp trong 3 ô +15% tốc bắn (cộng với Hiệu triệu) |
| `shade` | **Sable**, thợ săn bóng tối | 70 | Tầm 4.5, nỏ tay 9 `pierce`, 1.1/s | *Pháo Sáng* (12 s): thắp sáng mức `lit` vùng 3 ô trong 6 s tại quái xa nhất trong tầm | Thấy quái `veiled` trong 6 ô; +30% sát thương lên quái vừa bị lộ diện |
| `bomb` | **Garrick**, pháo thủ | 80 | Tầm 3.5, ném bom 16 `impact` nổ 1 ô, 0.5/s | *Thùng Thuốc* (14 s): đặt thùng nổ sau 1.5 s, 40 `impact` nổ 2 ô, không hại công trình | Đòn thường gây ×2 lên quái `armored` |

Ghi chú cho §7.1 trong Hold bền vững: cột "Mở khóa" của v1 (giá Ember) không còn dùng; XP và cấp không còn đặt lại. Cháy (`burn`): thời lượng **cộng dồn tới trần 12 s**, DPS lấy theo nguồn mạnh nhất, tính mỗi 0.5 s không làm tròn lên. Boss chịu 30% thời lượng choáng và làm chậm.

### 7.7 Quái và boss theo Vùng

Cột "Từ TR" ở §7.3 là chỉ số Hiểm họa tối thiểu để loại đó xuất hiện. Thêm 5 loại quái mở theo Vùng:

| id | Tên | Vùng | HP | Tốc | Sát thương | Nhãn | Hành vi và cách khắc chế | Giá | Từ TR | Nhãn SPEC |
|---|---|---|---|---|---|---|---|---|---|---|
| `burrower` | Kẻ Đào | 2 | 45 | 1.4 | 7, 1/s | — | Khi gặp công trình cản đường lần đầu: chui xuống đất 2 s, trồi lên bên kia **một** lớp tường. Khắc chế: tường hai lớp cách nhau, bẫy ở lớp trong. | 12 | 10 | MUST |
| `shrieker` | Kẻ Rít | 2 | 40 | 1.5 | không đánh | — | Đứng sau đàn, quái trong 3 ô +30% tốc. Bị hạ → đàn trong 3 ô choáng 1 s. Khắc chế: hero đánh xa, cối. | 14 | 13 | MUST |
| `hurler` | Kẻ Ném Đá | 3 | 90 | 0.8 | 22 lên công trình, tầm 7, 0.4/s | armored | Dừng ngoài tầm tháp cung và bắn phá tường/tháp. Khắc chế: nỏ lớn, cối, hoặc đem đội ra đánh. | 26 | 18 | SHOULD |
| `frostwraith` | Hồn Băng | 4 | 55 | 1.6 | 6, 1/s | flying | Chạm tháp → tháp đóng băng (ngừng bắn) 3 s, mỗi tháp tối đa 1 lần/6 s. Khắc chế: tháp sét, Mira đồn trú, brazier kề tháp rã băng nhanh gấp đôi. | 18 | 28 | SHOULD |
| `cinderling` | Tàn Lửa | 5 | 35 | 2.2 | 5, 1/s | swarm | Chết hoặc chạm công trình **gỗ** → châm lửa: 5 sát thương/s trong 6 s, lan sang công trình gỗ kề bên. Miễn `fire`. Khắc chế: tường đá, chừa khoảng trống giữa các cụm gỗ, tháp băng dập lửa trong hào quang. | 9 | 38 | SHOULD |

Boss vây hãm Tim Khe Nứt (thanh máu lớn, màn giới thiệu 1.5 s, nhạc riêng):

| Boss | Vùng | HP | Hành vi |
|---|---|---|---|
| **Mossback** — rùa đá cõng phế tích | 1 | 1500 | Như §7.3. |
| **Briarqueen** — nữ hoàng gai | 2 | 3200 | Tốc 0.6. Mỗi 10 s mọc **tường gai** 5 ô chắn đường hero (HP 80 mỗi ô, tan sau 8 s). Mỗi 14 s gọi 3 Kẻ Đào. Dưới 40% HP: rễ trồi dưới 2 tháp ngẫu nhiên, vô hiệu 4 s. Yếu `fire` ×1.5. |
| **Cairn Colossus** — người đá khổng lồ | 3 | 6000 | Tốc 0.45, `armored`. Ném tảng đá tầm 9 vào tháp gây sát thương cao nhất (60 sát thương, nổ 1.5 ô, báo trước 1.2 s bằng vòng đỏ). Mất 1/3 máu thì rơi một cánh tay thành 2 Brute tinh nhuệ. |
| **Rimefather** — cha băng giá | 4 | 9000 | Tốc 0.6. Hào quang 5 ô đóng băng mọi tháp bên trong (trừ tháp kề brazier đang cháy). Mỗi 12 s thổi bão tuyết 4 s: bán kính mọi brazier −50%. Gọi Hồn Băng. |
| **The Unlit** — vị vua không đèn | 5 | 12000 | Như §7.3 với HP mới. Thêm pha cuối dưới 25%: tắt hẳn mọi brazier, chỉ còn Hearth và đèn hero; hero trong vùng tối chịu 3 sát thương/s. |

Vùng 1–2 (Mossback, Briarqueen, Kẻ Đào, Kẻ Rít) là MUST. Vùng 3–5 là SHOULD.
**Nhà Vô Địch Gloom** của đêm Trăng Máu: xem §8.4.

---

## 8. Đêm: Hiểm họa, Hải đăng, Tuần trăng

### 8.1 Nguyên tắc
Độ khó không tăng theo số đêm đã chơi mà theo **chỉ số Hiểm họa (TR)** do người chơi tự đẩy lên, có trần theo Vùng. Nhờ vậy người chơi có thể dừng ở một mức ổn định để xây dựng thong thả, rồi chủ động bước tiếp khi sẵn sàng.

### 8.2 Chỉ số Hiểm họa (TR)
- TR là số nguyên ≥ 1, lưu theo Hold. Bắt đầu ở 1.
- Thắng một đêm ở Hải đăng mức Vững trở lên: TR +1. Thắng ở mức Lặng: TR giữ nguyên. Thua: TR −2 (không thấp hơn sàn của Vùng).
- **Trần và sàn theo Vùng đã mở xa nhất:** Vùng 1: 1–10 · Vùng 2: 8–20 · Vùng 3: 16–30 · Vùng 4: 26–40 · Vùng 5: 36–50 · sau khi phong ấn Vùng 5 ("Gloom Sâu"): sàn 46, không trần.
- Khi TR chạm trần, đêm vẫn diễn ra ở mức trần với phần thưởng đầy đủ: đây là trạng thái "ổn định" để tích lũy. HUD hiện rõ "Hiểm họa 10/10 — phong ấn Tim Khe Nứt để đi tiếp".
- Ngân sách đêm: `B(TR) = 50 + 30·TR + 1.2·TR²`. Hệ số chỉ số quái (HP và sát thương): `M(TR) = 1.06^(TR−1)`. Nếu ngân sách vượt giới hạn 250 quái sống cùng lúc, phần dư chuyển thành quái tinh nhuệ.
- Số khe hoạt động: `min(số khe đã mở, 1 + floor(TR / 6))`. Khe được chọn tất định từ `seed + đêm`, ưu tiên khe khác đêm trước.
- Loại quái xuất hiện theo cột "Từ TR" ở §7.3 và §7.7. Loại vừa ra mắt chiếm ≥ 25% ngân sách trong đêm đầu của nó.
- Chia ngân sách cho các khe theo tỉ lệ ngẫu nhiên trong [0.6, 1.4] rồi chuẩn hóa; khe bị nhổ rễ −30%.
- Mỗi khe nhả quái theo **nhịp**: mỗi 6–8 s một nhóm, tổng thời gian sinh `min(70, 35 + 2·TR)` giây. Nhịp cuối luôn có đơn vị đắt nhất.
- Quá 120 s, quái còn sống +50% tốc độ (chỉ tốc độ; không cộng sát thương).

### 8.3 Hải đăng: tự đặt cược mỗi đêm
Chọn ở DUSK. Mức cao hơn thu hút nhiều quái hơn và trả thưởng nhiều hơn.

| Mức | Ngân sách | Chiến lợi phẩm đêm | TR khi thắng | Mở từ |
|---|---|---|---|---|
| **Lặng** | ×0.7 | ×0.6, không rơi mảnh hero | +0 | đầu game |
| **Vững** | ×1.0 | ×1.0 | +1 | đầu game |
| **Dữ** | ×1.35 | ×1.6, +1 lựa chọn quà bình minh (chọn 1 trong 4) | +1 | Hearth bậc 2 |
| **Ác mộng** | ×1.8, tối thiểu 20% ngân sách là tinh nhuệ | ×2.5, chắc chắn 1 quà hiếm trở lên | +2 | Hearth bậc 4 |

Chiến lợi phẩm đêm gồm: vàng và tinh chất từ quái, cộng **rương bình minh** (vàng + tinh chất + cơ hội mảnh hero/trang Tri thức theo §17). Mức đã chọn hiện bằng màu ngọn lửa trên đỉnh Hearth suốt đêm.

### 8.4 Tuần trăng (chu kỳ 7 đêm, tính theo số đêm của Hold)

| Đêm trong chu kỳ | Pha | Luật đêm đó |
|---|---|---|
| 1 | Trăng non | Tối hơn: mọi bán kính sáng −1. Quái `veiled` +10% sát thương. Tinh chất rơi ×1.5. |
| 2 | Lưỡi liềm | Không đổi luật. |
| 3 | Bán nguyệt | Gió: tầm tháp bắn xa (cung, nỏ) −1; bẫy gây +50% sát thương. |
| 4 | Trăng khuyết | Sương: sinh thêm 1 nhịp quái bay nếu đã mở khóa; nếu chưa thì Skitter. |
| 5 | Trăng tròn | Sáng: mọi bán kính sáng +1; hero +15% sát thương. Vàng rơi ×1.5. |
| 6 | Trăng tàn | Lặng gió: không đổi luật; brazier không tốn nhiên liệu. |
| 7 | **Trăng Máu** | Vây hãm: ngân sách ×1.5, có 1 **Nhà Vô Địch Gloom** (quái tinh nhuệ cỡ lớn ×6 HP, kèm 1 kỹ năng ngẫu nhiên trong: gọi viện binh / hào quang tăng tốc / khiên chặn đạn phía trước). Thắng: rương Trăng Máu (10 mảnh hero tự chọn + 1 trang bị hiếm + vật liệu Vùng). Thua: áp dụng §2.4 nhưng TR không giảm. |

Pha trăng hiện trên HUD và trong Điềm báo từ đầu PEACE để người chơi lên kế hoạch cả ngày.

### 8.5 Vây hãm Tim Khe Nứt
Đêm boss do người chơi tự kích hoạt (chạm Tim Khe Nứt trong PEACE khi TR đang ở trần của Vùng). Luật ở §11.2. Không thay thế đêm thường và không tính vào tuần trăng.

### 8.6 Biến cố đêm (từ TR 6, 20% mỗi đêm thường, báo trước trong Điềm báo)
Một trong: **Bầy đàn** (chỉ một loại quái, số lượng ×1.5) · **Đột kích hai hướng** (hai khe đối diện nhả cùng lúc) · **Kẻ săn lửa** (thêm 3 Snuffer nếu đã mở khóa) · **Đêm ngắn** (thời gian sinh giảm một nửa, quái dồn dập) · **Mưa** (brazier bán kính −1, hắc ín không cháy, quái `fire` yếu đi 25%).

### 8.7 Điềm báo
Hiện ở DUSK và mở lại được: icon loại quái × số lượng theo từng khe, mũi tên chỉ hướng khe, pha trăng, biến cố, mức Hải đăng đang chọn và phần thưởng tương ứng. Sinh tất định từ `seed + đêm` ngay khi PEACE bắt đầu; hero đi Thám báo loại "Do thám" cho xem trước Điềm báo của 3 đêm tới.
Mở đầu đêm: tiếng tù và, băng rôn "ĐÊM n · pha trăng", mép màn hình phía có khe nháy tím.

---

## 9. Art bible và pipeline

> Tham chiếu bắt buộc: `docs/art/style-anchor.png` (sinh bởi `node tools/art/anchors.mjs`). **Đó là mức chất lượng tối thiểu.** Mọi sprite mới phải trông cùng một bộ với các anchor. Mở ảnh đó ra xem trước khi vẽ bất cứ thứ gì.

### 9.1 Phong cách
- Pixel-art top-down ¾: mặt đất nhìn từ trên xuống, nhân vật và công trình thấy mặt trước + mặt trên (xem `bld_wall`: mặt trên sáng, mặt trước tối hơn có hàng gạch).
- Nhân vật chibi: đầu chiếm ~60% chiều cao, mắt 1×2 px đậm, tay chân tối giản. Nhìn nghiêng ¾, quay trái/phải bằng lật ngang.
- **Outline 1 px** màu `k` (#1b1b2f, không dùng đen tuyền) quanh mọi nhân vật, công trình, prop, icon. Tile nền **không** outline.
- **Nguồn sáng trên-trái:** mép trên/trái sáng hơn một bậc, mép dưới/phải tối hơn một bậc trong ramp. Không gradient mượt, không anti-alias, không bán trong suốt (trừ bóng đổ và FX).
- Mỗi vật thể dùng 1–2 ramp chính + 1 màu nhấn. Ô nền tương phản thấp để nhân vật nổi lên.
- Bóng đổ: elip `n` alpha 0.35 dưới chân mọi unit và prop cao.
- Cấm: hình vuông/tròn đơn sắc, màu ngoài palette, sprite bị nội suy mờ, hai sprite khác kích thước pixel đặt cạnh nhau (mixels).

### 9.2 Palette và ramp
Dùng đúng `PALETTE` và `RAMPS` trong `tools/art/pixel.mjs` (32 màu). Thêm màu chỉ khi thật cần, tối đa 40 màu, ghi lý do vào `docs/DECISIONS.md`. Phe người chơi: thép, đỏ, xanh dương, gỗ ấm. Gloom: tím `m M L`, mắt `z`. Lửa: `x y z`. Băng: `C D E`.

### 9.3 Kích thước chuẩn (art px, canvas luôn chừa 1 px lề cho outline)

| Loại | Canvas | Ghi chú |
|---|---|---|
| Tile nền | 16×16 | Lát kín, mỗi loại ≥ 3 biến thể chọn theo hash tọa độ |
| Hero, quái thường | 16×16 → 18×18 | Brute 22×22 |
| Boss | Mossback 48×40, The Unlit 40×48 | |
| Công trình 1×1 | 16 rộng × 18–30 cao | Chân sprite neo ở đáy ô |
| Công trình 2×2 | 32 rộng × 36–44 cao | |
| Prop | cây 18×26, đá 12–24, rương 16×14 | |
| Icon UI | 16×16; chân dung hero 24×24 | |
| Đạn/FX | 8×8 → 32×32 | |

### 9.4 Danh mục asset (MUST trừ khi ghi khác)

- **Tile:** cỏ ×4, cỏ hoa ×2, cỏ đậm (rừng) ×3, đất ×3, cát ×3, nền đá phế tích ×3, nước 2 khung. Viền phủ chuyển tiếp cho 3 cặp (cỏ/đất, cỏ/cát, cát/nước): 4 cạnh + 4 góc lồi + 4 góc lõm mỗi cặp.
- **Prop:** pine ×2, oak ×2, gốc cây, bụi ×2, đá nhỏ/vừa/lớn, mạch quặng ×2, cột phế tích ×2, tường vỡ, thùng, hòm; lồng hero; điện thờ; rương đóng/mở; khe nứt 32×32 (4 khung xoáy); rễ khe nứt; ổ Gloom.
- **Công trình:** mọi dòng trong §6.3, đủ cấp 1–3 (cấp cao thêm chi tiết: viền kim loại, cờ, mái — không chỉ đổi màu). Tường gỗ và tường đá: 16 biến thể auto-tile ghép từ cột giữa + 4 đoạn nối (sinh thủ tục). Cổng ngang/dọc, đóng/mở. Brazier cháy 4 khung + tắt. Hearth lửa 4 khung, 3 cấp. Nỏ: đầu xoay 8 hướng. Tháp băng, tháp sét: 4 khung. Chông lên/xuống. Lớp phủ nứt ×2 mức (HP < 66%, < 33%).
- **Hero ×6:** idle 2 khung, walk 4, attack 2–3, gục 1. Chân dung 24×24. Mỗi hero có silhouette khác nhau rõ ràng (mũ/tóc/vũ khí), nhận ra được khi thu nhỏ.
- **Quái ×7 + tinh nhuệ:** move 2–4 khung, attack 2. Phiên bản "ẩn" (chỉ đôi mắt). Dân binh 1 loại.
- **Boss ×2:** Mossback walk 4 + rụt mai 2; The Unlit lơ lửng 4 + niệm phép 2.
- **Đạn:** tên, bu-lông nỏ, cầu lửa 2 khung, mảnh băng, đạn cối, tia sét (đoạn ghép), cầu nhổ.
- **FX:** tia trúng đòn 3 khung, vệt chém 3, nổ 5, bụi 3, dấu cộng hồi máu, vòng lên cấp, lửa cháy 3, bông tuyết, mảnh gỗ, mảnh đá, đồng xu, khói.
- **UI:** panel 9-slice ×2 (giấy da, đá tối), nút 3 trạng thái, tab, khung thẻ ×3 độ hiếm, khung + ruột thanh máu, joystick đế/núm, icon: gỗ, đá, vàng, ember, tim, búa, kiếm, trăng, mặt trời, tạm dừng, tiếp tục, đóng, tick, khóa, mũi tên nâng cấp, cờ lê, bán, tù và, ghim minimap; 24 icon boon; logo tiêu đề ≥ 160×64 vẽ pixel.
- **Font bitmap:** tự vẽ trong pipeline, 5×7 px (cao dòng 9), đủ ASCII in được (32–126); thêm bản số to 7×9 cho số sát thương. Mọi chữ trong game dùng font này qua component `BitmapText` (không dùng font hệ thống).

### 9.5 Pipeline (mọi asset sinh bằng code, tái tạo được)

```
tools/art/pixel.mjs          # có sẵn: Px canvas, PALETTE, RAMPS, shade(), outline(), speckle(), lint(), sheet(), writePNG()
tools/art/anchors.mjs        # có sẵn: 11 sprite mẫu, hai kỹ thuật vẽ
tools/art/sprites/*.mjs      # VIẾT MỚI: mỗi file một nhóm (tiles, props, buildings, heroes, enemies, bosses, fx, ui, font)
tools/art/build-atlas.mjs    # VIẾT MỚI: gom mọi sprite → assets/resources/art/atlas.png (≤ 2048², lề 1 px, tile extrude 1 px)
                             #           + atlas.json {name: {x,y,w,h,ax,ay}} + chạy lint + xuất contact sheet
```

Hai kỹ thuật được phép (xem anchors):
- **(A) Lưới ký tự gõ tay** cho nhân vật, mặt, icon: mỗi ký tự là một màu palette. Khung hoạt hình **dẫn xuất** từ khung gốc (`crop/shift/stamp`), không vẽ lại từ đầu.
- **(B) Hình thủ tục + `shade()` + `speckle()` + chi tiết đặt tay + `outline()`** cho công trình, prop, tile.

Quy trình bắt buộc cho **mỗi nhóm** sprite: vẽ → `node tools/art/build-atlas.mjs` → mở contact sheet `docs/art/contact-<nhóm>.png` (phóng 6–8×) **xem bằng mắt** → chấm theo §9.7 → sửa → lặp tới khi đạt. Tối thiểu 2 vòng xem-sửa cho hero, quái, boss, công trình.

### 9.6 Art lint (chạy trong `npm run verify`, fail thì build fail)
`lint()` trong `pixel.mjs` kiểm: số màu tối thiểu theo loại (unit/building ≥ 6, prop ≥ 5, icon ≥ 4, tile ≥ 3), silhouette không lấp > 90% bounding box (trừ tường auto-tile), outline tối phủ ≥ 85% mép. Bổ sung trong `build-atlas.mjs`: mọi màu thuộc palette; mọi tên trong `ASSET_MANIFEST` (danh sách §9.4 viết thành mảng) đều có sprite; không hai sprite trùng pixel hoàn toàn (trừ khi khai báo alias). Thêm một grep test: thư mục `assets/scripts/game` không dùng `Graphics` ngoài file debug.

### 9.7 Thang tự chấm (mỗi câu phải "có")
1. Thu về kích thước thật trên điện thoại, có nhận ra đây là gì trong 1 giây không?
2. Silhouette có khác biệt với các sprite cùng nhóm không?
3. Có đủ ba bậc sáng–trung–tối và outline liền mạch không?
4. Đặt cạnh các anchor có cùng một phong cách không?
5. Khung hoạt hình có chuyển động đọc được (nhún, vung, co giãn) không?

### 9.8 Juice (MUST)
Nháy trắng khi trúng đòn (80 ms), số sát thương nảy lên rồi mờ, rung màn hình nhẹ khi nổ/boss (≤ 4 art px), hit-stop 40 ms cho đòn chí mạng và nổ lớn, quái chết vỡ thành 4–6 mảnh màu của nó, xu và tài nguyên bay cong về HUD rồi HUD nảy, công trình đặt xuống nảy 1.2→1.0 kèm bụi, công trình vỡ rơi mảnh, lửa lập lòe, cây rung khi bị chặt, viền đỏ khi Hearth < 30%, rung máy (`navigator.vibrate`, có công tắc), chuyển cảnh mờ dần.

### 9.9 Asset bổ sung cho Hold bền vững
Cùng pipeline, cùng lint, cùng thang tự chấm. Thêm vào `tools/art/manifest.mjs` trước khi vẽ.
- **Tile và viền:** tuyết ×3, băng ×2, đất tro ×3, dung nham nguội ×2 (2 khung phát sáng); viền chuyển tiếp cho mọi cặp vùng đất mà bộ sinh bản đồ tạo ra. Bức Màn Gloom: sprite sương tím 16×24, 4 khung, lát được theo cạnh.
- **Prop:** thông phủ tuyết ×2, cây khô ×2, node nhựa thông, tinh thể băng, than lõi (mỗi loại 2 biến thể + trạng thái đã thu hoạch); phế tích cổ (đã lục / chưa lục); Tim Khe Nứt 48×48 (ngủ 2 khung, thức 4 khung, đã phong ấn 1); thuyền ở Bến tàu; hòm Viễn chinh; đống đổ nát 1×1 và 2×2 (gỗ, đá).
- **Công trình:** mọi dòng ở §6.5 đủ cấp; Hearth **10 bậc** (bậc 4–10 thêm tầng, cột, vòng lửa — mỗi bậc phải nhận ra được khi đứng cạnh bậc trước); 4 màu lửa Hải đăng trên đỉnh Hearth; 8 icon module gắn trên tháp; 6 vật trang trí; 3 bộ da tường; 8 cờ hiệu.
- **Dân làng:** 4 biến thể (2 nam, 2 nữ, khác màu áo và tóc), đi 4 khung, làm việc 2 khung cho mỗi nghề (đốn, đập, cuốc, rèn, đọc, bán), sợ hãi chạy 2 khung, đói 1 icon. Lữ khách + xe hàng.
- **Hero mới ×4** (Fenn, Orla, Sable, Garrick) đủ bộ như hero cũ; sói của Fenn (đi 4, cắn 2); thùng thuốc; pháo sáng. Mọi hero thêm sprite **đồn trú** (nửa thân trên, đặt trên đỉnh tháp, 2 khung).
- **Quái mới ×5** theo §7.7, mỗi loại có trạng thái đặc trưng (Kẻ Đào: ụ đất di chuyển 2 khung; Hồn Băng: tháp đóng băng dùng lớp phủ băng 2 mức; Tàn Lửa: lửa cháy trên công trình 3 khung). **Boss ×3 mới:** Briarqueen 44×48, Cairn Colossus 56×56, Rimefather 48×56; Nhà Vô Địch Gloom 28×28 với 3 lớp phủ kỹ năng.
- **UI:** icon cho sắt, lương thực, tinh chất, trang Tri thức, mảnh hero, 3 vật liệu Vùng, Hơi ấm (viên than), 4 mức Hải đăng, 7 pha trăng, Bounty, Biên niên, Đường Mới, đồn trú, Thám báo, rút lui; khung trang bị 3 độ hiếm; 12 icon Bùa, 8 icon module, 24 icon nút nghiên cứu, 30 huy hiệu thành tựu (có thể dùng chung 10 khung + biểu tượng); bảng "Trong lúc bạn đi vắng"; thanh Biên niên 7 mốc.
- **Ưu tiên:** phần MUST ở §11 vẽ trước; mọi thứ gắn với Vùng 3–5, module và trang trí là SHOULD.

---

## 10. UI/UX

### 10.1 Màn hình
Danh sách màn hình và luồng của Hold bền vững ở §10.5. Cài đặt: âm lượng nhạc/SFX, rung, chữ to, ngôn ngữ (en mặc định; vi là SHOULD), xuất/nhập bản lưu, xóa dữ liệu (hỏi lại 2 lần).

### 10.2 HUD trong trận (design 720×1280)
- **Trên-trái:** thanh máu Hearth (icon lửa, 7 viên than Hơi ấm, icon Phước lành), bên dưới là gỗ / đá / vàng / sắt (chạm để mở bảng Kho).
- **Trên-giữa:** đồng hồ pha (mặt trời/mặt trăng chạy trên cung tròn) + "ĐÊM n", icon pha trăng, "Hiểm họa x/trần". Ban đêm: số quái còn lại và màu Hải đăng.
- **Trên-phải:** Pause; minimap 112×112 (đảo, vùng sáng, công trình, khe nứt, hero, quái ban đêm), chạm để phóng to.
- **Trái-giữa:** chân dung 4 hero + thanh máu + vòng hồi chiêu.
- **Phải-dưới:** nút Búa, nút Tù và (vòng nạp). **Dưới (PEACE):** thanh đáy 5 nút (§10.5) và nút Chuông Hoàng Hôn.
- Mũi tên mép màn hình chỉ: Hearth khi ra khỏi tầm nhìn, khe nứt đang nhả quái, công trình đang bị đánh.

### 10.3 Hướng dẫn (phiên đầu tiên, bỏ qua được; phần tiếp theo ở §2.7)
5 bước theo ngữ cảnh, mỗi bước 1 câu + mũi tên, chỉ qua bước khi người chơi làm đúng: (1) kéo để đi → (2) đứng cạnh cây để chặt → (3) mở Búa, sơn 6 ô tường → (4) đặt 1 tháp cung cạnh brazier để thấy đường nối synergy → (5) đọc Điềm báo, bắt đầu đêm. Các cơ chế mới về sau (quái bay, dập lửa…) giới thiệu bằng thẻ 1 dòng ở DUSK của đêm đó.

### 10.4 Khả năng tiếp cận
Tốt/xấu luôn kèm hình dạng hoặc icon ngoài màu sắc (ô hợp lệ: dấu ✓ nhỏ; không hợp lệ: sọc chéo). Chế độ chữ to ×1.5. Không có thao tác bắt buộc giữ lâu hay chạm nhanh liên tục.

### 10.5 Màn hình và luồng của Hold bền vững
- **Title:** logo + một nút **Vào Hold** (hiện "Đêm N · Hiểm họa X · Hearth bậc Y") + Cài đặt. Không có "Chơi mới / Tiếp tục run". Lần đầu: vào thẳng hướng dẫn.
- **Bảng "Trong lúc bạn đi vắng":** hiện ngay sau Title nếu vắng ≥ 5 phút. Mỗi dòng một nguồn (dân làng, từng chuyến Thám báo, Bounty mới, Lữ khách, Hơi ấm thay đổi). Nút "Nhận tất cả" cho tài nguyên bay về HUD.
- **Thanh đáy ở PEACE** (5 nút, ẩn dần cho tới khi hệ thống được mở theo §2.7): **Xây** (Búa) · **Hero** (đội hình, cấp, trang bị, đồn trú, Thám báo) · **Làng** (dân, việc làm, Kho, Chợ, Lò rèn, Thư viện) · **Sổ** (Bounty, Biên niên, Sách Gloom, thành tựu) · **Bản đồ** (toàn đảo: Vùng, khe nứt, Tim Khe Nứt, Bến tàu). Ban đêm thanh đáy thu lại còn Búa và Tù và.
- **Dòng "Mục tiêu kế tiếp"** (§2.5) nằm ngay dưới cụm tài nguyên, chạm để mở rộng thành 3 dòng.
- **Bảng công trình** (chạm công trình ngoài Build mode): tên, cấp, HP, chức năng, hero đồn trú, module, dân đang làm, nút Nâng cấp/Sửa/Bán/Di dời.
- **DUSK:** bảng Điềm báo có thêm pha trăng, biến cố, và **4 nút Hải đăng** với phần thưởng ghi rõ từng mức; hàng ô đồn trú kéo-thả hero.
- **"Lửa lụi":** thay màn Defeat. Liệt kê thứ đã mất và thứ còn nguyên, nút "Dựng lại tất cả" (nếu đủ) và "Trở về làng". Giọng điệu động viên, không có chữ "Thua".
- **Bến tàu:** 3 thẻ đảo (biome, biến số, trọng tâm, bậc khó chọn được), số Đường Mới còn, nút Ra khơi. HUD Viễn chinh: đồng hồ lớn trên giữa, "đang mang" bên trái, mũi tên về thuyền; màn kết chuyến liệt kê đồ giữ được.
- **Hướng dẫn dài hạn:** mỗi hệ thống mới mở kèm đúng một thẻ giải thích 2 dòng + một nhiệm vụ dẫn dắt có thưởng (ví dụ mở Trạm Thám báo → "Gửi một hero đi Gom nhặt 15 phút").
- Mọi con số tiến trình dùng chữ rút gọn (1.2k, 34k). Mọi nút có điều kiện chưa đạt hiện rõ điều kiện, không chỉ mờ đi.

---

## 11. Tiến trình dài hạn

Tám đơn vị tiền/nguyên liệu. HUD chỉ hiện 4 thứ đầu; phần còn lại nằm trong bảng Kho.

| Thứ | Nguồn chính | Tiêu vào | Giới hạn |
|---|---|---|---|
| Gỗ, Đá | thu hoạch, dân làng | xây, nâng cấp, sửa | theo Kho |
| Vàng | quái, rương, chợ | hero, rèn, nghiên cứu, chợ | không |
| Sắt | quặng, dân làng (từ Hearth bậc 4), Viễn chinh | công trình bậc cao, trang bị, module | theo Kho |
| Lương thực | Ruộng | nuôi dân làng | theo Kho |
| Tinh chất Gloom | quái ban đêm, ổ Gloom | rèn, module, nâng sao | 200 + 100/cấp Kho |
| Trang Tri thức | phế tích, Viễn chinh, Biên niên | nghiên cứu | không |
| Ember | Bounty, Biên niên, Trăng Máu, phong ấn Vùng | nâng bậc Hearth, mở ô đồn trú | không |
| Mảnh hero (theo từng hero) | Viễn chinh, rương, Lữ khách, Thám báo | mở và nâng sao hero | không |
| Vật liệu Vùng (nhựa thông, tinh thể băng, than lõi) | node ở Vùng 2/4/5, Viễn chinh | trang bị và nghiên cứu bậc cao | theo Kho |

### 11.1 Bậc Hearth (cấp độ của Hold)
Nâng bậc là cột mốc lớn nhất của người chơi: sáng rộng hơn, mở công trình và hệ thống mới. Chỉ nâng được trong PEACE, có hoạt cảnh 2 s.

| Bậc | Sáng | HP | Chi phí (gỗ/đá/sắt/Ember) | Điều kiện | Mở ra |
|---|---|---|---|---|---|
| 1 | 7 | 500 | — | — | Tường gỗ, Cổng, Brazier, Tháp cung, Chông, Nhà, Trại gỗ, Kho |
| 2 | 8 | 700 | 80/40/0/0 | thắng 2 đêm | Mỏ đá, Ruộng, Hắc ín, **Bến tàu (Viễn chinh)**, Hải đăng mức Dữ, Bounty |
| 3 | 9 | 900 | 200/150/0/10 | 4 dân làng | Tường đá, Tháp băng, **Trạm Thám báo**, **Đồn trú ×2**, Lò rèn, Biên niên |
| 4 | 10 | 1150 | 400/350/40/25 | phong ấn Vùng 1 | Nỏ lớn, **Thư viện (nghiên cứu)**, Chợ, Hầm, Hải đăng mức Ác mộng, dân làng khai thác sắt |
| 5 | 11 | 1400 | 700/600/100/40 | TR ≥ 14 | Cối, Trại lính, Đồn trú ×4, ô Phước lành thứ 4 |
| 6 | 12 | 1700 | 1100/1000/200/60 | phong ấn Vùng 2 | Tháp sét, Xưởng, **Module tháp** |
| 7 | 13 | 2000 | 1600/1500/350/80 | TR ≥ 24 | Tường lõi than (HP 420), Tháp canh (soi sáng xa) |
| 8 | 14 | 2400 | 2300/2200/550/110 | phong ấn Vùng 3 | Đồn trú ×6, tiểu đội 5 hero |
| 9 | 15 | 2800 | 3200/3000/800/150 | TR ≥ 34 | Đền Bình Minh (đổi 1 quà bình minh mỗi đêm) |
| 10 | 16 | 3300 | 4500/4200/1200/200 | phong ấn Vùng 4 | Cho phép vây hãm Tim Khe Nứt Vùng 5 |

Bậc 1–6 là MUST; bậc 7–10 là SHOULD. Hearth không sửa được bằng tài nguyên: nó hồi 100% HP mỗi DAWN (50% sau khi thua), và hồi nhờ Điện thờ hoặc Phước lành.

### 11.2 Vùng và vây hãm Tim Khe Nứt
- Khi TR đạt trần của Vùng hiện tại, Tim Khe Nứt của Vùng đó "thức". Dẫn đội tới chạm vào trong PEACE → xác nhận → DUSK đặc biệt (Điềm báo boss, không chọn Hải đăng) → đêm vây hãm: boss của Vùng + 80% ngân sách ở TR trần.
- Thắng: Vùng được **phong ấn** → Bức Màn của Vùng kế tiếp tan, sàn/trần TR chuyển sang Vùng mới, nhận 30 Ember + rương boss (1 trang bị quý + 20 mảnh hero tự chọn), mở mục Sách Gloom của boss. Khe nứt của Vùng cũ vẫn hoạt động.
- Thua: áp dụng §2.4, TR không giảm, Tim Khe Nứt ngủ 2 đêm rồi thử lại được. Số lần thử không giới hạn.
- Boss theo Vùng: xem §7.7. Vùng 1–2 là MUST; Vùng 3–5 là SHOULD.
- Sau khi phong ấn cả 5 Vùng: chế độ **Gloom Sâu** (TR không trần, mỗi 10 TR thêm một tầng thưởng trong Sách Gloom) và mở Di sản (§11.12).

### 11.3 Dân làng và kinh tế làng
Làng là lý do pháo đài có hình dạng: không chỉ bảo vệ Hearth mà còn nhà và nơi làm việc.

- **Nhà** (2×2) chứa 2/3/4 dân làng theo cấp. Dân làng là sprite đi lại trong vùng sáng ban ngày, đêm xuống chạy về nhà trốn. Nhà bị phá → dân của nhà đó "sơ tán", không làm việc cho tới khi nhà được dựng lại. Dân làng không bao giờ chết.
- **Việc làm:** mỗi công trình sản xuất có số chỗ làm; gán dân bằng nút +/− trên bảng công trình hoặc để "Tự phân công" (mặc định bật, ưu tiên lương thực → gỗ → đá → sắt).

| Công trình | Chỗ làm (cấp 1/2/3) | Mỗi dân làm ra khi người chơi có mặt | Điều kiện đặt |
|---|---|---|---|
| Trại gỗ | 2/3/4 | 2 gỗ/phút | ≥ 3 cây trong 4 ô (cây đó không bị chặt hết: dân làng tỉa cành) |
| Mỏ đá | 2/3/4 | 1.5 đá/phút; từ Hearth bậc 4 có thể chuyển sang 0.5 sắt/phút nếu kề quặng | ≥ 2 đá hoặc quặng trong 4 ô |
| Ruộng | 2/3/4 | 2 lương thực/phút | ô cỏ, không cần node |
| Lò rèn | 1/1/2 | giảm 10%/dân thời gian và giá rèn | — |
| Thư viện | 1/2/3 | +1 trang Tri thức mỗi 3 đêm cho mỗi dân | — |
| Chợ | 1/1/2 | +5% vàng từ đêm cho mỗi dân | — |

- **Sản xuất chỉ chạy ở PEACE** (và khi offline). Khi offline: 25% tốc độ, tối đa 8 giờ, dừng khi Kho đầy.
- **Ăn:** mỗi DAWN mỗi dân làng ăn 1 lương thực. Thiếu ăn → dân "đói": sản xuất −50% cho tới bình minh no kế tiếp. Không có hậu quả nào khác. Dân dư lương thực 3 bình minh liên tiếp → +10% sản xuất ("no ấm").
- **Kho** (2×2): sức chứa mỗi loại tài nguyên có giới hạn = 300 + 400 × tổng cấp các Kho. Vượt sức chứa thì phần dư không được cộng (HUD nháy "Kho đầy").
- **Hầm** (2×2, từ bậc 4): bảo vệ 150 × cấp mỗi loại tài nguyên khỏi mất mát khi thua đêm (§2.4). Không có Hầm: mức bảo vệ cơ bản là 100.
- Toàn bộ công trình làng chịu luật ánh sáng và bị quái tấn công như công trình khác; quái ưu tiên đường tới Hearth nhưng Bomber và Cinderling nhắm công trình gần nhất, kể cả nhà.

### 11.4 Hero: sưu tập và phát triển lâu dài
- **10 hero** (6 hero của §7.1 + 4 hero mới ở §7.6). Bắt đầu với Brann; hero thứ hai từ lồng ở phiên 1. Các hero còn lại mở khi gom đủ **30 mảnh** của hero đó.
- **Cấp 1–30**, lưu vĩnh viễn. XP từ quái hạ (hero trong tiểu đội chia đều; hero đồn trú nhận 50%). Mỗi cấp +6% HP và sát thương. Trần cấp theo sao: 1★ = 10, 2★ = 15, 3★ = 20, 4★ = 25, 5★ = 30.
- **Nâng sao** bằng mảnh và tinh chất: 2★ = 20 mảnh + 30 tinh chất; 3★ = 40 + 80; 4★ = 80 + 160; 5★ = 160 + 300. Mỗi sao cũng +1 cấp cho nội tại (ví dụ Brann: bán kính khiêu khích 2 → 2.5 → 3…; bảng đầy đủ trong `data/heroes.ts`).
- **Chọn hướng kỹ năng:** ở cấp 5, 10, 15, 20, 25 chọn 1 trong 2 nâng cấp (10 lựa chọn mỗi hero, ghi trong `data/heroes.ts`; mỗi cặp phải là hai lối chơi khác nhau, không phải "+10% và +12%"). Ví dụ Wren cấp 5: *Mưa Tên bắn 8 mũi* hoặc *Mưa Tên xuyên mục tiêu*. Đổi lại lựa chọn tốn vàng (50 × cấp).
- **Trang bị:** mỗi hero 3 ô — Vũ khí, Giáp, Bùa. Ba độ hiếm: thường / hiếm / quý. Rèn ở Lò rèn (§11.9) hoặc rơi từ Viễn chinh và rương boss. Vũ khí: +sát thương% và có thể kèm hiệu ứng trúng đòn. Giáp: +HP% và có thể kèm giảm sát thương. Bùa: một nội tại độc nhất. 12 Bùa: *Lông Cú* (+1 tầm đánh xa) · *Đá Mài* (chí mạng +10%) · *Hạt Dẻ Lửa* (đòn thường có 15% gây cháy) · *Khóa Thợ* (sửa công trình khi đứng cạnh, 3 HP/s) · *Vỏ Ốc* (−20% sát thương nhận khi đứng yên) · *Chuông Gió* (+10% tốc chạy toàn đội) · *Mắt Mèo* (thấy quái `veiled` trong 4 ô) · *Lá Bùa Đói* (hồi 5% sát thương gây ra) · *Lõi Băng* (đòn thường làm chậm 15%) · *Đồng Xu May* (+15% vàng từ quái hero này hạ) · *Tro Phượng* (gục lần đầu mỗi đêm thì đứng dậy với 30% HP) · *Dây Lửa* (skill hồi nhanh 15%).
- **Tiểu đội:** tối đa 4 hero ra trận (5 từ Hearth bậc 8). Đổi đội hình ở màn Hero trong PEACE/DUSK.

### 11.5 Đồn trú và Thám báo: ba việc cho một hero
Mỗi hero ở một trong bốn trạng thái: **Tiểu đội** (đi cùng người chơi) · **Đồn trú** (trên một tháp) · **Thám báo** (đi vắng theo giờ thật) · **Nghỉ**. Sưu tập nhiều hero không làm tiểu đội mạnh vô hạn, mà mở thêm lựa chọn phân công.

**Đồn trú** (từ Hearth bậc 3; số ô 2/4/6 theo bậc 3/5/8): gán một hero vào một tháp cấp ≥ 2 ở DUSK hoặc PEACE. Hero hiện trên đỉnh tháp, không di chuyển, không thể bị hạ khi tháp còn. Tháp nhận thêm +2% sát thương mỗi cấp hero và một hiệu ứng riêng:

| Hero | Hiệu ứng khi đồn trú |
|---|---|
| Brann | Quái trong 3 ô ưu tiên đánh tháp này; tường kề tháp +30% HP |
| Wren | +2 tầm; đạn xuyên thêm 1 mục tiêu |
| Ilka | Tháp luôn có hiệu ứng Tên lửa, đạn nổ lan 1 ô |
| Tobi | Tháp và công trình trong 3 ô tự sửa 6 HP/s |
| Mira | Hồi 8 HP/s cho hero trong 4 ô; tháp miễn nhiễm vô hiệu hóa |
| Vex | Chí mạng 20% ×2.5; ưu tiên quái nhiều máu nhất |
| Fenn | Sói tuần tra 5 ô quanh tháp |
| Orla | Tháp khác trong 3 ô +15% tốc bắn |
| Sable | Quái `veiled` trong tầm bị lộ diện |
| Garrick | Mỗi 10 s ném 1 thùng nổ tầm 6 (30 `impact`, nổ 1.5 ô) |

**Thám báo** (Trạm Thám báo, từ bậc 3; 1/2/3 chuyến cùng lúc theo cấp): gửi một hero đi theo đồng hồ thật. Hero đi vắng không dùng được việc khác. Không có cách tăng tốc.

| Loại | Thời lượng chọn | Mang về (nhân theo cấp hero) |
|---|---|---|
| Gom nhặt | 15 phút / 1 giờ | gỗ, đá, sắt |
| Săn Gloom | 1 giờ / 4 giờ | tinh chất, vàng, 25%/60% cơ hội 3–6 mảnh hero ngẫu nhiên |
| Do thám | 4 giờ / 8 giờ | xem trước Điềm báo 3 đêm, +1 Đường Mới, 1–2 trang Tri thức |

Phần thưởng mỗi giờ giảm dần theo thời lượng (chuyến 8 giờ ≈ 3.5× chuyến 1 giờ) để người chơi vào nhiều lần trong ngày được lợi hơn nhưng người chỉ chơi 1 lần/ngày không bị thiệt nhiều.

### 11.6 Viễn chinh: roguelite thu nhỏ trong 3 phút
- Từ **Bến tàu** (Hearth bậc 2). Mỗi ngày thật có **3 hòn đảo** (đổi lúc 04:00 giờ máy), mỗi đảo có: biome, 1 **biến số** và 1 **trọng tâm chiến lợi phẩm** (sắt / tinh chất / mảnh hero / Tri thức / vật liệu Vùng / bản thiết kế trang bị).
- 10 biến số: quái nhanh +20% · quái đông gấp rưỡi nhưng yếu 30% · sương dày (tầm nhìn 3 ô) · toàn quái bắn xa · không hồi máu · hòm nhân đôi nhưng có canh gác tinh nhuệ · đêm tối (chỉ có đèn trưởng nhóm) · đất lầy (mọi thứ chậm 20%) · thời gian 120 s nhưng thưởng ×1.5 · boss ổ mạnh gấp đôi, rơi trang bị.
- **Chọn bậc khó I–V** (mở dần theo Vùng đã phong ấn): quái mạnh theo `M(TR tương ứng)`, thưởng tăng theo bậc.
- **Luật một chuyến:** đảo 40×40, tiểu đội tối đa 4, đồng hồ **180 s**. Cập bến ở thuyền → 3 **hòm** rải rác (mỗi hòm: nhận đồ + chọn 1 trong 2 **boon chuyến đi**) → 1 **ổ chính** có trùm nhỏ (hạ được: rương lớn) → quay về thuyền và đứng 3 s để **rút lui**.
- **Đồ đang mang là đồ đang liều:** rút lui kịp giữ 100%. Hết giờ hoặc cả đội gục: giữ 50% (làm tròn xuống), hero về nhà bình thường. HUD luôn hiện "đang mang" và mũi tên về thuyền; 30 s cuối đồng hồ nháy đỏ, nhạc dồn.
- **Boon chuyến đi:** dùng các boon nhóm Đội và nhóm Lửa ở §11.7, cộng dồn trong chuyến, mất khi về. Đây là chỗ giữ cảm giác "dựng build" của roguelite.
- **Đường Mới:** mỗi ngày nhận 3 (tích tối đa 6). Chuyến có Đường Mới rơi đầy đủ theo trọng tâm. Hết Đường Mới vẫn đi được không giới hạn, nhưng chỉ nhận gỗ/đá/sắt/vàng. Không bao giờ có nút "chờ" hay "mua lượt".
- Trong lúc Viễn chinh, thời gian ở Hold đứng yên.

### 11.7 Quà bình minh và Phước lành
Mỗi DAWN sau khi thắng: chọn **1 trong 3** (4 ở Hải đăng mức Dữ trở lên). Mỗi lựa chọn là một trong ba loại:
- **Phước lành:** một boon trong bảng dưới, có hiệu lực **3 đêm**. Tối đa 3 Phước lành cùng lúc (4 từ Hearth bậc 5). Đầy thì phải chọn bỏ một cái. Nhận trùng: cộng thêm 1 tầng (tới giới hạn trong ngoặc) và làm mới thời hạn.
- **Gói tài nguyên:** lượng lớn một loại (gỗ/đá/sắt/tinh chất) tính theo TR.
- **Quà hiếm** (10%; chắc chắn ở mức Ác mộng): 5 mảnh của một hero đang dùng, 1 trang bị, hoặc 2 trang Tri thức.

Độ hiếm Phước lành: thường/hiếm/huyền thoại 70/25/5 (TR ≥ 12: 55/35/10).

| Nhóm **Đội** | Nhóm **Pháo đài** | Nhóm **Lửa** |
|---|---|---|
| Lưỡi Sắc: hero +15% sát thương (×3) | Thợ Xây: tường −25% giá (×2) | Lửa Lớn: bán kính sáng Hearth +1 (×3) |
| Da Dày: hero +20% HP (×3) | Đá Tảng: tường +30% HP (×3) | Than Hồng: brazier không tốn nhiên liệu |
| Nhanh Chân: +15% tốc chạy (×2) | Mắt Diều Hâu: tháp +1 tầm (×2) | Tro Nóng: quái trong vùng `lit` chịu 1 `fire`/s (×3) |
| Hút Máu: hero hồi 8% sát thương gây ra | Nạp Nhanh: tháp +15% tốc bắn (×3) | Đèn Xa: đèn trưởng nhóm 3 → 5 ô |
| Tù Và Vang: Tù và kéo dài 6 → 10 s | Bẫy Kép: chông +4 lần dùng (×2) | Phản Chiếu: tháp trong vùng `lit` của Hearth +20% sát thương |
| Chiến Hữu *(hiếm)*: +1 hero ra trận | Mùa Bội Thu: sản xuất làng +50% | Bùng Cháy *(hiếm)*: cháy lan sang quái kề bên |
| Hồi Chiêu *(hiếm)*: skill hồi nhanh 25% | Gai Tường *(hiếm)*: quái đánh tường chịu 4 sát thương thuần mỗi đòn (không tính giáp) | Tái Sinh *(hiếm)*: Hearth hồi 2 HP/s ban đêm khi không bị đánh |
| Song Sinh *(huyền thoại)*: skill hero kích hoạt 2 lần | Pháo Đài Sống *(huyền thoại)*: công trình tự hồi 1% HP/s ban đêm | Bình Minh Giả *(huyền thoại)*: 1 lần/đêm khi Hearth < 25% → sáng toàn bản đồ 8 s, quái choáng 3 s |

Phước lành đang có hiện thành hàng icon dưới thanh máu Hearth kèm số đêm còn lại.

### 11.8 Nghiên cứu (Thư viện, từ Hearth bậc 4)
Ba nhánh, mỗi nhánh 8 nút theo thứ tự; mỗi nút tốn trang Tri thức (2, 3, 4, 6, 8, 10, 13, 16) và vàng (100 × thứ tự nút). Nghiên cứu xong ngay, vĩnh viễn. Nút in đậm mở cơ chế mới chứ không chỉ cộng số.

| # | Công sự | Ngọn lửa | Quản trị |
|---|---|---|---|
| 1 | Tường +15% HP | Brazier +0.5 bán kính | Kho +200 sức chứa |
| 2 | Sửa chữa rẻ hơn 30% | Nhiên liệu brazier: 1 gỗ cho 2 brazier | Dân làng +15% sản xuất |
| 3 | **Cổng tự động:** cổng tự mở cho hero, tự đóng khi quái trong 3 ô | **Lửa hiệu:** quái `veiled` trong vùng `dim` bị lộ diện | **Ca đêm:** dân làng sản xuất 25% trong NIGHT |
| 4 | Bẫy +25% sát thương | Hero trong vùng `lit` hồi 1% HP/s | Offline tối đa 8 → 12 giờ |
| 5 | **Lỗ châu mai:** tường kề tháp gây 3 sát thương/s cho quái đang đánh nó | **Lò than đôi:** brazier cấp 3 (bán kính 7, HP 140) | **Xe hàng:** mỗi DAWN nhận 5% sức chứa Kho của loại tài nguyên thấp nhất |
| 6 | Tháp +10% HP và sát thương | Tháp trong vùng `lit` +1 tầm vào đêm Trăng non | Chuyến Thám báo +1 ô |
| 7 | **Tường kép:** hai ô tường kề nhau theo chiều dày cộng chi phí phá cho nhau ×1.5 | **Lửa thiêng:** Snuffer mất gấp đôi thời gian để dập | Lữ khách có thêm 2 món |
| 8 | **Chốt chặn cuối:** 1 lần/đêm, khi công trình đầu tiên sắp vỡ thì bất tử 5 s | **Bình minh sớm:** đêm kéo quá 100 s thì quái −20% tốc thay vì nổi điên | **Thịnh vượng:** mỗi 10 dân làng +1 lựa chọn Bounty mỗi ngày |

Nhánh và nút 1–5 là MUST; nút 6–8 là SHOULD.

### 11.9 Lò rèn và Module tháp
- **Rèn trang bị** (từ bậc 3): chọn ô (Vũ khí/Giáp/Bùa) và bậc vật liệu. Giá: thường = 30 sắt + 20 tinh chất; hiếm = 80 sắt + 60 tinh chất + 5 vật liệu Vùng; quý = 180 sắt + 150 tinh chất + 15 vật liệu Vùng + bản thiết kế (từ Viễn chinh/boss). Chỉ số lăn trong khoảng theo độ hiếm; Bùa chọn được loại nếu đã có bản thiết kế, không thì ngẫu nhiên. Phân rã trang bị thừa hoàn 50% vật liệu.
- **Module tháp** (từ bậc 6, SHOULD): mỗi tháp cấp 3 có 1 ô module, tháo lắp miễn phí trong PEACE. 8 module (40 sắt + 60 tinh chất mỗi cái): *Đầu Tên Chẻ* (bắn 2 mục tiêu, −25% sát thương) · *Ngạnh Sắt* (gây chảy máu 4/s trong 4 s) · *Dầu Băng* (đòn làm chậm 20%) · *Kính Viễn* (+1.5 tầm, −15% tốc bắn) · *Tời Nhanh* (+30% tốc bắn, −1 tầm) · *Lõi Than* (đòn nổ lan 1 ô, gây cháy) · *Mắt Ưng* (ưu tiên quái bay, +50% sát thương lên chúng) · *Thành Lũy* (tháp +100% HP, quái trong 2 ô ưu tiên đánh nó).

### 11.10 Lớp hằng ngày và hằng tuần
- **Bounty** (từ bậc 2): mỗi ngày thật 3 nhiệm vụ, đổi lúc 04:00 giờ máy, chọn từ kho 24 mẫu thuộc 4 nhóm (Thủ đêm · Xây dựng · Viễn chinh · Làng). Ví dụ: "Thắng một đêm mức Dữ", "Hạ 40 quái bằng bẫy", "Rút lui với đủ 3 hòm", "Nâng cấp 3 công trình". Thưởng: vàng + 3 Ember + 10 Điểm Công. Đổi 1 Bounty miễn phí mỗi ngày. Bounty chưa xong **không mất** khi sang ngày: hàng chờ giữ tối đa 6.
- **Biên niên** (từ bậc 3): thanh 7 mốc mỗi tuần, tích bằng Điểm Công (Bounty 10, thắng đêm 3/5/8/12 theo mức Hải đăng, Viễn chinh rút lui 6, Trăng Máu 20). Mốc 1–6: tài nguyên, mảnh hero, trang Tri thức. Mốc 7: **một vật trang trí** (§11.11). Chơi vừa phải 5 ngày là đủ mốc 7. Tuần mới bắt đầu lại từ 0; không có phạt.
- **Hơi ấm Lò Lửa:** mỗi ngày thật có chơi ít nhất 1 đêm: +1 Hơi ấm (tối đa 7). Mỗi điểm: +3% sản xuất làng và +2% vàng. Mỗi ngày không chơi: −1 (không về 0 ngay). Hiện bằng 7 viên than quanh icon Hearth.
- **Lữ khách** (Chợ, từ bậc 4; trước đó ghé cạnh Hearth): xuất hiện mỗi bình minh thứ 3, ở lại một PEACE. 4 món: 2 đổi tài nguyên lấy tài nguyên (tỉ giá dao động ±30%), 1 gói mảnh hero hoặc trang bị giá vàng, 1 vật trang trí giá vàng.
- **Thông báo cục bộ** (COULD, chỉ khi người chơi bật): "Wren đã về từ chuyến Thám báo", "Kho đã đầy". Tối đa 2 thông báo/ngày, không gửi ban đêm theo giờ máy.

### 11.11 Sách Gloom, thành tựu, trang trí
- **Sách Gloom:** mỗi loại quái có trang riêng, mở khi gặp lần đầu (mô tả, điểm yếu). Mốc hạ 25 / 250 / 2500 con: +2% / +4% / +6% sát thương lên loại đó. Boss: mốc hạ 1 / 3 / 10 lần.
- **Thành tựu:** 30 cái, chia nhóm Xây dựng, Chiến đấu, Khám phá, Làng. Thưởng vàng/Ember một lần. Ví dụ: "Thắng một đêm không mất công trình nào", "Bịt kín hoàn toàn Hearth bằng tường đá", "Rút lui khi đồng hồ còn dưới 3 s".
- **Trang trí** (chỉ thay hình, không thay chỉ số): 5 màu lửa Hearth, 8 mẫu cờ hiệu (hiện trên cổng và tháp), 3 bộ da tường, 6 vật trang trí đặt được trong làng (tượng, giếng, vườn hoa, cột đèn, chuồng gà, bảng tin). Nguồn: Biên niên, Lữ khách, thành tựu, rương Trăng Máu.

### 11.12 Di sản (COULD)
Sau khi phong ấn Vùng 5, người chơi có thể **lập Hold thứ hai** trên một hòn đảo kiểu khác (băng giá hoặc sa mạc: đổi biome chủ đạo và thứ tự Vùng). Mang theo: hero, trang bị, Sách Gloom, trang trí, và 1 **đặc quyền Di sản** tự chọn (ví dụ: bắt đầu ở Hearth bậc 3, hoặc +1 ô Phước lành). Hold cũ được giữ nguyên; chuyển qua lại ở màn Title. Tối đa 3 Hold.

---

## 12. Âm thanh (sinh bằng code, không tải file ngoài)

`tools/audio/synth.mjs` sinh WAV mono 22 kHz 16-bit vào `assets/resources/audio/` bằng bộ tổng hợp kiểu sfxr (sóng vuông/tam giác/nhiễu + envelope + trượt tần số):
- **SFX (≥ 24):** bước chân, chặt gỗ, đập đá, nhặt xu, đặt công trình, không đặt được, nâng cấp, bán, tên bay, nỏ, cối bắn, nổ, băng, sét, hero đánh ×3, quái trúng đòn, quái chết, tường vỡ, brazier thắp/tắt, tù và đêm, Tù và hiệu triệu, chọn boon, lên cấp, nút UI, thắng, thua, boss gầm.
- **Nhạc (3 vòng lặp 16–32 s, chiptune 3 kênh):** ngày (thong thả, trưởng), đêm (dồn dập, thứ), boss. Chuyển nhạc mờ chéo 1 s.
- Giới hạn 8 voice SFX đồng thời, cùng một SFX không phát lại trong 50 ms. Âm thanh chỉ khởi động sau lần chạm đầu tiên (chính sách autoplay của trình duyệt).

- **Bổ sung cho Hold bền vững:** SFX chuông hoàng hôn, nhận quà lúc vắng, dân làng làm việc ×3, kho đầy, nâng bậc Hearth, phong ấn Vùng, rút lui thành công/thất bại, tick đồng hồ 30 s cuối, Trăng Máu, đóng băng tháp, Kẻ Đào trồi lên. Nhạc: thêm vòng lặp Viễn chinh (gấp gáp) và bản ngày thứ hai để luân phiên. Nới giới hạn tổng dung lượng âm thanh lên 5 MB.

---

## 13. Kỹ thuật

### 13.1 Toolchain COCOS 4 — thực tế đã kiểm tra

Các điều sau được xác nhận bằng cách **đọc mã nguồn** `github.com/cocos/cocos-cli` tại commit `59b8e0c` (2026-11-10, `cocos-cli` 0.2.0-beta.2, engine `cocos/cocos4` tag `4.0.0-beta.2`). Chưa được chạy thử trong môi trường viết SPEC → **Milestone M0 phải tự kiểm chứng lại bằng `--help` và chạy thật**, nếu khác thì theo thực tế và ghi vào `docs/DECISIONS.md`.

- COCOS 4 là bản tiến hóa của Cocos Creator 3.x: API runtime vẫn là `import { ... } from 'cc'`, decorator `_decorator.ccclass`. Khi nghi ngờ một API, tra file khai báo kiểu của engine đi kèm CLI, không đoán.
- CLI **không có trên npm** (gói npm tên `cocos-cli` là một dự án khác, không liên quan — không cài). Cài từ nguồn, cần Node ≥ 22.17 và git:
  ```bash
  git clone https://github.com/cocos/cocos-cli.git && cd cocos-cli
  npm run init            # kéo engine cocos4 + external (nặng, cần mạng tới github)
  npm install
  npm run download-tools  # tải công cụ nén texture... từ server Cocos; nếu lỗi mạng, vẫn thử build web-mobile trước khi coi là bị chặn
  npm run build && npm link
  cocos --help
  ```
- Lệnh: `cocos create --project <đường-dẫn-tuyệt-đối> --type 2d` · `cocos build --project <abs> --platform web-mobile [--debug]` · `cocos --no-interactive build ...` cho script · `cocos start-mcp-server --project <abs> --port 9527` (endpoint `http://localhost:9527/mcp`; tài liệu ghi mặc định 3000, mã nguồn ghi 9527 → luôn truyền `--port`).
- `cocos create` chỉ tạo `package.json` + `settings/` + thư mục rỗng, **không có scene nào**, và **từ chối chạy nếu thư mục đã có `package.json`** → chạy nó trước khi tạo `package.json` riêng, rồi thêm devDependencies vào file nó sinh ra. Dự án Cocos đặt ở **gốc repo**.
- Tạo scene: MCP tool `scene-create` `{ baseName: "Main", dbURL: "db://assets/scenes", templateType: "2d" }`, rồi `scene-save`. Các tool hữu ích khác: `scene-open`, `scene-create-node-by-type`, `scene-add-component`, `scene-set-component-property`, `assets-refresh`, `assets-import-asset`, `builder-build`, `system-query-logs`. Gọi bằng một script Node nhỏ (`tools/cocos/mcp-call.mjs`, JSON-RPC qua HTTP). Dự phòng: viết tay file `.scene` dựa theo mẫu `tests/fixtures/projects/asset-operation/assets/scene-2d.scene` trong repo CLI.
- File `.meta` do asset-db của CLI sinh khi import/build. Không viết tay `.meta`; commit các `.meta` được sinh ra.

**Thang xử lý sự cố toolchain (theo thứ tự):**
1. Đọc lỗi, sửa nguyên nhân (phiên bản Node, thiếu build tools, đường dẫn tương đối → dùng tuyệt đối), thử lại.
2. Nếu máy có sẵn Cocos Creator 3.8.x editor: build bằng dòng lệnh của editor (`--project … --build "platform=web-mobile"`); mã nguồn tương thích.
3. Nếu vẫn không build được: **không** lặng lẽ đổi sang engine khác. Hoàn thành mọi thứ không phụ thuộc build (sim core, test, art, audio, toàn bộ mã Cocos đã typecheck), ghi rõ lỗi chặn + log vào `docs/VERIFY.md`.

### 13.2 Kiến trúc: code-first, lõi mô phỏng thuần

Hai quyết định làm cho dự án làm được không cần editor và tự kiểm chứng được:

**(a) Một scene, mọi thứ dựng bằng code.** `Main.scene` chỉ là template 2D rỗng (Canvas + Camera). Không prefab, không kéo-thả. Khởi động bằng script tự bootstrap ở top-level module (mọi script trong `assets/` đều được nạp khi game chạy):
```ts
// assets/scripts/game/Boot.ts
import { director, Director } from 'cc';
import { EDITOR } from 'cc/env';
import { GameRoot } from './GameRoot';
if (!EDITOR) director.on(Director.EVENT_AFTER_SCENE_LAUNCH, () => {
  const canvas = director.getScene()!.getChildByName('Canvas')!;
  if (!canvas.getComponent(GameRoot)) canvas.addComponent(GameRoot);
});
```
Nếu cách này không chạy trong bản build, gắn `GameRoot` vào Canvas bằng MCP `scene-add-component`.

**(b) Lõi mô phỏng không phụ thuộc engine.** `assets/scripts/core/**` **không được import `cc`** (có test grep). Lõi tất định: cùng `seed` + cùng chuỗi lệnh → cùng kết quả. Bước cố định `1/30 s`; lớp view nội suy vị trí. Mọi tương tác của người chơi là **lệnh**: `Move(dir)`, `Place(id, x, y)`, `PaintLine(id, cells)`, `Upgrade`, `Repair`, `Sell`, `Undo`, `Horn`, `CallNight`, `StartNight`, `PickBoon(i)`, `SwapHero`, cùng các lệnh của Hold bền vững ở §13.8. Nhờ vậy toàn bộ luật chơi test được bằng Node, và bot chơi thử được hàng trăm run trong vài giây.

```
assets/
  scenes/Main.scene
  resources/art/atlas.png · atlas.json      resources/audio/*.wav
  scripts/
    core/                     # TS thuần, tất định, KHÔNG import 'cc'
      data/                   # buildings.ts enemies.ts heroes.ts boons.ts waves.ts balance.ts strings.en.ts  (export const … as const)
      sim/                    # World Grid MapGen Light FlowField Spawner Combat Towers Heroes Economy Boons Commands Save Rng
      bots/                   # SettlerBot CozyBot AutoplayBot ExpeditionBot (test cân bằng, autoplay e2e)
    game/                     # lớp Cocos: chỉ đọc state từ core và gửi lệnh
      Boot.ts GameRoot.ts
      render/                 # Atlas TileView EntityView LightOverlay FxPool CameraRig YSort
      ui/                     # BitmapText NineSlice Hud BuildDrawer RadialMenu BoonPicker Screens Tutorial Minimap
      input/                  # Joystick BuildGestures
      audio/                  # Sfx Music
tools/art · tools/audio · tools/cocos · tools/verify
tests/                        # vitest: unit lõi + bot cân bằng
docs/                         # art/ shots/ PROGRESS.md DECISIONS.md VERIFY.md
```
Dữ liệu cân bằng viết bằng module `.ts` (không `import` JSON) để chạy được cả trong Cocos lẫn Node.

### 13.3 Render trong Cocos (chỉ dùng API công khai)
- **Atlas:** nạp `resources.load('art/atlas/texture', Texture2D)` + `atlas.json` (JsonAsset), `setFilters(NEAREST, NEAREST)`, tạo `SpriteFrame` cho từng khung bằng `rect` trong code và cache theo tên. Nếu đường dẫn sub-asset khác (`/texture`), tra bằng MCP `assets-query-asset-info` thay vì đoán. Một texture duy nhất cho thế giới → gộp draw call.
- **Tile:** không tạo node cho cả bản đồ. Pool sprite chỉ cho các ô trong khung nhìn + lề 2 ô, gán lại khung khi camera di chuyển.
- **Thứ tự vẽ theo Y:** mỗi hàng ô một node cha (56 "xô hàng") trong lớp thực thể; thực thể đổi cha khi đổi hàng. Lớp từ dưới lên: nền → viền phủ → bẫy/bóng đổ → xô hàng (prop, công trình, unit) → đạn/FX → lớp phủ ánh sáng → HUD.
- **Lớp phủ ánh sáng:** theo §5, `Texture2D` cập nhật bằng `uploadData` mỗi khung.
- **Pool** cho quái, đạn, FX, số sát thương. Không `new Node` trong vòng lặp nóng sau khi đã khởi động.
- **Ngân sách:** ≤ 250 quái sống + 60 đạn + 150 công trình ở 60 fps trên máy tầm trung; ≤ 40 draw call trong trận; lõi mô phỏng ≤ 4 ms/bước ở tải tối đa (có benchmark test); bản build web ≤ 12 MB.

### 13.4 Hook debug (chỉ trong build `--debug` hoặc có `?debug=1`)
`window.__EH = { state(), cmd(c), goto(phase, {night, tr}), grant({...}), autoplay(on), speed(x), seed(n), resume(now), fps(), errors[] }` — dùng cho e2e và chụp màn hình.

### 13.5 Script npm
`art` · `audio` · `typecheck` (lõi + lớp game với khai báo kiểu `cc` do CLI sinh) · `test` (vitest) · `sim:balance` · `build:web` · `e2e` · **`verify`** = tất cả theo thứ tự, thoát mã khác 0 nếu bất kỳ bước nào lỗi.

### 13.6 Kiểm thử
- **Unit (vitest, lõi):** mỗi hệ thống ≥ 1 file test. Bắt buộc có: tất định (2 lần chạy cùng seed → cùng hash state sau 3 đêm bot chơi); flow field (đi vòng khi có lối, phá tường yếu nhất khi bịt kín, brute thích phá hơn, tính lại khi tường vỡ); luật ánh sáng 1–4; từng synergy; từng loại quái làm đúng hành vi đặc trưng; từng boon có hiệu lực đo được; lưu/nạp khứ hồi; sinh map 200 seed qua cổng §4.1; mọi công trình đặt/nâng/sửa/bán đúng giá.
- **Cổng cân bằng và nhịp tiến trình (`sim:balance`, 20 seed mỗi bot, mô phỏng nhiều chục đêm):**
  - `SettlerBot` (chơi đều: xây vòng tường, tháp cạnh brazier, nhà + trại, nâng cấp theo thứ tự hợp lý, Hải đăng mức Vững, mỗi 3 đêm một chuyến Viễn chinh bậc vừa sức): đạt Hearth bậc 3 trước đêm 10; chạm trần TR Vùng 1 trong đêm 10–18; phong ấn Vùng 1 trong đêm 14–30; phong ấn Vùng 2 trong đêm 40–80.
  - **Nhịp mở khóa:** trong 40 đêm đầu của `SettlerBot`, khoảng cách giữa hai "mở khóa có ý nghĩa" (công trình mới, hero mới, bậc Hearth, Vùng, hệ thống mới, sao hero) có trung vị ≤ 2 đêm và không lần nào > 5 đêm.
  - **Không kẹt:** ép `SettlerBot` thua 3 đêm liên tiếp ở bất kỳ điểm nào → thắng lại trong ≤ 4 đêm; sau mỗi lần thua luôn đủ tài nguyên để dựng lại ≥ 60% giá trị đã vỡ trong 2 PEACE.
  - **Chơi thong thả vẫn tiến:** `CozyBot` (không điều khiển tiểu đội ban đêm, chỉ xây và nâng cấp, luôn chọn mức Lặng) thắng ≥ 85% số đêm ở trần TR Vùng 1 và vẫn tới Hearth bậc 4, chậm hơn `SettlerBot`.
  - **Cược cao phải chơi khéo:** `CozyBot` ở mức Dữ thắng ≤ 40%; `AutoplayBot` (có điều khiển đội) ở mức Dữ thắng 50–85%.
  - **Kinh tế không lạm phát, không đói:** ở mỗi mốc đêm 10/20/40/60 của `SettlerBot`, số nâng cấp đang đủ tiền mua nằm trong khoảng 1–6; kho không đầy quá 50% thời gian.
  - **Viễn chinh căng vừa đủ:** `ExpeditionBot` ở bậc khó khớp tiến trình rút lui thành công 55–85% số chuyến, trung vị thời gian còn lại lúc rút < 45 s.
  - **Offline:** `settleOffline` với 0 s, 5 phút, 8 giờ, 30 ngày, và thời gian âm: không bao giờ vượt sức chứa, không âm, không sinh đêm, mốc ngày đúng.
  - Không đêm nào kéo quá 150 s. Một bước mô phỏng ≤ 4 ms với 250 quái + 400 công trình + 60 đạn + 40 dân làng.
- **E2E (Playwright + Chromium có sẵn, viewport 390×844, serve `build/web-mobile`):** không có lỗi console; đi hết Title → Game; giả lập chạm để đi, mở Build mode, sơn tường, đặt tháp; `autoplay` qua 2 đêm đầy đủ; chụp đủ danh sách ảnh ở §15.B vào `docs/shots/`; kịch bản chơi theo §15.C. FPS trung bình ≥ 30 trong headless khi có 150 quái.
- **Tự xem ảnh:** mở từng ảnh trong `docs/shots/` và contact sheet, chấm theo §9.7 và §15, sửa rồi chụp lại. Ghi kết quả vào `docs/VERIFY.md`.

### 13.7 Lưu trữ bền vững và thời gian
- **Một bản lưu Hold:** khóa `emberhold.hold.v2` (JSON có `version`), chứa toàn bộ thế giới: seed, đêm, TR, bậc Hearth, Vùng đã mở, mọi công trình (kể cả đổ nát), dân làng và việc làm, hero (cấp, sao, lựa chọn kỹ năng, trang bị, trạng thái), kho, nghiên cứu, Phước lành, Sách Gloom, Bounty/Biên niên/Hơi ấm, chuyến Thám báo (kèm mốc thời gian kết thúc), và **phần thay đổi của bản đồ** (node đã thu hoạch + số đêm còn lại để mọc, ô đã khám phá nén theo bit). Cài đặt lưu riêng ở `emberhold.settings.v1`.
- **Khi nào lưu:** mỗi DAWN; mỗi 20 s trong PEACE; ngay khi rời Build mode, khi tiêu tài nguyên hiếm, và khi trang bị ẩn đi (`visibilitychange`/`pagehide`). **Không lưu giữa NIGHT**: bản lưu gần nhất là DUSK của đêm đó.
- **An toàn dữ liệu:** ghi vào khóa tạm rồi đổi tên; giữ 1 bản dự phòng của lần lưu trước (`.bak`). Bản lưu hỏng → thử bản dự phòng → nếu cả hai hỏng thì báo người chơi và mở Hold mới, không crash. Có nút xuất/nhập bản lưu dạng chuỗi trong Cài đặt.
- **Di trú từ v1:** nếu thấy `emberhold.meta.v1`: hero đã mở thành hero sở hữu (1★ cấp 1), Ember giữ nguyên, bản lưu run bị bỏ. Mọi thay đổi định dạng về sau phải có hàm di trú và test.
- **Đồng hồ thật chỉ đi vào lõi qua tham số.** Lõi không gọi `Date`. Lớp view truyền `now` (ms) vào `resume(now)` và `tick(now)`; lõi tính thời gian trôi. Nhờ vậy lõi vẫn tất định và test được.
- **Tính offline:** hàm thuần `settleOffline(state, elapsedSec)`: giới hạn 8 giờ (12 giờ nếu có nghiên cứu), sản xuất 25% tới khi đầy kho, hoàn tất chuyến Thám báo, cập nhật mốc ngày (Bounty, Đường Mới, đảo, Hơi ấm) theo ranh 04:00 giờ máy. Trả về bản tóm tắt cho bảng "Trong lúc bạn đi vắng".
- **Đồng hồ lùi hoặc nhảy:** `now` nhỏ hơn lần lưu trước → coi như trôi 0 giây và giữ mốc cũ. Nhảy quá 30 ngày → vẫn chỉ tính 8 giờ sản xuất, nhưng mốc ngày chỉ nhảy 1 lần (không cộng dồn 30 ngày Bounty). Không có biện pháp chống gian lận nào khác: đây là game một người chơi.

### 13.8 Hiện trạng codebase v1 và phần phải đổi
Đã có và **giữ nguyên**: bộ sinh sprite và atlas, bộ tổng hợp âm thanh, flow field và luật phá tường, luật ánh sáng, xây/sơn/Undo, tháp và đạn, 6 hero và 7 loại quái, 2 boss, 5 synergy, 24 boon (thành Phước lành/boon chuyến đi), bot và hạ tầng test, lớp view Cocos, bản xem trước web, pipeline `npm run verify`.

Phải **thay đổi** trong lõi:

| Phần v1 | Việc cần làm ở v2 |
|---|---|
| `Phases`: DAY 75 s, kết thúc ở đêm 10, Victory/Defeat/Endless | PEACE 150 s dừng trong Build mode; vòng lặp vô hạn; bỏ Victory/Defeat/Endless; thêm "Lửa lụi" (§2.4) |
| `Spawner`: ngân sách theo số đêm, `hpScale` theo đêm, nổi điên ×3 sát thương ở 105 s | Ngân sách và `M(TR)` theo §8.2; nổi điên chỉ tăng tốc ở 120 s; thêm Hải đăng, tuần trăng, biến cố, Trăng Máu |
| `MapGen` 56×56, POI một lần | 96×96, 5 Vùng, Bức Màn, POI mọc lại theo đêm, lưu phần thay đổi |
| `Meta` (Ember mua hero/talent/bản vẽ), `Save` snapshot run | Bỏ talent và bản vẽ; thay bằng §11 và bản lưu Hold §13.7 |
| Hero XP đặt lại mỗi run, tối đa cấp 5 | Cấp 1–30, sao, lựa chọn kỹ năng, trang bị, 4 trạng thái |
| `hearthLevel` 1–3 | 10 bậc, mở khóa công trình theo bậc |
| Boss HP đã bị chỉnh (Mossback 1000, The Unlit 6500) | Theo §7.7; cân bằng lại bằng cổng ở §13.6 |
| Trại gỗ/mỏ đá tự chạy | Theo dân làng (§11.3) |

`api.ts` mở rộng theo kiểu cộng thêm: lệnh mới (`ringBell`, `setBeacon`, `garrison`, `dispatch`, `collectAway`, `assignWorkers`, `research`, `craft`, `equip`, `starUp`, `pickSkill`, `upgradeHearth`, `rebuild`, `rebuildAll`, `relocate`, `startExpedition`, `extract`, `claimBounty`, `trade`, `resume`, `tick`), trường state mới cho từng hệ thống. Viễn chinh là một `World` thứ hai chạy cùng lõi với bộ luật rút gọn (không xây, không ánh sáng tĩnh).

---

## 14. Lộ trình v2 (di trú từ codebase v1; làm tuần tự; mỗi mốc kết thúc bằng commit + cập nhật `docs/PROGRESS.md`)

| Mốc | Nội dung | Điều kiện qua mốc |
|---|---|---|
| **V2-M0 Toolchain** | (Tồn từ v1) Cài `cocos-cli`, tạo project + `Main.scene`, build `web-mobile`, chạy lớp view trong engine thật. Nếu vẫn bị chặn: tiếp tục dùng bản xem trước web làm nơi kiểm chứng và ghi rõ trong `docs/VERIFY.md`. | Ảnh chụp từ bản build Cocos, hoặc mục "bị chặn" có bằng chứng. |
| **V2-M1 Hold bền vững** | Bỏ run. Vòng PEACE/DUSK/NIGHT/DAWN vô hạn. TR + trần Vùng 1, Hải đăng, "Lửa lụi", đổ nát/dựng lại, di dời. Bản đồ 96×96 với Vùng 1–2 và Bức Màn. Mọc lại theo đêm. Bản lưu Hold v2 + tự lưu + khôi phục + di trú v1. | Test: chơi 30 đêm liên tục, lưu/nạp ở mọi pha cho cùng hash; thua không mất tiến trình; thoát giữa đêm quay lại DUSK. |
| **V2-M2 Làng và kinh tế** | Sắt, lương thực, tinh chất, Tri thức. Nhà, dân làng (đi lại, trốn đêm, sơ tán), việc làm, Ruộng, Kho, Hầm. `settleOffline` + bảng "Trong lúc bạn đi vắng". Bậc Hearth 1–4. | Test offline đủ các trường hợp §13.6; ảnh làng có dân đi lại. |
| **V2-M3 Hero dài hạn** | Cấp 30, sao, mảnh, 10 lựa chọn kỹ năng/hero, trang bị + Lò rèn, 4 hero mới, Đồn trú, Trạm Thám báo, Quán trọ kiểu mới. Màn Hero. | Test từng hiệu ứng đồn trú và từng lựa chọn kỹ năng; chuyến Thám báo hoàn tất qua `resume(now)`. |
| **V2-M4 Viễn chinh** | Bến tàu, 3 đảo mỗi ngày, 10 biến số, bậc khó, hòm + boon chuyến đi, ổ chính, rút lui, Đường Mới. | `ExpeditionBot` qua cổng; e2e chơi trọn một chuyến và rút lui. |
| **V2-M5 Đêm có chiều sâu** | Tuần trăng 7 pha, Trăng Máu + Nhà Vô Địch, biến cố đêm, quà bình minh + Phước lành 3 đêm, Lữ khách. Kẻ Đào, Kẻ Rít. Vây hãm Tim Khe Nứt Vùng 1 (Mossback) và Vùng 2 (Briarqueen). Bậc Hearth 5–6. | Test từng pha trăng, từng biến cố, từng quái mới; `SettlerBot` phong ấn Vùng 1 đúng khoảng. |
| **V2-M6 Lớp quay lại** | Bounty (24 mẫu), Biên niên, Hơi ấm, Sách Gloom, 30 thành tựu, trang trí, dòng "Mục tiêu kế tiếp", onboarding 3 phiên (§2.7), nghiên cứu nhánh 1–5. | E2E mô phỏng 3 phiên cách nhau bằng `resume(now)`; mỗi phiên mở đúng hệ thống của nó. |
| **V2-M7 Cân bằng dài hạn** | Chỉnh số tới khi qua toàn bộ cổng §13.6. Hiệu năng với pháo đài 400 công trình. Cập nhật ảnh chụp và video. | `npm run verify` xanh toàn bộ. |
| **V2-M8 SHOULD** | Vùng 3–5 (tile, quái, boss), bậc Hearth 7–10, module tháp, nghiên cứu nút 6–8, bản thiết kế bố cục, tiếng Việt có dấu, Di sản (COULD), thông báo cục bộ (COULD). | Mỗi mục có test/ảnh riêng; `verify` vẫn xanh. |

Nếu ngữ cảnh bị nén giữa chừng: đọc lại `SPEC.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md` rồi tiếp tục từ mốc đang dở.

---

## 15. Definition of Done

**A. Máy kiểm (tất cả trong `npm run verify`, mã thoát 0):** typecheck · unit test · cổng cân bằng và nhịp tiến trình §13.6 · art lint + manifest đủ · sinh audio · `cocos build --platform web-mobile` · e2e không lỗi console + đủ ảnh chụp.

**B. Mắt kiểm (tự mở ảnh, trả lời "có" cho từng câu, ghi vào `docs/VERIFY.md` kèm tên ảnh):**
1. Không có thực thể nào là hình khối đơn sắc; mọi thứ là sprite có outline và 3 bậc sáng tối.
2. Ảnh `night-defense` có: vùng sáng bậc thang rõ, quái ngoài sáng chỉ thấy mắt, tháp đang bắn, hero đồn trú trên tháp, số sát thương, tường auto-tile liền mạch.
3. Ảnh `build-mode` có: lưới, bóng ma xanh/đỏ, ngăn kéo với sprite thật, vòng tầm bắn, đường nối synergy.
4. Ảnh `village-day` có: nhà, dân làng đang làm việc, Kho, Ruộng, thanh đáy 5 nút, dòng "Mục tiêu kế tiếp".
5. HUD đọc được ở 390×844, không phần tử nào tràn hoặc đè safe-area, chữ là font bitmap.
6. Chuyển tiếp biome không có ô vuông cắt cụt; Bức Màn Gloom nhìn rõ là ranh giới; cây và công trình che nhau đúng thứ tự Y.
7. Đặt ảnh game cạnh `docs/art/style-anchor.png`: cùng một phong cách.

Ảnh bắt buộc trong `docs/shots/`: `title`, `away-summary`, `village-day`, `build-mode`, `dusk-omens-beacon`, `night-defense`, `blood-moon`, `rift-heart-siege`, `dawn-gifts`, `fire-gutters`, `hero-screen`, `expedition`, `expedition-result`, `chronicle`, `world-map`.

**C. Chơi kiểm (qua e2e và hook debug):**
- Chơi liên tục 12 đêm trong một lần chạy, có ít nhất 1 lần thua và hồi phục, 1 đêm Trăng Máu, 1 chuyến Viễn chinh rút lui thành công và 1 chuyến hết giờ.
- Tải lại trang ở PEACE, DUSK, giữa NIGHT và DAWN: Hold khôi phục đúng theo §2.2.
- Mô phỏng vắng 5 phút / 8 giờ / 3 ngày bằng `__EH.resume(now)`: bảng "Trong lúc bạn đi vắng" đúng số.
- Mọi nút đều có tác dụng; hệ thống chưa mở thì ẩn.

**D. Bàn giao:** `README.md`, `docs/VERIFY.md` (bảng từng mục A–C: đạt/không + bằng chứng), `docs/DECISIONS.md`, video gameplay mới, commit theo mốc, làm việc trên nhánh hiện tại.

Mục nào không đạt được vì bị chặn thật sự phải ghi rõ trong `docs/VERIFY.md`: đã thử gì, lỗi gì, cần gì để gỡ. Không được ghi "đạt" cho thứ chưa chạy.

---

## 16. Ngoài phạm vi
Mạng/PvP/bảng xếp hạng trực tuyến/đồng bộ đám mây, IAP, quảng cáo, gacha trả tiền, tài khoản, cốt truyện có hội thoại, màn ngang, tay cầm, đăng lên store. Tấn công khi người chơi vắng mặt, năng lượng chặn chơi, phần thưởng sức mạnh giới hạn thời gian là **cấm theo thiết kế** (§1.3), không phải "chưa làm". Bản build Android/iOS gốc là SHOULD/COULD; sản phẩm MUST là bản `web-mobile`.

---

## 17. Phụ lục: hằng số khởi điểm

```ts
export const BALANCE = {
  tile: 16, mapSize: 96, simHz: 30,
  peace: { seconds: 150, bellBonusMinLeft: 60, bellLootMul: 1.1, buildModePauses: true },
  night: { buildTimeScale: 0.25, enrageAfter: 120, enrageSpeedMul: 1.5, spawnWindow: (tr: number) => Math.min(70, 35 + 2 * tr) },
  threat: {
    budget: (tr: number) => 50 + 30 * tr + 1.2 * tr * tr, statMul: (tr: number) => Math.pow(1.06, tr - 1),
    regionBand: [[1, 10], [8, 20], [16, 30], [26, 40], [36, 50]], deepFloor: 46,
    riftsActive: (tr: number, open: number) => Math.min(open, 1 + Math.floor(tr / 6)),
    winGain: { calm: 0, steady: 1, fierce: 1, nightmare: 2 }, lossDrop: 2, rootBudgetCut: 0.3, eliteFromTr: 9, eliteMaxShare: 0.15,
  },
  beacon: { calm: { budget: 0.7, loot: 0.6 }, steady: { budget: 1, loot: 1 }, fierce: { budget: 1.35, loot: 1.6 }, nightmare: { budget: 1.8, loot: 2.5, minEliteShare: 0.2 } },
  moon: { cycle: 7, newLight: -1, newVeiledDmg: 1.1, halfRange: -1, halfTrapMul: 1.5, fullLight: 1, fullHeroDmg: 1.15, bloodBudget: 1.5, championHpMul: 6 },
  event: { fromTr: 6, chance: 0.2 },
  loss: { hearthRelightHp: 0.5, rebuildCostMul: 0.5, stockLoss: 0.2, baseProtected: 100, forcedCalmNights: 2, goldKept: 0.5 },
  light: { hearth: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16], brazier: [4, 5.5, 7], leader: 3, dimBand: 1.5, veiledSpeedMul: 1.25, brazierFuelWood: 1, relightSeconds: 2 },
  path: { breachDiv: 8, breachDivBrute: 20, tarCost: 1.5, spikeCost: 0.5, recomputeMaxHz: 5, aggroRange: 2.5, leashRange: 4 },
  build: { sellRefund: 0.6, upgradeCostMul: [1, 1.6, 2.5], upgradeDmgMul: 0.4, repairHpPerUnit: 15, nightBuildDelay: 1.5, undoDepth: 20, cap: 400, wallCapWeight: 0.25 },
  synergy: { flameRange: 2, flameDps: 3, flameSecs: 3, shatterMul: 1.5, embeddedRangeBonus: 1, rallyRange: 3, rallyRateMul: 1.25, tarSpikeMul: 2 },
  village: {
    storeBase: 300, storePerLevel: 400, essenceBase: 200, essencePerLevel: 100, vaultPerLevel: 150,
    perWorkerPerMin: { wood: 2, stone: 1.5, iron: 0.5, food: 2 }, offlineRate: 0.25, offlineMaxHours: 8,
    foodPerVillager: 1, hungryMul: 0.5, wellFedAfter: 3, wellFedMul: 1.1,
  },
  regrowNights: { tree: 2, rock: 4, ore: 6, special: 6, camp: 3, shrine: 5, ruin: 6 },
  hero: { maxLevel: 30, levelMul: 0.06, capByStar: [10, 15, 20, 25, 30], unlockShards: 30, starShards: [20, 40, 80, 160], starEssence: [30, 80, 160, 300],
          skillPickLevels: [5, 10, 15, 20, 25], garrisonXpShare: 0.5, garrisonDmgPerLevel: 0.02, squadMax: 4 },
  squad: { harvestRange: 1.2, harvestInterval: 0.6, reviveSeconds: 20 },
  horn: { charge: 40, seconds: 6, rateMul: 1.5 },
  expedition: { size: 40, seconds: 180, chests: 3, extractSeconds: 3, failKeep: 0.5, trailsPerDay: 3, trailsMax: 6, islandsPerDay: 3, tiers: 5 },
  dispatch: { durationsMin: [15, 60, 240, 480], perHourFalloff: [1, 1, 0.6, 0.44] },
  daily: { resetHour: 4, bounties: 3, bountyQueueMax: 6, freeRerolls: 1, warmthMax: 7, warmthProd: 0.03, warmthGold: 0.02, travelerEveryDawns: 3 },
  chronicle: { steps: 7, deeds: { bounty: 10, night: { calm: 3, steady: 5, fierce: 8, nightmare: 12 }, expedition: 6, bloodMoon: 20 } },
  blessing: { nights: 3, slots: 3, slotsAtTier5: 4, rarity: [70, 25, 5], rarityLate: [55, 35, 10], lateFromTr: 12, rareGiftChance: 0.1 },
  start: { wood: 40, stone: 15, gold: 0, freeBraziers: 1 },
  caps: { enemies: 250, projectiles: 60, villagers: 40 },
} as const;
```

Chỉ số chi tiết của công trình, hero, quái, boss nằm ở các bảng §6, §7, §11 và phải khớp với `core/data/*.ts`.

**Thuật ngữ:** *Hold* căn cứ bền vững của người chơi · *Hearth* Lò Lửa (lõi phải bảo vệ, 10 bậc) · *Gloom* bóng tối/phe quái · *Rift* khe nứt sinh quái · *Tim Khe Nứt* mục tiêu vây hãm để mở Vùng · *Bức Màn* ranh giới Vùng chưa mở · *TR* chỉ số Hiểm họa · *Hải đăng* mức cược mỗi đêm · *Phước lành* boon có thời hạn 3 đêm · *Viễn chinh* chuyến đi đảo 3 phút · *Đường Mới* lượt Viễn chinh có thưởng đầy đủ · *Thám báo* chuyến đi vắng theo giờ thật · *Đồn trú* gán hero lên tháp · *Bounty* nhiệm vụ ngày · *Biên niên* thanh thưởng tuần · *Hơi ấm* thưởng chơi đều · *Lửa lụi* thua một đêm · *Breach* quái phá công trình để mở đường.
