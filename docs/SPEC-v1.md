# EMBERHOLD — SPEC v1.0

> **Tên tạm:** *Emberhold* (cần kiểm tra trademark trước khi phát hành).
> **Thể loại:** Squad-action + xây căn cứ tự do + thủ thành theo đêm, roguelite.
> **Nền tảng:** Mobile 100% (màn dọc, một ngón cái). **Engine:** COCOS 4 + TypeScript.
> **Người đọc tài liệu này:** một AI coding agent chạy tự chủ. Mọi thứ cần để làm xong game nằm ở đây.

---

## 0. Cách đọc và thi hành tài liệu này

1. **Thứ tự ưu tiên khi có mâu thuẫn:** §15 Definition of Done → §14 Milestones → bảng số liệu (§17) → phần mô tả. Nếu SPEC thiếu một chi tiết, tự chọn phương án phục vụ tốt nhất §1 (Trụ cột), ghi quyết định vào `docs/DECISIONS.md` (1 dòng/quyết định) rồi làm tiếp. **Không dừng lại để hỏi.**
2. **MUST / SHOULD / COULD.** MUST là bắt buộc để coi là xong. SHOULD làm sau khi mọi MUST đã qua kiểm chứng. COULD chỉ làm nếu còn dư sức. Mục không ghi nhãn = MUST.
3. **Số liệu cân bằng là điểm khởi đầu, không phải hợp đồng.** Được phép chỉnh số để qua các cổng cân bằng ở §13.6. Luật chơi và danh sách nội dung thì không được cắt.
4. **Cấm làm cho xong.** Những thứ sau bị coi là *chưa làm*:
   - Thực thể gameplay vẽ bằng hình khối đơn sắc (`Graphics`, ô vuông, hình tròn, emoji, chữ cái) thay cho sprite pixel-art qua pipeline §9.
   - Hệ thống chỉ có dữ liệu/UI mà không có hành vi (nút không làm gì, tháp không bắn, boon không có hiệu lực).
   - `TODO`, `placeholder`, `stub`, hàm rỗng trong phần MUST.
   - Báo "đã xong" mà chưa chạy `npm run verify` và chưa tự xem ảnh chụp màn hình.
5. **IP gốc.** Game lấy cảm hứng *thể loại* từ các game squad-RPG và thủ-thành-xây-tường trên mobile. Không dùng tên, nhân vật, hình ảnh, màn chơi, âm thanh của bất kỳ game nào có sẵn. Mọi asset tự sinh trong repo.

---

## 1. Tầm nhìn

**Một câu:** Ban ngày dẫn một tiểu đội anh hùng tí hon đi gom gỗ đá và mở rộng vùng sáng; ban đêm bóng tối (*the Gloom*) tràn về, và pháo đài bạn tự tay xếp từng ô tường phải giữ cho Lò Lửa (*the Hearth*) không tắt.

### 1.1 Trụ cột thiết kế (mọi quyết định phải phục vụ ít nhất một trụ cột)

| # | Trụ cột | Nghĩa là |
|---|---|---|
| P1 | **Xây tự do, có hậu quả** | Đặt tường/tháp/bẫy trên lưới ô tự do, kéo ngón tay để "sơn" tường. Quái tìm đường theo đúng những gì bạn xây: mê cung, nút cổ chai, điểm bị phá đều do bạn tạo ra. |
| P2 | **Ánh sáng là lãnh thổ** | Chỉ xây được trong vùng sáng. Tháp chỉ thấy quái trong vùng sáng. Mở rộng lửa = mở rộng đất, nhưng tốn gỗ và thêm thứ phải bảo vệ. |
| P3 | **Một ngón cái** | Màn dọc. Kéo để đi, tiểu đội tự đánh. Mọi thao tác chạm được bằng ngón cái tay cầm máy. |
| P4 | **Mỗi đêm một câu đố mới** | Biết trước đêm nay quái gì đến (Điềm báo), mỗi loại quái phá một kiểu phòng thủ khác nhau, mỗi bình minh chọn 1 trong 3 boon. |
| P5 | **Nhìn là muốn chơi** | Pixel-art 16px có outline, bóng đổ, ánh lửa, hiệu ứng "juice" đầy đủ. Không có khung hình nào trông như prototype. |

### 1.2 Khác gì so với cảm hứng gốc
- Squad-RPG gốc: đánh nông, xây làng chỉ là menu nâng cấp → ở đây căn cứ là **vật thể trên bản đồ**, tự xếp từng ô, và bị tấn công thật.
- Thủ-thành gốc: xây theo ô định sẵn, đứng nhìn → ở đây **lưới tự do**, người chơi **trực tiếp điều khiển tiểu đội** vá chỗ thủng trong lúc tháp bắn.
- Mới hoàn toàn: cơ chế ánh sáng (P2), quái phá tường theo chi phí đường đi (§7.4), nhổ "rễ khe nứt" ban ngày để làm yếu đợt đêm (§4.3).

### 1.3 Chuẩn mobile 2027
Phiên chơi 3–5 phút/đêm, tự lưu mỗi bình minh, chơi offline, 60 fps trên máy tầm trung, không quảng cáo ép, không IAP trong bản này, có rung (haptics), có chế độ chữ to, chỉ báo không phụ thuộc màu sắc.

---

## 2. Vòng lặp game

### 2.1 Ba tầng vòng lặp

```
META  (nhiều run)   : Title → chọn hero khởi đầu + talent → RUN → nhận Ember → mở khóa → lặp
RUN   (10 đêm)      : Đêm 1..10, boss ở đêm 5 và 10, thắng đêm 10 → Victory → Endless (tùy chọn)
CHU KỲ (1 ngày-đêm) : DAY → DUSK → NIGHT → DAWN → DAY …
```

### 2.2 Máy trạng thái của một chu kỳ

