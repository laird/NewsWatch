# NewsWatch Database Setup Script
# Run this script to set up the PostgreSQL database

Write-Host "🚀 NewsWatch Database Setup" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Add PostgreSQL to PATH for this session
$env:Path += ";C:\Program Files\PostgreSQL\18\bin"

# Prompt for PostgreSQL password
Write-Host "This script will create the 'newswatch' database and initialize the schema." -ForegroundColor Yellow
Write-Host "You will be prompted for your PostgreSQL password (the one you set during installation).`n" -ForegroundColor Yellow

# Create database
Write-Host "Step 1: Creating database..." -ForegroundColor Green
$createDbResult = & psql -U postgres -c "CREATE DATABASE newswatch;" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Database 'newswatch' created successfully!" -ForegroundColor Green
} else {
    if ($createDbResult -like "*already exists*") {
        Write-Host "⚠️  Database 'newswatch' already exists. Continuing..." -ForegroundColor Yellow
    } else {
        Write-Host "❌ Failed to create database. Error:" -ForegroundColor Red
        Write-Host $createDbResult -ForegroundColor Red
        exit 1
    }
}

Write-Host "`nStep 2: Running database schema..." -ForegroundColor Green
& psql -U postgres -d newswatch -f backend/database/schema.sql
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Schema created successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to create schema." -ForegroundColor Red
    exit 1
}

Write-Host "`nStep 3: Seeding database with sample data..." -ForegroundColor Green
& node backend/database/seed.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Database seeded successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to seed database." -ForegroundColor Red
    exit 1
}

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "✓ Database setup complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Review backend/.env and add any API keys (optional)" -ForegroundColor White
Write-Host "2. Start the server with: npm run dev" -ForegroundColor White
Write-Host "3. Access the app at: http://localhost:3000" -ForegroundColor White
