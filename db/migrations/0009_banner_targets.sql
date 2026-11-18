-- A banner can open a batch, test, lecture, study material or a website.
ALTER TABLE banners ADD COLUMN target_type TEXT;
ALTER TABLE banners ADD COLUMN target_id TEXT;
UPDATE banners SET target_type = 'batch', target_id = batch_id WHERE batch_id IS NOT NULL;
UPDATE banners SET target_type = 'link' WHERE batch_id IS NULL AND link_url IS NOT NULL;
