CREATE FUNCTION touch_updated() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE FUNCTION immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Record is append-only'; END $$;
CREATE TABLE clusters (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, name text NOT NULL,
 owner text NOT NULL, cpu_capacity integer NOT NULL CHECK(cpu_capacity>0), memory_gib integer NOT NULL CHECK(memory_gib>0),
 reserve_pct integer NOT NULL DEFAULT 20 CHECK(reserve_pct BETWEEN 0 AND 80),
 reviewed_on date NOT NULL, evidence text NOT NULL CHECK(length(trim(evidence))>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workloads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, name text NOT NULL,
 cluster_id uuid NOT NULL REFERENCES clusters(id), owner text NOT NULL,
 cpu integer NOT NULL CHECK(cpu BETWEEN 1 AND 100000), memory_gib integer NOT NULL CHECK(memory_gib BETWEEN 1 AND 1000000),
 critical boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workload_id uuid NOT NULL REFERENCES workloads(id),
 observed_on date NOT NULL, window_days integer NOT NULL CHECK(window_days BETWEEN 1 AND 365),
 cpu_p95 numeric(12,3) NOT NULL CHECK(cpu_p95>=0), memory_p95_gib numeric(12,3) NOT NULL CHECK(memory_p95_gib>=0),
 evidence text NOT NULL CHECK(length(trim(evidence))>0), actor text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workload_id,observed_on)
);
CREATE TABLE changes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, workload_id uuid NOT NULL REFERENCES workloads(id),
 observation_id uuid NOT NULL REFERENCES observations(id), old_cpu integer NOT NULL, old_memory_gib integer NOT NULL,
 proposed_cpu integer NOT NULL CHECK(proposed_cpu>0), proposed_memory_gib integer NOT NULL CHECK(proposed_memory_gib>0),
 due_on date NOT NULL, reason text NOT NULL, rollback_plan text NOT NULL,
 actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), change_id uuid UNIQUE NOT NULL REFERENCES changes(id),
 decision text NOT NULL CHECK(decision IN ('approved','rejected')), actor text NOT NULL,
 evidence text NOT NULL CHECK(length(trim(evidence))>0), impact_review text NOT NULL CHECK(length(trim(impact_review))>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE outcomes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), change_id uuid UNIQUE NOT NULL REFERENCES changes(id),
 outcome text NOT NULL CHECK(outcome IN ('verified','failed','cancelled')), actor text NOT NULL, evidence text NOT NULL CHECK(length(trim(evidence))>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE imports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), digest text UNIQUE NOT NULL, filename text NOT NULL, original_csv text NOT NULL,
 mapping jsonb NOT NULL, actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE source_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_key text UNIQUE NOT NULL, import_id uuid NOT NULL REFERENCES imports(id),
 description text NOT NULL, risk_type text NOT NULL DEFAULT '', execution text NOT NULL DEFAULT '',
 source_created text NOT NULL DEFAULT '', source_executed text NOT NULL DEFAULT '', source_row jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE followups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, name text NOT NULL, owner text NOT NULL, due_on date NOT NULL,
 source_action_id uuid REFERENCES source_actions(id), resolution text, actor text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), command text NOT NULL, actor text NOT NULL, details jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE VIEW workload_review AS
 SELECT w.*,c.code cluster_code,o.id observation_id,o.observed_on,o.window_days,o.cpu_p95,o.memory_p95_gib,o.evidence,
 CASE WHEN o.id IS NULL THEN 'missing' WHEN o.observed_on>current_date THEN 'future' WHEN o.observed_on<current_date-7 THEN 'stale' WHEN o.window_days<14 THEN 'short-window' ELSE 'ready' END data_state,
 CASE WHEN o.observed_on BETWEEN current_date-7 AND current_date AND o.window_days>=14 THEN GREATEST(1,CEIL(o.cpu_p95/0.70))::integer END suggested_cpu,
 CASE WHEN o.observed_on BETWEEN current_date-7 AND current_date AND o.window_days>=14 THEN GREATEST(1,CEIL(o.memory_p95_gib/0.70))::integer END suggested_memory_gib
 FROM workloads w JOIN clusters c ON c.id=w.cluster_id
 LEFT JOIN LATERAL (SELECT * FROM observations s WHERE s.workload_id=w.id ORDER BY observed_on DESC LIMIT 1) o ON true WHERE w.active;
