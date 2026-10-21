SELECT p.pid,t.tid,t.name,t.is_main_thread FROM thread t JOIN process p USING(upid) WHERE p.pid IN (6922,7532,8049,8499,9128,9533,10037,10501,11120,11797);
