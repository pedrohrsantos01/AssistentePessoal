SELECT p.pid,t.tid,t.name,t.is_main_thread FROM thread t JOIN process p USING(upid) WHERE p.pid IN (7341,8339,8859,9652,10117,10729,11563,12092,12441,12906);