CREATE VIEW capacity_review AS
 SELECT c.id,c.code,c.name,c.owner,c.cpu_capacity,c.memory_gib,c.reserve_pct,c.reviewed_on,
 COUNT(w.id)::integer workloads,COALESCE(SUM(w.cpu),0)::integer allocated_cpu,COALESCE(SUM(w.memory_gib),0)::integer allocated_memory_gib,
 FLOOR(c.cpu_capacity*(100-c.reserve_pct)/100.0)::integer-COALESCE(SUM(w.cpu),0)::integer cpu_headroom,
 FLOOR(c.memory_gib*(100-c.reserve_pct)/100.0)::integer-COALESCE(SUM(w.memory_gib),0)::integer memory_headroom_gib,
 CASE WHEN c.reviewed_on<current_date-30 THEN 'stale-inventory' ELSE 'reviewed' END inventory_state
 FROM clusters c LEFT JOIN workloads w ON w.cluster_id=c.id AND w.active GROUP BY c.id;
CREATE VIEW change_review AS
 SELECT ch.*,w.code workload_code,w.name,w.owner,d.decision,d.actor reviewer,d.evidence approval_evidence,
 d.impact_review,o.outcome,o.evidence outcome_evidence,COALESCE(o.outcome,d.decision,'proposed') status,
 ch.due_on<current_date AND o.id IS NULL AND COALESCE(d.decision,'')<>'rejected' overdue
 FROM changes ch JOIN workloads w ON w.id=ch.workload_id LEFT JOIN decisions d ON d.change_id=ch.id LEFT JOIN outcomes o ON o.change_id=ch.id;
CREATE VIEW compliance_review AS
 SELECT 'CM-3-DECISION' rule,code record,'Proposal awaits a recorded decision' issue FROM change_review WHERE decision IS NULL
 UNION ALL SELECT 'CM-3-VALIDATION',code,'Approved change has no verification outcome' FROM change_review WHERE decision='approved' AND outcome IS NULL
 UNION ALL SELECT 'LOCAL-METRICS',code,'Sizing evidence is '||data_state FROM workload_review WHERE data_state<>'ready'
 UNION ALL SELECT 'LOCAL-INVENTORY',code,'Cluster capacity review is over thirty days old' FROM capacity_review WHERE inventory_state<>'reviewed';
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY; REVOKE ALL ON clusters FROM PUBLIC;
CREATE TRIGGER touch BEFORE UPDATE ON clusters FOR EACH ROW EXECUTE FUNCTION touch_updated();
ALTER TABLE workloads ENABLE ROW LEVEL SECURITY; REVOKE ALL ON workloads FROM PUBLIC;
CREATE TRIGGER touch BEFORE UPDATE ON workloads FOR EACH ROW EXECUTE FUNCTION touch_updated();
ALTER TABLE observations ENABLE ROW LEVEL SECURITY; REVOKE ALL ON observations FROM PUBLIC;
CREATE TRIGGER touch BEFORE UPDATE ON observations FOR EACH ROW EXECUTE FUNCTION touch_updated();
ALTER TABLE changes ENABLE ROW LEVEL SECURITY; REVOKE ALL ON changes FROM PUBLIC;
CREATE TRIGGER touch BEFORE UPDATE ON changes FOR EACH ROW EXECUTE FUNCTION touch_updated();
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY; REVOKE ALL ON decisions FROM PUBLIC;
CREATE TRIGGER touch BEFORE UPDATE ON decisions FOR EACH ROW EXECUTE FUNCTION touch_updated();
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY; REVOKE ALL ON outcomes FROM PUBLIC;
CREATE TRIGGER touch BEFORE UPDATE ON outcomes FOR EACH ROW EXECUTE FUNCTION touch_updated();
ALTER TABLE imports ENABLE ROW LEVEL SECURITY; REVOKE ALL ON imports FROM PUBLIC;
CREATE TRIGGER touch BEFORE UPDATE ON imports FOR EACH ROW EXECUTE FUNCTION touch_updated();
ALTER TABLE source_actions ENABLE ROW LEVEL SECURITY; REVOKE ALL ON source_actions FROM PUBLIC;
CREATE TRIGGER touch BEFORE UPDATE ON source_actions FOR EACH ROW EXECUTE FUNCTION touch_updated();
ALTER TABLE followups ENABLE ROW LEVEL SECURITY; REVOKE ALL ON followups FROM PUBLIC;
CREATE TRIGGER touch BEFORE UPDATE ON followups FOR EACH ROW EXECUTE FUNCTION touch_updated();
ALTER TABLE activity ENABLE ROW LEVEL SECURITY; REVOKE ALL ON activity FROM PUBLIC;
CREATE TRIGGER touch BEFORE UPDATE ON activity FOR EACH ROW EXECUTE FUNCTION touch_updated();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON observations FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON changes FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON decisions FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON outcomes FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON imports FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON source_actions FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON activity FOR EACH ROW EXECUTE FUNCTION immutable_record();
REVOKE ALL ON capacity_review,workload_review,change_review,compliance_review FROM PUBLIC;
