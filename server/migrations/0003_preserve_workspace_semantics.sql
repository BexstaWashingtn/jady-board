ALTER TABLE boards
  ADD COLUMN path text NOT NULL DEFAULT '';

ALTER TABLE stages
  ADD COLUMN transitions_restricted boolean NOT NULL DEFAULT false;
