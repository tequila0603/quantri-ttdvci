--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4
-- Dumped by pg_dump version 16.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: audit; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA audit;


--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: coordination; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA coordination;


--
-- Name: core; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA core;


--
-- Name: environmental; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA environmental;


--
-- Name: finance; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA finance;


--
-- Name: infrastructure; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA infrastructure;


--
-- Name: ingest; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA ingest;


--
-- Name: maintenance; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA maintenance;


--
-- Name: monitoring; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA monitoring;


--
-- Name: workforce; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA workforce;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: events; Type: TABLE; Schema: audit; Owner: -
--

CREATE TABLE audit.events (
    id bigint NOT NULL,
    actor_user_id bigint,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id bigint,
    source text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: events_id_seq; Type: SEQUENCE; Schema: audit; Owner: -
--

ALTER TABLE audit.events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME audit.events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: roles; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.roles (
    code text NOT NULL,
    display_name text NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME auth.sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_accounts; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.user_accounts (
    id bigint NOT NULL,
    username text NOT NULL,
    display_name text NOT NULL,
    role_code text NOT NULL,
    password_hash text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_accounts_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

ALTER TABLE auth.user_accounts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME auth.user_accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: task_history; Type: TABLE; Schema: coordination; Owner: -
--

CREATE TABLE coordination.task_history (
    id bigint NOT NULL,
    task_id bigint NOT NULL,
    from_status text,
    to_status text NOT NULL,
    progress_percent integer DEFAULT 0 NOT NULL,
    changed_by_user_id bigint,
    change_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_history_id_seq; Type: SEQUENCE; Schema: coordination; Owner: -
--

ALTER TABLE coordination.task_history ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME coordination.task_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tasks; Type: TABLE; Schema: coordination; Owner: -
--

CREATE TABLE coordination.tasks (
    id bigint NOT NULL,
    task_code text NOT NULL,
    title text NOT NULL,
    task_category text NOT NULL,
    requesting_agency text NOT NULL,
    assigned_employee_id bigint,
    coordinator_name text,
    assigned_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date,
    priority text DEFAULT 'NORMAL'::text NOT NULL,
    status text DEFAULT 'NOT_STARTED'::text NOT NULL,
    progress_percent integer DEFAULT 0 NOT NULL,
    completion_evidence text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tasks_priority_check CHECK ((priority = ANY (ARRAY['LOW'::text, 'NORMAL'::text, 'HIGH'::text, 'URGENT'::text]))),
    CONSTRAINT tasks_progress_percent_check CHECK (((progress_percent >= 0) AND (progress_percent <= 100))),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['NOT_STARTED'::text, 'IN_PROGRESS'::text, 'COMPLETED'::text, 'PAUSED'::text, 'CANCELLED'::text, 'REOPENED'::text]))),
    CONSTRAINT tasks_task_category_check CHECK ((task_category = ANY (ARRAY['FIRE_SAFETY'::text, 'DISASTER_PREVENTION'::text, 'OCCUPATIONAL_SAFETY'::text, 'PUBLIC_SERVICE'::text, 'ENVIRONMENTAL_INSPECTION'::text, 'OTHER'::text])))
);


--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: coordination; Owner: -
--

ALTER TABLE coordination.tasks ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME coordination.tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: enterprises; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.enterprises (
    id bigint NOT NULL,
    legal_name text NOT NULL,
    normalized_name text NOT NULL,
    tax_code text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: enterprises_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.enterprises ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.enterprises_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: industrial_parks; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.industrial_parks (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: industrial_parks_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.industrial_parks ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.industrial_parks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: organizational_units; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.organizational_units (
    id bigint NOT NULL,
    name text NOT NULL,
    parent_id bigint,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: organizational_units_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

ALTER TABLE core.organizational_units ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME core.organizational_units_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: report_sequences; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.report_sequences (
    year character varying(4) NOT NULL,
    last_seq integer DEFAULT 0 NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.schema_migrations (
    id integer NOT NULL,
    filename character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT now()
);


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.schema_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.schema_migrations_id_seq OWNED BY core.schema_migrations.id;


--
-- Name: pdf_documents; Type: TABLE; Schema: environmental; Owner: -
--

CREATE TABLE environmental.pdf_documents (
    id bigint NOT NULL,
    file_name text NOT NULL,
    sha256 text NOT NULL,
    enterprise_name text NOT NULL,
    park_name text NOT NULL,
    reporting_period text NOT NULL,
    extracted_wastewater_m3 numeric(18,2),
    extracted_waste_kg numeric(18,2),
    confidence_score numeric(4,2) DEFAULT 0.85 NOT NULL,
    is_scanned boolean DEFAULT false NOT NULL,
    status text DEFAULT 'PENDING_REVIEW'::text NOT NULL,
    page_reference text,
    notes text,
    verified_by_user_id bigint,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pdf_documents_confidence_score_check CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric))),
    CONSTRAINT pdf_documents_status_check CHECK ((status = ANY (ARRAY['PENDING_REVIEW'::text, 'CONFIRMED'::text, 'REJECTED'::text])))
);


--
-- Name: pdf_documents_id_seq; Type: SEQUENCE; Schema: environmental; Owner: -
--

ALTER TABLE environmental.pdf_documents ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME environmental.pdf_documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: waste_records; Type: TABLE; Schema: environmental; Owner: -
--

CREATE TABLE environmental.waste_records (
    id bigint NOT NULL,
    enterprise_id bigint NOT NULL,
    industrial_park_id bigint NOT NULL,
    reporting_year integer NOT NULL,
    reporting_quarter integer,
    wastewater_m3 numeric(18,2) DEFAULT 0 NOT NULL,
    solid_waste_kg numeric(18,2) DEFAULT 0 NOT NULL,
    raw_wastewater_value numeric(18,2),
    raw_wastewater_unit text DEFAULT 'm3'::text NOT NULL,
    raw_waste_value numeric(18,2),
    raw_waste_unit text DEFAULT 'kg'::text NOT NULL,
    source_type text DEFAULT 'PDF_REPORT'::text NOT NULL,
    status text DEFAULT 'CONFIRMED'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT waste_records_reporting_quarter_check CHECK (((reporting_quarter >= 1) AND (reporting_quarter <= 4))),
    CONSTRAINT waste_records_solid_waste_kg_check CHECK ((solid_waste_kg >= (0)::numeric)),
    CONSTRAINT waste_records_source_type_check CHECK ((source_type = ANY (ARRAY['PDF_REPORT'::text, 'DIRECT_ENTRY'::text, 'INSPECTION'::text]))),
    CONSTRAINT waste_records_status_check CHECK ((status = ANY (ARRAY['CONFIRMED'::text, 'UNCONFIRMED'::text, 'PENDING_REVIEW'::text]))),
    CONSTRAINT waste_records_wastewater_m3_check CHECK ((wastewater_m3 >= (0)::numeric))
);


--
-- Name: waste_records_id_seq; Type: SEQUENCE; Schema: environmental; Owner: -
--

ALTER TABLE environmental.waste_records ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME environmental.waste_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: annual_charges; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE finance.annual_charges (
    id bigint NOT NULL,
    snapshot_id bigint NOT NULL,
    category_code text NOT NULL,
    amount_due numeric(18,2) NOT NULL,
    currency_code text DEFAULT 'VND'::text NOT NULL,
    CONSTRAINT annual_charges_amount_due_check CHECK ((amount_due >= (0)::numeric))
);


--
-- Name: annual_charges_id_seq; Type: SEQUENCE; Schema: finance; Owner: -
--

ALTER TABLE finance.annual_charges ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finance.annual_charges_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: annual_lease_snapshots; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE finance.annual_lease_snapshots (
    id bigint NOT NULL,
    enterprise_id bigint NOT NULL,
    industrial_park_id bigint NOT NULL,
    reporting_year integer NOT NULL,
    lot_location text NOT NULL,
    land_area_m2 numeric(18,4) NOT NULL,
    lease_status text,
    source_total_amount numeric(18,2),
    source_total_basis text DEFAULT 'SOURCE_WORKBOOK_FORMULA'::text NOT NULL,
    source_file text NOT NULL,
    source_sheet text NOT NULL,
    source_row integer NOT NULL,
    source_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT annual_lease_snapshots_land_area_m2_check CHECK ((land_area_m2 >= (0)::numeric)),
    CONSTRAINT annual_lease_snapshots_reporting_year_check CHECK (((reporting_year >= 2000) AND (reporting_year <= 2200))),
    CONSTRAINT annual_lease_snapshots_source_total_amount_check CHECK ((source_total_amount >= (0)::numeric))
);


--
-- Name: annual_lease_snapshots_id_seq; Type: SEQUENCE; Schema: finance; Owner: -
--

ALTER TABLE finance.annual_lease_snapshots ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finance.annual_lease_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: financial_adjustments; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE finance.financial_adjustments (
    id bigint NOT NULL,
    invoice_line_id bigint NOT NULL,
    adjustment_type text NOT NULL,
    amount numeric(18,2) NOT NULL,
    reason text NOT NULL,
    source_file text,
    source_row integer,
    created_by_user_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financial_adjustments_adjustment_type_check CHECK ((adjustment_type = ANY (ARRAY['REDUCTION'::text, 'REVERSAL'::text, 'CORRECTION'::text]))),
    CONSTRAINT financial_adjustments_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: financial_adjustments_id_seq; Type: SEQUENCE; Schema: finance; Owner: -
--

ALTER TABLE finance.financial_adjustments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finance.financial_adjustments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invoice_lines; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE finance.invoice_lines (
    id bigint NOT NULL,
    invoice_id bigint NOT NULL,
    category_code text NOT NULL,
    description text,
    amount numeric(18,2) NOT NULL,
    CONSTRAINT invoice_lines_amount_check CHECK ((amount >= (0)::numeric))
);


--
-- Name: invoices; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE finance.invoices (
    id bigint NOT NULL,
    enterprise_id bigint NOT NULL,
    invoice_number text NOT NULL,
    invoice_series text,
    issued_on date,
    due_on date,
    status text DEFAULT 'VALID'::text NOT NULL,
    total_amount numeric(18,2) NOT NULL,
    source_file text,
    source_row integer,
    source_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoices_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'VALID'::text, 'VOID'::text, 'CANCELLED'::text]))),
    CONSTRAINT invoices_total_amount_check CHECK ((total_amount >= (0)::numeric))
);


