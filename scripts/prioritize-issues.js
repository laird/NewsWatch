#!/usr/bin/env node

/**
 * GitHub Issue Prioritization Script
 * 
 * Fetches open issues from GitHub and assigns priority labels (P0-P3) based on:
 * - Impact on core functionality
 * - User experience severity
 * - Issue type (bug vs feature vs documentation)
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose') || DRY_RUN;

// Priority label definitions
const PRIORITY_LABELS = {
    P0: { name: 'P0', description: 'Critical priority', color: 'd73a4a' },
    P1: { name: 'P1', description: 'High priority', color: 'e99695' },
    P2: { name: 'P2', description: 'Medium priority', color: 'fbca04' },
    P3: { name: 'P3', description: 'Low priority', color: '0e8a16' }
};

// Keywords for priority scoring
const PRIORITY_KEYWORDS = {
    critical: ['crash', 'broken', 'not working', 'error', 'fail', 'bug'],
    high: ['deduplicate', 'duplicate', 'voting', 'feedback', 'interactive', 'insights', 'ai'],
    medium: ['ui', 'ux', 'style', 'improve', 'enhance', 'banner', 'wrapping', 'teaser'],
    low: ['documentation', 'readme', 'copilot', 'instructions', 'nice to have', 'optional']
};

/**
 * Execute shell command and return output
 */
function exec(command) {
    try {
        return execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (error) {
        console.error(`Command failed: ${command}`);
        console.error(error.message);
        return null;
    }
}

/**
 * Fetch all open issues from GitHub
 */
function fetchIssues() {
    console.log('📥 Fetching open issues from GitHub...');
    const output = exec('gh issue list --limit 100 --json number,title,body,labels,state,createdAt,url --state open');
    if (!output) {
        console.error('❌ Failed to fetch issues');
        process.exit(1);
    }

    const issues = JSON.parse(output);
    console.log(`✓ Found ${issues.length} open issues\n`);
    return issues;
}

/**
 * Calculate priority score for an issue
 */
function calculatePriority(issue) {
    const text = `${issue.title} ${issue.body || ''}`.toLowerCase();
    let score = 0;
    let reasons = [];

    // Check for critical keywords (highest priority)
    for (const keyword of PRIORITY_KEYWORDS.critical) {
        if (text.includes(keyword)) {
            score += 10;
            reasons.push(`critical: ${keyword}`);
        }
    }

    // Check for high priority keywords
    for (const keyword of PRIORITY_KEYWORDS.high) {
        if (text.includes(keyword)) {
            score += 5;
            reasons.push(`high: ${keyword}`);
        }
    }

    // Check for medium priority keywords
    for (const keyword of PRIORITY_KEYWORDS.medium) {
        if (text.includes(keyword)) {
            score += 2;
            reasons.push(`medium: ${keyword}`);
        }
    }

    // Check for low priority keywords (reduce score)
    for (const keyword of PRIORITY_KEYWORDS.low) {
        if (text.includes(keyword)) {
            score -= 3;
            reasons.push(`low: ${keyword}`);
        }
    }

    // Specific issue analysis based on known patterns
    if (issue.number === 3) {
        // Deduplication is core functionality
        score = Math.max(score, 20);
        reasons.push('manual: core functionality issue');
    } else if (issue.number === 6 || issue.number === 8) {
        // Insights and voting are important UX features
        score = Math.max(score, 10);
        reasons.push('manual: important user feature');
    }

    // Determine priority label
    let priority;
    if (score >= 20) priority = 'P0';
    else if (score >= 10) priority = 'P1';
    else if (score >= 5) priority = 'P2';
    else priority = 'P3';

    return { priority, score, reasons };
}

/**
 * Create priority labels if they don't exist
 */
function ensureLabelsExist() {
    console.log('🏷️  Ensuring priority labels exist...');

    // Get existing labels
    const existingLabels = exec('gh label list --json name');
    const labelNames = existingLabels ? JSON.parse(existingLabels).map(l => l.name) : [];

    for (const [key, label] of Object.entries(PRIORITY_LABELS)) {
        if (labelNames.includes(label.name)) {
            console.log(`  ✓ Label ${label.name} already exists`);
        } else {
            if (DRY_RUN) {
                console.log(`  [DRY RUN] Would create label: ${label.name}`);
            } else {
                const cmd = `gh label create "${label.name}" --description "${label.description}" --color "${label.color}"`;
                exec(cmd);
                console.log(`  ✓ Created label ${label.name}`);
            }
        }
    }
    console.log('');
}

/**
 * Apply priority label to an issue
 */
function applyLabel(issue, priority) {
    // Check if issue already has this priority label
    const hasLabel = issue.labels.some(l => l.name === priority);
    if (hasLabel) {
        console.log(`  ✓ Issue #${issue.number} already has ${priority} label`);
        return;
    }

    // Remove any existing priority labels first
    const existingPriorityLabels = issue.labels.filter(l => /^P[0-3]$/.test(l.name));
    for (const label of existingPriorityLabels) {
        if (DRY_RUN) {
            console.log(`  [DRY RUN] Would remove label ${label.name} from #${issue.number}`);
        } else {
            exec(`gh issue edit ${issue.number} --remove-label "${label.name}"`);
        }
    }

    // Add new priority label
    if (DRY_RUN) {
        console.log(`  [DRY RUN] Would add ${priority} label to #${issue.number}`);
    } else {
        exec(`gh issue edit ${issue.number} --add-label "${priority}"`);
        console.log(`  ✓ Added ${priority} label to #${issue.number}`);
    }
}

/**
 * Main execution
 */
function main() {
    console.log('🤖 GitHub Issue Prioritization Tool\n');

    if (DRY_RUN) {
        console.log('⚠️  Running in DRY RUN mode - no changes will be made\n');
    }

    // Ensure labels exist
    ensureLabelsExist();

    // Fetch and prioritize issues
    const issues = fetchIssues();
    const prioritized = [];

    console.log('🎯 Analyzing and prioritizing issues...\n');

    for (const issue of issues) {
        const analysis = calculatePriority(issue);
        prioritized.push({ ...issue, ...analysis });

        console.log(`#${issue.number}: ${issue.title}`);
        console.log(`  Priority: ${analysis.priority} (score: ${analysis.score})`);
        if (VERBOSE && analysis.reasons.length > 0) {
            console.log(`  Reasons: ${analysis.reasons.join(', ')}`);
        }
        console.log(`  URL: ${issue.url}`);

        // Apply label
        applyLabel(issue, analysis.priority);
        console.log('');
    }

    // Sort by priority and score
    prioritized.sort((a, b) => {
        const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.score - a.score;
    });

    // Summary
    console.log('📊 Summary:');
    console.log('═══════════════════════════════════════════════════\n');

    const summary = { P0: [], P1: [], P2: [], P3: [] };
    for (const issue of prioritized) {
        summary[issue.priority].push(issue);
    }

    for (const [priority, issues] of Object.entries(summary)) {
        if (issues.length > 0) {
            console.log(`${priority}: ${issues.length} issue(s)`);
            for (const issue of issues) {
                console.log(`  - #${issue.number}: ${issue.title}`);
            }
            console.log('');
        }
    }

    if (prioritized.length > 0) {
        console.log(`🏆 Highest priority issue: #${prioritized[0].number} - ${prioritized[0].title} (${prioritized[0].priority})`);
        console.log(`   ${prioritized[0].url}`);
    }

    if (DRY_RUN) {
        console.log('\n💡 Run without --dry-run to apply labels');
    } else {
        console.log('\n✅ Prioritization complete!');
    }
}

// Run the script
main();
