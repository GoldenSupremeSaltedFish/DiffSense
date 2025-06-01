package com.yourorg.gitimpact.impact;

import java.util.Objects;

public class MethodRef {
    private final String className;
    private final String methodName;

    public MethodRef(String className, String methodName) {
        this.className = className;
        this.methodName = methodName;
    }

    public static MethodRef fromSignature(String signature) {
        int lastDot = signature.lastIndexOf('.');
        if (lastDot == -1) {
            return new MethodRef("UnknownClass", signature);
        }
        return new MethodRef(
            signature.substring(0, lastDot),
            signature.substring(lastDot + 1)
        );
    }

    public String getClassName() {
        return className;
    }

    public String getMethodName() {
        return methodName;
    }

    public String toSignature() {
        return className + "." + methodName;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        MethodRef methodRef = (MethodRef) o;
        return Objects.equals(className, methodRef.className) &&
               Objects.equals(methodName, methodRef.methodName);
    }

    @Override
    public int hashCode() {
        return Objects.hash(className, methodName);
    }

    @Override
    public String toString() {
        return toSignature();
    }
} 