--
-- Name: payment_allocations; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE finance.payment_allocations (
    payment_id bigint NOT NULL,
    invoice_line_id bigint NOT NULL,
    amount numeric(18,2) NOT NULL,
    CONSTRAINT payment_allocations_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: invoice_line_balances; Type: VIEW; Schema: finance; Owner: -
--

CREATE VIEW finance.invoice_line_balances AS
 SELECT il.id AS invoice_line_id,
    i.id AS invoice_id,
    i.enterprise_id,
    il.category_code,
    il.amount AS amount_due,
    (COALESCE(pa.paid_amount, (0)::numeric))::numeric(18,2) AS amount_paid,
    (COALESCE(fa.adjusted_amount, (0)::numeric))::numeric(18,2) AS amount_adjusted,
    (GREATEST(((il.amount - COALESCE(pa.paid_amount, (0)::numeric)) - COALESCE(fa.adjusted_amount, (0)::numeric)), (0)::numeric))::numeric(18,2) AS amount_outstanding
   FROM (((finance.invoice_lines il
     JOIN finance.invoices i ON ((i.id = il.invoice_id)))
     LEFT JOIN ( SELECT payment_allocations.invoice_line_id,
            sum(payment_allocations.amount) AS paid_amount
           FROM finance.payment_allocations
          GROUP BY payment_allocations.invoice_line_id) pa ON ((pa.invoice_line_id = il.id)))
     LEFT JOIN ( SELECT financial_adjustments.invoice_line_id,
            sum(financial_adjustments.amount) AS adjusted_amount
           FROM finance.financial_adjustments
          GROUP BY financial_adjustments.invoice_line_id) fa ON ((fa.invoice_line_id = il.id)));


--
-- Name: invoice_lines_id_seq; Type: SEQUENCE; Schema: finance; Owner: -
--

ALTER TABLE finance.invoice_lines ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finance.invoice_lines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: finance; Owner: -
--

ALTER TABLE finance.invoices ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finance.invoices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: payments; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE finance.payments (
    id bigint NOT NULL,
    enterprise_id bigint NOT NULL,
    paid_on date NOT NULL,
    amount numeric(18,2) NOT NULL,
    payment_reference text,
    source_file text,
    source_row integer,
    source_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: finance; Owner: -
--

ALTER TABLE finance.payments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finance.payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: service_categories; Type: TABLE; Schema: finance; Owner: -
--

CREATE TABLE finance.service_categories (
    code text NOT NULL,
    display_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: asset_categories; Type: TABLE; Schema: infrastructure; Owner: -
--

CREATE TABLE infrastructure.asset_categories (
    code text NOT NULL,
    display_name text NOT NULL,
    icon_name text,
    description text
);


--
-- Name: assets; Type: TABLE; Schema: infrastructure; Owner: -
--

CREATE TABLE infrastructure.assets (
    id bigint NOT NULL,
    asset_code text NOT NULL,
    asset_name text NOT NULL,
    category_code text NOT NULL,
    industrial_park_id bigint NOT NULL,
    location_desc text NOT NULL,
    managing_unit text DEFAULT 'T??? Qu???n l?? V???n h??nh H??? t???ng'::text NOT NULL,
    commissioning_year integer,
    status text DEFAULT 'OPERATIONAL'::text NOT NULL,
    specs jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT assets_status_check CHECK ((status = ANY (ARRAY['OPERATIONAL'::text, 'DEGRADED'::text, 'UNDER_MAINTENANCE'::text, 'OUT_OF_SERVICE'::text])))
);


--
-- Name: assets_id_seq; Type: SEQUENCE; Schema: infrastructure; Owner: -
--

ALTER TABLE infrastructure.assets ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME infrastructure.assets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: handovers; Type: TABLE; Schema: infrastructure; Owner: -
--

CREATE TABLE infrastructure.handovers (
    id bigint NOT NULL,
    asset_id bigint NOT NULL,
    handover_code text NOT NULL,
    handover_date date NOT NULL,
    deliverer text NOT NULL,
    receiver text NOT NULL,
    condition_summary text NOT NULL,
    document_ref text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: handovers_id_seq; Type: SEQUENCE; Schema: infrastructure; Owner: -
--

ALTER TABLE infrastructure.handovers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME infrastructure.handovers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: projects; Type: TABLE; Schema: infrastructure; Owner: -
--

CREATE TABLE infrastructure.projects (
    id bigint NOT NULL,
    project_code text NOT NULL,
    project_name text NOT NULL,
    industrial_park_id bigint NOT NULL,
    project_type text NOT NULL,
    estimated_budget numeric(18,2) DEFAULT 0 NOT NULL,
    actual_cost numeric(18,2) DEFAULT 0 NOT NULL,
    current_milestone text NOT NULL,
    status text DEFAULT 'PLANNING'::text NOT NULL,
    start_date date,
    completion_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT projects_project_type_check CHECK ((project_type = ANY (ARRAY['NEW_BUILD'::text, 'UPGRADE'::text, 'REPAIR'::text, 'EMERGENCY'::text]))),
    CONSTRAINT projects_status_check CHECK ((status = ANY (ARRAY['PLANNING'::text, 'IN_PROGRESS'::text, 'COMPLETED'::text, 'ON_HOLD'::text])))
);


--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: infrastructure; Owner: -
--

ALTER TABLE infrastructure.projects ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME infrastructure.projects_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: import_batches; Type: TABLE; Schema: ingest; Owner: -
--

CREATE TABLE ingest.import_batches (
    id bigint NOT NULL,
    source_file text NOT NULL,
    source_sha256 text NOT NULL,
    import_kind text NOT NULL,
    status text NOT NULL,
    imported_by_user_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reporting_period text,
    total_rows integer,
    accepted_rows integer,
    rejected_rows integer,
    duplicate_rows integer,
    total_amount numeric(20,2),
    confirmed_at timestamp with time zone,
    CONSTRAINT import_batches_status_check CHECK ((status = ANY (ARRAY['STAGED'::text, 'VALIDATED'::text, 'COMMITTED'::text, 'REJECTED'::text])))
);


--
-- Name: import_batches_id_seq; Type: SEQUENCE; Schema: ingest; Owner: -
--

ALTER TABLE ingest.import_batches ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME ingest.import_batches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: import_rows; Type: TABLE; Schema: ingest; Owner: -
--

CREATE TABLE ingest.import_rows (
    id bigint NOT NULL,
    batch_id bigint NOT NULL,
    source_sheet text,
    source_row integer,
    status text NOT NULL,
    error_message text,
    raw_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    error_code text,
    error_field text,
    CONSTRAINT import_rows_status_check CHECK ((status = ANY (ARRAY['VALID'::text, 'WARNING'::text, 'ERROR'::text])))
);


--
-- Name: import_rows_id_seq; Type: SEQUENCE; Schema: ingest; Owner: -
--

ALTER TABLE ingest.import_rows ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME ingest.import_rows_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: field_reports; Type: TABLE; Schema: maintenance; Owner: -
--

CREATE TABLE maintenance.field_reports (
    id bigint NOT NULL,
    report_code text NOT NULL,
    source text DEFAULT 'ZALO_WEB'::text NOT NULL,
    source_message_key text,
    source_fingerprint text NOT NULL,
    raw_reporter_name text,
    reporter_name text DEFAULT 'Ch?a x?c ??nh'::text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    industrial_park_id bigint NOT NULL,
    location_detail text NOT NULL,
    category text DEFAULT 'PENDING_CLASSIFICATION'::text NOT NULL,
    severity text DEFAULT 'MEDIUM'::text NOT NULL,
    status text DEFAULT 'NEW'::text NOT NULL,
    reported_at timestamp with time zone DEFAULT now() NOT NULL,
    linked_incident_id bigint,
    linked_work_order_id bigint,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT field_reports_category_check CHECK ((category = ANY (ARRAY['INCIDENT'::text, 'INSPECTION'::text, 'OPERATIONS'::text, 'PROGRESS'::text, 'ENTERPRISE_ACTIVITY'::text, 'NOTICE'::text, 'PENDING_CLASSIFICATION'::text]))),
    CONSTRAINT field_reports_severity_check CHECK ((severity = ANY (ARRAY['LOW'::text, 'MEDIUM'::text, 'HIGH'::text, 'CRITICAL'::text]))),
    CONSTRAINT field_reports_status_check CHECK ((status = ANY (ARRAY['NEW'::text, 'REVIEWED'::text, 'CONVERTED'::text, 'ARCHIVED'::text])))
);


--
-- Name: field_reports_id_seq; Type: SEQUENCE; Schema: maintenance; Owner: -
--

ALTER TABLE maintenance.field_reports ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maintenance.field_reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: incidents; Type: TABLE; Schema: maintenance; Owner: -
--

CREATE TABLE maintenance.incidents (
    id bigint NOT NULL,
    asset_id bigint,
    incident_code text NOT NULL,
    title text NOT NULL,
    severity text DEFAULT 'MEDIUM'::text NOT NULL,
    industrial_park_id bigint NOT NULL,
    location_detail text NOT NULL,
    reported_at timestamp with time zone DEFAULT now() NOT NULL,
    target_resolution_at timestamp with time zone,
    resolved_at timestamp with time zone,
    current_status text DEFAULT 'OPEN'::text NOT NULL,
    assigned_to text,
    root_cause text,
    mitigation_actions text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT incidents_current_status_check CHECK ((current_status = ANY (ARRAY['OPEN'::text, 'INVESTIGATING'::text, 'IN_PROGRESS'::text, 'RESOLVED'::text, 'CLOSED'::text]))),
    CONSTRAINT incidents_severity_check CHECK ((severity = ANY (ARRAY['LOW'::text, 'MEDIUM'::text, 'HIGH'::text, 'CRITICAL'::text])))
);


--
-- Name: incidents_id_seq; Type: SEQUENCE; Schema: maintenance; Owner: -
--

ALTER TABLE maintenance.incidents ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maintenance.incidents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: inspections; Type: TABLE; Schema: maintenance; Owner: -
--

CREATE TABLE maintenance.inspections (
    id bigint NOT NULL,
    asset_id bigint NOT NULL,
    inspection_code text NOT NULL,
    inspected_at timestamp with time zone NOT NULL,
    inspector_name text NOT NULL,
    condition_rating text NOT NULL,
    defects_found text,
    recommendations text,
    evidence_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inspections_condition_rating_check CHECK ((condition_rating = ANY (ARRAY['GOOD'::text, 'FAIR'::text, 'POOR'::text, 'CRITICAL'::text])))
);


--
-- Name: inspections_id_seq; Type: SEQUENCE; Schema: maintenance; Owner: -
--

ALTER TABLE maintenance.inspections ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maintenance.inspections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: work_orders; Type: TABLE; Schema: maintenance; Owner: -
--

CREATE TABLE maintenance.work_orders (
    id bigint NOT NULL,
    incident_id bigint,
    asset_id bigint NOT NULL,
    order_code text NOT NULL,
    title text NOT NULL,
    order_type text NOT NULL,
    priority text DEFAULT 'NORMAL'::text NOT NULL,
    assigned_to text NOT NULL,
    scheduled_start date NOT NULL,
    scheduled_end date NOT NULL,
    completed_at timestamp with time zone,
    actual_cost numeric(18,2) DEFAULT 0 NOT NULL,
    completion_evidence text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT work_orders_order_type_check CHECK ((order_type = ANY (ARRAY['ROUTINE'::text, 'CORRECTIVE'::text, 'EMERGENCY'::text, 'UPGRADE'::text]))),
    CONSTRAINT work_orders_priority_check CHECK ((priority = ANY (ARRAY['LOW'::text, 'NORMAL'::text, 'HIGH'::text, 'URGENT'::text]))),
    CONSTRAINT work_orders_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'IN_PROGRESS'::text, 'COMPLETED'::text, 'CANCELLED'::text])))
);


