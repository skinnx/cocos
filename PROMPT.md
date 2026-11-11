# Một prompt + một goal để dựng Emberhold

Dùng với Claude Code (hoặc agent tương đương) mở tại gốc repo này. Dán **PROMPT** làm tin nhắn đầu tiên; đặt **GOAL** làm điều kiện hoàn thành (lệnh `/goal` nếu có, nếu không thì dán nối ngay sau prompt).

## Chuẩn bị trước khi chạy (việc của người, làm một lần)

| Cần | Vì sao |
|---|---|
| Node ≥ 22.17, git, ~10 GB đĩa trống | `cocos-cli` build từ nguồn, kéo cả engine `cocos4` |
| Mạng ra `github.com`, `registry.npmjs.org` và server tải công cụ của Cocos | Bước `npm run init`, `npm install`, `npm run download-tools` |
| **Cho phép sẵn** agent clone, cài và chạy `cocos-cli` | Ở chế độ quyền tự động, việc cài và chạy mã từ một repo bên ngoài có thể bị chặn. Câu ủy quyền nằm sẵn trong prompt bên dưới; nếu vẫn bị hỏi, thêm rule cho phép `Bash` với `npm`, `node`, `cocos`, `git clone` |
| Chromium + Playwright | Để agent tự chụp và tự xem ảnh màn hình |
| (Tùy chọn) đính kèm ảnh tham khảo phong cách | Chỉ để tham khảo *cảm giác*; SPEC §0 mục 5 cấm sao chép |

## PROMPT

```text
Bạn là lead game developer kiêm pixel artist của dự án Emberhold trong repo này.

Nhiệm vụ: hiện thực TOÀN BỘ game theo SPEC.md, từ mốc M0 đến M7 (và M8 nếu còn sức), bằng COCOS 4 + TypeScript, cho mobile màn dọc.

Trước khi viết dòng code nào:
1. Đọc hết SPEC.md. Nó là nguồn sự thật duy nhất; §0 nói cách xử lý khi thiếu chi tiết.
2. Chạy `node tools/art/anchors.mjs` rồi mở docs/art/style-anchor.png để xem. Đó là mức chất lượng hình ảnh tối thiểu; đọc tools/art/pixel.mjs và tools/art/anchors.mjs để nắm hai kỹ thuật vẽ.

Cách làm việc:
- Tôi ủy quyền cho bạn clone, cài đặt, build và chạy cocos-cli từ https://github.com/cocos/cocos-cli (kèm engine cocos/cocos4 mà nó kéo về), cài devDependencies qua npm, chạy server tĩnh cục bộ và Playwright. Không cần hỏi lại cho những việc này.
- Làm tuần tự theo SPEC §14. Mốc nào cũng phải đạt điều kiện qua mốc rồi mới sang mốc sau. Mỗi mốc: commit, cập nhật docs/PROGRESS.md.
- Tự quyết mọi chi tiết SPEC chưa nói, ghi 1 dòng vào docs/DECISIONS.md, làm tiếp. Không dừng để hỏi tôi.
- Gặp lỗi: chẩn đoán nguyên nhân, sửa, thử lại; với toolchain thì theo thang xử lý ở SPEC §13.1. Không lặp lại một lệnh hỏng mà chưa hiểu vì sao hỏng.
- Hình ảnh: mọi thực thể là sprite pixel-art sinh qua pipeline SPEC §9, cùng phong cách với style-anchor. Sau mỗi nhóm sprite và mỗi mốc có giao diện, tự mở contact sheet và ảnh chụp màn hình ra xem, chấm theo SPEC §9.7 và §15.B, sửa tới khi đạt. Hình vuông/tròn đơn sắc, emoji hay chữ thay cho sprite đều bị coi là chưa làm.
- Không rút gọn phạm vi MUST, không để TODO/stub, không báo "xong" cho thứ chưa chạy. Nếu bị chặn thật sự, ghi đúng sự thật vào docs/VERIFY.md và hoàn thành mọi phần còn lại.
- Làm việc trên nhánh hiện tại; không đẩy lên nhánh khác.

Kết thúc bằng báo cáo ngắn: đã làm gì, `npm run verify` cho kết quả gì, còn hạn chế gì.
```

## GOAL

```text
Hoàn thành khi TẤT CẢ đều đúng: (1) `npm run verify` thoát mã 0 và gồm đủ typecheck, unit test, cổng cân bằng bot, art lint + manifest, sinh audio, `cocos build --platform web-mobile`, e2e Playwright không lỗi console; (2) docs/shots/ có đủ 9 ảnh nêu ở SPEC §13.6 và tôi đã tự mở từng ảnh, trả lời "có" cho cả 6 câu ở SPEC §15.B; (3) docs/VERIFY.md liệt kê từng mục của SPEC §15 A–D kèm bằng chứng, không mục MUST nào ở trạng thái chưa đạt mà thiếu lý do bị chặn cụ thể; (4) mọi thay đổi đã commit trên nhánh hiện tại. Chưa đủ thì tiếp tục làm, không dừng lại hỏi.
```

## Sau khi agent báo xong (kiểm tra nhanh của người)

1. `npm run verify` trên máy bạn.
2. Mở `docs/shots/night-defense.png` và `docs/shots/build-mode.png`, so với `docs/art/style-anchor.png`.
3. Serve `build/web-mobile/` rồi mở bằng điện thoại, chơi hết đêm 3.
4. Đọc `docs/VERIFY.md` và `docs/DECISIONS.md` để biết agent đã tự quyết những gì.
