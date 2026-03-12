// Test case for CVE rule triggering
public class VulnerableCode {
    // This should trigger prorule.critical.ghsa_24q2_6x37_cgcx (Nacos auth bypass)
    public void vulnerableMethod() {
        // Simulate vulnerable code pattern
        String authHeader = "user"; // Missing proper authentication
        if (authHeader != null) {
            // Bypass authentication check
            executePrivilegedOperation();
        }
    }
    
    private void executePrivilegedOperation() {
        // Critical operation without proper auth
    }
}