| Pha | Thời lượng | Người chơi làm gì | Kết thúc khi |
|---|---|---|---|
| **DAY** | 75 s (đêm 1: 60 s) | Đi khám phá, tự động chặt cây/đập đá khi đứng gần, dọn ổ quái lấy rương, giải cứu hero, nhổ rễ khe nứt. Mở Build mode bất kỳ lúc nào (thời gian chạy 0.25×). | Hết giờ, hoặc bấm **"Gọi đêm sớm"** (+1 vàng cho mỗi 2 giây còn lại). |
| **DUSK** | Tạm dừng hoàn toàn | Màn hình tự vào Build mode, camera về Hearth. Xây/sửa/bán hoàn 100%. Hiện **Điềm báo** (icon + số lượng từng loại quái, khe nứt nào hoạt động). Trừ 1 gỗ/brazier làm nhiên liệu. | Bấm **"Bắt đầu đêm"**. |
| **NIGHT** | ~50–90 s | Quái sinh theo từng nhịp từ các khe nứt, đi theo flow field tới Hearth. Người chơi lái tiểu đội, bấm Tù và (Rally Horn), có thể mở Build mode (0.25×) để vá tường. | Tất cả quái của đợt đã sinh và đã chết. Sau 120 s, quái còn sống +50% tốc độ. |
| **DAWN** | Tạm dừng | Bảng tổng kết đêm → chọn **1 trong 3 boon** → hero gục hồi sinh tại Hearth, bẫy nạp lại, tự lưu run. | Chọn boon xong. |

- **Thua:** Hearth về 0 HP → màn Defeat (thống kê + Ember nhận được).
- **Thắng:** hạ boss đêm 10 → màn Victory → nút "Tiếp tục Endless" (đêm 11+: ngân sách quái ×1.18 mỗi đêm).
- Hero gục hết **không** thua; đêm tiếp diễn chỉ với tháp. Hero gục hồi sinh tại Hearth sau 20 s (ban đêm) hoặc ngay lúc DAWN.

### 2.3 Nhịp cảm xúc mong muốn trong một run
Đêm 1–2 học luật → đêm 3–4 quái bắn xa và quái phá tường buộc đổi cách xây → đêm 5 boss đi xuyên tường → đêm 6–8 quái bay, quái nổ, quái dập lửa phá ba giả định phòng thủ khác nhau → đêm 9 tổng hợp → đêm 10 boss dập đèn.

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
- **Build mode:** xem §6.2.
- Chạm 2 ngón: pan. Pinch: zoom 3 nấc số nguyên (n−1, n, n+1 device px/art px). Mọi vùng chạm ≥ 88×88 design px.

---

## 4. Thế giới

### 4.1 Lưới và bản đồ
- Lưới ô vuông, 1 ô = 16×16 art px. Bản đồ **56×56 ô**, là một hòn đảo, sinh thủ tục từ `seed` (RNG tất định mulberry32).
- Hearth 2×2 ở tâm. Quanh Hearth bán kính 6 ô luôn là cỏ trống.
- **Biome** (value-noise 2 octave + khoảng cách tới tâm): `meadow` (cỏ, cây thưa), `forest` (nền cỏ đậm, cây dày, nhiều gỗ), `quarry` (đất, nhiều đá/quặng), `shore` (cát, viền đảo), `water` (không đi được, viền ngoài cùng), `ruins` (2–3 cụm nền đá vỡ, có rương/điện thờ).
- Chuyển tiếp biome dùng sprite viền phủ (§9.4), không được để ô vuông cắt cụt.
- Cổng kiểm tra sinh map (unit test, 200 seed): luôn có đường đi bộ từ mọi khe nứt tới Hearth; ≥ 40 cây và ≥ 20 đá trong bán kính 16 ô quanh Hearth; không POI nào bị nước/vật cản bao kín.

### 4.2 Sương mù
Ô chưa từng nằm trong tầm nhìn (bán kính 5 ô quanh trưởng nhóm, hoặc trong vùng sáng tĩnh) hiển thị tối hoàn toàn. Ô đã khám phá hiển thị bình thường vào ban ngày.

### 4.3 Điểm tương tác (POI)

| POI | Số lượng/map | Hành vi |
|---|---|---|
| Cây (pine, oak) | theo biome | Cho gỗ (số liệu ở mục Thu hoạch bên dưới). Chặt xong còn gốc cây, mọc lại sau 2 ngày. Chặn đường đi và chặn xây. |
| Đá (nhỏ/vừa/lớn) | theo biome | Cho đá. Lớn chặn đường. Không mọc lại. |
| Mạch quặng vàng | 6–8 | Cho vàng. Không mọc lại. |
| Ổ Gloom (camp) | 6 | 4–8 quái canh giữ (mạnh dần theo khoảng cách tới Hearth). Dọn sạch → rương: vàng + chọn 1/2 boon loại thường. |
| Lồng hero | 3 | Có 2–3 quái canh. Phá lồng (HP 40) → hero mới vào đội; nếu đội đủ 4 thì về kho dự bị ở Hearth. |
| Điện thờ | 3 | Chạm 1 lần/run: buff tới hết đêm kế (ngẫu nhiên: +20% sát thương hero / +25% tốc tháp / hồi đầy máu Hearth). |
| Khe nứt (rift) | 4, ở rìa đảo, cách Hearth ≥ 20 ô, lệch góc nhau ≥ 60° | Nơi quái sinh ban đêm. Kích hoạt dần: đêm 1–2: 1 khe; 3–5: 2; 6–8: 3; 9+: 4. Luôn hiện trên minimap khi đã kích hoạt. |
| Rễ khe nứt | 1 cạnh mỗi khe đang hoạt động, mọc lại mỗi ngày | HP 150, có 3–5 quái canh. Phá trong DAY → khe đó −30% ngân sách quái đêm nay. Đánh đổi: thời gian đi xa so với thời gian gom tài nguyên. |

**Thu hoạch:** hero đứng trong 1.2 ô quanh node và không có quái trong tầm sẽ tự chặt, mỗi hero 1 nhát/0.6 s. Cây: 3 nhát/cây, mỗi nhát +2 gỗ. Đá nhỏ 2 nhát (+2 đá/nhát), vừa 4, lớn 7. Quặng: 5 nhát, +3 vàng/nhát. Tài nguyên bay thành icon về HUD.

---

## 5. Ánh sáng (cơ chế chữ ký)

