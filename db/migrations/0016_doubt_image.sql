-- Students used to have to paste a Google Drive file ID to attach a photo to
-- a doubt -- nobody could actually do that from a phone. This lets them pick
-- a photo with a normal file input instead; the shrunk JPEG is stored right
-- on the row, the same way payments.screenshot_b64 already works.
ALTER TABLE doubts ADD COLUMN image_b64 TEXT;
