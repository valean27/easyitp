-- Ultima zi in care a rulat sarcina de dimineata ("daily"), ca ceasul aplicatiei si apelul de rezerva din GitHub
-- Actions sa nu o ruleze de doua ori in aceeasi zi
CREATE TABLE job_runs (
    name character varying(40) NOT NULL PRIMARY KEY,
    last_date date
);
