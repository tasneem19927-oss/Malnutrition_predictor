-- ============================================================
-- Nizam Child Malnutrition Prediction System
-- Database Schema (PostgreSQL)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CHILDREN TABLE
-- Stores child demographic and physical measurements
-- ============================================================
CREATE TABLE IF NOT EXISTS children (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id     VARCHAR(100) UNIQUE,
    name            VARCHAR(200) NOT NULL,
    date_of_birth   DATE,
    age_months      INTEGER NOT NULL CHECK (age_months >= 0 AND age_months <= 60),
    sex             VARCHAR(10) NOT NULL CHECK (sex IN ('male', 'female')),
    region          VARCHAR(200),
    district        VARCHAR(200),
    village         VARCHAR(200),
    guardian_name   VARCHAR(200),
    guardian_phone  VARCHAR(20),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- MEASUREMENTS TABLE
-- Physical measurements taken at each assessment
-- ============================================================
CREATE TABLE IF NOT EXISTS measurements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id        UUID REFERENCES children(id) ON DELETE CASCADE,
    measured_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    weight_kg       DECIMAL(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 50),
    height_cm       DECIMAL(5,1) NOT NULL CHECK (height_cm > 20 AND height_cm < 150),
    muac_cm         DECIMAL(4,1) NOT NULL CHECK (muac_cm > 5 AND muac_cm < 35),
    oedema          BOOLEAN DEFAULT FALSE,
    measured_by     VARCHAR(200),
    facility        VARCHAR(200),
    notes           TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- PREDICTIONS TABLE
-- ML model predictions and risk classifications
-- ============================================================
CREATE TABLE IF NOT EXISTS predictions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id            UUID REFERENCES children(id) ON DELETE SET NULL,
    measurement_id      UUID REFERENCES measurements(id) ON DELETE SET NULL,
    model_version       VARCHAR(50) DEFAULT '1.0.0',
    -- Input features used for prediction
    age_months          INTEGER NOT NULL,
    sex                 VARCHAR(10) NOT NULL,
    weight_kg           DECIMAL(5,2) NOT NULL,
    height_cm           DECIMAL(5,1) NOT NULL,
    muac_cm             DECIMAL(4,1) NOT NULL,
    -- Derived anthropometric indices
    weight_for_age_zscore   DECIMAL(6,3),
    height_for_age_zscore   DECIMAL(6,3),
    weight_for_height_zscore DECIMAL(6,3),
    muac_for_age_zscore     DECIMAL(6,3),
    -- Stunting predictions (chronic malnutrition: HAZ < -2)
    stunting_risk       VARCHAR(20) NOT NULL CHECK (stunting_risk IN ('low', 'moderate', 'high', 'critical')),
    stunting_probability DECIMAL(5,4) NOT NULL,
    -- Wasting predictions (acute malnutrition: WHZ < -2)
    wasting_risk        VARCHAR(20) NOT NULL CHECK (wasting_risk IN ('low', 'moderate', 'high', 'critical')),
    wasting_probability DECIMAL(5,4) NOT NULL,
    -- Underweight predictions (WAZ < -2)
    underweight_risk    VARCHAR(20) NOT NULL CHECK (underweight_risk IN ('low', 'moderate', 'high', 'critical')),
    underweight_probability DECIMAL(5,4) NOT NULL,
    -- Overall risk aggregation
    overall_risk        VARCHAR(20) NOT NULL CHECK (overall_risk IN ('low', 'moderate', 'high', 'critical')),
    -- Metadata
    predicted_by        VARCHAR(200),
    facility            VARCHAR(200),
    notes               TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- MODELS TABLE
-- Tracks trained model versions and performance metrics
-- ============================================================
CREATE TABLE IF NOT EXISTS models (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version         VARCHAR(50) NOT NULL UNIQUE,
    model_type      VARCHAR(50) DEFAULT 'xgboost',
    target          VARCHAR(50) NOT NULL CHECK (target IN ('stunting', 'wasting', 'underweight')),
    accuracy        DECIMAL(5,4),
    precision_score DECIMAL(5,4),
    recall          DECIMAL(5,4),
    f1_score        DECIMAL(5,4),
    auc_roc         DECIMAL(5,4),
    training_samples INTEGER,
    features        JSONB,
    hyperparameters JSONB,
    file_path       VARCHAR(500),
    is_active       BOOLEAN DEFAULT FALSE,
    trained_at      TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- INTERVENTIONS TABLE
-- Recommended actions based on predictions
-- ============================================================
CREATE TABLE IF NOT EXISTS interventions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id   UUID REFERENCES predictions(id) ON DELETE CASCADE,
    child_id        UUID REFERENCES children(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    description     TEXT NOT NULL,
    priority        VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    assigned_to     VARCHAR(200),
    due_date        DATE,
    completed_at    TIMESTAMP WITH TIME ZONE,
    notes           TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- FACILITIES TABLE
-- Health facilities using the system
-- ============================================================
CREATE TABLE IF NOT EXISTS facilities (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(200) NOT NULL,
    type        VARCHAR(50) CHECK (type IN ('hospital', 'health_center', 'clinic', 'community')),
    region      VARCHAR(200),
    district    VARCHAR(200),
    latitude    DECIMAL(10,7),
    longitude   DECIMAL(10,7),
    contact     VARCHAR(200),
    active      BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_children_region ON children(region);
CREATE INDEX IF NOT EXISTS idx_children_age ON children(age_months);
CREATE INDEX IF NOT EXISTS idx_measurements_child ON measurements(child_id);
CREATE INDEX IF NOT EXISTS idx_measurements_date ON measurements(measured_at);
CREATE INDEX IF NOT EXISTS idx_predictions_child ON predictions(child_id);
CREATE INDEX IF NOT EXISTS idx_predictions_risk ON predictions(overall_risk);
CREATE INDEX IF NOT EXISTS idx_predictions_date ON predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_interventions_status ON interventions(status);
CREATE INDEX IF NOT EXISTS idx_interventions_priority ON interventions(priority);

-- ============================================================
-- VIEWS for reporting
-- ============================================================
CREATE OR REPLACE VIEW v_prediction_summary AS
SELECT
    p.id,
    c.name AS child_name,
    c.age_months,
    c.sex,
    c.region,
    m.weight_kg,
    m.height_cm,
    m.muac_cm,
    p.stunting_risk,
    p.stunting_probability,
    p.wasting_risk,
    p.wasting_probability,
    p.underweight_risk,
    p.underweight_probability,
    p.overall_risk,
    p.created_at AS assessed_at
FROM predictions p
LEFT JOIN children c ON p.child_id = c.id
LEFT JOIN measurements m ON p.measurement_id = m.id;

CREATE OR REPLACE VIEW v_risk_statistics AS
SELECT
    overall_risk,
    COUNT(*) AS count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS percentage
FROM predictions
GROUP BY overall_risk;

-- ============================================================
-- SAMPLE SEED DATA
-- ============================================================
INSERT INTO facilities (name, type, region, district) VALUES
    ('Mulago National Referral Hospital', 'hospital', 'Central', 'Kampala'),
    ('Kawempe Health Centre IV', 'health_center', 'Central', 'Kampala'),
    ('Gulu Regional Referral Hospital', 'hospital', 'Northern', 'Gulu'),
    ('Mbale Regional Referral Hospital', 'hospital', 'Eastern', 'Mbale'),
    ('Mbarara Regional Referral Hospital', 'hospital', 'Western', 'Mbarara')
ON CONFLICT DO NOTHING;

-- ============================================================
-- End of Schema
-- ============================================================
