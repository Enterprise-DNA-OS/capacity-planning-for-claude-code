INSERT INTO clusters(id,code,name,owner,cpu_capacity,memory_gib,reserve_pct,reviewed_on,evidence) VALUES
 ('10000000-0000-0000-0000-000000000001','AKL-PROD','Auckland production','Aroha',64,256,20,current_date-3,'Synthetic inventory review'),
 ('10000000-0000-0000-0000-000000000002','WLG-DR','Wellington recovery','Hemi',32,128,25,current_date-45,'Synthetic recovery inventory') ON CONFLICT DO NOTHING;
INSERT INTO workloads(id,code,name,cluster_id,owner,cpu,memory_gib,critical) VALUES
 ('20000000-0000-0000-0000-000000000001','WEB-01','Customer portal','10000000-0000-0000-0000-000000000001','Aroha',16,64,true),
 ('20000000-0000-0000-0000-000000000002','BATCH-01','Reporting worker','10000000-0000-0000-0000-000000000001','Hemi',32,160,false),
 ('20000000-0000-0000-0000-000000000003','BATCH-02','Reporting worker recovery','10000000-0000-0000-0000-000000000002','Hemi',8,32,false),
 ('20000000-0000-0000-0000-000000000004','DB-01','Orders database','10000000-0000-0000-0000-000000000001','Maia',16,64,true) ON CONFLICT DO NOTHING;
INSERT INTO observations(id,workload_id,observed_on,window_days,cpu_p95,memory_p95_gib,evidence,actor) VALUES
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',current_date-1,28,4.2,14,'Synthetic monitoring window WEB-01','Demo'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',current_date-1,28,12.6,70,'Synthetic monitoring window BATCH-01','Demo'),
 ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003',current_date-20,28,2.1,7,'Synthetic stale monitoring window','Demo') ON CONFLICT DO NOTHING;
INSERT INTO changes(id,code,workload_id,observation_id,old_cpu,old_memory_gib,proposed_cpu,proposed_memory_gib,due_on,reason,rollback_plan,actor) VALUES
 ('40000000-0000-0000-0000-000000000001','CHG-001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',16,64,6,20,current_date-2,'Review oversized portal allocation','Restore 16 CPU and 64 GiB during maintenance','Demo') ON CONFLICT DO NOTHING;
INSERT INTO followups(id,code,name,owner,due_on,actor) VALUES
 ('50000000-0000-0000-0000-000000000001','TASK-001','Collect orders database measurements','Maia',current_date-3,'Demo'),
 ('50000000-0000-0000-0000-000000000002','TASK-002','Refresh recovery inventory','Hemi',current_date+2,'Demo') ON CONFLICT DO NOTHING;
