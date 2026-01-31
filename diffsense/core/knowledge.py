from typing import Set

# Layer 1: Knowledge Base / TypeTags

# P0: Thread Safety Types
THREAD_SAFE_TYPES: Set[str] = {
    "ConcurrentHashMap",
    "AtomicInteger",
    "AtomicLong",
    "AtomicBoolean",
    "LongAdder",
    "DoubleAdder",
    "BlockingQueue",
    "ArrayBlockingQueue",
    "LinkedBlockingQueue",
    "PriorityBlockingQueue",
    "DelayQueue",
    "SynchronousQueue",
    "LinkedTransferQueue",
    "LinkedBlockingDeque",
    "CopyOnWriteArrayList",
    "CopyOnWriteArraySet",
    "ConcurrentLinkedQueue",
    "ConcurrentLinkedDeque",
    "ConcurrentSkipListMap",
    "ConcurrentSkipListSet",
    "ReentrantLock",
    "ReentrantReadWriteLock",
    "StampedLock",
    "Semaphore",
    "CountDownLatch",
    "CyclicBarrier",
    "Exchanger",
    "Phaser",
    "StringBuffer", # Legacy but thread-safe
    "Hashtable",    # Legacy but thread-safe
    "Vector"        # Legacy but thread-safe
}

# P0: Lock Types (Subset of Thread Safe, but specific for locking semantics)
LOCK_TYPES: Set[str] = {
    "Lock",
    "ReentrantLock",
    "ReadWriteLock",
    "ReentrantReadWriteLock",
    "StampedLock"
}

# P1: Resource Types (Need closing)
RESOURCE_TYPES: Set[str] = {
    "InputStream",
    "OutputStream",
    "Reader",
    "Writer",
    "Connection",
    "Statement",
    "ResultSet",
    "Socket",
    "ServerSocket",
    "Channel",
    "Selector",
    "FileLock"
}

def is_thread_safe(type_name: str) -> bool:
    """Check if a type is known to be thread-safe."""
    # Simple name match for now. 
    # In a real system, we'd handle full qualified names and inheritance.
    if not type_name:
        return False
    # Handle generics like ConcurrentHashMap<K,V> -> ConcurrentHashMap
    base_name = type_name.split('<')[0].strip()
    return base_name in THREAD_SAFE_TYPES

def is_lock_type(type_name: str) -> bool:
    base_name = type_name.split('<')[0].strip()
    return base_name in LOCK_TYPES
