-- Posts can carry an image, a video, or a bare link — each publishes
-- differently per channel:
--   image: FB /photos, IG image container (both already shipped)
--   video: FB /videos (file_url), IG REELS container (async — the publish
--          function polls the container until FINISHED)
--   link:  FB /feed with message+link. Instagram has NO link posts —
--          the publish function rejects IG on a link post.
-- image_url stays the image slot (also what image generation fills);
-- video/link get their own columns rather than overloading it.

alter table content_posts add column if not exists media_type text not null default 'image'
  check (media_type in ('image', 'video', 'link'));
alter table content_posts add column if not exists video_url text;
alter table content_posts add column if not exists link_url text;
