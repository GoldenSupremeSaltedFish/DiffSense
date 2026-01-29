# Nacos High Risk Fixtures
 
 ## 1. ThreadPool Semantic Change
 **File**: `dump_all_processor.diff`
 **Expected Signal**: `runtime.threadpool_semantic_change`
 **Risk**: High (Unbounded thread pool creation)
 
 ## 2. Concurrent Regression
 **File**: `health_check_reactor.diff`
 **Expected Signal**: `runtime.concurrency_regression`
 **Risk**: High (ConcurrentHashMap -> HashMap in static field)
 
 ## 3. Synchronization Removal
 **File**: `watch_file_center.diff`
 **Expected Signal**: `runtime.lock_removal_risk`
 **Risk**: High (Removed `synchronized` from static register method)
