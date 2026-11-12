# Một prompt + một goal để nâng Emberhold lên SPEC v2

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

Bối cảnh: repo đã có bản v1 chạy được (lõi mô phỏng, art, audio, lớp view Cocos, bản xem trước web, test) theo docs/SPEC-v1.md. SPEC.md hiện tại là v2 "Hold bền vững": bỏ cấu trúc run, chuyển sang một căn cứ tồn tại lâu dài với tiến trình dài hạn.

Nhiệm vụ: nâng codebase lên SPEC.md v2, theo lộ trình SPEC §14 từ V2-M1 đến V2-M7 (V2-M8 nếu còn sức). Giữ những gì SPEC §13.8 nói là giữ; không viết lại từ đầu.

Trước khi viết dòng code nào:
1. Đọc hết SPEC.md, docs/DECISIONS.md, docs/VERIFY.md, docs/CONTRACT.md và assets/scripts/core/api.ts.
2. Chạy `npm install && npm run verify -- --allow-blocked` để biết trạng thái xuất phát.
3. Mở docs/art/style-anchor.png và vài ảnh trong docs/shots/ để nắm mức chất lượng hình ảnh phải giữ.

Cách làm việc:
- Tôi ủy quyền cho bạn clone, cài đặt, build và chạy cocos-cli từ https://github.com/cocos/cocos-cli (kèm engine cocos/cocos4 mà nó kéo về), cài devDependencies qua npm, chạy server tĩnh cục bộ và Playwright. Không cần hỏi lại cho những việc này.
- Làm tuần tự theo SPEC §14. Mốc nào cũng phải đạt điều kiện qua mốc rồi mới sang mốc sau. Mỗi mốc: commit, cập nhật docs/PROGRESS.md. `npm run verify` phải xanh ở cuối mỗi mốc (test v1 không còn đúng luật thì sửa theo luật v2, không xóa để cho qua).
- Tự quyết mọi chi tiết SPEC chưa nói, ghi 1 dòng vào docs/DECISIONS.md, làm tiếp. Không dừng để hỏi tôi.
- Gặp lỗi: chẩn đoán nguyên nhân, sửa, thử lại; với toolchain thì theo thang xử lý ở SPEC §13.1.
- Hình ảnh: mọi thực thể mới là sprite pixel-art qua pipeline SPEC §9, cùng phong cách với phần đã có. Tự mở contact sheet và ảnh chụp ra xem, chấm theo SPEC §9.7 và §15.B, sửa tới khi đạt.
- Không rút gọn phạm vi MUST, không để TODO/stub, không báo "xong" cho thứ chưa chạy. Nếu bị chặn thật sự, ghi đúng sự thật vào docs/VERIFY.md và hoàn thành mọi phần còn lại.
- Làm việc trên nhánh hiện tại; không đẩy lên nhánh khác.

Kết thúc bằng báo cáo ngắn: đã làm gì, `npm run verify` cho kết quả gì, còn hạn chế gì.
```

## GOAL

```text
Hoàn thành khi TẤT CẢ đều đúng: (1) `npm run verify` thoát mã 0 và gồm đủ typecheck, unit test, cổng cân bằng và nhịp tiến trình ở SPEC §13.6, art lint + manifest, sinh audio, `cocos build --platform web-mobile`, e2e Playwright không lỗi console; (2) docs/shots/ có đủ danh sách ảnh ở SPEC §15.B và tôi đã tự mở từng ảnh, trả lời "có" cho cả 7 câu; (3) kịch bản chơi ở SPEC §15.C chạy qua: 12 đêm liên tục, thua rồi hồi phục, Trăng Máu, Viễn chinh, tải lại ở mọi pha, mô phỏng vắng mặt; (4) docs/VERIFY.md liệt kê từng mục của SPEC §15 A–D kèm bằng chứng, không mục MUST nào ở trạng thái chưa đạt mà thiếu lý do bị chặn cụ thể; (5) mọi thay đổi đã commit trên nhánh hiện tại. Chưa đủ thì tiếp tục làm, không dừng lại hỏi.
```

## Sau khi agent báo xong (kiểm tra nhanh của người)

1. `npm run verify` trên máy bạn.
2. Mở `docs/shots/night-defense.png` và `docs/shots/build-mode.png`, so với `docs/art/style-anchor.png`.
3. Serve `build/web-mobile/` rồi mở bằng điện thoại, chơi hết đêm 3.
4. Đọc `docs/VERIFY.md` và `docs/DECISIONS.md` để biết agent đã tự quyết những gì.
