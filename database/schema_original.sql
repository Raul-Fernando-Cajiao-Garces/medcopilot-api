-- Esquema relacional MedCopilot (Versión Original sin campo dias)

DROP TABLE IF EXISTS consultations CASCADE;
DROP TABLE IF EXISTS clinical_knowledge CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;

CREATE TABLE doctors (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  specialty VARCHAR(100) NOT NULL,
  license_code VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE patients (
  id SERIAL PRIMARY KEY,
  document_id VARCHAR(30) UNIQUE NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  allergies TEXT NOT NULL DEFAULT 'Ninguna',
  metabolic_profile TEXT NOT NULL DEFAULT 'Sin antecedentes metabólicos'
);

CREATE TABLE consultations (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  symptoms TEXT NOT NULL,
  temperature NUMERIC(4,1) NOT NULL,
  pain_level INTEGER NOT NULL,
  proposed_indications TEXT NOT NULL DEFAULT '',
  triage_priority VARCHAR(20) NOT NULL,
  metabolic_alerts TEXT NOT NULL,
  rag_context TEXT NOT NULL,
  soap_draft TEXT NOT NULL,
  symptom_vector TEXT NOT NULL,
  doctor_notes TEXT NOT NULL DEFAULT '',
  validated_by_doctor BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE clinical_knowledge (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  category VARCHAR(80) NOT NULL,
  book_source VARCHAR(150) NOT NULL,
  content TEXT NOT NULL,
  embedding_vector TEXT NOT NULL
);