- **Nguồn sáng tĩnh:** Hearth (bán kính 7/9/11 ô theo cấp 1/2/3), Brazier (4 ô; nâng cấp 5.5 ô). **Nguồn sáng động:** đèn của trưởng nhóm (3 ô).
- Mỗi ô có trạng thái: `lit` (trong bán kính), `dim` (trong bán kính + 1.5), `dark`.
- **Luật 1 — Lãnh thổ:** chỉ đặt công trình lên ô `lit` bởi nguồn sáng **tĩnh** (ngày cũng như đêm). Brazier phải đặt trên ô `lit` hoặc `dim` → nối chuỗi brazier để mở đất.
- **Luật 2 — Tầm nhìn tháp:** ban đêm tháp chỉ nhắm quái ở ô `lit`/`dim`. Quái ở ô `dark` là "ẩn": chỉ vẽ đôi mắt phát sáng, +25% tốc độ. Hero thấy mọi thứ trong tầm đánh của mình.
- **Luật 3 — Nhiên liệu:** đầu mỗi đêm mỗi brazier tự trừ 1 gỗ; thiếu gỗ thì brazier đó tắt đêm nay (ưu tiên giữ brazier gần Hearth).
- **Luật 4 — Bị dập:** brazier bị Snuffer hoặc boss dập sẽ tắt; hero đứng cạnh 2 s để thắp lại. Công trình trên ô mất sáng vẫn tồn tại nhưng tháp ở đó không nhắm được quái ngoài vùng sáng.
- **Hiển thị:** lớp phủ bóng tối là một texture độ phân giải thấp (1 texel = 4×4 art px) cập nhật mỗi khung từ CPU, 3 mức alpha rời rạc (lit 0 / dim 0.45 / dark 0.85 ban đêm; ban ngày chỉ dùng cho sương mù), màu `#1b1b2f`, filter NEAREST → mép sáng bậc thang kiểu pixel. Ánh lửa rung ±0.25 ô theo sin + nhiễu. Chuyển ngày→đêm nội suy alpha trong 3 s. Có vòng màu cam ấm rất nhạt (alpha 0.08) trong vùng `lit` ban đêm.

---

## 6. Xây dựng tự do

### 6.1 Luật đặt
- Mỗi công trình chiếm footprint w×h ô. Hợp lệ khi: mọi ô `lit` tĩnh (§5), không nước, không cây/đá lớn/POI, không công trình khác, không có hero đứng trong (quái đứng trong thì vẫn cho đặt bẫy, không cho đặt vật cản).
- **Được phép bịt kín hoàn toàn.** Quái sẽ phá tường theo §7.4. Không có luật "phải chừa đường".
- Hero đi xuyên **Gate**; mọi vật cản khác chặn hero. Bẫy không chặn ai.
- Xây xong tức thì, có hiệu ứng nảy + bụi. Công trình mới đặt trong NIGHT có 1.5 s "đang dựng" (50% HP, chưa hoạt động).
- **Nâng cấp** (chạm công trình → vòng menu: Nâng cấp / Sửa / Bán): tối đa cấp 3. Sửa: 1 gỗ (hoặc 1 đá với đồ đá) cho mỗi 15 HP. Bán: hoàn 60% (100% trong DUSK hoặc khi Undo ngay trong cùng phiên Build).

### 6.2 UX Build mode
- Vào bằng nút Búa. Thời gian 0.25× (DUSK: dừng hẳn). Viền màn hình có họa tiết bản vẽ, lưới ô hiện mờ trong vùng xây được, vùng không xây được phủ sọc chéo.
- **Ngăn kéo đáy** 4 tab: Phòng thủ / Ánh sáng / Bẫy / Kinh tế. Mỗi thẻ: sprite thật của công trình, tên, giá, khóa nếu chưa mở.
- Chọn thẻ rồi:
  - Công trình 1×1 "sơn được" (tường, bẫy): chạm-kéo để sơn một đường; khóa trục ngang/dọc theo hướng kéo ban đầu, kéo chéo thì vẽ đường Bresenham 4-liên thông. Bóng ma xanh/đỏ từng ô, hiện tổng giá ngay trên ngón tay, thả tay mới trừ tiền và đặt (đặt được bao nhiêu ô đủ tiền).
  - Công trình khác: chạm để đặt bóng ma, kéo để dời, nút ✓ xác nhận / ✕ hủy nổi cạnh bóng ma. Hiện vòng tầm bắn và các đường nối synergy (§6.4) trong lúc kéo.
- Không chọn thẻ: 1 ngón pan camera; chạm công trình mở vòng menu.
- Kéo sát mép màn hình thì camera tự cuộn. Nút Undo (hoàn tác thao tác đặt gần nhất, tối đa 20 bước trong phiên). Nút thoát Build mode.
- Tường tự nối hình (auto-tile theo 4 hướng lân cận, 16 biến thể).

### 6.3 Danh mục công trình

Giá viết `gỗ/đá/vàng`. Cấp 2 và 3: giá ×1.6 và ×2.5 so với cấp 1; chỉ số tăng ghi ở cột cuối.

