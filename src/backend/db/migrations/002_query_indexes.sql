-- Інтеграція (лаб. №5): індекси під нові вибірки — «мої броні» (ФВ-06–ФВ-08),
-- історія за період (ФВ-11) і статистика (ФВ-12). Розклад на день/тиждень (ФВ-02, ФВ-03)
-- та перевірка накладення (ФВ-18) уже обслуговуються GiST-індексом обмеження EXCLUDE.
CREATE INDEX bookings_author_start_idx ON bookings (author_id, start_time);
CREATE INDEX bookings_start_idx ON bookings (start_time);
