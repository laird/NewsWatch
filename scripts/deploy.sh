#!/bin/bash

# NewsWatch Deployment Script
# This script sets up the local development environment

set -e  # Exit on error

echo "🚀 NewsWatch Deployment Script"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if PostgreSQL is running
echo "📊 Checking PostgreSQL status..."
if ! pg_isready > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  PostgreSQL is not running${NC}"
    echo "Starting PostgreSQL..."
    sudo systemctl start postgresql
    sleep 2
    
    if ! pg_isready > /dev/null 2>&1; then
        echo -e "${RED}❌ Failed to start PostgreSQL${NC}"
        echo "Please start PostgreSQL manually: sudo systemctl start postgresql"
        exit 1
    fi
fi

echo -e "${GREEN}✓ PostgreSQL is running${NC}"
echo ""

# Create database
echo "📦 Creating newswatch database..."
if psql -lqt | cut -d \| -f 1 | grep -qw newswatch; then
    echo -e "${YELLOW}⚠️  Database 'newswatch' already exists${NC}"
    read -p "Drop and recreate? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        dropdb newswatch
        createdb newswatch
        echo -e "${GREEN}✓ Database recreated${NC}"
    else
        echo "Using existing database"
    fi
else
    createdb newswatch
    echo -e "${GREEN}✓ Database created${NC}"
fi
echo ""

# Run schema
echo "🗄️  Running database schema..."
psql -d newswatch -f backend/database/schema.sql
echo -e "${GREEN}✓ Schema created${NC}"
echo ""

# Seed database
echo "🌱 Seeding database with sample data..."
node backend/database/seed.js
echo -e "${GREEN}✓ Database seeded${NC}"
echo ""

# Check for .env file
if [ ! -f backend/.env ]; then
    echo "⚙️  Creating .env file..."
    cp backend/.env.example backend/.env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}⚠️  Please edit backend/.env to add API keys if needed${NC}"
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi
echo ""

# Install dependencies (if needed)
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
    echo ""
fi

# Start the server
echo "🚀 Starting NewsWatch backend server..."
echo ""
echo "================================"
echo "Server will start on http://localhost:3000"
echo "Press Ctrl+C to stop"
echo "================================"
echo ""

npm start