| id | Tên | Ô | Giá | HP | Chức năng (cấp 1) | Nâng cấp | Nhãn |
|---|---|---|---|---|---|---|---|
| `hearth` | Lò Lửa | 2×2 | — | 500 | Lõi. Sáng 7 ô. Tự bắn tia lửa yếu (tầm 4, 5 sát thương/s). | C2: 30/40/60 → HP 800, sáng 9. C3: 60/90/150 → HP 1200, sáng 11 | MUST |
| `wall_wood` | Tường gỗ | 1×1 | 4/0/0 | 60 | Vật cản. Sơn được. | → `wall_stone` | MUST |
| `wall_stone` | Tường đá | 1×1 | 0/6/0 | 160 | Vật cản. Sơn được. | C2: HP 260 | MUST |
| `gate` | Cổng | 1×1 | 10/0/0 | 90 | Hero đi xuyên, quái coi như tường. | C2: HP 200 (0/12/0) | MUST |
| `brazier` | Lò than | 1×1 | 12/4/0 | 40 | Sáng 4 ô. Nhiên liệu 1 gỗ/đêm. | C2: sáng 5.5, HP 80 | MUST |
| `tower_arrow` | Tháp cung | 1×1 | 20/10/0 | 120 | Tầm 5, 8 `pierce`, 1.0 phát/s, đơn mục tiêu, bắn được quái bay. | +40% sát thương/cấp, C3 tầm 6 | MUST |
| `tower_ballista` | Nỏ lớn | 2×2 | 30/40/0 | 200 | Tầm 8, 30 `impact`, 0.4 phát/s, xuyên thẳng tối đa 4 quái. Không bắn quái bay. | +40%/cấp, C3 xuyên 6 | MUST |
| `tower_frost` | Tháp băng | 1×1 | 0/25/30 | 100 | Hào quang 3 ô: làm chậm 40%, 2 `frost`/s. | C2 chậm 50%, C3 tầm 4 | MUST |
| `tower_mortar` | Cối | 2×2 | 0/50/40 | 180 | Tầm 4–9 (có tầm tối thiểu), 24 `impact` nổ bán kính 1.5, 0.33 phát/s. Không bắn quái bay. | +40%/cấp, C3 nổ 2.0 | MUST |
| `trap_spikes` | Chông | 1×1 | 8/4/0 | — | 10 sát thương mỗi quái bước lên, 6 lần rồi cụp; nạp lại lúc DAWN. | C2: 18 sát thương, 9 lần | MUST |
| `trap_tar` | Hắc ín | 1×1 | 6/0/0 | — | Làm chậm 50%. Dính lửa → cháy 4 s, 6 `fire`/s cho quái đứng trên; cháy xong mất. | — | MUST |
| `lumber_camp` | Trại gỗ | 2×2 | 25/0/10 | 150 | Cần ≥ 3 cây trong 3 ô. +1 gỗ / 4 s trong DAY. | C2: /3 s, C3: /2 s | MUST |
| `quarry` | Mỏ đá | 2×2 | 30/0/15 | 150 | Cần ≥ 2 đá trong 3 ô. +1 đá / 5 s trong DAY. | C2: /4 s, C3: /3 s | MUST |
| `tower_spark` | Tháp sét | 1×1 | 0/30/60 | 100 | Tầm 4.5, 10 `spark`, nảy 3 mục tiêu, 0.7 phát/s, bắn được quái bay. | +40%/cấp, C3 nảy 5 | SHOULD |
| `barracks` | Trại lính | 2×2 | 40/20/40 | 220 | Mỗi đêm sinh 2 dân binh (HP 50, 6 sát thương) canh trong 5 ô. | +1 lính/cấp | SHOULD |
| `workshop` | Xưởng | 2×2 | 40/40/30 | 180 | Ban đêm tự sửa công trình trong 5 ô, 4 HP/s (không tốn tài nguyên). | 6 / 9 HP/s | SHOULD |
| `tavern` | Quán trọ | 2×2 | 30/20/60 | 180 | Mỗi DAWN bán 1 trong 2 hero ngẫu nhiên (40 vàng × số hero đã có). | — | SHOULD |

### 6.4 Synergy kề nhau (chiều sâu của P1)

| Điều kiện | Hiệu ứng | Hiển thị |
|---|---|---|
| `tower_arrow`/`tower_ballista` trong 2 ô quanh brazier đang cháy | **Tên lửa:** đòn gây thêm cháy 3 `fire`/s trong 3 s, châm được hắc ín | Đầu tháp có đốm lửa; đường nối cam khi đặt |
| Quái đang bị làm chậm bởi băng nhận đòn `impact` | **Vỡ băng:** +50% sát thương | Số sát thương màu xanh băng, to hơn |
| Tháp có ≥ 2 cạnh kề tường/cổng ("âm tường") | +1 tầm | Viền đá dưới chân tháp |
| Tháp trong 3 ô quanh trưởng nhóm | **Hiệu triệu:** +25% tốc bắn | Cờ nhỏ phất trên tháp |
| Hắc ín kề chông | Quái bị chậm chịu chông ×2 | Icon liên kết khi đặt |

Mỗi synergy phải có unit test và phải nhìn thấy được trên màn hình.

---

## 7. Chiến đấu

### 7.1 Hero (6 nhân vật gốc)

Mọi hero: tự đánh, 1 skill tự kích hoạt theo hồi chiêu. Lên cấp trong run (XP chia đều từ quái hạ; cấp 2–5 cần 20/50/100/180 XP; mỗi cấp +12% HP và sát thương). Đội tối đa 4 (1 trưởng nhóm + 3 theo sau theo đội hình chữ V, dùng steering bám slot, không đi xuyên vật cản).

| id | Tên, vai trò | HP | Đòn thường | Skill (hồi chiêu) | Nội tại | Mở khóa |
|---|---|---|---|---|---|---|
| `knight` | **Brann**, đỡ đòn | 120 | Cận chiến, 10 `impact`, 1.2/s | *Khiên Đập* (8 s): choáng 1 s hình nón 2 ô | Quái trong 2 ô ưu tiên đánh Brann | Có sẵn |
| `ranger` | **Wren**, bắn xa | 70 | Tầm 5, 7 `pierce`, 1.5/s, bắn được quái bay | *Mưa Tên* (10 s): 5 mũi tên hình quạt | +25% sát thương lên quái ở ô `dark` | 50 Ember |
| `pyro` | **Ilka**, diện rộng | 60 | Tầm 4, cầu lửa nổ 1.2 ô, 14 `fire`, 0.6/s | *Tường Lửa* (14 s): vệt lửa 4 ô, 8 `fire`/s trong 4 s | Thắp lại brazier tức thì trong 3 ô; đòn châm hắc ín | 120 Ember |
| `tinker` | **Tobi**, thợ | 80 | Cận chiến, 6 `impact`, 1.0/s | *Tháp Mini* (16 s): đặt ụ súng 8 s (5 `pierce`, 2/s) | Sửa công trình trong 3 ô 8 HP/s; giá xây −10% | 120 Ember |
| `cleric` | **Mira**, hồi máu | 75 | Tầm 3, 4 `spark`, 1.0/s | *Thánh Địa* (18 s): vùng 2.5 ô trong 5 s, hồi 10 HP/s, quái bên trong −20% sát thương | Hồi 6 HP/s cho đồng đội thấp máu nhất trong 4 ô | 200 Ember |
| `rogue` | **Vex**, sát thủ | 65 | Cận chiến, 6 `pierce`, 2.5/s, chí mạng 25% ×2.5 | *Bước Bóng* (9 s): dịch chuyển tới quái nhiều máu nhất trong 6 ô, đòn kế ×3 | +30% tốc chạy cho cả đội khi không giao tranh | 200 Ember |

