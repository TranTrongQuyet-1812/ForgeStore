-- AlterTable
ALTER TABLE "phan_tich_ai" 
  ADD COLUMN IF NOT EXISTS "huong_dan_cai_dat" JSONB;

-- Bảo vệ chỉ mục pgvector cosine (D-16)
CREATE INDEX IF NOT EXISTS "idx_phan_tich_ai_vector" ON "phan_tich_ai" USING hnsw (vector_ngu_nghia vector_cosine_ops);
