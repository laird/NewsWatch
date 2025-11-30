#!/bin/bash

# NewsWatch Deployment Script
# Supports both local development and GCP production deployment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print colored message
print_msg() {
    echo -e "${GREEN}==>${NC} $1"
}

print_error() {
    echo -e "${RED}ERROR:${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}WARNING:${NC} $1"
}

# Show usage
usage() {
    cat << EOF
Usage: $0 [COMMAND]

Commands:
    local       Start local development environment
    build       Build Docker image locally
    deploy      Deploy to GCP Cloud Run
    test        Run tests
    help        Show this help message

Examples:
    $0 local              # Start local dev with emulator
    $0 build              # Build Docker image
    $0 deploy             # Deploy to GCP production
EOF
    exit 1
}

# Start local development
start_local() {
    print_msg "Starting local development environment..."
    
    # Check if backend/.env exists
    if [ ! -f "backend/.env" ]; then
        print_error "backend/.env not found. Please create it from backend/.env.example"
        exit 1
    fi
    
    # Check if Firebase emulator is installed
    if ! command -v firebase &> /dev/null; then
        print_warning "Firebase CLI not found. Install with: npm install -g firebase-tools"
        exit 1
    fi
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_msg "Installing dependencies..."
        npm install
    fi
    
    # Start emulator in background
    print_msg "Starting Firestore emulator..."
    npm run emulator &
    EMULATOR_PID=$!
    
    # Wait for emulator to start
    sleep 5
    
    # Start backend server
    print_msg "Starting backend server..."
    npm run dev &
    SERVER_PID=$!
    
    print_msg "Local environment running!"
    print_msg "  Firestore UI: http://localhost:4000"
    print_msg "  Backend API:  http://localhost:3000"
    print_msg "  Health check: http://localhost:3000/health"
    print_msg ""
    print_msg "Press Ctrl+C to stop"
    
    # Wait for interrupt
    trap "kill $EMULATOR_PID $SERVER_PID 2>/dev/null" EXIT
    wait
}

# Build Docker image
build_image() {
    print_msg "Building Docker image..."
    
    IMAGE_NAME="newswatch-backend"
    TAG=${1:-latest}
    
    docker build -t "$IMAGE_NAME:$TAG" .
    
    print_msg "Docker image built: $IMAGE_NAME:$TAG"
    print_msg "Test locally with: docker run -p 8080:8080 --env-file backend/.env $IMAGE_NAME:$TAG"
}

# Deploy to GCP
deploy_gcp() {
    print_msg "Deploying to GCP Cloud Run..."
    
    # Check if gcloud is authenticated
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
        print_error "Not authenticated with gcloud. Run: gcloud auth login"
        exit 1
    fi
    
    # Get project ID
    PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
    if [ -z "$PROJECT_ID" ]; then
        print_error "No GCP project set. Run: gcloud config set project PROJECT_ID"
        exit 1
    fi
    
    print_msg "Deploying to project: $PROJECT_ID"
    
    # Commit check
    if ! git diff-index --quiet HEAD --; then
        print_warning "You have uncommitted changes. Consider committing first."
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Run Cloud Build
    print_msg "Submitting build to Cloud Build..."
    gcloud builds submit --config cloudbuild.yaml .
    
    if [ $? -eq 0 ]; then
        print_msg "Deployment successful!"
        
        # Get service URL
        SERVICE_URL=$(gcloud run services describe newswatch-backend \
            --region=us-central1 \
            --format="value(status.url)" \
            --project="$PROJECT_ID" 2>/dev/null)
        
        if [ -n "$SERVICE_URL" ]; then
            print_msg "Service URL: $SERVICE_URL"
            print_msg "Health check: $SERVICE_URL/health"
        fi
    else
        print_error "Deployment failed!"
        exit 1
    fi
}

# Run tests
run_tests() {
    print_msg "Running tests..."
    
    # Check if backend is running
    if ! curl -s http://localhost:3000/health > /dev/null; then
        print_error "Backend not running. Start with: $0 local"
        exit 1
    fi
    
    print_msg "Testing health endpoint..."
    curl -s http://localhost:3000/health | jq
    
    print_msg "Testing stories endpoint..."
    curl -s http://localhost:3000/api/stories | jq '.stories | length'
    
    print_msg "All tests passed!"
}

# Main script
case "${1:-help}" in
    local)
        start_local
        ;;
    build)
        build_image "${2}"
        ;;
    deploy)
        deploy_gcp
        ;;
    test)
        run_tests
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        print_error "Unknown command: $1"
        usage
        ;;
esac