### 7.2 Loại sát thương và nhãn quái

| Loại | `armored` | `swarm` | `flying` | Ghi chú |
|---|---|---|---|---|
| `pierce` | ×0.5 | ×1 | ×1 | Cung, Wren, Vex |
| `impact` | ×1.25 | ×1 | cận chiến và cối/nỏ **không trúng** quái bay | Brann, nỏ, cối |
| `fire` | ×1 | ×1.5 | ×1 | Cháy cộng dồn thời gian, không cộng dồn DPS |
| `frost` | ×1 | ×1 | ×1 | Kèm làm chậm |
| `spark` | ×1 | ×1 | ×1.5 | Tháp sét, Mira |

`sát thương cuối = max(1, round(gốc × (1 + Σbonus) × hệ số loại × hệ số synergy))`.

### 7.3 Quái (the Gloom)

Tông tím–chàm, mắt vàng phát sáng. Tốc độ tính bằng ô/s. "Giá" là chi phí trong ngân sách đợt (§8).

| id | Tên | HP | Tốc | Sát thương | Nhãn | Hành vi | Giá | Xuất hiện |
|---|---|---|---|---|---|---|---|---|
| `gloomling` | Gloomling | 20 | 1.6 | 4 cận chiến, 1/s | — | Đi theo flow field tới Hearth | 4 | Đêm 1 |
| `skitter` | Skitter | 12 | 2.8 | 3, 1.5/s | swarm | Đi bầy 5 con, len qua khe | 3 | Đêm 2 |
| `spitter` | Spitter | 30 | 1.3 | 6 tầm 4, 0.8/s | — | Dừng ở tầm bắn, ưu tiên tháp rồi hero | 9 | Đêm 3 |
| `brute` | Brute | 120 | 0.9 | 18, 0.7/s; ×2 lên công trình | armored | Dùng flow field "kẻ phá tường" (§7.4) | 22 | Đêm 4 |
| `wisp` | Wisp | 18 | 1.8 | 5, 1/s | flying | Bay thẳng tới Hearth, bỏ qua tường và bẫy | 7 | Đêm 6 |
| `bomber` | Bomber | 25 | 2.0 | Nổ 1.5 ô: 60 lên công trình, 15 lên hero | — | Lao vào công trình gần nhất trên đường rồi nổ. Bị hạ trước khi tới: chỉ nổ hình ảnh | 10 | Đêm 7 |
| `snuffer` | Snuffer | 60 | 1.2 | 8, 1/s | — | Flow field tới brazier đang cháy gần nhất, chạm 1.5 s → dập. Hết brazier → Hearth | 16 | Đêm 8 |

**Biến thể tinh nhuệ** (từ đêm 9, tối đa 15% ngân sách): ×2.5 HP, ×1.3 sát thương, to 125%, viền sáng; giá ×2.5.

**Boss:**

| Boss | Đêm | HP | Hành vi |
|---|---|---|---|
| **Mossback** — rùa đá khổng lồ cõng phế tích | 5 | 1500 | Tốc 0.5, `armored`. Đi **đường thẳng** tới Hearth, nghiền công trình trên đường (40 sát thương/s). Mỗi 8 s rụt vào mai 3 s: nhả 6 gloomling, trong lúc đó miễn sát thương từ tháp nhưng nhận ×2 từ hero. Dưới 30% HP: tốc 0.8. |
| **The Unlit** — vị vua không đèn | 10 | 4000 | Tốc 0.7, lơ lửng (đi theo flow field, không tính là `flying`). Mỗi 12 s phát xung: dập mọi brazier trong 8 ô trong 6 s và thu bán kính sáng Hearth còn 60% trong 6 s. Mỗi 10 s gọi 4 wisp. Ở 66% và 33% HP: dịch chuyển sang khe nứt khác, hồi 5% HP, gọi 1 brute tinh nhuệ. |

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
`burn` (DPS theo nguồn, làm mới thời lượng), `slow` (lấy mức mạnh nhất), `stun`, `veiled` (ở ô tối). Mỗi trạng thái có icon/hiệu ứng trên đầu quái.

---

## 8. Đợt quái

- Ngân sách đêm `n`: `B(n) = 40 + 28n + 4n²` (đêm 1 = 72, đêm 5 = 280, đêm 10 = 720). Đêm boss: boss + 60% ngân sách.
- Thành phần: chỉ dùng loại đã xuất hiện (§7.3). Trọng số ưu tiên loại mới ra mắt trong đêm đầu của nó (≥ 25% ngân sách) để người chơi được "giới thiệu".
- Chia ngân sách cho các khe đang hoạt động theo tỉ lệ ngẫu nhiên trong [0.6, 1.4] rồi chuẩn hóa; khe bị nhổ rễ −30%.
- Mỗi khe nhả quái theo **nhịp**: mỗi 6–8 s một nhóm, tổng thời gian sinh `min(70, 35 + 4n)` giây. Nhịp cuối luôn có đơn vị đắt nhất.
- **Điềm báo** (hiện ở DUSK và có thể mở lại): danh sách icon loại quái × số lượng, mũi tên chỉ hướng từng khe. Sinh tất định từ `seed + n` trước khi DUSK bắt đầu.
- Mở đầu đêm: tiếng tù và, băng rôn "ĐÊM n", mép màn hình phía có khe nháy tím.

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

---

## 10. UI/UX

### 10.1 Màn hình
Title (logo, Chơi / Tiếp tục run / Doanh trại / Cài đặt) → Doanh trại (mở khóa hero, talent, bản vẽ; chọn hero khởi đầu) → Game → Pause → Dawn (tổng kết + boon) → Victory / Defeat → về Title. Cài đặt: âm lượng nhạc/SFX, rung, chữ to, ngôn ngữ (en mặc định; vi là SHOULD), xóa dữ liệu.

