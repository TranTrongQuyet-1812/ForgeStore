# ForgeStore: Worker dịch (Cloudflare Workers AI)

Worker nhỏ dịch các đoạn Markdown sang **tiếng Việt** bằng một mô hình trò chuyện của Cloudflare Workers AI
(mặc định `@cf/aisingapore/gemma-sea-lion-v4-27b-it`). Backend ForgeStore gọi Worker này như một trong các nhà dịch (quyết định D-24).

- **Không có CORS**, chỉ nhận yêu cầu từ máy chủ có khóa bí mật.
- **Không chứa khóa API nào.** Dùng kết nối Workers AI của chính tài khoản Cloudflare.
- Chạy được trên gói **Workers Free** (Workers AI miễn phí 10.000 neuron mỗi ngày, tính chung cả tài khoản).
- **Không dùng mô hình chuyên dịch** như `m2m100`: đã thử, nó làm mất ký hiệu giữ chỗ, tiêu đề, bảng và khối code.

## Quy tắc an toàn: không bao giờ trả bản gốc giả làm bản dịch

Mỗi đoạn trả về một trong hai kết quả:

- **Chuỗi đã dịch**, đã qua kiểm tra cấu trúc.
- **`null`** kèm lý do trong `reasons`, để backend giữ bản gốc, ghi nhận lỗi và chuyển sang nhà dịch khác.

| `reasons`              | Ý nghĩa                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `ai_error`             | Gọi Workers AI bị lỗi (hết lượt, quá tải, mô hình không tồn tại) |
| `timeout`              | Mô hình trả lời quá lâu (mặc định 50 giây), bỏ qua đoạn đó       |
| `empty_output`         | Mô hình trả về rỗng (hoặc chỉ có phần "suy nghĩ")                |
| `placeholders_changed` | Số ký hiệu giữ chỗ `[C1]`, `⟦C1⟧` sau dịch khác trước dịch       |
| `headings_changed`     | Số tiêu đề (`#`, `##`…) bị đổi, ví dụ tiêu đề dính vào câu sau   |
| `table_changed`        | Số dòng bảng Markdown bị đổi                                     |

## Triển khai bằng giao diện Cloudflare

1. **Workers & Pages** → mở Worker `forgestore-translate` → **Edit code** → dán toàn bộ `worker.js` → **Deploy**.
2. **Settings** → **Bindings**: có binding **Workers AI** tên `AI`.
3. **Settings** → **Variables and Secrets**:
   - Secret `TRANSLATE_SECRET` (chuỗi ngẫu nhiên dài, giống `CLOUDFLARE_TRANSLATE_SECRET` trong `.env` của backend).
   - _(Tùy chọn)_ Text `TRANSLATE_MODEL` để đổi mô hình, `TRANSLATE_DISABLE_THINKING = 1` nếu kết quả rỗng, `TRANSLATE_TIMEOUT_MS` để đổi thời hạn chờ mỗi đoạn.

Hoặc bằng dòng lệnh: `npx wrangler login`, `npx wrangler secret put TRANSLATE_SECRET`, `npx wrangler deploy`.

Trong `apps/backend/.env` (không được commit):

```
CLOUDFLARE_TRANSLATE_URL="https://forgestore-translate.<tên-tài-khoản>.workers.dev"
CLOUDFLARE_TRANSLATE_SECRET="<cùng giá trị đã đặt>"
```

## Gọi thử

```bash
curl -X POST "$CLOUDFLARE_TRANSLATE_URL/translate" \
  -H "Content-Type: application/json" \
  -H "X-ForgeStore-Secret: $CLOUDFLARE_TRANSLATE_SECRET" \
  -d '{"texts":["## Quick Start\n\nRestart [C1] now."]}'
```

Kết quả: `{"provider":"cloudflare-workers-ai","model":"...","translations":["..."],"reasons":[null],"failed":0}`.
Gửi `{"text":"..."}` (một đoạn) thì có thêm trường `translation`.

## Giới hạn

| Hạng mục               | Giá trị                                                 |
| ---------------------- | ------------------------------------------------------- |
| Số đoạn mỗi yêu cầu    | tối đa 20 (gói free chỉ cho 50 lời gọi con mỗi yêu cầu) |
| Độ dài mỗi đoạn        | tối đa 5.000 ký tự                                      |
| Tổng ký tự mỗi yêu cầu | tối đa 40.000                                           |
| Ngôn ngữ đích          | chỉ tiếng Việt                                          |

Backend chịu trách nhiệm che khối code và link (`[Cn]`) rồi ghép lại, và chia README thành các đoạn trong giới hạn trên,
tốt nhất theo từng mục tiêu đề `##`.

## Kiểm thử

```bash
node --test infra/cloudflare-translate-worker/worker.test.mjs
```

Test dùng AI giả lập, không gọi Cloudflare thật và không tốn hạn mức.

## Lưu ý

- Chất lượng và khả năng giữ cấu trúc của từng mô hình cần **thử trên README thật** (xem `TestModelAI`) trước khi dùng thật.
- Worker UniMap360 cũ là một dự án riêng. Đừng dùng lại khóa Gemini hay OpenRouter của nó cho ForgeStore.
