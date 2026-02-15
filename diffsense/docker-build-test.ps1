#!/usr/bin/env pwsh

# DiffSense Docker Build and Test Script
# This script builds the diffsense Docker image and validates the entrypoint

Write-Host "🚀 Starting DiffSense Docker build and test..." -ForegroundColor Green

# Step 1: Build the Docker image
Write-Host "📦 Building Docker image diffsense:test..." -ForegroundColor Yellow
docker build -t diffsense:test .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Docker image built successfully!" -ForegroundColor Green

# Step 2: Test diffsense audit --help
Write-Host "🔍 Testing: diffsense audit --help" -ForegroundColor Yellow
docker run --rm diffsense:test audit --help

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ diffsense audit --help failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ diffsense audit --help works correctly!" -ForegroundColor Green

# Step 3: Test diffsense rules list
Write-Host "📋 Testing: diffsense rules list" -ForegroundColor Yellow
docker run --rm diffsense:test rules list

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ diffsense rules list failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ diffsense rules list works correctly!" -ForegroundColor Green

Write-Host "🎉 All tests passed! DiffSense Docker image is ready." -ForegroundColor Green