### 10.2 HUD trong trận (design 720×1280)
- **Trên-trái:** thanh máu Hearth (icon lửa), bên dưới là gỗ / đá / vàng.
- **Trên-giữa:** đồng hồ pha (mặt trời/mặt trăng chạy trên cung tròn) + "ĐÊM n/10". Ban đêm: số quái còn lại.
- **Trên-phải:** Pause; minimap 112×112 (đảo, vùng sáng, công trình, khe nứt, hero, quái ban đêm), chạm để phóng to.
- **Trái-giữa:** chân dung 4 hero + thanh máu + vòng hồi chiêu.
- **Phải-dưới:** nút Búa, nút Tù và (vòng nạp). **Dưới-giữa (DAY):** "Gọi đêm sớm".
- Mũi tên mép màn hình chỉ: Hearth khi ra khỏi tầm nhìn, khe nứt đang nhả quái, công trình đang bị đánh.

### 10.3 Hướng dẫn (run đầu tiên, bỏ qua được)
5 bước theo ngữ cảnh, mỗi bước 1 câu + mũi tên, chỉ qua bước khi người chơi làm đúng: (1) kéo để đi → (2) đứng cạnh cây để chặt → (3) mở Búa, sơn 6 ô tường → (4) đặt 1 tháp cung cạnh brazier để thấy đường nối synergy → (5) đọc Điềm báo, bắt đầu đêm. Các cơ chế mới về sau (quái bay, dập lửa…) giới thiệu bằng thẻ 1 dòng ở DUSK của đêm đó.

### 10.4 Khả năng tiếp cận
Tốt/xấu luôn kèm hình dạng hoặc icon ngoài màu sắc (ô hợp lệ: dấu ✓ nhỏ; không hợp lệ: sọc chéo). Chế độ chữ to ×1.5. Không có thao tác bắt buộc giữ lâu hay chạm nhanh liên tục.

---

## 11. Roguelite và tiến trình

### 11.1 Boon (mỗi DAWN chọn 1 trong 3; rương ổ Gloom cho chọn 1 trong 2 loại thường)
24 boon, ba nhóm, độ hiếm thường/hiếm/huyền thoại với trọng số 70/25/5 (đêm ≥ 6: 55/35/10). Boon có thể cộng dồn tới mức ghi trong ngoặc.

| Nhóm **Đội** | Nhóm **Pháo đài** | Nhóm **Lửa** |
|---|---|---|
| Lưỡi Sắc: hero +15% sát thương (×3) | Thợ Xây: tường −25% giá (×2) | Lửa Lớn: bán kính sáng Hearth +1 (×3) |
| Da Dày: hero +20% HP (×3) | Đá Tảng: tường +30% HP (×3) | Than Hồng: brazier không tốn nhiên liệu |
| Nhanh Chân: +15% tốc chạy (×2) | Mắt Diều Hâu: tháp +1 tầm (×2) | Tro Nóng: quái trong vùng `lit` chịu 1 `fire`/s (×3) |
| Hút Máu: hero hồi 8% sát thương gây ra | Nạp Nhanh: tháp +15% tốc bắn (×3) | Đèn Xa: đèn trưởng nhóm 3 → 5 ô |
| Tù Và Vang: Tù và kéo dài 6 → 10 s | Bẫy Kép: chông +4 lần dùng (×2) | Phản Chiếu: tháp trong vùng `lit` của Hearth +20% sát thương |
| Chiến Hữu *(hiếm)*: +1 slot hero (tối đa 5) | Mùa Bội Thu: trại gỗ/mỏ đá +50% | Bùng Cháy *(hiếm)*: cháy lan sang quái kề bên |
| Hồi Chiêu *(hiếm)*: skill hồi nhanh 25% | Gai Tường *(hiếm)*: quái đánh tường chịu 4 sát thương/đòn | Tái Sinh *(hiếm)*: Hearth hồi 2 HP/s ban ngày |
| Song Sinh *(huyền thoại)*: skill hero kích hoạt 2 lần | Pháo Đài Sống *(huyền thoại)*: công trình tự hồi 1% HP/s ban đêm | Bình Minh Giả *(huyền thoại)*: 1 lần/đêm khi Hearth < 25% → sáng toàn bản đồ 8 s, quái choáng 3 s |

### 11.2 Meta
- **Ember** nhận cuối run: `10 × số đêm sống sót + 50 × boss hạ + 5 × ổ Gloom dọn + 100 nếu thắng`.
- Tiêu ở Doanh trại: mở hero (§7.1); mở bản vẽ SHOULD (`tower_spark` 80, `barracks` 100, `workshop` 100, `tavern` 120); 8 talent × 3 cấp (30/60/120): gỗ khởi đầu +20, đá khởi đầu +15, Hearth +10% HP, ngày dài +8 s, hero khởi đầu cấp +1, hoàn bán +10%, rương thêm 1 lựa chọn, Tù và nạp sẵn 50%.
- Khởi đầu run: 40 gỗ, 15 đá, 0 vàng, hero đã chọn, Hearth cấp 1, 1 brazier tặng.

### 11.3 Lưu
`localStorage` qua `sys.localStorage`, khóa `emberhold.meta.v1` và `emberhold.run.v1`, JSON có `version`. Meta lưu ngay khi thay đổi. Run lưu snapshot ở mỗi DAWN (seed, đêm, tài nguyên, công trình, hero, boon, POI đã tiêu). Title có "Tiếp tục run" nếu có snapshot. Dữ liệu hỏng/khác version → bỏ qua run, giữ meta nếu đọc được, không crash.

---

## 12. Âm thanh (sinh bằng code, không tải file ngoài)

`tools/audio/synth.mjs` sinh WAV mono 22 kHz 16-bit vào `assets/resources/audio/` bằng bộ tổng hợp kiểu sfxr (sóng vuông/tam giác/nhiễu + envelope + trượt tần số):
- **SFX (≥ 24):** bước chân, chặt gỗ, đập đá, nhặt xu, đặt công trình, không đặt được, nâng cấp, bán, tên bay, nỏ, cối bắn, nổ, băng, sét, hero đánh ×3, quái trúng đòn, quái chết, tường vỡ, brazier thắp/tắt, tù và đêm, Tù và hiệu triệu, chọn boon, lên cấp, nút UI, thắng, thua, boss gầm.
- **Nhạc (3 vòng lặp 16–32 s, chiptune 3 kênh):** ngày (thong thả, trưởng), đêm (dồn dập, thứ), boss. Chuyển nhạc mờ chéo 1 s.
- Giới hạn 8 voice SFX đồng thời, cùng một SFX không phát lại trong 50 ms. Âm thanh chỉ khởi động sau lần chạm đầu tiên (chính sách autoplay của trình duyệt).

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