--
-- Name: work_orders_id_seq; Type: SEQUENCE; Schema: maintenance; Owner: -
--

ALTER TABLE maintenance.work_orders ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME maintenance.work_orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: corrections; Type: TABLE; Schema: monitoring; Owner: -
--

CREATE TABLE monitoring.corrections (
    id bigint NOT NULL,
    observation_id bigint NOT NULL,
    corrected_value numeric(18,6),
    reason text NOT NULL,
    created_by_user_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: corrections_id_seq; Type: SEQUENCE; Schema: monitoring; Owner: -
--

ALTER TABLE monitoring.corrections ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME monitoring.corrections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: devices; Type: TABLE; Schema: monitoring; Owner: -
--

CREATE TABLE monitoring.devices (
    id bigint NOT NULL,
    station_id bigint NOT NULL,
    external_code text NOT NULL,
    display_name text,
    provider text DEFAULT 'PREMIER'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: devices_id_seq; Type: SEQUENCE; Schema: monitoring; Owner: -
--

ALTER TABLE monitoring.devices ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME monitoring.devices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: observations; Type: TABLE; Schema: monitoring; Owner: -
--

CREATE TABLE monitoring.observations (
    id bigint NOT NULL,
    device_id bigint NOT NULL,
    parameter_id bigint NOT NULL,
    measured_at timestamp with time zone NOT NULL,
    value numeric(18,6),
    quality_code text,
    provider_record_key text,
    raw_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: observations_id_seq; Type: SEQUENCE; Schema: monitoring; Owner: -
--

ALTER TABLE monitoring.observations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME monitoring.observations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: parameters; Type: TABLE; Schema: monitoring; Owner: -
--

CREATE TABLE monitoring.parameters (
    id bigint NOT NULL,
    code text NOT NULL,
    display_name text NOT NULL,
    unit text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: parameters_id_seq; Type: SEQUENCE; Schema: monitoring; Owner: -
--

ALTER TABLE monitoring.parameters ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME monitoring.parameters_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: provider_raw_payloads; Type: TABLE; Schema: monitoring; Owner: -
--

CREATE TABLE monitoring.provider_raw_payloads (
    id bigint NOT NULL,
    sync_run_id bigint NOT NULL,
    payload_hash text NOT NULL,
    payload jsonb NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: provider_raw_payloads_id_seq; Type: SEQUENCE; Schema: monitoring; Owner: -
--

ALTER TABLE monitoring.provider_raw_payloads ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME monitoring.provider_raw_payloads_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stations; Type: TABLE; Schema: monitoring; Owner: -
--

CREATE TABLE monitoring.stations (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    industrial_park_id bigint,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: stations_id_seq; Type: SEQUENCE; Schema: monitoring; Owner: -
--

ALTER TABLE monitoring.stations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME monitoring.stations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sync_runs; Type: TABLE; Schema: monitoring; Owner: -
--

CREATE TABLE monitoring.sync_runs (
    id bigint NOT NULL,
    provider text DEFAULT 'PREMIER'::text NOT NULL,
    status text NOT NULL,
    checkpoint text,
    records_received integer DEFAULT 0 NOT NULL,
    records_saved integer DEFAULT 0 NOT NULL,
    error_message text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT sync_runs_records_received_check CHECK ((records_received >= 0)),
    CONSTRAINT sync_runs_records_saved_check CHECK ((records_saved >= 0)),
    CONSTRAINT sync_runs_status_check CHECK ((status = ANY (ARRAY['RUNNING'::text, 'SUCCESS'::text, 'PARTIAL'::text, 'AUTH_ERROR'::text, 'RATE_LIMITED'::text, 'PROVIDER_ERROR'::text, 'SCHEMA_ERROR'::text, 'STALE'::text])))
);


--
-- Name: sync_runs_id_seq; Type: SEQUENCE; Schema: monitoring; Owner: -
--

ALTER TABLE monitoring.sync_runs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME monitoring.sync_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: employee_duties; Type: TABLE; Schema: workforce; Owner: -
--

CREATE TABLE workforce.employee_duties (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    duty_name text NOT NULL,
    description text,
    source text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: employee_duties_id_seq; Type: SEQUENCE; Schema: workforce; Owner: -
--

ALTER TABLE workforce.employee_duties ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME workforce.employee_duties_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: employees; Type: TABLE; Schema: workforce; Owner: -
--

CREATE TABLE workforce.employees (
    id bigint NOT NULL,
    employee_code text,
    full_name text NOT NULL,
    birth_date date,
    organizational_unit_id bigint,
    professional_qualification text,
    political_theory text,
    state_management text,
    foreign_language text,
    informatics text,
    work_position text,
    party_position text,
    employment_type text,
    is_active boolean DEFAULT true NOT NULL,
    source_file text,
    source_sheet text,
    source_row integer,
    source_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    industrial_park_id bigint,
    team_name text,
    decision_number text,
    notes text
);


--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: workforce; Owner: -
--

ALTER TABLE workforce.employees ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME workforce.employees_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: task_assignees; Type: TABLE; Schema: workforce; Owner: -
--

CREATE TABLE workforce.task_assignees (
    task_id bigint NOT NULL,
    employee_id bigint NOT NULL
);


--
-- Name: task_status_history; Type: TABLE; Schema: workforce; Owner: -
--

CREATE TABLE workforce.task_status_history (
    id bigint NOT NULL,
    task_id bigint NOT NULL,
    old_status text,
    new_status text NOT NULL,
    changed_by_user_id bigint,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_status_history_id_seq; Type: SEQUENCE; Schema: workforce; Owner: -
--

ALTER TABLE workforce.task_status_history ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME workforce.task_status_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tasks; Type: TABLE; Schema: workforce; Owner: -
--

CREATE TABLE workforce.tasks (
    id bigint NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'TODO'::text NOT NULL,
    priority text DEFAULT 'NORMAL'::text NOT NULL,
    assigned_by_user_id bigint,
    due_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tasks_priority_check CHECK ((priority = ANY (ARRAY['LOW'::text, 'NORMAL'::text, 'HIGH'::text, 'URGENT'::text]))),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['TODO'::text, 'IN_PROGRESS'::text, 'DONE'::text, 'CANCELLED'::text])))
);


--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: workforce; Owner: -
--

ALTER TABLE workforce.tasks ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME workforce.tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: schema_migrations id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.schema_migrations ALTER COLUMN id SET DEFAULT nextval('core.schema_migrations_id_seq'::regclass);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY audit.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (code);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_hash_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: user_accounts user_accounts_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_accounts
    ADD CONSTRAINT user_accounts_pkey PRIMARY KEY (id);


--
-- Name: user_accounts user_accounts_username_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_accounts
    ADD CONSTRAINT user_accounts_username_key UNIQUE (username);


--
-- Name: task_history task_history_pkey; Type: CONSTRAINT; Schema: coordination; Owner: -
--

ALTER TABLE ONLY coordination.task_history
    ADD CONSTRAINT task_history_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: coordination; Owner: -
--

ALTER TABLE ONLY coordination.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_task_code_key; Type: CONSTRAINT; Schema: coordination; Owner: -
--

ALTER TABLE ONLY coordination.tasks
    ADD CONSTRAINT tasks_task_code_key UNIQUE (task_code);


--
-- Name: enterprises enterprises_normalized_name_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.enterprises
    ADD CONSTRAINT enterprises_normalized_name_key UNIQUE (normalized_name);


--
-- Name: enterprises enterprises_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.enterprises
    ADD CONSTRAINT enterprises_pkey PRIMARY KEY (id);


--
-- Name: industrial_parks industrial_parks_code_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.industrial_parks
    ADD CONSTRAINT industrial_parks_code_key UNIQUE (code);


--
-- Name: industrial_parks industrial_parks_name_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.industrial_parks
    ADD CONSTRAINT industrial_parks_name_key UNIQUE (name);


--
-- Name: industrial_parks industrial_parks_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.industrial_parks
    ADD CONSTRAINT industrial_parks_pkey PRIMARY KEY (id);


--
-- Name: organizational_units organizational_units_name_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.organizational_units
    ADD CONSTRAINT organizational_units_name_key UNIQUE (name);


--
-- Name: organizational_units organizational_units_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.organizational_units
    ADD CONSTRAINT organizational_units_pkey PRIMARY KEY (id);


--
-- Name: report_sequences report_sequences_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.report_sequences
    ADD CONSTRAINT report_sequences_pkey PRIMARY KEY (year);


--
-- Name: schema_migrations schema_migrations_filename_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.schema_migrations
    ADD CONSTRAINT schema_migrations_filename_key UNIQUE (filename);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: pdf_documents pdf_documents_pkey; Type: CONSTRAINT; Schema: environmental; Owner: -
--

ALTER TABLE ONLY environmental.pdf_documents
    ADD CONSTRAINT pdf_documents_pkey PRIMARY KEY (id);


--
-- Name: pdf_documents pdf_documents_sha256_key; Type: CONSTRAINT; Schema: environmental; Owner: -
--

ALTER TABLE ONLY environmental.pdf_documents
    ADD CONSTRAINT pdf_documents_sha256_key UNIQUE (sha256);


--
-- Name: waste_records waste_records_enterprise_id_reporting_year_reporting_quarte_key; Type: CONSTRAINT; Schema: environmental; Owner: -
--

ALTER TABLE ONLY environmental.waste_records
    ADD CONSTRAINT waste_records_enterprise_id_reporting_year_reporting_quarte_key UNIQUE (enterprise_id, reporting_year, reporting_quarter, source_type);


--
-- Name: waste_records waste_records_pkey; Type: CONSTRAINT; Schema: environmental; Owner: -
--

ALTER TABLE ONLY environmental.waste_records
    ADD CONSTRAINT waste_records_pkey PRIMARY KEY (id);


--
-- Name: annual_charges annual_charges_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.annual_charges
    ADD CONSTRAINT annual_charges_pkey PRIMARY KEY (id);


--
-- Name: annual_charges annual_charges_snapshot_id_category_code_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.annual_charges
    ADD CONSTRAINT annual_charges_snapshot_id_category_code_key UNIQUE (snapshot_id, category_code);


--
-- Name: annual_lease_snapshots annual_lease_snapshots_enterprise_park_year_lot_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.annual_lease_snapshots
    ADD CONSTRAINT annual_lease_snapshots_enterprise_park_year_lot_key UNIQUE (enterprise_id, industrial_park_id, reporting_year, lot_location);


--
-- Name: annual_lease_snapshots annual_lease_snapshots_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.annual_lease_snapshots
    ADD CONSTRAINT annual_lease_snapshots_pkey PRIMARY KEY (id);


--
-- Name: financial_adjustments financial_adjustments_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.financial_adjustments
    ADD CONSTRAINT financial_adjustments_pkey PRIMARY KEY (id);


--
-- Name: invoice_lines invoice_lines_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.invoice_lines
    ADD CONSTRAINT invoice_lines_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_enterprise_id_invoice_number_invoice_series_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.invoices
    ADD CONSTRAINT invoices_enterprise_id_invoice_number_invoice_series_key UNIQUE (enterprise_id, invoice_number, invoice_series);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: payment_allocations payment_allocations_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.payment_allocations
    ADD CONSTRAINT payment_allocations_pkey PRIMARY KEY (payment_id, invoice_line_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: service_categories service_categories_display_name_key; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.service_categories
    ADD CONSTRAINT service_categories_display_name_key UNIQUE (display_name);


--
-- Name: service_categories service_categories_pkey; Type: CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.service_categories
    ADD CONSTRAINT service_categories_pkey PRIMARY KEY (code);


--
-- Name: asset_categories asset_categories_display_name_key; Type: CONSTRAINT; Schema: infrastructure; Owner: -
--

ALTER TABLE ONLY infrastructure.asset_categories
    ADD CONSTRAINT asset_categories_display_name_key UNIQUE (display_name);


--
-- Name: asset_categories asset_categories_pkey; Type: CONSTRAINT; Schema: infrastructure; Owner: -
--

ALTER TABLE ONLY infrastructure.asset_categories
    ADD CONSTRAINT asset_categories_pkey PRIMARY KEY (code);


--
-- Name: assets assets_asset_code_key; Type: CONSTRAINT; Schema: infrastructure; Owner: -
--

ALTER TABLE ONLY infrastructure.assets
    ADD CONSTRAINT assets_asset_code_key UNIQUE (asset_code);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: infrastructure; Owner: -
--

ALTER TABLE ONLY infrastructure.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: handovers handovers_handover_code_key; Type: CONSTRAINT; Schema: infrastructure; Owner: -
--

ALTER TABLE ONLY infrastructure.handovers
    ADD CONSTRAINT handovers_handover_code_key UNIQUE (handover_code);


--
-- Name: handovers handovers_pkey; Type: CONSTRAINT; Schema: infrastructure; Owner: -
--

ALTER TABLE ONLY infrastructure.handovers
    ADD CONSTRAINT handovers_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: infrastructure; Owner: -
--

ALTER TABLE ONLY infrastructure.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: projects projects_project_code_key; Type: CONSTRAINT; Schema: infrastructure; Owner: -
--

ALTER TABLE ONLY infrastructure.projects
    ADD CONSTRAINT projects_project_code_key UNIQUE (project_code);


--
-- Name: import_batches import_batches_pkey; Type: CONSTRAINT; Schema: ingest; Owner: -
--

ALTER TABLE ONLY ingest.import_batches
    ADD CONSTRAINT import_batches_pkey PRIMARY KEY (id);


--
-- Name: import_batches import_batches_source_file_source_sha256_key; Type: CONSTRAINT; Schema: ingest; Owner: -
--

ALTER TABLE ONLY ingest.import_batches
    ADD CONSTRAINT import_batches_source_file_source_sha256_key UNIQUE (source_file, source_sha256);


--
-- Name: import_rows import_rows_batch_id_source_sheet_source_row_key; Type: CONSTRAINT; Schema: ingest; Owner: -
--

ALTER TABLE ONLY ingest.import_rows
    ADD CONSTRAINT import_rows_batch_id_source_sheet_source_row_key UNIQUE (batch_id, source_sheet, source_row);


--
-- Name: import_rows import_rows_pkey; Type: CONSTRAINT; Schema: ingest; Owner: -
--

ALTER TABLE ONLY ingest.import_rows
    ADD CONSTRAINT import_rows_pkey PRIMARY KEY (id);


--
-- Name: field_reports field_reports_pkey; Type: CONSTRAINT; Schema: maintenance; Owner: -
--

ALTER TABLE ONLY maintenance.field_reports
    ADD CONSTRAINT field_reports_pkey PRIMARY KEY (id);


--
-- Name: field_reports field_reports_report_code_key; Type: CONSTRAINT; Schema: maintenance; Owner: -
--

ALTER TABLE ONLY maintenance.field_reports
    ADD CONSTRAINT field_reports_report_code_key UNIQUE (report_code);


--
-- Name: field_reports field_reports_source_fingerprint_key; Type: CONSTRAINT; Schema: maintenance; Owner: -
--

ALTER TABLE ONLY maintenance.field_reports
    ADD CONSTRAINT field_reports_source_fingerprint_key UNIQUE (source_fingerprint);


--
-- Name: incidents incidents_incident_code_key; Type: CONSTRAINT; Schema: maintenance; Owner: -
--

ALTER TABLE ONLY maintenance.incidents
    ADD CONSTRAINT incidents_incident_code_key UNIQUE (incident_code);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: maintenance; Owner: -
--

ALTER TABLE ONLY maintenance.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: inspections inspections_inspection_code_key; Type: CONSTRAINT; Schema: maintenance; Owner: -
--

ALTER TABLE ONLY maintenance.inspections
    ADD CONSTRAINT inspections_inspection_code_key UNIQUE (inspection_code);


--
-- Name: inspections inspections_pkey; Type: CONSTRAINT; Schema: maintenance; Owner: -
--

ALTER TABLE ONLY maintenance.inspections
    ADD CONSTRAINT inspections_pkey PRIMARY KEY (id);


--
-- Name: work_orders work_orders_order_code_key; Type: CONSTRAINT; Schema: maintenance; Owner: -
--

ALTER TABLE ONLY maintenance.work_orders
    ADD CONSTRAINT work_orders_order_code_key UNIQUE (order_code);


--
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: maintenance; Owner: -
--

ALTER TABLE ONLY maintenance.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);


--
-- Name: corrections corrections_pkey; Type: CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.corrections
    ADD CONSTRAINT corrections_pkey PRIMARY KEY (id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: devices devices_provider_external_code_key; Type: CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.devices
    ADD CONSTRAINT devices_provider_external_code_key UNIQUE (provider, external_code);


--
-- Name: observations observations_device_id_parameter_id_measured_at_provider_re_key; Type: CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.observations
    ADD CONSTRAINT observations_device_id_parameter_id_measured_at_provider_re_key UNIQUE (device_id, parameter_id, measured_at, provider_record_key);


--
-- Name: observations observations_pkey; Type: CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.observations
    ADD CONSTRAINT observations_pkey PRIMARY KEY (id);


--
-- Name: parameters parameters_code_key; Type: CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.parameters
    ADD CONSTRAINT parameters_code_key UNIQUE (code);


--
-- Name: parameters parameters_pkey; Type: CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.parameters
    ADD CONSTRAINT parameters_pkey PRIMARY KEY (id);


--
-- Name: provider_raw_payloads provider_raw_payloads_pkey; Type: CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.provider_raw_payloads
    ADD CONSTRAINT provider_raw_payloads_pkey PRIMARY KEY (id);


--
-- Name: provider_raw_payloads provider_raw_payloads_sync_run_id_payload_hash_key; Type: CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.provider_raw_payloads
    ADD CONSTRAINT provider_raw_payloads_sync_run_id_payload_hash_key UNIQUE (sync_run_id, payload_hash);


--
-- Name: stations stations_code_key; Type: CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.stations
    ADD CONSTRAINT stations_code_key UNIQUE (code);


--
-- Name: stations stations_pkey; Type: CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.stations
    ADD CONSTRAINT stations_pkey PRIMARY KEY (id);


--
-- Name: sync_runs sync_runs_pkey; Type: CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.sync_runs
    ADD CONSTRAINT sync_runs_pkey PRIMARY KEY (id);


--
-- Name: employee_duties employee_duties_employee_id_duty_name_key; Type: CONSTRAINT; Schema: workforce; Owner: -
--

ALTER TABLE ONLY workforce.employee_duties
    ADD CONSTRAINT employee_duties_employee_id_duty_name_key UNIQUE (employee_id, duty_name);


--
-- Name: employee_duties employee_duties_pkey; Type: CONSTRAINT; Schema: workforce; Owner: -
--

ALTER TABLE ONLY workforce.employee_duties
    ADD CONSTRAINT employee_duties_pkey PRIMARY KEY (id);


--
-- Name: employees employees_employee_code_key; Type: CONSTRAINT; Schema: workforce; Owner: -
--

ALTER TABLE ONLY workforce.employees
    ADD CONSTRAINT employees_employee_code_key UNIQUE (employee_code);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: workforce; Owner: -
--

ALTER TABLE ONLY workforce.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: task_assignees task_assignees_pkey; Type: CONSTRAINT; Schema: workforce; Owner: -
--

ALTER TABLE ONLY workforce.task_assignees
    ADD CONSTRAINT task_assignees_pkey PRIMARY KEY (task_id, employee_id);


--
-- Name: task_status_history task_status_history_pkey; Type: CONSTRAINT; Schema: workforce; Owner: -
--

ALTER TABLE ONLY workforce.task_status_history
    ADD CONSTRAINT task_status_history_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: workforce; Owner: -
--

ALTER TABLE ONLY workforce.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_events_created_at; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX idx_audit_events_created_at ON audit.events USING btree (created_at);


--
-- Name: idx_audit_events_entity; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX idx_audit_events_entity ON audit.events USING btree (entity_type, entity_id);


--
-- Name: idx_sessions_expires_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_sessions_expires_at ON auth.sessions USING btree (expires_at);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_sessions_user_id ON auth.sessions USING btree (user_id);


--
-- Name: idx_coord_tasks_category; Type: INDEX; Schema: coordination; Owner: -
--

CREATE INDEX idx_coord_tasks_category ON coordination.tasks USING btree (task_category);


--
-- Name: idx_coord_tasks_due; Type: INDEX; Schema: coordination; Owner: -
--

CREATE INDEX idx_coord_tasks_due ON coordination.tasks USING btree (due_date);


--
-- Name: idx_coord_tasks_status; Type: INDEX; Schema: coordination; Owner: -
--

CREATE INDEX idx_coord_tasks_status ON coordination.tasks USING btree (status);


--
-- Name: idx_enterprises_legal_name; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_enterprises_legal_name ON core.enterprises USING btree (legal_name);


--
-- Name: idx_env_waste_park; Type: INDEX; Schema: environmental; Owner: -
--

CREATE INDEX idx_env_waste_park ON environmental.waste_records USING btree (industrial_park_id);


--
-- Name: idx_env_waste_year; Type: INDEX; Schema: environmental; Owner: -
--

CREATE INDEX idx_env_waste_year ON environmental.waste_records USING btree (reporting_year);


--
-- Name: idx_adjustments_invoice_line; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX idx_adjustments_invoice_line ON finance.financial_adjustments USING btree (invoice_line_id);


--
-- Name: idx_annual_charges_category; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX idx_annual_charges_category ON finance.annual_charges USING btree (category_code);


--
-- Name: idx_invoice_lines_category; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX idx_invoice_lines_category ON finance.invoice_lines USING btree (category_code);


--
-- Name: idx_invoice_lines_invoice; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX idx_invoice_lines_invoice ON finance.invoice_lines USING btree (invoice_id);


--
-- Name: idx_invoices_enterprise_due; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX idx_invoices_enterprise_due ON finance.invoices USING btree (enterprise_id, due_on);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX idx_invoices_status ON finance.invoices USING btree (status);


--
-- Name: idx_lease_snapshots_enterprise; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX idx_lease_snapshots_enterprise ON finance.annual_lease_snapshots USING btree (enterprise_id, reporting_year);


--
-- Name: idx_lease_snapshots_year_park; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX idx_lease_snapshots_year_park ON finance.annual_lease_snapshots USING btree (reporting_year, industrial_park_id);


--
-- Name: idx_payment_allocations_line; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX idx_payment_allocations_line ON finance.payment_allocations USING btree (invoice_line_id);


--
-- Name: idx_payments_enterprise_date; Type: INDEX; Schema: finance; Owner: -
--

CREATE INDEX idx_payments_enterprise_date ON finance.payments USING btree (enterprise_id, paid_on);


--
-- Name: idx_infra_assets_category; Type: INDEX; Schema: infrastructure; Owner: -
--

CREATE INDEX idx_infra_assets_category ON infrastructure.assets USING btree (category_code);


--
-- Name: idx_infra_assets_park; Type: INDEX; Schema: infrastructure; Owner: -
--

CREATE INDEX idx_infra_assets_park ON infrastructure.assets USING btree (industrial_park_id);


--
-- Name: idx_infra_assets_status; Type: INDEX; Schema: infrastructure; Owner: -
--

CREATE INDEX idx_infra_assets_status ON infrastructure.assets USING btree (status);


--
-- Name: idx_infra_handovers_asset; Type: INDEX; Schema: infrastructure; Owner: -
--

CREATE INDEX idx_infra_handovers_asset ON infrastructure.handovers USING btree (asset_id);


--
-- Name: idx_infra_projects_park; Type: INDEX; Schema: infrastructure; Owner: -
--

CREATE INDEX idx_infra_projects_park ON infrastructure.projects USING btree (industrial_park_id);


--
-- Name: idx_infra_projects_status; Type: INDEX; Schema: infrastructure; Owner: -
--

CREATE INDEX idx_infra_projects_status ON infrastructure.projects USING btree (status);


--
-- Name: idx_import_rows_batch_status; Type: INDEX; Schema: ingest; Owner: -
--

CREATE INDEX idx_import_rows_batch_status ON ingest.import_rows USING btree (batch_id, status);


--
-- Name: import_batches_file_kind_status_idx; Type: INDEX; Schema: ingest; Owner: -
--

CREATE INDEX import_batches_file_kind_status_idx ON ingest.import_batches USING btree (source_sha256, import_kind, status);


--
-- Name: idx_field_reports_fingerprint; Type: INDEX; Schema: maintenance; Owner: -
--

CREATE INDEX idx_field_reports_fingerprint ON maintenance.field_reports USING btree (source_fingerprint);


--
-- Name: idx_field_reports_park; Type: INDEX; Schema: maintenance; Owner: -
--

CREATE INDEX idx_field_reports_park ON maintenance.field_reports USING btree (industrial_park_id);


--
-- Name: idx_field_reports_reported_at; Type: INDEX; Schema: maintenance; Owner: -
--

CREATE INDEX idx_field_reports_reported_at ON maintenance.field_reports USING btree (reported_at DESC);


--
-- Name: idx_field_reports_status; Type: INDEX; Schema: maintenance; Owner: -
--

CREATE INDEX idx_field_reports_status ON maintenance.field_reports USING btree (status);


--
-- Name: idx_maint_incidents_park; Type: INDEX; Schema: maintenance; Owner: -
--

CREATE INDEX idx_maint_incidents_park ON maintenance.incidents USING btree (industrial_park_id);


--
-- Name: idx_maint_incidents_severity; Type: INDEX; Schema: maintenance; Owner: -
--

CREATE INDEX idx_maint_incidents_severity ON maintenance.incidents USING btree (severity);


--
-- Name: idx_maint_incidents_status; Type: INDEX; Schema: maintenance; Owner: -
--

CREATE INDEX idx_maint_incidents_status ON maintenance.incidents USING btree (current_status);


--
-- Name: idx_maint_inspections_asset; Type: INDEX; Schema: maintenance; Owner: -
--

CREATE INDEX idx_maint_inspections_asset ON maintenance.inspections USING btree (asset_id);


--
-- Name: idx_maint_orders_asset; Type: INDEX; Schema: maintenance; Owner: -
--

CREATE INDEX idx_maint_orders_asset ON maintenance.work_orders USING btree (asset_id);


--
-- Name: idx_maint_orders_status; Type: INDEX; Schema: maintenance; Owner: -
--

CREATE INDEX idx_maint_orders_status ON maintenance.work_orders USING btree (status);


--
-- Name: idx_observations_device_parameter_time; Type: INDEX; Schema: monitoring; Owner: -
--

CREATE INDEX idx_observations_device_parameter_time ON monitoring.observations USING btree (device_id, parameter_id, measured_at DESC);


--
-- Name: idx_observations_measured_at; Type: INDEX; Schema: monitoring; Owner: -
--

CREATE INDEX idx_observations_measured_at ON monitoring.observations USING brin (measured_at);


--
-- Name: idx_employee_duties_employee; Type: INDEX; Schema: workforce; Owner: -
--

CREATE INDEX idx_employee_duties_employee ON workforce.employee_duties USING btree (employee_id);


--
-- Name: idx_employees_active; Type: INDEX; Schema: workforce; Owner: -
--

CREATE INDEX idx_employees_active ON workforce.employees USING btree (is_active) WHERE is_active;


--
-- Name: idx_employees_park; Type: INDEX; Schema: workforce; Owner: -
--

CREATE INDEX idx_employees_park ON workforce.employees USING btree (industrial_park_id);


--
-- Name: idx_employees_team; Type: INDEX; Schema: workforce; Owner: -
--

CREATE INDEX idx_employees_team ON workforce.employees USING btree (team_name);


--
-- Name: idx_employees_unit; Type: INDEX; Schema: workforce; Owner: -
--

CREATE INDEX idx_employees_unit ON workforce.employees USING btree (organizational_unit_id);


--
-- Name: idx_task_assignees_employee; Type: INDEX; Schema: workforce; Owner: -
--

CREATE INDEX idx_task_assignees_employee ON workforce.task_assignees USING btree (employee_id);


--
-- Name: idx_tasks_status_due; Type: INDEX; Schema: workforce; Owner: -
--

CREATE INDEX idx_tasks_status_due ON workforce.tasks USING btree (status, due_at);


--
-- Name: events events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY audit.events
    ADD CONSTRAINT events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.user_accounts(id);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.user_accounts(id);


--
-- Name: user_accounts user_accounts_role_code_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_accounts
    ADD CONSTRAINT user_accounts_role_code_fkey FOREIGN KEY (role_code) REFERENCES auth.roles(code);


--
-- Name: task_history task_history_changed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: coordination; Owner: -
--

ALTER TABLE ONLY coordination.task_history
    ADD CONSTRAINT task_history_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES auth.user_accounts(id);


--
-- Name: task_history task_history_task_id_fkey; Type: FK CONSTRAINT; Schema: coordination; Owner: -
--

ALTER TABLE ONLY coordination.task_history
    ADD CONSTRAINT task_history_task_id_fkey FOREIGN KEY (task_id) REFERENCES coordination.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_assigned_employee_id_fkey; Type: FK CONSTRAINT; Schema: coordination; Owner: -
--

ALTER TABLE ONLY coordination.tasks
    ADD CONSTRAINT tasks_assigned_employee_id_fkey FOREIGN KEY (assigned_employee_id) REFERENCES workforce.employees(id);


--
-- Name: organizational_units organizational_units_parent_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.organizational_units
    ADD CONSTRAINT organizational_units_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES core.organizational_units(id);


--
-- Name: pdf_documents pdf_documents_verified_by_user_id_fkey; Type: FK CONSTRAINT; Schema: environmental; Owner: -
--

ALTER TABLE ONLY environmental.pdf_documents
    ADD CONSTRAINT pdf_documents_verified_by_user_id_fkey FOREIGN KEY (verified_by_user_id) REFERENCES auth.user_accounts(id);


--
-- Name: waste_records waste_records_enterprise_id_fkey; Type: FK CONSTRAINT; Schema: environmental; Owner: -
--

ALTER TABLE ONLY environmental.waste_records
    ADD CONSTRAINT waste_records_enterprise_id_fkey FOREIGN KEY (enterprise_id) REFERENCES core.enterprises(id);


--
-- Name: waste_records waste_records_industrial_park_id_fkey; Type: FK CONSTRAINT; Schema: environmental; Owner: -
--

ALTER TABLE ONLY environmental.waste_records
    ADD CONSTRAINT waste_records_industrial_park_id_fkey FOREIGN KEY (industrial_park_id) REFERENCES core.industrial_parks(id);


--
-- Name: annual_charges annual_charges_category_code_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.annual_charges
    ADD CONSTRAINT annual_charges_category_code_fkey FOREIGN KEY (category_code) REFERENCES finance.service_categories(code);


--
-- Name: annual_charges annual_charges_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.annual_charges
    ADD CONSTRAINT annual_charges_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES finance.annual_lease_snapshots(id);


--
-- Name: annual_lease_snapshots annual_lease_snapshots_enterprise_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.annual_lease_snapshots
    ADD CONSTRAINT annual_lease_snapshots_enterprise_id_fkey FOREIGN KEY (enterprise_id) REFERENCES core.enterprises(id);


--
-- Name: annual_lease_snapshots annual_lease_snapshots_industrial_park_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.annual_lease_snapshots
    ADD CONSTRAINT annual_lease_snapshots_industrial_park_id_fkey FOREIGN KEY (industrial_park_id) REFERENCES core.industrial_parks(id);


--
-- Name: financial_adjustments financial_adjustments_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.financial_adjustments
    ADD CONSTRAINT financial_adjustments_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.user_accounts(id);


--
-- Name: financial_adjustments financial_adjustments_invoice_line_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.financial_adjustments
    ADD CONSTRAINT financial_adjustments_invoice_line_id_fkey FOREIGN KEY (invoice_line_id) REFERENCES finance.invoice_lines(id);


--
-- Name: invoice_lines invoice_lines_category_code_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.invoice_lines
    ADD CONSTRAINT invoice_lines_category_code_fkey FOREIGN KEY (category_code) REFERENCES finance.service_categories(code);


--
-- Name: invoice_lines invoice_lines_invoice_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.invoice_lines
    ADD CONSTRAINT invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES finance.invoices(id);


--
-- Name: invoices invoices_enterprise_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.invoices
    ADD CONSTRAINT invoices_enterprise_id_fkey FOREIGN KEY (enterprise_id) REFERENCES core.enterprises(id);


--
-- Name: payment_allocations payment_allocations_invoice_line_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.payment_allocations
    ADD CONSTRAINT payment_allocations_invoice_line_id_fkey FOREIGN KEY (invoice_line_id) REFERENCES finance.invoice_lines(id);


--
-- Name: payment_allocations payment_allocations_payment_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.payment_allocations
    ADD CONSTRAINT payment_allocations_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES finance.payments(id);


--
-- Name: payments payments_enterprise_id_fkey; Type: FK CONSTRAINT; Schema: finance; Owner: -
--

ALTER TABLE ONLY finance.payments
    ADD CONSTRAINT payments_enterprise_id_fkey FOREIGN KEY (enterprise_id) REFERENCES core.enterprises(id);


--
-- Name: assets assets_category_code_fkey; Type: FK CONSTRAINT; Schema: infrastructure; Owner: -
--

ALTER TABLE ONLY infrastructure.assets
    ADD CONSTRAINT assets_category_code_fkey FOREIGN KEY (category_code) REFERENCES infrastructure.asset_categories(code);


--
-- Name: assets assets_industrial_park_id_fkey; Type: FK CONSTRAINT; Schema: infrastructure; Owner: -
--

ALTER TABLE ONLY infrastructure.assets
    ADD CONSTRAINT assets_industrial_park_id_fkey FOREIGN KEY (industrial_park_id) REFERENCES core.industrial_parks(id);


--
-- Name: handovers handovers_asset_id_fkey; Type: FK CONSTRAINT; Schema: infrastructure; Owner: -
--

ALTER TABLE ONLY infrastructure.handovers
    ADD CONSTRAINT handovers_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES infrastructure.assets(id);


--
-- Name: projects projects_industrial_park_id_fkey; Type: FK CONSTRAINT; Schema: infrastructure; Owner: -
--

ALTER TABLE ONLY infrastructure.projects
    ADD CONSTRAINT projects_industrial_park_id_fkey FOREIGN KEY (industrial_park_id) REFERENCES core.industrial_parks(id);


--
-- Name: import_batches import_batches_imported_by_user_id_fkey; Type: FK CONSTRAINT; Schema: ingest; Owner: -
--

ALTER TABLE ONLY ingest.import_batches
    ADD CONSTRAINT import_batches_imported_by_user_id_fkey FOREIGN KEY (imported_by_user_id) REFERENCES auth.user_accounts(id);


--
-- Name: import_rows import_rows_batch_id_fkey; Type: FK CONSTRAINT; Schema: ingest; Owner: -
--

ALTER TABLE ONLY ingest.import_rows
    ADD CONSTRAINT import_rows_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES ingest.import_batches(id);


--
-- Name: field_reports field_reports_industrial_park_id_fkey; Type: FK CONSTRAINT; Schema: maintenance; Owner: -
--

ALTER TABLE ONLY maintenance.field_reports
    ADD CONSTRAINT field_reports_industrial_park_id_fkey FOREIGN KEY (industrial_park_id) REFERENCES core.industrial_parks(id);


--
-- Name: field_reports field_reports_linked_incident_id_fkey; Type: FK CONSTRAINT; Schema: maintenance; Owner: -
--

ALTER TABLE ONLY maintenance.field_reports
    ADD CONSTRAINT field_reports_linked_incident_id_fkey FOREIGN KEY (linked_incident_id) REFERENCES maintenance.incidents(id) ON DELETE SET NULL;


--
-- Name: field_reports field_reports_linked_work_order_id_fkey; Type: FK CONSTRAINT; Schema: maintenance; Owner: -
--

ALTER TABLE ONLY maintenance.field_reports
    ADD CONSTRAINT field_reports_linked_work_order_id_fkey FOREIGN KEY (linked_work_order_id) REFERENCES maintenance.work_orders(id) ON DELETE SET NULL;


--
-- Name: incidents incidents_asset_id_fkey; Type: FK CONSTRAINT; Schema: maintenance; Owner: -
--

ALTER TABLE ONLY maintenance.incidents
    ADD CONSTRAINT incidents_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES infrastructure.assets(id);


--
-- Name: incidents incidents_industrial_park_id_fkey; Type: FK CONSTRAINT; Schema: maintenance; Owner: -
--

ALTER TABLE ONLY maintenance.incidents
    ADD CONSTRAINT incidents_industrial_park_id_fkey FOREIGN KEY (industrial_park_id) REFERENCES core.industrial_parks(id);


--
-- Name: inspections inspections_asset_id_fkey; Type: FK CONSTRAINT; Schema: maintenance; Owner: -
--

ALTER TABLE ONLY maintenance.inspections
    ADD CONSTRAINT inspections_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES infrastructure.assets(id);


--
-- Name: work_orders work_orders_asset_id_fkey; Type: FK CONSTRAINT; Schema: maintenance; Owner: -
--

ALTER TABLE ONLY maintenance.work_orders
    ADD CONSTRAINT work_orders_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES infrastructure.assets(id);


--
-- Name: work_orders work_orders_incident_id_fkey; Type: FK CONSTRAINT; Schema: maintenance; Owner: -
--

ALTER TABLE ONLY maintenance.work_orders
    ADD CONSTRAINT work_orders_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES maintenance.incidents(id);


--
-- Name: corrections corrections_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.corrections
    ADD CONSTRAINT corrections_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.user_accounts(id);


--
-- Name: corrections corrections_observation_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.corrections
    ADD CONSTRAINT corrections_observation_id_fkey FOREIGN KEY (observation_id) REFERENCES monitoring.observations(id);


--
-- Name: devices devices_station_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.devices
    ADD CONSTRAINT devices_station_id_fkey FOREIGN KEY (station_id) REFERENCES monitoring.stations(id);


--
-- Name: observations observations_device_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.observations
    ADD CONSTRAINT observations_device_id_fkey FOREIGN KEY (device_id) REFERENCES monitoring.devices(id);


--
-- Name: observations observations_parameter_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.observations
    ADD CONSTRAINT observations_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES monitoring.parameters(id);


--
-- Name: provider_raw_payloads provider_raw_payloads_sync_run_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.provider_raw_payloads
    ADD CONSTRAINT provider_raw_payloads_sync_run_id_fkey FOREIGN KEY (sync_run_id) REFERENCES monitoring.sync_runs(id);


--
-- Name: stations stations_industrial_park_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: -
--

ALTER TABLE ONLY monitoring.stations
    ADD CONSTRAINT stations_industrial_park_id_fkey FOREIGN KEY (industrial_park_id) REFERENCES core.industrial_parks(id);


--
-- Name: employee_duties employee_duties_employee_id_fkey; Type: FK CONSTRAINT; Schema: workforce; Owner: -
--

ALTER TABLE ONLY workforce.employee_duties
    ADD CONSTRAINT employee_duties_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES workforce.employees(id);


--
-- Name: employees employees_industrial_park_id_fkey; Type: FK CONSTRAINT; Schema: workforce; Owner: -
--

ALTER TABLE ONLY workforce.employees
    ADD CONSTRAINT employees_industrial_park_id_fkey FOREIGN KEY (industrial_park_id) REFERENCES core.industrial_parks(id);


--
-- Name: employees employees_organizational_unit_id_fkey; Type: FK CONSTRAINT; Schema: workforce; Owner: -
--

ALTER TABLE ONLY workforce.employees
    ADD CONSTRAINT employees_organizational_unit_id_fkey FOREIGN KEY (organizational_unit_id) REFERENCES core.organizational_units(id);


--
-- Name: task_assignees task_assignees_employee_id_fkey; Type: FK CONSTRAINT; Schema: workforce; Owner: -
--

ALTER TABLE ONLY workforce.task_assignees
    ADD CONSTRAINT task_assignees_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES workforce.employees(id);


--
-- Name: task_assignees task_assignees_task_id_fkey; Type: FK CONSTRAINT; Schema: workforce; Owner: -
--

ALTER TABLE ONLY workforce.task_assignees
    ADD CONSTRAINT task_assignees_task_id_fkey FOREIGN KEY (task_id) REFERENCES workforce.tasks(id);


--
-- Name: task_status_history task_status_history_changed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: workforce; Owner: -
--

ALTER TABLE ONLY workforce.task_status_history
    ADD CONSTRAINT task_status_history_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES auth.user_accounts(id);


--
-- Name: task_status_history task_status_history_task_id_fkey; Type: FK CONSTRAINT; Schema: workforce; Owner: -
--

ALTER TABLE ONLY workforce.task_status_history
    ADD CONSTRAINT task_status_history_task_id_fkey FOREIGN KEY (task_id) REFERENCES workforce.tasks(id);


--
-- Name: tasks tasks_assigned_by_user_id_fkey; Type: FK CONSTRAINT; Schema: workforce; Owner: -
--

ALTER TABLE ONLY workforce.tasks
    ADD CONSTRAINT tasks_assigned_by_user_id_fkey FOREIGN KEY (assigned_by_user_id) REFERENCES auth.user_accounts(id);


--
-- PostgreSQL database dump complete
--
