-- Each batch can have its own banner image (an https image link set by the admin).
ALTER TABLE batches ADD COLUMN banner_url TEXT;