**(b) Lõi mô phỏng không phụ thuộc engine.** `assets/scripts/core/**` **không được import `cc`** (có test grep). Lõi tất định: cùng `seed` + cùng chuỗi lệnh → cùng kết quả. Bước cố định `1/30 s`; lớp view nội suy vị trí. Mọi tương tác của người chơi là **lệnh**: `Move(dir)`, `Place(id, x, y)`, `PaintLine(id, cells)`, `Upgrade`, `Repair`, `Sell`, `Undo`, `Horn`, `CallNight`, `StartNight`, `PickBoon(i)`, `SwapHero`. Nhờ vậy toàn bộ luật chơi test được bằng Node, và bot chơi thử được hàng trăm run trong vài giây.

```
assets/
  scenes/Main.scene
  resources/art/atlas.png · atlas.json      resources/audio/*.wav
  scripts/
    core/                     # TS thuần, tất định, KHÔNG import 'cc'
      data/                   # buildings.ts enemies.ts heroes.ts boons.ts waves.ts balance.ts strings.en.ts  (export const … as const)
      sim/                    # World Grid MapGen Light FlowField Spawner Combat Towers Heroes Economy Boons Commands Save Rng
      bots/                   # NoBuildBot BaselineBot (dùng cho test cân bằng và autoplay e2e)
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
`window.__EH = { state(), cmd(c), goto(phase, {night}), grant({wood,stone,gold}), autoplay(on), speed(x), seed(n), fps(), errors[] }` — dùng cho e2e và chụp màn hình.

### 13.5 Script npm
`art` · `audio` · `typecheck` (lõi + lớp game với khai báo kiểu `cc` do CLI sinh) · `test` (vitest) · `sim:balance` · `build:web` · `e2e` · **`verify`** = tất cả theo thứ tự, thoát mã khác 0 nếu bất kỳ bước nào lỗi.

### 13.6 Kiểm thử
- **Unit (vitest, lõi):** mỗi hệ thống ≥ 1 file test. Bắt buộc có: tất định (2 lần chạy cùng seed → cùng hash state sau 3 đêm bot chơi); flow field (đi vòng khi có lối, phá tường yếu nhất khi bịt kín, brute thích phá hơn, tính lại khi tường vỡ); luật ánh sáng 1–4; từng synergy; từng loại quái làm đúng hành vi đặc trưng; từng boon có hiệu lực đo được; lưu/nạp khứ hồi; sinh map 200 seed qua cổng §4.1; mọi công trình đặt/nâng/sửa/bán đúng giá.
- **Cổng cân bằng (`sim:balance`, 30 seed mỗi bot):**
  - `NoBuildBot` (chỉ đi và đánh, không xây): thua trước hoặc trong đêm 4 ở ≥ 90% seed → chứng minh phòng thủ là bắt buộc.
  - `BaselineBot` (vòng tường quanh Hearth, 2 cổng, tháp cung cạnh brazier, nâng cấp theo thứ tự cố định, ban ngày chặt cây gần): qua đêm 5 ở ≥ 70% seed, thắng đêm 10 ở ≤ 35% seed → vừa sức nhưng cần chơi khéo hơn bot.
  - Không seed nào kết thúc đêm quá 150 s.
- **E2E (Playwright + Chromium có sẵn, viewport 390×844, serve `build/web-mobile`):** không có lỗi console; đi hết Title → Game; giả lập chạm để đi, mở Build mode, sơn tường, đặt tháp; `autoplay` qua 2 đêm đầy đủ; chụp `docs/shots/`: `title`, `day-explore`, `build-mode`, `dusk-omens`, `night-defense`, `boss`, `dawn-boons`, `barracks`, `defeat`. FPS trung bình ≥ 30 trong headless khi có 150 quái.
- **Tự xem ảnh:** mở từng ảnh trong `docs/shots/` và contact sheet, chấm theo §9.7 và §15, sửa rồi chụp lại. Ghi kết quả vào `docs/VERIFY.md`.

---

## 14. Milestones (làm tuần tự; mỗi mốc kết thúc bằng commit + cập nhật `docs/PROGRESS.md`)

| Mốc | Nội dung | Điều kiện qua mốc |
|---|---|---|
| **M0 Toolchain** | Cài `cocos-cli`, `cocos create` ở gốc repo, tạo `Main.scene`, Boot tự bootstrap hiện 1 sprite anchor từ atlas, build web-mobile, Playwright chụp được ảnh có sprite đó. Dựng `npm run verify`. | Ảnh chụp có sprite; `verify` chạy được đầu-cuối. |
| **M1 Lõi mô phỏng** | Grid, MapGen, Rng, Commands, Light, FlowField, Economy, Save; test tương ứng. | Test xanh; cổng sinh map 200 seed qua. |
| **M2 Art lô 1** | Tile + viền phủ, prop, Hearth, tường (auto-tile), cổng, brazier, tháp cung, Brann, gloomling, font bitmap, UI cơ bản. Atlas + lint + contact sheet. | Lint xanh; đã tự xem và sửa ≥ 2 vòng. |
| **M3 Lát cắt dọc chơi được** | Lớp view: bản đồ, camera, joystick, đội hero, thu hoạch, Build mode đủ thao tác sơn/đặt/bán, một đêm gloomling, lớp phủ ánh sáng, HUD, thắng/thua. | E2E chơi qua 1 chu kỳ ngày-đêm; ảnh chụp qua thang §9.7. |
| **M4 Đủ nội dung chiến đấu** | Mọi công trình MUST, synergy, 7 loại quái, tinh nhuệ, 2 boss, 6 hero + skill, trạng thái, Điềm báo, đợt quái 10 đêm. Art lô 2 tương ứng. | Test hành vi từng loại xanh; `sim:balance` chạy được. |
| **M5 Roguelite + meta** | 24 boon, POI (ổ, lồng, điện thờ, rễ khe nứt), Ember, Doanh trại, talent, lưu/tiếp tục run, Endless. | Test boon + lưu xanh; e2e đi hết Title→run→Defeat→Doanh trại. |
| **M6 UI/UX hoàn chỉnh + juice + âm thanh** | Mọi màn hình §10, hướng dẫn, minimap, toàn bộ §9.8, SFX + nhạc §12, cài đặt. | Mọi ảnh `docs/shots/` qua thang §15.B. |
| **M7 Cân bằng + hiệu năng** | Chỉnh số tới khi qua cổng §13.6; benchmark; pool; draw call. | `npm run verify` xanh toàn bộ. |
| **M8 SHOULD** | `tower_spark`, `barracks`, `workshop`, `tavern`, tiếng Việt, cấu hình build Android (nếu máy có SDK). | Mỗi mục có test/ảnh riêng; `verify` vẫn xanh. |

Nếu ngữ cảnh bị nén giữa chừng: đọc lại `SPEC.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md` rồi tiếp tục từ mốc đang dở.

---

## 15. Definition of Done

**A. Máy kiểm (tất cả trong `npm run verify`, mã thoát 0):** typecheck · unit test · cổng cân bằng · art lint + manifest đủ · sinh audio · `cocos build --platform web-mobile` · e2e không lỗi console + đủ 9 ảnh chụp.

**B. Mắt kiểm (tự mở ảnh, trả lời "có" cho từng câu, ghi vào `docs/VERIFY.md` kèm tên ảnh):**
1. Không có thực thể nào là hình khối đơn sắc; mọi thứ là sprite có outline và 3 bậc sáng tối.
2. Ảnh `night-defense` có: vùng sáng bậc thang rõ, quái ngoài sáng chỉ thấy mắt, tháp đang bắn, số sát thương, tường auto-tile liền mạch.
3. Ảnh `build-mode` có: lưới, bóng ma xanh/đỏ, ngăn kéo với sprite thật, vòng tầm bắn, đường nối synergy.
4. HUD đọc được ở 390×844, không phần tử nào tràn hoặc đè safe-area, chữ là font bitmap.
5. Chuyển tiếp biome không có ô vuông cắt cụt; cây và công trình che nhau đúng thứ tự Y.
6. Đặt ảnh game cạnh `docs/art/style-anchor.png`: cùng một phong cách.

**C. Chơi kiểm (qua e2e/autoplay và hook debug):** chơi được trọn một run từ Title tới Victory hoặc Defeat rồi quay lại Title, tiếp tục run sau khi tải lại trang, mọi nút đều có tác dụng.

**D. Bàn giao:** `README.md` (cài đặt, chạy, build, cấu trúc), `docs/VERIFY.md` (bảng từng mục A–C: đạt/không + bằng chứng), `docs/DECISIONS.md`, commit theo mốc, làm việc trên nhánh hiện tại, không đẩy lên nhánh khác.

Mục nào không đạt được vì bị chặn thật sự (ví dụ toolchain không cài được) phải ghi rõ trong `docs/VERIFY.md`: đã thử gì, lỗi gì, cần gì để gỡ. Không được ghi "đạt" cho thứ chưa chạy.

---

## 16. Ngoài phạm vi
Mạng/PvP/bảng xếp hạng, IAP, quảng cáo, gacha, tài khoản, cốt truyện có hội thoại, nhiều bản đồ, màn ngang, tay cầm, đăng lên store. Bản build Android/iOS gốc là SHOULD/COULD; sản phẩm MUST là bản `web-mobile` chơi được trên trình duyệt điện thoại với cấu hình sẵn sàng đóng gói.

---

## 17. Phụ lục: hằng số khởi điểm

```ts
export const BALANCE = {
  tile: 16, mapSize: 56, simHz: 30,
  day: { seconds: 75, firstDaySeconds: 60, callNightGoldPerSec: 0.5, buildTimeScale: 0.25 },
  night: { enrageAfter: 120, enrageSpeedMul: 1.5, spawnWindow: (n: number) => Math.min(70, 35 + 4 * n) },
  budget: (n: number) => 40 + 28 * n + 4 * n * n, bossBudgetMul: 0.6, endlessMul: 1.18,
  riftsActive: (n: number) => (n <= 2 ? 1 : n <= 5 ? 2 : n <= 8 ? 3 : 4), rootBudgetCut: 0.3,
  light: { hearth: [7, 9, 11], brazier: [4, 5.5], leader: 3, dimBand: 1.5, veiledSpeedMul: 1.25, brazierFuelWood: 1, relightSeconds: 2 },
  path: { breachDiv: 8, breachDivBrute: 20, tarCost: 1.5, spikeCost: 0.5, recomputeMaxHz: 5, aggroRange: 2.5, leashRange: 4 },
  build: { sellRefund: 0.6, upgradeCostMul: [1, 1.6, 2.5], upgradeDmgMul: 0.4, repairHpPerUnit: 15, nightBuildDelay: 1.5, undoDepth: 20 },
  synergy: { flameRange: 2, flameDps: 3, flameSecs: 3, shatterMul: 1.5, embeddedRangeBonus: 1, rallyRange: 3, rallyRateMul: 1.25, tarSpikeMul: 2 },
  squad: { max: 4, harvestRange: 1.2, harvestInterval: 0.6, reviveSeconds: 20, xp: [20, 50, 100, 180], levelMul: 0.12 },
  horn: { charge: 40, seconds: 6, rateMul: 1.5 },
  start: { wood: 40, stone: 15, gold: 0, freeBraziers: 1 },
  gold: { gloomling: 1, skitter: 1, spitter: 3, brute: 6, wisp: 2, bomber: 3, snuffer: 5, eliteMul: 3, boss: 80 },
  xp:   { gloomling: 1, skitter: 1, spitter: 3, brute: 8, wisp: 2, bomber: 3, snuffer: 5, eliteMul: 3, boss: 60 },
  ember: { perNight: 10, perBoss: 50, perCamp: 5, victory: 100 },
  caps: { enemies: 250, projectiles: 60, buildings: 150 },
} as const;
```

**Thuật ngữ:** *Hearth* Lò Lửa (lõi phải bảo vệ) · *Gloom* bóng tối/phe quái · *Rift* khe nứt sinh quái · *Brazier* lò than mở rộng vùng sáng · *Boon* phần thưởng chọn mỗi bình minh · *Ember* tiền meta · *Điềm báo* bảng báo trước đợt quái · *Breach* quái phá công trình để mở đường.
