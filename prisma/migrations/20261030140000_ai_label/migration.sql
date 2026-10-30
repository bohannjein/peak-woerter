-- AI use is now shown once per word ("bearbeitet mit KI" on the word page)
-- instead of as a pronunciation label. The pronunciation itself stays.
UPDATE "pronunciation" SET "label" = NULL WHERE "label" = 'KI-Vorschlag';
