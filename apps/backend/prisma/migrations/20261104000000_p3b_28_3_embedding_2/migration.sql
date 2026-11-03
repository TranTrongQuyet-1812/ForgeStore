-- P3B-28.3 (D-33): cột vector riêng cho Gemini Embedding 2. Không trộn với vector_ngu_nghia (Embedding 1)
-- vì vector của hai mô hình không so sánh được với nhau. Cột để trống, lệnh `data-repo sinh-vector` điền sau.
ALTER TABLE "phan_tich_ai"
  ADD COLUMN IF NOT EXISTS "vector_ngu_nghia_v2" vector(768);

CREATE INDEX IF NOT EXISTS "idx_phan_tich_ai_vector_v2" ON "phan_tich_ai" USING hnsw (vector_ngu_nghia_v2 vector_cosine_ops);
